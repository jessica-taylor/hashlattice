/**
 * Defines basic network interfaces and operations.
 */

var assert = require('assert');
var Crypto = require('crypto');

var Node = require('./node');
var Transport = require('./transport');


module.exports = {
  Node: Node
};

if (Transport.WebRTCTransport) {
  module.exports.WebRTCTransport = Transport.WebRTCTransport;
}
