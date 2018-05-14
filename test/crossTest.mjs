import {findCross}  from '../src/utils';
import test from 'tape';


test('findCross', (t) => {
    const a = [1,2,3,4];
    const b = [2,1,3,4];
    const c = [2,3,1,4];
    const d = [3,2,1,4];
    const e = [3,2,4,1];
    const f = [4,3,2,1];
    const g = [1,4,3,2];

    t.deepEqual(findCross(a, a, 1, 4), {fastSlowCross:false, crossed:[]});
    t.deepEqual(findCross(a, b, 1, 4), {fastSlowCross:false, crossed:[2,1]});
    t.deepEqual(findCross(a, c, 1, 4), {fastSlowCross:false, crossed:[2,3,1]});
    t.deepEqual(findCross(a, d, 1, 4), {fastSlowCross:false, crossed:[3,2,1]});
    t.deepEqual(findCross(b, c, 1, 4), {fastSlowCross:false, crossed:[3,1]});
    t.deepEqual(findCross(d, e, 1, 4), {fastSlowCross:true, crossed:[4,1]});
    t.deepEqual(findCross(a, f, 1, 4), {fastSlowCross:true, crossed:[4,3,2,1]});

    t.end();
});
