/**
 * Interfaces and implementations for caches.
 */

var Fs = require('fs');
var Path = require('path');

var _ = require('underscore');

var Value = require('./value');

/**
 * The cache interface can be described as follows:
 * get: function(key: Buffer, function(error?, value: Data))
 *   Takes a key and calls the callback with the value if found.  If a value
 *   is not found, call with error = 'not found'.
 * put: function(key: Buffer, value: Data, function(error?))
 *   Puts the value in the cache.  Calls the callback afterwards, perhaps with
 *   an error.
 */

// In-memory cache.
function MemoryCache(initialValues) {
  var self = this;
  this.cache = {};
  if (initialValues) {
    _.each(initialValues, function(v) {
      self.cache[v[0].toString('hex')] = v[1];
    });
  }
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
  return Path.join(this.directory, key.toString('hex'));
};

FileCache.prototype.get = function(key, callback) {
  Fs.readFile(this.getFile(key), function(err, data) {
    if (err) {
      callback(err.code == 'ENOENT' ? 'not found' : err);
    } else {
      callback(null, Value.decodeValue(data));
    }
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
      // Prefer reporting err2, as cache2 is the backup cache.
      callback(err2 || err1);
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
  MemoryCache: MemoryCache,
  FileCache: FileCache,
  NetworkCache: NetworkCache,
  LayeredCache: LayeredCache,
  layerCaches: layerCaches
};
