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

function reportPutError(err: string) {
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
  constructor(initialValues: Array<[any, any]> = []) {
    this.store = {};
    if (initialValues) {
      for (const v of initialValues) {
        this.store[Value.encodeValue(v[0]).toString('hex')] = v[1];
      }
    }
  }
  get(key) {
    var str = Value.encodeValue(key).toString('hex');
    if (str in this.store) {
      return Promise.resolve(this.store[str]);
    } else {
      return Promise.reject('not found');
    }
  }

  put(key, value) {
    this.store[Value.encodeValue(key).toString('hex')] = value;
    return Promise.resolve();
  }
}


// Store using files in a directory.  Implements ValueStore interface.
class FileStore {
  constructor(directory: string) {
    this.directory = directory;
    this.made = false;
    mkdirp(this.directory, err => {
      assert(!err, err);
      this.made = true;
    });
  }
  // Get file name for a key.
  async getFile(key) {
    const self = this;
    await U.waitUntil(() => self.made);
    return Path.join(self.directory, Value.encodeValue(key).toString('hex'));
  }

  async get(key) {
    const self = this;
    const fname = await self.getFile(key);
    try {
      const data = await U.cbpromise(Fs.readFile, fname);
      return Value.decodeValue(data);
    } catch(err) {
      throw err.code == 'ENOENT' ? 'not found' : err;
    }
  }
  async put(key, value) {
    return await U.cbpromise(Fs.writeFile, await this.getFile(key), Value.encodeValue(value));
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
  async getHashData(hash) {
    const data = await this.valueStore.get(hash);
    if (Value.hashData(data).toString('hex') != hash.toString('hex')) {
      throw new Error('bad hash')
    }
    return data;
  }
  async putHashData(data) {
    return await this.valueStore.put(Value.hashData(data), data);
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

// Variable store backed by a ValueStore that merges new values in.
class MergingVarStore {
  constructor(varEvaluator, valueStore) {
    this.varEvaluator = varEvaluator;
    this.valueStore = valueStore;
    this.lock = new ReadWriteLock();
  }
  async getVar(varSpec) {
    var varSpecHash = Value.hashData(varSpec);
    var def = await this.varEvaluator.defaultValue(varSpec);
    try {
      var got = await this.valueStore.get(varSpecHash);
    } catch (err) {
      return def;
    }
    try {
      return await this.varEvaluator.merge(varSpec, def, got);
    } catch (err) {
      return got;
    }
  }
  async putVar(varSpec, value) {
    const varSpecHash = Value.hashData(varSpec);
    const def = await this.varEvaluator.defaultValue(varSpec);
    const release = await U.cbpromise(this.lock.async.writeLock);
    try {
      let oldValue = def;
      try {
        const got = await this.valueStore.get(varSpecHash);
        oldValue = await this.varEvaluator.merge(varSpec, def, got);
      } catch (err) {
      }
      const merged = await this.varEvaluator.merge(varSpec, oldValue, value);
      await this.valueStore.put(varSpecHash, merged);
      return merged;
    } finally {
      release();
    }
  }
}



class LayeredVarStore {
  constructor(store1, store2) {
    this.store1 = store1;
    this.store2 = store2;
  }
  async getVar(varSpec) {
    try {
      const v2 = await this.store2.getVar(varSpec);
      return await this.store1.putVar(varSpec, v2);
    } catch(err) {
      return await this.store1.getVar(varSpec);
    }
  }
  async putVar(varSpec, value) {
    try {
      const v1 = await this.store1.putVar(varSpec, value);
      return await this.store2.putVar(varSpec, v1);
    } catch (err) {
      return await this.store2.putVar(varSpec, value);
    }
  }
}

// Layer multiple variable stores.
function layerVarStores(store, ...stores) {
  for (const st of stores) {
    store = new LayeredVarStore(store, st);
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
