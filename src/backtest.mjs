import {ObservableMixin} from './observable';
import {BinanceAccess} from './binance';
import {IndicatorConfig, PriceIndicator} from './indicator.mjs';
import {BinanceStreamKlines} from './binancestream.mjs';
import {timeStr} from './utils';
import {log} from './log';

/**
 * Extends BinanceAccess to provide support for back testing, including
 * externally controlling the wall clock.
 */
export class BackTestBinance extends ObservableMixin(BinanceAccess) {

    /**
     * Create an instance for back testing.
     * @param {number}  startTime   The time to run back testing from
     * @param {number}  endTime     The time to run back testing to
     * @param {number} [timeout]   See {@link BinanceAccess}
     */
    constructor(startTime, endTime, timeout=undefined) {
        super(timeout);
        this.startTime = startTime;
        this.endTime = endTime;
        // When initialising Binance API, the correct(ish) time must be set
        // or the Binance API will complain.
        this.currentTime = startTime;
    }

    /**
     * See {@link BinanceAccess}
     */
    async loadAccount(name, key, secret) {
        // To load the account, the time must match the server time.
        this.currentTime = Date.now();
        await super.loadAccount(name, key, secret);
        this.currentTime = this.startTime;
    }

    /**
     * Get the time considered current by this instance. During back testing,
     * this time will be updated in a monotonic fashion. If back testing is
     * not running, it will be fixed at the startTime provided to the
     * constructor of this class.
     */
    getTimestamp() {
        return this.currentTime;
    }

    /**
     * Generate events to perform back testing - Indicators observing this
     * Indicator will receive these events.
     * Events will be generated as rapidly as possible.
     */
    startBackTest() {
        // Fire off one tic event every second.
        for (let time = this.startTime; time <= this.endTime; time += 1000) {
            this.currentTime = time;
            this.notifyObservers('tic', time);
        }
    }
}

/**
 * A PriceIndicator for back testing.
 * This PriceIndicator will get history data.
 * It will not produce events as data is received, instead events are produced
 * when {@link startBackTest} is executed.
 */
export class BackTestPriceIndicator extends PriceIndicator {
    /**
     * Create a BackTestPriceIndicator instance. init must be called before use.
     * Typically, the helper function {@link createAndInit} should be used
     * to create instances.
     * @param {BackTestBinance} binance     A BackTestBinance instance.
     * @param {string}          name        A name for the indicator.
     * @param {CoinPair}        coinPair    A pair of coins - the price value
     *                                      of the indicator is the quote price
     *                                      for the pair.
     * @param {string}          interval    The interval for the indicator
     *                                      in string form (see {@link chartIntervalToMs}.
     */
    constructor(binance, name, coinPair, interval) {
        super(binance, name, coinPair, interval);
    }

    /**
     * Prepare the indicator for use.
     * This method establishes the required network connections to gather
     * price data, it also modifies the BinanceAccess instance given when
     * creating the indicator so that it supports back testing.
     */
    async init() {
        // Set up stream
        this.stream = await BinanceStreamKlines.create(
            this.binance,
            this.coinPair.symbol,
            this.interval,
            'k.c'   // close price
        );

        // Don't bother actually responding to new data at all, we only need
        // the historic data retrieved here.
        const historyStart =
            this.binance.startTime - (IndicatorConfig.emaHistoryLength + 1) * this.intervalMs;
        this._data = await this.stream.getHistoryFromTo(historyStart, this.binance.endTime);
        log.info(
            'BackTestPriceIndicator got data for: '+
            `${this.coinPair.symbol} ${this.interval} from ${timeStr(historyStart)}`
        );

        this.binance.addObserver('tic', (time) => {
            const data = this.getAt(time);
            this.notifyObservers('update', time, data);
        });
    }

    /**
     * A helper method to create and initialise a BackTestPriceIndcator instance.
     * @param {BackTestBinance} binance     A BackTestBinance instance.
     * @param {string}          name        A name for the indicator.
     * @param {CoinPair}        coinPair    A pair of coins - the price value
     *                                      of the indicator is the quote price
     *                                      for the pair.
     * @param {string}          interval    The interval for the indicator
     *                                      in string form (see {@link chartIntervalToMs}.
     * @returns {PriceIndicator} An instance that is ready to use.
     */
    static async createAndInit(binance, name, coinPair, interval) {
        const ind = new BackTestPriceIndicator(binance, name, coinPair, interval);
        await ind.init();
        return ind;
    }

    /**
     * A no-op. This instance has all required data populated when initialised.
     * @param {number}  startTime   The earliest required data (ignored).
     */
    async prepHistory(startTime) {
        // Do nothing, we should already have all required history.
        log.info(`BackTestPriceIndicator.prepHistory: ${this.coinPair.symbol} ${this.interval} from ${timeStr(startTime)} - skipping`);
    }
}


