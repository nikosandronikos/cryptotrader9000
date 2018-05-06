import {BinanceCommands} from './binance.mjs';
import {log} from './log';

/**
 * A representation of a coin and value held in that coin.
 * @access public
 */
export class Coin {
    /**
     * @param {string} name         The name of the coin.
     * @param {number} initialFree  The initial amount of free, or available
     *                              value of the coin.
     * @param {number} initialLocked The initial amount of locked, or
     *                              un-available value of the coin.
     */
    constructor(name, initialFree=0, initialLocked=0) {
        this.name = name;
        /**
         * A quantity of this coin that is available for trading.
         */
        this.free = initialFree;
        /**
         * A quantity of this coin that is un-available for trading,
         * usually because it is locked up in existing trades that are
         * on the order book.
         */
        this.locked = initialLocked;
    }
}

/**
 * A pair of coins that are traded against one another.
 * E.g. BTCETH (Bitcoin / Ethereum).
 * @access public
 */
export class CoinPair {
    /**
     * @param {BinanceAccess} binanceAccess To be removed
     * @param {string} base     The code representing the base coin.
     * @param {string} quote    The code representing the coin which
     *                          base is traded against.
     * @param {object} info     The coin information obtained from Binance
     *                          via BinanceCommands.exchangeInfo.
     * @throws {Error}          If trading is disabled on the exchange.
     */
    constructor(binanceAccess, base, quote, info) {
        this._binance = binanceAccess;
        /**
         * The symbol used to represent the coin pair.
         */
        this.symbol = `${base}${quote}`;

        log.debug(info);

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
}

