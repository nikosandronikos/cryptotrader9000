import {TimeSeriesData} from '../src/timeseries';
import {DifferenceIndicator}  from '../src/indicator';
import Big from 'big.js';
import test from 'tape';

test('DifferenceIndicator: calculate', (t) => {
    let time = 0;
    const interval = '1m';
    const ts = new TimeSeriesData(interval);
    const fakeBinance = {getTimestamp: () => time};
    const a = {
        interval: interval,
        prepHistory: () => {},
        addObserver: () => {},
        getAt: (time) => {
            return Big(time).times(2);
        }
    };
    const b = {
        interval: interval,
        prepHistory: () => {},
        addObserver: () => {},
        getAt: (time) => {
            return Big(time);
        }
    };
    const ind = new DifferenceIndicator(fakeBinance, 'diffIndTest', a, b);
    const intervalMs = 1 * 60 * 1000;
    for (let i = 0, time = 0; time < intervalMs * 10; time += intervalMs, i++) {
        const result = ind._calculate(time);
        t.equal(result.cmp(time), 0, `${i}: calculate correct`);
    }
    t.equal(ind._data._data.length, 10, 'data length correct');
    t.equal(ind._data.firstTime, 0, 'firstTime correct');
    t.equal(ind._data.lastTime, intervalMs * 9, 'lastTime correct');
    t.end();
});

test('DifferenceIndicator: creation sanity test', (t) => {
    let time = 0;
    const interval = '1m';
    const intervalMs = 1 * 60 * 1000;
    const ts = new TimeSeriesData(interval);
    const fakeBinance = {getTimestamp: () => time};
    let prepHistoryRun = 0;
    let addObserverRun = 0;
    let aObserver = null, bObserver = null;
    const a = {
        interval: interval,
        prepHistory: () => {prepHistoryRun++},
        addObserver: (evtName, fn) => {
            addObserverRun++;
            t.equal('update', evtName, 'a.addObserver event name correct');
            aObserver = fn;
        },
        getAt: (time) => {
            return Big(time).add(1);
        }
    };
    const b = {
        interval: interval,
        prepHistory: () => {prepHistoryRun++},
        addObserver: (evtName, fn) => {
            addObserverRun++;
            t.equal('update', evtName, 'b.addObserver event name correct');
            bObserver = fn;
        },
        getAt: (time) => {
            return Big(time);
        }
    };
    DifferenceIndicator.createAndInit(fakeBinance, 'diffIndTest', a, b).then(ind => {
        t.equal(ind.interval, interval, 'intervals match');
        t.equal(ind.intervalMs, intervalMs, 'intervalMs match');
        t.equal(prepHistoryRun, 2, 'prepHistoryRun == 2');
        t.equal(addObserverRun, 2, 'addObserverRun == 2');

        // Because prepHistory is called, firstTime will be before creation time
        t.equal(ind._data.firstTime < 0, true, 'firstTime < 0');
        t.equal(ind._data._data.length > 0, true, 'data length > 0');

        for (let i = 0, time = 0; time < intervalMs * 10; time += intervalMs, i++) {
            aObserver(time, null, null);
            t.equal(ind._nUpdates, 1, `${i}: nUpdates == 1`);
            bObserver(time, null, null);
            t.equal(ind._nUpdates, 0, `${i}: nUpdates == 0`);
            t.equal(ind._data.lastTime, time, `${i}: lastTime == ${time}`);
        }

        for (let i = 0, time = 0; time < intervalMs * 10; time += intervalMs, i++) {
            t.equal(ind.getAt(time).cmp(1), 0, `${i}: getAt correct`);
        }
        t.end();
    });
});

