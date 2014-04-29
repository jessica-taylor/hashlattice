var _ = require('underscore');
var wait = require('wait.for');

var Network = require('./network');
var Store = require('./store');
var Value = require('./value');
var Code = require('./code');

function Server(kwargs) {
  kwargs = kwargs || {};
  // hashStore maps hash code to data value with that hash
  this.hashStore = kwargs.hashStore || new Store.CheckingHashStore(new Store.MemoryStore());
  // hashEvalStore maps hash code to evaluation of the computation with that
  // hash, if this evaluation is data
  this.hashEvalStore = kwargs.hashEvalStore || new Store.MemoryStore();
  // Each var store maps hash code of variable computation to current data
  // value for the variable.  localVarStore stores the current locally stored
  // value, while globalVarStore stores the current global value (usually in
  // the network).
  this.localVarStore = kwargs.localVarStore || new Store.MemoryStore();
  this.globalVarStore = kwargs.globalVarStore || new Store.MemoryStore();
}

/**
 * Gets the data value with the given hashcode.
 * @param {Buffer} hash Hash code of the computation.
 * @param {function} callback
 */
Server.prototype.getHashData = function(hash, callback) {
  // TODO: check the hash code to make sure it's correct
  this.hashStore.getHashData(hash, callback);
};

/**
 * Gets the evaluation of the computation with the given hashcode.
 *
 * This uses caching to avoid evaluating the same static computation twice,
 * but only if the computation specifies that it should be stored and the value
 * is data.
 * @param {Buffer} hash Hash code of the computation
 * @param {function} callback
 */
Server.prototype.getHash = function(hash, callback) {
  var self = this;
  self.hashEvalStore.get(hash, function(err, result) {
    if (!err) {
      callback(null, result);
    } else {
      self.getHashData(hash, function(err, comp) {
        if (err) {
          callback(err);
        } else {
          self._rawEvalComputation(hash, comp, callback);
        }
      });
    }
  });
};


/*Evaluates a static computation.

Called when both the computation and its hashcode are known, and stores
have already been checked.

Arguments:
  comp: Static computation.
  hashcode: Hash code of comp.

Returns:
  Evaluation of the static computation.
  */
Server.prototype._rawEvalComputation = function(hash, comp, callback) {
  var self = this;
  // Convert methods to synchronous versions.
  var api = {
    getHash: function(hash) { return wait.forMethod(self, 'getHash', hash); },
    getHashData: function(hash) { return wait.forMethod(self, 'getHashData', hash); },
    evalComputation: function(comp) { return wait.forMethod(self, 'evalComputation', comp); }
  };
  Code.evalComputation(comp, api, function(err, result) {
    if (err) {
      callback(err);
    } else {
      if (comp.store && Value.isData(result)) {
        self.hashEvalStore.put(hash, result, function(err) { 
          callback(null, result); 
        });
      } else {
        callback(null, result);
      }
    }
  });
};

/*
Evaluates a static computation.

This uses caching to avoid evaluating the same static computation twice,
but only if the computation specifies that it should be stored and the value
is data.

Arguments:
  comp: The static computation.

Returns:
  Evaluation of the static computation.
*/
Server.prototype.evalComputation = function(comp, callback) {
  var self = this;
  var hash = Value.hashData(comp);
  self.hashEvalStore.get(hash, function(err, result) {
    if (!err) {
      callback(null, result);
    } else {
      self._rawEvalComputation(hash, comp, callback);
    }
  });
};

/*
 * Inserts the given data value (often a static computation) into the store.

Arguments:
  value: Value to store.
*/
Server.prototype.putHashData = function(value, callback) {
  var self = this;
  if (Value.isData(value)) {
    self.hashStore.putHashData(value, callback);
  } else {
    callback('not a value');
  }
};

Server.prototype.getVarEvaluator = function() {
  var self = this;
  var varSpecCache = {};
  function getVarObj(varSpec, callback) {
    var hexVarSpec = Value.encodeValue(varSpec).toString('hex');
    if (hexVarSpec in varSpecCache) {
      callback(null, varSpecCache[hexVarSpec]);
    } else {
      self.evalComputation(varSpec, function(err, varObj) {
        if (err) {
          callback(err);
        } else {
          varSpecCache[hexVarSpec] = varObj;
          callback(null, varObj);
        }
      }
    }
  }
  return {
    defaultValue: function(varSpec, callback) {
      getVarObj(varSpec, function(err, varObj) {
        if (err) {
          callback(err);
        } else {
          varObj.defaultValue.async([], callback);
        }
      });
    },
    merge: function(varSpec, value1, value2, callback) {
      getVarObj(varSpec, function(err, varObj) {
        if (err) {
          callback(err);
        } else {
          varObj.merge.async([value1, value2], callback);
        }
      });
    }
  };
};

// Gets the value of a variable.
Server.prototype.getVar = function(varComp, callback) {
  var self = this;
  self.evalComputation(varComp, function(err, varSpec) {
    if (err) {
      callback(err);
    } else {
      // TODO: try catch
      var hash = Value.hashData(varComp);
      var defaultValue = varSpec.defaultValue();
      self.localVarStore.get(hash, function(err, localValue) {
        var localValue = err ? defaultValue : varSpec.merge(defaultValue, localValue);
        self.globalVarStore.get(hash, function(err, globalValue) {
          // TODO: try catch
          if (err) {
            callback(null, localValue);
          } else {
            var bestValue = varSpec.merge(localValue, globalValue)
            self.localVarStore.put(hash, bestValue, function(err) {
              callback(null, bestValue);
            });
          }
        });
      });
    }
  });
};

// Puts a variable value.
Server.prototype.putVar = function(varComp, value, callback) {
  // TODO check for data
  var self = this;
  self.evalComputation(varComp, function(err, varSpec) {
    if (err) {
      callback(err);
    } else {
      var hash = Value.hashData(varComp);
      var defaultValue = varSpec.defaultValue();
      self.getVar(varComp, function(err, currentBestValue) {
        var bestValue = varSpec.merge(currentBestValue, value);
        self.globalVarStore.put(hash, bestValue, function(err) {
          callback(err);
        });
      });
    }
  });
};

module.exports = {
  Server: Server
};
