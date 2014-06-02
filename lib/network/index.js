/**
 * Defines basic network interfaces and operations.
 */

var assert = require('assert');
var Crypto = require('crypto');

var Node = require('./node');
var Transport = require('./transport');


/**
 * The network interface can be described as follows:
 * get: function(query: data, function(error?, value: [data]))
 *   Takes a query and calls the callback with the values if found.  If a value
 *   is not found, call with error = 'not found'.
 * put: function(query: data, value: data, function(error?))
 *   Puts the value in the store.  Calls the callback afterwards, perhaps with
 *   an error.
 */

module.exports = {
  Node: Node,
  UdpTransport: Transport.UdpTransport
};

if (Transport.WebRTCTransport) {
  module.exports.WebRTCTransport = Transport.WebRTCTransport;
}
