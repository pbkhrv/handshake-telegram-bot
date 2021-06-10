const {TelegramNameAlert, NameAlertBlockHeightTrigger} = require('./db');
const EventEmitter = require('eventemitter3');
const {NewBlockEvent} = require('./handshake');
const {calculateAllFutureMilestones} = require('./namestate');
const {groupArrayBy} = require('./utils');
const sequelize = require('sequelize');
const Op = sequelize.Op;
const {
  ClaimNameAction,
  OpenAuctionNameAction,
  RegisterNameAction,
  RenewNameAction
} = require('./nameactions');

const events = {
  TELEGRAM_NAME_ALERT_TRIGGER: 'TELEGRAM_NAME_ALERT_TRIGGER'
};

/**
 * Create new Telegram alert and triggers for a Handshake name
 *
 * @param {number} chatId Telegram chat id to send alerts to
 * @param {string} targetName Handshake name to watch
 * @param {number} currentBlockHeight
 * @param {Object} nameInfo current state info of the target name
 */
async function createTelegramNameAlert(
    chatId, targetName, currentBlockHeight, nameInfo) {
  const alert = await TelegramNameAlert.create({chatId, targetName});
  const milestones = calculateAllFutureMilestones(nameInfo, currentBlockHeight);

  for (let {blockHeight, nsMilestone} of milestones) {
    await NameAlertBlockHeightTrigger.create(
        {blockHeight, nsMilestone, didFire: false, alertId: alert.id});
  }
}


/**
 * Get distinct targetName values for name alerts
 * @returns {string[]}
 */
async function getDistinctTargetNames() {
  const alertNames = await TelegramNameAlert.findAll({
    attributes:
        [[sequelize.fn('DISTINCT', sequelize.col('targetName')), 'targetName']]
  });
  return alertNames.map(alert => alert.targetName);
}


/**
 * Update name alert triggers based on new name actions
 *
 * @param {NewBlockEvent} newBlockEvt
 * @param {function} nameInfoCb async name info lookup callback
 */
async function updateNameAlertTriggersOnNewBlock(newBlockEvt, nameInfoCb) {
  // We are only interested in names for which we have alerts
  const relevantNames = new Set(await getDistinctTargetNames());
  let nameActions =
      newBlockEvt.nameActions.filter(na => relevantNames.has(na.name));

  // We only update triggers based on certain actions
  const updateTriggeringActions = {
    ClaimNameAction,
    OpenAuctionNameAction,
    RegisterNameAction,
    RenewNameAction
  };

  nameActions =
      nameActions.filter(na => updateTriggeringActions[na.constructor.name]);

  const affectedNames = nameActions.map(na => na.name);

  // Peform trigger updates for alerts on affected names
  for (let targetName of affectedNames) {
    const nameInfo = await nameInfoCb(targetName);
    const milestones =
        calculateAllFutureMilestones(nameInfo, newBlockEvt.blockHeight);
    const alerts = await TelegramNameAlert.findAll(
        {where: {targetName}, include: 'blockHeightTriggers'});

    for (let alert of alerts) {
      for (let trigger of alert.blockHeightTriggers) {
        // Delete previously scheduled future triggers
        if (!trigger.didFire && trigger.blockHeight > newBlockEvt.blockHeight) {
          await trigger.destroy();
        }
      }

      // Schedule new ones
      for (let {blockHeight, nsMilestone} of milestones) {
        await NameAlertBlockHeightTrigger.create(
            {blockHeight, nsMilestone, didFire: false, alertId: alert.id});
      }
    }
  }
}


/**
 * Find name alerts that should fire and trigger them
 *
 * @param {NameAction[]} nameActions to match with name alerts
 * @param {number} blockHeight to match with block height triggers
 * @param {EventEmitter} eventEmitter for "name alert trigger" events
 */
async function fireMatchingTelegramNameAlerts(
    nameActions, blockHeight, eventEmitter) {
  // Find name alerts that need to be delivered based on name actions
  const nameActionsTriggersByChatId =
      await findMatchingNameActionTriggers(nameActions);

  // Find name alerts that need to be delivered based on block height
  const blockHeightTriggersByChatId =
      await findMatchingBlockHeightTriggers(blockHeight);

  // Merge
  const triggers = {};

  for (let [chatId, nas] of Object.entries(nameActionsTriggersByChatId)) {
    for (let [name, nameActions] of Object.entries(nas)) {
      triggers[chatId] = triggers[chatId] || {};
      triggers[chatId][name] = triggers[chatId][name] || {};
      triggers[chatId][name].nameActions = nameActions;
    }
  }

  for (let [chatId, nameTrigs] of Object.entries(blockHeightTriggersByChatId)) {
    for (let [name, trigs] of Object.entries(nameTrigs)) {
      triggers[chatId] = triggers[chatId] || {};
      triggers[chatId][name] = triggers[chatId][name] || {};
      triggers[chatId][name].blockHeightTriggers = trigs;
    }
  }

  // Emit
  for (let [chatId, nameTrigs] of Object.entries(triggers)) {
    for (let [name, t] of Object.entries(nameTrigs)) {
      eventEmitter.emit(
          events.TELEGRAM_NAME_ALERT_TRIGGER,
          new TelegramNameAlertTriggerEvent(
              parseInt(chatId), name, t.nameActions, t.blockHeightTriggers));
    }
  }

  // Mark block height triggers as "fired"
  for (let [chatId, nameTrigs] of Object.entries(blockHeightTriggersByChatId)) {
    for (let [name, trigs] of Object.entries(nameTrigs)) {
      for (let trigger of trigs) {
        trigger.didFire = true;
        await trigger.save();
      }
    }
  }
}


/**
 * Find all alerts triggered by the given name actions
 *
 * @param {NameAction[]} nameActions
 * @returns {Object} Map of maps {chatId: {name: NameAction[]}}
 */
async function findMatchingNameActionTriggers(nameActions) {
  // Group alerts by chatId to be delivered in batches
  const triggers = {};

  // Find relevant name actions
  const relevantNames = new Set(await getDistinctTargetNames());
  const relevantActions = nameActions.filter(na => relevantNames.has(na.name));
  const actionsByName = groupArrayBy(relevantActions, a => a.name);

  // Schedule name action alerts for delivery
  for (let [targetName, actions] of Object.entries(actionsByName)) {
    console.log(targetName, actions);
    const alerts = await TelegramNameAlert.findAll({where: {targetName}});
    for (let alert of alerts) {
      triggers[alert.chatId] = triggers[alert.chatId] || {};
      triggers[alert.chatId][targetName] = actions;
    }
  }

  return triggers;
}


/**
 * Find triggers that should fire on this blockheight
 *
 * @param {number} blockHeight
 * @returns {Object} Map of maps {chatId: {name:
 *     NameAlertBlockHeightTrigger[]}}
 */
async function findMatchingBlockHeightTriggers(blockHeight) {
  // Find all block height triggers on this or earlier block height
  // that haven't fired yet
  const out = {};
  const triggers = await NameAlertBlockHeightTrigger.findAll({
    where:
        {[Op.and]: [{blockHeight: {[Op.lte]: blockHeight}}, {didFire: false}]},
    include: 'alert'
  });

  // Group triggers by chatId, then name
  for (let trig of triggers) {
    const chatId = trig.alert.chatId;
    const name = trig.alert.targetName;
    out[chatId] = out[chatId] || {};
    out[chatId][name] = out[chatId][name] || [];
    out[chatId][name].push(trig);
  }

  return out;
}

/**
 * Telegram name alert triggered event
 */
class TelegramNameAlertTriggerEvent {
  /**
   *
   * @param {number} chatId
   * @param {string} encodedName
   * @param {NameAction[]} nameActions
   * @param {NameAlertBlockHeightTrigger[]} blockHeightTriggers
   */
  constructor(chatId, encodedName, nameActions, blockHeightTriggers) {
    this.chatId = chatId;
    this.encodedName = encodedName;
    this.nameActions = nameActions;
    this.blockHeightTriggers = blockHeightTriggers;
  }
}

/**
 * Create, list, delete telegram alerts
 */
class TelegramAlertManager extends EventEmitter {
  constructor(hnsQuery) {
    super();
    this.hnsQuery = hnsQuery;
  }

  /**
   * Create a name alert
   *
   * @param {number} chatId
   * @param {string} encodedName punycode name to alert on
   */
  async createNameAlert(chatId, encodedName) {
    const currentBlockHeight = await this.hnsQuery.getCurrentBlockHeight();
    const nameInfo = await this.hnsQuery.getNameInfo(encodedName);
    await createTelegramNameAlert(
        chatId, encodedName, currentBlockHeight, nameInfo);
  }

  /**
   * Check whether an alert for a name exists
   *
   * @param {number} chatId
   * @param {string} encodedName punycode name to alert on
   * @returns
   */
  async checkExistsNameAlert(chatId, encodedName) {
    const count = await TelegramNameAlert.count(
        {where: {chatId, targetName: encodedName}});
    return count > 0;
  }

  /**
   * Delete a name alert
   *
   * @param {number} chatId
   * @param {string} encodedName
   */
  async deleteNameAlert(chatId, encodedName) {
    TelegramNameAlert.destroy({where: {chatId, targetName: encodedName}});
  }

  /**
   *
   * @param {NewBlockEvent} newBlockEvt
   */
  async processNewBlock(newBlockEvt) {
    // Update triggers as necessary
    await updateNameAlertTriggersOnNewBlock(
        newBlockEvt, async (name) => this.hnsQuery.getNameInfo(name));

    // Fire matching name alert triggers
    await fireMatchingTelegramNameAlerts(
        newBlockEvt.nameActions, newBlockEvt.blockHeight, this);
  }

  /**
   * Subscribe to events
   */
  start() {
    this.hnsQuery.on('new_block', async (evt) => this.processNewBlock(evt));
  }
}

module.exports = {
  createTelegramNameAlert,
  updateNameAlertTriggersOnNewBlock,
  findMatchingNameActionTriggers,
  findMatchingBlockHeightTriggers,
  fireMatchingTelegramNameAlerts,
  events,
  TelegramNameAlertTriggerEvent,
  TelegramAlertManager
};