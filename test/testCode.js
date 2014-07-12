var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Value = require('../lib/value');
var Code = require('../lib/code');

var testDataValues = require('./testingUtil').testDataValues;

function testEvalComputation(evalComputation) {
  describe(evalComputation.name, function() {
    it('should evaluate simple expressions', function(done) {
      evalComputation({code: '1+1'}, {}, function(err, result) {
        assert(!err, err);
        assert.equal(2, result);
        done();
      });
    });
    it('should allow access to data', function(done) {
      evalComputation({data: {x: 1, y: 2}, code: 'x+y'}, {}, function(err, result) {
        assert(!err, err);
        assert.equal(3, result);
        done();
      });
    });
    it('should allow synchronous API access', function(done) {
      evalComputation({data: {x: 1}, code: 'plus(x, 5)'},
                           {plus: function(x, y) { return x + y; }},
                           function(err, result) {
                             assert(!err, err);
                             assert.equal(6, result);
                             done();
                           });
    });
    it('should allow asynchronous API access', function(done) {
      var api = {
        plus: new Code.AsyncFunction(function(x, y, callback) {
          process.nextTick(function() {
            callback(null, x + y)
          });
        }),
        minus: new Code.AsyncFunction(function(x, y, callback) {
          callback(null, x - y);
        })
      };

      evalComputation({data: {x: 1}, code: 'plus(minus(x, 2), 5)'}, api,
                       function(err, result) {
                         assert(!err, err);
                         assert.equal(4, result);
                         done();
                       });
    });
    it('should allow returning functions', function(done) {
      evalComputation({data: {x: 1}, code: 'function(y) { return x + y; }'}, {}, function(err, result) {
        assert(!err, err);
        result.async(4, function(err, v) {
          assert(!err, err);
          assert.equal(5, v);
          done();
        });
      });
    });
    it('should report syntax errors', function(done) {
      evalComputation({code: '(]'}, {}, function(err, result) {
        assert(err);
        done();
      });
    });
    it('should report runtime errors', function(done) {
      evalComputation({code: '("hello")(4)'}, {}, function(err, result) {
        assert(err);
        done();
      });
    });
  });
}
describe('code', function() {
  testEvalComputation(Code.evalComputation);
  describe('identityComputation', function() {
    it('should create computations returning the value', function(done) {
      Async.map(testDataValues, function(v, callback) {
        Code.evalComputation(Code.identityComputation(v), {}, function(err, result) {
          assert(Value.valuesEqual(v, result));
          callback();
        });
      }, function(err) {
        done(err);
      });
    });
  });
});
