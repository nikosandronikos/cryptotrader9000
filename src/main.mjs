import {BinanceAccess} from './binance.mjs';
import {PriceIndicator, MultiEMAIndicator, MACDIndicator} from './indicator.mjs';
import {log, LogLevelType} from './log';
import {timeStr} from './utils';

import Big from 'big.js';

(async function main() {
    log.info('Initialising exchange access');
    const binance = new BinanceAccess(process.env.NET_REQUEST_TIMEOUT);
    await binance.init();
    log.info('  Binance access initialised.');

    log.level = LogLevelType.info;

    await binance.loadAccount(
        process.env.BINANCEACCOUNT_NAME,
        process.env.BINANCEACCOUNT_KEY,
        process.env.BINANCEACCOUNT_SECRET
    );
    const nulsbtc = binance.getCoinPair('XMR','BTC');
    const nulsbtcPrice = await PriceIndicator.createAndInit(
        binance, nulsbtc.symbol, nulsbtc, '15m', 20);
    const multiEma = await MultiEMAIndicator.createAndInit(
        binance, `${nulsbtc.symbol} MultiEMA`, nulsbtcPrice, [21, 13, 8]);

    log.notify(`Bot online. Tracking ${nulsbtc.symbol} ${nulsbtcPrice.interval}.`);

    let buyAt = null;
    let cumulative = new Big(0);

    // Possibly the world's simplest trading strategy.
    // Buy when The fast and slow EMA cross and sell when they cross again.
    multiEma.addObserver('fastSlowCross', (crossed, time, price) => {
        const message = [];
        const signal =
            crossed.findIndex((e) => e.nPeriods == multiEma.slow)
            <
            crossed.findIndex((e) => e.nPeriods == multiEma.fast)
                ? 'sell' : 'buy';
        message.push(
            multiEma.name, multiEma.interval,
            'Fast and slow EMA cross.',
            `Signal: ${signal}.`,
            `Price: ${price.toString()}.`
        );
        if (signal == 'buy') {
            buyAt = price;
        } else if (buyAt != null) {
            const diff = price.sub(buyAt);
            cumulative = cumulative.plus(diff);
            message.push(
                'Sold. Buy/sell difference: ', diff.toString(),
                '. Cumulative gain:', cumulative.toString()
            );
            buyAt = null;
        }
        log.notify(...message);
    });
    multiEma.addObserver('cross', (crossed, time, price) => {
        //if (buyAt == null) return;
        //const signal =
        //    crossed.findIndex((e) => e.nPeriods == 
    });
    multiEma.addObserver('update', function() {log.debug('Got MultiEMA update');});

    const macd = await MACDIndicator.createAndInit(
        binance, `${nulsbtc.symbol} MACD`, nulsbtcPrice
    );

    macd.addObserver('cross', (time, macd, signal) => {
        log.notify(`MACD Cross. ${timeStr(time)}. macd=${macd.toFixed(8)}. signal=${signal.toFixed(8)}`);

    });
})();
