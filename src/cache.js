/**
 * Interfaces and implementations for caches.
 */

var fs = require('fs');
var path = require('path');
var Value = require('./value');

/**
 * Cache interface.
 * @interface
 */
function Cache() { }

Cache.prototype.get = function(key, callback) { };

Cache.prototype.put = function(key, value, callback) { };


function MemoryCache(initial) {
  this.cache = initial || {};
}

MemoryCache.prototype.get = function(key, callback) {
  var str = key.toString('hex');
  if (str in this.cache) {
    callback(true, this.cache[str]);
  } else {
    callback(false);
  }
};

MemoryCache.prototype.put = function(key, value, callback) {
  this.cache[key.toString('hex')] = value;
  callback(true);
};

function LayeredCache(cache1, cache2) {
  this.cache1 = cache1;
  this.cache2 = cache2;
}

LayeredCache.prototype.get = function(key, callback) {
  var self = this;
  self.cache1.get(key, function(found1, value1) {
    if (found1) {
      callback(true, value1);
    } else {
      self.cache2.get(key, function(found2, value2) {
        if (found2) {
          self.cache1.put(key, value2, function() {
            callback(true, value2);
          });
        } else {
          callback(false);
        }
      }
    }
  });
};

LayeredCache.prototype.put = function(key, value, callback) {
  self.cache1.put(key, value, function(success1) {
    self.cache2.put(key, value, function(success2) {
      callback(success1 && success2);
    });
  });
};

function FileCache(directory) {
  this.directory = directory;
}

FileCache.prototype.getFile = function(key) {
  return path.join(this.directory, key);
};

FileCache.prototype.get = function(key, callback) {
  fs.readFile(this.getFile(key), function(err, data) {
    if (err) {
      callback(false, err);
    }
    callback(true, Value.decodeValue(data));
  });
};

FileCache.prototype.put = function(key, value, callback) {
  fs.writeFile(this.getFile(key), Value.encodeValue(value), function(err) {
    if (err) {
      callback(false, err);
    }
    callback(true);
  });
};

function NetworkCache(network) {
  this.network = network;
}

NetworkCache.prototype.get = function(key, callback) {
  this.network.get(key, function(found, binary) {
    if (found) {
      callback(true, Value.decodeValue(binary));
    } else {
      callback(false);
    }
  });
};

NetworkCache.prototype.put = function(key, value, callback) {
  this.network.put(key, Value.encodeValue(value), callback);
};

module.exports = {
  Cache: Cache,
  MemoryCache: MemoryCache,
  LayeredCache: LayeredCache
};
