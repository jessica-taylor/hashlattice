var assert = require('assert');
var Util = require('util');
var _ = require('underscore');

var Value = require('../lib/value');

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

describe('value', function() {
  describe('valuesEqual', function() {
    it('should return true for equal values, false for unequal', function() {
      for (var i = 0; i < testDataValues.length; i++) {
        for (var j = 0; j < testDataValues.length; j++) {
          assert.equal(i == j,
                       Value.valuesEqual(testDataValues[i], testDataValues[j]),
                       Util.inspect([testDataValues[i], testDataValues[j]]));
        }
      }
    });
  });
  describe('encodeValue', function() {
    it('should result in an equal value after decoding', function() {
      for (var i = 0; i < testDataValues.length; i++) {
        var orig = testDataValues[i];
        var enc = Value.encodeValue(orig);
        var dec = Value.decodeValue(enc);
        assert(Value.valuesEqual(orig, dec), Util.inspect([orig, dec]));
      }
    });
  });
  describe('hashData', function() {
    it('should result in different hash values', function() {
      var hashes = _.map(testDataValues, Value.hashData);
      for (var i = 0; i < hashes.length; i++) {
        for (var j = i; j < hashes.length; j++) {
          assert.equal(i == j, hashes[i].toString() == hashes[j].toString());
        }
      }
    });
  });
});

