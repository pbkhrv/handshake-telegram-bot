const {states} = require('hsd/lib/covenants/namestate');
const {util} = require('hsd');
const Slimbot = require('slimbot');
const {InvalidNameError, encodeName, decodeName} = require('./handshake');
const {nameAvails, calculateNameAvail, nsMilestones} = require('./namestate');
const {TelegramAlertManager, events: alertEvents} = require('./alerts');
const nacs = require('./nameactions');


/*
 * Handle all interactions with Telegram
 */
class TelegramBot {
  /**
   * Constructor.
   *
   * @param {string} botToken - telegram bot token
   * @param {HandshakeQuery} hnsQuery
   * @param {TelegramAlertManager} alertManager
   */
  constructor(botToken, hnsQuery, alertManager) {
    /**
     * @type {Slimbot}
     */
    this.slimbot = new Slimbot(botToken);

    /**
     * @type {HandshakeQuery}
     */
    this.hnsQuery = hnsQuery;

    /**
     * @type {TelegramAlertManager}
     */
    this.alertManager = alertManager;

    this.incompleteCommands = {};
    this.blockHeightAlerts = [];
  }

  /**
   * Setup callbacks and start the bot
   */
  start() {
    console.log('Starting bot');
    this.slimbot.on('message', async (message) => this.onMessage(message));
    this.slimbot.on(
        'edited_message', async (message) => this.onMessage(message));
    this.slimbot.on(
        'callback_query', async (query) => this.onCallbackQuery(query));
    this.slimbot.startPolling();
    this.hnsQuery.on(
        'new_block',
        async (newBlock) =>
            this.processBlockHeightAlerts(newBlock.blockHeight));
    this.alertManager.on(
        alertEvents.TELEGRAM_NAME_ALERT_TRIGGER,
        async (evt) => this.deliverNameAlert(evt));
  }

  /**
   * Process incoming telegram message
   *
   * @param {Object} message - incoming message
   */
  async onMessage(message) {
    console.log('Bot received message from chat id', message.chat.id);
    console.log(message);
    const newCmd = parseCommandMessage(message);
    const cmd = this.buildCurrentCommand(message.chat.id, newCmd);

    switch (cmd.command) {
      case '/start':
      case '/help':
        await this.sendGreeting(message.chat.id);
        break;

      case '/name':
        await this.processNameCommand(message.chat.id, cmd);
        break;

      case '/nextblock':
        await this.createNextBlockAlert(message.chat.id);
        break;

      // Assuming "/name"
      case 'no_command':
        cmd.args = cmd.text;
        await this.processNameCommand(message.chat.id, cmd);
        break;

      default:
        await this.sendUnknownCommandNotice(message.chat.id);
    }
  }

  async onCallbackQuery(query) {
    if (!query) {
      console.log('Got empty callback_query, exiting');
      return;
    }

    console.log('RECEIVED CALLBACK QUERY', query);

    const queryId = query.id;
    if (!queryId) {
      console.log('Got empty query id in callback_query, exiting');
      return;
    }

    // TODO: refactor, this is badwrong
    const data = query.data;
    if (!data) {
      console.log('cbQuery: data is empty');
      await this.slimbot.answerCallbackQuery(
          queryId, {text: 'Something went wrong...'});
      return;
    }

    const message = query.message;
    const chatId = message?.chat?.id || query.chat_instance;
    if (!chatId) {
      console.log('cbQuery: chatId is empty');
      await this.slimbot.answerCallbackQuery(
          queryId, {text: 'Something went wrong...'});
      return;
    }

    const queryArgs = data.split('|');

    switch (queryArgs[0]) {
      // TODO: refactor this into a "toggle name alert" command instead of
      // create/delete Create name alert
      case 'cna': {
        const encodedName = queryArgs[1];
        if (!encodedName) {
          console.log('cbQuery: cna command without param');
          await this.slimbot.answerCallbackQuery(
              queryId, {text: 'Something went wrong...'});
          return;
        }

        await this.alertManager.createNameAlert(chatId, encodedName);
        await this.slimbot.answerCallbackQuery(
            queryId, {text: `Created alert for the name '${encodedName}'`});
        if (message?.message_id) {
          await this.slimbot.editMessageReplyMarkup(
              chatId, message.message_id,
              JSON.stringify(nameAlertInlineKeyboard(encodedName, true)));
        }
        break;
      }

      // Delete name alert
      case 'dna': {
        const encodedName = queryArgs[1];
        if (!encodedName) {
          console.log('cbQuery: dna command without param');
          await this.slimbot.answerCallbackQuery(
              queryId, {text: 'Something went wrong...'});
          return;
        }
        await this.alertManager.deleteNameAlert(chatId, encodedName);
        await this.slimbot.answerCallbackQuery(
            queryId, {text: `Deleted alert for the name '${encodedName}'`});
        if (message?.message_id) {
          await this.slimbot.editMessageReplyMarkup(
              chatId, message.message_id,
              JSON.stringify(nameAlertInlineKeyboard(encodedName, false)));
        }
        break;
      }

      // Unknown command
      default:
        console.log(`cbQuery: unknown command '${data}'`);
        await this.slimbot.answerCallbackQuery(
            queryId, {text: 'Something went wrong...'});
        return;
    }
  }

  /**
   * Use the new command and optional previously sent incomplete command
   * to figure out the current command that needs to be processed
   *
   * @param {string} chatId - telegram chat id where this command came from
   * @param {Object} newCmd - latest command sent to us from this chat id
   * @returns {Object}
   */
  buildCurrentCommand(chatId, newCmd) {
    const prevCmd = this.incompleteCommands[chatId];

    // If we need the command to be continued, it'll be handled by the
    // command-specific logic.
    delete this.incompleteCommands[chatId];

    // We might have asked user for more input for previously entered command
    // That flow should continue unless user just sent us a new command
    if (prevCmd && newCmd.command == 'no_command') {
      prevCmd.args = newCmd.text;
      return prevCmd;
    }

    return newCmd;
  }

  /**
   * Handle a possibly incomplete "lookup name" command
   *
   * @param {string} chatId - telegram chat id to respond to
   * @param {Object} cmd - command to be processed
   */
  async processNameCommand(chatId, cmd) {
    let name = cmd.args?.toLowerCase();

    // If command is incomplete, ask for more information
    if (!name) {
      // Store the current command to be completed when the next message comes
      this.incompleteCommands[chatId] = cmd;
      await this.slimbot.sendMessage(
          chatId, 'What name would you like me to lookup?')
      return;
    }

    try {
      const encodedName = encodeName(name);
      const nameInfo = await this.hnsQuery.getNameInfo(encodedName);
      const nameState = calculateNameAvail(nameInfo);
      const existsAlert =
          await this.alertManager.checkExistsNameAlert(chatId, encodedName);

      const text = formatNameInfoMarkdown(
          name, encodedName, nameState, nameInfo, existsAlert);

      const tgParams = {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup:
            JSON.stringify(nameAlertInlineKeyboard(encodedName, existsAlert))
      };

      await this.slimbot.sendMessage(chatId, text, tgParams);
    } catch (e) {
      if (e instanceof InvalidNameError) {
        // Notify user if name is invalid
        await this.slimbot.sendMessage(
            chatId, `I'm sorry, but "${name}" is not a valid Handshake name`);
        return;
      } else {
        // Some general error - make this better
        console.log(e);
        await this.slimbot.sendMessage(
            'An error occurred while querying the name...');
        return;
      }
    }
  }

  /**
   * Format and deliver the name alert
   * @param {TelegramNameAlertTriggerEvent} evt
   */
  async deliverNameAlert(evt) {
    const text = formatNameAlertMarkdown(
        evt.encodedName, evt.blockHeightTriggers, evt.nameActions);

    const tgParams = {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
      reply_markup: JSON.stringify(nameAlertInlineKeyboard(encodedName, true))
    };

    await this.slimbot.sendMessage(evt.chatId, text, tgParams);
  }


  /**
   *
   * @param {number} chatId
   */
  async createNextBlockAlert(chatId) {
    const bcInfo = await this.hnsQuery.getBlockchainInfo();
    const blockHeight = bcInfo.blocks;

    const blockHash = bcInfo.bestblockhash;
    const block = await this.hnsQuery.getBlockByHash(blockHash);
    const timeDelta = util.now() - block.time;

    const mins = Math.floor(timeDelta / 60);
    let minutes = mins > 0 ? units('minute', mins) : units('second', timeDelta);

    this.blockHeightAlerts.push({blockHeight: blockHeight + 1, chatId: chatId});

    await this.slimbot.sendMessage(
        chatId,
        `Current block height is *[${
            blockHeight}](https://hnsnetwork.com/blocks/${blockHeight})*\\.
It was mined approximately ${minutes} ago\\.

I'll send you a message when the next block has been mined\\.`,
        {parse_mode: 'MarkdownV2'});
  }

  async processBlockHeightAlerts(blockHeight) {
    // Find all matching alerts
    const dueAlerts =
        this.blockHeightAlerts.filter((a) => (a.blockHeight <= blockHeight));
    // Filter them out from our list
    this.blockHeightAlerts =
        this.blockHeightAlerts.filter((a) => (a.blockHeight > blockHeight));

    const inlineKeyboard = {
      inline_keyboard: [
        [{text: 'Alert me on next block again', callback_data: '/nextblock'}]
      ]
    };

    const sends = [];
    for (let alrt of dueAlerts) {
      sends.push(this.slimbot.sendMessage(
          alrt.chatId,
          `Alert\\: block *[${blockHeight}](https://hnsnetwork.com/blocks/${
              blockHeight})* has been mined\\.`,
          {parse_mode: 'MarkdownV2', reply_markup: inlineKeyboard}));
    }

    await Promise.all(sends);
  }

  async testInline(chatId) {
    const inlineKeyboard = {
      inline_keyboard: [[{text: 'do it again', callback_data: '/test'}]]
    };
    await this.slimbot.sendMessage(chatId, '*test* inline keyb', {
      parse_mode: 'MarkdownV2',
      reply_markup: JSON.stringify(inlineKeyboard)
    });
  }

  /**
   * Greet the user with a help message
   *
   * @param {string} chatId - telegram chat id to respond to
   */
  async sendGreeting(chatId) {
    const params = {parse_mode: 'MarkdownV2', disable_web_page_preview: true};
    const text = `*Hello there\\!*
I am a Handshake \\(HNS\\) bot\\. [Handshake](https://handshake.org) is an experimental peer\\-to\\-peer root naming system that allows you to register and manage top\\-level domain names on a blockchain, and transact in its native cryptocurrency\\.

I can answer queries about Handshake names\\. I can also deliver alerts related to names, name auctions or the Handshake blockchain\\.

Commands that I currently understand:
/help \\- show this message
/name NAME \\- look up NAME on the blockchain and show its status
/nextblock \\- I will alert you when the next block has been mined

If you don't specify a command, I'll try to interpret your message as a Handshake name and will look it up\\.

Please note: _I handle emojis and unicode automatically\\: you don\\'t have to do [punycode](https://en.wikipedia.org/wiki/Punycode) conversion for names that include characters other than letters and numbers\\._

_This bot is a work in progress\\._ Feedback\\? Feature requests\\? Complaints\\? [Would love to hear from you\\!](https://t.me/allmyhinges)`;

    await this.slimbot.sendMessage(chatId, text, params);
  }

  /**
   * Tell user I didn't understand their command
   *
   * @param {string} chatId - telegram chat id to respond to
   */
  async sendUnknownCommandNotice(chatId) {
    this.slimbot.sendMessage(
        chatId, `I'm sorry, I don't understand that command.

Please use /help to see the list of commands that I recognize.`);
  }
}


function units(unit, i) {
  i = Math.floor(i);
  return i == 1 ? `1 ${unit}` : `${i} ${unit}s`;
}


function nameAlertInlineKeyboard(encodedName, existsAlert) {
  let button = null;
  if (existsAlert) {
    button = {text: 'Cancel alert', callback_data: `dna|${encodedName}`};
  } else {
    button = {text: 'Create alert', callback_data: `cna|${encodedName}`};
  }
  return {inline_keyboard: [[button]]};
}


/**
 * Parse "bot command" from the incoming message
 *
 * Find first entity of type "bot_command"
 * Parse the command out based on entity offset and length
 * The rest of the text until the end of string is args
 * Whatever comes before /blahblah is ignored
 *
 * @param {Object} message - incoming telegram message
 * @returns {Object}
 */
function parseCommandMessage(message) {
  const cmd = {
    text: message.text
  }

  // Find first "bot_command" entity
  const en = message.entities?.find(el => el.type == 'bot_command');

  // Extract entity if it exists
  if (en && en.offset !== undefined && en.length !== undefined) {
    cmd.command = message.text.substring(en.offset, en.offset + en.length);
    const aoffs = en.offset + en.length + 1;
    cmd.args = message.text.substring(aoffs, message.text.length);
  } else {
    cmd.command = 'no_command';
  }

  return cmd;
}


/**
 * Escape Telegram-unsafe characters
 *
 * @param {string} text
 * @returns {string}
 */
function tgsafe(text) {
  const specialCharsRegex = /[_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!]/gi;
  return text.replace(specialCharsRegex, '\\$&');
}

function formatNameInfoMarkdown(
    name, encodedName, nameState, nameInfo, existsAlert) {
  // Header
  let text = `Name: *${tgsafe(name)}*\n`;

  // Include punycode name if its different
  if (name != encodedName) {
    text += `punycode: \`${tgsafe(encodedName)}\`\n`;
  }

  text += '\n';

  // Details
  text += formatNameStateDetailsMarkdown(nameState, nameInfo) + '\n';

  // External links
  text += '\n';
  text += `See details of this name on`;
  text += ` [Namebase](https://www.namebase.io/domains/${encodedName})`;
  text += ` or [block explorer](https://hnsnetwork.com/names/${encodedName})\n`;

  if (existsAlert) {
    text += '\n_You have an alert set for this name\\._';
  }

  return text;
}


/**
 * Describe the name alert using Telegram-safe markdown
 *
 * TODO: look into using a templating library
 *
 * @param {string} encodedName
 * @param {NameAlertBlockHeightTrigger[]} blockHeightTriggers
 * @param {NameAction[]} nameActions
 * @returns {string}
 */
function formatNameAlertMarkdown(
    encodedName, blockHeightTriggers, nameActions) {
  // Header
  const name = decodeName(encodedName);
  let text = `Name alert: *${tgsafe(name)}*`;
  if (name != encodedName) {
    text += ` \\(\`${tgsafe(encodedName)}\`\\)`;
  }
  text += '\n\n';

  // All the happenings
  if (blockHeightTriggers) {
    for (let {nsMilestone} of blockHeightTriggers) {
      text += describeMilestone(nsMilestone);
      text += '\n\n';
    }
  }

  // Name actions
  if (nameActions) {
    text += 'New actions related to this name\\:\n\n';
    for (let nameAction of nameActions) {
      text += '\\- ';
      text += describeNameAction(nameAction);
      text += '\n';
    }
  }

  // Footer
  text += '_Note: the name\\-related information above';
  text += ' is not guaranteed to be completely accurate\\._\n';
  text += `_Please check [block explorer](https://hnsnetwork.com/names/${
      encodedName}) for details\\._\n`;

  return text;
}


/**
 * Make a human-readable summary of the state of this name
 *
 * TODO: look into using a templating library
 *
 * @param {int} nameState - state of the name
 * @param {Object} nameInfo - results of the getNameInfo RPC call
 * @returns
 */
function formatNameStateDetailsMarkdown(nameState, nameInfo) {
  switch (nameState) {
    case nameAvails.UNAVAIL_RESERVED:
      return 'This name is *reserved* but hasn\'t been claimed yet\\.';

    case nameAvails.UNAVAIL_CLAIMING:
      return 'This name is *reserved* and is currently being claimed\\.';

    case nameAvails.AVAIL_NEVER_REGISTERED:
      return 'This name is *available*\\: it hasn\'t been registered yet\\.';

    case nameAvails.AVAIL_NOT_RENEWED:
      return 'This name is *available*\\: it was previously registered, but the registration wasn\'t renewed\\.';

    case nameAvails.AUCTION_OPENING: {
      let hrs = nameInfo.info.stats?.hoursUntilBidding || 0;
      let when =
          Math.floor(hrs) > 0 ? `in about ${units('hour', hrs)}` : 'soon';
      return `This name is *in auction*\\: The auction for this name is *being opened* right now\\.
Bidding will begin ${when}\\.`;
    }

    case nameAvails.AUCTION_BIDDING: {
      let hrs = nameInfo.info.stats?.hoursUntilReveal || 0;
      let when =
          Math.floor(hrs) > 0 ? `in about ${units('hour', hrs)}` : 'soon';
      return `This name is *in auction*\\: Bids for this name are being accepted right now\\.
Bidding will end ${when}\\.`;
    }

    case nameAvails.AUCTION_REVEAL: {
      let hrs = nameInfo.info.stats?.hoursUntilClose || 0;
      let when =
          Math.floor(hrs) > 0 ? `in about ${units('hour', hrs)}` : 'soon';
      return `This name is *in auction*\\: Bids for this name are being revealed right now\\.
The auction will close ${when}\\.`;
    }

    case nameAvails.UNAVAIL_CLOSED: {
      let ds = nameInfo.info.stats?.daysUntilExpire || 0;
      let when = Math.floor(ds) > 0 ? `in about ${units('day', ds)}` :
                                      'in less than a day';
      return `This name is taken\\. It will expire ${
          when} unless renewed by the owner before then\\.`;
    }

    default:
      return `I'm not sure how to summarize the state of this name\\.\\.\\.
Please click one of the links below to see the details\\.`;
  }
}


/**
 * Return a human-readable description of the name state milestone
 *
 * @param {string} milestone
 * @returns {string}
 */
function describeMilestone(milestone) {
  let text = '';

  switch (milestone) {
    case nsMilestones.AUCTION_OPENING:
      text += '*Auction opening*\\: Bidding will begin in a few hours\\.';
      break;

    case nsMilestones.AUCTION_BIDDING:
      text += '*Auction bidding*\\: The bidding for this name has begun\\.';
      text += ' Bids will be accepted for a few days\\.';
      break;

    case nsMilestones.AUCTION_REVEAL:
      text += '*Auction reveal*\\: Bids are being revealed\\.';
      text += ' The auction will close in a few days\\.';
      break;

    case nsMilestones.AUCTION_CLOSED:
      text += '*Auction closed*\\: The auction for this name is over\\.';
      break;

    case nsMilestones.NAME_LOCKED:
      text += '*Name locked*\\: The name has been locked\\.';
      break;

    case nsMilestones.NAME_UNLOCKED:
      text += '*Name unlocked*\\: The name has been unlocked';
      text += ' and changes can now be made to it\\.';
      break;

    case nsMilestones.REGISTRATION_EXPIRED:
      text += '*Registration expired*\\: The name registration';
      text += ' has not been renewed in time';
      text += ' and it is available for a new auction\\.';
      break;

    default:
      console.log(`Unknown name state milestone received: '${milestone}`);
      text += '_The state of this name has changed';
      text += ' but I\'m not sure how to summarize it\\.';
      text += ' Please check the block explorer link below for details\\._';
      break;
  }

  return text;
}


/**
 *
 * @param {NameAction} nameAction
 */
function describeNameAction(nameAction) {
  switch (nameAction.constructor) {
    case nacs.ClaimNameAction:
      return '*Claim*\\: This name has been claimed\\!';

    case nacs.OpenAuctionNameAction:
      return '*Auction open*\\: The name auction has been opened\\.';

    case nacs.AuctionBidNameAction:
      return `*Bid placed*\\: ${tgsafe('' + nameAction.lockupAmount)} HNS\\.`;

    case nacs.AuctionRevealNameAction:
      return `*Bid revealed*\\: ${tgsafe('' + nameAction.bidAmount)} HNS\\.`;

    case nacs.RegisterNameAction:
      return '*Name registered*\\: The name has been registered\\.';

    case nacs.RenewNameAction:
      return '*Name renewed*\\: The name has been renewed\\.';

    default:
      return '_Not sure how to describe this action\\. Please check the block explorer link below_\\.';
  }
}


// Export all the things.
module.exports = {
  parseCommandMessage,
  TelegramBot
};