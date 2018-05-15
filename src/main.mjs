import {BinanceAccess} from './binance.mjs';
import {MultiEMAIndicator} from './indicator.mjs';
import {log, LogLevelType} from './log';

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

    const nulsbtc = binance.getCoinPair('NULS','BTC');
    const multiEma = await MultiEMAIndicator.createAndInit(binance, nulsbtc, '5m', [21, 13, 8]);

    log.notify(`Bot online. Tracking ${multiEma.coinPair.symbol} ${multiEma.interval}.`);

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
            multiEma.coinPair.symbol, multiEma.interval,
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
        }
        log.notify(...message);
    });
    multiEma.addObserver('cross', function() {log.debug('Cross');});
    multiEma.addObserver('update', function() {log.debug('Got MultiEMA update');});
})();
