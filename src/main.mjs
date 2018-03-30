import axios from 'axios';
import https from 'https';

import {BinanceAccess, BinanceCommands} from './binance.mjs';

import {config} from './config.mjs';

(async function main() {
    const binance = new BinanceAccess();

    await binance.init();
    console.log('Binance access initialised.');

    await binance.loadAccount(config.accounts[0]);
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
