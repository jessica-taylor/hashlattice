/**
 * Interfaces and implementations for stores.
 */

var Util = require('util');
var assert = require('assert');
var Fs = require('fs');
var Path = require('path');
var Events = require('events');

var ReadWriteLock = require('rwlock');
var _ = require('underscore');
var mkdirp = require('mkdirp');

var U = require('./utilities');
var Value = require('./value');


var BROWSER_FS_BYTES = 100*1024*1024;

function reportPutError(err) {
  console.log('PUT ERROR', err);
}

/**
 * The ValueStore interface can be described as follows:
 * get: function(key: Buffer, function(error?, value: Data))
 *   Takes a key and calls the callback with the value if found.  If a value
 *   is not found, call with error = 'not found'.
 * put: function(key: Buffer, value: Data, function(error?))
 *   Puts the value in the store.  Calls the callback afterwards, perhaps with
 *   an error.
 */

// In-memory store.  Implements ValueStore interface.
class MemoryStore {
  constructor(initialValues) {
    this.store = {};
    if (initialValues) {
      for (const v of initialValues) {
        this.store[Value.encodeValue(v[0]).toString('hex')] = v[1];
      }
    }
  }
  get(key) {
    return new Promise((resolve, reject) => {
      var str = Value.encodeValue(key).toString('hex');
      if (str in this.store) {
        resolve(this.store[str]);
      } else {
        reject('not found');
      }
    });
  }

  put(key, value) {
    return new Promise((resolve, reject) => {
      this.store[Value.encodeValue(key).toString('hex')] = value;
      resolve();
    });
  }
}


// Store using files in a directory.  Implements ValueStore interface.
class FileStore {
  constructor(directory) {
    this.directory = directory;
    this.made = false;
    mkdirp(this.directory, err => {
      assert(!err, err);
      this.made = true;
    });
  }
  // Get file name for a key.
  getFile(key) {
    const self = this;
    return U.rg(function*() {
      yield U.waitUntil(() => self.made);
      yield [Path.join(self.directory, Value.encodeValue(key).toString('hex'))];
    });
  }

  get(key) {
    const self = this;
    return U.rg(function*() {
      const fname = yield self.getFile(key);
      try {
        const data = yield U.cbpromise(Fs.readFile, fname);
        yield [Value.decodeValue(data)];
      } catch(err) {
        throw err.code == 'ENOENT' ? 'not found' : err;
      }
    });
  }
  put(key, value) {
    const self = this;
    return U.rg(function*() {
      yield U.cbpromise(Fs.writeFile, yield self.getFile(key), Value.encodeValue(value));
    });
  }
}

// NOTE: browser things don't work

function BrowserLocalStore(prefix) {
  this.prefix = prefix;
}

BrowserLocalStore.prototype.get = function(key, _) {
  var keyHex = this.prefix + ':' + Value.encodeValue(key).toString('hex');
  var result = window.localStorage.getItem(keyHex);
  if (result === null) {
    throw 'not found';
  } else {
    return Value.decodeValue(new Buffer(result, 'hex'));
  }
};

BrowserLocalStore.prototype.put = function(key, value, _) {
  var keyHex = this.prefix + ':' + Value.encodeValue(key).toString('hex');
  var valueHex = Value.encodeValue(value).toString('hex');
  window.localStorage.setItem(keyHex, valueHex);
};

function BrowserFileStore(prefix) {
  this.prefix = prefix;
}

BrowserFileStore.prototype.getFs = function(callback) {
  function errorHandler(err) {
    callback(err);
  }
  function onInitFs(fs) {
    callback(null, fs);
  }
  webkitStorageInfo.requestQuota(webkitStorageInfo.PERSISTENT, BROWSER_FS_BYTES,
    function(grantedBytes) {
      window.webkitRequestFileSystem(webkitStorageInfo.PERSISTENT, grantedBytes, onInitFs,
      errorHandler);
    }, errorHandler);
};

BrowserFileStore.prototype.get = function(key, callback) {
  var self = this;
  var key = self.prefix + '-' + Value.encodeValue(key).toString('hex');
  function errorHandler(err) {
    callback(err);
  }
  self.getFs(function(err, fs) {
    if (err) {
      callback(err);
    } else {
      fs.root.getFile(key, null, function(fileEntry) {
        fileEntry.file(function(f) {
          var reader = new FileReader();
          reader.onload = function(e) {
            callback(null, Value.decodeValue(new Buffer(new Uint8Array(e.target.result))));
          };
          reader.onerror = errorHandler;
          reader.readAsArrayBuffer(f);
        }, errorHandler);
      }, function(err) {
        if (err.message == 'A requested file or directory could not be found at the time an operation was processed.') {
          err = 'not found';
        }
        callback(err);
      });
    }
  });
};

BrowserFileStore.prototype.put = function(key, value, callback) {
  var self = this;
  var key = self.prefix + '-' + Value.encodeValue(key).toString('hex');
  function errorHandler(err) {
    callback(err);
  }
  self.getFs(function(err, fs) {
    if (err) {
      callback(err);
    } else {
      fs.root.getFile(key, {create: true}, function(fileEntry) {
        fileEntry.createWriter(function(f) {
          f.onwriteend = function() { callback(); }
          f.onerror = errorHandler;
          f.write(new Blob([Value.encodeValue(value)]));
        }, errorHandler);
      }, errorHandler);
    }
  });
};



// Layer 2 value stores, creating another value store.
class LayeredValueStore {
  constructor(store1, store2) {
    this.store1 = store1;
    this.store2 = store2;
  }

  get(key) {
    return this.store1.get(key).catch(
        err1 => this.store2.get(key).then(
          res => this.store1.put(key, res).catch(reportPutError).then(
            () => Promise.resolve(res))));
  }

  put(key, value) {
    return this.store1.put(key, value).then(
        () => this.store2.put(key, value),
        err1 => this.store2.put(key, value).catch(
          // Prefer reporting err2, as store2 is the backup store.
          err2 => Promise.reject(err2 || err1)));
  }
}


// Layer multiple value stores.
function layerValueStores(store, ...stores) {
  for (var nextStore of stores) {
    store = new LayeredValueStore(store, nextStore);
  }
  return store;
}


/**
 * The HashStore interface can be described as follows:
 * getHashData: function(hash: Buffer, function(error?, value: Data))
 *   Takes a hash and calls the callback with a value with this hash, if found.
 *   If a value with the hash is not found, call with error = 'not found'.
 * putHashData: function(value: Data, function(error?))
 *   Puts the value in the store, addressed by its hash code.  Calls the
 *   callback afterwards, perhaps with an error.
 */

// Hash store based on a ValueStore that checks gotten values.
class CheckingHashStore {
  constructor(valueStore) {
    this.valueStore = valueStore;
    assert(this.valueStore);
  }
  getHashData(hash) {
    const self = this;
    return U.rg(function*() {
      const data = yield self.valueStore.get(hash);
      if (Value.hashData(data).toString('hex') != hash.toString('hex')) {
        throw new Error('bad hash')
      }
      return data;
    });
  }
  putHashData(data) {
    return this.valueStore.put(Value.hashData(data), data);
  }
}

class LayeredHashStore {
  constructor(store1, store2) {
    this.store1 = store1;
    this.store2 = store2;
  }

  getHashData(hash) {
    return this.store1.getHashData(hash).catch(
        err1 => this.store2.getHashData(hash).then(
          data => this.store1.putHashData(data).catch(reportPutError).then(
            () => Promise.resolve(data))));
  }

  putHashData(data) {
    return this.store1.putHashData(data).then(
        () => this.store2.putHashData(data),
        err1 => this.store2.putHashData(data).catch(
          // Prefer reporting err2, as store2 is the backup store.
          err2 => Promise.reject(err1 || err2)));
  }
}

// Layer multiple hash stores.
function layerHashStores(store, ...stores) {
  for (var nextStore of stores) {
    store = new LayeredHashStore(store, nextStore);
  }
  return store;
}


/**
 * The VarEvaluator interface can be described as follows:
 * defaultValue: function(varSpec: Data, function(error?, value: Data))
 *   Takes a variable specification and calls the callback with the default
 *   value for the variable.
 * merge: function(varSpec: Data, value1: Data, value2: Data, function(error? value: Data))
 *   Calls the callback with the result of merging the old value with the new
 *   one according to the varSpec.
 */


/**
 * The VarStore interface can be described as follows:
 * getVar: function(varSpec: Data, function(error?, value: Data))
 *   Takes a variable specification and calls the callback with the best value
 *   of the variable.  This should not return errors under normal circumstances.
 * putHashData: function(varSpec: Data, value: Data, function(error?))
 *   Merges the stored value with a new value.  Calls callback afterwards,
 *   perhaps with an error.
 */

// Var stores don't work!
// Variable store backed by a ValueStore that merges new values in.
function MergingVarStore(varEvaluator, valueStore) {
  this.varEvaluator = varEvaluator;
  this.valueStore = valueStore;
  this.lock = new ReadWriteLock();
}

MergingVarStore.prototype.getVar = function(varSpec, _) {
  var self = this;
  var varSpecHash = Value.hashData(varSpec);
  var def = this.varEvaluator.defaultValue(varSpec, _);
  try {
    var got = this.valueStore.get(varSpecHash, _);
  } catch (err) {
    return def;
  }
  try {
    return this.varEvaluator.merge(varSpec, def, got, _);
  } catch (err) {
    return got;
  }
};

MergingVarStore.prototype.putVar = function(varSpec, value, _) {
  var varSpecHash = Value.hashData(varSpec);
  var def = this.varEvaluator.defaultValue(varSpec, _);
  var release = this.lock.async.writeLock(_);
  try {
    var oldValue = def;
    try {
      var got = this.valueStore.get(varSpecHash, _);
      oldValue = this.varEvaluator.merge(varSpec, def, got, _);
    } catch (err) {
    }
    var merged = this.varEvaluator.merge(varSpec, oldValue, value, _);
    this.valueStore.put(varSpecHash, merged, _);
    return merged;
  } finally {
    release();
  }
};

function LayeredVarStore(store1, store2) {
  this.store1 = store1;
  this.store2 = store2;
}

LayeredVarStore.prototype.getVar = function(varSpec, callback) {
  var self = this;
  self.store2.getVar(varSpec, function(err, v2) {
    if (err) {
      self.store1.getVar(varSpec, callback);
    } else {
      self.store1.putVar(varSpec, v2, callback);
    }
  });
};

LayeredVarStore.prototype.putVar = function(varSpec, value, callback) {
  var self = this;
  self.store1.putVar(varSpec, value, function(err, v1) {
    self.store2.putVar(varSpec, err ? value : v1, callback);
  });
};

// Layer multiple variable stores.
function layerVarStores() {
  var store = arguments[0];
  for (var i = 1; i < arguments.length; i++) {
    store = new LayeredVarStore(store, arguments[i]);
  }
  return store;
}

module.exports = {
  MemoryStore: MemoryStore,
  FileStore: FileStore,
  LayeredValueStore: LayeredValueStore,
  layerValueStores: layerValueStores,
  CheckingHashStore: CheckingHashStore,
  LayeredHashStore: LayeredHashStore,
  layerHashStores: layerHashStores,
  MergingVarStore: MergingVarStore,
  LayeredVarStore: LayeredVarStore,
  layerVarStores: layerVarStores
};

if ((function() { return this && this.window; })()) {
  module.exports.BrowserLocalStore = BrowserLocalStore;
  module.exports.BrowserFileStore = BrowserFileStore;
}
