import {intervalToMs, chartIntervalToMs}  from '../src/utils';
import test from 'tape';

test('intervalToMs', (t) => {

    t.throws(() => intervalToMs('M'), Error);

    t.equal(intervalToMs('w', 1), 1000 * 60 * 60 * 24 * 7);
    t.equal(intervalToMs('w', 2), 2 * 1000 * 60 * 60 * 24 * 7);

    t.equal(intervalToMs('d', 1), 1000 * 60 * 60 * 24);
    t.equal(intervalToMs('DAY', 1), 1000 * 60 * 60 * 24);
    t.equal(intervalToMs('d', 0.5), 0.5 * 1000 * 60 * 60 * 24);

    t.equal(intervalToMs('h'), 1000 * 60 * 60);
    t.equal(intervalToMs('h', 1), 1000 * 60 * 60);

    t.equal(intervalToMs('m', 8), 8 * 1000 * 60);
    t.equal(intervalToMs('MINUTE', 62768), 62768 * 1000 * 60);
    t.equal(intervalToMs('MINUTE'), 1000 * 60);

    t.equal(intervalToMs('SECOND'), 1000);
    t.equal(intervalToMs('SECOND', 7), 7000);

    t.throws(() => intervalToMs('ILoveLego', 1), Error);
    t.end();
});

test('chartIntervalToMs', (t) => {
    t.throws(() => chartIntervalToMs(''), Error);
    t.throws(() => chartIntervalToMs('ItsLegoNotLegos'), Error);
    t.throws(() => chartIntervalToMs('m3'), Error);
    t.throws(() => chartIntervalToMs(' 1m'), Error);
    t.throws(() => chartIntervalToMs('1m '), Error);
    t.throws(() => chartIntervalToMs('1mm'), Error);
    t.throws(() => chartIntervalToMs('1m4w'), Error);
    t.throws(() => chartIntervalToMs('1D'), Error);
    t.throws(() => chartIntervalToMs('1H'), Error);
    t.throws(() => chartIntervalToMs('1W'), Error);
    t.throws(() => chartIntervalToMs('0.5d'), Error);

    t.equal(chartIntervalToMs('1m'), 1000 * 60);
    t.equal(chartIntervalToMs('1h'), 1000 * 60 * 60);
    t.equal(chartIntervalToMs('1d'), 1000 * 60 * 60 * 24);
    t.equal(chartIntervalToMs('1w'), 1000 * 60 * 60 * 24 * 7);

    t.equal(chartIntervalToMs('10m'), 10 * 1000 * 60);
    t.equal(chartIntervalToMs('100h'), 100 * 1000 * 60 * 60);
    t.equal(chartIntervalToMs('1000d'), 1000 * 1000 * 60 * 60 * 24);
    t.equal(chartIntervalToMs('10000w'), 10000 * 1000 * 60 * 60 * 24 * 7);

    t.end();
});


