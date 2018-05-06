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
