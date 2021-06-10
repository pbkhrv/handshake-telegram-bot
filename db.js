const {Sequelize, DataTypes, Model} = require('sequelize');

/**
 * @file Database layer using the sequelize ORM
 *
 * WARNING: this is one giant singleton hack.
 * Each model is database-connection dependent.
 * You can only use this with one database connection.
 * You can only initialize the database once per application's life.
 * If you need to recreate tables (between unit tests, for instance),
 * see the function on the bottom
 */

/**
 * Alert created by a Telegram user for a specific Handshake name
 *
 * This alert is triggered by two things:
 * - blockchain transaction with a covenant that matches the name
 * - block of a certain height was mined (see the trigger class below)
 *
 * @typedef {Object} TelegramNameAlert
 * @property {number} chatId
 * @property {string} targetName
 */
class TelegramNameAlert extends Model {}

const schemaNameTelegramAlert = {
  // Telegram chat id that this alert was created for
  // and that will receive messages whenever this alert it's triggered
  chatId: {type: DataTypes.BIGINT, allowNull: false},

  // Handshake name that this alert was created for
  targetName: {type: DataTypes.STRING, allowNull: false}
};

/**
 * @classdesc Trigger for a name alert when some block height has been reached.
 *
 * This block height is tied to a specific milestone in the context of the name,
 * like "name auction closed" or "registration is expired".
 * One name alert can have many block height triggers.
 *
 * @typedef NameAlertBlockHeightTrigger
 * @property {number} blockHeight
 * @property {string} nsMilestone
 * @property {boolean} didFire
 * @property {number} alertId
 */
class NameAlertBlockHeightTrigger extends Model {}

const schemaNameAlertBlockHeightTrigger = {
  // Block height that should trigger the alert
  blockHeight: {type: DataTypes.INTEGER, allowNull: false},

  // Name state "milestone" associated with this block height
  nsMilestone: {type: DataTypes.STRING, allowNull: false},

  // Whether this trigger has fired already
  // This is to prevent multiple messages being sent for the same trigger
  didFire: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false}
};


let sequelize = null;

/**
 * Initialize database connection and create tables
 *
 * @param {string} connectionString
 */
async function init(connectionString, isQueitReinit = false) {
  if (sequelize) {
    if (!isQueitReinit) {
      throw new Error('Cannot re-initialize database connection');
    } else {
      return;
    }
  }

  // Connect to db
  sequelize = new Sequelize(connectionString);
  await sequelize.authenticate();

  // Init name alert models
  TelegramNameAlert.init(
      schemaNameTelegramAlert,
      {sequelize: sequelize, modelName: 'TelegramNameAlert'});

  NameAlertBlockHeightTrigger.init(
      schemaNameAlertBlockHeightTrigger,
      {sequelize: sequelize, modelName: 'NameAlertBlockHeightTrigger'});

  TelegramNameAlert.hasMany(
      NameAlertBlockHeightTrigger,
      {as: 'blockHeightTriggers', onDelete: 'CASCADE', foreignKey: 'alertId'});
  NameAlertBlockHeightTrigger.belongsTo(TelegramNameAlert, {as: 'alert'});

  // Create schema
  await sequelize.sync();
}

/**
 * Re-create tables for all models that were defined via this connection
 */
async function recreateAllTables() {
  if (!sequelize) {
    throw new Error('Cannot recreate tables via un-initialized connection');
  }

  await sequelize.sync({force: true});
}

module.exports = {
  TelegramNameAlert,
  NameAlertBlockHeightTrigger,
  init,
  recreateAllTables
};