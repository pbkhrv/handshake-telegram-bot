const {validateExtract} = require('./utils');
const {util} = require('hsd');

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
   * @param {number} value
   */
  constructor(nameHash, name, value, height) {
    super(nameHash);
    this.name = name;
    this.value = value;
  }

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
      value: [vout.value, {type: 'number'}]
    };

    const {nameHash, name, value} = validateExtract(vals);

    return new AuctionBidNameAction(
        nameHash, util.parseHex(name).toString(), value);
  }
}

/**
 * @classdesc Class representing a name auction REVEAL covenant
 */
class AuctionRevealNameAction extends NameAction {
  /**
   *
   * @param {string} nameHash
   * @param {number} value
   */
  constructor(nameHash, value, height) {
    super(nameHash);
    this.value = value;
  }

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
      value: [vout.value, {type: 'number'}]
    };

    const {nameHash, value} = validateExtract(vals);

    return new AuctionRevealNameAction(nameHash, value);
  }
}

/**
 * @classdesc Class representing a REGISTER covenant
 */
class RegisterNameAction extends NameAction {
  /**
   * 
   * @param {string} nameHash 
   */
  constructor(nameHash) {
    super(nameHash);
  }

  /**
   * Extract values from an object received from the hsd RPC
   * @param {Object} vout tx output to extract action from
   * @returns {RegisterNameAction}
   */
  static fromJSON(vout) {
    /* example json

     */

    const vals = {
      action: [vout.covenant?.action, {type: 'string', match: 'REVEAL'}],
      nameHash: [vout.covenant?.items?.[0]],
    };

    const {nameHash} = validateExtract(vals);

    return new RegisterNameAction(nameHash);
  }
}
/////////////////////////////

/**
 * @classdesc Class representing a name auction BBB covenant
 */
class BBBNameAction extends NameAction {
  constructor(nameHash, value, height) {
    super(nameHash);
    this.value = value;
    this.height = height;
  }

  /**
   * Extract values from an object received from the hsd RPC
   * @param {Object} vout tx output to extract action from
   * @returns {BBBNameAction}
   */
  static fromJSON(vout) {
    /* example json

     */

    const vals = {
      action: [vout.covenant?.action, {type: 'string', match: 'REVEAL'}],
      nameHash: [vout.covenant?.items?.[0]],
      value: [vout.value, {type: 'number'}]
    };

    const {nameHash, value} = validateExtract(vals);

    return new BBBNameAction(nameHash, value);
  }
}

///////////////////////

module.exports = {
  ClaimNameAction,
  OpenAuctionNameAction,
  AuctionBidNameAction,
  AuctionRevealNameAction
};