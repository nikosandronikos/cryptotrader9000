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

    error(...args) {
        if (this.telegram) this.telegram.message(args.join(' '));
        Console.log(...args);
    }

    notify(...args) {
        if (this.telegram) this.telegram.message(args.join(' '));
        Console.log(...args);
    }

    info(...args) {
        Console.log(...args);
    }

    debug(...args) {
        Console.log(...args);
    }
}

export const log = new Log();


