import {TelegramBot} from './telegram.mjs';

class Log {
    constructor() {
        //this.telegram = new TelegramBot();
    }

    error(message) {
        if (this.telegram) this.telegram.message(message);
        console.log(message)
    }

    notify(message) {
        if (this.telegram) this.telegram.message(message);
        console.log(message)
    }

    info(message) {
        //console.log(message)
    }

    debug(message) {
        //console.log(message)
    }
}

export const log = new Log();


