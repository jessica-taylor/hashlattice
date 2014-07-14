var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var Escodegen = require('escodegen');
var Esprima = require('esprima');
var Estraverse = require('estraverse');
var streamlineTransform = require('streamline/lib/callbacks/transform').transform;
var _ = require('underscore');

var Value = require('./value');
var Utilities = require('./utilities');

function streamlineExpr(code) {
  code = 'this._mainval = function(_) { return ' + code + '; };';
  var transStreamline = streamlineTransform(code);
  return '(function() { var __filename = "<computation>";' + transStreamline + ' return this._mainval; })()';
}


function getFunLength(fn) {
  if ('_length' in fn) {
    return fn._length;
  } else {
    return fn.length;
  }
}

function setFunLength(fn, len) {
  fn._length = len;
}

function withLength(len, fn) {
  assert(typeof len == 'number');
  var fun = function() {
    assert.equal(len, arguments.length);
    return fn.apply(this, [].slice.call(arguments)); 
  };
  fun.name = fn.name;
  fun._length = len;
  return fun;
}

var API_VAR = '__hl_api';

function evalComputation(comp, api, callback) {
  assert(typeof comp == 'object');
  assert(typeof comp.code == 'string');
  var sandbox = {};
  sandbox.Buffer = Buffer;
  sandbox.underscore = _;
  // TODO: this is kind of dangerous
  sandbox.require = require;

  if (typeof comp.data == 'object') {
    for (var key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  var apiKeys = _.keys(api);
  var apiValues = _.map(apiKeys, function(k) { return api[k]; });
  var getApiToValue;
  try {
    var code = '(function(' + apiKeys.join(', ') + ') { return ' + streamlineExpr(comp.code) + '; })';
    apiToValue = Vm.runInNewContext(code, sandbox);
  } catch (ex) {
    callback(ex);
    return;
  }
  apiToValue.apply(null, apiValues)(callback);
}

/**
 * A simple computation returning the given data.
 */
function identityComputation(x) {
  return {
    data: {x: x},
    code: 'x'
  };
}

module.exports = {
  evalComputation: evalComputation,
  identityComputation: identityComputation
};
