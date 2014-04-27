/**
 * Interfaces and implementations for stores.
 */

var Fs = require('fs');
var Path = require('path');

var _ = require('underscore');

var Value = require('./value');

/**
 * The store interface can be described as follows:
 * get: function(key: Buffer, function(error?, value: Data))
 *   Takes a key and calls the callback with the value if found.  If a value
 *   is not found, call with error = 'not found'.
 * put: function(key: Buffer, value: Data, function(error?))
 *   Puts the value in the store.  Calls the callback afterwards, perhaps with
 *   an error.
 */

// In-memory store.
function MemoryStore(initialValues) {
  var self = this;
  this.store = {};
  if (initialValues) {
    _.each(initialValues, function(v) {
      self.store[v[0].toString('hex')] = v[1];
    });
  }
}

MemoryStore.prototype.get = function(key, callback) {
  var str = key.toString('hex');
  if (str in this.store) {
    callback(null, this.store[str]);
  } else {
    callback('not found');
  }
};

MemoryStore.prototype.put = function(key, value, callback) {
  this.store[key.toString('hex')] = value;
  callback(null);
};

// Store using files in a directory.
function FileStore(directory) {
  this.directory = directory;
}

// Get file name for a key.
FileStore.prototype.getFile = function(key) {
  return Path.join(this.directory, key.toString('hex'));
};

FileStore.prototype.get = function(key, callback) {
  Fs.readFile(this.getFile(key), function(err, data) {
    if (err) {
      callback(err.code == 'ENOENT' ? 'not found' : err);
    } else {
      callback(null, Value.decodeValue(data));
    }
  });
};

FileStore.prototype.put = function(key, value, callback) {
  Fs.writeFile(this.getFile(key), Value.encodeValue(value), function(err) {
    if (err) {
      callback(err);
    }
    callback(null);
  });
};

// Store using a network.
function NetworkStore(network) {
  this.network = network;
}

NetworkStore.prototype.get = function(key, callback) {
  this.network.get(key, function(err, binary) {
    if (err) {
      callback(err);
    } else {
      callback(null, Value.decodeValue(binary));
    }
  });
};

NetworkStore.prototype.put = function(key, value, callback) {
  this.network.put(key, Value.encodeValue(value), callback);
};

// Layer 2 stores.
function LayeredStore(store1, store2) {
  this.store1 = store1;
  this.store2 = store2;
}

LayeredStore.prototype.get = function(key, callback) {
  var self = this;
  self.store1.get(key, function(err1, value1) {
    if (!err1) {
      callback(value1);
    } else {
      self.store2.get(key, function(err2, value2) {
        if (err2) {
          callback(err2);
        } else {
          self.store1.put(key, value2, function() {
            callback(null, value2);
          });
        }
      });
    }
  });
};

LayeredStore.prototype.put = function(key, value, callback) {
  var self = this;
  self.store1.put(key, value, function(err1) {
    self.store2.put(key, value, function(err2) {
      // Prefer reporting err2, as store2 is the backup store.
      callback(err2 || err1);
    });
  });
};

// Layer multiple stores.
function layerStores() {
  var store = arguments[0];
  for (var i = 1; i < arguments.length; i++) {
    store = new LayeredStore(store, arguments[i]);
  }
  return store;
}

module.exports = {
  MemoryStore: MemoryStore,
  FileStore: FileStore,
  NetworkStore: NetworkStore,
  LayeredStore: LayeredStore,
  layerStores: layerStores
};
