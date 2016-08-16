var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var Babel = require('babel-core');
var Escodegen = require('escodegen');
var Esprima = require('esprima');
var Estraverse = require('estraverse');
var _ = require('underscore');

var Value = require('./value');
var U = require('./utilities');

const babelOptions = { 
  "presets": ["es2015"],
  "plugins": ["syntax-async-functions", "transform-async-to-generator"]
};

const MAIN_VALUE = "_hl_main_value";


function transformExpr(code) {
  const body = Babel.transform('const ' + MAIN_VALUE + ' = ' + code + ';', babelOptions).code;
  return '(function() { ' + body + ' return ' + MAIN_VALUE + '})()';
}

function evalComputation(comp, api) {
  assert.equal('object', typeof comp);
  assert.equal('string', typeof comp.code);
  const sandbox = {};
  sandbox.Buffer = Buffer;
  sandbox.underscore = U;
  // TODO: this is kind of dangerous
  sandbox.require = require;
  sandbox.regeneratorRuntime = regeneratorRuntime;

  if (typeof comp.data == 'object') {
    for (const key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  const apiKeys = _.keys(api);
  const apiValues = _.map(apiKeys, function(k) { return api[k]; });
  try {
    const code = transformExpr('(async function(' + apiKeys.join(', ') + ') { return ' + comp.code + '; })');
    const apiToValue = Vm.runInNewContext(code, sandbox);
    return apiToValue(...apiValues);
  } catch (ex) {
    return Promise.reject(ex);
  }
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
