# Handshake (HNS) Telegram bot

This is a Telegram bot that can answer queries about the [Handshake blockchain](https://handshake.org) and deliver alerts related to Handshake name auctions.

Handshake is an experimental peer-to-peer root naming system that allows you to register and manage top-level domain names on a blockchain, and transact in its native cryptocurrency.

You can talk to the public instance of this bot called ["Handshake Bot" `@handshakehns_bot` on Telegram](https://t.me/handshakehns_bot), or you can [run your own](https://core.telegram.org/bots#3-how-do-i-create-a-bot) and talk to it.

## It's a proof of concept

It does what it says on the tin, BUT the code is not very good - it was thrown together rather quickly. You've been warned.

## How to run it

### Requirements

- `hsd`: the bot needs to connect to a [Handshake node](https://github.com/https://github.com/handshake-org/hsd) to access the blockchain. `hsd` doesn't have to be running on the same computer, but the bot needs to be able to connect the `hsd` http RPC port.
- Node.js and npm: make sure you have Node.js version 14 or higher installed.
- Telegram bot API key that you can get by [talking to Telegram's BotFather](https://core.telegram.org/bots#3-how-do-i-create-a-bot)
 
### Install dependencies

Fork the repo, install dependencies and verify

```
npm install 
npm run test
```

### Configure the bot

Currently, the bot can only be configured by setting environment variables (command line options are [on the todo list](#10)).

You *must* set the following environment variables before running it:
- `TELEGRAM_BOT_API_KEY`: this is the API key that you get from Telegram's BotFather [when you create your bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot)
- `SQLITE_FILE_PATH`: path to the SQLite database file. If you don't want to persist any of the data and store everything in memory only, use `:memory:`.

Optional environment variables:
- `HSD_NETWORK`: name of the Handshake network to use. Default is `main`
- `HSD_HOST`: host name or IP address that bot uses to connect to the `hsd` http RPC endpoint. Default is `localhost`
- `HSD_PORT`: port number of `hsd` http RPC endpoint. Default value depends on the [selected Handshake network](https://hsd-dev.org/guides/config.html), most likely `12037`.

### Run it

```
node src/app.js
```