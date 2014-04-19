var assert = require('assert');

var FunctionServer = require('../lib/functionserver');
var Value = require('../lib/value');




describe('FunctionServer', function() {
  it('should allow adding and getting functions', function() {
    function f1(x) { return x + 1; };
    function f2(x) { return x + 2; };
    var fs = new FunctionServer();
    var i1 = fs.addFunction(f1);
    var i2 = fs.addFunction(f2);
    assert.equal(fs.getFunction(i1)(5), 6);
    assert.equal(fs.getFunction(i2)(5), 7);
  });
  it('should return null for invalid indexes', function() {
    function f1(x) { return x + 1; };
    function f2(x) { return x + 2; };
    var fs = new FunctionServer();
    var i1 = fs.addFunction(f1);
    var i2 = fs.addFunction(f2);
    assert.equal(null, fs.getFunction(Math.min(i1, i2) - 1));
    assert.equal(null, fs.getFunction(Math.max(i1, i2) + 1));
  });
  it('should allow encoding and decoding', function() {
    var value = {
      a: [1, 2, true, false, new Buffer('5555', 'hex')],
      b: function(x) { return x + 1; },
      c: function(x) { return x + 2; }
    };
    var fs = new FunctionServer();
    var enc = fs.encodeValue(value);
    var dec = fs.decodeValue(enc);
    assert(Value.valuesEqual(value.a, dec.a));
    assert.equal(6, dec.b(5));
    assert.equal(7, dec.c(5));
  });
});
