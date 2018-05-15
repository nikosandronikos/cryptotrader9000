# cryptotrader9000
A very basic rule based trading bot for Binance. For fun, not profit.

# Setting up and running the test bot

1. `git clone https://github.com/nikosandronikos/cryptotrader9000.git`

2. Install dependencies with
```npm install``` or ```npm install --production```

3. Set environment variables (see [Environment Variables](#Environment Variables))

3. Run the test bot with
```npm start```

**Note** *, if running nodejs directly rather than via the '`npm start`'
command, the '`--experimental-modules`' flag is required to enable ES6
module support in NodeJS.*

### Environment Variables
The following environment variables are required. They may be configured in
a '.env' file or within the OS environment:
- BINANCEACCOUNT_NAME; A human readable name for the account
- BINANCEACCOUNT_KEY; The account key from Binance
- BINANCEACCOUNT_SECRET; The account key secret from Binance
- TELEGRAM_KEY; (optional) A key for a telegram bot
- TELEGRAM_CHANNEL; (optional) The telegram channel to send messages to

# Using the library
*There is currently no mechanism to simply import this as a library into your
own packages. In the future this module will be available via NPM.*

The initial entry point is the [BinanceAccess](https://nikosandronikos.github.io/cryptotrader9000/class/src/binance.mjs~BinanceAccess.html) class.

Full documentation is available at:
https://nikosandronikos.github.io/cryptotrader9000/

Note that esdoc doesn't like the method used to mixin ObservableMixin to other
classes. This results in blank documentation for any class using ObservableMixin.
Sorry! You'll just have to look at the source for now.

# Tests
[![Build Status](https://travis-ci.org/nikosandronikos/cryptotrader9000.svg?branch=master)](https://travis-ci.org/nikosandronikos/cryptotrader9000)

Run the tests with
```npm test```

