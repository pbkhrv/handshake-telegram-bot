const {
  nsMilestones,
  nameAvails,
  calculateAuctionMilestones,
  calculateLockupMilestones,
  calculateRenewalMilestones,
  calculateAllFutureMilestones,
  calculateTransferMilestones,
  calculateNameAvail
} = require('../src/namestate');

const {nameInfos} = require('./fixtures');


/* Tests */

test('milestones for an auction', () => {
  const ms = calculateAuctionMilestones(nameInfos.opening);
  const milestone = (nsm) => ms.find((el) => (el.nsMilestone == nsm));

  expect(ms.length).toBe(4);
  expect(milestone(nsMilestones.AUCTION_OPENING).blockHeight).toBe(69583);
  expect(milestone(nsMilestones.AUCTION_BIDDING).blockHeight).toBe(69620);
  expect(milestone(nsMilestones.AUCTION_REVEAL).blockHeight).toBe(70340);
  expect(milestone(nsMilestones.AUCTION_CLOSED).blockHeight).toBe(71780);
});

test('no auction milestones if no auction', () => {
  const ms = calculateAuctionMilestones(nameInfos.noAuction);

  expect(ms.length).toBe(0);
});

test('milestones for a locked up name', () => {
  const ms = calculateLockupMilestones(nameInfos.locked);
  const milestone = (nsm) => ms.find((el) => (el.nsMilestone == nsm));

  expect(ms.length).toBe(2);
  expect(milestone(nsMilestones.NAME_LOCKED).blockHeight).toBe(68610);
  expect(milestone(nsMilestones.NAME_UNLOCKED).blockHeight).toBe(72930);
});

test('milestones for a registered name', () => {
  const ms = calculateRenewalMilestones(nameInfos.reservedRegd);
  const milestone = (nsm) => ms.find((el) => (el.nsMilestone == nsm));

  expect(ms.length).toBe(1);
  expect(milestone(nsMilestones.REGISTRATION_EXPIRED).blockHeight).toBe(135135);
});

test('all milestones after given block height', () => {
  const blockHeight = 71779;
  const ms = calculateAllFutureMilestones(nameInfos.opening, blockHeight);
  expect(ms.length).toBe(1);
  const m = ms[0];
  expect(m.blockHeight).toBeGreaterThan(blockHeight);
})

test('milestones for a transferring name', () => {
  const ms = calculateTransferMilestones(nameInfos.transferring);
  const milestone = (nsm) => ms.find((el) => (el.nsMilestone == nsm));

  expect(ms.length).toBe(2);
  expect(milestone(nsMilestones.TRANSFER_IN_PROGRESS).blockHeight).toBe(72136);
  expect(milestone(nsMilestones.TRANSFER_FINALIZING).blockHeight).toBe(72424);
})

test('namestate: reserved, unregistered', () => {
  expect(calculateNameAvail(nameInfos.reserved))
      .toBe(nameAvails.UNAVAIL_RESERVED);
});

test('namestate: reserved, being claimed', () => {
  expect(calculateNameAvail(nameInfos.locked)).toBe(nameAvails.UNAVAIL_CLAIMING);
});

test('namestate: never registered, not reserved', () => {
  expect(calculateNameAvail(nameInfos.noAuction))
      .toBe(nameAvails.AVAIL_NEVER_REGISTERED);
});

test('namestate: avail, not renewed', () => {
  expect(calculateNameAvail(nameInfos.notRenewed))
      .toBe(nameAvails.AVAIL_NOT_RENEWED);
});

test('namestate: opening', () => {
  expect(calculateNameAvail(nameInfos.opening)).toBe(nameAvails.AUCTION_OPENING);
});

test('namestate: auction bidding', () => {
  expect(calculateNameAvail(nameInfos.bidding)).toBe(nameAvails.AUCTION_BIDDING);
});

test('namestate: auction reveal', () => {
  expect(calculateNameAvail(nameInfos.inReveal)).toBe(nameAvails.AUCTION_REVEAL);
});

test('namestate: unreserved, registered', () => {
  expect(calculateNameAvail(nameInfos.closed)).toBe(nameAvails.UNAVAIL_CLOSED);
});

test('namestate: reserved, claimed but not registered', () => {
  expect(calculateNameAvail(nameInfos.resdClmdUnregd))
      .toBe(nameAvails.UNAVAIL_CLOSED);
});

test('namestate: reserved, claimed, registered', () => {
  expect(calculateNameAvail(nameInfos.reservedRegd))
      .toBe(nameAvails.UNAVAIL_CLOSED);
});


test('name is being transferred', () => {
  expect(calculateNameAvail(nameInfos.transferring))
      .toBe(nameAvails.UNAVAIL_TRANSFERRING);
});