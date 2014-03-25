var vm = require('vm');
var assert = require('better-assert');

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
  var success = false;
  try {
    result = vm.runCodeInNewContext(comp.code, sandbox);
    success = true;
  } catch(ex) {
    // TODO: better error reporting
    console.log(ex);
    callback(false);
  }
  if (success) {
    callback(true, result);
  }
}

module.exports = {
  evalComputation: evalComputation
};
