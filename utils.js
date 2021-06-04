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

    const val = items[0];
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
        throw new Error(
            `Element ${key} value "${val}" doesnt match expected "${opts.match}"`);
      }
    }

    out[key] = val;
  }

	return out;
}

module.exports = {
	validateExtract
};