var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Value = require('../lib/value');
var Cache = require('../lib/cache');
var Server = require('../lib/server').Server;
var testDataValues = require('./testingUtil').testDataValues;

describe('Server', function() {
  describe('getHashData', function() {
    var value = [1, 2, {}];
    var hash = Value.hashData(value);
    it('should check hashDataCache', function(done) {
      var s = new Server({
        hashDataCache: new Cache.MemoryCache([[hash, value]])
      });
      s.getHashData(hash, function(err, val) {
        assert(!err);
        assert(Value.valuesEqual(value, val));
        done();
      });
    });
    it('should report errors correctly', function(done) {
      var s = new Server({
        hashDataCache: {
          get: function(k, cb) {
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
  describe('getHash', function() {
    var comp = {data: {x: 5}, code: 'x+1'};
    var hash = Value.hashData(comp);
    var value = 6;
    it('should check hashEvalCache', function(done) {
      var s = new Server({
        hashEvalCache: new Cache.MemoryCache([[hash, value]])
      });
      s.getHash(hash, function(err, val) {
        assert(!err, err);
        assert.equal(value, val);
        done();
      });
    });
    it('should evaluate computations', function(done) {
      var s = new Server({
        hashDataCache: new Cache.MemoryCache([[hash, comp]])
      });
      s.getHash(hash, function(err, val) {
        assert(!err, err);
        assert.equal(value, val);
        done();
      });
    });
  });
});
