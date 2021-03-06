import {BinanceCommands} from './binance.mjs';
import {ObservableMixin} from './observable';
import {TimeSeriesData} from './timeseries';
import {chartIntervalToMs} from './utils';
import {log} from './log';

import Big from 'big.js';
import WebSocket from 'ws';

/**
 * @access Public
 */
export const BinanceStreams = {
    // Binance docs indicate klines stream will update every second
    // but it appears to only update when a trade occurs.
    klines: {
        name: 'klines',
        streamName: '${symbol}@kline_${interval}',
        reqParams: ['interval', 'symbol']
    },
    // Streams at 1Hz pretty consistently
    ticker: {
        name: 'ticker',
        streamName: '${symbol}@ticker',
        reqParams: ['symbol']
    },
    depth: {
        name: 'depth',
        streamName: '${symbol}@depth',
        reqParams: ['symbol']
    }
};

/**
 * Maintains WebSocket connections to the Binance stream API.
 * @access Public
 */
export class StreamManager extends ObservableMixin(Object) {
    constructor() {
        super();
        this.base = 'wss://stream.binance.com:9443';
        this.streams = new Map();
        this.ws = null;
        this.messageListener = null;
    }

    /**
     * Open a stream.
     * config is an object from BinanceStreams.
     * messageListener is called each time data is received.
     */
    async openStream(config, params={}, messageListener) {
        // FIXME: WSS connections will be disconnected after 24 hours. Need
        //        to handle reconnection.
        let paramsOk = true;
        let missing = [];
        for (const param of config.reqParams) {
            if (!params.hasOwnProperty(param)) {
                paramsOk = false;
                missing.push(param);
            }
        }
        if (!paramsOk) {
            throw `${config.name} missing parameters: ${missing.join()}`;
        }

        // Binance api wants lower case coinpairs in URIs
        params.symbol = params.symbol.toLowerCase();

        // Replaces sections of streamName denoted with ${} with
        // the value of the config parameter named within the curly
        // braces.
        const name = config.streamName.replace(/\${([a-z]+)}/g,
            (match) => params[match.slice(2,-1)]
        );

        let streamDefn = null;
        if (this.streams.has(name)) {
            streamDefn = this.streams.get(name);
        } else {
            streamDefn = {listeners: []};
            this.streams.set(name, streamDefn);
            await this._createCombinedStream();
        }
        streamDefn.listeners.push(messageListener);
    }

    _closeCombinedStream() {
        if (this.messageListener) {
            this.ws.removeEventListener(this.messageListener);
            this.messageListener = null;
        }
        this.ws.close();
    }

    async _createCombinedStream() {
        const addr =
            `${this.base}/stream?streams=${[...this.streams.keys()].join('/')}`;

        log.debug(`Opening WebSocket ${addr}`);

        if (this.ws) {
            log.debug('  Closing existing connection.');
            this._closeCombinedStream();
        }

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(addr);
            ws.onopen = () => {
                log.debug('Stream created and ready.');
                this.messageListener =
                    ws.addEventListener('message', (message) => {
                        const full = JSON.parse(message.data);
                        const data = full.data;
                        const stream = this.streams.get(full.stream);
                        for (const listener of stream.listeners) {
                            listener(data);
                        }
                    });
                ws.on('close', (code, reason) => {
                    log.debug(`WebSocket closed. ${reason} (${code}).`);
                });
                this.ws = ws;
                resolve(ws);
            };
            ws.onerror = (err) => reject(err);
        });
    }
}

/**
 * @access private
 */
const klinesStreamToRestMap = new Map([['k.t', 0], ['k.o', 1], ['k.h', 2], ['k.l', 3], ['k.c', 4], ['k.v', 5], ['k.T', 6], ['k.q', 7], ['k.n', 8], ['k.V', 9], ['k.Q', 10]]);

/**
 * @access public
 */
class BinanceStream extends ObservableMixin(Object) {
    constructor(binance, type, symbol, attr) {
        super();
        this.binance = binance;
        this.type = type;
        this.symbol = symbol;
        this.attr = attr;
        this.stream = null;
        // The required attribute is specified using dot notation.
        // E.g. 'kline.close'.
        // This code to extract that attribute from the dictionary is a bit
        // tricky, but basically each element of the array
        // is a key, on each iteration of reduce we return
        // the object referenced by that key.
        this._getAttrData = (data) => attr.split('.').reduce((a,v) => a[v], data);
    }

    static async create(binance, type, symbol, attr) {
        const stream = new BinanceStream(binance, type, symbol, attr);
        stream.stream = await binance.streams.openStream(
            type,
            {symbol: symbol},
            (data) => {
                stream.notifyObservers(
                    'newData',
                    data.E,
                    Big(stream._getAttrData(data))
                );
            }
        );
        return stream;
    }
}

/**
 * @access public
 */
export class BinanceStreamKlines extends BinanceStream {
    constructor(binance, type, symbol, interval, attr) {
        super(binance, type, symbol, attr);
        this.interval = interval;
    }

    static async create(binance, symbol, interval, attr) {
        const stream = new BinanceStreamKlines(
            binance, BinanceStreams.klines, symbol, interval, attr
        );
        stream.stream = await binance.streams.openStream(
            stream.type,
            {symbol: symbol, interval: interval},
            (data) => {
                stream.notifyObservers(
                    'newData',
                    data.k.t,
                    Big(stream._getAttrData(data))
                );
            }
        );
        return stream;
    }

    async getHistoryFromTo(startTime, endTime) {
        const history = new TimeSeriesData(this.interval);
        const intervalMs = chartIntervalToMs(this.interval);
        // Ensure we get the kline that startTime falls within
        let getTime = startTime - (startTime % intervalMs);
        let nPeriods = Math.ceil((endTime - getTime) / intervalMs) + 1;
        const klines = [];
        // Can only get 500 values at a time.
        // Sometimes Binance is missing data, so we aren't always guaranteed
        // to get the exact number of results we expect, so don't assume a
        // request for 500 values returns 500 values.
        do {
            const data = await this.binance.apiCommand(
                BinanceCommands.klines,
                {
                    symbol:     this.symbol,
                    interval:   this.interval,
                    limit:      Math.min(500, nPeriods),
                    startTime:  getTime,
                    endTime:    endTime
                }
            );
            nPeriods -= data.length;
            // Get the time for the last kline returned and add one interval
            getTime = data[data.length-1][0] + intervalMs;
            klines.push(...data);
        } while(getTime < endTime);

        let lastTime = 0;
        for (const kline of klines) {
            if (kline[0] < lastTime) throw 'Klines not oldest to newest.';
            lastTime = kline[0];
            const attrIndex = klinesStreamToRestMap.get(this.attr);
            const data = Big(kline[attrIndex]);
            history.addData(lastTime, data);
        }

        return history;
    }

    async getHistory(length) {
        if (length > 500) throw new Error('getHistory: max length is 500');
        const history = new TimeSeriesData(this.interval);
        const klines = await this.binance.apiCommand(
            BinanceCommands.klines,
            {
                symbol:   this.symbol,
                interval: this.interval,
                limit:    length
            }
        );
        let lastTime = 0;
        for (const kline of klines) {
            if (kline[0] < lastTime) throw 'Klines not oldest to newest.';
            lastTime = kline[0];
            const attrIndex = klinesStreamToRestMap.get(this.attr);
            const data = Big(kline[attrIndex]);
            history.addData(lastTime, data);
        }

        return history;
    }
}

/**
 * @access public
 */
export class BinanceStreamTicker extends BinanceStream {
    // eslint-disable-next-line no-unused-vars
    getHistory(length) {
        const history = new TimeSeriesData(this.interval);
        // FIXME: TODO
        throw 'Not implemented';
        // eslint-disable-next-line no-unreachable
        return history;
    }
}

/**
 * @access private
 */
// eslint-disable-next-line no-unused-vars
const tickerStreamToRestMap = new Map();

/**
 * @access public
 */
export class BinanceStreamDepth extends BinanceStream {
    // eslint-disable-next-line no-unused-vars
    getHistory(length) {
        const history = new TimeSeriesData(this.interval);
        // FIXME: TODO
        throw 'Not implemented';
        // eslint-disable-next-line no-unreachable
        return history;
    }
}

/**
 * @access private
 */
// eslint-disable-next-line no-unused-vars
const depthStreamToRestMap = new Map();


