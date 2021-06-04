const {NodeClient} = require('hs-client')
const {Rules} = require('hsd');
const punycode = require('punycode/');
const EventEmitter = require('eventemitter3');


/**
 * Invalid name error, to be thrown and caught
 */
class InvalidNameError {}


/**
 * @classdesc Use it to query the Handshake node over RPC and listen for events
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

  // Poll
  async checkForNewBlock() {
    console.log('Checking new block');
    const bcInfo = await this.getBlockchainInfo();
    if (bcInfo.blocks != this.lastSeenBlockHeight) {
      console.log('NEW BLOCK!!!!');
      this.emit('new_block', bcInfo);
      this.lastSeenBlockHeight = bcInfo.blocks;
    }
  }

  /**
   * Lookup information about a name.
   * Automatically converts unicode characters to punycode.
   *
   * @param {string} name
   * @returns {Object}
   */
  async getNameInfo(name) {
    // Encode and validate the name
    const encodedName = punycode.toASCII(name).toLowerCase();
    console.log(`===> encoded name: ${encodedName}`);
    if (!Rules.verifyString(encodedName)) {
      throw new InvalidNameError();
    }

    const info = await this.hsdClient.execute('getnameinfo', [encodedName]);

    return {encodedName: encodedName, info: info};
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
   * @param {string} blockHash 
   * @param {boolean} shouldIncludeTxs whether the block should include TX details
   * @returns 
   */
  async getBlockByHash(blockHash, shouldIncludeTxs = false) {
    return await this.hsdClient.execute(
        'getblock', [blockHash, true, shouldIncludeTxs]);
  }
}


/**
 * Convert tx covenant into a name action object
 * like 'bid placed' or 'bid redeemed' etc.
 *
 * @param {Object} cov tx covenant object received via RPC
 * @returns {Object}
 */
function extractNameActionFromCovenant(cov) {}

module.exports = {
  InvalidNameError,
  HandshakeQuery
};