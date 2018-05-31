import Big from 'big.js';
import {ObservableMixin} from './observable';
import {BinanceStreamKlines} from './binancestream.mjs';
import {TimeSeriesData} from './timeseries';
import {findCross, chartIntervalToMs, timeStr} from './utils';
import {log} from './log';

Big.DP = 8;

const emaHistoryLength = 20;

// Will update based on ticker.
// But will also need historical data.
export class Indicator extends ObservableMixin(Object) {
    constructor(binance, name, interval) {
        super();
        this.binance = binance;
        this.name = name;
        this.data = null;
        this.interval = interval;
        this.intervalMs = chartIntervalToMs(interval);
    }

    // eslint-disable-next-line no-unused-vars
    prepHistory(startTime) {
        throw new Error('Implement in sub-class.');
    }

    // eslint-disable-next-line no-unused-vars
    getAt(time) {
        throw 'Implement in sub-class.';
    }
}

export class PriceIndicator extends Indicator {
    constructor(binance, name, coinPair, interval) {
        super(binance, name, interval);
        this.coinPair = coinPair;
        this.data = null;
        this._stream = null;
    }

    async init() {
        // Set up stream
        this.stream = await BinanceStreamKlines.create(
            this.binance,
            this.coinPair.symbol,
            this.interval,
            'k.c'   // close price
        );

        this.data = new TimeSeriesData(this.interval);

        // Feed stream data into the TimeSeriesData store
        this.stream.addObserver('newData', (time, data) => {
            this.data.addData(time, data);
            this.notifyObservers('update', time, data);
        });
    }

    static async createAndInit(binance, name, coinPair, interval) {
        log.info(`Creating PriceIndicator for ${name} ${interval}`);
        const ind = new PriceIndicator(binance, name, coinPair, interval);
        await ind.init();
        return ind;
    }

    async prepHistory(startTime) {
        // Access pattern is to generally use all data following a sample
        // so load everything from startTime onwards.
        const endTime = this.data.hasData ? this.data.firstTime : this.binance.getTimestamp();
        if (endTime  < startTime) return;
        const history = await this.stream.getHistoryFromTo(startTime, endTime);
        log.info(`PriceIndicator.prepHistory: ${this.coinPair.symbol} ${this.interval} from ${timeStr(startTime)}`);
        this.data.merge(history);
    }

    getAt(time) {
        const data = this.data.getAt(time);
        if (data == undefined) {
            log.debug(
                `PriceIndicator ${this.name}. No data for ${timeStr(time)}`+
                ` ${timeStr(this.data.firstData)}`
            );
        }
        return this.data.getAt(time);
    }
}

export class EMAIndicator extends Indicator {
    /**
     * @param {BinanceAccess}   binance     A BinanceAccess object.
     * @param {Indicator}       source      The data source that an EMA
     *                                      is calculated for.
     * @param {number}          nPeriods    The number of periods over which to
     *                                      calculate the EMA.
     */
    constructor(binance, name, source, nPeriods) {
        super(binance, name, source.interval);
        this.nPeriods = nPeriods;
        this.source = source;
        this.data = new TimeSeriesData(this.interval, (time) => {
            const whichEma = `EMAIndicator(${this.nPeriods})`;
            log.debug(`${whichEma}: Calculating history for ${timeStr(time)}.`);
            this._calculate(time);
        });
    }

    async init() {
        const currentTime = this.binance.getTimestamp();
        const historyStart = currentTime - emaHistoryLength * this.intervalMs;
        await this.prepHistory(historyStart);

        // Calculate recent values so that EMAs stabilise.
        log.debug(`EMAIndicator ${this.name}: Calculating historic values`);
        for (let time = historyStart; time < currentTime; time += this.intervalMs) {
            this._calculate(time);
        }

        // eslint-disable-next-line no-unused-vars
        this.source.addObserver('update', (time, data) => this._calculate(time));
    }

    static async createAndInit(binance, name, source, nPeriods) {
        log.info(`Creating EMAIndicator for ${name} (${nPeriods}) ${source.interval}`);
        const ema = new EMAIndicator(binance, name, source, nPeriods);
        await ema.init();
        return ema;
    }

    _calculate(time = this.binance.getTimestamp()) {
        const current = this.source.getAt(time);
        if (current === undefined) {
            debugger;
            log.debug(current);
            throw new Error('Data missing.');
        }
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

    async prepHistory(startTime) {
        await this.source.prepHistory(startTime);
        log.info(`EMAIndicator.prepHistory: ${this.name} ${this.interval} from ${timeStr(startTime)}.`);
        for (let time = startTime; time < this.data.firstTime; time += this.intervalMs) {
            this._calculate(time);
        }
    }

    getAt(time) {
        return this.data.getAt(time);
    }
}

export class MultiIndicator extends Indicator {
    constructor(binance, name, interval) {
        super(binance, name, interval);
    }

    // eslint-disable-next-line no-unused-vars
    getAll(time) {
        throw 'Implement in sub-class.';
    }
}

export class MultiEMAIndicator extends Indicator {
    /**
     * @param {BinanceAccess}   binance     A BinanceAccess object.
     * @param {Indicator}       emaSource   The source of data for calculating
     *                                      each EMA in the set.
     * @param {Array}           lengths     An array containing the period for
     *                                      each EMA in the set.
     *                                      The number of values in this array
     *                                      indicates how many EMAIndicators
     *                                      are included in the set.
     */
    constructor(binance, name, emaSource, lengths) {
        super(binance, name, emaSource.interval);
        this._emaSource = emaSource;
        this.lengths = lengths;
        this.lengths.sort((a,b) => b - a);
        this.emas = [];
        this.orderedEmas = null;
        this.currentTime = 0;
        this.nUpdates = 0;
        this.currentPrice = null;
        this.slow = Math.max(...lengths);
        this.fast = Math.min(...lengths);
    }

    async init() {
        const currentTime = this.binance.getTimestamp();
        const historyStart = currentTime - emaHistoryLength * this.intervalMs;

        for (const length of this.lengths) {
            const ema = await EMAIndicator.createAndInit(
                this.binance,
                `${this.name} EMA(${length})`,
                this._emaSource,
                length,
            );
            await ema.prepHistory(historyStart);
            this.emas.push(ema);
        }

        // Calculate recent values so that EMAs stabilise.
        log.debug('MultiEMA: Calculating historic values');
        for (
            let time = historyStart;
            time < currentTime;
            time += this.intervalMs
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

        const cross = findCross(
            this.orderedEmas, newOrder, this.fast, this.slow, (a) => a.nPeriods
        );
        this.orderedEmas = newOrder;

        if (cross.crossed.length == 0) return;

        if (cross.fastSlowCross) {
            // FIXME: Should we provide prices of emas?
            // Current price might be even more useful.
            this.notifyObservers('fastSlowCross', cross.crossed, time, this.currentPrice);
            return;
        }

        this.notifyObservers('cross', cross.crossed, time, this.currentPrice);
    }

    static async createAndInit(binance, name, emaSource, lengths) {
        log.info(`Creating MultiEMAIndicator ${name} (${emaSource.interval}) ${lengths}`);
        const ind = new MultiEMAIndicator(binance, name, emaSource, lengths);
        await ind.init();
        return ind;
    }

    // eslint-disable-next-line no-unused-vars
    getAt(time) {
        // FIXME: What would be a useful single value to return here?
    }

    getAll(time) {
        const results = [];
        for (const ema of this.emas) {
            results.push(ema.getAt(time));
        }
        return results;
    }
}

