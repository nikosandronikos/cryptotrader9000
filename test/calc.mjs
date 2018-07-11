import {average, averageGain, averageLoss} from '../src/calc';
import Big from 'big.js';
import test from 'tape';

test('Utils: average', (t) => {
    let result = average([Big(2), Big(2), Big(2)]);
    t.equal(result.eq(Big(2)), true, 'average returns correct result 1');

    result = average([Big(1), Big(2), Big(3)]);
    t.equal(
        result.eq(Big(1).plus(2).plus(3).div(3)),
        true,
        'average returns correct result 2'
    );
    result = average([Big(-12), Big(23), Big(0)]);
    t.equal(
        result.eq(Big(-12).add(23).add(0).div(3)),
        true,
        'average returns correct result 3'
    );
    t.end();
});

test('Utils: averageGain', (t) => {
    let result = averageGain([Big(2),Big(4),Big(9)]);
    t.equal(result.eq(3.5), true, 'Result is correct (1)');

    result = averageGain([Big(2),Big(2),Big(2),Big(2),Big(2)]);
    t.equal(result.eq(0), true, 'Result is correct (2)');

    result = averageGain([Big(2),Big(0),Big(0),Big(0)]);
    t.equal(result.eq(0), true, 'Result is correct (3)');

    result = averageGain([Big(2),Big(0),Big(2)]);
    t.equal(result.eq(1), true, 'Result is correct (4)');

    t.end();
});

test('Utils: averageLoss', (t) => {
    let result = averageLoss([Big(2),Big(4),Big(9)]);
    t.equal(result.eq(0), true, 'Result is correct (1)');

    result = averageLoss([Big(8),Big(6),Big(4),Big(2),Big(0)]);
    t.equal(result.eq(2), true, 'Result is correct (2)');

    result = averageLoss([Big(-2),Big(-4),Big(-5),Big(-6),Big(-6)]);
    t.equal(result.eq(1), true, 'Result is correct (3)');

    t.end();
});
