import {TelegramBot} from './telegram.mjs';

const Console = console;

/**
 * Options for differing verbosity of log output.
 * @package
 */
export const LogLevelType = {
    none:   0,
    error:  1,
    notify: 2,
    info:   4,
    debug:  8
}

/**
 * @protected
 */
class Log {
    /**
     * Create a logger.
     * If TELEGRAM_KEY and TELEGRAM_CHANNEL environment variables are set,
     * then a Telegram bot will be instantiated for output for some log
     * verbosity levels.
     */
    constructor() {
        /**
         * Set to a value from {@link LogLevelType} to set the verbosity of output.
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

    /**
     * Output information about an error.
     * Will write to the Telegram bot if configured.
     * @param {...(string|number|object|bool)} args
     *                                  Any number of objects to output. The
     *                                  string represented will be concateanted
     *                                  with a space character.
     */
    error(...args) {
        if (this.level < LogLevelType.error) return;
        if (this.telegram) this.telegram.message(args.join(' '));
        Console.log(...args);
    }

    /**
     * Output notification information. Notifications are considered to be
     * of higher importance than informative output.
     * Will write to the Telegram bot if configured.
     * @param {...(string|number|object|bool)} args
     *                                  Any number of objects to output. The
     *                                  string represented will be concateanted
     *                                  with a space character.
     */
    notify(...args) {
        if (this.level < LogLevelType.notify) return;
        if (this.telegram) this.telegram.message(args.join(' '));
        Console.log(...args);
    }

    /**
     * Output an informative message. Considered to be less important than
     * notifications.
     * @param {...(string|number|object|bool)} args
     *                                  Any number of objects to output. The
     *                                  string represented will be concateanted
     *                                  with a space character.
     */
    info(...args) {
        if (this.level < LogLevelType.info) return;
        Console.log(...args);
    }

    /**
     * Output debug information.
     * @param {...(string|number|object|bool)} args
     *                                  Any number of objects to output. The
     *                                  string represented will be concateanted
     *                                  with a space character.
     */
    debug(...args) {
        if (this.level < LogLevelType.debug) return;
        Console.log(...args);
    }
}

/**
 * An instance of the Log for use within the package.
 * @package
 */
export const log = new Log();


