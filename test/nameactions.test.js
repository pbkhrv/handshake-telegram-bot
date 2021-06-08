const fs = require('fs');


const {
  ClaimNameAction,
  OpenAuctionNameAction,
  AuctionBidNameAction,
  AuctionRevealNameAction,
  RegisterNameAction,
  RenewNameAction,
  getNameActionFromTxout,
  getNameActionsFromBlock
} = require('../nameactions');

test('extract values from CLAIM covenant', () => {
  const vout = {
    'value': 2720503.385487,
    'n': 2,
    'address': {
      'version': 0,
      'hash': '82f68da64ce03b33942890e4a7170496c700ff23',
      'string': 'hs1qstmgmfjvuqan89pgjrj2w9cyjmrsplerhsufst'
    },
    'covenant': {
      'type': 1,
      'action': 'CLAIM',
      'items': [
        '7b504982ea98af85bad61fe98851dafe1b8ef5d0c3a0da7865839dd876220a0b',
        '35f40000', '6e616d656368656170', '01',
        '0000000000a5e40e8ba291bd7e8649747fa7fb8a7af39f5bacdb7433cd2f5971',
        '01000000'
      ]
    }
  };

  const action = ClaimNameAction.fromJSON(vout);

  expect(action instanceof ClaimNameAction).toBeTruthy();
  expect(action.value).toBe(2720503.385487);
  expect(action.name).toBe('namecheap');
  expect(action.nameHash)
      .toBe('7b504982ea98af85bad61fe98851dafe1b8ef5d0c3a0da7865839dd876220a0b')

  expect(getNameActionFromTxout(vout)).toStrictEqual(action);
});


test('extract action from OPEN covenant', () => {
  const vout = {
    'value': 0,
    'n': 0,
    'address': {
      'version': 0,
      'hash': '34493644a905d817b0db072d8c808b98eeca360a',
      'string': 'hs1qx3ynv39fqhvp0vxmqukceqytnrhv5ds24tqawt'
    },
    'covenant': {
      'type': 2,
      'action': 'OPEN',
      'items': [
        '952f1c3e3ed55ca92e16ccbe806ae59173b8c86a2c4119aab8673c43c3fa1a90',
        '00000000', '6f636572'
      ]
    }
  };

  const action = OpenAuctionNameAction.fromJSON(vout);
  expect(action instanceof OpenAuctionNameAction).toBeTruthy();
  expect(action.name).toBe('ocer');
  expect(action.nameHash)
      .toBe('952f1c3e3ed55ca92e16ccbe806ae59173b8c86a2c4119aab8673c43c3fa1a90');
  expect(getNameActionFromTxout(vout)).toStrictEqual(action);
});

test('extract action from BID covenant', () => {
  const vout = {
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

  const action = AuctionBidNameAction.fromJSON(vout);
  expect(action instanceof AuctionBidNameAction).toBeTruthy();
  expect(action.nameHash)
      .toBe('dddec8590b724da53d102b251978df3d242bb53994ea13217c793f070cd5172f');
  expect(action.name).toBe('moviebox');
  expect(action.lockupAmount).toBe(16.01);
  expect(getNameActionFromTxout(vout)).toStrictEqual(action);
});


test('extract action from REVEAL covenant', () => {
  const vout = {
    'value': 5.01,
    'n': 0,
    'address': {
      'version': 0,
      'hash': '7e531db90896d5a1480281c49440f3d77f294fb6',
      'string': 'hs1q0ef3mwggjm26zjqzs8zfgs8n6aljjnak7hs3na'
    },
    'covenant': {
      'type': 4,
      'action': 'REVEAL',
      'items': [
        '5fe8fb5e547d3959e28d6764324ee170743d8c39d664b91d37df1d4f4c65a171',
        '32070100',
        '000005f8b5dccada41403dcedba36945bf7decbbfaf43b591d87da7f4d5be067'
      ]
    }
  };

  const action = AuctionRevealNameAction.fromJSON(vout);
  expect(action instanceof AuctionRevealNameAction).toBeTruthy();
  expect(action.nameHash)
      .toBe('5fe8fb5e547d3959e28d6764324ee170743d8c39d664b91d37df1d4f4c65a171');
  expect(action.bidAmount).toBe(5.01);
  expect(getNameActionFromTxout(vout)).toStrictEqual(action);
});


test('extract action from REGISTER covenant', () => {
  const vout = {
    'value': 58,
    'n': 4,
    'address': {
      'version': 0,
      'hash': 'd8ba94386f1b5cc6484f96a818d764ceb8ae9201',
      'string': 'hs1qmzafgwr0rdwvvjz0j65p34mye6u2ayspd2wwec'
    },
    'covenant': {
      'type': 6,
      'action': 'REGISTER',
      'items': [
        'fdb4c543ea60246a8a647c82ab2c29f67c5d85293462f578b14138005e92983a',
        'edfe0000', '0002036e73310b786e2d2d6c793562383070002ce706b701c002',
        '0000000000000000742c8042723937f768ffec86f719e61e7033607e241f56fa'
      ]
    }
  }

  const action = RegisterNameAction.fromJSON(vout);
  expect(action instanceof RegisterNameAction).toBeTruthy();
  expect(action.nameHash)
      .toBe('fdb4c543ea60246a8a647c82ab2c29f67c5d85293462f578b14138005e92983a');
  expect(action.burnedValue).toBe(58);
  expect(getNameActionFromTxout(vout)).toStrictEqual(action);
});


test('extract action from RENEW covenant', () => {
  // Not a real example, only the keys we care about
  const vout = {
    'covenant': {
      'type': 8,
      'action': 'RENEW',
      'items':
          ['fdb4c543ea60246a8a647c82ab2c29f67c5d85293462f578b14138005e92983a']
    }
  }

  const action = RenewNameAction.fromJSON(vout);
  expect(action instanceof RenewNameAction).toBeTruthy();
  expect(action.nameHash)
      .toBe('fdb4c543ea60246a8a647c82ab2c29f67c5d85293462f578b14138005e92983a');
  expect(getNameActionFromTxout(vout)).toStrictEqual(action);
});

test('get name actions from block', () => {
  const data = fs.readFileSync('test-data/block-71263.json', 'utf8');
  const block = JSON.parse(data);
  const nameActions = getNameActionsFromBlock(block);
  expect(nameActions.length).toBe(8);
  expect(
      nameActions.filter(el => el.constructor == AuctionBidNameAction).length)
      .toBe(6);
  expect(nameActions.filter(el => el.constructor == RegisterNameAction).length)
      .toBe(2);
});