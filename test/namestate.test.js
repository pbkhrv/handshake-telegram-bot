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


const nameInfoLocked = {
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
  const ms = calculateLockupMilestones(nameInfoLocked);
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
  expect(m.blockHeight).toBeGreaterThan(blockHeight);
})

test('milestones for a transferring name', () => {
  const nameInfo = {
    'start': {'reserved': true, 'week': 24, 'start': 26208},
    'info': {
      'name': 'newmessages',
      'nameHash':
          '81a8fc0f1d001528a5ec0eeb4bc97d62178ddae985d8699e2930939dd34cf490',
      'state': 'CLOSED',
      'height': 67610,
      'renewal': 71975,
      'owner': {
        'hash':
            'b04a20938377550896760abe4605171f83700f9f9101e86c1b02ae46c87bb7d1',
        'index': 0
      },
      'value': 0,
      'highest': 0,
      'data': '00',
      'transfer': 72136,
      'revoked': 0,
      'claimed': 1,
      'renewals': 0,
      'registered': true,
      'expired': false,
      'weak': true,
      'stats': {
        'renewalPeriodStart': 71975,
        'renewalPeriodEnd': 177095,
        'blocksUntilExpire': 104959,
        'daysUntilExpire': 728.88,
        'transferLockupStart': 72136,
        'transferLockupEnd': 72424,
        'blocksUntilValidFinalize': 288,
        'hoursUntilValidFinalize': 48
      }
    }
  };

  const ms = calculateTransferMilestones(nameInfo);
  const milestone = (nsm) => ms.find((el) => (el.nsMilestone == nsm));

  expect(ms.length).toBe(2);
  expect(milestone(nsMilestones.TRANSFER_IN_PROGRESS).blockHeight).toBe(72136);
  expect(milestone(nsMilestones.TRANSFER_FINALIZING).blockHeight).toBe(72424);
})

test('namestate: reserved, unregistered', () => {
  const nameInfo = {
    'start': {'reserved': true, 'week': 31, 'start': 33264},
    'info': null
  };

  expect(calculateNameAvail(nameInfo)).toBe(nameAvails.UNAVAIL_RESERVED);
});

test('namestate: reserved, being claimed', () => {
  expect(calculateNameAvail(nameInfoLocked)).toBe(nameAvails.UNAVAIL_CLAIMING);
});

test('namestate: never registered, not reserved', () => {
  expect(calculateNameAvail(nameInfoNoAuction))
      .toBe(nameAvails.AVAIL_NEVER_REGISTERED);
});

test('namestate: avail, not renewed', () => {
  const nameInfo = {
    'start': {'reserved': false, 'week': 29, 'start': 31248},
    'info': {
      'name': '',
      'nameHash': '',
      'state': 'CLOSED',
      'height': 66734,
      'renewal': 68933,
      'owner': {'hash': '', 'index': 37},
      'value': 0,
      'highest': 1000000000,
      'data': '',
      'transfer': 0,
      'revoked': 0,
      'claimed': 0,
      'renewals': 0,
      'registered': true,
      'expired': false,
      'weak': false,
      'stats': {
        'renewalPeriodStart': 68933,
        'renewalPeriodEnd': 174053,
        'blocksUntilExpire': -104485,
        'daysUntilExpire': -725.58
      }
    }
  };

  expect(calculateNameAvail(nameInfo)).toBe(nameAvails.AVAIL_NOT_RENEWED);
});

test('namestate: opening', () => {
  expect(calculateNameAvail(nameInfoOpening)).toBe(nameAvails.AUCTION_OPENING);
});

test('namestate: auction bidding', () => {
  const nameInfo = {
    'start': {'reserved': false, 'week': 0, 'start': 2016},
    'info': {
      'name': '',
      'nameHash': '',
      'state': 'BIDDING',
      'height': 68978,
      'renewal': 68978,
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
        'bidPeriodStart': 69015,
        'bidPeriodEnd': 69735,
        'blocksUntilReveal': 151,
        'hoursUntilReveal': 25.17
      }
    }
  };

  expect(calculateNameAvail(nameInfo)).toBe(nameAvails.AUCTION_BIDDING);
});

test('namestate: auction reveal', () => {
  const nameInfo = {
    'start': {'reserved': false, 'week': 39, 'start': 41328},
    'info': {
      'name': '',
      'nameHash': '',
      'state': 'REVEAL',
      'height': 67916,
      'renewal': 67916,
      'owner': {'hash': '', 'index': 25},
      'value': 400000,
      'highest': 10000100,
      'data': '',
      'transfer': 0,
      'revoked': 0,
      'claimed': 0,
      'renewals': 0,
      'registered': false,
      'expired': false,
      'weak': false,
      'stats': {
        'revealPeriodStart': 68673,
        'revealPeriodEnd': 70113,
        'blocksUntilClose': 530,
        'hoursUntilClose': 88.33
      }
    }
  };

  expect(calculateNameAvail(nameInfo)).toBe(nameAvails.AUCTION_REVEAL);
});

test('namestate: unreserved, registered', () => {
  const nameInfo = {
    'start': {'reserved': false, 'week': 10, 'start': 12096},
    'info': {
      'name': '',
      'nameHash': '',
      'state': 'CLOSED',
      'height': 12104,
      'renewal': 14302,
      'owner': {'hash': '', 'index': 0},
      'value': 55000000000,
      'highest': 150000000000,
      'data': '',
      'transfer': 0,
      'revoked': 0,
      'claimed': 0,
      'renewals': 0,
      'registered': true,
      'expired': false,
      'weak': false,
      'stats': {
        'renewalPeriodStart': 14302,
        'renewalPeriodEnd': 119422,
        'blocksUntilExpire': 49787,
        'daysUntilExpire': 345.74
      }
    }
  };

  expect(calculateNameAvail(nameInfo)).toBe(nameAvails.UNAVAIL_CLOSED);
});

test('namestate: reserved, claimed but not registered', () => {
  const nameInfo = {
    'start': {'reserved': true, 'week': 7, 'start': 9072},
    'info': {
      'name': 'namecheap',
      'nameHash': '',
      'state': 'CLOSED',
      'height': 62517,
      'renewal': 62517,
      'owner': {'hash': '', 'index': 2},
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
        'renewalPeriodStart': 62517,
        'renewalPeriodEnd': 167637,
        'blocksUntilExpire': 98002,
        'daysUntilExpire': 680.57
      }
    }
  };

  expect(calculateNameAvail(nameInfo)).toBe(nameAvails.UNAVAIL_CLOSED);
});

test('namestate: reserved, claimed, registered', () => {
  const nameInfo = {
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
        'blocksUntilExpire': 65500,
        'daysUntilExpire': 454.86
      }
    }
  };

  expect(calculateNameAvail(nameInfo)).toBe(nameAvails.UNAVAIL_CLOSED);
});


test('name is being transferred', () => {
  const nameInfo = {
    'start': {'reserved': true, 'week': 24, 'start': 26208},
    'info': {
      'name': 'newmessages',
      'nameHash':
          '81a8fc0f1d001528a5ec0eeb4bc97d62178ddae985d8699e2930939dd34cf490',
      'state': 'CLOSED',
      'height': 67610,
      'renewal': 71975,
      'owner': {
        'hash':
            'b04a20938377550896760abe4605171f83700f9f9101e86c1b02ae46c87bb7d1',
        'index': 0
      },
      'value': 0,
      'highest': 0,
      'data': '00',
      'transfer': 72136,
      'revoked': 0,
      'claimed': 1,
      'renewals': 0,
      'registered': true,
      'expired': false,
      'weak': true,
      'stats': {
        'renewalPeriodStart': 71975,
        'renewalPeriodEnd': 177095,
        'blocksUntilExpire': 104959,
        'daysUntilExpire': 728.88,
        'transferLockupStart': 72136,
        'transferLockupEnd': 72424,
        'blocksUntilValidFinalize': 288,
        'hoursUntilValidFinalize': 48
      }
    }
  };

  expect(calculateNameAvail(nameInfo)).toBe(nameAvails.UNAVAIL_TRANSFERRING);
});