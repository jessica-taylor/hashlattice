var assert = require('assert');
var Value = require('../value');

var _ = require('underscore');

var K = 20;
var ALPHA = 20;
var KEY_BITS = 256;

function logDistance(hash1, hash2) {
  assert.equal(KEY_BITS/8, hash1.length);
  assert.equal(KEY_BITS/8, hash2.length);
  var bitsInCommon = 0;
  for (var i = 0; i < KEY_BITS/8; i += 4) {
    var xor = hash1.readUInt32BE(i) ^ hash2.readUInt32BE(i);
    if (xor == 0) {
      bitsInCommon += 32;
    } else {
      for (var j = 31; j >= 0; j--) {
        if ((xor & (1 << j)) == 0) {
          bitsInCommon += 1;
        } else {
          return KEY_BITS - bitsInCommon;
        }
      }
    }
  }
  return KEY_BITS - bitsInCommon;
}

function uniquePeers(peers) {
  return _.uniq(peers, false, function(p) { return Value.encodeValue(p.getSpec()).toString('hex'); });
}

function sortPeersByDistance(origin, peers) {
  peers = _.clone(peers);
  peers.sort(function(p1, p2) {
    var p1hash = p1.getID();
    var p2hash = p2.getID();
    assert.equal(KEY_BITS, p1hash.length * 8);
    assert.equal(KEY_BITS, p2hash.length * 8);
    for (var i = 0; i < origin.length; i += 4) {
      var hashword = origin.readUInt32BE(i);
      var p1word = p1hash.readUInt32BE(i);
      var p2word = p2hash.readUInt32BE(i);
      var p1xor = hashword ^ p1word;
      var p2xor = hashword ^ p2word;
      if (p1xor < p2xor) {
        return -1;
      }
      if (p2xor > p1xor) {
        return 1;
      }
    }
    return 0;
  });
  return peers;
}

module.exports = {
  K: K,
  ALPHA: ALPHA,
  KEY_BITS: KEY_BITS,
  logDistance: logDistance,
  uniquePeers: uniquePeers,
  sortPeersByDistance: sortPeersByDistance
};
