const {TelegramNameAlert, NameAlertBlockHeightTrigger} = require('./db');
const {
  calculateAuctionMilestones,
  calculateLockupMilestones,
  calculateRenewalMilestones
} = require('./namestate');


/*
async function updateFutureTriggersForAlertsOnName(currentBlockHeight,
targetName) { const alerts = await
TelegramNameAlert.findAll({where: {targetName}});

  if (alerts) {
    const nameInfo = await getNameInfo(targetName);
    for (let alert of alerts) {
      const triggers =
          calculateFutureTriggers(hsNet, currentBlockHeights, nameInfo);
      alert.triggers = triggers;
      await alertDb.saveAlert(alert);
    }
  }
}
*/

/**
 * Create new Telegram alert for a Handshake name and all associated triggers
 *
 * @param {string} chatId Telegram chat id to send alerts to
 * @param {string} targetName Handshake name to watch
 * @param {number} currentBlockHeight
 * @param {Object} nameInfo current state info of the name that we'll be
 *     watching
 */
async function createTelegramNameAlert(
    chatId, targetName, currentBlockHeight, nameInfo) {
  const alert = await TelegramNameAlert.create({chatId, targetName});
  const triggers = calculateFutureNameTriggers(currentBlockHeight, nameInfo);

  for (let {blockHeight, nsMilestone} of triggers) {
    await NameAlertBlockHeightTrigger.create(
        {blockHeight, nsMilestone, didFire: false, alertId: alert.id});
  }
}

module.exports = {
	calculateFutureNameTriggers
}