var _ = require('underscore');
var Async = require('async');

var Store = require('./store');
var Value = require('./value');
var Code = require('./code');
var CompLib = require('./complib');
var U = require('./utilities');


const MAX_SIZE = Math.pow(2, 13);

class Server {
  constructor(kwargs) {
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
   */
  getHashData(hash: Buffer) {
    return this.hashDataStore.getHashData(hash);
  };

  /**
   * Gets the evaluation of the computation with the given hashcode.
   *
   * This uses caching to avoid evaluating the same static computation twice,
   * but only if the computation specifies that it should be stored and the value
   * is data.
   */
  getHash(hash: Buffer) {
    const self = this;
    return U.rg(function*() {
      try {
        yield [yield self.hashEvalStore.get(hash)];
      } catch (err) {
        yield [yield self._rawEvalComputation(hash, yield self.getHashData(hash))];
      }
    });
  }

  /*Evaluates a static computation.

  Called when both the computation and its hashcode are known, and stores
  have already been checked.

  Arguments:
    comp: Static computation.
    hashcode: Hash code of comp.

  Returns:
    Evaluation of the static computation.
    */
  _rawEvalComputation(hash: Buffer, comp) {
    var api = {
      cl: CompLib,
      getHash: _.bind(this.getHash, this),
      getHashData: _.bind(this.getHashData, this),
      evalComputation: _.bind(this.evalComputation, this)
    };
    const self = this;
    return U.rg(function*() {
      var result = yield self.evalComputationFunction(comp, api);
      if (comp.store && Value.isData(result)) {
        try {
          yield self.hashEvalStore.put(hash, result);
        } catch (err) { }
      }
      yield [result];
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
  evalComputation(comp) {
    var hash = Value.hashData(comp);
    return this.hashEvalStore.get(hash).catch(
        err => this._rawEvalComputation(hash, comp));
  };


  /*
   * Inserts the given data value (often a static computation) into the store.

  Arguments:
    value: Value to store.
  */
  putHashData(value) {
    var self = this;
    if (Value.isData(value)) {
      return self.hashDataStore.putHashData(value);
    } else {
      throw new Error('not a value');
    }
  };

  putHashDataSplit(comp) {
    var self = this;
    var encoded = Value.encodeValue(comp);
    return U.rg(function*() {
      if (encoded.length <= MAX_SIZE) {
        yield [Value.hashData(yield self.putHashData(comp))];
      } else {
        var components = [];
        for (var i = 0; i < encoded.length; i += MAX_SIZE) {
          const component = encoded.slice(i, Math.min(encoded.length, i + MAX_SIZE));
          components.push(component);
          yield self.putHashData(component);
        }
        var combineComp = {
          data: {'components': _.map(components, Value.hashData)},
          code: 'evalComputation(cl.value.decodeValue(Buffer.concat(components.map_(_, function(_, c) { return getHashData(c, _); }))), _)'
        };
        yield self.putHashDataSplit(combineComp);
      }
    });
  };

  getVarEvaluator() {
    var self = this;
    var varSpecCache = {};
    const getVarObj = U.rgf(function*(varSpec) {
      var hexVarSpec = Value.encodeValue(varSpec).toString('hex');
      if (hexVarSpec in varSpecCache) {
        yield [varSpecCache[hexVarSpec]];
      } else {
        var varObj = yield self.evalComputation(varSpec);
        varSpecCache[hexVarSpec] = varObj;
        yield [varObj];
      }
    });
    return {
      defaultValue: U.rgf(function*(varSpec) {
         yield [yield (yield getVarObj(varSpec)).defaultValue()];
      }),
      merge: U.rgf(function*(varSpec) {
        yield [yield (yield getVarObj(varSpec)).merge(value1, value2)];
      })
    };
  };

  // Gets the value of a variable.
  getVar(varComp) {
    return this.varStore.getVar(varComp);
  };

  // Puts a variable value.
  putVar(varComp, value) {
    return this.varStore.putVar(varComp, value);
  };

}




module.exports = {
  Server: Server
};
