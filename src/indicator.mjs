import Big from 'big.js';
import {ObservableMixin} from './observable';
import {BinanceStreamKlines} from './binancestream.mjs';
import {TimeSeriesData} from './timeseries';
import {findCross, chartIntervalToMs} from './utils';
import {log} from './log';

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
        this.intervalMs = chartIntervalToMs(this.interval);

        this.source = null;
        this.data = new TimeSeriesData(interval);
    }

    async init(getHistory=0) {
        // Set up stream
        this.stream = await BinanceStreamKlines.create(
            this.binance,
            this.coinPair.symbol,
            this.interval,
            'k.c'   // close price
        );
        // Get the history we will need to compute EMA.
        // getHistory returns a TimeSeriesData which we will use from now on.
        this.source = await this.stream.getHistory(Math.max(getHistory+1, 1));

        log.debug(`EMAIndicator(${this.nPeriods}): Calculating history.`);
        const currentTime = this.binance.getTimestamp();
        for (
            let time = currentTime - getHistory * this.intervalMs;
            time < currentTime;
            time += this.intervalMs
        ) {
            this._calculate(time);
        }

        // Feed stream data in the TimeSeriesData store
        this.stream.addObserver('newData', this.source.addData, this.source);

        this.source.addObserver('extended', (data,time) => this._calculate(time));
        this.source.addObserver('replaceRecent', (data,time) => this._calculate(time));
    }

    static async createAndInit(binance, coinPair, nPeriods, interval, getHistory=0) {
        log.info(`Creating EMAIndicator for ${coinPair.symbol} (${nPeriods}) ${interval}`);
        const ema = new EMAIndicator(binance, coinPair, nPeriods, interval);
        await ema.init(getHistory);
        return ema;
    }

    _calculate(time = this.binance.getTimestamp()) {
        const current = this.source.getAt(time);
        if (current === undefined) throw new Error('Data missing.');
        // Either last EMA if available or last close price
        let last = this.data.getAt(time - this.intervalMs);
        if (last === undefined) last = current;

        // Weighting for most recent close price.
        const multiplier = Big(2).div(this.nPeriods + 1);

        const ema = current.times(multiplier).add(last.times(Big(1).sub(multiplier))).round(8);
        this.data.addData(time, ema);
        this.notifyObservers('update', time, ema, current);
        return ema;
    }
}

export class MultiEMAIndicator extends Indicator {
    constructor(binance, coinPair, interval, lengths) {
        super(binance, coinPair);
        this.lengths = lengths;
        this.lengths.sort((a,b) => b - a);
        this.interval = interval;
        this.emas = [];
        this.orderedEmas = null;
        this.data = new TimeSeriesData(interval);
        this.currentTime = 0;
        this.nUpdates = 0;
        this.currentPrice = null;
        this.slow = Math.max(...lengths);
        this.fast = Math.min(...lengths);
    }

    async init() {
        // When calculating historic values, start at 20 candles prior to the current.
        const history = 20;

        for (const length of this.lengths) {
            const ema = await EMAIndicator.createAndInit(
                this.binance,
                this.coinPair,
                length,
                this.interval,
                history
            );
            this.emas.push(ema);
        }

        // Calculate recent values so that EMAs stabilise.
        log.debug('MultiEMA: Calculating historic values');
        const currentTime = this.binance.getTimestamp();
        const intervalMs = chartIntervalToMs(this.interval);
        for (
            let time = currentTime - history * intervalMs;
            time < currentTime;
            time += this.interval
        ) {
            this._update(time);
        }

        for (const ema of this.emas) {
            // FIXME: Should this just be closed prices?
            // eslint-disable-next-line no-unused-vars
            ema.addObserver('update', (time, ema, price) => {
                if (time > this.currentTime) {
                    this.currentTime = time;
                    this.nUpdates = 0;
                }
                this.currentPrice = price;
                this.nUpdates ++;
                if (this.nUpdates == this.lengths.length) {
                    log.debug(`MultiEMA: Got all ${this.nUpdates} for ${this.currentTime}`);
                    this._update(time);
                }
            });
        }
    }

    _update(time) {
        const newOrder = [];

        for (const ema of this.emas) newOrder.push(ema);

        // Currently in visual order - when price increasing
        // index 0 will be fastest EMA, when decreasing index 0 will be slowest.
        // Highest price is index 0.
        newOrder.sort((a,b) => {
            const aPrice = a.data.getAt(time);
            const bPrice = b.data.getAt(time);

            if (aPrice === undefined || bPrice === undefined) {
                throw new Error('MultiEMA: Price data missing.');
            }

            const priceCmp = bPrice.cmp(aPrice);
            return priceCmp == 0 ? a.nPeriods - b.nPeriods : priceCmp;
        });

        if (this.orderedEmas === null) {
            this.orderedEmas = newOrder;
            return;
        }

        this.notifyObservers('update');

        for (let i = 0; i < newOrder.length; i++) {
            log.debug(
                '  ', newOrder[i].nPeriods, 'was(', this.orderedEmas[i].nPeriods, ')',
                ':', newOrder[i].data.getAt(time).toString()
            );
        }

        const cross = findCross(
            this.orderedEmas, newOrder, this.fast, this.slow, (a) => a.nPeriods
        );
        this.orderedEmas = newOrder;

        const crossDebug = [];
        for (const crossEma of cross.crossed) {
            crossDebug.push(crossEma.nPeriods);
        }
        log.debug(cross.fastSlowCross, crossDebug);

        if (cross.crossed.length == 0) return;

        if (cross.fastSlowCross) {
            // FIXME: Should we provide prices of emas?
            // Current price might be even more useful.
            this.notifyObservers('fastSlowCross', cross.crossed, time, this.currentPrice);
            return;
        }

        this.notifyObservers('cross', cross.crossed, time, this.currentPrice);
    }

    static async createAndInit(binance, coinPair, interval, lengths) {
        log.info(`Creating MultiEMAIndicator for ${coinPair.symbol} (${interval}) ${lengths}`);
        const ind = new MultiEMAIndicator(binance, coinPair, interval, lengths);
        await ind.init();
        return ind;
    }
}
