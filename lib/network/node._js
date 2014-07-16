var assert = require('assert');

var Async = require('async');
var U = require('underscore');


var Store = require('../store');
var Value = require('../value');

var NetUtil = require('./netutil');
var Peer = require('./peer');
var PeerSet = require('./peerset');

// Represents a node in the network.
function Node(kwargs) {
  var self = this;
  kwargs = kwargs || {};
  var config = kwargs.config || {};
  self.hashDataStore = kwargs.hashDataStore || new Store.CheckingHashStore(new Store.MemoryStore());
  var varEvaluator = kwargs.varEvaluator || {
    defaultValue: function(varSpec, callback) {
      callback('no var evaluator specified for Node');
    },
    merge: function(varSpec, value1, value2, callback) {
      callback('no var evaluator specified for Node');
    }
  };
  self.varStore = kwargs.varStore || new Store.MergingVarStore(varEvaluator, new Store.MemoryStore());
  self.queryStore = kwargs.queryStore || new Store.MemoryStore();
  self.transport = kwargs.transport;
  self.peerSet = new PeerSet();
}

Node.prototype.getSelfPeer = function(_) {
  if (!this.selfPeer) {
    this.selfPeer = new Peer(this, this.transport.getSelfPeer(_));
  }
  return this.selfPeer;
}

Node.prototype.iterativeFindNodes = function(queryHash, onEachIter, _) {
  var self = this;
  var alreadyQueried = {};
  var toQuery = NetUtil.sortPeersByDistance(queryHash, self.peerSet.allPeers()).slice(0, NetUtil.ALPHA);
  for (var i = 0; i < 10; i++) {
    U.each(toQuery, function(peer) {
      alreadyQueried[peer.getID().toString('hex')] = true;
    });
    var results = toQuery.map_(_, -1, function(_, peer) {
      try {
        return peer.find(queryHash, _);
      } catch (err) {
        return {error: err};
      }
    });
    onEachIter(toQuery, results);
    var nextPeers = U.flatten(U.map(results, function(r) {
      return U.map(r.nodes || [], function(spec) { return new Peer(self, spec); });
    }), true);
    nextPeers = NetUtil.uniquePeers(nextPeers);
    nextPeers = U.filter(nextPeers, function(peer) {
      return !alreadyQueried[peer.getID().toString('hex')];
    });
    toQuery = NetUtil.sortPeersByDistance(queryHash, nextPeers).slice(0, NetUtil.ALPHA);
  }
};

Node.prototype.findIterative = function(query, _) {
  var self = this;
  var bestValue = self.defaultQueryValue(query);
  function onEachIter(peers, results) {
    U.each(results, function(r) {
      if('value' in r) {
        bestValue = self.mergeQueryValues(bestValue, r.value);
      }
    });
  }
  self.iterativeFindNodes(Value.hashData(query), onEachIter, _);
  return bestValue;
};

Node.prototype.findClosestNodesIterative = function(queryHash, _) {
  var self = this;
  var allPeers = [];
  function onEachIter(peers, results) {
    allPeers.push.apply(allPeers, peers);
    U.each(results, function(r) {
      U.each(r.nodes || [], function(spec) {
        allPeers.push(new Peer(self, spec));
      });
    });
  }
  self.iterativeFindNodes(queryHash, onEachIter, _);
  var uniquePeers = NetUtil.uniquePeers(allPeers);
  var closestPeers = NetUtil.sortPeersByDistance(queryHash, uniquePeers).slice(0, NetUtil.ALPHA);
  return closestPeers;
};

Node.prototype.storeIterative = function(query, value, _) {
  var self = this;
  var queryHash = Value.hashData(query);
  var closestPeers = self.findClosestNodesIterative(queryHash, _);
  closestPeers.forEach_(_, function(_, p) { p.store(query, value, _); });
};

Node.prototype.defaultQueryValue = function(query) {
  return [];
};

Node.prototype.mergeQueryValues = function(oldValue, storingValue) {
  assert.equal('array', Value.valueType(oldValue));
  assert.equal('array', Value.valueType(storingValue));
  // TODO better checking
  return U.uniq(oldValue.concat(storingValue), function(peer) {
    return Value.encodeValue(peer).toString('hex');
  });
};

Node.prototype.startServer = function(_) {
  var self = this;
  self.transport.startServer(function(reqObj, _) {
    var methodName = 'handle_' + reqObj.type;
    if (methodName in self) {
      if ('sender' in reqObj) {
        self.peerSet.insert(new Peer(self, reqObj.sender));
      }
      return self[methodName](reqObj, _);
    } else {
      throw new Error('Unknown message type ' + reqObj.type + '.');
    }
  }, _);
  var selfPeer = self.getSelfPeer(_);
  self.peerSet.setOrigin(selfPeer.getID())
  self.peerSet.insert(selfPeer);
  self.peerSet = new PeerSet();
  U.each(self.transport.getBootstraps(_), function(bootstrap) {
    self.peerSet.insert(new Peer(self, bootstrap));
  });
  self.iterativeFindNodes(selfPeer.getID(), function() { }, _);
};

Node.prototype.handle_gethashdata = function(reqObj, _) {
  // TODO check if hash is valid
  try {
    var value = this.hashDataStore.getHashData(reqObj.hash, _);
    return {found: true, value: value};
  } catch (err) {
    if (err = 'not found') {
      return {found: false};
    } else {
      return {error: 'internal error'};
    }
  }
};

Node.prototype.handle_getvar = function(reqObj, _) {
  try {
    var value = this.varStore.getVar(reqObj.variable, _);
    return {found: true, value: value};
  } catch (err) {
    return {error: 'internal error'};
  }
};

Node.prototype.handle_putvar = function(reqObj, callback) {
  var self = this;
  self.varStore.putVar(reqObj.variable, reqObj.value, function(err) {
    callback(null, err ? {error: 'internal error'} : {});
  });
};

Node.prototype.handle_ping = function(reqObj, _) {
  return {success: true};
};

Node.prototype.handle_find = function(reqObj, _) {
  var queryHash = reqObj.queryhash;
  var result = {};
  try {
    var data = this.queryStore.get(queryHash, _);
    result.value = data;
  } catch (err) { }
  var peers = NetUtil.sortPeersByDistance(queryHash, this.peerSet.allPeers()).slice(0, NetUtil.ALPHA);
  result.nodes = U.pluck(peers, 'spec');
  return result;
};

Node.prototype.handle_store = function(reqObj, callback) {
  var self = this;
  var query = reqObj.query;
  var queryHash = Value.hashData(query);
  var storingValue = reqObj.value;
  self.queryStore.get(queryHash, function(err, data) {
    var oldValue = err ? self.defaultQueryValue(query) : data;
    var newValue = self.mergeQueryValues(oldValue, storingValue);
    if (!Value.valuesEqual(oldValue, newValue)) {
      self.queryStore.put(queryHash, newValue, function(err) {
        var result = err ? {error: 'internal error'} : {value: newValue};
        callback(null, result);
      });
    } else {
      callback(null, {value: newValue});
    }
  });
};

Node.prototype.getHashData = function(hash, _) {
  var query = {type: 'hash', hash: hash};
  var seeders = this.findIterative(query, _);
  for (var i = 0; i < seeders.length; i++) {
    var data = new Peer(this, seeders[i]).gethashdata(hash, _);
    if ('value' in data && Value.hashData(data.value).toString('hex') == hash.toString('hex')) {
      return data.value;
    }
  }
  throw 'not found';
};

Node.prototype.putHashData = function(value, _) {
  var hash = Value.hashData(value);
  var query = {type: 'hash', hash: hash};
  var queryHash = Value.hashData(query);
  this.storeIterative(query, [this.getSelfPeer(_).getSpec()], _);
};

Node.prototype.getVar = function(variable, _) {
  var self = this;
  var query = {type: 'var', variable: variable};
  var varpeers = self.findIterative(query, _);
  varpeers.forEach_(_, -1, function(_, p) {
    var peer = new Peer(self, p);
    try {
      var data = new Peer(self, p).getvar(variable, _);
      if (data.value) {
        self.varStore.putVar(variable, data.value, _);
      }
    } catch (err) { }
  });
  return self.varStore.getVar(variable, _);
};

Node.prototype.putVar = function(variable, value, _) {
  var self = this;
  var query = {type: 'var', variable: variable};
  var actions = [
    function(_) {
      self.storeIterative(query, [self.getSelfPeer(_).getSpec()], _);
    },
    function(_) {
      var varPeers = self.findIterative(query, _);
      varPeers.forEach_(_, -1, function(_, p) {
        try {
          new Peer(self, p).putvar(variable, value, _);
        } catch (err) { }
      });
  }];
  actions.forEach_(function(_, f) { f(_); });
  return value;
};

module.exports = Node;
