const {NodeClient} = require('hs-client')
const {Network, ChainEntry, Covenant, Rules} = require('hsd');
const network = Network.get('main');
const punycode = require('punycode/');
const EventEmitter = require('eventemitter3');


const nameStates = {
  OTHER: 0,
  UNAVAIL_RESERVED: 1,
  UNAVAIL_CLAIMING: 2,
  UNAVAIL_CLOSED: 3,
  AVAIL_NEVER_REGISTERED: 4,
  AVAIL_NOT_RENEWED: 5,
  AUCTION_OPENING: 6,
  AUCTION_BIDDING: 7,
  AUCTION_REVEAL: 8
};


/**
 * Figure out state of the name based on the results of the getNameInfo RPC call
 *
 * @param {Object} nameInfo - result of the getNameInfo RPC call
 * @returns {int}
 */
function calculateNameState(nameInfo) {
  // Unavailable: reserved, unregistered
  if (nameInfo.start.reserved && !nameInfo.info) {
    return nameStates.UNAVAIL_RESERVED;
  }

  // Unavailable: reserved, being claimed
  if (nameInfo.start.reserved && nameInfo.info?.state == 'LOCKED' &&
      nameInfo.info?.claimed !== 0) {
    return nameStates.UNAVAIL_CLAIMING;
  }

  // Unavailable: auction closed or claim completed
  if (nameInfo.info?.state == 'CLOSED' &&
      nameInfo.info?.stats?.blocksUntilExpire > 0) {
    return nameStates.UNAVAIL_CLOSED;
  }

  // Available: Un-reserved name, un-registered
  if (!nameInfo.start.reserved && !nameInfo.info) {
    return nameStates.AVAIL_NEVER_REGISTERED;
  }

  // Available: registration expired
  if (nameInfo.info?.state == 'CLOSED' &&
      nameInfo.info?.stats?.blocksUntilExpire <= 0) {
    return nameStates.AVAIL_NOT_RENEWED;
  }

  // In auction: opening
  if (nameInfo.info?.state == 'OPENING') {
    return nameStates.AUCTION_OPENING;
  }

  // In auction: bidding
  if (nameInfo.info?.state == 'BIDDING') {
    return nameStates.AUCTION_BIDDING;
  }

  // In auction: reveal
  if (nameInfo.info?.state == 'REVEAL') {
    return nameStates.AUCTION_REVEAL;
  }

  return nameStates.OTHER;
}

/**
 * Invalid name error, to be thrown and caught
 */
class InvalidNameError {}

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
    const encodedName = punycode.toASCII(name);
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
}

module.exports = {
  InvalidNameError,
  HandshakeQuery,
  nameStates,
  calculateNameState
};