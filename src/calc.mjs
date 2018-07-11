import Big from 'big.js';

/**
 * Calculate the average for an array of values.
 * @param {Big[]}   data        The data to average.
 * @return {Big}    The computed average.
 */
export function average(data) {
    let sum = Big(0);
    data.forEach(v => sum = sum.add(v));
    return sum.div(data.length);
}

/**
 * Calculate the average gain across a set of values.
 * The average gain is the increase from one value to the next. Decreases
 * from one value to the next are treated as 'no increase' (i.e. 0), but
 * are included in the average.
 * @param {Big[]}   data        Numeric data for which the average gain is
 *                              calculated.
 * @return {Big}    The computed average gain.
 */
export function averageGain(data) {
    let lastV = data.shift();
    const gains = data.reduce((a, v) => {
        a.push(Big(Math.max(v.minus(lastV), 0)));
        lastV = v;
        return a;
    }, []);
    return average(gains);
}

/**
 * Calculate the average loss across a set of values.
 * The average loss is the decrease from one value to the next. Increases
 * from one value to the next are treated as 'no decrease' (i.e. 0), but
 * are included in the average.
 * The average loss is a positive value.
 * @param {Big[]}   data        Numeric data for which the average losses is
 *                              calculated.
 * @return {Big}    The computed average loss.
 */
export function averageLoss(data) {
    let lastV = data.shift();
    const losses = data.reduce((a, v) => {
        a.push(Big(Math.max(lastV.minus(v), 0)));
        lastV = v;
        return a;
    }, []);
    return average(losses);
}

