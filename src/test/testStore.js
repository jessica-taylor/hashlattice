var assert = require('assert');

var Async = require('async');
var mkdirp = require('mkdirp');
var _ = require('underscore');
var U = require('./testingUtil');

var Value = require('../lib/value');
var Store = require('../lib/store');

var testValues = {
  'af56': 5,
  '56f7': null,
  'abcd': [1, true, [], [5, {}]],
  '1234': {'a': 5, 'b': [false, {}]}
};

async function assertValuesEqual(store, keys, values) {
  for (const key of keys) {
    try {
      const value = await store.get(new Buffer(key, 'hex'));
      assert(Value.valuesEqual(value, values[key]));
    } catch (err) {
      if (err == 'not found') {
        assert(!(key in values), 'key ' + key + ' not found, but should');
      } else {
        assert.fail(err);
      }
    }
  }
}


function testValueStore(store, initialValues) {
  var initialKeys = _.keys(initialValues);
  var testKeys = _.keys(testValues);
  var allKeys = _.union(initialKeys, testKeys);
  it('should initially contain only initial values', function() {
    return assertValuesEqual(store, allKeys, initialValues);
  });
  it('should contain the union of values after putting', async function() {
    for (const key of testKeys) {
      await store.put(new Buffer(key, 'hex'), testValues[key]);
    }
    await assertValuesEqual(store, allKeys, _.extend(_.clone(initialValues), testValues));
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

async function assertHashValuesEqual(store, allValues, initialValues) {
  var initHashes = _.map(allValues, function(v) { return Value.hashData.toString('hex'); });
  for (const v of allValues) {
    var vhash = Value.hashData(v);
    let value;
    let success = false;
    try {
      value = await store.getHashData(vhash);
      success = true;
    } catch (err) {
      if (err == 'not found') {
        assert(!_.contains(initHashes, vhash.toString('hex')));
      } else {
        assert.fail(err);
      }
    }
    if (success) assert(Value.valuesEqual(v, value));
  }
}

function testHashStore(store, initialValues) {
  var allValues = _.values(testValues).concat(initialValues);
  it('should initially contain only initial values', function() {
    return assertHashValuesEqual(store, allValues, initialValues);
  });
  it('should contain the union of values after putting', async function() {
    for (const v of _.values(testValues)) {
      await store.putHashData(v);
    }
    await assertHashValuesEqual(store, allValues, allValues);
  });
}


describe('CheckingHashStore', function() {
  var initialValues = [1, {a: 'b'}, true];
  testHashStore(
    new Store.CheckingHashStore(new Store.MemoryStore(
        _.map(initialValues, function(v) { return [Value.hashData(v), v]; }))),
    initialValues);
  it('should report invalid items in the store', function() {
    var badhash = new Buffer('cafe', 'hex');
    var store = new Store.CheckingHashStore(new Store.MemoryStore(
        [[badhash, 5]]));
    return store.getHashData(badhash).then(x => Promise.reject(x), x => Promise.resolve(x)); 
  });
});

describe('MergingVarStore', function() {
});
