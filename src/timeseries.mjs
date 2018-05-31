import {chartIntervalToMs} from './utils';
import {ObservableMixin} from './observable';
import {timeStr} from './utils';
import {log} from './log';

// Assumes data will be added for all intervals, so we're not optimising for
// space wrt missing data.

/**
 * Data store for time series data - i.e. data that is associated with
 * fixed intervals of time and has no gaps.
 * The TimeSeriesData class is designed to provide data immediately if it
 * is available, so it is suitable for time critical requests.
 * Because of this, any data required must be pushed into the TimeSeriesData
 * instance prior to use. There is no mechanism for pulling missing data when
 * needed, as the pull may take an unknown amount of time (due to network
 * requests, etc).
 * @package
 */
export class TimeSeriesData extends ObservableMixin(Object) {
    /**
     * @param {string} interval     A string representing a time interval.
     *                              For accepted values, see {@link chartIntervalToMs}.
     */
    constructor(interval) {
        super();
        /** Time interval in string form. */
        this.interval = interval;
        /** Time interval in milliseconds. */
        this.intervalMs = chartIntervalToMs(interval);
        this.firstTime = Infinity;
        this._lastTime = 0;
        this._data = [];
        this.hasData = false;
    }

    /**
     * If a time is given that is after the last data sample, then
     * fill the data up to time.
     * @param {number} time     Time in milliseconds.
     */
    _checkAndFillTrailingData(time) {
        if (time % this.intervalMs !== 0) time -= (time % this.intervalMs);
        const gap = time - this._lastTime;
        if (gap < this.intervalMs) return;
        const nMissing = Math.ceil(gap / this.intervalMs);
        //console.log(`WARNING: _checkAndFillTrailingData adding ${nMissing}`);
        this._data = this._data.concat(
            new Array(nMissing).fill(this._data[this._data.length - 1])
        );
        this._lastTime = time;
    }

    /**
     * If a time is given that is prior to the first data sample, then
     * fill the data from time to the first existing sample.
     * @param {number} time     Time in milliseconds.
     */
    _checkAndFillLeadingData(time, data) {
        if (time % this.intervalMs !== 0) time -= (time % this.intervalMs);
        const gap = this.firstTime - time;
        if (gap < this.intervalMs) return;
        const nMissing = Math.ceil(gap / this.intervalMs);
        //console.log(`WARNING: _checkAndFillTrailingData adding ${nMissing}`);
        this._data = new Array(nMissing).fill(data).concat(this._data);
        this.firstTime = time;
    }

    /**
     * Add data to the series.
     * If data is provided for a time that has existing data, then that data
     * is overwritten.
     * If data is provided more than one interval before or after existing data
     * then the empty samples are padded with the preceeding data value.
     * @param {number} time     The time in milliseconds.
     * @param          data     The data value to store at this time.
     */
    addData(time, data) {
        time -= (time % this.intervalMs);

        if (this._data.length === 0) {
            this._data.push(data);
            this._lastTime = this.firstTime = time;
        } else if (time > this._lastTime) {
            // Comes after last sample
            this._checkAndFillTrailingData(time - this.intervalMs);
            this._data.push(data);
            this._lastTime = time;
            this.notifyObservers('extended', data, time);
        } else if (time < this.firstTime) {
            // Comes before first sample
            this._checkAndFillLeadingData(time + this.intervalMs, data);
            this._data.unshift(data);
            this.firstTime = time;
        } else {
            // If it falls exactly on the interval, overwrites an existing
            // sample, otherwise an error.
            const replaceIndex = (time - this.firstTime) / this.intervalMs;
            this._data[replaceIndex] = data;
            this.notifyObservers('replaceRecent', data, time);
        }
    }

    /**
     * Get the most recent samples. By default, this includes the most recent
     * interval which will likely not be closed.
     * If the current time is past the last data sample, then the value of the
     * last data sample will be used to fill the data samples up to the current time.
     * @param {number}      n           The number of samples to return.
     *                                  If n > the number of samples available, all
     *                                  available samples will be returned.
     * @param {currentTime} currentTime The current time in milliseconds. This
     *                                  is required to determine if the latest
     *                                  sample is closed and to pad data
     *                                  if the current time is after the last
     *                                  data sample.
     * @param {boolean}     [includeOpen=true]
     *                                  Whether to include open or only closed
     *                                  samples. A sample is closed once the full
     *                                  time for the interval has elapsed.
     *
     * @return {Array<number|string|boolean|object>}
     *                                  An array containing the requested samples,
     *                                  or an empty array if there is no data
     *                                  stored.
     * @throws {Error}  If n < 1.
     */
    getRecent(n, currentTime, includeOpen=true) {
        if (n < 1) throw new Error('n < 1');
        if (this._data.length < 1) return [];

        this._checkAndFillTrailingData(currentTime);
        const lastSampleOpen = currentTime - this._lastTime < this.interval;

        this.hasData = this._data.length > 0;
    }

    /**
     * Get a value from the time series for a specific time.
     * @param {number} time     The time in the series from where data will
     *                          be retrieved.
     * @returns        The data at that time, or undefined if no data exists
     *                 at that time.
     */
    getAt(time) {
        // It's bad to push and pull data because it opens us up
        // to timing issues and means you may not get data back promptly - getAt
        // would need to be async and then timing is not deterministic.
        // So if data is missing, we just return undefined.
        // TODO: write up this problem because it would be a good one to use
        // during a job interview.
        // Some examples of contention - call getAt, it requires historic data,
        // while waiting for it new data comes in, which results in events
        // being executed and newer data being requested - the calculation
        // result would be 'undefined' (in the non deterministic sense) in this case.
        time -= (time % this.intervalMs);
        if (time < this.firstTime || time > this._lastTime) return undefined;

        const index = (time - this.firstTime) / this.intervalMs;
        return this._data[index];
    }

    // eslint-disable-next-line no-unused-vars
    getRange(startTime, endTime) {
    }
}
