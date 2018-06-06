import {chartIntervalToMs} from './utils';
import {ObservableMixin} from './observable';

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
        this.lastTime = 0;
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
        const gap = time - this.lastTime;
        if (gap < this.intervalMs) return;
        const nMissing = Math.ceil(gap / this.intervalMs);
        this._data = this._data.concat(
            new Array(nMissing).fill(this._data[this._data.length - 1])
        );
        this.lastTime = time;
    }

    /**
     * If a time is given that is prior to the first data sample, then
     * fill the data from time to the first existing sample, using the
     * given data value.
     * @param {number} time     Time in milliseconds.
     * @param          data     The data value to use when filling.
     */
    _checkAndFillLeadingData(time, data) {
        if (time % this.intervalMs !== 0) time -= (time % this.intervalMs);
        const gap = this.firstTime - time;
        if (gap < this.intervalMs) return;
        const nMissing = Math.ceil(gap / this.intervalMs);
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
            this.lastTime = this.firstTime = time;
            this.notifyObservers('extended', data, time);
        } else if (time > this.lastTime) {
            // Comes after last sample
            this._checkAndFillTrailingData(time - this.intervalMs);
            this._data.push(data);
            this.lastTime = time;
            this.notifyObservers('extended', data, time);
        } else if (time < this.firstTime) {
            // Comes before first sample
            this._checkAndFillLeadingData(time + this.intervalMs, data);
            this._data.unshift(data);
            this.firstTime = time;
            this.notifyObservers('extendedStart', data, time);
        } else {
            // Overwrites an existing sample.
            const replaceIndex = (time - this.firstTime) / this.intervalMs;
            this._data[replaceIndex] = data;
            this.notifyObservers('replaced', data, time);
        }

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
        if (time < this.firstTime || time > this.lastTime) return undefined;

        const index = (time - this.firstTime) / this.intervalMs;
        return this._data[index];
    }

    /**
     * Merge data from another TimeSeriesData instance into this one.
     * @param {TimeSeriesData} other    Another TimeSeriesData instance, created
     *                                  with the same interval.
     * @throws {Error}  If the interval of {@link other} doesn't match the
     *                  interval of this instance.
     */
    merge(other) {
        if (other.intervalMs != this.intervalMs) {
            throw new Error('Cannot merge due to different intervals.');
        }
        if (other._data.length == 0) return;

        const interval = this.intervalMs;

        let insertI = 0;

        if (this.hasData) {
            insertI = (other.firstTime - this.firstTime) / interval;
            if (insertI < 0) {
                // Will extend the start of the array by the number of required
                // elements, and also fill with the last data value from other.
                // This ensures that if the values from other don't fill all the way
                // to the start of the existing data, there's no gaps.
                this._checkAndFillLeadingData(other.firstTime, other._data[other._data.length-1]);
                insertI = 0;
            } else if (insertI > this._data.length) {
                this._checkAndFillTrailingData(other.firstTime);
            }
        }

        // Do the merge
        for (
            let i = 0, time = other.firstTime;
            i < other._data.length;
            i++, time += interval, insertI++
        ) {
            this._data[insertI] = other._data[i];
        }

        this.firstTime = Math.min(this.firstTime, other.firstTime);
        this.lastTime = Math.max(this.lastTime, other.lastTime);

        this.hasData = this._data.length > 0;
    }
}
