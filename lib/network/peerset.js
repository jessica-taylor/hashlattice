var assert = require('assert');

var _ = require('underscore');

var Value = require('../value');

var Peer = require('./peer');
var NetUtil = require('./netutil');


function KBucket() {
  this.peers = [];
}

KBucket.prototype.insert = function(peer) {
  if (!_.any(this.peers, function(p) {
        return Value.valuesEqual(p, peer.getSpec());
      })) {
    if (this.peers.length >= NetUtil.K) {
      // TODO: ping and decide to drop or not
    } else {
      this.peers.push(peer);
    }
  }
}

function PeerSet(kwargs) {
  this.origin = kwargs.origin || null;
  if (!this.origin) {
    // If origin is not specified, just have 1 KBucket for peers
    this.kbuckets = [new KBucket()];
  } else {
    // Create a KBucket for each bit in the origin hash
    this.kbuckets = _.times(NetUtil.KEY_BITS, function() { return new KBucket(); });
  }
}

PeerSet.prototype.insert = function(peer) {
  if (kbuckets.length < NetUtil.KEY_BITS) {
    // Insert peers into bucket 0 if we don't have enough buckets to map from
    // distance function
    this.kbuckets[0].insert(peer);
  } else {
    // Insert peers into bucket based on distance from origin
    var dist = NetUtil.logDistance(this.origin, peer.getID());
    this.kbuckets[dist].insert(peer);
  }
};

PeerSet.prototype.allPeers = function() {
  return _.flatten(_.map(this.kbuckets, function(kb) { return kb.peers; }), true);
};

PeerSet.prototype.setOrigin = function(origin) {
  this.origin = origin;
  this.kbuckets = _.times(NetUtil.KEY_BITS, function() { return new KBucket(); });
  var peers = this.allPeers();
  for (var i = 0; i < peers.length; i++) {
    this.insert(peers[i]);
  }
}

module.exports = PeerSet;
