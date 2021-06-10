const {Network} = require('hsd');

// Ugly. Better way?
const nsMilestones = {
  AUCTION_OPENING: "AUCTION_OPENING",
  AUCTION_BIDDING: "AUCTION_BIDDING",
  AUCTION_REVEAL: "AUCTION_REVEAL",
  AUCTION_CLOSED: "AUCTION_CLOSED",
  NAME_LOCKED: "NAME_LOCKED",
  NAME_UNLOCKED: "NAME_UNLOCKED",
  REGISTRATION_EXPIRED: "REGISTRATION_EXPIRED"
};

const nameAvails = {
  OTHER: "OTHER",
  UNAVAIL_RESERVED: "UNAVAIL_RESERVED",
  UNAVAIL_CLAIMING: "UNAVAIL_CLAIMING",
  UNAVAIL_CLOSED: "UNAVAIL_CLOSED",
  AVAIL_NEVER_REGISTERED: "AVAIL_NEVER_REGISTERED",
  AVAIL_NOT_RENEWED: "AVAIL_NOT_RENEWED",
  // TODO: replace all auction states with one state "IN_AUCTION"
  AUCTION_OPENING: "AUCTION_OPENING",
  AUCTION_BIDDING: "AUCTION_BIDDING",
  AUCTION_REVEAL: "AUCTION_REVEAL"
};


/**
 * Figure out name availability based on the results of the getNameInfo RPC call
 *
 * @param {Object} nameInfo result of the getNameInfo RPC call
 * @returns {int}
 */
function calculateNameAvail(nameInfo) {
  // Unavailable: reserved, unregistered
  if (nameInfo.start.reserved && !nameInfo.info) {
    return nameAvails.UNAVAIL_RESERVED;
  }

  // Unavailable: reserved, being claimed
  if (nameInfo.start.reserved && nameInfo.info?.state == 'LOCKED' &&
      nameInfo.info?.claimed !== 0) {
    return nameAvails.UNAVAIL_CLAIMING;
  }

  // Unavailable: auction closed or claim completed
  if (nameInfo.info?.state == 'CLOSED' &&
      nameInfo.info?.stats?.blocksUntilExpire > 0) {
    return nameAvails.UNAVAIL_CLOSED;
  }

  // Available: Un-reserved name, un-registered
  if (!nameInfo.start.reserved && !nameInfo.info) {
    return nameAvails.AVAIL_NEVER_REGISTERED;
  }

  // Available: registration expired
  if (nameInfo.info?.state == 'CLOSED' &&
      nameInfo.info?.stats?.blocksUntilExpire <= 0) {
    return nameAvails.AVAIL_NOT_RENEWED;
  }

  // TODO: replace all auction states with one state "IN_AUCTION"
  // In auction: opening
  if (nameInfo.info?.state == 'OPENING') {
    return nameAvails.AUCTION_OPENING;
  }

  // In auction: bidding
  if (nameInfo.info?.state == 'BIDDING') {
    return nameAvails.AUCTION_BIDDING;
  }

  // In auction: reveal
  if (nameInfo.info?.state == 'REVEAL') {
    return nameAvails.AUCTION_REVEAL;
  }

  return nameAvails.OTHER;
}


/**
 * Calculate name auction-related milestones
 *
 * @param {Object} nameInfo
 * @returns {Object[]}
 */
function calculateAuctionMilestones(nameInfo) {
  // Not including 'CLOSED' state because it might have come from either
  // claimed name or an actual auction
  const auctionStates = ['OPENING', 'BIDDING', 'REVEAL'];
  const info = nameInfo.info;
  const state = info?.state;
  const milestones = [];
  const hsNetwork = Network.get();

  const {treeInterval, biddingPeriod, revealPeriod} = hsNetwork.names;

  const openPeriod = treeInterval + 1;

  // Make sure we are looking at auction info
  if (state && auctionStates.includes(state)) {
    const openingBlock = info.height;

    // Opening
    milestones.push(
        {nsMilestone: nsMilestones.AUCTION_OPENING, blockHeight: openingBlock});

    // Bidding
    milestones.push({
      nsMilestone: nsMilestones.AUCTION_BIDDING,
      blockHeight: openingBlock + openPeriod
    });

    // Reveal
    milestones.push({
      nsMilestone: nsMilestones.AUCTION_REVEAL,
      blockHeight: openingBlock + openPeriod + biddingPeriod
    });

    // Closed
    milestones.push({
      nsMilestone: nsMilestones.AUCTION_CLOSED,
      blockHeight: openingBlock + openPeriod + biddingPeriod + revealPeriod
    });
  }

  return milestones;
}


/**
 * Calculate name locks-related milestones
 *
 * @param {Object} nameInfo
 * @returns {Object[]}
 */
function calculateLockupMilestones(nameInfo) {
  const info = nameInfo.info;
  const state = info?.state;
  const stats = info?.stats;
  const milestones = [];

  // Make sure we are looking at a locked name
  if (state == 'LOCKED' && stats) {
    milestones.push({
      nsMilestone: nsMilestones.NAME_LOCKED,
      blockHeight: stats.lockupPeriodStart
    });

    milestones.push({
      nsMilestone: nsMilestones.NAME_UNLOCKED,
      blockHeight: stats.lockupPeriodEnd
    });
  }

  return milestones;
}


/**
 * Calculate name renewal-related milestones
 *
 * @param {Object} nameInfo
 * @returns {Object[]}
 */
function calculateRenewalMilestones(nameInfo) {
  const info = nameInfo.info;
  const state = info?.state;
  const stats = info?.stats;
  const milestones = [];

  // Make sure we are looking at a CLOSED name owned by someone
  if (info && info.owner && state == 'CLOSED' && stats.renewalPeriodEnd) {
    milestones.push({
      nsMilestone: nsMilestones.REGISTRATION_EXPIRED,
      blockHeight: stats.renewalPeriodEnd
    });
  }

  return milestones;
}


/**
 * Find milestones for this nameInfo that will happen after this block height
 *
 * @param {Object} nameInfo
 * @param {number} currentBlockHeight
 * @returns {Object[]}
 */
function calculateAllFutureMilestones(nameInfo, currentBlockHeight) {
  // Calculate all milestones
  const milestones = calculateAuctionMilestones(nameInfo);
  milestones.push(...calculateLockupMilestones(nameInfo));
  milestones.push(...calculateRenewalMilestones(nameInfo));

  // Leave only future ones
  return milestones.filter(el => el.blockHeight > currentBlockHeight);
}

module.exports = {
  nsMilestones,
  nameAvails,
  calculateAuctionMilestones,
  calculateLockupMilestones,
  calculateRenewalMilestones,
  calculateAllFutureMilestones,
  calculateNameAvail
};