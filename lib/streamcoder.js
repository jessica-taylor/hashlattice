var assert = require('assert');
var Util = require('util');

var wait = require('wait.for');
var _ = require('underscore');

var Value = require('./value');
var FunctionServer = require('./functionserver');

function StreamCoder(kwargs) {
  var self = this;
  self.instream = kwargs.instream;
  assert(!!self.instream);
  self.outstream = kwargs.outstream;
  assert(!!self.outstream);
  self.apiObject = kwargs.apiObject || null;
  self.bytesToRead = null;
  self.functionServer = new FunctionServer();
  self.instreamListener = function() { self.doRead(); };
  self.instream.on('readable', self.instreamListener);
}

StreamCoder.prototype.writeAction = function(action) {
  var binAction = this.functionServer.encodeValue(action);
  var lengthBuf = new Buffer(4);
  lengthBuf.writeUInt32LE(binAction.length, 0);
  this.outstream.write(lengthBuf);
  this.outstream.write(binAction);
};

StreamCoder.prototype.getRemoteFunction = function(id) {
  var self = this;
  function fun() {
    var args = [].slice.call(arguments, 0);
    return wait.for(function(cb) { 
      fun.async(args, cb); 
    });
  };
  fun.async = function(args, cb) {
    var action = {
      'action': 'callFunction',
      'functionId': id,
      'args': args
    };
    if (cb) {
      action.callback = cb;
    }
    self.writeAction(action);
  };
  return fun;
};

StreamCoder.prototype.doRead = function() {
  var self = this;
  if (self.bytesToRead === null) {
    var bytesToReadBinary = self.instream.read(4);
    if (bytesToReadBinary) {
      self.bytesToRead = bytesToReadBinary.readUInt32LE(0);
    }
  }
  if (self.bytesToRead !== null) {
    var valueBinary = self.instream.read(self.bytesToRead);
    if (valueBinary) {
      self.bytesToRead = null;
      var value = Value.decodeValue(valueBinary, _.bind(self.getRemoteFunction, self));
      wait.launchFiber(function() {
        if (value.action == 'callFunction') {
          var result;
          var err;
          try {
            var result = self.functionServer.getFunction(value.functionId).apply(null, value.args);
          } catch(ex) {
            err = ex;
          }
          if (value.callback) {
            if (err) {
              value.callback.async([err]);
            } else {
              value.callback.async([null, result]);
            }
          }
        } else if (value.action == 'apiObject') {
          value.callback.async([null, self.apiObject]);
        } else if (value.action == 'close') {
          self.instream.removeListener(self.instreamListener);
        }
      });
    }
  }
};

StreamCoder.prototype.getApiObject = function(callback) {
  this.writeAction({
    action: 'apiObject',
    callback: callback
  });
};

StreamCoder.prototype.close = function() {
  self.writeAction({action: 'close'});
};

module.exports = StreamCoder;
