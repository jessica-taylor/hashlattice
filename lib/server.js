var _ = require('underscore');

var Network = require('./network');
var Cache = require('./cache');
var Value = require('./value');
var Code = require('./code');

function Server(kwargs) {
  // hashDataCache maps hash code to data value with that hash
  this.hashDataCache = kwargs.hashDataCache || new Cache.MemoryCache();
  // hashEvalCache maps hash code to evaluation of the computation with that
  // hash, if this evaluation is data
  this.hashEvalCache = kwargs.hashEvalCache || new Cache.MemoryCache();
  // Each var cache maps hash code of variable computation to current data
  // value for the variable.  localVarCache stores the current locally stored
  // value, while globalVarCache stores the current global value (usually in
  // the network).
  this.localVarCache = kwargs.localVarCache || new Cache.MemoryCache();
  this.globalVarCache = kwargs.globalVarCache || new Cache.MemoryCache();
}

/**
 * Gets the data value with the given hashcode.
 * @param {Buffer} hash Hash code of the computation.
 * @param {function} callback
 */
Server.prototype.getHashData = function(hash, callback) {
  // TODO: check the hash code to make sure it's correct
  this.hashDataCache.get(hash, callback);
};

/**
 * Gets the evaluation of the computation with the given hashcode.
 *
 * This uses caching to avoid evaluating the same static computation twice,
 * but only if the computation specifies that it should be cached and the value
 * is data.
 * @param {Buffer} hash Hash code of the computation
 * @param {function} callback
 */
Server.prototype.getHash = function(hash, callback) {
  var self = this;
  this.getHashData(hash, function(err, comp) {
    if (err) {
      callback(err);
    } else {
      self._rawEvalComputation(hash, comp, callback);
    }
  });
};


/*Evaluates a static computation.

Called when both the computation and its hashcode are known, and caches
have already been checked.

Arguments:
  comp: Static computation.
  hashcode: Hash code of comp.

Returns:
  Evaluation of the static computation.
  */
Server.prototype._rawEvalComputation = function(hash, comp, callback) {
  var self = this;
  Code.evalComputation(comp, {
      getHash: _.bind(self.getHash, self),
      evalComputation: _.bind(self.evalComputation, self),
      getHashData: _.bind(self.getHashData, self)
    }, function(err, result) {
      if (err) {
        callback(err);
      } else {
        if (comp.cache && Value.isData(result)) {
          self.hashEvalCache.put(hash, result, function(err) { 
            callback(err, result); 
          });
        } else {
          callback(null, result);
        }
      }
    }
  );
};

/*
Evaluates a static computation.

This uses caching to avoid evaluating the same static computation twice,
but only if the computation specifies that it should be cached and the value
is data.

Arguments:
  comp: The static computation.

Returns:
  Evaluation of the static computation.
*/
Server.prototype.evalComputation = function(comp, callback) {
  var self = this;
  var hash = Value.hashData(comp);
  self.hashEvalCache.get(hash, function(err, result) {
    if (err) {
      callback(err);
    } else {
      self._rawEvalStatic(hash, comp, callback);
    }
  });
};

/*
 * Inserts the given data value (often a static computation) into the cache.

Arguments:
  value: Value to store.
*/
Server.prototype.putHash = function(value, callback) {
  var self = this;
  if (Value.isData(value)) {
    self.hashDataCache.put(Value.hashData(value), comp, callback);
  } else {
    callback('not a value');
  }
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
      self.localVarCache.get(hash, function(err, localValue) {
        var localValue = err ? defaultValue : varSpec.merge(defaultValue, localValue);
        self.globalVarCache.get(hash, function(err, globalValue) {
          // TODO: try catch
          if (err) {
            callback(null, localValue);
          } else {
            var bestValue = varSpec.merge(localValue, globalValue)
            self.localVarCache.put(hash, bestValue, function(err) {
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
        self.globalVarCache.put(hash, bestValue, function(err) {
          callback(err);
        });
      });
    }
  });
};

module.exports = {
  Server: Server
};
