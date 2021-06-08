const {TelegramNameAlert, NameAlertBlockHeightTrigger} = require('./db');
const {calculateAllFutureMilestones} = require('./namestate');
const sequelize = require('sequelize');
const {
  ClaimNameAction,
  OpenAuctionNameAction,
  RegisterNameAction,
  RenewNameAction
} = require('./nameactions');


/**
 * Create new Telegram alert and triggers for a Handshake name
 *
 * @param {string} chatId Telegram chat id to send alerts to
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
 * Update name alert triggers based on new name actions
 *
 * @param {NewBlockEvent} newBlockEvt
 * @param {function} nameInfoCb async name info lookup callback
 */
async function updateNameAlertTriggersOnNewBlock(newBlockEvt, nameInfoCb) {
  // We are only interested in names for which we have alerts
  const alertNames = await TelegramNameAlert.findAll({
    attributes:
        [[sequelize.fn('DISTINCT', sequelize.col('targetName')), 'targetName']]
  });
  const relevantNames = alertNames.map(alert => alert.targetName);
  let nameActions =
      newBlockEvt.nameActions.filter(na => relevantNames.includes(na.name));

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


module.exports = {
  createTelegramNameAlert,
  updateNameAlertTriggersOnNewBlock
};