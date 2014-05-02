
var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Value = require('../../lib/value');
var Node = require('../../lib/network/node');
var NetUtil = require('../../lib/network/netutil');

var MockNetwork = require('./mockNetwork');

function randRange(low, high) {
  if (high == undefined) {
    high = low;
    low = 0;
  }
  return low + Math.floor(Math.random() * (high - low));
}

function randIP() {
  return randRange(256) + '.' + randRange(256) + '.' + randRange(256) + '.' + randRange(256);
}

function randPort() {
  return randRange(100, 60000);
}

function randUnique(gen, n) {
  var used = {};
  var vals = [];
  while (vals.length < n) {
    var val = gen();
    if (!(val in used)) {
      vals.push(val);
      used[val] = true;
    }
  }
  return vals;
}

function generatePeerSpecs(numIPs, numPorts) {
  return _.flatten(_.map(randUnique(randIP, numIPs), function(ip) {
    return _.map(randUnique(randPort, numPorts), function(port) {
      return {ip: ip, port: port};
    });
  }), true);
}

function selectBootstraps(peerSpecs, nbootstraps) {
  var indices = randUnique(function() { return randRange(peerSpecs.length); }, nbootstraps);
  return _.map(indices, function(i) { return peerSpecs[i]; });
}

describe('Node', function() {
  describe('putHashData', function() {
    it('should put values that can be gotten from other nodes', function(done) {
      var peerSpecs = generatePeerSpecs(20, 2);
      var network = new MockNetwork(peerSpecs);
      var value = [1, false, null, {x: new Buffer('cafe', 'hex')}]
      console.log('node1', network.transports[0].spec);
      console.log('node2', network.transports[1].spec);
      var node1 = new Node({
        transport: network.transports[0],
        bootstraps: [network.transports[1].spec]
      });
      var node2 = new Node({
        transport: network.transports[1],
        bootstraps: [network.transports[0].spec]
      });
      Async.parallel([_.bind(node1.startServer, node1), _.bind(node2.startServer, node2)], function() {
        node1.putHashData(value, function(err) {
          console.log('finished putHashData');
          assert(!err, err);
          node2.getHashData(Value.hashData(value), function(err, gotValue) {
            assert(!err, err);
            assert(Value.valuesEqual(value, gotValue));
            done();
          });
        });
      });
    });
  });
});
