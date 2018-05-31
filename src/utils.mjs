/* eslint-disable no-fallthrough */

/**
 * @access package
 */
export function intervalToMs(intervalStr, multiplier=1) {
    switch (intervalStr) {
        case 'M':
            throw new Error("Months aren't supported because they are too variable. Sorry.");
        case 'w':
            multiplier *= 7;
        case 'd':
        case 'DAY':
            multiplier *= 24;
        case 'h':
            multiplier *= 60;
        case 'm':
        case 'MINUTE':
            multiplier *= 60;
        case 'SECOND': return 1000 * multiplier;
        default: throw new Error('bad intervalStr');
    }
}

/**
 * A chart interval string is a number followed by a time period.
 * Where time period may be any of:
 * m -> minutes; h -> hours; d -> days; w -> weeks; M -> months
 * @access package
 */
export function chartIntervalToMs(intervalStr) {
    const result = intervalStr.match(/^([\d]+)([mhdwM])$/);
    if (result === null) {
        throw new Error(`${intervalStr} is not a valid intervalStr.`);
    }
    const num = result[1], period = result[2];
    const ms = intervalToMs(period, num);
    return ms;
}

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
 * Return a nicely formatted string for a timestamp.
 * @param {number} timestamp    The timestamp
 * @returns {string}            A string containing a human readable
 *                              representation of timestamp.
 */
export function timeStr(timestamp) {
    return new Date(timestamp).toLocaleString();
}
