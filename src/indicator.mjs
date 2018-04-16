import Big from 'big.js';
import {ObservableMixin} from './observable';
import {BinanceCommands} from './binance.mjs';
import {BinanceStreams, BinanceStreamKlines} from './binancestream.mjs';
import {TimeSeriesData} from './timeseries';

Big.DP = 8;

// Will update based on ticker.
// But will also need historical data.
export class Indicator extends ObservableMixin(Object) {
    constructor(binance, coinPair) {
        super();
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

        this.source = null;
        this.data = new TimeSeriesData(interval);
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
        // FIXME: Should get more history and pre-compute EMA for a while
        // because it takes a while to converge to the correct value.
        this.source = await this.stream.getHistory(1);
        // Feed stream data in the TimeSeriesData store
        this.stream.addObserver('newData', this.source.addData, this.source);

        // FIXME: Not sure what events would be best coming from the
        //        TimeSeries class yet.
        const showCalc = () => console.log(
                `${this.coinPair.symbol} ${this.interval}`
                +` EMA${this.nPeriods} = ${this._calculate()}`
            );

        this.source.addObserver('extended', showCalc);
        this.source.addObserver('replaceRecent', showCalc);

        showCalc();
    }

    static async createAndInit(binance, coinPair, nPeriods, interval) {
        console.log(`Creating EMAIndicator for ${coinPair.symbol} (${nPeriods}) ${interval}`);
        const ema = new EMAIndicator(binance, coinPair, nPeriods, interval);
        await ema.init();
        return ema;
    }

    _calculate() {
        const time = this.binance.getTimestamp();
        const current = this.source.getRecent(1, time)[0];
        // Either last EMA if available or last close price
        let last = NaN;
        last = this.data.getRecent(2, time)[0];
        if (last === undefined) last = current;

        // Weighting for most recent close price.
        const multiplier = Big(2).div(this.nPeriods + 1);

        const ema = current.times(multiplier).add(last.times(Big(1).sub(multiplier))).round(8);
        this.data.addData(time, ema);
        this.notifyObservers('update', time, ema);
        return ema;
    }
}

