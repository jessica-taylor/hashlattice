var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var Escodegen = require('escodegen');
var Esprima = require('esprima');
var Estraverse = require('estraverse');
var _ = require('underscore');

var Value = require('./value');
var U = require('./utilities');


function transformExpr(code) {
  return code;
}

function evalComputation(comp, api) {
  assert.equal('object', typeof comp);
  assert.equal('string', typeof comp.code);
  const sandbox = {};
  sandbox.Buffer = Buffer;
  sandbox.underscore = U;
  // TODO: this is kind of dangerous
  sandbox.require = require;

  if (typeof comp.data == 'object') {
    for (const key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  const apiKeys = _.keys(api);
  const apiValues = _.map(apiKeys, function(k) { return api[k]; });
  let result;
  try {
    const code = '(function(' + apiKeys.join(', ') + ') { return ' + transformExpr(comp.code) + '; })';
    const apiToValue = Vm.runInNewContext(code, sandbox);
    // TODO asynchronous
    result = apiToValue(...apiValues)
  } catch (ex) {
    return Promise.reject(ex);
  }
  return Promise.resolve(result);
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
