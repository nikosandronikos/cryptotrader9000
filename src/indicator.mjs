import Big from 'big.js';
import {BinanceCommands} from './binance.mjs';
import {BinanceStreams} from './datastream.mjs';

Big.DP = 8;

// Will update based on ticker.
// But will also need historical data.
export class Indicator {
    constructor(binance, coinPair) {
        this._binance = binance;
        this.coinPair = coinPair;
    }

    calculate() {
        throw 'Implement in sub-class.';
    }
}

export class EMAIndicator extends Indicator {
    constructor(binance, coinPair, nPeriods, interval) {
        super(binance, coinPair);
        this.nPeriods = nPeriods;
        this.interval = interval;
        this.closePrices = [];
        this.mostRecentPrice = 0;
    }

    async init() {
        // Get historical data
        const klines = await this._binance.apiCommand(
            BinanceCommands.klines,
            {
                symbol:   this.coinPair.symbol,
                interval: this.interval,
                limit:    this.nPeriods + 1
            }
        );
        let lastTime = 0;
        for (const kline of klines) {
            if (kline[0] < lastTime) throw 'Klines not oldest to newest.';
            lastTime = kline[0];
            const price = Big(kline[4]);
            this.closePrices.push(price);
            const time = new Date(lastTime).toLocaleTimeString();
            console.log(`${time} closed at ${price}`);
        }
        this.mostRecentPrice = lastTime;

        console.log(
            `${this.coinPair.symbol} ${this.interval}`
            +` EMA${this.nPeriods} = ${this.calculate()}`
        );

        // TODO: Think there would be value in having a Sample class to
        // encapsulate data streams.
        // properties:
        // - period (spacing between samples)
        // - number of samples
        // - time of first / most recent sample
        // operations:
        // - get n most recent samples
        // - get samples in time range
        // - get sample for time
        // Sampler would know how to get data, so it can initialise itself
        // and then fetch data that is requested but it doesn't hold.

        // Setup realtime updater
        await this._binance.streams.openStream(
            BinanceStreams.klines,
            {symbol: this.coinPair.symbol, interval: this.interval},
            (data) => {
                const price = Big(data.k.c);
                const time = new Date(data.k.t).toLocaleTimeString();
                if (data.k.t == this.mostRecentPrice) {
                    console.log(`${time} ${price} overwrote`);
                    this.closePrices[this.closePrices.length-1] = price;
                } else if (data.k.t > this.mostRecentPrice) {
                    console.log(`${time} ${price} new`);
                    this.closePrices.push(price);
                    this.mostRecentPrice = data.k.t;
                }
                console.log(
                    `${this.coinPair.symbol} ${this.interval}`
                    +` EMA${this.nPeriods} = ${this.calculate()}`
                );
            }
        );
    }

    static async createAndInit(binance, coinPair, nPeriods, interval) {
        console.log(`Creating EMAIndicator for ${coinPair.symbol} (${nPeriods}) ${interval}`);
        const ema = new EMAIndicator(binance, coinPair, nPeriods, interval);
        await ema.init();
        return ema;
    }

    calculate() {
        // Simple moving average for the previous period.
        const l = this.closePrices.length;
        const sliced = this.closePrices.slice(l-this.nPeriods-1,l-1);
        const sma = sliced.reduce(
                        (a, v) => a = a.add(v)
                    ).div(this.nPeriods);
        // Weighting for most recent close price.
        const multiplier = Big(2).div(this.nPeriods).add(1);
        // Exponential moving average.
        const lastClose = this.closePrices[this.closePrices.length - 1];
        const ema = lastClose.sub(sma).mul(multiplier).add(sma).round(8);
        //console.log(`sma = ${sma}, lastClose=${lastClose}, ema=${ema}`);
        return ema;
    }
}

export class MACDIndicator extends Indicator {
    constructor(binance, coinPair, fast, slow, interval) {
        super(binance, coinPair);
        this.fast = fast;
        this.slow = slow;
        if (this.fast > this.slow) throw 'MACD fast must be greater than slow.';
        this.interval = interval;
        this.closePrices = [];
    }

    async init() {
        // Get historical data
        const klines = await this._binance.apiCommand(
            BinanceCommands.klines,
            {
                symbol:   this.coinPair.symbol,
                interval: this.interval,
                limit:    this.slow
            }
        );
        let lastTime = 0;
        for (const kline of klines) {
            if (kline[0] < lastTime) throw 'Klines not oldest to newest.';
            lastTime = kline[0];
            const price = parseFloat(kline[4]);
            this.closePrices.push({time: lastTime, price: price});
            const time = new Date(lastTime).toLocaleTimeString();
            console.log(`${time} ${price}`);
        }

        // Setup realtime updater
    }

    static async createAndInit(binance, coinPair, fast, slow, interval) {
        console.log(`Creating MACDIndicator for ${coinPair.symbol} (${fast},${slow}) ${interval}`);
        const macd = new MACDIndicator(binance, coinPair, fast, slow, interval);
        await macd.init();
    }

    calculate() {
    }
}


