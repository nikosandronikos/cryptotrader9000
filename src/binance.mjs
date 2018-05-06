import axios from 'axios';
import crypto from 'crypto';
import querystring from 'querystring';

import {intervalToMs} from './utils.mjs';
import {CoinPair} from './coin.mjs';
import {Account} from './account.mjs';
import {StreamManager} from './binancestream.mjs';
import {log} from './log.mjs';

export const BinanceCommands = {
    time: {
        name: 'exchangeTime',
        url: 'api/v1/time',
        weight: 1,
        limitType: 'REQUESTS'
    },
    info: {
        name: 'exchangeInfo',
        url: 'api/v1/exchangeInfo',
        weight: 1,
        limitType: 'REQUESTS'
    },
    klines: {
        name: 'klines',
        url: 'api/v1/klines',
        weight: 1,
        limitType: 'REQUESTS',
        reqParams: ['symbol', 'interval']
    },
    openOrdersForSymbol: {
        name: 'openOrdersForSymbol',
        url:       '/api/v3/openOrders',
        weight:    1,
        limitType: 'REQUESTS',
        reqAuth:   true,
        reqParams: ['symbol', 'timestamp']
    },
    accountInfo: {
        name:   'accountInfo',
        url:    '/api/v3/account',
        weight: 5,
        limitType:  'REQUESTS',
        reqAuth:    true,
        reqParams:  ['timestamp']
    },
    available: {
        name: 'apiAvailable',
        url: 'api/v1/ping',
        weight: 1
    }
};

class Limits {
    constructor() {
        this._limits = new Map();
    }

    setLimit(type, max, interval) {
        if (!this._limits.has(type)) {
            this._limits.set(type, []);
        }

        const intervalMs = intervalToMs(interval);
        const limits = this._limits.get(type);

        // Overwrite any existing limit of this interval
        for (const limit of limits) {
            if (limit.interval == intervalMs) {
                limit.max = max;
                return;
            }
        }

        limits.push({
            max: max,
            remain: max,
            interval: intervalMs,
            start: Date.now()
        });
    }

    // Tests against a limit and returns false if the limit is exceeded.
    // If the limit is not exceed, true is returned and an operation is
    // recorded against the limit.
    testAndExecute(type) {
        const limits = this._limits.get(type);
        if (limits === undefined) {
            log.info(this._limits);
            throw `${type} is not a valid limit type`;
        }

        for (const limit of limits) {
            if (limit.remain < 1) return false;
            limit.remain --;
        }

        return true;
    }

    update(time) {
        for (const limitType of this._limits) {
            for (const limit of limitType) {
                if (time - limit.start > limit.interval) {
                    limit.start = time;
                    limit.remain = limit.max;
                }
            }
        }
    }
}

export class BinanceAccess {
    constructor(timeout=3000) {
        this.ready = false;
        this.base = 'https://api.binance.com/';
        this._axiosInst = axios.create({
            baseURL: this.base,
            timeout: timeout
        });
        this.ready = false;
        this.limits = null;
        this.accounts = new Map();
        this.streams = new StreamManager();
        this.coinPairInfo = new Map();
        this.coinPairs = new Map();
    }

    async apiCommand(cmd, params={}, account=null) {
        if (!this.ready) throw 'BinanceAccess not ready.';
        if (cmd === undefined) return false;

        if (this.limits && !this.limits.testAndExecute(cmd.limitType)) {
            return false;
        }

        if (cmd.hasOwnProperty('reqParams')) {
            let paramsOk = true;
            let missing = [];
            for (const param of cmd.reqParams) {
                if (!params.hasOwnProperty(param)) {
                    paramsOk = false;
                    missing.push(param);
                }
            }
            if (!paramsOk) {
                throw `${cmd.name} missing parameters: ${missing.join()}`;
            }
        }

        const requestConfig = {params: params};

        if (cmd.reqAuth) {
            if (account === null) throw `Account required for ${cmd.name}`;
            requestConfig.headers = {'X-MBX-APIKEY': account.key};
            const totalParams = querystring.stringify(params);
            const hmac = crypto.createHmac('sha256', account.secret);
            requestConfig.params.signature = hmac.update(totalParams).digest('hex');
        }

        return this._axiosInst.get(cmd.url, requestConfig)
            .then(response => {
                log.info(
                    `${cmd.url} returned ${response.statusText} `+
                    `(${response.status})`
                );
                return response.data;
            })
            .catch(err => {
                log.error(`${cmd.url} returned error.`);
                log.debug('requestConfig:', requestConfig);
                if (err.response) {
                    log.error('response:', err.response.data);
                    log.debug(err.response.status);
                    //console.log(err.response.headers);
                } else if (err.request) {
                    // The request was made but no response received.
                    log.error('No response');
                    log.debug(err.request);
                } else {
                    log.error('Error', err.message);
                }
                throw err;
            });
    }

    // Initialises the instance with the required historic data.
    // No other function can be run until init() is completed.
    async init() {
        this.ready = true;
        const info = await this.apiCommand(BinanceCommands.info);
        log.info('Local/Server time difference = '
            +`${Date.now() - info.serverTime}ms`);

        // Init the API request limits
        this.limits = new Limits();
        for (const limit of info.rateLimits) {
            this.limits.setLimit(
                limit.rateLimitType, parseInt(limit.limit), limit.interval
            );
        }

        if (info.exchangeFilters.length > 0) throw 'Exchange filters now present.';

        for (const pair of info.symbols) {
            this.coinPairInfo.set(pair.symbol, pair);
        }

        return true;
    }

    getTimestamp() {
        return Date.now();
    }

    async loadAccount(name, key, secret) {
        if (!this.ready) throw 'BinanceAccess not ready.';
        if (this.accounts.has(name)) throw 'Account already exists.';
        const account = new Account(this, name, key, secret);
        this.accounts.set(name, account);
        await account.syncBalances();
    }

    getCoinPair(base, quote) {
        const symbol = `${base}${quote}`;
        if (!this.coinPairs.has(base)) this.coinPairs.set(base, new Map());
        const baseMap = this.coinPairs.get(base);
        if (!baseMap.has(quote)) {
            if (!this.coinPairInfo.has(symbol)) {
                throw new Error(`${symbol} not available on exchange`);
            }
            const coinPair = new CoinPair(
                    this, base, quote, this.coinPairInfo.get(symbol)
                );
            baseMap.set(quote, coinPair);
            return coinPair;
        }
        return baseMap.get(quote);
    }
}
