import {chartIntervalToMs} from './utils';
import {ObservableMixin} from './observable';

// Assumes data will be added for all intervals, so we're not optimising for
// space wrt missing data.

export class TimeSeriesData extends ObservableMixin(Object) {
    // Interval is the interval for data samples.
    constructor(interval) {
        super();
        this.intervalStr = interval;
        this.interval = chartIntervalToMs(interval);
        this.firstTime = Infinity;
        this.lastTime = 0;
        this.data = [];
    }

    _checkAndFillTrailingData(time) {
        if (time % this.interval !== 0) time -= (time % this.interval);
        const gap = time - this.lastTime;
        if (gap < this.interval) return;
        const nMissing = Math.ceil(gap / this.interval);
        //console.log(`WARNING: _checkAndFillTrailingData adding ${nMissing}`);
        this.data = this.data.concat(
            new Array(nMissing).fill(this.data[this.data.length - 1])
        );
        this.lastTime = time;
    }

    _checkAndFillLeadingData(time, data) {
        if (time % this.interval !== 0) time -= (time % this.interval);
        const gap = this.firstTime - time;
        if (gap < this.interval) return;
        const nMissing = Math.ceil(gap / this.interval);
        //console.log(`WARNING: _checkAndFillTrailingData adding ${nMissing}`);
        this.data = new Array(nMissing).fill(data).concat(this.data);
        this.firstTime = time;
    }

    addData(time, data) {
        if (time % this.interval !== 0) time -= (time % this.interval);

        if (this.data.length === 0) {
            this.data.push(data);
            this.lastTime = this.firstTime = time;
        } else if (time > this.lastTime) {
            // Comes after last sample
            this._checkAndFillTrailingData(time - this.interval);
            this.data.push(data);
            this.lastTime = time;
            this.notifyObservers('extended', data);
        } else if (time < this.firstTime) {
            // Comes before first sample
            this._checkAndFillLeadingData(time + this.interval, data);
            this.data.unshift(data);
            this.firstTime = time;
        } else {
            // If it falls exactly on the interval, overwrites an existing
            // sample, otherwise an error.
            const replaceIndex = (time - this.firstTime) / this.interval;
            this.data[replaceIndex] = data;
            this.notifyObservers('replaceRecent', data);
        }
    }

    // Get the n most recent samples. By default, this includes the most recent
    // interval which will likely not be closed, this behaviour can be changed
    // by passing includeOpen=false.
    // if n > the number of samples available, all available samples will
    // be returned.
    getRecent(n, currentTime, includeOpen=true) {
        if (n < 1) throw new Error('n < 1');
        if (this.data.length < 1) return [];

        this._checkAndFillTrailingData(currentTime);
        const lastSampleOpen = currentTime - this.lastTime < this.interval;

        if (includeOpen || !lastSampleOpen) return this.data.slice(-n);

        const offset = this.data.length - 1;
        return this.data.slice(Math.max(0, offset - n), offset);
    }

    // eslint-disable-next-line no-unused-vars
    getRange(startTime, endTime) {
    }
}
