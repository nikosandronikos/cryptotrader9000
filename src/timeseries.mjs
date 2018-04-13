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
        const gap = time - this.lastTime;
        if (gap <= this.interval) return;
        this.data = this.data.concat(
            new Array(
                Math.ceil((time - this.interval - this.lastTime) / this.interval)
            ).fill(this.data[this.data.length - 1])
        );
    }

    _checkAndFillLeadingData(time, data) {
        const gap = this.firstTime - time;
        if (gap <= this.interval) return;
        this.data = new Array(
            Math.ceil((this.firstTime - time) / this.interval - 1)
        ).fill(data).concat(this.data);
    }

    addData(time, data) {
        if (time % this.interval !== 0) {
            time -= (time % this.interval);
        }

        if (this.data.length === 0) {
            this.data.push(data);
            this.lastTime = this.firstTime = time;
        } else if (time > this.lastTime) {
            // Comes after last sample
            this._checkAndFillTrailingData(time);
            this.data.push(data);
            this.lastTime = time;
            this.notifyObservers('extended', data);
        } else if (time < this.firstTime) {
            // Comes before first sample
            this._checkAndFillLeadingData(time, data);
            this.data.unshift(data);
            this.firstTime = time;
        } else {
            // If it falls exactly on the interval, overwrites an existing
            // sample, otherwise an error.
            const replaceIndex = (time - this.firstTime) / this.interval;
            console.log('  replaces:', replaceIndex);
            this.data[replaceIndex] = data;
            this.notifyObservers('replaceRecent', data);
        }
    }

    // Get the n most recent samples. By default, this includes the most recent
    // inteval which will likely not be closed, this behaviour can be changed
    // by passing includeOpen=false.
    // if n > the number of samples available, all available samples will
    // be returned.
    getRecent(n, currentTime, includeOpen=true) {
        if (n < 1) throw new Error('n < 1');
        if (this.data.length < 1) throw new Error('Must have at least one entry.');
        if (!includeOpen) throw new Error('Not implemented.');

        this._checkAndFillTrailingData(currentTime);
        return this.data.slice(-n);
    }

    getRange(startTime, endTime) {
    }
}
