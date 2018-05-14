import {TelegramBot} from './telegram.mjs';

const Console = console;

/**
 * Options for differing verbosity of log output.
 */
export const LogLevelType = {
    none:   0,
    error:  1,
    notify: 2,
    info:   4,
    debug:  8
}

/**
 * @access package
 */
class Log {
    constructor() {
        /**
         * Set to a value from {@link LogLevel} to set the verbosity of output.
         */
        this.level = LogLevelType.debug;

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
        if (this.level < LogLevelType.error) return;
        if (this.telegram) this.telegram.message(args.join(' '));
        Console.log(...args);
    }

    notify(...args) {
        if (this.level < LogLevelType.notify) return;
        if (this.telegram) this.telegram.message(args.join(' '));
        Console.log(...args);
    }

    info(...args) {
        if (this.level < LogLevelType.info) return;
        Console.log(...args);
    }

    debug(...args) {
        if (this.level < LogLevelType.debug) return;
        Console.log(...args);
    }
}

export const log = new Log();


