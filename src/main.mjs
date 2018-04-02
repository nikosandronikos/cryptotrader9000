import axios from 'axios';
import https from 'https';

import {BinanceAccess, BinanceCommands} from './binance.mjs';
import {StreamManager, BinanceStreams} from './datastream.mjs';
import {config} from './config.mjs';

(async function main() {
    const binance = new BinanceAccess();

    await binance.init();
    console.log('Binance access initialised.');

    await binance.loadAccount(config.accounts[0]);

    await binance.streams.openStream(
        BinanceStreams.klines,
        {symbol: 'nulsbtc', interval: '1m'},
        (data) => {
            const time = new Date(data.E).toLocaleString();
            console.log(`nulsbtc 1m klines: ${time} ${data.k.c}`);
        }
    );
    await binance.streams.openStream(
        BinanceStreams.ticker,
        {symbol: 'nulsbtc'},
        (data) => {
            const time = new Date(data.E).toLocaleString();
            console.log(`nulsbtc ticker: ${time} ${data.c}`);
        }
    );
})();

/*
https.get(
    `${binanceBase}api/v1/time`,
    res => {
        res.setEncoding('utf8');
        let body = "";
        res.on('data', data=> {
            body += data;
        });
        res.on('end', () => {
            body = JSON.parse(body);
            console.log(body);
        });
    });
);
*/
