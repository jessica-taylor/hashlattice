var globalUtil = require('../globalUtil');

// some data values to test things on
var testDataValues = [
  10,
  11,
  null,
  true,
  false,
  'he',
  'hello',
  'lalal',
  new Buffer('af4532', 'hex'),
  new Buffer('af4533', 'hex'),
  [],
  [1, 2],
  [1, 2, 3],
  [1, 2, null],
  [true, 2, [false, 'hi', new Buffer('abc5f7', 'hex')]],
  {},
  {'a': 1, 'b': 2},
  {'a': 2, 'b': 2},
  {'a': true, 'b': 'hi', 'c': [true, 7, {'x': new Buffer('fede', 'hex')}]}
];

module.exports = {
  testDataValues: testDataValues
};

for (const k in globalUtil) {
  module.exports[k] = globalUtil[k];
}
