/**
 * Defines basic network interfaces and operations.
 */

var assert = require('assert');
var Crypto = require('crypto');

var Node = require('./node');


/**
 * The network interface can be described as follows:
 * get: function(key: Buffer, function(error?, value: data))
 *   Takes a key and calls the callback with the value if found.  If a value
 *   is not found, call with error = 'not found'.
 * put: function(key: Buffer, value: data, function(error?))
 *   Puts the value in the cache.  Calls the callback afterwards, perhaps with
 *   an error.
 */

module.exports = {
  Node: Node
};
