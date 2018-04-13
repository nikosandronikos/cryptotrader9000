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

    addData(time, data) {
        if (time % this.interval !== 0) {
            throw new Error(
                'time not exactly on the interval.'
                + ` Interval = ${this.intervalStr}`
                + `, time = ${time}, time % interval = ${time % this.interval}`
            );
        }

        if (this.data.length === 0) {
            this.data.push(data);
            this.lastTime = this.firstTime = time;
        } else if (time > this.lastTime) {
            // Comes after last sample
            this.data.push(data);
            this.lastTime = time;
            this.notifyObservers('extended', data);
        } else if (time < this.firstTime) {
            // Comes before first sample
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

    // Return the data from the most recent closed interval.
    // An interval is considered closed once it's open time + the interval
    // length has been exceeded.
    getCompleted() {
    }

    // Get the most current data sample.
    getCurrent() {
        return this.data[this.data.length - 1];
    }

    // Get the n most recent samples. By default, this includes the most recent
    // inteval which will likely not be closed, this behaviour can be changed
    // by passing includeOpen=false.
    // if n > the number of samples available, all available samples will
    // be returned.
    getRecent(n, includeOpen=true) {
        if (n < 1) throw new Error('n < 1');
        if (this.data.length < 1) throw new Error('Must have at least one entry.');
        if (!includeOpen) throw new Error('Not implemented.');

        return this.data.slice(-n);
    }

    getRange(startTime, endTime) {
    }
}
