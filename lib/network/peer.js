
var assert = require('assert');
var _ = require('underscore');

var Value = require('../value');

function Peer(node, spec) {
  this.node = node;
  assert(this.node);
  this.ip = spec.ip;
  assert(this.ip);
  this.port = spec.port;
  assert(this.port);
  this.fullNAT = spec.fullNAT || false;
}

Peer.prototype.getSpec = function() {
  return {ip: this.ip, port: this.port};
};

Peer.prototype.getID = function() {
  return Value.hashData(this.getSpec());
};

Peer.prototype.httpRequest = function(reqObj, callback) {
  this.node.transport.request(this.ip, this.port, reqObj, callback);
};

Peer.prototype.gethashdata = function(hash, callback) {
  this.httpRequest({type: 'gethashdata', hash: hash}, callback);
};

Peer.prototype.ping = function(callback) {
  this.httpRequest({type: 'ping'}, callback);
};

Peer.prototype.find = function(queryHash, callback) {
  var self = this;
  self.httpRequest({type: 'find', queryhash: queryHash}, function(err, result) {
    if (err) {
      callback(err);
    } else {
      _.each(result.nodes || [], function(p) {
        self.node.peerSet.insert(new Peer(self.node, p));
      });
      callback(null, result);
    }
  });
};

Peer.prototype.store = function(query, value, callback) {
  this.httpRequest({type: 'store', query: query, value: value}, callback);
};

module.exports = Peer;
