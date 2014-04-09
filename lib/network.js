/**
 * Defines basic network interfaces and operations.
 */

assert = require('better-assert');
kadoh = require('kadoh');

/**
 * Interface that provides networking primitives.
 * @interface
 */
function NetworkServer() { }

/**
 * Tries to retrieve a value from the network.
 * @param {string} key Key for the value.
 * @param {function} callback Callback to call with (error, value).
 */
NetworkServer.prototype.get = function(key, callback) { };

/**
 * Tries to put a value in the network.
 * @param {string} key Key for the value.
 * @param {Buffer} value Value as a buffer.
 * @param {function} callback Callback to call with error.
 */
NetworkServer.prototype.put = function(key, value, callback) { };

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
  }
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
  NetworkServer: NetworkServer,
  KadohNetwork: KadohNetwork
};
