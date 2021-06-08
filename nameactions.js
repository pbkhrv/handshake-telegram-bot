const {validateExtract} = require('./utils');
const {util, Rules} = require('hsd');

/**
 * @classdesc Base class for name actions/covenants
 */
class NameAction {
  constructor(nameHash) {
    this.nameHash = nameHash;
  }
}


/**
 * @classdesc Class representing CLAIM covenant
 */
class ClaimNameAction extends NameAction {
  /**
   * Create a name action
   * @param {string} nameHash
   * @param {number} value value of the output
   * @param {string} name
   */
  constructor(nameHash, value, name) {
    super(nameHash);
    this.value = value;
    this.name = name;
  }

  /**
   * Covenant type matching this name action
   * @static
   */
  static COVENANT_TYPE = Rules.types.CLAIM;

  /**
   * Extract values from an object received from hsd RPC
   * @param {Object} vout tx output to extract action from
   * @returns {ClaimNameAction}
   */
  static fromJSON(vout) {
    /* example tx output:
    {
      "value": 2720503.385487,
      "n": 2,
      "address": {
        "version": 0,
        "hash": "82f68da64ce03b33942890e4a7170496c700ff23",
        "string": "hs1qstmgmfjvuqan89pgjrj2w9cyjmrsplerhsufst"
      },
      "covenant": {
        "type": 1,
        "action": "CLAIM",
        "items": [
          "7b504982ea98af85bad61fe98851dafe1b8ef5d0c3a0da7865839dd876220a0b",
          "35f40000",
          "6e616d656368656170",
          "01",
          "0000000000a5e40e8ba291bd7e8649747fa7fb8a7af39f5bacdb7433cd2f5971",
          "01000000"
        ]
      }
    }
     */

    const vals = {
      value: [vout.value, {type: 'number'}],
      action: [vout.covenant?.action, {type: 'string', match: 'CLAIM'}],
      nameHash: [vout.covenant?.items?.[0]],
      name: [vout.covenant?.items?.[2]]
    };

    const {nameHash, name, value} = validateExtract(vals);

    return new ClaimNameAction(nameHash, value, util.parseHex(name).toString());
  }
}

/**
 * @classdesc Class representing a name auction OPEN covenant
 *
 * TODO: add "height" that should come from the block, not the tx itself
 */
class OpenAuctionNameAction extends NameAction {
  /**
   * Create a name action
   *
   * @param {string} nameHash
   * @param {string} name
   */
  constructor(nameHash, name) {
    super(nameHash);
    this.name = name;
  }

  /**
   * Covenant type matching this name action
   * @static
   */
  static COVENANT_TYPE = Rules.types.OPEN;

  /**
   * Extract values from an object received from the hsd RPC
   * @param {Object} vout tx output to extract action from
   * @returns {OpenAuctionNameAction}
   */
  static fromJSON(vout) {
    /* example json
    {
      "value": 0,
      "n": 0,
      "address": {
        "version": 0,
        "hash": "34493644a905d817b0db072d8c808b98eeca360a",
        "string": "hs1qx3ynv39fqhvp0vxmqukceqytnrhv5ds24tqawt"
      },
      "covenant": {
        "type": 2,
        "action": "OPEN",
        "items": [
          "952f1c3e3ed55ca92e16ccbe806ae59173b8c86a2c4119aab8673c43c3fa1a90",
          "00000000",
          "6f636572"
        ]
      }
    }
     */

    const vals = {
      action: [vout.covenant?.action, {type: 'string', match: 'OPEN'}],
      nameHash: [vout.covenant?.items?.[0]],
      name: [vout.covenant?.items?.[2]]
    };

    const {nameHash, name} = validateExtract(vals);

    return new OpenAuctionNameAction(nameHash, util.parseHex(name).toString());
  }
}

/**
 * @classdesc Class representing a name auction BID covenant
 */
class AuctionBidNameAction extends NameAction {
  /**
   * Create a name action
   *
   * @param {string} nameHash
   * @param {string} name
   * @param {number} lockupAmount
   */
  constructor(nameHash, name, lockupAmount, height) {
    super(nameHash);
    this.name = name;
    this.lockupAmount = lockupAmount;
  }

  /**
   * Covenant type matching this name action
   * @static
   */
  static COVENANT_TYPE = Rules.types.BID;

  /**
   * Extract values from an object received from the hsd RPC
   * @param {Object} vout tx output to extract action from
   * @returns {AuctionBidNameAction}
   */
  static fromJSON(vout) {
    /* example json
    {
      "value": 16.01,
      "n": 0,
      "address": {
        "version": 0,
        "hash": "7e8b9bd5d556159e47c63e5ab1f1255d2b42bb79",
        "string": "hs1q069eh4w42c2eu37x8edtruf9t5459wme8k684g"
      },
      "covenant": {
        "type": 3,
        "action": "BID",
        "items": [
          "dddec8590b724da53d102b251978df3d242bb53994ea13217c793f070cd5172f",
          "43f10000",
          "6d6f766965626f78",
          "0d27c295f40b057b709945b37dcbce46cb5952ff954528718069d7e46c2d3860"
        ]
      }
    }
     */

    const vals = {
      action: [vout.covenant?.action, {type: 'string', match: 'BID'}],
      nameHash: [vout.covenant?.items?.[0]],
      name: [vout.covenant?.items?.[2]],
      lockupAmount: [vout.value, {type: 'number'}]
    };

    const {nameHash, name, lockupAmount} = validateExtract(vals);

    return new AuctionBidNameAction(
        nameHash, util.parseHex(name).toString(), lockupAmount);
  }
}

/**
 * @classdesc Class representing a name auction REVEAL covenant
 */
class AuctionRevealNameAction extends NameAction {
  /**
   *
   * @param {string} nameHash
   * @param {number} bidAmount
   */
  constructor(nameHash, bidAmount, height) {
    super(nameHash);
    this.bidAmount = bidAmount;
  }

  /**
   * Covenant type matching this name action
   * @static
   */
  static COVENANT_TYPE = Rules.types.REVEAL;

  /**
   * Extract values from an object received from the hsd RPC
   * @param {Object} vout tx output to extract action from
   * @returns {AuctionRevealNameAction}
   */
  static fromJSON(vout) {
    /* example json
    {
      "value": 5.01,
      "n": 0,
      "address": {
        "version": 0,
        "hash": "7e531db90896d5a1480281c49440f3d77f294fb6",
        "string": "hs1q0ef3mwggjm26zjqzs8zfgs8n6aljjnak7hs3na"
      },
      "covenant": {
        "type": 4,
        "action": "REVEAL",
        "items": [
          "5fe8fb5e547d3959e28d6764324ee170743d8c39d664b91d37df1d4f4c65a171",
          "32070100",
          "000005f8b5dccada41403dcedba36945bf7decbbfaf43b591d87da7f4d5be067"
        ]
      }
    }
    */

    const vals = {
      action: [vout.covenant?.action, {type: 'string', match: 'REVEAL'}],
      nameHash: [vout.covenant?.items?.[0]],
      bidAmount: [vout.value, {type: 'number'}]
    };

    const {nameHash, bidAmount} = validateExtract(vals);

    return new AuctionRevealNameAction(nameHash, bidAmount);
  }
}

// TODO: implement REDEEM

/**
 * @classdesc Class representing a REGISTER covenant
 */
class RegisterNameAction extends NameAction {
  /**
   *
   * @param {string} nameHash
   */
  constructor(nameHash, burnedValue) {
    super(nameHash);
    this.burnedValue = burnedValue;
  }

  /**
   * Covenant type matching this name action
   * @static
   */
  static COVENANT_TYPE = Rules.types.REGISTER;

  /**
   * Extract values from an object received from the hsd RPC
   * @param {Object} vout tx output to extract action from
   * @returns {RegisterNameAction}
   */
  static fromJSON(vout) {
    /* example json
      {
        "value": 58,
        "n": 4,
        "address": {
          "version": 0,
          "hash": "d8ba94386f1b5cc6484f96a818d764ceb8ae9201",
          "string": "hs1qmzafgwr0rdwvvjz0j65p34mye6u2ayspd2wwec"
        },
        "covenant": {
          "type": 6,
          "action": "REGISTER",
          "items": [
            "fdb4c543ea60246a8a647c82ab2c29f67c5d85293462f578b14138005e92983a",
            "edfe0000",
            "0002036e73310b786e2d2d6c793562383070002ce706b701c002",
            "0000000000000000742c8042723937f768ffec86f719e61e7033607e241f56fa"
          ]
        }
      },
     */

    const vals = {
      action: [vout.covenant?.action, {type: 'string', match: 'REGISTER'}],
      nameHash: [vout.covenant?.items?.[0]],
      burnedValue: [vout.value, {type: 'number'}]
    };

    const {nameHash, burnedValue} = validateExtract(vals);

    return new RegisterNameAction(nameHash, burnedValue);
  }
}

// TODO: implement UPDATE
// TODO: implement TRANSFER
// TODO: implement FINALIZE
// TODO: implement REVOKE

/**
 * @classdesc Class representing a name auction BBB covenant
 */
class RenewNameAction extends NameAction {
  constructor(nameHash) {
    super(nameHash);
  }

  /**
   * Covenant type matching this name action
   * @static
   */
  static COVENANT_TYPE = Rules.types.RENEW;

  /**
   * Extract values from an object received from the hsd RPC
   * @param {Object} vout tx output to extract action from
   * @returns {RenewNameAction}
   */
  static fromJSON(vout) {
    const vals = {
      action: [vout.covenant?.action, {type: 'string', match: 'RENEW'}],
      nameHash: [vout.covenant?.items?.[0]],
    };

    const {nameHash} = validateExtract(vals);

    return new RenewNameAction(nameHash);
  }
}


/**
 * Map covenant types to name action classes
 */
const nameActionsByCovenant = {
  [ClaimNameAction.COVENANT_TYPE]: ClaimNameAction,
  [OpenAuctionNameAction.COVENANT_TYPE]: OpenAuctionNameAction,
  [AuctionBidNameAction.COVENANT_TYPE]: AuctionBidNameAction,
  [AuctionRevealNameAction.COVENANT_TYPE]: AuctionRevealNameAction,
  [RegisterNameAction.COVENANT_TYPE]: RegisterNameAction,
  [RenewNameAction.COVENANT_TYPE]: RenewNameAction
};


/**
 * Parse tx output into a name action class if covenant is mapped
 * @param {Object} vout tx output received from hsd RPC
 * @returns {Object|null}
 */
function getNameActionFromTxout(vout) {
  const covType = vout.covenant?.type;
  if (covType !== undefined) {
    const nameActionCls = nameActionsByCovenant[covType];
    if (nameActionCls) {
      return nameActionCls.fromJSON(vout);
    }
  }

  return null;
}

/**
 * Extract name actions contained in the transactions in this block
 * @param {Object} block getblock RPC call result
 * @returns {NameAction[]} list of name actions contained in the block
 */
function getNameActionsFromBlock(block) {
  if (block.tx == undefined) {
    throw new Error('Block tx is undefined');
  }

  const nameActions = [];
  for (let tx of block.tx) {
    for (let vout of tx.vout) {
      const nameAction = getNameActionFromTxout(vout);
      if (nameAction) {
        nameActions.push(nameAction);
      }
    }
  }

  return nameActions;
}

module.exports = {
  ClaimNameAction,
  OpenAuctionNameAction,
  AuctionBidNameAction,
  AuctionRevealNameAction,
  RegisterNameAction,
  RenewNameAction,
  getNameActionFromTxout,
  getNameActionsFromBlock
};