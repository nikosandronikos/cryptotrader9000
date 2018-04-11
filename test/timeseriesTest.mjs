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

        t.throws(() => ts.addData(intervalMs * 1.5, 3), Error);
        t.throws(() => ts.addData(intervalMs * 0.9, 3), Error);
        t.throws(() => ts.addData(intervalMs * 2.2, 3), Error);
    }
    t.end();
});

test('TimeSeriesData: get recent', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;
    const n = 3;
    let i = 0;

    t.deepEqual(ts.getRecent(3), []);

    for (; i < n; i++) {
        ts.addData(i * intervalMs, i);
    }

    t.throws(() => ts.getRecent(0), Error);
    t.deepEqual(ts.getRecent(1), [i-1]);
    t.deepEqual(ts.getRecent(2), [i-2,i-1]);
    t.deepEqual(ts.getRecent(3), [i-3,i-2,i-1]);
    t.deepEqual(ts.getRecent(4), [i-3,i-2,i-1]);

    t.end();
});

test('TimeSeriesData: get current', (t) => {
    const ts = new TimeSeriesData('1m');
    const intervalMs = 1 * 60 * 1000;

    t.equal(ts.getCurrent(), undefined);

    ts.addData(intervalMs, 42);
    t.equal(ts.getCurrent(), 42);

    ts.addData(intervalMs * 2, 43);
    ts.addData(intervalMs * 3, 44);
    t.equal(ts.getCurrent(), 44);

    ts.addData(0, 100);
    t.equal(ts.getCurrent(), 44);

    t.end();
});
