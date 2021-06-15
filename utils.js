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

    // Optional check type
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

    if (opts.decode !== undefined) {
      val = opts.decode(val);
    }

    out[key] = val;
  }

  return out;
}

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

function quietJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (error) {
    return null;
  }
}

function parsePositiveInt(input) {
  const regexp = /^ *\+ *([0-9]+) *$/;
  const match = input.match(regexp);
  return match ? parseInt(match[1]) : null;
}

function parseBlockNum(input) {
  const regexp = /^ *\# *([0-9]+) *$/;
  const match = input.match(regexp);
  return match ? parseInt(match[1]) : null;
}

function numUnits(unit, num) {
  num = Math.floor(num);
  return num == 1 ? `1 ${unit}` : `${num} ${unit}s`;
}

function blocksToApproxDaysOrHours(blocks, secondsPerBlock) {
  const hours = (blocks * secondsPerBlock) / 60 / 60;
  const days = hours / 24;
  if (days > 1.5) {
    return numUnits('day', Math.round(days));
  }
  else if (hours > 1) {
    return numUnits('hour', Math.round(hours));
  }
  else {
    return undefined;
  }
}

module.exports = {
  validateExtract,
  groupArrayBy,
  quietJsonParse,
  parsePositiveInt,
  parseBlockNum,
  numUnits,
  blocksToApproxDaysOrHours
};