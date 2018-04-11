export function intervalToMs(intervalStr, multiplier=1) {
    switch (intervalStr) {
        case 'M':
            throw `Months aren't supported because they are too variable. Sorry.`;
            return NaN;
        case 'w':
            multiplier *= 7;
        case 'd':
        case 'DAY': return 24 * 60 * 60 * 1000 * multiplier;
            multiplier *= 24;
        case 'h':
            multiplier *= 60;
        case 'm':
        case 'MINUTE':
            multiplier *= 60;
        case 'SECOND': return 1000 * multiplier;
        default: throw new Error('bad intervalStr');
    }
    return NaN;
}

// A chart interval string is a number followed by a time period.
// Where time period may be any of:
//   m -> minutes; h -> hours; d -> days; w -> weeks; M -> months
export function chartIntervalToMs(intervalStr) {
    const result = intervalStr.match(/^([\d]+)([mhdwM])$/);
    if (result === null) {
        throw new Error(`${intervalStr} is not a valid intervalStr.`);
        return NaN;
    }
    const num = result[1], period = result[2];
    const ms = intervalToMs(period, num);
    console.log('intervalStr', num, period, ms);
    return ms;
}
