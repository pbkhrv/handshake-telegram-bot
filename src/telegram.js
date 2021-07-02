const {states} = require('hsd/lib/covenants/namestate');
const {util: handshakeUtil, Network} = require('hsd');
const Slimbot = require('slimbot');
const {InvalidNameError, encodeName, decodeName} = require('./handshake');
const {nameAvails, calculateNameAvail, nsMilestones, milestoneLabels} =
    require('./namestate');
const {TelegramAlertManager, emittedEvents: alertEvents} = require('./alerts');
const {
  parsePositiveInt,
  parseBlockNum,
  blocksToApproxDaysOrHours,
  numUnits,
  cleanHandshakeName,
  TelegramMarkdown: tgmd
} = require('./utils');
const stats = require('./stats');


const emojis = {
  deleted: '🗑',
  alert: '🚨',
  checkmark: '✅',
  frown: '🙁'
};

const alertTypes = {
  BLOCK_MINED: 'BLOCK_MINED'
};

const emptyInlineKeyboard = {
  inline_keyboard: []
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
    this.slimbot = new Slimbot(botToken);
    this.hnsQuery = hnsQuery;
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
        stats.logReceivedCommand(message.chat.id, 'start');
        await this.sendGreeting(message.chat.id);
        break;

      case '/help':
        stats.logReceivedCommand(message.chat.id, 'help');
        await this.sendGreeting(message.chat.id);
        break;

      case '/help_alerts':
        stats.logReceivedCommand(message.chat.id, 'help_alerts');
        await this.sendMarkdown(message.chat.id, formatAlertsHelpMarkdown());
        break;

      case '/name':
        await this.processNameCommand(message.chat.id, cmd);
        break;

      case '/nextblock':
        await this.processNextBlockCommand(message.chat.id, cmd.args);
        break;

      case '/alerts':
        stats.logReceivedCommand(message.chat.id, 'alerts');
        await this.processAlertsCommand(message.chat.id);
        break;

      case '/stats':
        stats.logReceivedCommand(message.chat.id, 'stats');
        await this.processStatsCommand(message.chat.id);
        break;

      // Guess the shortcut
      case 'no_command':
        await this.processDefaultCommand(message.chat.id, cmd.text);
        break;

      default:
        stats.logReceivedCommand(message.chat.id, 'unk');
        await this.sendUnknownCommandNotice(message.chat.id);
    }
  }

  /**
   * Process callback query from an inline keyboard
   *
   * @param {Object} query
   * @returns
   */
  async onCallbackQuery(query) {
    if (!query) {
      console.error('Got empty callback_query, exiting');
      return;
    }

    const queryId = query.id;
    if (!queryId) {
      console.error('Got empty query id in callback_query, exiting');
      return;
    }

    // TODO: refactor, this is badwrong
    const data = query.data;
    if (!data) {
      console.error('cbQuery: data is empty');
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
        stats.logReceivedCommand(chatId, 'cna');
        const encodedName = queryArgs[1];
        if (!encodedName) {
          console.log('cbQuery: cna command without param');
          await this.slimbot.answerCallbackQuery(
              queryId, {text: 'Something went wrong...'});
          return;
        }
        const name = decodeName(encodedName);

        await this.alertManager.createNameAlert(chatId, encodedName);
        await this.slimbot.answerCallbackQuery(
            queryId, {text: 'Alert created'});
        if (message?.message_id) {
          await this.slimbot.editMessageReplyMarkup(
              chatId, message.message_id, JSON.stringify(emptyInlineKeyboard));
        }
        await this.sendNameAlertDetails(chatId, encodedName);
        break;
      }

      // Delete name alert
      case 'dna': {
        stats.logReceivedCommand(chatId, 'dna');
        const encodedName = queryArgs[1];
        if (!encodedName) {
          console.log('cbQuery: dna command without param');
          await this.slimbot.answerCallbackQuery(
              queryId, {text: 'Something went wrong...'});
          return;
        }
        const name = decodeName(encodedName);
        await this.alertManager.deleteNameAlert(chatId, encodedName);
        await this.slimbot.answerCallbackQuery(
            queryId, {text: 'Alert deleted'});

        // Remove inline keyboard, because we'll start a new interaction
        if (message?.message_id) {
          await this.slimbot.editMessageReplyMarkup(
              chatId, message.message_id, JSON.stringify(emptyInlineKeyboard));
        }

        await this.sendMarkdown(
            chatId,
            new tgmd(emojis.deleted, ' Deleted alert for ', tgmd.bold(name)));
        break;
      }

      case 'dbha': {
        stats.logReceivedCommand(chatId, 'dbha');
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
          await this.sendMarkdown(
              chatId,
              new tgmd(
                  emojis.deleted, ' Deleted alert for block height ',
                  tgmd.code(`#${blockHeight}`), '.'));
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
  async processNameCommand(chatId, cmd, fromShortcut = false) {
    let name = cleanHandshakeName(cmd.args || '');
    let statsExtra = fromShortcut ? 'sc' : '';

    // If command is incomplete, ask for more information
    if (!name) {
      stats.logReceivedCommand(chatId, 'name', statsExtra + 'inc');
      // Store the current command to be completed when the next message comes
      this.incompleteCommands[chatId] = cmd;
      await this.slimbot.sendMessage(
          chatId, 'What name would you like me to lookup?')
      return;
    }

    stats.logReceivedCommand(chatId, 'name', statsExtra);

    try {
      const encodedName = encodeName(name);
      const nameInfo = await this.hnsQuery.getNameInfo(encodedName);
      const nameState = calculateNameAvail(nameInfo);
      const alertExists =
          await this.alertManager.checkExistsNameAlert(chatId, encodedName);

      const md = formatNameInfoMarkdown(name, encodedName, nameState, nameInfo);

      // Let user create an alert if one doesn't exist
      if (!alertExists) {
        await this.sendMarkdown(
            chatId, md, nameAlertInlineKeyboard(encodedName, false));
      } else {
        await this.sendMarkdown(chatId, md);
        await this.sendNameAlertDetails(chatId, name);
      }
    } catch (e) {
      if (e instanceof InvalidNameError) {
        // Notify user if name is invalid
        await this.sendMarkdown(
            chatId,
            new tgmd(`I'm sorry, but "${name}" is not a valid Handshake name`));
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
   *
   * @param {TelegramNameAlertTriggerEvent} evt
   */
  async deliverNameAlert(
      {chatId, encodedName, blockHeightTriggers, nameActions}) {
    const md =
        formatNameAlertMarkdown(encodedName, blockHeightTriggers, nameActions);
    await this.sendMarkdown(
        chatId, md, nameAlertInlineKeyboard(encodedName, true));
  }


  /**
   * Process /nextblock command or shortcut
   *
   * @param {number} chatId
   * @param {string} inputTargetBlockHeight user input target block height
   */
  async processNextBlockCommand(
      chatId, inputTargetBlockHeight, fromShortcut = false) {
    const blockHeight = await this.hnsQuery.getCurrentBlockHeight();
    let statsExtra = fromShortcut ? 'sc' : '';

    // Figure out which block height we should be alerting on:
    // - by default, next block
    // - if user used "+X" notation, we'll alert on current + X
    // - if user sent number > current block height, alert on that
    let targetBlockHeight = blockHeight + 1;  // default
    const relativeNumber = parsePositiveInt(inputTargetBlockHeight);
    if (relativeNumber) {
      stats.logReceivedCommand(chatId, 'nextblock', statsExtra + 'rel');
      targetBlockHeight = blockHeight + relativeNumber;
    } else {
      const number = parseBlockNum(inputTargetBlockHeight) ||
          parseInt(inputTargetBlockHeight);
      if (number && number > blockHeight) {
        stats.logReceivedCommand(chatId, 'nextblock', statsExtra + 'abs');
        targetBlockHeight = number;
      } else {
        stats.logReceivedCommand(chatId, 'nextblock', statsExtra);
      }
    }

    const dontCreateDuplicates = true;

    await this.alertManager.createTelegramBlockHeightAlert(
        chatId, targetBlockHeight, alertTypes.BLOCK_MINED,
        inputTargetBlockHeight, dontCreateDuplicates);

    const secondsSinceMined = await this.getCurrentBlockTiming();
    const md = formatBlockMinedAlertMarkdown(
        blockHeight, secondsSinceMined, targetBlockHeight);

    await this.sendMarkdown(
        chatId, md,
        cancelBlockHeightAlertInlineKeyboard(
            targetBlockHeight, alertTypes.BLOCK_MINED));
  }


  /**
   * Process /stats command
   *
   * @param {number} chatId
   */
  async processStatsCommand(chatId) {
    const uniqChats = await stats.uniqueChats();
    const commandCounts = await stats.commandCounts();
    const activeAlerts = await stats.activeNameAlerts();

    const md = new tgmd();
    md.appendLine('Unique chats: ', uniqChats);
    md.appendLine('Total active name alerts: ', activeAlerts);
    md.appendLine('Command counts:');
    for (let {command, count} of commandCounts) {
      md.appendLine('- ', tgmd.bold(command), ': ', count);
    }
    this.sendMarkdown(chatId, md);
  }


  /**
   * Try to guess a command shortcut
   *
   * @param {number} chatId
   * @param {string} input
   */
  async processDefaultCommand(chatId, input) {
    // Is this a "+COUNT" or "#HEIGHT" nextblock shortcut?
    const nextblock = parsePositiveInt(input) || parseBlockNum(input);
    if (nextblock) {
      await this.processNextBlockCommand(chatId, input, true);
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
      const md = new tgmd();
      md.appendLine(
          emojis.frown, ' You don\'t seem to have any alerts set up.');
      md.appendLine();
      md.append(formatAlertsHelpMarkdown());
      await this.sendMarkdown(chatId, md);
      return;
    }

    // Summarize name alerts
    const md = new tgmd();
    if (nameAlertNames.length > 0) {
      md.appendLine(
          'I am watching the following ', tgmd.bold('names'), ' for you:');
      md.append(formatNameAlertNamesMarkdown(nameAlertNames));
      md.appendLine();
      md.appendLine(tgmd.italic(
          'To cancel a name alert or see its details, ',
          'send me its Handshake name.'));
    } else {
      md.appendLine(tgmd.italic('You don\'t have any name alerts set.'));
    }
    md.appendLine();

    // Summarize block height alerts
    if (blockHeightAlerts.length > 0) {
      md.appendLine(
          'I am watching the following ', tgmd.bold('block heights'),
          ' for you:');
      md.appendLine(formatBlockHeightAlertsMarkdown(blockHeightAlerts));
    }

    md.append(
        tgmd.italic('Send /help_alerts to see a help message about alerts.'));

    await this.sendMarkdown(chatId, md);
  }


  /**
   * Calculate how long ago current block was mined
   * TODO: doesnt belong here, move to handshake.js
   *
   * @returns {number}
   */
  async getCurrentBlockTiming() {
    const bcInfo = await this.hnsQuery.getBlockchainInfo();
    const blockHeight = bcInfo.blocks;

    const blockHash = bcInfo.bestblockhash;
    const block = await this.hnsQuery.getBlockByHash(blockHash);
    const secondsSinceMined = handshakeUtil.now() - block.time;
    return secondsSinceMined;
  }


  /**
   * Format and deliver block height alert to chat
   *
   * @param {Object} param0
   */
  async deliverBlockHeightAlert({chatId, blockHeight, alertType, context}) {
    if (alertType == alertTypes.BLOCK_MINED) {
      const md = new tgmd(emojis.alert, ' Alert: ');
      md.append(
          'block ',
          tgmd.bold(tgmd.link(
              blockHeight, `https://hnsnetwork.com/blocks/${blockHeight}`)),
          ' has been mined.');

      await this.sendMarkdown(chatId, md);
    } else {
      console.log(`Unknown alertType received: ${alertType}`);
    }
  }


  /**
   * Greet the user with a help message
   *
   * @param {string} chatId - telegram chat id to respond to
   */
  async sendGreeting(chatId) {
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
• \`\\+COUNT\` \\(like \`\\+1\`, \`\\+5\` etc\\) is same as \`/nextblock +COUNT\` command
• \`\\#HEIGHT\` \\(like \`\\#77251\` etc\\) is same as \`/nextblock HEIGHT\` command
• Try to look up anything that looks like a name

Please note: _I handle emojis and unicode automatically\\: you don\\'t have to do [punycode](https://en.wikipedia.org/wiki/Punycode) conversion for names that include characters other than letters and numbers\\._

_This bot is a proof\\-of\\-concept work in progress\\._ Feedback\\? Feature requests\\? Complaints\\? [Would love to hear from you\\!](https://t.me/allmyhinges)`;

    await this.sendMarkdown(chatId, text);
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


  /**
   * Send markdown-formatted message to chat
   *
   * @param {number} chatId
   * @param {string|TelegramMarkdown} md
   * @param {Object|null} inlineKeyboard
   */
  async sendMarkdown(chatId, md, inlineKeyboard = null) {
    const params = {parse_mode: 'MarkdownV2', disable_web_page_preview: true};
    if (inlineKeyboard) {
      params.reply_markup = JSON.stringify(inlineKeyboard);
    }
    await this.slimbot.sendMessage(chatId, md.toString(), params);
  }


  /**
   * Format and send details about Handshake name to chat
   *
   * @param {number} chatId
   * @param {string} name
   */
  async sendNameAlertDetails(chatId, name) {
    const encodedName = encodeName(name);
    const alert =
        await this.alertManager.getTelegramNameAlert(chatId, encodedName);

    if (!alert) {
      return;
    }

    const blockHeight = await this.hnsQuery.getCurrentBlockHeight();
    const secondsPerBlock = Network.get().pow.targetSpacing;

    const md = new tgmd('You have an alert set for the name ', tgmd.bold(name));
    if (encodedName != name) {
      md.append(' (punycode ', tgmd.code(encodedName), ')');
    }
    md.appendLine();

    if (alert.blockHeightTriggers && alert.blockHeightTriggers.length > 0) {
      md.appendLine();
      md.appendLine('Upcoming block height milestones:');

      for (let trigger of alert.blockHeightTriggers) {
        const milestone =
            milestoneLabels[trigger.nsMilestone] || trigger.nsMilestone;
        const blocks = trigger.blockHeight - blockHeight;
        const timeLeft = blocksToApproxDaysOrHours(blocks, secondsPerBlock);

        md.append('- in ', tgmd.bold(numUnits('block', blocks)), ' ');
        if (timeLeft) {
          md.append(` (~${timeLeft})`);
        }
        md.append(
            `: ${milestone} (block `, tgmd.code('#', trigger.blockHeight), ')');
        md.appendLine();
      }
    } else {
      md.appendLine();
      md.append(
          'I will alert you as soon as any transactions ',
          'that affect the state of this name are posted to the blockchain.');
    }

    await this.sendMarkdown(
        chatId, md, nameAlertInlineKeyboard(encodedName, true));
  }
}


/**
 * Inline keyboard object for alert detail message
 *
 * @param {string} encodedName
 * @param {boolean} existsAlert
 * @returns {Object}
 */
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
 * Inline keyboard object for block height alert message
 *
 * @param {number} blockHeight
 * @param {string} alertType
 * @returns {Object}
 */
function cancelBlockHeightAlertInlineKeyboard(blockHeight, alertType) {
  const button = {
    text: 'Cancel alert',
    callback_data: `dbha|${alertType}|${blockHeight}`
  };
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
 * Format Handshake name information markdown text
 *
 * @param {string} name
 * @param {string} encodedName
 * @param {number} nameState
 * @param {Object} nameInfo
 * @returns {string}
 */
function formatNameInfoMarkdown(name, encodedName, nameState, nameInfo) {
  // Header
  const md = new tgmd('Name: ', tgmd.bold(name), '\n');

  // Include punycode name if its different
  if (name != encodedName) {
    md.appendLine('punycode: ', tgmd.code(encodedName));
  }

  md.appendLine();

  // Details
  md.appendLine(formatNameStateDetailsMarkdown(nameState, nameInfo));

  // External links
  md.appendLine();
  md.append(
      'See details on ',
      tgmd.link('Namebase', `https://www.namebase.io/domains/${encodedName}`),
      ' or ',
      tgmd.link(
          'block explorer', `https://hnsnetwork.com/names/${encodedName}`));

  return md;
}


/**
 * Describe the name alert using Telegram-safe markdown
 *
 * TODO: look into using a templating library
 *
 * @param {string} encodedName
 * @param {NameAlertBlockHeightTrigger[]} blockHeightTriggers
 * @param {Object[]} nameActions
 * @returns {string}
 */
function formatNameAlertMarkdown(
    encodedName, blockHeightTriggers, nameActions) {
  // Header
  const name = decodeName(encodedName);
  const md = new tgmd(emojis.alert, ' Name alert: ', tgmd.bold(name));
  if (name != encodedName) {
    md.append(' (', tgmd.code(encodedName), ')');
  }
  md.appendLine();
  md.appendLine();

  // All the happenings
  if (blockHeightTriggers) {
    for (let {nsMilestone} of blockHeightTriggers) {
      md.appendLine(formatMilestoneMarkdown(nsMilestone));
      md.appendLine();
    }
  }

  // Name actions
  if (nameActions) {
    md.appendLine('New actions:');
    for (let nameAction of nameActions) {
      md.appendLine('- ', formatNameActionMarkdown(nameAction));
    }
    md.appendLine();
  }

  // Footer
  md.append(tgmd.italic(
      'Check the ',
      tgmd.link(
          'block explorer', `https://hnsnetwork.com/names/${encodedName}`),
      ' for more information.'));

  return md;
}


/**
 * Make a human-readable summary of the state of this name
 *
 * TODO: replace this code with milestones because redundant
 *
 * @param {int} nameState - state of the name
 * @param {Object} nameInfo - results of the getNameInfo RPC call
 * @returns
 */
function formatNameStateDetailsMarkdown(nameState, nameInfo) {
  switch (nameState) {
    case nameAvails.UNAVAIL_RESERVED:
      return new tgmd(
          'This name is ', tgmd.bold('reserved'),
          ' but hasn\'t been claimed yet.');

    case nameAvails.UNAVAIL_CLAIMING:
      return new tgmd(
          'This name is ', tgmd.bold('reserved'),
          ' and is currently being claimed.');

    case nameAvails.AVAIL_NEVER_REGISTERED:
      return new tgmd(
          'This name is ', tgmd.bold('available'),
          ': it hasn\'t been registered yet.');

    case nameAvails.AVAIL_NOT_RENEWED:
      return new tgmd(
          'This name is ', tgmd.bold('available'),
          ': it was previously registered, but the registration wasn\'t renewed.');

    case nameAvails.AUCTION_OPENING: {
      const hrs = nameInfo.info.stats?.hoursUntilBidding || 0;
      const when =
          Math.floor(hrs) > 0 ? `in about ${numUnits('hour', hrs)}` : 'soon';
      const blocksLeft =
          numUnits('block', nameInfo.info.stats?.blocksUntilBidding);

      return new tgmd(
          tgmd.bold('The auction'), ' for this name has just been opened.\n',
          `Bidding will begin ${when} (${blocksLeft} left).`);
    }

    case nameAvails.AUCTION_BIDDING: {
      const hrs = nameInfo.info.stats?.hoursUntilReveal || 0;
      const when =
          Math.floor(hrs) > 0 ? `in about ${numUnits('hour', hrs)}` : 'soon';
      const blocksLeft =
          numUnits('block', nameInfo.info.stats?.blocksUntilReveal);

      return new tgmd(
          'This name is ', tgmd.bold('in auction'),
          ': Bids are being accepted right now.\n',
          `Bidding will end ${when} (${blocksLeft} left).`);
    }

    case nameAvails.AUCTION_REVEAL: {
      const hrs = nameInfo.info.stats?.hoursUntilClose || 0;
      const when =
          Math.floor(hrs) > 0 ? `in about ${numUnits('hour', hrs)}` : 'soon';
      const blocksLeft =
          numUnits('block', nameInfo.info.stats?.blocksUntilClose);

      return new tgmd(
          'This name is ', tgmd.bold('in auction'),
          ': Bids are being revealed right now.\n',
          `Auction will close ${when} (${blocksLeft} left).`);
    }

    case nameAvails.UNAVAIL_CLOSED: {
      let ds = nameInfo.info.stats?.daysUntilExpire || 0;
      let when = Math.floor(ds) > 0 ? `in about ${numUnits('day', ds)}` :
                                      'in less than a day';
      return new tgmd(
          'This name is taken. ',
          `It will expire ${when} unless renewed by the owner before then.`);
    }

    case nameAvails.UNAVAIL_TRANSFERRING:
      return new tgmd(
          'This name is being transferred from one address to another.');

    default:
      return new tgmd(
          `I'm not sure how to summarize the state of this name `,
          `(${nameState})...\n`,
          `Please click one of the links below to see the details.`);
  }
}


/**
 * Return a human-readable description of the name state milestone
 *
 * @param {string} milestone
 * @returns {string}
 */
function formatMilestoneMarkdown(milestone) {
  switch (milestone) {
    case nsMilestones.AUCTION_OPENING:
      return new tgmd(
          tgmd.bold('Auction opening'), ': Bidding will begin in a few hours.');

    case nsMilestones.AUCTION_BIDDING:
      return new tgmd(
          tgmd.bold('Auction bidding'), ': Bidding for this name has started. ',
          'Bids will be accepted for a few days.');

    case nsMilestones.AUCTION_REVEAL:
      return new tgmd(
          tgmd.bold('Auction reveal'), ': Bids can now be revealed. ',
          'The auction will close in a few days.');

    case nsMilestones.AUCTION_CLOSED:
      return new tgmd(
          tgmd.bold('Auction closed'), ': The auction for this name is over.');

    case nsMilestones.NAME_LOCKED:
      return new tgmd(tgmd.bold('Name locked'), ': The name has been locked.');

    case nsMilestones.NAME_UNLOCKED:
      return new tgmd(
          tgmd.bold('Name unlocked'), ': The name has been unlocked ',
          'and changes can now be made to it.');

    case nsMilestones.TRANSFER_IN_PROGRESS:
      return new tgmd(
          tgmd.bold('Transfer in progress'),
          ': The name is being transferred to another address.');

    case nsMilestones.TRANSFER_FINALIZING:
      return new tgmd(
          tgmd.bold('Transfer finalizing'),
          ': The name transfer is waiting to be finalized.');

    case nsMilestones.REGISTRATION_EXPIRED:
      return new tgmd(
          tgmd.bold('Registration expired'),
          ': The registration has not been renewed ',
          'and the name is available for a new auction.');

    default:
      console.log(`Unknown name state milestone received: '${milestone}`);
      return tgmd.italic(
          'The state of this name has changed ',
          'but I\'m not sure how to summarize it. ',
          'Please check the block explorer link below for details.');
  }
}


/**
 * Describe a name action
 *
 * @param {NameAction} nameAction
 */
function formatNameActionMarkdown(nameAction) {
  switch (nameAction.action) {
    case 'CLAIM':
      return new tgmd(tgmd.bold('Claim'), ': The name has been claimed.');

    case 'OPEN':
      return new tgmd(
          tgmd.bold('Auction opened'), ': The name auction has been opened.');

    case 'BID':
      return new tgmd(
          tgmd.bold('Bid placed'), `: ${nameAction.lockupAmount} HNS.`);

    case 'REVEAL':
      return new tgmd(
          tgmd.bold('Bid revealed'), `: ${'' + nameAction.bidAmount} HNS.`);

    case 'REDEEM':
      return new tgmd(tgmd.bold('Bid redeemed'), ': Bid has been redeemed.');

    case 'REGISTER':
      return new tgmd(
          tgmd.bold('Registered'), ': The name has been registered.');

    case 'RENEW':
      return new tgmd(tgmd.bold('Renewed'), ': The name has been renewed.');

    case 'UPDATE':
      return new tgmd(
          tgmd.bold('Updated'), ': Name records have been updated.');

    case 'TRANSFER':
      return new tgmd(
          tgmd.bold('Transfer initiated'),
          ': A transfer of the name to a different address has been initiated.');

    case 'FINALIZE':
      return new tgmd(
          tgmd.bold('Transfer finalized'), ': A transfer of the name ',
          'to a different address has been finalized.');

    case 'REVOKE':
      return new tgmd(
          tgmd.bold('Name revoked'), ': The name has been revoked.');

    default:
      return new tgmd.italic(
          'Not sure how to describe this action. ',
          'Please check the block explorer link below.');
  }
}


/**
 * Format block mined alert confirmation message
 *
 * @param {number} blockHeight
 * @param {number} secondsSinceMined
 * @param {number} targetBlockHeight
 * @returns {string}
 */
function formatBlockMinedAlertMarkdown(
    blockHeight, secondsSinceMined, targetBlockHeight) {
  const mins = Math.floor(secondsSinceMined / 60);
  const time = mins > 0 ? numUnits('minute', mins) :
                          numUnits('second', secondsSinceMined);

  const md = new tgmd('Current block height is ');
  md.appendLine(
      tgmd.bold(tgmd.link(
          blockHeight, `https://hnsnetwork.com/blocks/${blockHeight}`)),
      '.');

  if (secondsSinceMined > 0) {
    md.appendLine(`It was mined approximately ${time} ago.`);
  }

  md.appendLine();
  md.append(
      'I\'ll send you a message when block ',
      tgmd.code(`#${targetBlockHeight}`), ' has been mined.');

  return md;
}


/**
 * Format help message about alerts
 *
 * @returns {string}
 */
function formatAlertsHelpMarkdown() {
  const md = new tgmd(tgmd.bold('Name alerts'), '\n');
  md.appendLine(
      'I can watch a Handshake name and alert you ',
      'whenever any of the following happens:');
  md.appendLine('- The name is claimed');
  md.appendLine('- Name auction is opened, bidding or reveal periods begin');
  md.appendLine('- Anyone bids or reveals a bid in the name auction');
  md.appendLine(
      '- Name is registered, transferred, updated, expired or renewed');
  md.appendLine();
  md.appendLine(
      tgmd.italic('To create a name alert'),
      ': send me the name you are interested in, then click ',
      tgmd.code('Create alert'));
  md.appendLine();

  md.appendLine(tgmd.bold('Block height alerts'));
  md.appendLine(
      'I can alert you whenever a particular block height has been mined.');
  md.appendLine();
  md.append(
      tgmd.italic('To create a block height alert'),
      ': see /help for details of the ', tgmd.code('nextblock'), ' command.');
  return md;
}


/**
 * Format list of Handshake names
 *
 * @param {string[]} encodedNames
 * @returns
 */
function formatNameAlertNamesMarkdown(encodedNames) {
  const md = new tgmd();
  for (let en of encodedNames) {
    const name = decodeName(en);
    md.append('- ', tgmd.bold(name));
    // Include punycode if necessary
    if (name != en) {
      md.append('(punycode ', tgmd.code(en), ')');
    }
    md.appendLine();
  }
  return md;
}


/**
 * Format list of block height alerts
 *
 * @param {Object[]} alerts
 * @returns
 */
function formatBlockHeightAlertsMarkdown(alerts) {
  const md = new tgmd();
  for (let alert of alerts) {
    // TODO: handle different alertTypes
    md.appendLine('- ', tgmd.bold(alert.blockHeight), ': Block mined alert');
  }
  return md;
}


module.exports = {
  parseCommandMessage,
  formatNameAlertMarkdown,
  formatNameInfoMarkdown,
  formatNameStateDetailsMarkdown,
  formatMilestoneMarkdown,
  formatBlockMinedAlertMarkdown,
  TelegramBot
};