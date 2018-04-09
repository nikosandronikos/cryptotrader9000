import {chartIntervalToMs} from './utils';
import {ObservableMixin} from './observable';

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
        //FIXME: Should check time is exactly on the interval and return
        // error if not.

        console.log('TimeSeriesData.addData: ', time, data.toString());

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

        console.log('  length =', this.data.length);
    }

    // Return the data from the most recent closed interval.
    // An interval is considered closed once it's open time + the interval
    // length has been exceeded.
    getCompleted() {
    }

    // Get the most current data sample.
    getCurrent() {
    }

    // Get the n most recent samples. By default, this includes the most recent
    // inteval which will likely not be closed, this behaviour can be changed
    // by passing includeOpen=false.
    getRecent(n, includeOpen=true) {
        return this.data.slice(-n);
    }

    getRange(startTime, endTime) {
    }
}
