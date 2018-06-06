import {TimeSeriesData} from '../src/timeseries';
import {EMAIndicator}  from '../src/indicator';
import Big from 'big.js';
import test from 'tape';

test('EMAIndicator: prepHistory', (t) => {
    const interval = '1m';
    const intervalMs = 1 * 60 * 1000;
    let prepHistoryRun = 0;
    let sourceValue = 0;
    const fakeIndicator = {
        interval: interval,
        prepHistory: () => { prepHistoryRun++; },
        addObserver: (evtName, fn) => {
            addObserverRun++;
            t.equal('update', evtName, 'addObserver event name correct');
            sourceObservers.push(fn);
        },
        getAt: (time) => {
            console.log('time', time);
            return Big(sourceValue++);
        },
        latestData: () => time
    };
    const time = 120000;
    const fakeBinance = {
        getTimestamp: () => time
    }
    const ts = new TimeSeriesData('1m');
    const ema = new EMAIndicator(fakeBinance, `emaTest EMA({$n})`, fakeIndicator, 3);

    t.equal(ema._data.hasData, false, 'EMAIndicator has no data');
    const historyStart = 0;
    ema.prepHistory(historyStart).then( () => {
        t.equal(prepHistoryRun, 1, 'prepHistory was called');
        t.equal(ema._data.hasData, true, 'EMAIndicator has data');
        console.log(ema._data.firstData);
        t.equal(ema.earliestData(), historyStart, 'earliestData() matches historyStart');
        t.equal(ema.latestData(), time - intervalMs, 'latestData() matches time, minus one interval');
        t.end();
   });
});

function emaTest(t, prices, expected, n) {
    t.equal(prices.length, expected.length, 'a');

    // Create an EMA indicator, but use constructor rather than factory
    // method so that it doesn't try to get prices from exchange.
    let time = 0;
    const fakeBinance = {
        getTimestamp: () => time
    }
    const ts = new TimeSeriesData('1m');
    const ema = new EMAIndicator(fakeBinance, `emaTest EMA({$n})`, ts, n);
    const intervalMs = 1 * 60 * 1000;
    let i = 0;
    for (const price of prices) {
        time += intervalMs;
        ts.addData(time, Big(price));
        const calcEma = ema._calculate().round(4);
        console.log(calcEma.toString(), expected[i], i);
        t.equal(calcEma.cmp(expected[i++]), 0);
    }

    t.end();
}

test('EMA(9) calculate', (t) => {
    const prices = [
        22.8100,
        23.0900,
        22.9100,
        23.2300,
        22.8300,
        23.0500,
        23.0200,
        23.2900,
        23.4100,
        23.4900,
        24.6000,
        24.6300,
        24.5100,
        23.7300,
        23.3100,
        23.5300,
        23.0600,
        23.2500,
        23.1200,
        22.8000,
        22.8400
    ];
    const expected = [
        22.8100,
        22.8660,
        22.8748,
        22.9458,
        22.9227,
        22.9481,
        22.9625,
        23.0280,
        23.1044,
        23.1815,
        23.4652,
        23.6982,
        23.8605,
        23.8344,
        23.7295,
        23.6896,
        23.5637,
        23.5010,
        23.4248,
        23.2998,
        23.2079
    ];
    emaTest(t, prices, expected, 9);
});

test('EMA(13) calculate', (t) => {
    const prices = [
        8120.0000,
        8122.3100,
        8138.0700,
        8184.1900,
        8255.8400,
        8320.2000,
        8353.5600,
        8350.0100,
        8343.5400,
        8299.8700,
        8325.0000,
        8324.7800,
        8325.0000,
        8320.0000
    ];
    const expected = [
        8120.0000,
        8120.3300,
        8122.8643,
        8131.6251,
        8149.3701,
        8173.7744,
        8199.4580,
        8220.9654,
        8238.4761,
        8247.2467,
        8258.3543,
        8267.8437,
        8276.0089,
        8282.2933
    ];
    emaTest(t, prices, expected, 13);
});

