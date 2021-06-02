const {calculateNameState, nameStates} = require('../handshake');

test('namestate: reserved, unregistered', () => {
  const nameInfo = {
    'start': {'reserved': true, 'week': 31, 'start': 33264},
    'info': null
  };

  expect(calculateNameState(nameInfo)).toBe(nameStates.UNAVAIL_RESERVED);
});

test('namestate: reserved, being claimed', () => {
  const nameInfo = {
    'start': {'reserved': true, 'week': 24, 'start': 26208},
    'info': {
      'name': '',
      'nameHash': '',
      'state': 'LOCKED',
      'height': 67610,
      'renewal': 67610,
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
        'lockupPeriodStart': 67610,
        'lockupPeriodEnd': 71930,
        'blocksUntilClosed': 2347,
        'hoursUntilClosed': 391.17
      }
    }
  };

  expect(calculateNameState(nameInfo)).toBe(nameStates.UNAVAIL_CLAIMING);
});

test('namestate: never registered, not reserved', () => {
  const nameInfo = {
    'start': {'reserved': false, 'week': 25, 'start': 27216},
    'info': null
  };

  expect(calculateNameState(nameInfo)).toBe(nameStates.AVAIL_NEVER_REGISTERED);
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

  expect(calculateNameState(nameInfo)).toBe(nameStates.AVAIL_NOT_RENEWED);
});

test('namestate: opening', () => {
  const nameInfo = {
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
  };

  expect(calculateNameState(nameInfo)).toBe(nameStates.AUCTION_OPENING);
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

  expect(calculateNameState(nameInfo)).toBe(nameStates.AUCTION_BIDDING);
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

  expect(calculateNameState(nameInfo)).toBe(nameStates.AUCTION_REVEAL);
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

  expect(calculateNameState(nameInfo)).toBe(nameStates.UNAVAIL_CLOSED);
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

  expect(calculateNameState(nameInfo)).toBe(nameStates.UNAVAIL_CLOSED);
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

  expect(calculateNameState(nameInfo)).toBe(nameStates.UNAVAIL_CLOSED);
});