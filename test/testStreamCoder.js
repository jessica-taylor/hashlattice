var assert = require('assert');
var Stream = require('stream');

var wait = require('wait.for');

var Value = require('../lib/value');
var StreamCoder = require('../lib/streamcoder');

function pipeStream() {
  var stream = new Stream.Transform();
  stream._transform = function(chunk, encoding, callback) {
    stream.push(chunk);
    process.nextTick(callback);
  };
  return stream;
}

function getCoders(apiA, apiB) {
  var atob = pipeStream();
  var btoa = pipeStream();
  var a = new StreamCoder({instream: btoa, outstream: atob, apiObject: apiA});
  var b = new StreamCoder({instream: atob, outstream: btoa, apiObject: apiB});
  return [a, b];
}

describe('StreamCoder', function() {
  it('should allow calling functions over a stream', function(done) {
    var streams = getCoders(function(x) { return x + 5; }, null);
    streams[1].getApiObject(function(err, api) {
      assert(!err, err);
      wait.launchFiber(function() { 
        assert.equal(7, api(2));
        done();
      });
    });
  });
  it('should allow functions to call each other recursively', function(done) {
    var streams = getCoders(function(f) { return f(5); }, null);
    streams[1].getApiObject(function(err, api) {
      assert(!err, err);
      wait.launchFiber(function() { 
        assert.equal(7, api(function(x) { return x + 2; }));
        done();
      });
    });
  });
  it('should allow asynchronous calls', function(done) {
    var streams = getCoders(function(f) { return f(5); }, null);
    streams[1].getApiObject(function(err, api) {
      assert(!err, err);
      api.async([function(x) { return x + 2; }], function(err, result) {
        assert(!err, err);
        assert.equal(7, result);
        done();
      });
    });
  });
  it('should report errors (sync)', function(done) {
    var streams = getCoders(function(f) { return f(5); }, null);
    streams[1].getApiObject(function(err, api) {
      assert(!err, err);
      wait.launchFiber(function() { 
        try {
          var res = api(function(x) { throw 'aaa'; });
          assert(false);
        } catch(ex) {
          assert.equal('aaa', ex);
          done();
        }
      });
    });
  });
  it('should report errors (async)', function(done) {
    var streams = getCoders(function(f) { return f(5); }, null);
    streams[1].getApiObject(function(err, api) {
      assert(!err, err);
      api.async([function(x) { throw 'aaa'; }], function(err, result) {
        assert.equal('aaa', err);
        done();
      });
    });
  });
});

