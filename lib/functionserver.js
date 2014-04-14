var Value = require('./value');

var _ = require('underscore');

function FunctionServer() {
  this.functions = [];
}

FunctionServer.prototype.addFunction = function(fn) {
  this.functions.push(fn);
  return this.functions.length - 1;
};

FunctionServer.prototype.getFunction = function(i) {
  if (i < this.functions.length) {
      return this.functions[i];
  } else {
      return null;
  }
};

FunctionServer.prototype.encodeValue = function(value) {
  var self = this;
  return Value.encodeValue(value, _.bind(this.addFunction, this));
};

FunctionServer.prototype.decodeValue = function(value) {
  return Value.decodeValue(value, _.bind(this.getFunction, this));
};

module.exports = FunctionServer;
