/**
 * Defines basic network interfaces and operations.
 */

assert = require('assert');
Crypto = require('crypto');

process.env.KADOH_TRANSPORT = 'udp';

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

function sha1hash(buf) {
  var h = Crypto.createHash('sha1');
  h.update(buf);
  return h.digest('hex');
}

/**
 * A network server based on a Kadoh node.
 * @param {Array.<string>} bootstraps Bootstrap IP addresses.
 * @constructor
 */
function KadohNetwork(bootstraps) {
  this.node = new Kadoh.logic.KademliaNode(
    null /* id */, {
      bootstraps: bootstraps,
      reactor: {
        transport: {
        }
      }
    }
  );
}

KadohNetwork.prototype.get = function(key, callback) {
  this.node.get(sha1hash(key), function(value) {
    if (value == null) {
      callback('not found');
    } else {
      callback(null, value);
    }
  });
};

KadohNetwork.prototype.put = function(key, value, callback) {
  console.warn('putting');
  this.node.put(sha1hash(key), value, undefined, function(key) {
    console.warn('in callback');
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
