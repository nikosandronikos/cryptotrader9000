import {chartIntervalToMs}  from '../src/utils';
import {TimeSeriesData} from '../src/timeseries';
import test from 'tape';

test('TimeSeriesData: add data front to back', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;
    let i = 0;

    t.equal(ts.hasData, false);

    for (; i < 10; i++) {
        ts.addData(i * intervalMs, i);
        t.equal(ts._data.length, i+1);
        t.equal(ts.hasData, true);
    }

    t.equal(ts.firstTime, 0);
    t.equal(ts.lastTime, (i - 1) * intervalMs);
    let lastV = -1;
    for (const v of ts._data) {
        t.equal(v > lastV, true);
        lastV = v;
    }

    t.end();
});

test('TimeSeriesData: add data back to front', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;
    let i = 0;
    const n = 10;

    for (; i < n; i++) {
        ts.addData((n - i) * intervalMs, n - i);
        t.equal(ts._data.length, i+1);
        t.equal(ts.hasData, true);
    }

    t.equal(ts.firstTime, 1 * intervalMs);
    t.equal(ts.lastTime, n * intervalMs);
    let lastV = -1;
    for (const v of ts._data) {
        t.equal(v > lastV, true);
        lastV = v;
    }

    t.end();
});

test('TimeSeriesData: add data overwrite', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;
    const nOver = 3;
    const nOverTimes = 2;
    const expected = (new Array(nOver)).fill(0).map((v,i) => v + (nOver * (nOverTimes - 1)) + i);
    for (let i = 0; i < nOver * nOverTimes; i++) {
        // First few (nOver) add normally, then overwriting starts.
        ts.addData((i % nOver) * intervalMs, i);
        t.equal(ts._data.length, Math.min(i+1, nOver));
    }
    t.deepEqual(ts._data, expected);
    t.end();
});

test('TimeSeriesData: add off interval', (t) => {
    const intervalStrList = ['1m', '3m', '2h', '10d', '4w']
    for (const intervalStr of intervalStrList) {
        const ts = new TimeSeriesData(intervalStr);
        const intervalMs = chartIntervalToMs(intervalStr);

        ts.addData(intervalMs, 1);
        t.equal(ts.hasData, true);
        ts.addData(intervalMs * 2, 2);
        t.deepEqual(ts._data, [1, 2], 'a');

        ts.addData(intervalMs * 1.5, 3);
        t.deepEqual(ts._data, [3, 2], 'b');
        ts.addData(intervalMs * 0.9, 4);
        t.deepEqual(ts._data, [4, 3, 2], 'c');
        ts.addData(intervalMs * 2.2, 5);
        t.deepEqual(ts._data, [4, 3, 5], 'c');
    }
    t.end();
});

test('TimeSeriesData: add data miss intervals at end', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;

    ts.addData(intervalMs, 1);
    t.equal(ts._data.length, 1, 'a');

    ts.addData(intervalMs * 3, 3);
    t.equal(ts._data.length, 3, 'b');

    ts.addData(intervalMs * 5, 5);
    t.equal(ts._data.length, 5, 'c');

    const expected = [1,1,3,3,5]
    t.deepEqual(ts._data, expected, 'd');

    // Shouldn't cause new data to be added.
    ts.addData(intervalMs * 5.5, 6);
    t.equal(ts._data.length, 5, 'e');
    t.deepEqual(ts._data, [1,1,3,3,6], 'f');

    t.end();
});

test('TimeSeriesData: add data miss intervals at start', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;

    ts.addData(intervalMs * 5, 1);
    t.equal(ts._data.length, 1, 'a');
    t.equal(ts.firstTime, intervalMs * 5, 'a.2');
    t.equal(ts.lastTime, intervalMs * 5, 'a.3');

    ts.addData(intervalMs * 3, 3);
    t.equal(ts._data.length, 3, 'b');
    t.deepEqual(ts._data, [3, 3, 1], 'c');

    ts.addData(intervalMs * 1.5, 5);
    t.equal(ts._data.length, 5, 'd');
    t.deepEqual(ts._data, [5, 5, 3, 3, 1], 'e');

    t.end();
});

test('TimeSeriesData: _checkAndFillLeadingData', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;

    ts.addData(intervalMs * 5, 1);
    ts._checkAndFillLeadingData(intervalMs * 5 - 1, 2);
    t.deepEqual(ts._data, [2, 1]);

    t.end();
});

test('TimeSeriesData: getAt', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;

    ts.addData(intervalMs * 1, 1);
    ts.addData(intervalMs * 2, 2);
    ts.addData(intervalMs * 3, 3);
    ts.addData(intervalMs * 4, 4);
    ts.addData(intervalMs * 5, 5);
    ts.addData(intervalMs * 6, 6);

    t.equal(ts.getAt(intervalMs * -1), undefined);
    t.equal(ts.getAt(intervalMs * 0.9), undefined);
    t.equal(ts.getAt(intervalMs * 1), 1);
    t.equal(ts.getAt(intervalMs * 2), 2);
    t.equal(ts.getAt(intervalMs * 2.5), 2);
    t.equal(ts.getAt(intervalMs * 2.99), 2);
    t.equal(ts.getAt(intervalMs * 3), 3);
    t.equal(ts.getAt(intervalMs * 4), 4);
    t.equal(ts.getAt(intervalMs * 5), 5);
    t.equal(ts.getAt(intervalMs * 6), 6);
    t.equal(ts.getAt(intervalMs * 6.9), 6);
    t.equal(ts.getAt(intervalMs * 7), undefined);

    ts.addData(intervalMs * 8, 8);
    t.equal(ts.getAt(intervalMs * 7), 6);
    t.equal(ts.getAt(intervalMs * 8), 8);
    t.equal(ts.getAt(intervalMs * 9), undefined);

    t.end();
});

test('TimeSeriesData: merge', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;
    const baseTimeOffset = intervalMs * 10;

    ts.addData(intervalMs * 1 + baseTimeOffset, 1);
    ts.addData(intervalMs * 2 + baseTimeOffset, 2);
    ts.addData(intervalMs * 3 + baseTimeOffset, 3);
    ts.addData(intervalMs * 4 + baseTimeOffset, 4);

    const tsDiffInterval = new TimeSeriesData('5m');

    t.throws(() => ts.merge(tsDiffInterval), Error);

    const tsB = new TimeSeriesData('1m');
    tsB.addData(intervalMs * 1, 5);
    tsB.addData(intervalMs * 2, 6);
    tsB.addData(intervalMs * 3, 7);

    ts.merge(tsB);
    t.deepEqual(ts._data, [5,6,7,7,7,7,7,7,7,7,1,2,3,4], 'b');
    t.equal(ts.firstTime, tsB.firstTime, 'b');
    t.equal(ts.lastTime, intervalMs * 4 + baseTimeOffset, 'b');

    const tsC = new TimeSeriesData('1m');
    tsC.addData(intervalMs * 5, 8);
    tsC.addData(intervalMs * 6, 9);
    ts.merge(tsC);
    t.deepEqual(ts._data, [5,6,7,7,8,9,7,7,7,7,1,2,3,4], 'c');
    t.equal(ts.firstTime, tsB.firstTime, 'c');
    t.equal(ts.lastTime, intervalMs * 4 + baseTimeOffset, 'c');

    const tsD = new TimeSeriesData('1m');
    tsD.addData(intervalMs * 5 + baseTimeOffset, 10);
    tsD.addData(intervalMs * 6 + baseTimeOffset, 11);
    ts.merge(tsD);
    t.deepEqual(ts._data, [5,6,7,7,8,9,7,7,7,7,1,2,3,4,10,11], 'd');
    t.equal(ts.firstTime, tsB.firstTime, 'd');
    t.equal(ts.lastTime, intervalMs * 6 + baseTimeOffset, 'd');

    const tsE = new TimeSeriesData('1m');
    tsE.addData(intervalMs * 9 + baseTimeOffset, 12);
    tsE.addData(intervalMs * 10 + baseTimeOffset, 13);
    tsE.addData(intervalMs * 11 + baseTimeOffset, 14);
    ts.merge(tsE);
    t.deepEqual(ts._data, [5,6,7,7,8,9,7,7,7,7,1,2,3,4,10,11,11,11,12,13,14], 'e');
    t.equal(ts.firstTime, tsB.firstTime, 'e');
    t.equal(ts.lastTime, intervalMs * 11 + baseTimeOffset, 'e');

    const tsEmpty = new TimeSeriesData('1m');
    ts.merge(tsEmpty);
    t.deepEqual(ts._data, [5,6,7,7,8,9,7,7,7,7,1,2,3,4,10,11,11,11,12,13,14], 'f');
    t.equal(ts.firstTime, tsB.firstTime, 'f');
    t.equal(ts.lastTime, intervalMs * 11 + baseTimeOffset, 'f');

    tsEmpty.merge(ts);
    t.deepEqual(tsEmpty._data, [5,6,7,7,8,9,7,7,7,7,1,2,3,4,10,11,11,11,12,13,14], 'g');
    t.equal(tsEmpty.firstTime, ts.firstTime, 'g');
    t.equal(tsEmpty.lastTime, ts.lastTime, 'g');
    t.equal(tsEmpty.hasData, true, 'g');

    t.end();
});
