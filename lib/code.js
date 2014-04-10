var Vm = require('vm');
var assert = require('assert');

// TODO: for real security, run in a separate process?
// https://github.com/gf3/sandbox

function evalComputation(comp, api, callback) {
  assert(typeof comp == 'object');
  assert(typeof comp.code == 'string');
  var sandbox = {};
  if (typeof comp.data == 'object') {
    for (var key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  api = api || {};
  for (var key in api) {
    sandbox[key] = api[key];
  }
  // TODO: remove random?
  // TODO: allow buffers?
  var result;
  var error = null;
  try {
    result = Vm.runInNewContext('(' + comp.code + ')', sandbox);
  } catch(ex) {
    error = ex;
  }
  callback(error, result);
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
