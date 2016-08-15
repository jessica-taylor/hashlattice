var assert = require('assert');

var _ = require('underscore');
var U = require('./testingUtil');

describe('RunGenerator', function() {
  describe('rg', function() {
    it('should return values correctly', function() {
      return U.rg(function*() {
        yield [1];
      }).then(function(x) {
        assert.equal(1, x);
      });
    });
    it('should continue from promises', function() {
      return U.rg(function*() {
        const x = yield Promise.resolve(1);
        yield [x + 1];
      }).then(function(x) {
        assert.equal(2, x);
      });
    });
    it('should catch errors', function() {
      return U.rg(function*() {
        const x = yield Promise.resolve(1);
        let ex;
        try {
          yield Promise.reject('error');
        } catch (e) {
          ex = e;
        }
        yield [ex];
      }).then(function(x) {
        assert.equal('error', x);
      });
    });
    it('should report errors', function() {
      return U.rg(function*() {
        const x = yield Promise.resolve(1);
        throw 'error';
      }).then(
        Promise.reject,
        val => val == 'error' ? Promise.resolve() : Promise.reject(val)
      );
    });
  });
});
