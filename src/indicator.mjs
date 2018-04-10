import Big from 'big.js';
import {BinanceCommands} from './binance.mjs';
import {BinanceStreams, BinanceStreamKlines} from './binancestream.mjs';

Big.DP = 8;

// Will update based on ticker.
// But will also need historical data.
export class Indicator {
    constructor(binance, coinPair) {
        this.binance = binance;
        this.coinPair = coinPair;
    }

    getCurrent() {
        throw 'Implement in sub-class.';
    }
}

export class EMAIndicator extends Indicator {
    constructor(binance, coinPair, nPeriods, interval) {
        super(binance, coinPair);
        this.nPeriods = nPeriods;
        this.interval = interval;

        this.data = null;
    }

    async init() {
        // Set up stream
        this.stream = await BinanceStreamKlines.create(
            this.binance,
            this.coinPair.symbol,
            this.interval,
            'k.c'   // close price
        );
        // Get the history we will need to compute EMA.
        // getHistory returns a TimeSeriesData which we will use from now on.
        this.data = await this.stream.getHistory(this.nPeriods + 1);
        // Feed stream data in the TimeSeriesData store
        this.stream.addObserver('newData', this.data.addData, this.data);

        // FIXME: Not sure what events would be best coming from the
        //        TimeSeries class yet.
        const showCalc = () => console.log(
                `${this.coinPair.symbol} ${this.interval}`
                +` EMA${this.nPeriods} = ${this._calculate()}`
            );

        this.data.addObserver('extended', showCalc);
        this.data.addObserver('replaceRecent', showCalc);

        showCalc();
    }

    static async createAndInit(binance, coinPair, nPeriods, interval) {
        console.log(`Creating EMAIndicator for ${coinPair.symbol} (${nPeriods}) ${interval}`);
        const ema = new EMAIndicator(binance, coinPair, nPeriods, interval);
        await ema.init();
        return ema;
    }

    _calculate() {
        const closePrices = this.data.getRecent(this.nPeriods + 1);
        // Simple moving average for the previous period.
        const sma = closePrices.slice(0, this.nPeriods).reduce(
                        (a, v) => a = a.add(v)
                    ).div(this.nPeriods);
        // Weighting for most recent close price.
        const multiplier = Big(2).div(this.nPeriods).add(1);
        // Exponential moving average.
        const lastClose = closePrices.pop();
        const ema = lastClose.sub(sma).times(multiplier).add(sma).round(8);
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
        const klines = await this.binance.apiCommand(
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


