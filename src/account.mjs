import {BinanceCommands} from './binance.mjs';

import {Coin} from './coin.mjs';

export class Account {
    constructor(binance, config) {
        this.binance = binance;
        this.name = config.name;
        this.key = config.key;
        this.secret = config.secret;
        this.hodl = new Map();
    }

    async getBalances() {
        const info = await this.binance.apiCommand(
            BinanceCommands.accountInfo,
            {timestamp: this.binance.getTimestamp()},
            this
        );

        for (const coinInfo of info.balances) {
            console.log(coinInfo.asset, coinInfo.free, coinInfo.locked);
            let coin = null;
            if (!this.hodl.has(coinInfo.asset)) {
                coin = new Coin(coinInfo.asset, coinInfo.free, coinInfo.locked);
                this.hodl.set(coinInfo.asset, coin);
            } else {
                coin = this.hodl.get(coinInfo.asset);
                coin.free = coinInfo.free;
                coin.locked = coinInfo.locked;
            }
        }
    }
}
