const {Network} = require('hsd');

const nsMilestones = {
  AUCTION_OPENING: 10,
  AUCTION_BIDDING: 11,
  AUCTION_REVEAL: 12,
  AUCTION_CLOSED: 13,
  NAME_LOCKED: 20,
  NAME_UNLOCKED: 21,
  REGISTRATION_EXPIRED: 30
};

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
 * Find milestones for the given nameInfo that will happen after given block height
 * 
 * @param {Object} nameInfo 
 * @param {number} currentBlockHeight 
 * @returns {Array} list of objects with heightBlock and nsMilestone props
 */
function calculateAllFutureMilestones(nameInfo, currentBlockHeight) {
	// Calculate all milestones
  const milestones = calculateAuctionMilestones(nameInfo);
	milestones.push(...calculateLockupMilestones(nameInfo));
	milestones.push(...calculateRenewalMilestones(nameInfo));
	
	// Leave only future ones
	return milestones.filter(el => el.blockHeight >= currentBlockHeight);
}

module.exports = {
  nsMilestones,
  calculateAuctionMilestones,
  calculateLockupMilestones,
  calculateRenewalMilestones,
	calculateAllFutureMilestones
};