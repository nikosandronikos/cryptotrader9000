import {chartIntervalToMs}  from '../src/utils';
import {TimeSeriesData} from '../src/timeseries';
import test from 'tape';

test('TimeSeriesData: add data front to back', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;
    let i = 0;

    for (; i < 10; i++) {
        ts.addData(i * intervalMs, i);
        t.equal(ts.data.length, i+1);
    }

    t.equal(ts.firstTime, 0);
    t.equal(ts.lastTime, (i - 1) * intervalMs);
    let lastV = -1;
    for (const v of ts.data) {
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
        t.equal(ts.data.length, i+1);
    }

    t.equal(ts.firstTime, 1 * intervalMs);
    t.equal(ts.lastTime, n * intervalMs);
    let lastV = -1;
    for (const v of ts.data) {
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
        t.equal(ts.data.length, Math.min(i+1, nOver));
    }
    t.deepEqual(ts.data, expected);
    t.end();
});

test('TimeSeriesData: add off interval', (t) => {
    const intervalStrList = ['1m', '3m', '2h', '10d', '4w']
    for (const intervalStr of intervalStrList) {
        const ts = new TimeSeriesData(intervalStr);
        const intervalMs = chartIntervalToMs(intervalStr);

        ts.addData(intervalMs, 1);
        ts.addData(intervalMs * 2, 2);
        t.deepEqual(ts.data, [1, 2], 'a');

        ts.addData(intervalMs * 1.5, 3);
        t.deepEqual(ts.data, [3, 2], 'b');
        ts.addData(intervalMs * 0.9, 4);
        t.deepEqual(ts.data, [4, 3, 2], 'c');
        ts.addData(intervalMs * 2.2, 5);
        t.deepEqual(ts.data, [4, 3, 5], 'c');
    }
    t.end();
});

test('TimeSeriesData: get recent', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;
    const n = 3;
    let i = 0;

    t.throws(() => ts.getRecent(3, intervalMs), Error);

    for (; i < n; i++) {
        ts.addData(i * intervalMs, i);
    }

    t.throws(() => ts.getRecent(0, intervalMs), Error);
    t.deepEqual(ts.getRecent(1, i * intervalMs), [i-1]);
    t.deepEqual(ts.getRecent(2, i * intervalMs), [i-2,i-1]);
    t.deepEqual(ts.getRecent(3, i * intervalMs), [i-3,i-2,i-1]);
    t.deepEqual(ts.getRecent(4, i * intervalMs), [i-3,i-2,i-1]);

    // Request data from a timepoint with missing intervals.
    // Missing data should be created by copying last element.
    t.deepEqual(ts.getRecent(4, (i + 2) * intervalMs), [i-2,i-1,i-1,i-1]);
    t.deepEqual(ts.getRecent(4, (i + 2 + 0.5) * intervalMs), [i-1,i-1,i-1,i-1]);

    t.throws(() => ts.getRecent(2, i * intervalMs, false), Error);

    t.end();
});

test('TimeSeriesData: add data miss intervals at end', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;

    ts.addData(intervalMs, 1);
    t.equal(ts.data.length, 1, 'a');

    ts.addData(intervalMs * 3, 3);
    t.equal(ts.data.length, 3, 'b');

    ts.addData(intervalMs * 5, 5);
    t.equal(ts.data.length, 5, 'c');

    const expected = [1,1,3,3,5]
    t.deepEqual(ts.data, expected, 'd');

    t.end();
});

test('TimeSeriesData: add data miss intervals at start', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;

    ts.addData(intervalMs * 5, 1);
    t.equal(ts.data.length, 1, 'a');
    t.equal(ts.firstTime, intervalMs * 5, 'a.2');
    t.equal(ts.lastTime, intervalMs * 5, 'a.3');

    ts.addData(intervalMs * 3, 3);
    t.equal(ts.data.length, 3, 'b');
    t.deepEqual(ts.data, [3, 3, 1], 'c');

    ts.addData(intervalMs * 1.5, 5);
    t.equal(ts.data.length, 5, 'd');
    t.deepEqual(ts.data, [5, 5, 3, 3, 1], 'e');

    t.end();
});
