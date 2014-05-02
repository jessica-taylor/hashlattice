var assert = require('assert');

var Node = require('../../lib/network/node.js');
var Peer = require('../../lib/network/peer.js');

var PeerSet = require('../../lib/network/peerset.js');

var _ = require('underscore');

describe('peerset', function() {
  var node = new Node();
  var peer1 = new Peer(node, {ip: '175.45.176.0', port: '1337' });
  var peer2 = new Peer(node, {ip: '127.0.0.1', port: '1337'});
  var peer3 = new Peer(node, {ip: '0.0.0.0', port: '1337'});
  var peer4 = new Peer(node, {ip: '1.1.1.1', port: '1337'});

  var psetWithOrigin = new PeerSet({origin: peer1.getID()});
  var psetWithoutOrigin = new PeerSet();

  it('should insert and retrieve peers correctly with origin', function() {
    psetWithOrigin.insert(peer2);
    psetWithOrigin.insert(peer3);
    var peers = psetWithOrigin.allPeers();
    var peerIps = []
    for (var i = 0; i < peers.length; i++) {
      peerIps.push(peers[i].getSpec().ip);
    }
    assert(_.contains(peerIps, '127.0.0.1'));
    assert(_.contains(peerIps, '0.0.0.0'));

    psetWithOrigin.insert(peer4);
    var peers = psetWithOrigin.allPeers();
    var peerIps = [] 
    for (var i = 0; i < peers.length; i++) {
      peerIps.push(peers[i].getSpec().ip);
    }
    assert(_.contains(peerIps, '1.1.1.1'));
  });
  it('should insert and retrieve peers correctly without origin', function() {
    psetWithoutOrigin.insert(peer2);
    psetWithoutOrigin.insert(peer3);
    var peers = psetWithoutOrigin.allPeers();
    var peerIps = []
    for (var i = 0; i < peers.length; i++) {
      peerIps.push(peers[i].getSpec().ip);
    }
    assert(_.contains(peerIps, '127.0.0.1'));
    assert(_.contains(peerIps, '0.0.0.0'));

    psetWithoutOrigin.insert(peer4);
    var peers = psetWithoutOrigin.allPeers();
    var peerIps = [] 
    for (var i = 0; i < peers.length; i++) {
      peerIps.push(peers[i].getSpec().ip);
    }
    assert(_.contains(peerIps, '1.1.1.1'));
  });
});
