var assert = require('assert');

var wait = require('wait.for');
var underscore = require('_');

var Value = require('./value');
var FunctionServer = require('./functionserver');

function StreamCoder(kwargs) {
  var self = this;
  self.instream = kwargs.instream;
  assert(self.instream);
  self.outstream = kwargs.outstream;
  assert(self.outstream);
  self.apiObject = kwargs.apiObject || null;
  self.bytesToRead = null;
  self.functionServer = new FunctionServer();
  process.stdin.on('readable', function() { self.doRead(); });
}

StreamCoder.prototype.getRemoteFunction = function(id) {
  function fun() {
    return wait.for(fun.async, arguments.slice(0));
  };
  fun.async = function(args, cb) {
    var actionData = {
      'action': 'callFunction',
      'functionId': id,
      'args': args
    };
    if (cb) {
      actionData.callback = cb;
    }
    self.outstream.write(self.functionServer.encodeValue(actionData));
  };
  return fun;
};

StreamCoder.prototype.doRead = function() {
  var self = this;
  if (self.bytesToRead === null) {
    var bytesToReadBinary = process.stdin.read(4);
    if (bytesToReadBinary) {
      self.bytesToRead = bytesToReadBinary.readUInt32LE(0);
    }
  } else {
    var dataBinary = process.stdin.read(self.bytesToRead);
    if (dataBinary) {
      self.bytesRead = null;
      var data = Value.decodeValue(dataBinary, _.bind(self.getRemoteFunction, self));
      if (data.action === 'callFunction') {
        var result;
        var err;
        try {
          var result = self.functionServer.getFunction(data.functionId).apply(null, data.args);
        } catch(ex) {
          err = ex;
        }
        if (data.callback) {
          if (err) {
            data.callback.async([err]);
          } else {
            data.callback.async([null, result]);
          }
        }
      } else if (data.action == 'apiObject') {
        data.callback.async([null, self.apiObject]);
      }
    }
  }
};

StreamCoder.prototype.getApiObject = function(callback) {
  var actionData = {
    action: 'apiObject',
    callback: callback
  };
  this.outstream.write(this.functionServer.encodeValue(actionData));
};

module.exports = StreamCoder;
