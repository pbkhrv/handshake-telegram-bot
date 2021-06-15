const sequelize = require('sequelize');
const {StatsReceivedCommand, TelegramNameAlert} = require('./db');

async function logReceivedCommand(chatId, command, extraParam = null) {
  try {
    await StatsReceivedCommand.create({chatId, command, extraParam});
  } catch (error) {
    console.error('logReceivedCommand error', error);
  }
}

async function uniqueChats() {
  const chatIds = await StatsReceivedCommand.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('chatId')), 'chatId']]
  });
  // Because i cant figure out sequelize?
  return chatIds.length;
}

async function commandCounts() {
  const rows = await StatsReceivedCommand.findAll({
    attributes:
        ['command', [sequelize.fn('COUNT', sequelize.col('command')), 'count']],
    group: sequelize.col('command')
  });
  return rows.map(r => r.dataValues);
}

async function activeNameAlerts() {
  return await TelegramNameAlert.count();
}

module.exports = {
  logReceivedCommand,
  uniqueChats,
  commandCounts,
  activeNameAlerts
};