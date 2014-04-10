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
    it('should check hashDataCache', function(done) {
      var value = [1, 2, {}];
      var key = Value.hashData(value);
      var s = new Server({
        hashDataCache: {
          get: function(k, cb) {
            assert.equal(k, key);
            cb(null, value);
          }
        },
        hashEvalCache: {}
      });
      s.getHashData(key, function(err, val) {
        assert(!err);
        assert(Value.valuesEqual(value, val));
        done();
      });
    });
  });
});
