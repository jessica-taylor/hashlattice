var assert = require('assert');

var _ = require('underscore');

var Value = require('../../lib/value');

function MockNetwork(peerSpecs) {
  var self = this;
  self.peerSpecs = peerSpecs;
  self.transports = peerSpecs.map(function(peer) { return new MockTransport(self, peer); });
}

MockNetwork.prototype.transportForPeer = function(ip, port) {
  var self = this;
  for (var i = 0; i < self.peerSpecs.length; i++) {
    if (self.peerSpecs[i].ip == ip && self.peerSpecs[i].port == port) {
      return self.transports[i];
    }
  }
  return null;
};

function MockTransport(network, spec) {
  this.network = network;
  this.spec = spec;
  this.started = false;
  this.handler = null;
}

MockTransport.prototype.startServer = function(handler, callback) {
  var self = this;
  assert(!self.started);
  self.started = true;
  self.handler = handler;
  process.nextTick(callback);
};

MockTransport.prototype.request = function(ip, port, reqObj, callback) {
  console.log('request', ip, port, reqObj, callback);
  assert(callback);
  var self = this;
  var peerTransport = self.network.transportForPeer(ip, port);
  // TODO: randomly fail?
  if (!peerTransport) {
    process.nextTick(function() { callback(null, {error: 'timeout'}); });
  } else {
    reqObj = _.clone(reqObj);
    reqObj.sender = self.spec;
    peerTransport.handler(reqObj, function(err, resp) {
      assert(!err, err);
      process.nextTick(function() { callback(null, resp); });
    });
  }
};

module.exports = MockNetwork;
