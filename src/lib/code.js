var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var Escodegen = require('escodegen');
var Esprima = require('esprima');
var Estraverse = require('estraverse');
var streamlineTransform = require('streamline').transform;
var U = require('underscore');

var Value = require('./value');
var Utilities = require('./utilities');


var streamlineOptions = {
  runtime: 'callbacks'
};

function streamlineExpr(code) {
  code = '_mainval = function(_) { return ' + code + '; };';
  console.log('code', code);
  var transStreamline = streamlineTransform(code, streamlineOptions).code;
  console.log(transStreamline);
  return '(function() { var __filename = "<computation>";' + transStreamline + ' return _mainval; })()';
}

function evalComputation(comp, api, callback) {
  assert.equal('object', typeof comp);
  assert.equal('string', typeof comp.code);
  var sandbox = {};
  sandbox.Buffer = Buffer;
  sandbox.underscore = U;
  // TODO: this is kind of dangerous
  sandbox.require = require;

  if (typeof comp.data == 'object') {
    for (var key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  var apiKeys = U.keys(api);
  var apiValues = U.map(apiKeys, function(k) { return api[k]; });
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
