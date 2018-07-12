import {RSIIndicator}  from '../src/indicator';
import Big from 'big.js';
import test from 'tape';

test('RSIIndicator: _calculate', (t) => {
    const sourceValues = [
        44.33890000, 44.09020000, 44.14970000, 43.61240000, 44.32780000,
        44.82640000, 45.09550000, 45.42450000, 45.84330000, 46.08260000,
        45.89310000, 46.03280000, 45.61400000, 46.28200000, 46.28200000,
        46.00280000, 46.03280000, 46.41160000, 46.22220000, 45.64390000,
        46.21220000, 46.25210000, 45.71370000, 46.45150000, 45.78350000,
        45.35480000, 44.02880000, 44.17830000, 44.21810000, 44.56720000,
        43.42050000, 42.66280000, 43.13140000
    ];
    const expected = [
        70.53278948, 66.31856181, 66.54982994, 69.40630534, 66.35516906,
        57.97485571, 62.92960675, 63.25714756, 56.05929872, 62.37707144,
        54.70757308, 50.42277441, 39.98982315, 41.46048198, 41.86891609,
        45.46321245, 37.30404209, 33.07952299, 37.77295211
    ];
    const sourceI = 0;
    const fakeSource = {
        // Each step of time goes to next source value
        interval: '1m',
        getNData: (time, n) => {
            const data = sourceValues.slice(time, time+Math.abs(n));
            return data.map(v => Big(v));
        }
    };
    const ind = new RSIIndicator(null, 'RSI _calculate test', fakeSource);
    let time = 0;
    for (const expect of expected) {
        const result = ind._calculate(time++);
        t.equal(
            Big(expect).sub(result).abs().lt(0.00001),
            true,
            `Result at time(${time}) correct`
        );
    }

    t.end();
});

test('RSIIndicator: creation sanity test', (t) => {
    let time = 0;
    const interval = '1m';
    const intervalMs = 1 * 60 * 1000;
    let prepHistoryRun = 0;
    let addObserverRun = 0;
    let sourceObserver = null;
    const fakeBinance = {getTimestamp: () => time};
    const fakeSource = {
        binance: fakeBinance,
        interval: interval,
        prepHistory: () => {prepHistoryRun++},
        latestData: () => time,
        addObserver: (evtName, fn) => {
            addObserverRun++;
            t.equal('update', evtName, 'fakeSource.addObserver event name correct');
            sourceObserver = fn;
        },
        getAt: (time) => {
            return Big(time).add(1);
        },
        getNData: (time, n) => {
            n = Math.abs(n);
            return (new Array(n)).fill(Big(1), 0, n);
        }
    };
    RSIIndicator.createAndInit('RSI sanity test', fakeSource).then(ind => {
        t.equal(ind.interval, interval, 'intervals match');
        t.equal(ind.intervalMs, intervalMs, 'intervalMs match');
        t.equal(prepHistoryRun, 1, 'prepHistoryRun == 1');
        t.equal(addObserverRun, 1, 'addObserverRun == 1');
        // Because prepHistory is called, firstTime will be before creation time
        t.equal(ind._data.firstTime < 0, true, 'firstTime < 0');
        t.equal(ind._data._data.length > 0, true, 'data length > 0');

        sourceObserver(time, null, null);
        t.equal(ind._data.lastTime, time, 'lastTime == time');

        // getNData is returning no losses so RSI is 100.
        t.equal(ind.getAt(0).eq(100), true, `getAt correct`);

        t.end();
    });
});
