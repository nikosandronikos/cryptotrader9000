import {BinanceCommands} from './binance.mjs';
import {config} from './config.mjs';

export class CoinPair {
    constructor(binanceAccess, base, quote, info) {
        this._binance = binanceAccess;
        this.symbol = `${base}${quote}`;

        console.log(info);

        if (info.status != 'TRADING') throw `CoinPair ${this.symbol} not trading.`;

        for (const filter of info.filters) {
            switch (filter.filterType) {
                case 'PRICE_FILTER':
                    this.priceFilter = filter;
                    break;
                case 'LOT_SIZE':
                    this.lotSizeFilter = filter;
                    break;
                case 'MIN_NOTIONAL':
                    this.minNotionalFilter = filter;
                    break;
                default: throw `${base}${quote} contains unknown filter.`;
            }
        }
    }

    async loadPriceData() {
        // FIXME: Need to do something with this.
        const klines = await this._binance.apiCommand(BinanceCommands.klines, {
            symbol: this.symbol,
            interval: '1d',
            limit: 2
        });
        console.log(klines);
    }

    static async createAndLoadPriceData(binanceAccess, base, quote, info) {
        const cp = new CoinPair(binanceAccess, base, quote, info);
        await cp.loadPriceData();
        return cp;
    }
}

