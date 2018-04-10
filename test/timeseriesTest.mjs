import {TimeSeriesData} from '../src/timeseries';
import test from 'tape';

test('add data front to back', (t) => {
    const ts = new TimeSeriesData('1m');
    let i = 0;

    for (; i < 10; i++) {
        ts.addData(i, i);
        t.equal(ts.data.length, i+1);
    }

    t.equal(ts.firstTime, 0);
    t.equal(ts.lastTime, i-1);
    let lastV = -1;
    for (const v of ts.data) {
        t.equal(v > lastV, true);
        lastV = v;
    }

    t.end();
});

test('add data back to front', (t) => {
     const ts = new TimeSeriesData('1m');
    let i = 0;
    const n = 10;

    for (; i < n; i++) {
        ts.addData(n - i, n - i);
        t.equal(ts.data.length, i+1);
    }

    t.equal(ts.firstTime, 1);
    t.equal(ts.lastTime, n);
    let lastV = -1;
    for (const v of ts.data) {
        t.equal(v > lastV, true);
        lastV = v;
    }

    t.end();
});

test('get recent', (t) => {
    const ts = new TimeSeriesData('1m');
    const n = 3;
    let i = 0;

    for (; i < n; i++) {
        ts.addData(i, i);
    }

    t.throws(() => ts.getRecent(0), Error);
    t.deepEqual(ts.getRecent(1), [i-1]);
    t.deepEqual(ts.getRecent(2), [i-2,i-1]);
    t.deepEqual(ts.getRecent(3), [i-3,i-2,i-1]);
    t.deepEqual(ts.getRecent(4), [i-3,i-2,i-1]);

    t.end();
});

