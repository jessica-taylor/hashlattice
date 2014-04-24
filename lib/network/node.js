var assert = require('assert');

var Async = require('async');
var _ = require('underscore');


var Cache = require('../cache');
var Value = require('../value');

var NetUtil = require('./netutil');
var Peer = require('./peer');
var PeerSet = require('./peerset');

function Node(kwargs) {
  var self = this;
  kwargs = kwargs || {};
  var config = kwargs.config || {};
  self.hashDataCache = kwargs.hashDataCache || new Cache.MemoryCache();
  self.varCache = kwargs.varCache || new Cache.MemoryCache();
  self.queryCache = kwargs.queryCache || new Cache.MemoryCache();
  self.peerSet = new PeerSet();
  // TODO bootstraps
  self.transport = kwargs.transport;
}

Node.prototype.respondWithData = function(res, data) {
  res.writeHead(200, {'Content-Type': 'application/octet-stream'});
  res.end(Value.encodeValue(data));
};

Node.prototype.respondWithError = function(res, message) {
  res.writeHead(400, {'Content-Type': 'text/plain'});
  res.end(message);
};

Node.prototype.iterativeFindNodes = function(queryHash, onEachIter, callback) {
  var self = this;
  var alreadyQueried = {};
  var toQuery = NetUtil.sortPeersByDistance(queryHash, self.peerSet.allPeers()).slice(0, NetUtil.ALPHA);
  var hopsLeft = 10;
  function iterQuery() {
    if (hopsleft == 0) {
      callback(null);
      return;
    }
    hopsLeft--;
    _.each(toQuery, function(peer) {
      alreadyQueried[toQuery.getID().toString('hex')] = true;
    });
    Async.map(toQuery, function(peer, cb) {
      peer.find(queryHash, cb);
    }, function(err, results) {
      onEachIter(toQuery, results);
      var nextPeers = _.flatten(_.map(results, function(r) {
        return _.map(r.nodes || [], function(spec) { return new Peer(self, spec); });
      }), true);
      nextPeers = NetUtil.uniquePeers(nextPeers);
      nextPeers = _.filter(nextPeers, function(peer) {
        return !alreadyQueried[peer.getId().toString('hex')];
      });
      toQuery = NetUtil.sortPeersByDistance(queryHash, nextPeers).slice(0, NetUtil.ALPHA);
    });
  }
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
      _each(r.nodes || [], function(spec) {
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
  self.transport.startSever(function(reqObj, cb) {
    var methodName = 'handle_' + reqObj.type;
    if (methodName in self) {
      self.peerSet.insert(new Peer(self, reqObj.sender));
      self[methodName](reqObj, cb);
    } else {
      self.respondWithError(res, 'Unknown message type ' + reqObj.type + '.');
    }
  }, callback);
};

Node.prototype.handle_gethashdata = function(reqObj, callback) {
  var self = this;
  // TODO check if hash is valid
  self.hashDataCache.get(reqObj.hash, function(err, value) {
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

Node.prototype.handle_ping = function(reqObj, callback) {
  callback(null, {success: true});
};

Node.prototype.handle_find = function(reqObj, callback) {
  var self = this;
  var queryHash = reqObj.queryhash;
  self.queryCache.get(queryHash, function(err, data) {
    var result = {};
    if (!err) {
      result.value = data;
    }
    var peers = NetUtil.sortPeersByDistance(queryHash, self.peerSet.allPeers()).slice(0, NetUtil.ALPHA);
    result.peers = _.map(peers, function(peer) {
      return {ip: peer.ip, port: peer.port};
    });
    callback(null, result);
  });
};

Node.prototype.handle_store = function(reqObj, callback) {
  var self = this;
  var query = reqObj.query;
  var queryHash = Value.hashData(query);
  var storingValue = reqObj.value;
  self.queryCache.get(queryHash, function(err, data) {
    var oldValue = err ? self.defaultQueryValue(query) : data;
    var newValue = self.mergeQueryValues(oldValue, storingValue);
    if (!Value.valuesEqual(oldValue, newValue)) {
      self.queryCache.put(queryHash, newValue, function(err) {
        var result = err ? {error: 'internal error'} : {value: newValue};
        callback(null, result);
      });
    }
  });
};