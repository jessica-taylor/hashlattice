var assert = require('assert');
var Async = require('async');
var U = require('underscore');

var Value = require('../lib/value');
var Store = require('../lib/store');
var Server = require('../lib/server').Server;
var testDataValues = require('./testingUtil').testDataValues;

describe('Server', function() {
  describe('getHashData', function() {
    var value = [1, 2, {}];
    var hash = Value.hashData(value);
    it('should check hashDataStore', function(done) {
      var s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, value]]))
      });
      s.getHashData(hash, function(err, val) {
        assert(!err);
        assert(Value.valuesEqual(value, val));
        done();
      });
    });
    it('should report errors correctly', function(done) {
      var s = new Server({
        hashDataStore: {
          getHashData: function(k, cb) {
            cb('asdf');
          }
        }
      });
      s.getHashData(hash, function(err, val) {
        assert.equal('asdf', err);
        done();
      });
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
    it('should check hashEvalStore', function(done) {
      var s = new Server({
        hashEvalStore: new Store.MemoryStore([[hash, value]])
      });
      s.getHash(hash, function(err, val) {
        assert(!err, err);
        assert.equal(value, val);
        done();
      });
    });
    it('should evaluate computations', function(done) {
      var s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, comp]]))
      });
      s.getHash(hash, function(err, val) {
        assert(!err, err);
        assert(value, val);
        done();
      });
    });
    it('should evaluate dependent computations', function(done) {
      var s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, comp], [depHash, depComp]]))
      });
      s.getHash(depHash, function(err, val) {
        assert(!err, err);
        assert(Value.valuesEqual(depValue, val));
        done();
      });
    });
    it('should report when things are not found', function(done) {
      var s = new Server();
      s.getHash(hash, function(err, val) {
        assert.equal('not found', err);
        done();
      });
    });
  });
  describe('evalComputation', function() {
    var comp = {data: {x: 5}, code: 'x+1'};
    var hash = Value.hashData(comp);
    var value = 6;
    it('should check hashEvalStore', function(done) {
      var s = new Server({
        hashEvalStore: new Store.MemoryStore([[hash, value]])
      });
      s.evalComputation(comp, function(err, val) {
        assert(!err, err);
        assert.equal(value, val);
        done();
      });
    });
    it('should evaluate computations', function(done) {
      var s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, comp]]))
      });
      s.evalComputation(comp, function(err, val) {
        assert(!err, err);
        assert.equal(value, val);
        done();
      });
    });
    it('should evaluate dependent computations', function(done) {
      var s = new Server({
        hashDataStore: new Store.CheckingHashStore(new Store.MemoryStore([[hash, comp], [depHash, depComp]]))
      });
      s.evalComputation(depComp, function(err, val) {
        assert(!err, err);
        assert(Value.valuesEqual(depValue, val));
        done();
      });
    });
  });
  describe('putHashData', function() {
    it('should insert data so it can be gotten', function(done) {
      var s = new Server();
      var comp = {data: {x: 5}, code: 'x+1'};
      var hash = Value.hashData(comp);
      var value = 6;
      s.putHashData(comp, function(err) {
        assert(!err, err);
        s.getHash(hash, function(err, result) {
          assert(!err, err);
          assert.equal(value, result);
          done();
        })
      });
    });
  });
  describe('putVar', function() {
    it('should insert variables so they can be gotten', function(done) {
      var s = new Server();
      var varComp = {
        data: {},
        code: '{defaultValue: function(_) { return [0,0]; }, ' +
              ' merge: function(x, y, _) { ' +
              '   return [Math.max(x[0], y[0]), Math.max(x[1], y[1])]; }}'
      };
      s.putVar(varComp, [6, 0], function(err) {
        assert(!err, err);
        s.putVar(varComp, [0, 5], function(err) {
          assert(!err, err);
          s.getVar(varComp, function(err, value) {
            assert(!err, err);
            assert(Value.valuesEqual([6, 5], value));
            done();
          });
        });
      });
    });
  });
});
