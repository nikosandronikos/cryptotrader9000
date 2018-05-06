import {TelegramBot} from './telegram.mjs';

const Console = console;

/**
 * @access package
 */
class Log {
    constructor() {
        if (process.env.TELEGRAM_KEY !== undefined
            &&
            process.env.TELEGRAM_CHANNEL !== undefined
        ) {
            this.telegram = new TelegramBot(
                process.env.TELEGRAM_KEY,
                process.env.TELEGRAM_CHANNEL,
                process.env.NET_REQUEST_TIMEOUT || 3000
            );
        }
    }

    error(message) {
        if (this.telegram) this.telegram.message(message);
        Console.log(message);
    }

    notify(message) {
        if (this.telegram) this.telegram.message(message);
        Console.log(message);
    }

    info(message) {
        Console.log(message);
    }

    debug(message) {
        Console.log(message);
    }
}

export const log = new Log();


