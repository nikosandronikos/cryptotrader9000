import axios from 'axios';
import https from 'https';

import {config} from './config.mjs';

const BinanceCommands = {
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
    }
}

function intervalToMs(intervalStr, multiplier=1) {
    switch (intervalStr) {
        case 'M':
            throw `Months aren't supported because they are too variable. Sorry.`;
            return NaN;
        case 'w':
            multiplier *= 7;
        case 'd':
        case 'DAY': return 24 * 60 * 60 * 1000 * multiplier;
            multiplier *= 24;
        case 'h':
            multiplier *= 60;
        case 'm':
        case 'MINUTE':
            multiplier *= 60;
        case 'SECOND': return 1000 * multiplier;
        default: throw 'bad intervalStr';
    }
    return NaN;
}

// A chart interval string is a number followed by a time period.
// Where time period may be any of:
//   m -> minutes; h -> hours; d -> days; w -> weeks; M -> months
function chartIntervalToMs(intervalStr) {
    const result = intervalStr.match(/^([\d]+)([mhdwM])$/);
    if (result === null) {
        throw `${intervalStr} is not a valid intervalStr.`;
        return NaN;
    }
    const num = result[1], period = result[2];
    const ms = intervalToMs(period, num);
    console.log('intervalStr', num, period, ms);
    return ms;
}

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
            console.log(this._limits);
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

class CoinPair {
    constructor(base, quote, info) {
        console.log(info);
    }
}

class BinanceAccess {
    constructor() {
        this.ready = false;
        this.base = 'https://api.binance.com/';
        this._axiosInst = axios.create({
            baseURL: this.base,
            timeout: 1000
        });
        this.ready = false;
        this.limits = null;
    }

    async apiCommand(cmd) {
        if (cmd === undefined) return false;

        if (this.limits && !this.limits.testAndExecute(cmd.limitType)) {
            return false;
        }

        return this._axiosInst.get(cmd.url)
            .then(response => {
                console.log(
                    `${cmd.url} returned ${response.statusText} `+
                    `({$response.status}) => ${response.data}`
                );
                return response.data;
                //console.log(response.headers);
                //console.log('config:', response.config);
            })
            .catch(err => {
                console.log(`${cmd.url} returned error.`);
                if (err.response) {
                    console.log('response:', err.response.data);
                    console.log(err.response.status);
                    //console.log(err.response.headers);
                } else if (err.request) {
                    // The request was made but no response received.
                    console.log('No response');
                    console.log(err.request);
                } else {
                    console.log('Error', err.message);
                }
                //console.log('err.config:', err.config);
                throw err;
            });
    }

    // Initialises the instance with the required historic data.
    // No other function can be run until init() is completed.
    async init() {

        const info = await this.apiCommand(BinanceCommands.info);

        // Init the API request limits
        this.limits = new Limits();
        for (const limit of info.rateLimits) {
            this.limits.setLimit(
                limit.rateLimitType, parseInt(limit.limit), limit.interval
            );
        }

        console.log(this.limits);

        // Init coin pairs we're interested in.
        this.coinPairs = new Map();
        for (const pair of config.coinList) {
            console.log(`Initialising ${pair}`);
            const [base, quote] = pair.split(':');

            if (!this.coinPairs.has(base)) this.coinPairs.set(base, new Map());

            //FIXME: Data isn't arranged in a nicely accessible manner.
            //May want to pre-process it to speed up load times in future.

            let pairInfo = null;
            for (const symbol of info.symbols) {
                if (symbol.symbol == `${base}${quote}`) {
                    pairInfo = symbol;
                    break;
                }
            }

            if (pairInfo === null) throw 'Unknown coin pair';

            const coinPair = new CoinPair(base, quote, pairInfo);

            this.coinPairs.get(base).set(quote, coinPair);
        }

        this.ready = true;
        return true;
    }

    // Periodic update.
    // Probably should be called once per minute but can handle
    // being called with any interval.
    update() {
        if (!this.ready) return false;

        return true;
    }
}

(async function main() {
    const binance = new BinanceAccess();

    await binance.init();
    console.log('Binance access initialised.');
})();

/*
https.get(
    `${binanceBase}api/v1/time`,
    res => {
        res.setEncoding('utf8');
        let body = "";
        res.on('data', data=> {
            body += data;
        });
        res.on('end', () => {
            body = JSON.parse(body);
            console.log(body);
        });
    });
);
*/
