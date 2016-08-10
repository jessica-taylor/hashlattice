var U = require('underscore');
var Async = require('async');

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
Server.prototype.getHashData = function(hash, _) {
  return this.hashDataStore.getHashData(hash, _);
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
Server.prototype.getHash = function(hash, _) {
  try {
    return this.hashEvalStore.get(hash, _);
  } catch (err) {
    return this._rawEvalComputation(hash, this.getHashData(hash, _), _);
  }
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
Server.prototype._rawEvalComputation = function(hash, comp, _) {
  var api = {
    cl: CompLib,
    getHash: U.bind(this.getHash, this),
    getHashData: U.bind(this.getHashData, this),
    evalComputation: U.bind(this.evalComputation, this)
  };
  var result = this.evalComputationFunction(comp, api, _);
  if (comp.store && Value.isData(result)) {
    try {
      this.hashEvalStore.put(hash, result, _);
    } catch (err) { }
  }
  return result;
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
Server.prototype.evalComputation = function(comp, _) {
  var hash = Value.hashData(comp);
  try {
    return this.hashEvalStore.get(hash, _);
  } catch (err) {
    return this._rawEvalComputation(hash, comp, _);
  }
};

/*
 * Inserts the given data value (often a static computation) into the store.

Arguments:
  value: Value to store.
*/
Server.prototype.putHashData = function(value, _) {
  var self = this;
  if (Value.isData(value)) {
    self.hashDataStore.putHashData(value, _);
  } else {
    throw new Error('not a value');
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
    Async.map(components, U.bind(self.putHashData, self), function(err) {
      if (err) {
        callback(err);
      } else {
        var combineComp = {
          data: {'components': U.map(components, Value.hashData)},
          code: 'evalComputation(cl.value.decodeValue(Buffer.concat(components.map_(_, function(_, c) { return getHashData(c, _); }))), _)'
        };
        self.putHashDataSplit(combineComp, callback);
      }
    });
  }
};

Server.prototype.getVarEvaluator = function() {
  var self = this;
  var varSpecCache = {};
  function getVarObj(varSpec, _) {
    var hexVarSpec = Value.encodeValue(varSpec).toString('hex');
    if (hexVarSpec in varSpecCache) {
      return varSpecCache[hexVarSpec];
    } else {
      var varObj = self.evalComputation(varSpec, _);
      varSpecCache[hexVarSpec] = varObj;
      return varObj;
    }
  }
  return {
    defaultValue: function(varSpec, _) {
      return getVarObj(varSpec, _).defaultValue(_);
    },
    merge: function(varSpec, value1, value2, _) {
      return getVarObj(varSpec, _).merge(value1, value2, _);
    }
  };
};

// Gets the value of a variable.
Server.prototype.getVar = function(varComp, _) {
  return this.varStore.getVar(varComp, _);
};

// Puts a variable value.
Server.prototype.putVar = function(varComp, value, _) {
  return this.varStore.putVar(varComp, value, _);
};

module.exports = {
  Server: Server
};
