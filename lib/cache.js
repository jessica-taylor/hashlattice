/**
 * Interfaces and implementations for caches.
 */

var Fs = require('fs');
var Path = require('path');

var _ = require('underscore');

var Value = require('./value');

/**
 * Cache interface.
 * @interface
 */
function Cache() { }

// Key is a buffer.  Callback gets called with (error, value).
// not found.
Cache.prototype.get = function(key, callback) { };

// Key is a buffer, value is a data value.  Callback gets called with (error,
// value).
Cache.prototype.put = function(key, value, callback) { };


// In-memory cache.
function MemoryCache(initial) {
  this.cache = initial ? _.clone(initial) : {};
}

MemoryCache.prototype.get = function(key, callback) {
  var str = key.toString('hex');
  if (str in this.cache) {
    callback(null, this.cache[str]);
  } else {
    callback('not found');
  }
};

MemoryCache.prototype.put = function(key, value, callback) {
  this.cache[key.toString('hex')] = value;
  callback(null);
};

// Cache using files in a directory.
function FileCache(directory) {
  this.directory = directory;
}

// Get file name for a key.
FileCache.prototype.getFile = function(key) {
  return Path.join(this.directory, key);
};

FileCache.prototype.get = function(key, callback) {
  Fs.readFile(this.getFile(key), function(err, data) {
    if (err) {
      callback(err.code == 'ENOENT' ? 'not found' : err);
    }
    callback(null, Value.decodeValue(data));
  });
};

FileCache.prototype.put = function(key, value, callback) {
  Fs.writeFile(this.getFile(key), Value.encodeValue(value), function(err) {
    if (err) {
      callback(err);
    }
    callback(null);
  });
};

// Cache using a network.
function NetworkCache(network) {
  this.network = network;
}

NetworkCache.prototype.get = function(key, callback) {
  this.network.get(key, function(err, binary) {
    if (err) {
      callback(err);
    } else {
      callback(null, Value.decodeValue(binary));
    }
  });
};

NetworkCache.prototype.put = function(key, value, callback) {
  this.network.put(key, Value.encodeValue(value), callback);
};

// Layer 2 caches.
function LayeredCache(cache1, cache2) {
  this.cache1 = cache1;
  this.cache2 = cache2;
}

LayeredCache.prototype.get = function(key, callback) {
  var self = this;
  self.cache1.get(key, function(err1, value1) {
    if (!err1) {
      callback(value1);
    } else {
      self.cache2.get(key, function(err2, value2) {
        if (err2) {
          callback(err2);
        } else {
          self.cache1.put(key, value2, function() {
            callback(null, value2);
          });
        }
      });
    }
  });
};

LayeredCache.prototype.put = function(key, value, callback) {
  var self = this;
  self.cache1.put(key, value, function(err1) {
    self.cache2.put(key, value, function(err2) {
      callback(err1 || err2);
    });
  });
};

// Layer multiple caches.
function layerCaches() {
  var cache = arguments[0];
  for (var i = 1; i < arguments.length; i++) {
    cache = new LayeredCache(cache, arguments[i]);
  }
  return cache;
}

module.exports = {
  Cache: Cache,
  MemoryCache: MemoryCache,
  FileCache: FileCache,
  NetworkCache: NetworkCache,
  LayeredCache: LayeredCache,
  layerCaches: layerCaches
};
