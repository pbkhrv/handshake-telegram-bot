const bsock = require('bsock');
const {Network, ChainEntry, Covenant, Rules} = require('hsd');
const {types} = Rules;
const {NodeClient} = require('hs-client')
const network = Network.get('main');
const {TelegramBot} = require('./telegram');
const {HandshakeQuery} = require('./handshake');
const {TelegramAlertManager} = require('./alerts');
const db = require('./db');

const telegramBotApiKey = process.env.TELEGRAM_BOT_API_KEY;
if (!telegramBotApiKey) {
  console.error('TELEGRAM_BOT_API_KEY environment variable is empty.');
  process.exit(1);
}

const hsdHost = process.env.HSD_HOST || 'localhost';
let hsdPort = process.env.HSD_PORT;
if (hsdPort) {
  hsdPort = parseInt(hsdPort);
} else {
  hsdPort = network.rpcPort;
}
const hsdApiKey = process.env.HSD_API_KEY || null;

// Init db
db.init('sqlite:/tmp/hnsbot.db');

const handshakeQuery = new HandshakeQuery(hsdHost, hsdPort, hsdApiKey);

const alertManager = new TelegramAlertManager(handshakeQuery);

const telegramBot =
    new TelegramBot(telegramBotApiKey, handshakeQuery, alertManager);

alertManager.start();
telegramBot.start();
handshakeQuery.start();