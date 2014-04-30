var assert = require('assert');

var NetUtil = require('../../lib/network/netutil.js');
var Node = require('../../lib/network/node.js');
var Peer = require('../../lib/network/peer.js');

var _ = require('underscore');

describe('netutil', function() {
  describe('logDistance', function() {
    it('should return 0 log distance for equal buffers', function() {
      var hash1 = new Buffer(32);
      var hash2 = new Buffer(32);
      hash1.write('1234', null, null, 'hex');
      hash1.fill('0', 2);
      hash2.write('1234', null, null, 'hex');
      hash2.fill('0', 2);
      assert.equal(0, NetUtil.logDistance(hash1, hash2));
    });
    it('should return 250 log distance for buffers with 6 bits in common ' +
      'before first difference',
      function() {
        var hash1 = new Buffer(32);
        var hash2 = new Buffer(32);
        hash1.write('0101', null, null, 'hex');
        hash1.fill('0', 2);
        hash2.write('0202', null, null, 'hex');
        hash2.fill('0', 2);
        assert.equal(250, NetUtil.logDistance(hash1, hash2));
      });
    it('should return 256 log difference for buffers that differ at first bit',
        function() {
          var hash1 = new Buffer(32);
          var hash2 = new Buffer(32);
          hash1.write('FF', null, null, 'hex');
          hash2.write('01', null, null, 'hex');
          hash1.fill('0', 1);
          hash2.fill('0', 1);
          assert.equal(256, NetUtil.logDistance(hash1, hash2));
        });
  });
  describe('uniquePeers', function() {
    it('should return a list of peers of length 2, erasing one of the ' + 
       'copied peers', function() {
        var node1 = new Node();
        var peer1 = new Peer(node1, {ip: '175.45.176.0', port: '1337' });
        var node2 = new Node();
        var peer2 = new Peer(node2, {ip: '127.0.0.1', port: '1337'});
        var peers = [peer1, peer2, peer2]
        var newPeers = NetUtil.uniquePeers(peers);
        assert.equal(2, newPeers.length);
        var newPeerIps = []
        for (var i = 0; i < newPeers.length; i++) {
          newPeerIps.push(newPeers[i].getSpec().ip);
        }
        assert(_.contains(newPeerIps, '175.45.176.0'));
        assert(_.contains(newPeerIps, '127.0.0.1'));
    });
  });
});
