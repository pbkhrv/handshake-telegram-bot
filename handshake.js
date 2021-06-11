const {NodeClient} = require('hs-client')
const {Rules} = require('hsd');
const punycode = require('punycode/');
const EventEmitter = require('eventemitter3');
const {getNameActionsFromBlock} = require('./nameactions');


const emittedEvents = {
  NEW_BLOCK: 'NEW_BLOCK'
};


/**
 * Invalid name error, to be thrown and caught
 */
class InvalidNameError {}


/**
 * Use it to get data and events about the Handshake blockchain
 * Works by querying the Handshake node over RPC
 */
class HandshakeQuery extends EventEmitter {
  /**
   * Constructor
   * @param {string} hsdHost - host that hsd is listening on
   * @param {string} hsdPort - port that hsd is listening on
   * @param {string} hsdApiKey - apiKey to connect to hsd
   */
  constructor(hsdHost, hsdPort, hsdApiKey) {
    super();

    this.hsdClient =
        new NodeClient({host: hsdHost, port: hsdPort, apiKey: hsdApiKey});
    this.lastSeenBlockHeight = null;
  }

  /**
   * Start watching the blockchain
   */
  start() {
    // start polling blockchain info
    setTimeout(() => this.checkForNewBlock(), 0);
    setInterval(() => this.checkForNewBlock(), 10000);
  }

  /**
   * Poll Handshake node checking for a new block
   */
  async checkForNewBlock() {
    console.log('Checking new block');
    const bcInfo = await this.getBlockchainInfo();
    if (bcInfo.blocks != this.lastSeenBlockHeight) {
      console.log('NEW BLOCK!!!!');
      this.lastSeenBlockHeight = bcInfo.blocks;
      await this.processNewBlock(bcInfo);
    }
  }

  /**
   * Process the new block and emit "new block" event
   * @param {Object} bcInfo getblockchaininfo RPC call result
   */
  async processNewBlock(bcInfo) {
    // Get the new block and extract name actions from it
    const block = await this.getBlockByHash(bcInfo.bestblockhash, true);
    const nameActions = getNameActionsFromBlock(block);

    // Fill in missing names based on their namehash values
    for (let nameAction of nameActions) {
      if (!nameAction.name) {
        nameAction.name = await this.getNameByHash(nameAction.nameHash);
      }
    }

    this.emit(emittedEvents.NEW_BLOCK, {
      /**
       * @property {Object} bcInfo result of getblockchaininfo RPC call
       * @property {NameAction[]} nameActions
       * @property {number} blockHeight
       */
      bcInfo,
      nameActions,
      blockHeight: bcInfo.blocks
    });
  }

  /**
   * Lookup information about a name.
   *
   * @param {string} encodedName punycode-encoded name
   * @returns {Object}
   */
  async getNameInfo(encodedName) {
    if (!Rules.verifyString(encodedName)) {
      throw new InvalidNameError();
    }

    return await this.hsdClient.execute('getnameinfo', [encodedName]);
  }

  /**
   * Lookup information about the blockchain.
   *
   * @returns {Object}
   */
  async getBlockchainInfo() {
    return await this.hsdClient.execute('getblockchaininfo');
  }

  /**
   * Get block by its hash
   *
   * @param {string} blockHash
   * @param {boolean} shouldIncludeTxs whether the block should include TX
   *     details
   * @returns {Object}
   */
  async getBlockByHash(blockHash, shouldIncludeTxs = false) {
    return await this.hsdClient.execute(
        'getblock', [blockHash, true, shouldIncludeTxs]);
  }

  /**
   * Lookup name by its hash
   * // TODO: cache results in an LRU
   *
   * @param {string} nameHash
   * @returns {string}
   */
  async getNameByHash(nameHash) {
    return await this.hsdClient.execute('getnamebyhash', [nameHash]);
  }

  getCurrentBlockHeight() {
    return this.lastSeenBlockHeight;
  }
}

/**
 * Encode name using punycode
 *
 * @param {string} name
 * @returns {string} punycode-encoded name
 */
function encodeName(name) {
  return punycode.toASCII(name).toLowerCase();
}

/**
 * Decode encoded name using punycode
 *
 * @param {string} encodedName
 * @returns {string} unicode name
 */
function decodeName(encodedName) {
  return punycode.toUnicode(encodedName);
}


module.exports = {
  emittedEvents,
  InvalidNameError,
  HandshakeQuery,
  encodeName,
  decodeName
};