
var network = require('./network');
var cache = require('./cache');
var data = require('./data');
var code = require('./code');

function Server(kwargs) {
  this.network = kwargs.network;
  // hashCompCache maps hash code to computation with that hash
  this.hashCompCache = kwargs.hashCompCache || new cache.MemoryCache();
  // hashEvalCache maps hash code to evaluation of the computation with that
  // hash, if this evaluation is data
  this.hashEvalCache = kwargs.hashEvalCache || new cache.MemoryCache();
  // varCache maps hash code of variable computation to current data value for
  // the variable
  this.varCache = kwargs.varCache || new cache.MemoryCache();
}

/**
 * Gets the computation with the given hashcode.
 * @param {Buffer} hashcode Hash code of the static computation.
 * @param {function} callback
 */
Server.prototype.getHashComputation = function(hash, callback) {
  this.hashCompCache.get(hash, callback);
};

/*
Gets the evaluation of the static computation with the given hashcode.

This uses caching to avoid evaluating the same static computation twice,
but only if the computation specifies that it should be cached and the value
is data.

Arguments:
  hashcode: Hash code of the static computation.

Returns:
  Evaluation of the static computation.
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
  code.evalComputation(comp, {
      getHash: self.getHash,
      evalComputation: self.evalComputation,
      getHashComputation: self.getHashComputation
    }, function(success, result) {
      if (success) {
        if (comp.cache) {
          // TODO only cache data
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
  var hash = data.hashData(comp);
  self.hashEvalCache.get(hash, function(found, result) {
    if (found) {
      callback(true, result);
    } else {
      self.rawEvalStatic(hash, comp, callback);
    }
  });
};

/*
 * Inserts the given static computation into the cache.

Arguments:
  comp: The static computation.
*/
Server.prototype.putHash = function(comp, callback) {
  var self = this;
  // TODO: check if data
  self.hashCompCache.put(data.hashData(comp), comp, callback);
};

Server.prototype.getVar = function(varComp, callback) {
  var self = this;
  self.evalComputation(varComp, function(success, varSpec) {
    if (success) {
      // TODO: try catch
      var defaultValue = varSpec.defaultValue();
      self.varCache.get(data.hashData(varComp), function(found, value) {
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
      var hash = data.hashData(varComp);
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
