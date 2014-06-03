var _ = require('underscore');
var wait = require('wait.for');
var Async = require('async');

var Network = require('./network');
var Store = require('./store');
var Value = require('./value');
var Code = require('./code');
var CompLib = require('./complib');

function Server(kwargs) {
  kwargs = kwargs || {};
  // hashDataStore maps hash code to data value with that hash
  this.hashDataStore = kwargs.hashDataStore || new Store.CheckingHashStore(new Store.MemoryStore());
  // hashEvalStore maps hash code to evaluation of the computation with that
  // hash, if this evaluation is data
  this.hashEvalStore = kwargs.hashEvalStore || new Store.MemoryStore();
  // The var store maps hash code of variable computation to current data
  // value for the variable.
  this.varStore = kwargs.varStore || new Store.MergingVarStore(this.getVarEvaluator(), new Store.MemoryStore());
  this.evalComputationFunction = kwargs.evalComputationFunction || Code.evalComputation;
}

/**
 * Gets the data value with the given hashcode.
 * @param {Buffer} hash Hash code of the computation.
 * @param {function} callback
 */
Server.prototype.getHashData = function(hash, callback) {
  // TODO: check the hash code to make sure it's correct
  this.hashDataStore.getHashData(hash, callback);
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
  var api = {
    cl: CompLib,
    getHash: new Code.AsyncFunction('getHash', _.bind(self.getHash, self)),
    getHashData: new Code.AsyncFunction('getHashData', _.bind(self.getHashData, self)),
    evalComputation: new Code.AsyncFunction('evalComputation', _.bind(self.evalComputation, self))
  };
  self.evalComputationFunction(comp, api, function(err, result) {
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
    self.hashDataStore.putHashData(value, callback);
  } else {
    callback('not a value');
  }
};

var MAX_SIZE = Math.pow(2, 13);

Server.prototype.putHashDataSplit = function(comp, callback) {
  var self = this;
  var encoded = Value.encodeValue(comp);
  if (encoded.length <= MAX_SIZE) {
    self.putHashData(comp, function(err) {
      if (err) {
        callback(err);
      } else {
        callback(null, Value.hashData(comp));
      }
    });
  } else {
    var components = [];
    for (var i = 0; i < encoded.length; i += MAX_SIZE) {
      components.push(encoded.slice(i, Math.min(encoded.length, i + MAX_SIZE)));
    }
    Async.map(components, _.bind(self.putHashData, self), function(err) {
      if (err) {
        callback(err);
      } else {
        var combineComp = {
          data: {'components': _.map(components, Value.hashData)},
          code: 'evalComputation(cl.value.decodeValue(Buffer.concat(components.map(function(c) { return getHashData(c); }))))'
        };
        self.putHashDataSplit(combineComp, callback);
      }
    });
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
      });
    }
  }
  return {
    defaultValue: function(varSpec, callback) {
      getVarObj(varSpec, function(err, varObj) {
        if (err) {
          callback(err);
        } else {
          varObj.defaultValue.async(callback);
        }
      });
    },
    merge: function(varSpec, value1, value2, callback) {
      getVarObj(varSpec, function(err, varObj) {
        if (err) {
          callback(err);
        } else {
          varObj.merge.async(value1, value2, callback);
        }
      });
    }
  };
};

// Gets the value of a variable.
Server.prototype.getVar = function(varComp, callback) {
  this.varStore.getVar(varComp, callback);
};

// Puts a variable value.
Server.prototype.putVar = function(varComp, value, callback) {
  this.varStore.putVar(varComp, value, callback);
};

module.exports = {
  Server: Server
};
