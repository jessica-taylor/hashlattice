var _ = require('underscore');

var Network = require('./network');
var Cache = require('./cache');
var Value = require('./value');
var Code = require('./code');

function Server(kwargs) {
  this.network = kwargs.network;
  // hashDataCache maps hash code to data value with that hash
  this.hashDataCache = kwargs.hashDataCache || new Cache.MemoryCache();
  // hashEvalCache maps hash code to evaluation of the computation with that
  // hash, if this evaluation is data
  this.hashEvalCache = kwargs.hashEvalCache || new Cache.MemoryCache();
  // varCache maps hash code of variable computation to current data value for
  // the variable
  this.varCache = kwargs.varCache || new Cache.MemoryCache();
}

/**
 * Gets the data value with the given hashcode.
 * @param {Buffer} hash Hash code of the computation.
 * @param {function} callback
 */
Server.prototype.getHashData = function(hash, callback) {
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
  this.getHashComputation(hash, function(comp) {
    if (comp === null) {
      callback(false);
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
    }, function(success, result) {
      if (success) {
        if (comp.cache && Value.isData(result)) {
          self.hashEvalCache.put(hash, result, function() { 
            callback(true, result); 
          });
        } else {
          callback(false);
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
  self.hashEvalCache.get(hash, function(found, result) {
    if (found) {
      callback(true, result);
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
    callback(false);
  }
};

Server.prototype.getVar = function(varComp, callback) {
  var self = this;
  self.evalComputation(varComp, function(success, varSpec) {
    if (success) {
      // TODO: try catch
      var defaultValue = varSpec.defaultValue();
      self.varCache.get(Value.hashData(varComp), function(found, value) {
        if (found) {
          // TODO: try catch
          callback(true, varSpec.merge(defaultValue, value));
        } else {
          callback(true, defaultValue);
        }
    } else {
      callback(false);
    }
  });
};

Server.prototype.putVar = function(varComp, value, callback) {
  // TODO check for data
  var self = this;
  self.evalComputation(varComp, function(success, varSpec) {
    if (success) {
      var hash = Value.hashData(varComp);
      self.varCache.get(hash, function(found, oldValue) {
        if (found) {
          // TODO: try catch
          self.varCache.put(hash, varSpec.merge(oldValue, value), callback);
        } else {
          callback(true);
        }
      });
    } else {
      callback(false);
    }
  });
};
