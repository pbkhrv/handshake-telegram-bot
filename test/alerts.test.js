const db = require('../db');
const {
  createTelegramNameAlert,
  updateNameAlertTriggersOnNewBlock,
  findMatchingNameActionTriggers,
  findMatchingBlockHeightTriggers,
  fireMatchingTelegramNameAlerts,
  events,
  createTelegramBlockHeightAlert,
  fireMatchingTelegramBlockHeightAlerts
} = require('../alerts');
const {calculateAllFutureMilestones, nsMilestones} = require('../namestate');
const {NewBlockEvent} = require('../handshake');
const {OpenAuctionNameAction, AuctionBidNameAction} = require('../nameactions');

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
          'openPeriodEnd': blockHeightAuctionOpen + 37,
          'blocksUntilBidding': 37,
          'hoursUntilBidding': 37 / 6
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
  const chatId = 123;
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

test('finds all firing name alerts based on name actions', async () => {
  await reinitDb();
  const chatId1 = 123;
  const chatId2 = 45;
  const name1 = 'name1';
  const name2 = 'name2';
  const name3 = 'name3';
  const currentBlockHeight = 1000;

  // Create initial alerts with no triggers
  await createTelegramNameAlert(
      chatId1, name1, currentBlockHeight, nameInfoEmpty);

  await createTelegramNameAlert(
      chatId1, name3, currentBlockHeight, nameInfoEmpty);

  await createTelegramNameAlert(
      chatId2, name2, currentBlockHeight, nameInfoEmpty);

  const nameActions = [
    new OpenAuctionNameAction('hash1', name1),
    new OpenAuctionNameAction('hash2', name2),
    new OpenAuctionNameAction('hash3', name3),
  ];

  const triggs = await findMatchingNameActionTriggers(nameActions);

  expect(Object.keys(triggs).length).toBe(2);
  expect(triggs[chatId1]).toBeTruthy();
  expect(triggs[chatId1][name1].length).toBe(1);
  expect(triggs[chatId1][name1][0].name).toBe(name1);
  expect(triggs[chatId1][name3].length).toBe(1);
  expect(triggs[chatId1][name3][0].name).toBe(name3);
  expect(triggs[chatId2]).toBeTruthy();
  expect(triggs[chatId2][name2].length).toBe(1);
  expect(triggs[chatId2][name2][0].name).toBe(name2);
});

test('finds all firing name alerts based on block height', async () => {
  await reinitDb();
  const chatId = 'asdf123';
  const targetName = 'ocer';
  const prevBlockHeight = nameInfoOpening.info.stats.openPeriodStart;

  await createTelegramNameAlert(
      chatId, targetName, prevBlockHeight, nameInfoOpening);

  await createTelegramNameAlert(
      chatId, 'othername', prevBlockHeight, nameInfoEmpty);

  const milestones =
      calculateAllFutureMilestones(nameInfoOpening, prevBlockHeight);
  const biddingPeriodStart =
      milestones.find(m => m.nsMilestone == nsMilestones.AUCTION_BIDDING)
          .blockHeight;

  const triggs = await findMatchingBlockHeightTriggers(biddingPeriodStart);

  expect(Object.keys(triggs).length).toBe(1);
  expect(triggs[chatId]).toBeTruthy();
  expect(triggs[chatId][targetName]).toBeTruthy();
  expect(triggs[chatId][targetName].length).toBe(1);
  expect(triggs[chatId][targetName][0].nsMilestone)
      .toBe(nsMilestones.AUCTION_BIDDING);
  expect(triggs[chatId][targetName][0].blockHeight).toBe(biddingPeriodStart);
});

test('fires all matching telegram name alerts', async () => {
  await reinitDb();
  const chatId = 123;
  const targetName = 'ocer';
  const prevBlockHeight = nameInfoOpening.info.stats.openPeriodStart;

  // Create 2 alerts, one of which we'll trigger later
  await createTelegramNameAlert(
      chatId, targetName, prevBlockHeight, nameInfoOpening);

  await createTelegramNameAlert(
      chatId, 'othername', prevBlockHeight, nameInfoEmpty);

  const milestones =
      calculateAllFutureMilestones(nameInfoOpening, prevBlockHeight);

  // We'll simulate getting to the bidding period
  const biddingPeriodStart =
      milestones.find(m => m.nsMilestone == nsMilestones.AUCTION_BIDDING)
          .blockHeight;

  // Simulate getting a name action that matches our target name
  const nameActions = [
    new AuctionBidNameAction('hash1', targetName, 10),
    new OpenAuctionNameAction('hash1', 'blahblah', 10)
  ];

  const emit = jest.fn((evt, arg) => true);

  await fireMatchingTelegramNameAlerts(nameActions, biddingPeriodStart, {emit});

  expect(emit.mock.calls.length).toBe(1);
  expect(emit.mock.calls[0][0]).toBe(events.TELEGRAM_NAME_ALERT);
  const evt = emit.mock.calls[0][1];
  expect(evt.chatId).toBe(chatId);
  expect(evt.encodedName).toBe(targetName);
  expect(evt.nameActions.length).toBe(1);
  expect(evt.nameActions[0]).toBe(nameActions[0]);
});

test('fires all matching telegram block height alerts', async () => {
  const chatId1 = 123;
  const chatId2 = 56;

  await createTelegramBlockHeightAlert(chatId1, 1000, "blockmined1000");
  await createTelegramBlockHeightAlert(chatId1, 1001, "blockmined1001");
  await createTelegramBlockHeightAlert(chatId2, 2000, "blockmined2000");

  let emit = jest.fn((evt, arg) => true);
  await fireMatchingTelegramBlockHeightAlerts(999, {emit});
  expect(emit.mock.calls.length).toBe(0);

  // Should pick up alert set for current block height
  emit = jest.fn((evt, arg) => true);
  await fireMatchingTelegramBlockHeightAlerts(1000, {emit});
  expect(emit.mock.calls.length).toBe(1);
  expect(emit.mock.calls[0][0]).toBe(events.TELEGRAM_BLOCK_HEIGHT_ALERT);
  expect(emit.mock.calls[0][1].chatId).toBe(chatId1);
  expect(emit.mock.calls[0][1].blockHeight).toBe(1000);
  expect(emit.mock.calls[0][1].alertType).toBe("blockmined1000");

  // Should pick up unfired alerts set for block height less than current
  emit = jest.fn((evt, arg) => true);
  await fireMatchingTelegramBlockHeightAlerts(5000, {emit});
  expect(emit.mock.calls.length).toBe(2);
  // first call
  expect(emit.mock.calls[0][0]).toBe(events.TELEGRAM_BLOCK_HEIGHT_ALERT);
  expect(emit.mock.calls[0][1].chatId).toBe(chatId1);
  expect(emit.mock.calls[0][1].blockHeight).toBe(1001);
  expect(emit.mock.calls[0][1].alertType).toBe("blockmined1001");
  // second call
  expect(emit.mock.calls[1][0]).toBe(events.TELEGRAM_BLOCK_HEIGHT_ALERT);
  expect(emit.mock.calls[1][1].chatId).toBe(chatId2);
  expect(emit.mock.calls[1][1].blockHeight).toBe(2000);
  expect(emit.mock.calls[1][1].alertType).toBe("blockmined2000");
});