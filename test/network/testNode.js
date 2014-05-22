
var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Value = require('../../lib/value');
var Store = require('../../lib/store');
var Server = require('../../lib/server');
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
      var node0 = new Node({
        transport: network.transports[0],
        bootstraps: [network.transports[1].spec]
      });
      var node1 = new Node({
        transport: network.transports[1],
        bootstraps: [network.transports[0].spec]
      });
      var node0hash = Store.layerHashStores(node0.hashDataStore, node0);
      var node1hash = Store.layerHashStores(node1.hashDataStore, node1);
      Async.parallel([_.bind(node0.startServer, node0), _.bind(node1.startServer, node1)], function() {
        node0hash.putHashData(value, function(err) {
          assert(!err, err);
          node1hash.getHashData(Value.hashData(value), function(err, gotValue) {
            assert(!err, err);
            assert(Value.valuesEqual(value, gotValue));
            done();
          });
        });
      });
    });
  });
  describe('putVar', function() {
    it('should put variable values that can be gotten from other nodes', function(done) {
      var peerSpecs = generatePeerSpecs(20, 2);
      var network = new MockNetwork(peerSpecs);
      var varComp = {
        data: {},
        code: '{defaultValue: function() { return [0,0]; }, ' +
              ' merge: function(x, y) { ' +
              '   return [Math.max(x[0], y[0]), Math.max(x[1], y[1])]; }}'
      };
      var varEvaluator = new Server.Server().getVarEvaluator();
      var node0 = new Node({
        transport: network.transports[0],
        varEvaluator: varEvaluator,
        bootstraps: [network.transports[1].spec]
      });
      var node1 = new Node({
        transport: network.transports[1],
        varEvaluator: varEvaluator,
        bootstraps: [network.transports[0].spec]
      });
      var node2 = new Node({
        transport: network.transports[2],
        varEvaluator: varEvaluator,
        bootstraps: [network.transports[0].spec]
      });
      var node0v = Store.layerVarStores(node0.varStore, node0);
      var node1v = Store.layerVarStores(node1.varStore, node1);
      var node2v = Store.layerVarStores(node2.varStore, node2);
      Async.parallel([_.bind(node0.startServer, node0), _.bind(node1.startServer, node1), _.bind(node2.startServer, node2)], function() {
        node1v.putVar(varComp, [6, 0], function(err) {
          assert(!err, err);
          node2v.putVar(varComp, [0, 5], function(err) {
            assert(!err, err);
            node0v.getVar(varComp, function(err, value) {
              assert(!err, err);
              assert(Value.valuesEqual([6, 5], value));
              done();
            });
          });
        });
      });
    });
  });
});
