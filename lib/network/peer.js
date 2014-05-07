
var assert = require('assert');
var _ = require('underscore');

var Value = require('../value');

function Peer(node, spec) {
  this.node = node;
  assert(this.node);
  this.spec = spec;
}

Peer.prototype.getSpec = function() {
  return this.spec;
};

Peer.prototype.getID = function() {
  return Value.hashData(this.getSpec());
};

Peer.prototype.sendRequest = function(reqObj, callback) {
  this.node.transport.request(this.spec, reqObj, callback);
};

Peer.prototype.gethashdata = function(hash, callback) {
  this.sendRequest({type: 'gethashdata', hash: hash}, callback);
};

Peer.prototype.getvar = function(variable, callback) {
  this.sendRequest({type: 'getvar', variable: variable}, callback);
};

Peer.prototype.putvar = function(variable, value, callback) {
  this.sendRequest({type: 'putvar', variable: variable, value: value}, callback);
};

Peer.prototype.ping = function(callback) {
  this.sendRequest({type: 'ping'}, callback);
};

Peer.prototype.find = function(queryHash, callback) {
  var self = this;
  self.sendRequest({type: 'find', queryhash: queryHash}, function(err, result) {
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
  this.sendRequest({type: 'store', query: query, value: value}, callback);
};

module.exports = Peer;
