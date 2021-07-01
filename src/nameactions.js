const {util, Rules} = require('hsd');
const {validateExtract} = require('./utils');


const types = Rules.types;

const decodeName = (n) => util.parseHex(n).toString();

const actions = {
  [types.CLAIM]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'CLAIM'}],
        nameHash: [vout.covenant?.items?.[0]],
        name: [vout.covenant?.items?.[2], {decode: decodeName}],
        // Amount of HNS reserved for the owner of the name
        reservedAmount: [vout.value, {type: 'number'}]
      };
    }
  },
  [types.OPEN]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'OPEN'}],
        nameHash: [vout.covenant?.items?.[0]],
        name: [vout.covenant?.items?.[2], {decode: decodeName}]
      };
    }
  },
  [types.BID]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'BID'}],
        nameHash: [vout.covenant?.items?.[0]],
        name: [vout.covenant?.items?.[2], {decode: decodeName}],
        lockupAmount: [vout.value, {type: 'number'}]
      };
    }
  },
  [types.REVEAL]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'REVEAL'}],
        nameHash: [vout.covenant?.items?.[0]],
        bidAmount: [vout.value, {type: 'number'}]
      };
    }
  },
  [types.REDEEM]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'REDEEM'}],
        nameHash: [vout.covenant?.items?.[0]]
      };
    }
  },
  [types.REGISTER]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'REGISTER'}],
        nameHash: [vout.covenant?.items?.[0]],
        burnedValue: [vout.value, {type: 'number'}]
      };
    }
  },
  [types.UPDATE]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'UPDATE'}],
        nameHash: [vout.covenant?.items?.[0]]
      };
    }
  },
  [types.RENEW]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'RENEW'}],
        nameHash: [vout.covenant?.items?.[0]]
      };
    }
  },
  [types.TRANSFER]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'TRANSFER'}],
        nameHash: [vout.covenant?.items?.[0]]
      };
    }
  },
  [types.FINALIZE]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'FINALIZE'}],
        nameHash: [vout.covenant?.items?.[0]],
        name: [vout.covenant?.items?.[2], {decode: decodeName}]
      };
    }
  },
  [types.REVOKE]: {
    extract(vout) {
      return {
        action: [vout.covenant?.action, {type: 'string', match: 'REVOKE'}],
        nameHash: [vout.covenant?.items?.[0]]
      };
    }
  }
};


/**
 * Parse tx output into a name action class if covenant is mapped
 * @param {Object} vout tx output received from hsd RPC
 * @returns {Object|null}
 */
function getNameActionFromTxout(vout) {
  const covType = vout.covenant?.type;
  if (covType !== undefined) {
    const nameActionSpec = actions[covType];
    if (nameActionSpec) {
      const vals = nameActionSpec.extract(vout);
      return validateExtract(vals);
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
  types,
  actions,
  getNameActionFromTxout,
  getNameActionsFromBlock
};