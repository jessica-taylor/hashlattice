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

module.exports = {
  testDataValues: testDataValues
};
