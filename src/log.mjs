import {TelegramBot} from './telegram.mjs';

const Console = console;

class Log {
    constructor() {
        this.telegram = new TelegramBot();
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


