var assert = require('assert');

var Value = require('../lib/value');
var Network = require('../lib/network');
var Cache = require('../lib/cache');

var isFirst = process.argv[2] == 'first';
if (!isFirst) {
  assert.equal('second', process.argv[2]);
}

var network = new Network.KadohNetwork([isFirst ? '10.0.0.2' : '10.0.0.1']);
var cache = new Cache.NetworkCache(network);

var testKey = new Buffer('1234', 'hex');
var testData = {a: 1, b: [4, 'hi', null, true, new Buffer('ffff', 'hex')]};

if (isFirst) {
  cache.put(testKey, testData, function(err) {
    assert(!err, err);
    console.log('done');
    setTimeout(function() {
      process.exit();
    }, 1000);
  });
} else {
  function tryGet(tries) {
    if (tries == 0) {
      assert(false, 'no tries left');
    } else {
      cache.get(testKey, function(err, value) {
        if (err == 'not found') {
          setTimeout(function() { tryGet(tries - 1); }, 100);
        } else {
          assert(!err, err);
          assert(Value.valuesEqual(testData, value));
          console.log('done');
        }
      });
    }
  }
}


