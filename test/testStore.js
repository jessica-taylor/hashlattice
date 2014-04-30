var assert = require('assert');

var Async = require('async');
var mkdirp = require('mkdirp');
var _ = require('underscore');

var Value = require('../lib/value');
var Store = require('../lib/store');

var testValues = {
  'af56': 5,
  '56f7': null,
  'abcd': [1, true, [], [5, {}]],
  '1234': {'a': 5, 'b': [false, {}]}
};

function assertValuesEqual(store, keys, values, callback) {
  Async.map(keys, function(key, cb) {
    store.get(new Buffer(key, 'hex'), function(err, value) {
      if (err == 'not found') {
        assert(!(key in values), 'key ' + key + ' not found, but should');
      } else {
        assert(!err);
        assert(Value.valuesEqual(value, values[key]));
      }
      cb();
    });
  }, function() { callback(); });
}

function testStore(store, initialValues) {
  var initialKeys = _.keys(initialValues);
  var testKeys = _.keys(testValues);
  var allKeys = _.union(initialKeys, testKeys);
  it('should initially contain only initial values', function(done) {
    assertValuesEqual(store, allKeys, initialValues, done);
  });
  it('should contain the union of values after putting', function(done) {
    Async.map(testKeys, function(key, cb) { 
      store.put(new Buffer(key, 'hex'), testValues[key], cb);
    }, function(err) {
      assert(!err);
      assertValuesEqual(store, allKeys, _.extend(_.clone(initialValues), testValues), done);
    });
  });
}

var testInitValues = {
  'af56': [1, 2, 3],
  '56f7': 67,
  'abcdef': null,
  '123455': {'a': 5, 'b': [false, {}]}
};

describe('MemoryStore', function() {
  describe('empty', function() {
    testStore(new Store.MemoryStore(), {});
  });
  describe('initialized', function() {
    var initValuesPairs = _.map(_.pairs(testInitValues), function(kv) {
      return [new Buffer(kv[0], 'hex'), kv[1]];
    });
    testStore(new Store.MemoryStore(initValuesPairs), testInitValues);
  });
});

var dir = '/tmp/hashlattice_test_' + Math.random();
mkdirp(dir, function(err) {
  assert(!err, err);
  describe('FileStore', function() {
    describe('empty', function() {
      testStore(new Store.FileStore(dir), {});
    });
    describe('initialized', function() {
      testStore(new Store.FileStore(dir), testValues);
    });
  });
});
