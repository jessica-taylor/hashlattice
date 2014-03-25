/**
 * Defines basic network interfaces and operations.
 */

/**
 * Interface that provides networking primitives.
 * @interface
 */
function NetworkServer() { }

/**
 * Tries to retrieve a value from the network.
 * @param {string} key Key for the value.
 * @param {function} callback Callback to call with the value buffer, or null if
 *                            the value could not be retrieved.
 */
NetworkServer.prototype.get = function(key, callback) { };

/**
 * Tries to put a value in the network.
 * @param {string} key Key for the value.
 * @param {Buffer} value Value as a buffer.
 * @param {function} callback Callback to call with true if the value was
 *                            stored, false if not.
 */
NetworkServer.prototype.put = function(key, value, callback) { };

module.exports = {
  NetworkServer: NetworkServer
};
