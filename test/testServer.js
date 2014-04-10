var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Value = require('../lib/value');
var Cache = require('../lib/cache');
var Server = require('../lib/server').Server;

var testDataValues = [
  10,
  null,
  true,
  false,
  'he',
  'hello',
  new Buffer('af4532', 'hex'),
  [],
  [1, 2],
  [1, 2, 3],
  [1, 2, 4],
  [true, 2, [false, 'hi', new Buffer('abc5f7', 'hex')]],
  {},
  {'a': 1, 'b': 2},
  {'a': 2, 'b': 2},
  {'a': true, 'b': 'hi', 'c': [true, 7, {'x': new Buffer('fede', 'hex')}]}
];

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
        assert(!val);
        assert.equal(val, value);
      });
    });
  });
});
