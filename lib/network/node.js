var assert = require('assert');

var Async = require('async');
var _ = require('underscore');


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

Node.prototype.getSelfPeer = function(callback) {
  var self = this;
  if (self.selfPeer) {
    callback(null, self.selfPeer);
  } else {
    self.transport.getSelfPeer(function(err, peer) {
      if (err) {
        callback(err);
      } else {
        self.selfPeer = new Peer(self, peer);
        callback(null, self.selfPeer);
      }
    });
  }
}


Node.prototype.iterativeFindNodes = function(queryHash, onEachIter, callback) {
  var self = this;
  var alreadyQueried = {};
  var toQuery = NetUtil.sortPeersByDistance(queryHash, self.peerSet.allPeers()).slice(0, NetUtil.ALPHA);
  console.log('toQuery', _.pluck(toQuery, 'spec'));
  var hopsLeft = 10;
  function iterQuery() {
    if (hopsLeft == 0) {
      callback(null);
      return;
    }
    hopsLeft--;
    _.each(toQuery, function(peer) {
      alreadyQueried[peer.getID().toString('hex')] = true;
    });
    Async.map(toQuery, function(peer, cb) {
      peer.find(queryHash, cb);
    }, function(err, results) {
      console.log('result', results);
      onEachIter(toQuery, results);
      var nextPeers = _.flatten(_.map(results, function(r) {
        return _.map(r.nodes || [], function(spec) { return new Peer(self, spec); });
      }), true);
      nextPeers = NetUtil.uniquePeers(nextPeers);
      nextPeers = _.filter(nextPeers, function(peer) {
        return !alreadyQueried[peer.getID().toString('hex')];
      });
      toQuery = NetUtil.sortPeersByDistance(queryHash, nextPeers).slice(0, NetUtil.ALPHA);
      iterQuery();
    });
  }
  iterQuery();
};

Node.prototype.findIterative = function(query, callback) {
  var self = this;
  var bestValue = self.defaultQueryValue(query);
  function onEachIter(peers, results) {
    _.each(results, function(r) {
      if('value' in r) {
        bestValue = self.mergeQueryValues(bestValue, r.value);
      }
    });
  }
  self.iterativeFindNodes(Value.hashData(query), onEachIter, function(err) {
    if (err) {
      callback(err);
    } else {
      callback(null, bestValue);
    }
  });
};

Node.prototype.findClosestNodesIterative = function(queryHash, callback) {
  var self = this;
  var allPeers = [];
  function onEachIter(peers, results) {
    allPeers.push.apply(allPeers, peers);
    _.each(results, function(r) {
      _.each(r.nodes || [], function(spec) {
        allPeers.push(new Peer(self, spec));
      });
    });
  }
  self.iterativeFindNodes(queryHash, onEachIter, function(err) {
    if (err) {
      callback(err);
    } else {
      var uniquePeers = NetUtil.uniquePeers(allPeers);
      var closestPeers = NetUtil.sortPeersByDistance(queryHash, uniquePeers).slice(0, NetUtil.ALPHA);
      callback(null, closestPeers);
    }
  });
};

Node.prototype.storeIterative = function(query, value, callback) {
  var self = this;
  var queryHash = Value.hashData(query);
  self.findClosestNodesIterative(queryHash, function(err, closestPeers) {
    if (err) {
      callback(err);
    } else {
      Async.map(closestPeers, function(p, cb) {
        p.store(query, value, cb);
      }, function(err, results) {
        assert(!err, err);
        callback(null);
      });
    }
  });
};

Node.prototype.defaultQueryValue = function(query) {
  return [];
};

Node.prototype.mergeQueryValues = function(oldValue, storingValue) {
  assert.equal('array', Value.valueType(oldValue));
  assert.equal('array', Value.valueType(storingValue));
  // TODO better checking
  return _.uniq(oldValue.concat(storingValue), function(peer) {
    return Value.encodeValue(peer).toString('hex');
  });
};

Node.prototype.startServer = function(callback) {
  var self = this;
  self.transport.startServer(function(reqObj, cb) {
    var methodName = 'handle_' + reqObj.type;
    if (methodName in self) {
      if ('sender' in reqObj) {
        self.peerSet.insert(new Peer(self, reqObj.sender));
      }
      self[methodName](reqObj, function(err, respObj) {
        if (err) {
          cb(err);
        } else {
          cb(null, respObj);
        }
      });
    } else {
      cb('Unknown message type ' + reqObj.type + '.');
    }
  }, function() {
    self.getSelfPeer(function(err, selfPeer) {
      if (err) {
        callback(err);
      } else {
        self.peerSet.setOrigin(selfPeer.getID())
        self.peerSet.insert(selfPeer);
        self.transport.getBootstraps(function(err, bootstraps) {
          if (err) {
            callback(err);
          } else {
            self.peerSet = new PeerSet();
            for (var i = 0; i < bootstraps.length; i++) {
              self.peerSet.insert(new Peer(self, bootstraps[i]));
            }
            self.iterativeFindNodes(selfPeer.getID(), function() { }, callback);
          }
        });
      }
    }); 
  });
};

Node.prototype.handle_gethashdata = function(reqObj, callback) {
  var self = this;
  // TODO check if hash is valid
  self.hashDataStore.getHashData(reqObj.hash, function(err, value) {
    var result;
    if (err) {
      if (err == 'not found') {
        result = {found: false};
      } else {
        result = {error: 'internal error'};
      }
    } else {
      result = {found: true, value: value};
    }
    callback(null, result);
  });
};

Node.prototype.handle_getvar = function(reqObj, callback) {
  var self = this;
  self.varStore.getVar(reqObj.variable, function(err, value) {
    var result;
    if (err) {
      result = {error: 'internal error'};
    } else {
      result = {found: true, value: value};
    }
    callback(null, result);
  });
};

Node.prototype.handle_putvar = function(reqObj, callback) {
  var self = this;
  self.varStore.putVar(reqObj.variable, reqObj.value, function(err) {
    callback(null, err ? {error: 'internal error'} : {});
  });
};

Node.prototype.handle_ping = function(reqObj, callback) {
  callback(null, {success: true});
};

Node.prototype.handle_find = function(reqObj, callback) {
  var self = this;
  var queryHash = reqObj.queryhash;
  self.queryStore.get(queryHash, function(err, data) {
    var result = {};
    if (!err) {
      result.value = data;
    }
    var peers = NetUtil.sortPeersByDistance(queryHash, self.peerSet.allPeers()).slice(0, NetUtil.ALPHA);
    result.nodes = _.pluck(peers, 'spec');
    callback(null, result);
  });
};

Node.prototype.handle_store = function(reqObj, callback) {
  var self = this;
  var query = reqObj.query;
  var queryHash = Value.hashData(query);
  var storingValue = reqObj.value;
  console.log('queryStore.get', queryHash);
  self.queryStore.get(queryHash, function(err, data) {
    console.log('queryStore got', err, data);
    var oldValue = err ? self.defaultQueryValue(query) : data;
    var newValue = self.mergeQueryValues(oldValue, storingValue);
    if (!Value.valuesEqual(oldValue, newValue)) {
      console.log('queryStore.put', queryHash, newValue);
      self.queryStore.put(queryHash, newValue, function(err) {
        var result = err ? {error: 'internal error'} : {value: newValue};
        callback(null, result);
      });
    } else {
      callback(null, {value: newValue});
    }
  });
};

Node.prototype.getHashData = function(hash, callback) {
  var self = this;
  var query = {type: 'hash', hash: hash};
  console.log('getHashData', hash);
  self.findIterative(query, function(err, seeders) {
    console.log('seeders', seeders);
    if (err) {
      callback(err);
    } else {
      var i = 0;
      function askSeeders() {
        if (i >= seeders.length) {
          console.log('not found!');
          callback('not found');
        } else {
          new Peer(self, seeders[i]).gethashdata(hash, function(err, data) {
            console.log('peer', seeders[i], 'result', data);
            if ('value' in data && Value.hashData(data.value).toString('hex') == hash.toString('hex')) {
              callback(null, data.value);
            } else {
              i++;
              askSeeders();
            }
          });
        }
      }
      askSeeders();
    }
  });
};

Node.prototype.putHashData = function(value, callback) {
  var self = this;
  var hash = Value.hashData(value);
  var query = {type: 'hash', hash: hash};
  var queryHash = Value.hashData(query);
  self.getSelfPeer(function() {
    self.storeIterative(query, [self.selfPeer.getSpec()], callback);
  });
};

Node.prototype.getVar = function(variable, callback) {
  var self = this;
  var query = {type: 'var', variable: variable};
  self.findIterative(query, function(err, varpeers) {
    // TODO: filter them down?
    if (err) {
      callback(err);
    } else {
      Async.map(varpeers, function(p, cb) {
        var peer = new Peer(self, p);
        peer.getvar(variable, function(err, value) {
          if (value.value) {
            self.varStore.putVar(variable, value.value, function() { cb(); });
          } else {
            cb();
          }
        });
      }, function(err, results) {
        assert(!err, err);
        self.varStore.getVar(variable, callback);
      });
    }
  });
};

Node.prototype.putVar = function(variable, value, callback) {
  var self = this;
  var query = {type: 'var', variable: variable};
  Async.parallel([
    function(cb) {
      self.getSelfPeer(function() {
        self.storeIterative(query, [self.selfPeer.getSpec()], cb);
      });
    }, function(cb) {
      self.findIterative(query, function(err, varpeers) {
        // TODO: filter them down?
        if (err) {
          cb(err);
        } else {
          Async.map(varpeers, function(p, cb2) {
            var peer = new Peer(self, p);
            peer.putvar(variable, value, function() { cb2(); });
          }, function(err, results) {
            assert(!err, err);
            cb(null, value);
          });
        }
      });
    }], 
    function(err, results) {
      if (err) {
        callback(err);
      } else {
        callback(null, results[1]);
      }
    }
  );
};

module.exports = Node;
