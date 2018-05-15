import {chartIntervalToMs} from './utils';
import {ObservableMixin} from './observable';

// Assumes data will be added for all intervals, so we're not optimising for
// space wrt missing data.

/**
 * @access package
 */
export class TimeSeriesData extends ObservableMixin(Object) {
    // Interval is the interval for data samples.
    constructor(interval) {
        super();
        this.intervalStr = interval;
        this.interval = chartIntervalToMs(interval);
        this._firstTime = Infinity;
        this._lastTime = 0;
        this._data = [];
    }

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

    _checkAndFillLeadingData(time, data) {
        if (time % this.interval !== 0) time -= (time % this.interval);
        const gap = this._firstTime - time;
        if (gap < this.interval) return;
        const nMissing = Math.ceil(gap / this.interval);
        //console.log(`WARNING: _checkAndFillTrailingData adding ${nMissing}`);
        this._data = new Array(nMissing).fill(data).concat(this._data);
        this._firstTime = time;
    }

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

    // Get the n most recent samples. By default, this includes the most recent
    // interval which will likely not be closed, this behaviour can be changed
    // by passing includeOpen=false.
    // if n > the number of samples available, all available samples will
    // be returned.
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
