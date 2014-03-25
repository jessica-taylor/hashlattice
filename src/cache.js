/**
 * Interfaces and implementations for caches.
 */

/**
 * Cache interface.
 * @interface
 */
function Cache() { }

Cache.prototype.contains = function(key, callback) { };

Cache.prototype.get = function(key, callback) { };

Cache.prototype.put = function(key, value, callback) { };


function MemoryCache(initial) {
  this.cache = initial || {};
}

MemoryCache.prototype.contains = function(key) {
  return key.toString('hex') in this.cache;
};

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

LayeredCache.prototype.contains = function(key, callback) {
  var self = this;
  self.cache1.contains(key, function(contains1) {
    if (contains1) {
      callback(true);
    } else {
      self.cache2.contains(key, callback);
    }
  });
};

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

function NetworkCache(network) {
  this.network = network;
}

NetworkCache.prototype.contains = function(key, callback) {
  this.get(key, function(found) { callback(found); });
};

NetworkCache.prototype.get = function(key, callback) {
  this.network.get(key, callback);
};

NetworkCache.prototype.put = function(key, callback) {
  this.network.put(key, callback);
};

module.exports = {
  Cache: Cache,
  MemoryCache: MemoryCache,
  LayeredCache: LayeredCache
};
