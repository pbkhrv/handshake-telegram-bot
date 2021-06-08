const db = require('../db');
const {createTelegramNameAlert, updateNameAlertTriggersOnNewBlock} =
    require('../alerts');
const {calculateAllFutureMilestones} = require('../namestate');
const {NewBlockEvent} = require('../handshake');
const {OpenAuctionNameAction} = require('../nameactions');

const blockHeightAuctionOpen = 62517;

/* Fixtures */
const nameInfoEmpty = {
  'start': {'reserved': false, 'week': 13, 'start': 15120},
  'info': null
};

const nameInfoOpening =
    {
      'start': {'reserved': false, 'week': 13, 'start': 15120},
      'info': {
        'name': 'ocer',
        'nameHash':
            '952f1c3e3ed55ca92e16ccbe806ae59173b8c86a2c4119aab8673c43c3fa1a90',
        'state': 'OPENING',
        'height': blockHeightAuctionOpen,
        'renewal': blockHeightAuctionOpen,
        'owner': {'hash': '', 'index': 4294967295},
        'value': 0,
        'highest': 0,
        'data': '',
        'transfer': 0,
        'revoked': 0,
        'claimed': 0,
        'renewals': 0,
        'registered': false,
        'expired': false,
        'weak': false,
        'stats': {
          'openPeriodStart': blockHeightAuctionOpen,
          'openPeriodEnd': blockHeightAuctionOpen + 720,
          'blocksUntilBidding': 720,
          'hoursUntilBidding': 120
        }
      }
    }

/* Helpers */

async function
reinitDb() {
  await db.init('sqlite::memory:', {isQuietReinit: true});
  await db.recreateAllTables();
}


/* Tests */

test('create telegram name alert', async () => {
  await reinitDb();
  const chatId = 'chat123';
  const targetName = 'ocer';
  const currentBlockHeight = blockHeightAuctionOpen;

  await createTelegramNameAlert(
      chatId, targetName, currentBlockHeight, nameInfoOpening);

  const alert = await db.TelegramNameAlert.findOne(
      {where: {chatId, targetName}, include: 'blockHeightTriggers'});

  expect(alert).toBeDefined();
  console.log(JSON.stringify(alert, null, 2));

  const milestones =
      calculateAllFutureMilestones(nameInfoOpening, currentBlockHeight);
  expect(alert.blockHeightTriggers?.length).toBe(milestones.length);
})

test('update name alert triggers on new block', async () => {
  await reinitDb();
  const chatId = 123;
  const name = nameInfoOpening.info.name;
  const nameOther = 'other';
  const nameHash = nameInfoOpening.info.nameHash;
  const currentBlockHeight = blockHeightAuctionOpen - 1;

  // Create initial alerts with no triggers
  await createTelegramNameAlert(
      chatId, name, currentBlockHeight, nameInfoEmpty);

  await createTelegramNameAlert(
      chatId + 1, name, currentBlockHeight, nameInfoEmpty);

  await createTelegramNameAlert(
      chatId, nameOther, currentBlockHeight, nameInfoEmpty);

  // All alerts have no block height triggers
  const alert1 = await db.TelegramNameAlert.findOne(
      {where: {chatId, targetName: name}, include: 'blockHeightTriggers'});

  expect(alert1.blockHeightTriggers.length).toBe(0);

  const alert2 = await db.TelegramNameAlert.findOne({
    where: {chatId: chatId + 1, targetName: name},
    include: 'blockHeightTriggers'
  });

  expect(alert2.blockHeightTriggers.length).toBe(0);

  let alert3 = await db.TelegramNameAlert.findOne({
    where: {chatId: chatId, targetName: nameOther},
    include: 'blockHeightTriggers'
  });

  expect(alert3.blockHeightTriggers.length).toBe(0);

  // Name auction has been opened
  const bcInfo = {blocks: blockHeightAuctionOpen};
  const nameActions = [new OpenAuctionNameAction(nameHash, name)];

  const newBlockEvt = new NewBlockEvent(bcInfo, nameActions);
  const nameInfos = {[name]: nameInfoOpening};

  await updateNameAlertTriggersOnNewBlock(
      newBlockEvt, async (n) => (nameInfos[n]));

  // two alerts should now have block height triggers for bidding etc
  const triggers1 = await db.NameAlertBlockHeightTrigger.findAll(
      {where: {alertId: alert1.id}});
  const triggers2 = await db.NameAlertBlockHeightTrigger.findAll(
      {where: {alertId: alert2.id}});
  const milestones =
      calculateAllFutureMilestones(nameInfoOpening, blockHeightAuctionOpen);
  expect(triggers1.length).toBe(milestones.length);
      calculateAllFutureMilestones(nameInfoOpening, blockHeightAuctionOpen);
  expect(triggers2.length).toBe(milestones.length);

  // last alert should stay unchanged
  alert3 = await db.TelegramNameAlert.findOne({
    where: {chatId: chatId, targetName: nameOther},
    include: 'blockHeightTriggers'
  });

  expect(alert3.blockHeightTriggers.length).toBe(0);
});
