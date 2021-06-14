const {states} = require('hsd/lib/covenants/namestate');
const {util} = require('hsd');
const Slimbot = require('slimbot');
const {InvalidNameError, encodeName, decodeName} = require('./handshake');
const {nameAvails, calculateNameAvail, nsMilestones} = require('./namestate');
const {TelegramAlertManager, emittedEvents: alertEvents} = require('./alerts');
const {parsePositiveInt} = require('./utils');
const nacs = require('./nameactions');

const emojis = {
  deleted: '🗑',
  alert: '🚨',
  checkmark: '✅',
  frown: '🙁'
};


const blockHeightAlerts = {
  BLOCK_MINED: 'BLOCK_MINED'
};

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
  }

  /**
   * Setup callbacks and start the bot
   */
  start() {
    console.log('Starting bot');

    this.alertManager.on(
        alertEvents.TELEGRAM_NAME_ALERT,
        async (evt) => this.deliverNameAlert(evt));

    this.alertManager.on(
        alertEvents.TELEGRAM_BLOCK_HEIGHT_ALERT,
        async (evt) => this.deliverBlockHeightAlert(evt));

    this.slimbot.on('message', async (message) => this.onMessage(message));
    this.slimbot.on(
        'edited_message', async (message) => this.onMessage(message));
    this.slimbot.on(
        'callback_query', async (query) => this.onCallbackQuery(query));
    this.slimbot.startPolling();
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

      case '/help_alerts':
        await this.sendMarkdown(message.chat.id, formatAlertsHelpMarkdown());
        break;

      case '/name':
        await this.processNameCommand(message.chat.id, cmd);
        break;

      case '/nextblock':
        await this.processNextBlockCommand(message.chat.id, cmd.args);
        break;

      case '/alerts':
        await this.processAlertsCommand(message.chat.id);
        break;

      // Guess the shortcut
      case 'no_command':
        await this.processDefaultCommand(message.chat.id, cmd.text);
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
            queryId, {text: `Created alert for name '${encodedName}'`});
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
            queryId, {text: 'Alert deleted'});

        // Remove inline keyboard, because we'll start a new interaction
        if (message?.message_id) {
          await this.slimbot.editMessageReplyMarkup(
              chatId, message.message_id,
              JSON.stringify(emptyInlineKeyboard()));
        }

        await this.slimbot.sendMessage(
            chatId, `${emojis.deleted} Deleted alert for \`${encodedName}\``);
        break;
      }

      case 'dbha': {
        const [, alertType, blockHeight] = queryArgs;
        if (alertType && blockHeight) {
          await this.alertManager.deleteTelegramBlockHeightAlert(
              chatId, blockHeight, alertType);
        }
        await this.slimbot.answerCallbackQuery(
            queryId, {text: 'Alert deleted'});
        if (message?.message_id) {
          await this.slimbot.editMessageReplyMarkup(
              chatId, message.message_id, JSON.stringify(emptyInlineKeyboard));
        }

        // If this alert is current, acknowledge its deletion
        if (this.hnsQuery.getCurrentBlockHeight() < blockHeight) {
          await this.slimbot.sendMessage(
              chatId,
              `${emojis.deleted} Deleted alert for block height ${
                  blockHeight}.`);
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
  async deliverNameAlert(
      {chatId, encodedName, blockHeightTriggers, nameActions}) {
    const text =
        formatNameAlertMarkdown(encodedName, blockHeightTriggers, nameActions);

    const tgParams = {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
      reply_markup: JSON.stringify(nameAlertInlineKeyboard(encodedName, true))
    };

    await this.slimbot.sendMessage(chatId, text, tgParams);
  }


  /**
   *
   * @param {number} chatId
   * @param {string} inputTargetBlockHeight user input target block height
   */
  async processNextBlockCommand(chatId, inputTargetBlockHeight) {
    const blockHeight = await this.hnsQuery.getCurrentBlockHeight();

    // Figure out which block height we should be alerting on:
    // - by default, next block
    // - if user used "+X" notation, we'll alert on current + X
    // - if user sent number > current block height, alert on that
    let targetBlockHeight = blockHeight + 1;  // default
    const relativeNumber = parsePositiveInt(inputTargetBlockHeight);
    if (relativeNumber) {
      targetBlockHeight = blockHeight + relativeNumber;
    } else {
      const number = parseInt(inputTargetBlockHeight);
      if (number && number > blockHeight) {
        targetBlockHeight = number;
      }
    }

    const dontCreateDuplicates = true;

    await this.alertManager.createTelegramBlockHeightAlert(
        chatId, targetBlockHeight, blockHeightAlerts.BLOCK_MINED,
        inputTargetBlockHeight, dontCreateDuplicates);

    const secondsSinceMined = await this.getCurrentBlockTiming();
    const text = formatBlockMinedAlertMarkdown(
        blockHeight, secondsSinceMined, targetBlockHeight);

    await this.slimbot.sendMessage(chatId, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: JSON.stringify(cancelBlockHeightAlertInlineKeyboard(
          targetBlockHeight, blockHeightAlerts.BLOCK_MINED))
    });
  }


  async processDefaultCommand(chatId, input) {
    // Is this a "+COUNT" nextblock shortcut?
    const count = parsePositiveInt(input);
    if (count) {
      await this.processNextBlockCommand(chatId, input);
    } else {
      await this.processNameCommand(chatId, {args: input});
    }
  }


  /**
   * Show user all alerts they have set
   *
   * @param {number} chatId
   */
  async processAlertsCommand(chatId) {
    const nameAlertNames =
        await this.alertManager.getTelegramNameAlerts(chatId);

    const blockHeightAlerts =
        await this.alertManager.getTelegramBlockHeightAlerts(chatId);

    // Help message if no alerts set
    if (nameAlertNames.length == 0 && blockHeightAlerts.length == 0) {
      let text =
          `${emojis.frown} You don't seem to have any alerts set up\\.\n\n`;
      text += formatAlertsHelpMarkdown();
      await this.slimbot.sendMessage(chatId, text, {parse_mode: 'MarkdownV2'});
      return;
    }

    // Summarize name alerts
    let text = 'Your alerts\\:\n\n';
    if (nameAlertNames.length > 0) {
      text += 'I am watching the following *names* for you\\:\n';
      text += summarizeNameAlertNames(nameAlertNames);
      text +=
          '\n_To cancel a name alert or see its details, send me its Handshake name\\._\n';
    } else {
      text += '_You don\'t have any name alerts set\\._\n';
    }
    text += '\n';

    // Summarize block height alerts
    if (blockHeightAlerts.length > 0) {
      text += 'I am watching the following *block heights* for you\\:\n';
      text += summarizeBlockHeightAlerts(blockHeightAlerts);
    }

    text += '_Send /help\\_alerts to see a help message about alerts_\\.';

    await this.slimbot.sendMessage(chatId, text, {parse_mode: 'MarkdownV2'});
  }


  async getCurrentBlockTiming() {
    const bcInfo = await this.hnsQuery.getBlockchainInfo();
    const blockHeight = bcInfo.blocks;

    const blockHash = bcInfo.bestblockhash;
    const block = await this.hnsQuery.getBlockByHash(blockHash);
    const secondsSinceMined = util.now() - block.time;
    return secondsSinceMined;
  }


  async deliverBlockHeightAlert({chatId, blockHeight, alertType, context}) {
    if (alertType == blockHeightAlerts.BLOCK_MINED) {
      let text = `${emojis.alert} Alert\\: block `;
      text +=
          `*[${blockHeight}](https://hnsnetwork.com/blocks/${blockHeight})*`;
      text += ' has been mined\\.';

      await this.slimbot.sendMessage(chatId, text, {parse_mode: 'MarkdownV2'});
    } else {
      console.log(`Unknown alertType received: ${alertType}`);
    }
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

I can answer queries about Handshake names and deliver alerts related to names, name auctions or the Handshake blockchain\\.

*Commands\\:* I currently understand the following\\:
/help \\- show this message
/name \`NAME\` \\- look up \`NAME\` on the blockchain and show its status
/nextblock \\- I will alert you when the next block has been mined
/nextblock \`\\+COUNT\` \\- I will alert you when \`COUNT\` blocks from now have been mined
/nextblock \`HEIGHT\` \\- I will alert you when block height \`HEIGHT\` has been mined
/alerts \\- list alerts that you have set\\. More information: /help\\_alerts\\.

*Shortcuts\\:* If you don't specify a command, I'll try to guess\\:
• \`\\+COUNT\` \\(like \`\\+1\`, \`\\+5\` etc\\) is treated like the /nextblock command
• Try to look up anything that looks like a name

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

  async sendMarkdown(chatId, md) {
    await this.slimbot.sendMessage(
        chatId, md, {parse_mode: 'MarkdownV2', disable_web_page_preview: true});
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


function cancelBlockHeightAlertInlineKeyboard(blockHeight, alertType) {
  const button = {
    text: 'Cancel alert',
    callback_data: `dbha|${alertType}|${blockHeight}`
  };
  return {inline_keyboard: [[button]]};
}


function emptyInlineKeyboard() {
  return {inline_keyboard: []};
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
  text += `See details on`;
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
  let text = `${emojis.alert} Name alert: *${tgsafe(name)}*`;
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
    text += 'New actions related to this name\\:\n';
    for (let nameAction of nameActions) {
      text += '\\- ';
      text += describeNameAction(nameAction);
      text += '\n';
    }
  }

  // Footer
  text += '\n';
  text += '_Note: the information above';
  text += ' is not guaranteed to be completely accurate\\._\n';
  text += `_Please confirm with [block explorer](https://hnsnetwork.com/names/${
      encodedName})\\._\n`;

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
      const hrs = nameInfo.info.stats?.hoursUntilBidding || 0;
      const when =
          Math.floor(hrs) > 0 ? `in about ${units('hour', hrs)}` : 'soon';
      const blocksLeft = nameInfo.info.stats?.blocksUntilBidding;
      let text = `The *auction* for this name has just been opened\\.\n`;
      text += `Bidding will begin ${when} `;
      text += `\\(${units('block', blocksLeft)} left\\)\\.`;

      return text;
    }

    case nameAvails.AUCTION_BIDDING: {
      const hrs = nameInfo.info.stats?.hoursUntilReveal || 0;
      const when =
          Math.floor(hrs) > 0 ? `in about ${units('hour', hrs)}` : 'soon';
      const blocksLeft = nameInfo.info.stats?.blocksUntilReveal;
      let text = `This name is *in auction*\\: `;
      text += `Bids are being accepted right now\\.\n`;
      text += `Bidding will end ${when} `;
      text += `\\(${units('block', blocksLeft)} left\\)\\.`;
      return text;
    }

    case nameAvails.AUCTION_REVEAL: {
      const hrs = nameInfo.info.stats?.hoursUntilClose || 0;
      const when =
          Math.floor(hrs) > 0 ? `in about ${units('hour', hrs)}` : 'soon';
      const blocksLeft = nameInfo.info.stats?.blocksUntilClose;
      let text = `This name is *in auction*\\: `;
      text += `Bids are being revealed right now\\.\n`;
      text += `Auction will close ${when} `;
      text += `\\(${units('block', blocksLeft)} left\\)\\.`;
      return text;
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
      return '*Auction opened*\\: The name auction has been opened\\.';

    case nacs.AuctionBidNameAction:
      return `*Bid placed*\\: ${tgsafe('' + nameAction.lockupAmount)} HNS\\.`;

    case nacs.AuctionRevealNameAction:
      return `*Bid revealed*\\: ${tgsafe('' + nameAction.bidAmount)} HNS\\.`;

    case nacs.RegisterNameAction:
      return '*Registered*\\: The name has been registered\\.';

    case nacs.RenewNameAction:
      return '*Renewed*\\: The name has been renewed\\.';

    case nacs.TransferNameAction:
      return '*Transfer initiated*\\: A transfer of the name ' +
          'to a different address has been initiated\\.';

    default:
      return '_Not sure how to describe this action\\. Please check the block explorer link below_\\.';
  }
}


function formatBlockMinedAlertMarkdown(
    blockHeight, secondsSinceMined, targetBlockHeight) {
  const mins = Math.floor(secondsSinceMined / 60);
  const time =
      mins > 0 ? units('minute', mins) : units('second', secondsSinceMined);

  let text = 'Current block height is ';
  text +=
      `*[${blockHeight}](https://hnsnetwork.com/blocks/${blockHeight})*\\.\n`;
  text += `It was mined approximately ${time} ago\\.\n\n`;
  text += `I'll send you a message when block number `;
  text += `${targetBlockHeight} has been mined\\.`;
  return text;
}


function formatAlertsHelpMarkdown() {
  let text = '';
  text += `*Name alerts*\nI can watch a Handshake name and alert you `;
  text += `whenever any of the following happens\\:\n`;
  text += `\\- The name is claimed\n`;
  text += `\\- Name auction is opened, bidding or reveal periods begin\n`;
  text += `\\- Anyone bids or reveals a bid in the name auction\n`;
  text += `\\- Name is registered, transferred, updated, expired or renewed\n`;
  text +=
      `_To create a name alert_\\: send me the name you are interested in, `;
  text += `then click \`Create alert\`\\.\n`;
  text += `\n`;
  text += `*Block height alerts*\nI can alert you whenever a `;
  text += `particular block height has been mined\\.\n`;
  text += `_To create a block height alert_\\: see /help `;
  text += `for details of the \`nextblock\` command\\.\n`;
  return text;
}


function summarizeNameAlertNames(encodedNames) {
  let text = '';
  for (let en of encodedNames) {
    const name = decodeName(en);
    text += `\\- *${tgsafe(name)}*`;
    // Include punycode if necessary
    text += (name != en) ? `\\(punycode \`${tgsafe(en)}\`\\)\n` : '\n';
  }
  return text;
}


function summarizeBlockHeightAlerts(alerts) {
  let text = '';
  for (let alert of alerts) {
    // TODO: handle different alertType's
    text += `\\- *${alert.blockHeight}\\:* Block mined alert\n`;
  }
  return text;
}


// Export all the things.
module.exports = {
  parseCommandMessage,
  TelegramBot
};