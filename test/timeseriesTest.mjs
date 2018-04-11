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

test('add data overwrite', (t) => {
    const ts = new TimeSeriesData('1m');
    const add = [1, 2, 3, 4, 5, 6];
    const overWriteAfter = 3;
    const expected = [4, 5, 6];
    let time = 0;
    for (let v of add) {
        ts.addData(time % overWriteAfter, v);
        t.equal(ts.data.length, Math.min(time, overWriteAfter));
        time++;
    }
    t.deepEqual(ts.data, expected);
    t.end();
});
    
test('add data overwrite 2', (t) => {
    const ts = new TimeSeriesData('1m');
    const nOver = 3;
    const nOverTimes = 2;
    const expected = (new Array(nOver)).fill(0).map((v,i) => v + (nOver * (nOverTimes - 1)) + i);
    for (let i = 0; i < nOver * nOverTimes; i++) {
        // First few (nOver) add normally, then overwriting starts.
        ts.addData(i % nOver, i);
        t.equal(ts.data.length, Math.min(i, nOver));
    }
    t.deepEqual(ts.data, expected);
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
