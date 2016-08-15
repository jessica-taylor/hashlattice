var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Value = require('../lib/value');
var Store = require('../lib/store');
var Server = require('../lib/server').Server;
var U = require('./testingUtil');

describe('Server', function() {
  describe('getHashData', function() {
    const value = [1, 2, {}];
    const hash = Value.hashData(value);
    it('should check hashDataStore', U.rgf(function*() {
      const s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, value]]))
      });
      const val = yield s.getHashData(hash);
      assert(Value.valuesEqual(value, val));
    }));
    it('should report errors correctly', function() {
      var s = new Server({
        hashDataStore: {
          getHashData: function(k) {
            return Promise.reject('asdf');
          }
        }
      });
      s.getHashData(hash).then(
          v => Promise.reject(v),
          err => assert.equal('asdf', err));
    });
  });
  var comp = {data: {x: 5}, code: 'x+1'};
  var hash = Value.hashData(comp);
  var value = 6;
  var depComp = {data: {c: comp, h: hash}, 
                 code: '[getHashData(h, _), evalComputation(c, _), getHash(h, _)]'};
  var depHash = Value.hashData(depComp);
  var depValue = [comp, value, value];

  describe('getHash', function() {
    it('should check hashEvalStore', U.rgf(function*() {
      var s = new Server({
        hashEvalStore: new Store.MemoryStore([[hash, value]])
      });
      assert.equal(value, yield s.getHash(hash));
    }));
    it('should evaluate computations', U.rgf(function*() {
      var s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, comp]]))
      });
      assert.equal(value, yield s.getHash(hash));
    }));
    it('should evaluate dependent computations', U.rgf(function*() {
      var s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, comp], [depHash, depComp]]))
      });
      assert(Value.valuesEqual(depValue, yield s.getHash(depHash)));
    }));
    it('should report when things are not found', U.rgf(function*() {
      var s = new Server();
      try {
        yield s.getHash(hash);
        assert.fail();
      } catch (err) {
        assert.equal('not found', err);
      }
    }));
  });
  describe('evalComputation', function() {
    var comp = {data: {x: 5}, code: 'x+1'};
    var hash = Value.hashData(comp);
    var value = 6;
    it('should check hashEvalStore', U.rgf(function*() {
      var s = new Server({
        hashEvalStore: new Store.MemoryStore([[hash, value]])
      });
      assert.equal(value, yield s.evalComputation(comp));
    }));
    it('should evaluate computations', U.rgf(function*() {
      var s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, comp]]))
      });
      assert.equal(value, yield s.evalComputation(comp));
    }));
    it('should evaluate dependent computations', U.rgf(function*() {
      var s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, comp], [depHash, depComp]]))
      });
      assert(Value.valuesEqual(depValue, yield s.evalComputation(depComp)));
    }));
  });
  describe('putHashData', function() {
    it('should insert data so it can be gotten', U.rgf(function*() {
      var s = new Server();
      var comp = {data: {x: 5}, code: 'x+1'};
      var hash = Value.hashData(comp);
      var value = 6;
      yield s.putHashData(comp);
      assert.equal(value, yield s.getHash(hash));
    }));
  });
  describe('putVar', function() {
    it('should insert variables so they can be gotten', U.rgf(function*() {
      var s = new Server();
      var varComp = {
        data: {},
        code: '{defaultValue: function(_) { return [0,0]; }, ' +
              ' merge: function(x, y, _) { ' +
              '   return [Math.max(x[0], y[0]), Math.max(x[1], y[1])]; }}'
      };
      yield s.putVar(varComp, [6, 0]);
      yield s.putVar(varComp, [0, 5]);
      assert(Value.valuesEqual([6, 5], s.getVar(varComp)));
    }));
  });
});
