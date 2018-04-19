import {BinanceAccess} from './binance.mjs';
import {MultiEMAIndicator} from './indicator.mjs';
import {log} from './log';
import {config} from './config.mjs';

(async function main() {
    log.info('Initialising exchange access');
    const binance = new BinanceAccess();
    await binance.init();
    log.info('  Binance access initialised.');

    log.notify('Bot online.');

    await binance.loadAccount(config.accounts[0]);

    log.debug(binance.coinPairs);
    const nulsbtc = binance.coinPairs.get('NULS').get('BTC');
    // eslint-disable-next-line no-unused-vars
    const multiEma = MultiEMAIndicator.createAndInit(binance, nulsbtc, '1m', [55, 21, 13, 8]);

    const eosbtc = binance.coinPairs.get('EOS').get('BTC');
    // eslint-disable-next-line no-unused-vars
    const eosMultiEma = MultiEMAIndicator.createAndInit(binance, eosbtc, '15m', [55, 21, 13, 8]);
})();
