var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Value = require('../lib/value');
var Cache = require('../lib/cache');

var testValues = {
  'af56': 5,
  '56f7': null,
  'abcd': [1, true, [], [5, {}]],
  '1234': {'a': 5, 'b': [false, {}]}
};

function assertValuesEqual(cache, keys, values, callback) {
  Async.map(keys, function(key, cb) {
    cache.get(new Buffer(key, 'hex'), function(err, value) {
      if (err == 'not found') {
        assert(!(key in values));
      } else {
        assert(!err);
        assert(Value.valuesEqual(value, values[key]));
      }
      cb();
    });
  }, function() { callback(); });
}

function testCache(cache, initialValues) {
  var initialKeys = _.keys(initialValues);
  var testKeys = _.keys(testValues);
  var allKeys = _.union(initialKeys, testKeys);
  it('should initially contain only initial values', function(done) {
    assertValuesEqual(cache, allKeys, initialValues, done);
  });
  it('should contain the union of values after putting', function(done) {
    Async.map(testKeys, function(key, cb) { 
      cache.put(new Buffer(key, 'hex'), testValues[key], cb);
    }, function(err) {
      assert(!err);
      assertValuesEqual(cache, allKeys, _.extend(_.clone(initialValues), testValues), done);
    });
  });
}

var testInitValues = {
  'af56': [1, 2, 3],
  '56f7': 67,
  'abcdef': null,
  '123455': {'a': 5, 'b': [false, {}]}
};

describe('MemoryCache', function() {
  describe('empty', function() {
    testCache(new Cache.MemoryCache(), {});
  });
  describe('initialized', function() {
    var initValuesPairs = _.map(_.pairs(testInitValues), function(kv) {
      return [new Buffer(kv[0], 'hex'), kv[1]];
    });
    testCache(new Cache.MemoryCache(initValuesPairs), testInitValues);
  });
});
