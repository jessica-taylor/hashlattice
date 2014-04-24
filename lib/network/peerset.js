var assert = require('assert');

var _ = require('underscore');

var Value = require('../lib/value');

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
  this.origin = kwargs.origin;
  assert(this.origin);
  this.kbuckets = _.times(NetUtil.KEY_BITS, function() { return new KBucket(); });
}

PeerSet.prototype.insert = function(peer) {
  var dist = NetUtil.logDistance(this.origin, peer.getID());
  this.kbuckets[dist].insert(peer);
};

PeerSet.prototype.allPeers = function() {
  return _.flatten(_.map(this.kbuckets, function(kb) { return kb.peers; }), true);
};

module.exports = PeerSet;
