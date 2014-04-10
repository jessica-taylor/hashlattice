var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Value = require('../lib/value');
var Code = require('../lib/code');

var testDataValues = require('./testingUtil').testDataValues;

describe('code', function() {
  describe('evalComputation', function() {
    it('should evaluate simple expressions', function(done) {
      Code.evalComputation({code: '1+1'}, {}, function(err, result) {
        assert(!err, err);
        assert.equal(2, result);
        done();
      });
    });
    it('should allow access to data', function(done) {
      Code.evalComputation({data: {x: 1, y: 2}, code: 'x+y'}, {}, function(err, result) {
        assert(!err, err);
        assert.equal(3, result);
        done();
      });
    });
    it('should allow API access', function(done) {
      Code.evalComputation({data: {x: 1}, code: 'plus(x, 5)'},
                           {plus: function(x, y) { return x + y; }},
                           function(err, result) {
                             assert(!err, err);
                             assert.equal(6, result);
                             done();
                           });
    });
    it('should allow returning functions', function(done) {
      Code.evalComputation({data: {x: 1}, code: 'function(y) { return x + y; }'}, {}, function(err, result) {
        assert(!err, err);
        assert.equal(5, result(4));
        assert.equal(9, result(8));
        done();
      });
    });
  });
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
