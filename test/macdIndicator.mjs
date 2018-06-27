import {TimeSeriesData} from '../src/timeseries';
import {DifferenceIndicator, MACDIndicator, IndicatorConfig}  from '../src/indicator';
import Big from 'big.js';
import test from 'tape';

test('DifferenceIndicator: prepHistory', (t) => {
    const interval = '1m';
    const intervalMs = 1 * 60 * 1000;
    let prepHistoryRun = 0;
    let sourceValue = 0;
    const fakeIndicator = {
        interval: interval,
        prepHistory: () => { prepHistoryRun++; },
        addObserver: (evtName, fn) => {
            addObserverRun++;
            t.equal('update', evtName, 'addObserver event name correct');
            sourceObservers.push(fn);
        },
        getAt: (time) => {
            console.log('time', time);
            return Big(sourceValue++);
        },
        latestData: () => time
    };
    const time = 120000;
    const fakeBinance = {
        getTimestamp: () => time
    }
    const ts = new TimeSeriesData('1m');
    const ind = new DifferenceIndicator(fakeBinance, 'DiffIndicator Test', fakeIndicator, fakeIndicator);

    t.equal(ind._data.hasData, false, 'Indicator has no data');
    const historyStart = 0;
    ind.prepHistory(historyStart).then( () => {
        t.equal(prepHistoryRun, 2, 'prepHistory was called');
        t.equal(ind._data.hasData, true, 'Indicator has data');
        console.log(ind._data.firstData);
        t.equal(ind.earliestData(), historyStart, 'earliestData() matches historyStart');
        t.equal(ind.latestData(), time - intervalMs, 'latestData() matches time, minus one interval');
        t.end();
   });
});

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
    IndicatorConfig.emaHistoryLength = 0;
    const prices = [
        8119.1400, 8122.0000, 8122.0200, 8122.1000, 8122.1000, 8119.6400,
        8122.0100, 8121.1700, 8124.2700, 8116.0000, 8116.5000, 8119.4400,
        8121.9900, 8117.9600, 8117.2900, 8120.0000, 8122.3100, 8138.0700,
        8184.1900, 8255.8400, 8320.2000, 8353.5600, 8350.0100, 8343.5400,
        8299.8700, 8325.0000, 8324.7800, 8325.0000, 8320.0000
    ];
    const expectedMacd = [
        0.0000, 0.2281, 0.4059, 0.5469, 0.6512, 0.5292, 0.6166, 0.6111, 0.8471,
        0.3627, 0.0189, -0.0162, 0.1599, -0.0254, -0.2237, -0.1604, 0.0754,
        1.5164, 6.3072, 15.7045, 28.0222, 40.0147, 48.6713, 54.3828, 54.7542,
        56.4259, 57.0750, 56.9507, 55.8055
    ];
    const expectedSignal = [
        0.0000, 0.0456, 0.1177, 0.2035, 0.2931, 0.3403, 0.3955, 0.4387, 0.5204,
        0.4888, 0.3948, 0.3126, 0.2821, 0.2206, 0.1317, 0.0733, 0.0737, 0.3623,
        1.5513, 4.3819, 9.1100, 15.2909, 21.9670, 28.4502, 33.7110, 38.2539,
        42.0182, 45.0047, 47.1648
    ];
    let pricesIndex = 0;
    let time = 0;
    const interval = '1m';
    const intervalMs = 1 * 60 * 1000;
    const ts = new TimeSeriesData(interval);
    const fakeBinance = {getTimestamp: () => time};
    let prepHistoryRun = 0;
    let addObserverRun = 0;
    let sourceObservers = [];
    let sourceValue = 0;
    let sourceLastTime = 0;
    const source = {
        interval: interval,
        prepHistory: () => { prepHistoryRun++; },
        addObserver: (evtName, fn) => {
            addObserverRun++;
            t.equal('update', evtName, 'addObserver event name correct');
            sourceObservers.push(fn);
        },
        getAt: (time) => {
            console.log(time);
            if (time > sourceLastTime) pricesIndex++;
            sourceLastTime = time;
            return Big(prices[pricesIndex]);
        },
        latestData: () => time
    };
    MACDIndicator.createAndInit(fakeBinance, 'MACDTest', source).then(ind => {
        t.equal(ind.interval, interval, 'intervals match');
        t.equal(ind.intervalMs, intervalMs, 'intervalMs match');
        // Once for each indicator. No history is prepared so no call is skipped.
        t.equal(prepHistoryRun, 6, 'prepHistoryRun == 6');
        t.equal(addObserverRun, 2, 'addObserverRun == 2');

        // Add data and cause all obervers of the source to do calculations.
        for (let i = 0, time = 0; time < intervalMs * prices.length; time += intervalMs, i++) {
            for (const observer of sourceObservers) observer(time, null, null);
        }

        // Check the final calculations
        let expectedIndex = 0;
        for (let i = 0, time = 0; time < intervalMs * prices.length; time += intervalMs, i++) {
            const [signal, macd] = ind.getAll(time);
            t.equal(signal.cmp(ind._signal.getAt(time)), 0, 'signal from getAll matches internal EMA');
            t.equal(macd.cmp(ind._macd.getAt(time)), 0, 'macd from getAll matches internal DiffIndicator');
            t.equal(
                macd.minus(expectedMacd[expectedIndex]).lt(0.0001),
                true, 'macd matches expected'
            );
            t.equal(
                signal.minus(expectedSignal[expectedIndex]).lt(0.0001),
                true, 'signal matches expected'
            );
            expectedIndex++;
        }
        t.end();
    });
});
