var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var Escodegen = require('escodegen');
var Esprima = require('esprima');
var Estraverse = require('estraverse');
var U = require('underscore');

var Value = require('./value');
var Utilities = require('./utilities');


function transformExpr(code) {
  return code;
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
    var code = '(function(' + apiKeys.join(', ') + ') { return ' + transformExpr(comp.code) + '; })';
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
