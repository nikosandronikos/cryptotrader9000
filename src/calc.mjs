import Big from 'big.js';

/**
 * @typedef {any} Any   Any type.
 * @access package
 */

/**
 * @typedef {any} ComparisonType    Any type, but all parameters of this type
 *                                  must be comparable.
 * @access package
 */

/**
 * Given two arrays, with values that can be compared, determine which
 * values 'crossed' from the first to the second.
 * Also determine if the fast and slow (mininum value and maximum value) crossed.
 * For example, for a = [1,2,3,4], and b = [1,3,2,4]. Values 2 and 3 are considered
 * to have crossed as they swapped position.
 * @access package
 *
 * @param {Array<Any>} a      The first array of values.
 * @param {Array<Any>} b      The first array of values.
 * @param {ComparisonType}    fast   The 'fast' value.
 * @param {ComparisonType}    slow   The 'slow' value.
 * @param {function(a:Any): ComparisonType} valueFn   A function for retrieving the
 *                                      comparison value from 'a' and 'b',
 *                                      if they are compound objects and the comparison
 *                                      value is a property.
 *
 * @returns {{fastSlowCross: bool, crossed: Array<Any>}}    An object with
 * properties 'fastSlowCross', which indicates if fast and slow crossed, and
 * the array 'crossed' which contains any elements that crossed, or is empty
 * if no cross occurred.
 *
 * @example
 * const a = [1,2,3,4]
 * const b = [1,4,3,2]
 * const cross = findCross(a, b, 1, 4);
 * console.log(cross); // {fastSlowCross: false, crossed: [4,3,2]
 */
export function findCross(a, b, fast, slow, valueFn=(a)=>a) {
    let firstCross = null;
    let afterCross = null;
    // Assume min and max cross unless we see one of them outside of the
    // cross zone.
    let fastSlowCross = true;

    // Two separate loops seems to be ever so slightly faster.
    for (let r = a.length-1; afterCross === null && r > 0; r--) {
        if (valueFn(a[r]) != valueFn(b[r])) afterCross = r+1;
        else if (valueFn(a[r]) == fast || valueFn(a[r]) == slow) fastSlowCross = false;
    }

    if (afterCross === null) return {fastSlowCross:false, crossed:[]};

    for (let l = 0; firstCross === null && l < afterCross; l++) {
        if (valueFn(a[l]) != valueFn(b[l])) firstCross = l;
        else if (valueFn(a[l]) == fast || valueFn(a[l]) == slow) fastSlowCross = false;
    }

    return {fastSlowCross, crossed:b.slice(firstCross, afterCross)};
}

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
    const d = data.slice();
    let lastV = d.shift();
    const gains = d.reduce((a, v) => {
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
    const d = data.slice();
    let lastV = d.shift();
    const losses = d.reduce((a, v) => {
        a.push(Big(Math.max(lastV.minus(v), 0)));
        lastV = v;
        return a;
    }, []);
    return average(losses);
}

