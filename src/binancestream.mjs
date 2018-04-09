import {BinanceAccess, BinanceCommands} from './binance.mjs';
import {ObservableMixin} from './observable';
import {TimeSeriesData} from './timeseries';
import Big from 'big.js';
import WebSocket from 'ws';

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
}

// Maintains WebSocket connections to the Binance stream API.
// FIXME: WSS connections will be disconnected after 24 hours. Need
//        to handle reconnection.
export class StreamManager extends ObservableMixin(Object) {
    constructor() {
        super();
        this.base = 'wss://stream.binance.com:9443';
        this.streams = new Map();
        this.ws = null;
        this.messageListener = null;
    }

    // Open a stream.
    // config is an object from BinanceStreams.
    // messageListener is called each time data is received.
    async openStream(config, params={}, messageListener) {
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
            (match, offset,str) => params[match.slice(2,-1)]
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

        console.log(`Opening WebSocket ${addr}`);

        if (this.ws) {
            console.log('  Closing existing connection.');
            this._closeCombinedStream();
        }

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(addr);
            ws.onopen = () => {
                console.log('Stream created and ready.');
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
                    console.log(`WebSocket closed. ${reason} (${code}).`);
                });
                this.ws = ws;
                resolve(ws);
            };
            ws.onerror = (err) => reject(err);
        });
    }
}

const klinesStreamToRestMap = new Map([['k.t', 0], ['k.o', 1], ['k.h', 2], ['k.l', 3], ['k.c', 4], ['k.v', 5], ['k.T', 6], ['k.q', 7], ['k.n', 8], ['k.V', 9], ['k.Q', 10]]);

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

    async getHistory(length) {
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

class BinanceStreamTicker extends BinanceStream {
    getHistory(length) {
        const history = new TimeSeriesData(this.interval);
        // FIXME: TODO
        throw 'Not implemented';
        return history;
    }
}

const tickerStreamToRestMap = new Map();

class BinanceStreamDepth extends BinanceStream {
    getHistory(length) {
        const history = new TimeSeriesData(this.interval);
        // FIXME: TODO
        throw 'Not implemented';
        return history;
    }
}

const depthStreamToRestMap = new Map();


