import {BinanceCommands} from './binance.mjs';
import {Coin} from './coin.mjs';
import {log} from './log';

/**
 * @access Public
 */
export class Account {
    constructor(binance, name, key, secret) {
        // BinanceAccess instance.
        this.binance = binance;
        // A human readable name used to identify this account.
        this.name = name;
        // The accounts Binance API key.
        this.key = key;
        // The accounts Binance API key secret.
        this.secret = secret;
        // A map of coin name => Coin object pairs, initially populated
        // with all coins with a non zero balance.
        this.hodl = new Map();
    }

    async syncBalances() {
        const info = await this.binance.apiCommand(
            BinanceCommands.accountInfo,
            {timestamp: this.binance.getTimestamp()},
            this.name
        );

        for (const coinInfo of info.balances) {
            const free = parseFloat(coinInfo.free);
            const locked = parseFloat(coinInfo.locked);

            if (free === 0.0 && locked === 0.0) continue;
            log.debug(coinInfo.asset, free, locked);
            let coin = null;
            if (!this.hodl.has(coinInfo.asset)) {
                coin = new Coin(coinInfo.asset, free, locked);
                this.hodl.set(coinInfo.asset, coin);
            } else {
                // If an entry already exists for this coin, the
                // balances are over-written.
                coin = this.hodl.get(coinInfo.asset);
                coin.free = free;
                coin.locked = locked;
            }
        }
    }
}
