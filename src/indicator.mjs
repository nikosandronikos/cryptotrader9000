import Big from 'big.js';
import {ObservableMixin} from './observable';
import {BinanceStreamKlines} from './binancestream.mjs';
import {TimeSeriesData} from './timeseries';
import {findCross} from './utils';
import {chartIntervalToMs, timeStr} from './utils';
import {log} from './log';

Big.DP = 8;

export const IndicatorConfig = {
    emaHistoryLength: 180
};

export class Indicator extends ObservableMixin(Object) {
    /**
     * @param {BinanceAccess}   binance     A BinanceAccess object.
     * @param {string}          name        A name for the indicator.
     * @param {string}          interval    The interval for the indicator
     *                                      in string form (see {@link chartIntervalToMs}.
     */
    constructor(binance, name, interval) {
        super();
        this.binance = binance;
        this.name = name;
        this.interval = interval;
        this.intervalMs = chartIntervalToMs(interval);
    }

    // eslint-disable-next-line no-unused-vars
    prepHistory(startTime) {
        throw new Error('Implement in sub-class.');
    }
}

export class SingleIndicator extends Indicator {
    constructor(binance, name, interval) {
        super(binance, name, interval);
        this._data = new TimeSeriesData(interval);
    }

    /**
     * Get the indicator value for {@link time}.
     * @param {number}  time    A timestamp in ms.
     * @returns         The data value for the requested time.
     */
    getAt(time) {
        const data = this._data.getAt(time);
        if (data == undefined) {
            log.debug(
                `SingleIndicator ${this.name}. No data for ${timeStr(time)}`+
                ` ${timeStr(this._data.firstData)}`
            );
            throw new Error(`${this.name} has no data for ${timeStr(time)} (${time}`);
        }
        return this._data.getAt(time);
    }

    earliestData() {
        return this._data.hasData ? this._data.firstTime : null;
    }

    latestData() {
        return this._data.hasData ? this._data.lastTime : null;
    }
}

export class PriceIndicator extends SingleIndicator {
    /**
     * Create a PriceIndicator instance. init must be called before use.
     * Typically, the helper function {@link createAndInit} should be used
     * to create PriceIndicator instances.
     * @param {BinanceAccess}   binance     A BinanceAccess object.
     * @param {string}          name        A name for the indicator.
     * @param {CoinPair}        coinPair    A pair of coins - the price value
     *                                      of the indicator is the quote price
     *                                      for the pair.
     * @param {string}          interval    The interval for the indicator
     *                                      in string form (see {@link chartIntervalToMs}.
     */
    constructor(binance, name, coinPair, interval) {
        super(binance, name, interval);
        this.coinPair = coinPair;
        this._stream = null;
    }

    /**
     * Prepare a PriceIndicator for use.
     * This method establishes the required network connections to gather
     * price data.
     */
    async init() {
        // Set up stream
        this.stream = await BinanceStreamKlines.create(
            this.binance,
            this.coinPair.symbol,
            this.interval,
            'k.c'   // close price
        );

        // Feed stream data into the TimeSeriesData store
        this.stream.addObserver('newData', (time, data) => {
            this._data.addData(time, data);
            this.notifyObservers('update', time, data);
        });
    }

    /**
     * A helper method to create and initialise a PriceIndcator instance.
     * @param {BinanceAccess}   binance     A BinanceAccess object.
     * @param {string}          name        A name for the indicator.
     * @param {CoinPair}        coinPair    A pair of coins - the price value
     *                                      of the indicator is the quote price
     *                                      for the pair.
     * @param {string}          interval    The interval for the indicator
     *                                      in string form (see {@link chartIntervalToMs}.
     * @returns {PriceIndicator} An instance that is ready to use.
     */
    static async createAndInit(binance, name, coinPair, interval) {
        log.info(`Creating PriceIndicator for ${name} ${interval}`);
        const ind = new PriceIndicator(binance, name, coinPair, interval);
        await ind.init();
        return ind;
    }

    /**
     * Ensure this PriceIndicator instance has historical data from startTime
     * to the current time.
     * Call this method prior to retreiving data for any time value before
     * the creation time of this instance.
     * @param {number}  startTime   The earliest required data.
     */
    async prepHistory(startTime) {
        log.info(`PriceIndicator.prepHistory: ${this.coinPair.symbol} ${this.interval} from ${timeStr(startTime)}`);
        // Access pattern is to generally use all data following a sample
        // so load everything from startTime onwards.
        const endTime = this._data.hasData ? this._data.firstTime : this.binance.getTimestamp();
        if (endTime  < startTime) {
            return;
        }
        const history = await this.stream.getHistoryFromTo(startTime, endTime);
        this._data.merge(history);
    }
}

export class EMAIndicator extends SingleIndicator {
    /**
     * Create an EMAIndicator instance. init must be called before use.
     * Typically, the helper function {@link createAndInit} should be used
     * to any instances.
     * @param {BinanceAccess}   binance     A BinanceAccess object.
     * @param {string}          name        A name for the indicator.
     * @param {Indicator}       source      The data source that an EMA
     *                                      is calculated for.
     * @param {number}          nPeriods    The number of periods over which to
     *                                      calculate the EMA.
     */
    constructor(binance, name, source, nPeriods) {
        super(binance, name, source.interval);
        this.nPeriods = nPeriods;
        this.source = source;
    }

    /**
     * Prepare the indicator for use.
     * This method establishes the required network connections to gather
     * price data.
     */
    async init() {
        const currentTime = this.binance.getTimestamp();
        const historyStart = currentTime - IndicatorConfig.emaHistoryLength * this.intervalMs;
        await this.prepHistory(historyStart);

        // Calculate recent values so that EMAs stabilise.
        for (let time = historyStart; time < currentTime; time += this.intervalMs) {
            this._calculate(time);
        }

        // eslint-disable-next-line no-unused-vars
        this.source.addObserver('update', (time, data) => this._calculate(time));
    }

    /**
     * A helper method to create and initialise the indicator instance.
     * @param {string}          name        A name for the indicator.
     * @param {Indicator}       source      The data source that an EMA
     *                                      is calculated for.
     * @param {number}          nPeriods    The number of periods over which to
     *                                      calculate the EMA.
     * @returns {EMAIndicator}  An instance that is ready to use.
     */
    static async createAndInit(name, source, nPeriods) {
        log.info(`Creating EMAIndicator for ${name} (${nPeriods}) ${source.interval}`);
        const ema = new EMAIndicator(source.binance, name, source, nPeriods);
        await ema.init();
        return ema;
    }

    _calculate(time = this.binance.getTimestamp()) {
        const current = this.source.getAt(time);
        if (current === undefined) {
            throw new Error('Data missing.');
        }
        // Either last EMA if available or last close price
        let last = this._data.getAt(time - this.intervalMs);
        if (last === undefined) last = current;

        // Weighting for most recent close price.
        const multiplier = Big(2).div(this.nPeriods + 1);

        const ema = current.times(multiplier).add(last.times(Big(1).minus(multiplier))).round(8);
        this._data.addData(time, ema);
        this.notifyObservers('update', time, ema, current);
        return ema;
    }

    /**
     * Ensure this EMAIndicator instance has historical data from startTime
     * to the current time.
     * Call this method prior to retreiving data for any time value before
     * the creation time of this instance.
     * @param {number}  startTime   The earliest required data.
     */
    async prepHistory(startTime) {
        log.info(`EMAIndicator.prepHistory: ${this.name} ${this.interval} from ${timeStr(startTime)}.`);

        const earliestData = this.earliestData();
        if (earliestData !== null && !this.earlieststartTime >= this.earliestData()) {
            log.debug(`skipping. startTime = ${startTime}. Is >= ${this.earliestData()}`);
            return;
        }

        await this.source.prepHistory(startTime);
        const latestData = this.source.latestData() || this.binance.getTimestamp();
        for (let time = startTime; time < this.source.latestData(); time += this.intervalMs) {
            this._calculate(time);
        }
    }
}

/**
 * An interface for a composite indicator - one made up from multiple
 * single indicators.
 */
export class MultiIndicator extends Indicator {
    /**
     * @param {BinanceAccess}   binance     A BinanceAccess object.
     * @param {string}          name        A name for the indicator.
     * @param {string}          interval    The interval for the indicator
     *                                      in string form (see {@link chartIntervalToMs}.
     */
    constructor(binance, name, interval) {
        super(binance, name, interval);
    }

    // eslint-disable-next-line no-unused-vars
    getAll(time) {
        throw 'Implement in sub-class.';
    }

    earliestData() {
        throw new Error('Implement in sub-class.');
    }

    latestData() {
        throw new Error('Implement in sub-class.');
    }
}

export class MultiEMAIndicator extends MultiIndicator {
    /**
     * @param {BinanceAccess}   binance     A BinanceAccess object.
     * @param {string}          name        A name for the indicator.
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
        this._latestData = 0;
    }

    /**
     * Prepare the indicator for use.
     * This method establishes the required network connections to gather
     * price data.
     */
    async init() {
        const currentTime = this.binance.getTimestamp();
        const historyStart = currentTime - IndicatorConfig.emaHistoryLength * this.intervalMs;

        for (const length of this.lengths) {
            const ema = await EMAIndicator.createAndInit(
                `${this.name} EMA(${length})`,
                this._emaSource,
                length,
            );
            await ema.prepHistory(historyStart);
            this.emas.push(ema);
        }

        // Calculate recent values so that EMAs stabilise.
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
            const aPrice = a.getAt(time);
            const bPrice = b.getAt(time);

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

        this._latestData = time;
        this.notifyObservers('update', time);

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

    /**
     * A helper method to create and initialise a MultiEMAIndcator instance.
     * @param {string}          name        A name for the indicator.
     * @param {Indicator}       emaSource   The source of data for calculating
     *                                      each EMA in the set.
     * @param {Array}           lengths     An array containing the period for
     *                                      each EMA in the set.
     *                                      The number of values in this array
     *                                      indicates how many EMAIndicators
     *                                      are included in the set.
     * @returns {MultiEMAIndicator} An instance that is ready to use.
     */
    static async createAndInit(name, emaSource, lengths) {
        log.info(`Creating MultiEMAIndicator ${name} (${emaSource.interval}) ${lengths}`);
        const ind = new MultiEMAIndicator(emaSource.binance, name, emaSource, lengths);
        await ind.init();
        return ind;
    }

    /**
     * Get the values for all sub indicators for {@link time}.
     * @param {number}  time    A timestamp in ms.
     * @returns {Array}         An array containing the data values for the
     *                          requested time.
     */
    getAll(time) {
        const results = [];
        for (const ema of this.emas) {
            results.push(ema.getAt(time));
        }
        return results;
    }

    earliestData() {
        return this.emas[0].earliestData();
    }

    latestData() {
        return this._latestData;
    }
}

export class DifferenceIndicator extends SingleIndicator {
    constructor(binance, name, sourceA, sourceB) {
        if (sourceA.interval != sourceB.interval) {
            throw new Error('Intervals not equal');
        }
        super(binance, name, sourceA.interval);
        this._emas = [sourceA, sourceB];
        this._data = new TimeSeriesData(sourceA.interval);
        this._nUpdates = 0;
        this._updateTime = 0;
    }

    async init() {
        const currentTime = this.binance.getTimestamp();
        const historyStart = currentTime - IndicatorConfig.emaHistoryLength * this.intervalMs;

        for (const ema of this._emas) {
            await ema.prepHistory(historyStart);
        }

        for (let time = historyStart; time < currentTime; time += this.intervalMs) {
            this._calculate(time);
        }

        for (const ema of this._emas) {
            ema.addObserver('update', (time, ema, price) => {
                const oldtime = time;
                time -= (time % this.intervalMs);
                this._nUpdates ++;
                if (time == this._updateTime && this._nUpdates == this._emas.length) {
                    this._calculate(time);
                    this._nUpdates = 0;
                } else if (time > this._updateTime) {
                    this._updateTime = time;
                    this._nUpdates = 1;
                }
            });
        }
    }

    static async createAndInit(name, sourceA, sourceB) {
        log.info(`Creating DifferenceIndicator ${name} (${sourceA.interval})`);
        const ind = new DifferenceIndicator(sourceA.binance, name, sourceA, sourceB);
        await ind.init();
        return ind;
    }

    _calculate(time) {
        const valueA = this._emas[0].getAt(time);
        const valueB = this._emas[1].getAt(time);
        const difference = valueA.minus(valueB);
        this._data.addData(time, difference);
        this.notifyObservers('update', time, difference, valueA, valueB);
        return difference;
    }

    /**
     * Ensure this DifferenceIndicator instance has historical data from startTime
     * to the current time.
     * Call this method prior to retreiving data for any time value before
     * the creation time of this instance.
     * @param {number}  startTime   The earliest required data.
     */
    async prepHistory(startTime) {
        log.info(`DifferenceIndicator.prepHistory: ${this.name} ${this.interval} from ${timeStr(startTime)}.`);
        let endTime = Infinity;

        const earliestData = this.earliestData();
        if (earliestData !== null && startTime >= this.earliestData()) return;

        for (const ema of this._emas) {
            await ema.prepHistory(startTime);
            endTime = Math.min(endTime, ema.latestData());
        }

        for (let time = startTime; time < endTime; time += this.intervalMs) {
            this._calculate(time);
        }
    }
}

export class MACDIndicator extends MultiIndicator {
    constructor(binance, name, source) {
        super(binance, name, source.interval);
        this._source = source;
        this._emas = null;
        this._macd = null;
        this._signal = null;
        this._histogram = null;
        this._lastOrder = 0;
    }

    async init() {
        this._emas = [
            await EMAIndicator.createAndInit(
                'MACD EMA(12)',
                this._source,
                12
            ),
            await EMAIndicator.createAndInit(
                'MACD EMA(26)',
                this._source,
                26
            )
        ];

        // ema-------diff-----ema-----source
        //             |                |
        //             +--------ema-----+

        this._macd = await DifferenceIndicator.createAndInit(
            'MACD 12-26', this._emas[0], this._emas[1]
        );

        this._signal = await EMAIndicator.createAndInit(
            'MACD signal', this._macd, 9
        );

        this._histogram = await DifferenceIndicator.createAndInit(
            'MACD histogram', this._macd, this._signal
        );

        const currentTime = this.binance.getTimestamp();
        const historyStart = currentTime - IndicatorConfig.emaHistoryLength * this.intervalMs;
        await this.prepHistory(historyStart);

        // Histogram is updated by the MACD and the signal, so when we get
        // an update from it, we know we have complete data for the period.
        this._histogram.addObserver('update', (time, difference, valueA, valueB) => this._calculate(time));
    }

    earliestData() {
        return this._macd.earliestData();
    }

    latestData() {
        return this._macd.latestData();
    }

    async prepHistory(startTime) {
        log.info(`MACDIndicator.prepHistory: ${this.name} ${this.interval} from ${timeStr(startTime)}.`);
        let endTime = Infinity;

        if (startTime >= this.earliestData()) return;

        for (const ema of this._emas) {
            await ema.prepHistory(startTime);
            endTime = Math.min(ema.latestData(), endTime);
        }
        await this._macd.prepHistory(startTime);
        await this._signal.prepHistory(startTime);
        await this._histogram.prepHistory(startTime);

        endTime = Math.min(
            endTime,
            this._macd.latestData(),
            this._signal.latestData(),
            this._histogram.latestData()
        );

        for (let time = startTime; time < endTime; time += this.intervalMs) {
            this._calculate(time);
        }
    }

    static async createAndInit(name, source) {
        log.info(`Creating MACDIndicator ${name} (${source.interval})`);
        const ind = new MACDIndicator(source.binance, name, source);
        await ind.init();
        return ind;
    }

    _getDataValues(time) {
        const signal = this._signal.getAt(time);
        const macd = this._macd.getAt(time);
        const histogram = this._histogram.getAt(time);
        if (signal === undefined || macd === undefined || histogram == undefined) {
            log.debug(
                `MACDIndicator ${this.name}. Missing data for ${timeStr(time)}`+
                ` ${timeStr(this._data.firstData)}.`+
                ` signal=${signal}, macd=${macd}, histogram=${histogram}.`
            );
            throw new Error(`${this.name} missing data for ${timeStr(time)} (${time}`);
        }
        return [signal, macd, histogram];
    }

    _calculate(time) {
        // FIXME: Could maybe make a generalisation of MultiEMA and this indicator?
        //        Have a look at this once the indicator is finished and all
        //        requirements are known.
        const [signal, macd, histogram] = this._getDataValues(time);
        // if order < 0, then macd is above signal - bullish
        // if order > 0, then macd is below signal - bearish
        const order = signal.cmp(macd);
        log.info(`MACD: ${timeStr(time)}. `+
            `macd=${macd.toFixed(8)}. signal=${signal.toFixed(8)}. `+
            `histogram=${histogram.toFixed(8)}. `+
            `${order}`
        );
        if (order != 0 && order != this._lastOrder) {
            this.notifyObservers('cross', time, macd, signal, histogram);
            this._lastOrder = order;
        }
        this.notifyObservers('update', time, macd, signal, histogram);
    }

    getAll(time) {
        return this._getDataValues(time);
    }
}
