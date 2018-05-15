import {chartIntervalToMs} from './utils';
import {ObservableMixin} from './observable';

// Assumes data will be added for all intervals, so we're not optimising for
// space wrt missing data.

/**
 * Data store for time series data - i.e. data that is associated with
 * fixed intervals of time and has no gaps.
 * @package
 */
export class TimeSeriesData extends ObservableMixin(Object) {
    /**
     * @param {string} interval     An string representing a time interval.
     *                              For accepted values, see {@link chartIntervalToMs}.
     */
    constructor(interval) {
        super();
        /** Time interval in string form. */
        this.intervalStr = interval;
        /** Time interval in milliseconds. */
        this.interval = chartIntervalToMs(interval);
        this._firstTime = Infinity;
        this._lastTime = 0;
        this._data = [];
    }

    /**
     * If a time is given that is after the last data sample, then
     * fill the data up to time.
     * @param {number} time     Time in milliseconds.
     */
    _checkAndFillTrailingData(time) {
        if (time % this.interval !== 0) time -= (time % this.interval);
        const gap = time - this._lastTime;
        if (gap < this.interval) return;
        const nMissing = Math.ceil(gap / this.interval);
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
        if (time % this.interval !== 0) time -= (time % this.interval);
        const gap = this._firstTime - time;
        if (gap < this.interval) return;
        const nMissing = Math.ceil(gap / this.interval);
        //console.log(`WARNING: _checkAndFillTrailingData adding ${nMissing}`);
        this._data = new Array(nMissing).fill(data).concat(this._data);
        this._firstTime = time;
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
        if (time % this.interval !== 0) time -= (time % this.interval);

        if (this._data.length === 0) {
            this._data.push(data);
            this._lastTime = this._firstTime = time;
        } else if (time > this._lastTime) {
            // Comes after last sample
            this._checkAndFillTrailingData(time - this.interval);
            this._data.push(data);
            this._lastTime = time;
            this.notifyObservers('extended', data, time);
        } else if (time < this._firstTime) {
            // Comes before first sample
            this._checkAndFillLeadingData(time + this.interval, data);
            this._data.unshift(data);
            this._firstTime = time;
        } else {
            // If it falls exactly on the interval, overwrites an existing
            // sample, otherwise an error.
            const replaceIndex = (time - this._firstTime) / this.interval;
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

        if (includeOpen || !lastSampleOpen) return this._data.slice(-n);

        const offset = this._data.length - 1;
        return this._data.slice(Math.max(0, offset - n), offset);
    }

    /**
     * Get a value from the time series for a specific time.
     * @param {number} time     The time in the series from where data will
     *                          be retrieved.
     * @returns        The data at that time, or undefined if no data exists
     *                 at that time.
     */
    getAt(time) {
        time -= (time % this.interval);

        if (time < this._firstTime || time > this._lastTime) {
            return undefined;
        }

        const index = (time - this._firstTime) / this.interval;
        return this._data[index];
    }

    // eslint-disable-next-line no-unused-vars
    getRange(startTime, endTime) {
    }
}
