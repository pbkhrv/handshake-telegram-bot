const {
  nsMilestones,
  calculateAuctionMilestones,
  calculateLockupMilestones,
  calculateRenewalMilestones,
	calculateAllFutureMilestones
} = require('../namestate');

/* Fixtures */

const nameInfoOpening = {
  'start': {'reserved': false, 'week': 13, 'start': 15120},
  'info': {
    'name': '',
    'nameHash': '',
    'state': 'OPENING',
    'height': 69583,
    'renewal': 69583,
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
      'openPeriodStart': 69583,
      'openPeriodEnd': 69620,
      'blocksUntilBidding': 37,
      'hoursUntilBidding': 6.17
    }
  }
}

const nameInfoNoAuction = {
  'start': {'reserved': false, 'week': 33, 'start': 35280},
  'info': null
};


const nameInfoLockup = {
  'start': {'reserved': true, 'week': 24, 'start': 26208},
  'info': {
    'name': '',
    'nameHash': '',
    'state': 'LOCKED',
    'height': 68610,
    'renewal': 68610,
    'owner': {'hash': '', 'index': 1},
    'value': 0,
    'highest': 0,
    'data': '',
    'transfer': 0,
    'revoked': 0,
    'claimed': 1,
    'renewals': 0,
    'registered': false,
    'expired': false,
    'weak': true,
    'stats': {
      'lockupPeriodStart': 68610,
      'lockupPeriodEnd': 72930,
      'blocksUntilClosed': 1354,
      'hoursUntilClosed': 225.67
    }
  }
};

const nameInfoRegd = {
  'start': {'reserved': true, 'week': 9, 'start': 11088},
  'info': {
    'name': '',
    'nameHash': '',
    'state': 'CLOSED',
    'height': 22913,
    'renewal': 30015,
    'owner': {'hash': '', 'index': 0},
    'value': 0,
    'highest': 0,
    'data': '00',
    'transfer': 0,
    'revoked': 0,
    'claimed': 1,
    'renewals': 0,
    'registered': true,
    'expired': false,
    'weak': true,
    'stats': {
      'renewalPeriodStart': 30015,
      'renewalPeriodEnd': 135135,
      'blocksUntilExpire': 64553,
      'daysUntilExpire': 448.28
    }
  }
};


/* Tests */

test('milestones for an auction', () => {
  const ms = calculateAuctionMilestones(nameInfoOpening);
  const milestone = (nsm) => ms.find((el) => (el.nsMilestone == nsm));

  expect(ms.length).toBe(4);
  expect(milestone(nsMilestones.AUCTION_OPENING).blockHeight).toBe(69583);
  expect(milestone(nsMilestones.AUCTION_BIDDING).blockHeight).toBe(69620);
  expect(milestone(nsMilestones.AUCTION_REVEAL).blockHeight).toBe(70340);
  expect(milestone(nsMilestones.AUCTION_CLOSED).blockHeight).toBe(71780);
});

test('no auction milestones if no auction', () => {
  const ms = calculateAuctionMilestones(nameInfoNoAuction);

  expect(ms.length).toBe(0);
});

test('milestones for a locked up name', () => {
  const ms = calculateLockupMilestones(nameInfoLockup);
  const milestone = (nsm) => ms.find((el) => (el.nsMilestone == nsm));

  expect(ms.length).toBe(2);
  expect(milestone(nsMilestones.NAME_LOCKED).blockHeight).toBe(68610);
  expect(milestone(nsMilestones.NAME_UNLOCKED).blockHeight).toBe(72930);
});

test('milestones for a registered name', () => {
  const ms = calculateRenewalMilestones(nameInfoRegd);
  const milestone = (nsm) => ms.find((el) => (el.nsMilestone == nsm));

  expect(ms.length).toBe(1);
  expect(milestone(nsMilestones.REGISTRATION_EXPIRED).blockHeight).toBe(135135);
});

test('all milestones after given block height', () => {
	const blockHeight = 71779;
	const ms = calculateAllFutureMilestones(nameInfoOpening, blockHeight);
	expect(ms.length).toBe(1);
	const m = ms[0];
	expect(m.blockHeight).toBeGreaterThanOrEqual(blockHeight);
})