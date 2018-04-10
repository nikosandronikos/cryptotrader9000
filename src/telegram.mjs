import axios from 'axios';

import {config} from './config.mjs';

export class TelegramBot {
    constructor() {
        this.key = config.telegram.key;
        this.base = 'https://api.telegram.org/bot';
        this._axiosInst = axios.create({
            baseURL: this.base,
            timeout: config.timeout
        });

    }

    async message(m) {
        const url = `${this.base}${this.key}/sendMessage`;
        const cfg = {
            params: {
                chat_id: config.telegram.channel,
                text: m,
                disable_notification: true
            }
        }

        return this._axiosInst.get(url, cfg)
            .then(response => {
                console.log(
                    `${url} returned ${response.statusText} `+
                    `(${response.status})`+
                    `${response.data}`
                );
                return response.data;
            })
            .catch(err => {
                console.log(`${url} returned error.`);
                if (err.response) {
                    console.log('response:', err.response.data);
                    console.log(err.response.status);
                    //console.log(err.response.headers);
                } else if (err.request) {
                    // The request was made but no response received.
                    console.log('No response');
                    console.log(err.request);
                } else {
                    console.log('Error', err.message);
                }
                throw err;
            });
    }
}