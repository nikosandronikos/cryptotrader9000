import {BinanceAccess} from './binance.mjs';
import {MultiEMAIndicator} from './indicator.mjs';
import {log} from './log';

(async function main() {
    log.info('Initialising exchange access');
    const binance = new BinanceAccess(process.env.NET_REQUEST_TIMEOUT);
    await binance.init();
    log.info('  Binance access initialised.');

    log.notify('Bot online.');

    await binance.loadAccount(
        process.env.BINANCEACCOUNT_NAME,
        process.env.BINANCEACCOUNT_KEY,
        process.env.BINANCEACCOUNT_SECRET
    );

    const nulsbtc = binance.getCoinPair('NULS','BTC');
    // eslint-disable-next-line no-unused-vars
    const multiEma = MultiEMAIndicator.createAndInit(binance, nulsbtc, '1m', [55, 21, 13, 8]);

    const eosbtc = binance.getCoinPair('EOS','BTC');
    // eslint-disable-next-line no-unused-vars
    const eosMultiEma = MultiEMAIndicator.createAndInit(binance, eosbtc, '15m', [55, 21, 13, 8]);
})();
