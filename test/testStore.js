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
        assert(!err, err);
        assert(Value.valuesEqual(value, values[key]));
      }
      cb();
    });
  }, function() { callback(); });
}

function testValueStore(store, initialValues) {
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

function mapToMemoryStore(values) {
  var initValuesPairs = _.map(_.pairs(values), function(kv) {
    return [new Buffer(kv[0], 'hex'), kv[1]];
  });
  return new Store.MemoryStore(initValuesPairs);
}

describe('MemoryStore', function() {
  describe('empty', function() {
    testValueStore(new Store.MemoryStore(), {});
  });
  describe('initialized', function() {
    testValueStore(mapToMemoryStore(testInitValues), testInitValues);
  });
});

var dir = '/tmp/hashlattice_test_' + Math.random();
mkdirp(dir, function(err) {
  assert(!err, err);
  describe('FileStore', function() {
    describe('empty', function() {
      testValueStore(new Store.FileStore(dir), {});
    });
    describe('initialized', function() {
      testValueStore(new Store.FileStore(dir), testValues);
    });
  });
});

describe('LayeredValueStore', function() {
  var store1values = testInitValues;
  var store2values = {
    'ba56': true,
    'abcdef': 'not null'
  };
  var store1 = mapToMemoryStore(store1values);
  var store2 = mapToMemoryStore(store2values);
  var layered = new Store.LayeredValueStore(store1, store2);
  testValueStore(layered, _.extend(_.clone(store2values), store1values));
});

function assertHashValuesEqual(store, allValues, initialValues, callback) {
  var initHashes = _.map(allValues, function(v) { return Value.hashData.toString('hex'); });
  Async.map(allValues, function(v, cb) {
    var vhash = Value.hashData(v);
    store.getHashData(vhash, function(err, value) {
      if (err == 'not found') {
        assert(!_.contains(initHashes, vhash.toString('hex')));
      } else {
        assert(!err, err);
        assert(Value.valuesEqual(v, value));
      }
      cb();
    });
  }, function() { callback(); });
}

function testHashStore(store, initialValues) {
  var allValues = _.values(testValues).concat(initialValues);
  it('should initially contain only initial values', function(done) {
    assertHashValuesEqual(store, allValues, initialValues, done);
  });
  it('should contain the union of values after putting', function(done) {
    Async.map(testValues, function(v, cb) {
      store.putHashData(v, cb);
    }, function(err) {
      assert(!err);
      assertHashValuesEqual(store, allValues, allValues, done);
    });
  });
}


describe('CheckingHashStore', function() {
  var initialValues = [1, {a: 'b'}, true];
  testHashStore(
    new Store.CheckingHashStore(new Store.MemoryStore(
        _.map(initialValues, function(v) { return [Value.hashData(v), v]; }))),
    initialValues);
});

