const assert = require('bsert');

/**
 * Validates extracted values in the following format:
 * {
 * 	key: [extracted value, expected value type, expected value]
 * }
 *
 * Throws exception on first fail
 *
 * @param {Object} obj object to validate
 * @returns {Object} just the keys/values
 */
function validateExtract(obj) {
  const out = {};

  for (const key in obj) {
    const items = obj[key];

    assert(Array.isArray(items));
    assert(items.length >= 1 && items.length <= 2);

    let val = items[0];
    const opts = items[1] || {};

    // The gauntlet of checks
    if (val == undefined) {
      throw new Error(`Element ${key} is undefined`);
    }

    // Optional type check
    if (opts.type) {
      if (typeof val != opts.type) {
        throw new Error(`Element ${key} type "${
            typeof val}" doesnt match expected "${opts.type}"`);
      }
    }

    // Optional check exact match
    if (opts.match !== undefined) {
      if (val !== opts.match) {
        throw new Error(`Element ${key} value "${val}" doesnt match expected "${
            opts.match}"`);
      }
    }

    // Optional decode function
    if (opts.decode !== undefined) {
      val = opts.decode(val);
    }

    out[key] = val;
  }

  return out;
}


/**
 * Group array values by keyFunc(val)
 *
 * Turns [1,5,2,45,6,78] with keyFunc (e) => e % 2
 * into {'0': [2,6,78], '1': [1,5,45]}
 *
 * @param {*[]} arr array of values to group
 * @param {function} keyFunc function that turns elements into keys
 * @returns {Object} map of keys to value arrays
 */
function groupArrayBy(arr, keyFunc) {
  const out = {};
  for (let i of arr) {
    const key = keyFunc(i);
    if (!out[key]) {
      out[key] = [i];
    } else {
      out[key].push(i);
    }
  }

  return out;
}


/**
 * Parse JSON ignoring exceptions
 *
 * @param {string} str
 * @returns Object
 */
function quietJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (error) {
    return null;
  }
}


/**
 * Parse string containing a positive integer
 *
 * @param {string} input
 * @returns {number|null}
 */
function parsePositiveInt(input) {
  const regexp = /^ *\+ *([0-9]+) *$/;
  const match = input.match(regexp);
  return match ? parseInt(match[1]) : null;
}


/**
 * Parse string containing a block number preceeded by #
 *
 * @param {string} input
 * @returns {number|null}
 */
function parseBlockNum(input) {
  const regexp = /^ *\# *([0-9]+) *$/;
  const match = input.match(regexp);
  return match ? parseInt(match[1]) : null;
}


/**
 * Format singular or plural of given unit
 *
 * @param {string} unit
 * @param {number} num
 * @returns {string}
 */
function numUnits(unit, num) {
  num = Math.floor(num);
  return num == 1 ? `1 ${unit}` : `${num} ${unit}s`;
}


/**
 * Format block count into days or hours based on secondsPerBlock
 *
 * @param {number} blocks
 * @param {number} secondsPerBlock
 * @returns {string|undefined}
 */

function blocksToApproxDaysOrHours(blocks, secondsPerBlock) {
  const hours = (blocks * secondsPerBlock) / 60 / 60;
  const days = hours / 24;
  if (days > 1.5) {
    return numUnits('day', Math.round(days));
  } else if (hours > 1) {
    return numUnits('hour', Math.round(hours));
  } else {
    return undefined;
  }
}


/**
 * Clean up Handshake name received from user
 *
 * @param {string} rawName unformatted name received from user perhaps
 * @returns {string} cleaned name
 */
function cleanHandshakeName(rawName) {
  const trailingSlash = /\/ *$/;
  const trailingDot = /\. *$/;
  let name = rawName.toLowerCase();
  name = name.replace(trailingSlash, '');
  name = name.replace(trailingDot, '');
  return name;
}


module.exports = {
  validateExtract,
  groupArrayBy,
  quietJsonParse,
  parsePositiveInt,
  parseBlockNum,
  numUnits,
  blocksToApproxDaysOrHours,
  cleanHandshakeName
};