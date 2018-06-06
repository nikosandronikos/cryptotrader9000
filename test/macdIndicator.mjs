import {TimeSeriesData} from '../src/timeseries';
import {DifferenceIndicator, MACDIndicator}  from '../src/indicator';
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

test('MACDIndicator: creation sanity test', (t) => {
    let time = 0;
    const interval = '1m';
    const intervalMs = 1 * 60 * 1000;
    const ts = new TimeSeriesData(interval);
    const fakeBinance = {getTimestamp: () => time};
    let prepHistoryRun = 0;
    let addObserverRun = 0;
    let sourceObservers = [];
    let sourceValue = 0;
    const source = {
        interval: interval,
        prepHistory: () => { prepHistoryRun++; },
        addObserver: (evtName, fn) => {
            addObserverRun++;
            t.equal('update', evtName, 'addObserver event name correct');
            sourceObservers.push(fn);
        },
        getAt: (time) => {
            return Big(sourceValue++);
        },
        latestData: () => time
    };
    MACDIndicator.createAndInit(fakeBinance, 'MACDTest', source).then(ind => {
        t.equal(ind.interval, interval, 'intervals match');
        t.equal(ind.intervalMs, intervalMs, 'intervalMs match');
        t.equal(prepHistoryRun, 2, 'prepHistoryRun == 2');
        t.equal(addObserverRun, 2, 'addObserverRun == 2');

        // Add data and cause all obervers of the source to do calculations.
        for (let i = 0, time = 0; time < intervalMs * 10; time += intervalMs, i++) {
            for (const observer of sourceObservers) observer(time, null, null);
        }

        // Check the final calculations
        let lastMacd = Big(-1000000);
        for (let i = 0, time = 0; time < intervalMs * 10; time += intervalMs, i++) {
            // Not sure what the values should calculate to, but they should at
            // least be increasing.
            const [signal, macd] = ind.getAll(time);
            t.equal(signal.cmp(ind._signal.getAt(time)), 0, 'signal from getAll matches internal EMA');
            t.equal(macd.cmp(ind._macd.getAt(time)), 0, 'macd from getAll matches internal DiffIndicator');
            t.equal(macd.gt(lastMacd), true, 'macd is greater than previous');
            lastMacd = macd;
        }
        t.end();
    });
});
