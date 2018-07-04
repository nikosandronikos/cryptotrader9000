import {IndicatorConfig, PriceIndicator} from './indicator.mjs';
import {BinanceStreamKlines} from './binancestream.mjs';
import {timeStr} from './utils';
import {log} from './log';

/**
 * Modify a BinanceAccess instance to support back testing.
 * The modified instance doesn't use the system clock for time.
 * Instead, the time is set by the user with the currentTime property - usually
 * this will be done in the BackTestPriceIndicator as it feeds data to other
 * indicators.
 */
function createBackTestBinance(baseBinance, startTime) {
    log.info('Amending BinanceAccess instance for back testing.');

    let backTestBinance = baseBinance;
    // Provide a mechanism for overriding the wall clock as other Indicators
    // rely on this and it must match the data fed by the BackTestPriceIndicator.
    backTestBinance.currentTime = startTime;
    backTestBinance.getTimestamp = function() {return this.currentTime;};

    return backTestBinance;
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
     * @param {BinanceAccess}   binance     A BinanceAccess object.
     * @param {number}          startTime   A timestamp representing when
     *                                      back testing should be performed from.
     * @param {number}          endTime     A timestamp representing when
     *                                      back testing should be performed to.
     * @param {string}          name        A name for the indicator.
     * @param {CoinPair}        coinPair    A pair of coins - the price value
     *                                      of the indicator is the quote price
     *                                      for the pair.
     * @param {string}          interval    The interval for the indicator
     *                                      in string form (see {@link chartIntervalToMs}.
     */
    constructor(binance, startTime, endTime, name, coinPair, interval) {
        super(binance, name, coinPair, interval);
        this.startTime = startTime;
        this.endTime = endTime;
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
            this.startTime - (IndicatorConfig.emaHistoryLength + 1) * this.intervalMs;
        this._data = await this.stream.getHistoryFromTo(historyStart, this.endTime);
        log.info(
            'BackTestPriceIndicator got data for: '+
            `${this.coinPair.symbol} ${this.interval} from ${timeStr(historyStart)}`
        );
    }

    /**
     * A helper method to create and initialise a BackTestPriceIndcator instance.
     * @param {BinanceAccess}   baseBinance A BinanceAccess instance.
     *                                      This instance will be modified for
     *                                      back testing and must not be used
     *                                      to create any other indicators.
     * @param {number}          startTime   A timestamp representing when
     *                                      back testing should be performed from.
     * @param {number}          endTime     A timestamp representing when
     *                                      back testing should be performed to.
     * @param {string}          name        A name for the indicator.
     * @param {CoinPair}        coinPair    A pair of coins - the price value
     *                                      of the indicator is the quote price
     *                                      for the pair.
     * @param {string}          interval    The interval for the indicator
     *                                      in string form (see {@link chartIntervalToMs}.
     * @returns {PriceIndicator} An instance that is ready to use.
     */
    static async createAndInit(baseBinance, startTime, endTime, name, coinPair, interval) {
        const binance = createBackTestBinance(baseBinance, startTime);
        log.info(`Creating BackTestPriceIndicator for ${name} ${interval}`);
        const ind = new BackTestPriceIndicator(
            binance, startTime, endTime, name, coinPair, interval
        );
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

    /**
     * Generate events to perform back testing - Indicators observing this
     * Indicator will receive these events.
     * Events will be generated as rapidly as possible.
     */
    startBackTest() {
        for (let time = this.startTime; time <= this.endTime; time += this.intervalMs) {
            this.binance.currentTime = time;
            const data = this.getAt(time);
            this.notifyObservers('update', time, data);
        }
    }
}


