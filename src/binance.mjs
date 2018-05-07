import axios from 'axios';
import crypto from 'crypto';
import querystring from 'querystring';

import {intervalToMs} from './utils.mjs';
import {CoinPair} from './coin.mjs';
import {Account} from './account.mjs';
import {StreamManager} from './binancestream.mjs';
import {log} from './log.mjs';

/**
 * Command descriptions that are passed to {@link BinanceAccess.apiCommand}.
 * @access public
 */
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

/**
 * @access package
 */
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

/**
 * The main entry point for access to Binance.
 * Each application requires at least one instance of this class.
 * See {@link apiCommand} for an example on using this class.
 * @access public
 */
export class BinanceAccess {
    /**
     * Create an instance of BinanceAccess. Generally an instance created
     * via this constructor will need init() called before use.
     * @param {number} timeout  The number of ms to use as timeout for REST API
     *                          calls.
     */
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

    /**
     * Execute a Binance REST API command.
     * Documentation for the Binance REST API is at
     * https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md
     * @param {object} cmd      A command definition from
     *                          @link{BinanceCommands}.
     * @param {object} params   An object containing parameters passed to the
     *                          API call, stored as key,value pairs.
     * @param {string} accountName  The name of the Binance account to use for
     *                          authentication. The account must have been
     *                          created with {@link loadAccount}.
     *
     * @returns The object returned by the Binance API call (see Binance docs)
     * @throws {Error}  In the following situations (see error string):
     *                  - BinanceAccess not initialised,
     *                  - Required parameters missing,
     *                  - Authentication required but no account given,
     *                  - Error returned by Binance
     *                  - Network error
     *.
     * @example
     *   const binance = new BinanceAccess();
     *   await binance.init();
     *   binance.loadAccount('Zaphod', MyKey, MySecret);
     *   const info = await binance.apiCommand(
     *       BinanceCommands.accountInfo,
     *       {timestamp: this.binance.getTimestamp()},
     *       'Zaphod'
     *   );
     */
    async apiCommand(cmd, params={}, accountName=null) {
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
            if (accountName === null) throw `Account required for ${cmd.name}`;
            if (!this.accounts.has(accountName)) {
                throw new Error(`Account ${accountName} not found.`);
            }
            const account = this.accounts.get(accountName);
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

    /**
     * Initialises the instance with the required historic data.
     * No other function can be run until init() is completed.
     */
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

    /**
     * Get the current time according to this instance.
     * @returns {number} The time in ms relative to some epoch.
     */
    getTimestamp() {
        return Date.now();
    }

    /**
     * Load a binance account that may then be used for commands requiring
     * authentication.
     * @param {string} name     The account name used to refer to the account
     *                          in future API calls.
     * @param {string} key      The Binance key for the account. Usually a
     *                          64 char string.
     * @param {string} secret   The Binance secret for the key. Usually a
     *                          64 char string.
     */
    async loadAccount(name, key, secret) {
        if (!this.ready) throw 'BinanceAccess not ready.';
        if (this.accounts.has(name)) throw 'Account already exists.';
        const account = new Account(this, name, key, secret);
        this.accounts.set(name, account);
        await account.syncBalances();
    }

    /**
     * Get a CoinPair object for the given two coins. Using this method
     * is preferable to directly creating a CoinPair as it is safer and
     * avoids duplication.
     * @param {string} base     The code representing the base coin.
     * @param {string} quote    The code representing the coin which
     *                          base is traded against.
     * @return {CoinPair}       An instance of a CoinPair object.
     * @throws {Error}          If the coin pair is not available on the
     *                          exchange.
     */
    getCoinPair(base, quote) {
        const symbol = `${base}${quote}`;
        if (!this.coinPairs.has(base)) this.coinPairs.set(base, new Map());
        const baseMap = this.coinPairs.get(base);
        if (!baseMap.has(quote)) {
            if (!this.coinPairInfo.has(symbol)) {
                throw new Error(`${symbol} not available on exchange`);
            }
            const coinPair = new CoinPair(
                base, quote, this.coinPairInfo.get(symbol)
            );
            baseMap.set(quote, coinPair);
            return coinPair;
        }
        return baseMap.get(quote);
    }
}
