var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Value = require('../lib/value');
var Code = require('../lib/code');

var U = require('./testingUtil');

function testEvalComputation(evalComputation) {
  describe(evalComputation.name, function() {
    it('should evaluate simple expressions', function() {
      return evalComputation({code: '1+1'}, {}).then(result => assert.equal(2, result));
    });
    it('should allow access to data', function() {
      return evalComputation({data: {x: 1, y: 2}, code: 'x+y'}, {}).then(
          result => assert.equal(3, result));
    });
    it('should allow synchronous API access', function() {
      return evalComputation({data: {x: 1}, code: 'plus(x, 5)'},
                             {plus: function(x, y) { return x + y; }}).then(
                               result => assert.equal(6, result));
    });
    if (false) it('should allow asynchronous API access', function() {
      var api = {
        plus: function(x, y) {
          return new Promise(function(resolve, reject) {
            process.nextTick(() => resolve(x + y));
          });
        },
        minus: function(x, y) {
          return Promise.resolve(x-1);
        }
      };
      var code = 'function*() { yield [yield plus(yield minus(x, 2), 5)] }';

      return evalComputation({data: {x: 1}, code: code}, api).then(
          result => assert.equal(4, result));
    });
    it('should allow returning functions', function() {
      return evalComputation({data: {x: 1}, code: 'function(y) { return x + y; }'}, {}).then(
          result => assert.equal(5, result(4)));
    });
    it('should report syntax errors', function() {
      return evalComputation({code: '(]'}, {}).then(
            x => Promise.reject(x),
            err => assert(err));
    });
    it('should report runtime errors', function() {
      return evalComputation({code: '("hello")(4)'}, {}).then(
          x => Promise.reject(x),
          err => assert(err));
    });
  });
}
describe('code', function() {
  testEvalComputation(Code.evalComputation);
  describe('identityComputation', function() {
    it('should create computations returning the value', function() {
      return U.rg(function*() {
        for (const v of U.testDataValues) {
          const result = yield Code.evalComputation(Code.identityComputation(v), {});
          assert(Value.valuesEqual(v, result));
        }
      });
    });
  });
});
