var Value = require('../lib/value');
var assert = require('assert');

var testDataValues = [
  10,
  null,
  true,
  false,
  'hello',
  new Buffer('af4532', 'hex'),
  [],
  [1, 2, 3],
  [true, 2, [false, 'hi', new Buffer('abc5f7', 'hex')]],
  {},
  {'a': 1, 'b': 2},
  {'a': true, 'b': 'hi', 'c': [true, 7, {'x': new Buffer('fede', 'hex')}]}
];

describe('value', function() {
  describe('valuesEqual', function() {
    for (var i = 0; i < testDataValues.length; i++) {
      for (var j = 0; j < testDataValues.length; i++) {
        assert.equal(i == j,
                     Value.valuesEqual(testDataValues[i], testDataValues[j]));
      }
    }
  });
});

