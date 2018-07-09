import {BinanceAccess} from './binance.mjs';
import {PriceIndicator, MultiEMAIndicator, MACDIndicator} from './indicator.mjs';
import {BackTestBinance, BackTestPriceIndicator} from './backtest';
import {log, LogLevelType} from './log';
import {timeStr} from './utils';

import Big from 'big.js';

(async function main() {
    const backtest = true;

    log.info('Initialising exchange access');
    let binance = null;
    if (backtest) {
        binance = new BackTestBinance(
            Date.parse('17 June 2018 00:00:00 GMT+10'),
            Date.parse('30 June 2018 00:00:00 GMT+10'),
            process.env.NET_REQUEST_TIMEOUT
        );
    } else {
        binance = new BinanceAccess(process.env.NET_REQUEST_TIMEOUT);
    }
    await binance.init();
    log.info('  Binance access initialised.');

    log.level = LogLevelType.info;

    await binance.loadAccount(
        process.env.BINANCEACCOUNT_NAME,
        process.env.BINANCEACCOUNT_KEY,
        process.env.BINANCEACCOUNT_SECRET
    );

    const pair = binance.getCoinPair('XMR', 'BTC');
    const price = await BackTestPriceIndicator.createAndInit(
        binance,
        `BackTestPrice(${pair.symbol})`,
        pair,
        '15m'
    );

    //const nulsbtc = binance.getCoinPair('XMR','BTC');
    //const price = await PriceIndicator.createAndInit(
    //    binance, nulsbtc.symbol, nulsbtc, '15m', 20);
    const multiEma = await MultiEMAIndicator.createAndInit(
        `${price.coinPair.symbol} MultiEMA`, price, [21, 13, 8]);

    log.notify(`Bot online. Tracking ${price.coinPair.symbol} ${price.interval}.`);

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
        `${price.coinPair.symbol} MACD`, price
    );

    macd.addObserver('cross', (time, macd, signal) => {
        log.notify(`MACD Cross. ${timeStr(time)}. macd=${macd.toFixed(8)}. signal=${signal.toFixed(8)}`);

    });

    if (backtest) {
        binance.startBackTest();
        process.exit(0);
    }
})();
