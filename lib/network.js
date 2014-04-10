/**
 * Defines basic network interfaces and operations.
 */

assert = require('assert');
Kadoh = require('kadoh');


/**
 * The network interface can be described as follows:
 * get: function(key: Buffer, function(error?, value: Buffer))
 *   Takes a key and calls the callback with the value if found.  If a value
 *   is not found, call with error = 'not found'.
 * put: function(key: Buffer, value: Buffer, function(error?))
 *   Puts the value in the cache.  Calls the callback afterwards, perhaps with
 *   an error.
 */

/**
 * A network server based on a Kadoh node.
 * @param {kadoh.Node} node Kadoh node for this machine.
 * @constructor
 */
function KadohNetwork(node) {
  assert(node);
  this.node = node;
}

KadohNetwork.prototype.get = function(key, callback) {
  this.node.get(key, function(value) {
    if (value == null) {
      callback('not found');
    } else {
      callback(null, value);
    }
  });
};

KadohNetwork.prototype.put = function(key, value, callback) {
  this.node.put(key, value, function(key) {
    if (key == null) {
      callback('failed to store');
    } else {
      callback(null);
    }
  });
};

module.exports = {
  KadohNetwork: KadohNetwork
};
