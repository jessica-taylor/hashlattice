/*
 * A module for encoding values (including functions) across a stream.
 * Functions get transformed into RPCs that can be called by the other party.
 */
var assert = require('assert');
var Util = require('util');

var wait = require('wait.for');
var U = require('underscore');

var Value = require('./value');
var FunctionServer = require('./functionserver');

// Provides and calls functions across a stream.  There should be one at each
// end of the stream.
// Arguments:
//   instream: a readable stream to read actions from.
//   outstream: a writable stream to write actions to.
//   apiObject (objection): object to provide to the opposite StreamCoder.
function StreamCoder(kwargs) {
  var self = this;
  self.instream = kwargs.instream;
  assert(self.instream);
  self.outstream = kwargs.outstream;
  assert(self.outstream);
  self.apiObject = kwargs.apiObject || null;
  self.bytesToRead = null;
  self.functionServer = new FunctionServer();
  self.instreamListener = function() { self.doRead(); };
  self.instream.on('readable', self.instreamListener);
}

// Writes an action to the stream, so that the other party takes it.
// This works by encoding the action's length, then the action as bytes.
// action: a value representing an action (callFunction, apiObject, or close)
StreamCoder.prototype.writeAction = function(action) {
  var binAction = this.functionServer.encodeValue(action);
  var lengthBuf = new Buffer(4);
  lengthBuf.writeUInt32LE(binAction.length, 0);
  this.outstream.write(lengthBuf);
  this.outstream.write(binAction);
};

// Gets a representation of a remote function identified with a certain id.
// The id corresponds to the other StreamCoder's function server.
// This kind of function is often called a stub.
StreamCoder.prototype.getRemoteFunction = function(id) {
  var self = this;
  function fun() {
    var args = [].slice.call(arguments, 0);
    // Convert asynchronous function to synchronous.
    return wait.for(function(cb) { 
      fun.async(args, cb); 
    });
  };
  fun.async = function(args, cb) {
    // Tell the other StreamCoder to call a function with this id with these
    // arguments.  If a callback is provided, the other StreamCoder should
    // call it with the result of calling the function.
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

// Stuff to do when more data is available to read.
StreamCoder.prototype.doRead = function() {
  var self = this;
  // Try to read the number of bytes, if unknown.
  if (self.bytesToRead === null) {
    var bytesToReadBinary = self.instream.read(4);
    if (bytesToReadBinary) {
      self.bytesToRead = bytesToReadBinary.readUInt32LE(0);
    }
  }
  if (self.bytesToRead !== null) {
    // Next, read a value representing an action.
    var valueBinary = self.instream.read(self.bytesToRead);
    if (valueBinary) {
      self.bytesToRead = null;
      var value = Value.decodeValue(valueBinary, U.bind(self.getRemoteFunction, self));
      // Use launchFiber since this possibly involves calling remote functions,
      // which use wait.for.
      wait.launchFiber(function() {
        if (value.action == 'callFunction') {
          // Call function with a specified ID with specified arguments.
          var result;
          var err;
          try {
            var result = self.functionServer.getFunction(value.functionId).apply(null, value.args);
          } catch(ex) {
            if (typeof ex == 'string') {
              err = ex;
            } else if (typeof ex == 'object' && ex.stack) {
              err = ex.stack;
            } else {
              err = Util.inspect(ex, {depth: null});
            }
          }
          // If callback is provided, call it with the result.
          if (value.callback) {
            // Avoid providing a callback.  This is to prevent infinite
            // recursion.
            if (err !== undefined) {
              value.callback.async([err]);
            } else {
              value.callback.async([null, result]);
            }
          }
        } else if (value.action == 'apiObject') {
          // Provide the API object.
          value.callback.async([null, self.apiObject]);
        } else if (value.action == 'close') {
          // This may allow the process to exit.
          self.instream.removeListener(self.instreamListener);
        }
      });
    }
  }
};

// Get the API object from the other side.
StreamCoder.prototype.getApiObject = function(callback) {
  this.writeAction({
    action: 'apiObject',
    callback: callback
  });
};

// Tell the other side to close.
StreamCoder.prototype.close = function() {
  this.writeAction({action: 'close'});
};

module.exports = StreamCoder;
