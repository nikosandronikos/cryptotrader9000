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
export class StreamManager {
    constructor() {
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

export class PriceData {
    // TODO: Will likely delete this - it was the first iteration

    // Interacts with Binance's stream API to grab price data in real-time.
    // User may register event handlers that are called as data is
    // received.
    // Initially this class will update itself via a connection to
    // the Binance stream API, but in future the open streams may
    // be consolidated and managed globally.

    constructor(coinList, priceRecencyMs) {
        this.recencyMs = priceRecencyMs;
        this.coins = new Map();
        coinList.forEach(coin => this.trackCoin(coin));
    }

    // Returns the current price for 'coinName', or null if a
    // recent price is not available (based on 'priceRecencyMs').
    currentPrice(coinName) {
        if (!this.coins.has(coinName)) throw 'Coin not tracked';
        const coin = this.coins.get(coinName);
        if (Date.now() - coin.time > this.recencyMs) return null;
        return coin.price;
    }

    trackCoin(coinName) {
        if (this.coins.has(coinName)) return;
        this.coins.set(coinName, {price: 0.0, time: 0});

        const ws =
            new WebSocket('wss://stream.binance.com:9443/ws/nulsbtc@ticker');

        ws.on('open', () => {
            console.log('Stream for nulsbtc ticker open.', ws.readyState);
        });

        let lastMessageTime = 0;

        ws.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.E <= lastMessageTime) return;
            const coin = this.coins.get(coinName);
            coin.price = parseFloat(data.c);
            lastMessageTime = coin.time = data.E;
            console.log(lastMessageTime, coin);
        });
    }
}
