exports.nameInfos = {};

exports.nameInfos.opening = {
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

exports.nameInfos.noAuction = {
  'start': {'reserved': false, 'week': 33, 'start': 35280},
  'info': null
};

exports.nameInfos.reserved = {
  'start': {'reserved': true, 'week': 33, 'start': 35280},
  'info': null
};

exports.nameInfos.locked = {
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

exports.nameInfos.reservedRegd = {
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

exports.nameInfos.notRenewed = {
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

exports.nameInfos.transferring = {
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

exports.nameInfos.bidding = {
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

exports.nameInfos.inReveal = {
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

exports.nameInfos.closed = {
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

exports.nameInfos.resdClmdUnregd = {
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

exports.txoutBid = {
  'value': 16.01,
  'n': 0,
  'address': {
    'version': 0,
    'hash': '7e8b9bd5d556159e47c63e5ab1f1255d2b42bb79',
    'string': 'hs1q069eh4w42c2eu37x8edtruf9t5459wme8k684g'
  },
  'covenant': {
    'type': 3,
    'action': 'BID',
    'items': [
      'dddec8590b724da53d102b251978df3d242bb53994ea13217c793f070cd5172f',
      '43f10000', '6d6f766965626f78',
      '0d27c295f40b057b709945b37dcbce46cb5952ff954528718069d7e46c2d3860'
    ]
  }
};