import {BinanceAccess} from './binance.mjs';
import {MultiEMAIndicator} from './indicator.mjs';
import {log} from './log';
import {config} from './config.mjs';

(async function main() {
    log.info('Initialising exchange access');
    const binance = new BinanceAccess(config);
    await binance.init();
    log.info('  Binance access initialised.');

    log.notify('Bot online.');

    const accountInfo = config.accounts[0];
    await binance.loadAccount(accountInfo.name, accountInfo.key, accountInfo.secret);

    const nulsbtc = binance.getCoinPair('NULS','BTC');
    // eslint-disable-next-line no-unused-vars
    const multiEma = MultiEMAIndicator.createAndInit(binance, nulsbtc, '1m', [55, 21, 13, 8]);

    const eosbtc = binance.getCoinPair('EOS','BTC');
    // eslint-disable-next-line no-unused-vars
    const eosMultiEma = MultiEMAIndicator.createAndInit(binance, eosbtc, '15m', [55, 21, 13, 8]);
})();
