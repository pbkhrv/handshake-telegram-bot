const EventEmitter = require('eventemitter3');
const sequelize = require('sequelize');
const Op = sequelize.Op;
const {calculateAllFutureMilestones} = require('./namestate');
const {groupArrayBy, quietJsonParse} = require('./utils');
const {emittedEvents: handshakeEvents} = require('./handshake');
const {types: nameActionTypes} = require('./nameactions');
const {
  TelegramNameAlert,
  NameAlertBlockHeightTrigger,
  TelegramBlockHeightAlert
} = require('./db');


const emittedEvents = {
  TELEGRAM_NAME_ALERT: 'TELEGRAM_NAME_ALERT',
  TELEGRAM_BLOCK_HEIGHT_ALERT: 'TELEGRAM_BLOCK_HEIGHT_ALERT'
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
 * Create a block height alert
 *
 * @param {number} chatId
 * @param {number} blockHeight
 * @param {string} alertType
 * @param {Object} context json-serializable object with additional data
 * @param {boolean} enforceUnique enforce alert uniqueness
 */
async function createTelegramBlockHeightAlert(
    chatId, blockHeight, alertType, context, enforceUnique = false) {
  if (enforceUnique) {
    const matchingAlerts = await TelegramBlockHeightAlert.count(
        {where: {chatId, blockHeight, alertType, didFire: false}});
    if (matchingAlerts > 0) {
      return;
    }
  }

  await TelegramBlockHeightAlert.create({
    chatId,
    blockHeight,
    alertType,
    didFire: false,
    contextJson: JSON.stringify(context)
  });
}


/**
 * Delete telegram block height alert
 *
 * @param {number} chatId
 * @param {number} blockHeight
 * @param {string} alertType
 */
async function deleteTelegramBlockHeightAlert(chatId, blockHeight, alertType) {
  await TelegramBlockHeightAlert.destroy(
      {where: {chatId, blockHeight, alertType, didFire: false}});
}


/**
 * Get distinct targetName values for name alerts
 *
 * @returns {string[]}
 */
async function getDistinctNameAlertTargetNames() {
  const alertNames = await TelegramNameAlert.findAll({
    attributes:
        [[sequelize.fn('DISTINCT', sequelize.col('targetName')), 'targetName']]
  });
  return alertNames.map(alert => alert.targetName);
}


/**
 * Update name alert triggers based on new name actions
 *
 * @param {NameAction[]} nameActions
 * @param {number} blockHeight
 * @param {function} nameInfoCb async name info lookup callback
 */
async function updateNameAlertTriggersOnNewBlock(
    allNameActions, blockHeight, nameInfoCb) {
  // We are only interested in names for which we have alerts
  const relevantNames = new Set(await getDistinctNameAlertTargetNames());
  let nameActions = allNameActions.filter(na => relevantNames.has(na.name));

  // We only update triggers based on certain actions
  const updateTriggeringActions =
      new Set(['CLAIM', 'OPEN', 'REGISTER', 'TRANSFER', 'FINALIZE', 'REVOKE']);

  nameActions =
      nameActions.filter(na => updateTriggeringActions.has(na.action));

  const affectedNames = nameActions.map(na => na.name);

  // Peform trigger updates for alerts on affected names
  for (let targetName of affectedNames) {
    const nameInfo = await nameInfoCb(targetName);
    const milestones = calculateAllFutureMilestones(nameInfo, blockHeight);
    const alerts = await TelegramNameAlert.findAll(
        {where: {targetName}, include: 'blockHeightTriggers'});

    for (let alert of alerts) {
      for (let trigger of alert.blockHeightTriggers) {
        // Delete previously scheduled future triggers
        if (!trigger.didFire && trigger.blockHeight > blockHeight) {
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

  // Deliver alerts
  for (let [chatId, nameTrigs] of Object.entries(triggers)) {
    for (let [encodedName, {nameActions, blockHeightTriggers}] of Object
             .entries(nameTrigs)) {
      eventEmitter.emit(emittedEvents.TELEGRAM_NAME_ALERT, {
        /**
         * @property {number} chatId
         * @property {string} encodedName
         * @property {NameAction[]} nameActions
         * @property {NameAlertBlockHeightTrigger[]}
         */
        chatId: parseInt(chatId),
        encodedName,
        nameActions,
        blockHeightTriggers
      });
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
  const relevantNames = new Set(await getDistinctNameAlertTargetNames());
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
    where: {blockHeight: {[Op.lte]: blockHeight}, didFire: false},
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

async function fireMatchingTelegramBlockHeightAlerts(
    blockHeight, eventEmitter) {
  // Find alerts that:
  // - haven't fired
  // - set to fire on current or earlier block height
  const alerts = await TelegramBlockHeightAlert.findAll(
      {where: {blockHeight: {[Op.lte]: blockHeight}, didFire: false}});

  for (let alert of alerts) {
    const context = quietJsonParse(alert.contextJson);

    // Deliver event
    eventEmitter.emit(emittedEvents.TELEGRAM_BLOCK_HEIGHT_ALERT, {
      /**
       * @property {number} chatId
       * @property {number} blockHeight
       * @property {string} alertType
       * @property {Object} context
       */
      chatId: alert.chatId,
      blockHeight: alert.blockHeight,
      alertType: alert.alertType,
      context
    });

    // Mark as delivered
    alert.didFire = true;
    await alert.save();
  }
}


/**
 * Get target names for all name alerts for particular Telegram chat
 *
 * @param {number} chatId
 * @returns {string[]} list of names
 */
async function getTelegramNameAlerts(chatId) {
  const alerts = await TelegramNameAlert.findAll({where: {chatId}});
  return alerts.map(a => a.targetName);
}

async function getTelegramNameAlert(chatId, encodedName) {
  const alert = await TelegramNameAlert.findOne(
      {where: {chatId, targetName: encodedName}});

  if (!alert) {
    return null;
  }

  // Load triggers separately because
  // i can't figure out syntax for eager loading with ordering while having
  // models under aliases
  // fml
  const triggers = await NameAlertBlockHeightTrigger.findAll({
    where: {alertId: alert.id, didFire: false},
    order: [['blockHeight', 'ASC']]
  });

  return {blockHeightTriggers: triggers};
}

async function getTelegramBlockHeightAlerts(chatId) {
  const alerts = await TelegramBlockHeightAlert.findAll(
      {where: {chatId, didFire: false}, order: [['blockHeight', 'ASC']]});
  return alerts.map(
      (a) => ({blockHeight: a.blockHeight, alertType: a.alertType}));
}


/**
 * Create, list, delete telegram alerts
 */
class TelegramAlertManager extends EventEmitter {
  constructor(hnsQuery) {
    super();
    this.hnsQuery = hnsQuery;

    // Hack? You betcha.
    this.createTelegramBlockHeightAlert = createTelegramBlockHeightAlert;
    this.deleteTelegramBlockHeightAlert = deleteTelegramBlockHeightAlert;
    this.getTelegramNameAlerts = getTelegramNameAlerts;
    this.getTelegramBlockHeightAlerts = getTelegramBlockHeightAlerts;
    this.getTelegramNameAlert = getTelegramNameAlert;
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
   * @param {Object} newBlockEvt
   */
  async processNewBlock(newBlockEvt) {
    // Update triggers as necessary
    await updateNameAlertTriggersOnNewBlock(
        newBlockEvt.nameActions, newBlockEvt.blockHeight,
        async (name) => this.hnsQuery.getNameInfo(name));

    // Fire matching name alert triggers
    await fireMatchingTelegramNameAlerts(
        newBlockEvt.nameActions, newBlockEvt.blockHeight, this);

    // Fire matching block height alerts
    await fireMatchingTelegramBlockHeightAlerts(newBlockEvt.blockHeight, this);
  }

  /**
   * Subscribe to events
   */
  start() {
    this.hnsQuery.on(
        handshakeEvents.NEW_BLOCK, async (evt) => this.processNewBlock(evt));
  }
}

module.exports = {
  emittedEvents,
  createTelegramNameAlert,
  createTelegramBlockHeightAlert,
  updateNameAlertTriggersOnNewBlock,
  findMatchingNameActionTriggers,
  findMatchingBlockHeightTriggers,
  fireMatchingTelegramNameAlerts,
  fireMatchingTelegramBlockHeightAlerts,
  TelegramAlertManager
};