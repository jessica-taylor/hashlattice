var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var StreamCoder = require('./streamcoder');


function evalComputationInProcess(comp, api, callback) {
  assert(typeof comp == 'object');
  assert(typeof comp.code == 'string');
  var sandbox = {};
  // TODO: this is probably bad, because the code can modify the global Buffer
  // object.  This will resolve itself when we run in a separate process.
  sandbox.Buffer = Buffer;
  api = api || {};
  for (var key in api) {
    sandbox[key] = api[key];
  }
  if (typeof comp.data == 'object') {
    for (var key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  // TODO: remove random?
  var result;
  var error = null;
  try {
    result = Vm.runInNewContext('(' + comp.code + ')', sandbox);
  } catch(ex) {
    error = ex;
  }
  callback(error, result);
}


// Evaluates computation in another process (sandbox.js).
function evalComputation(comp, api, callback) {
  assert(typeof comp == 'object');
  assert(typeof comp.code == 'string');
  var sandbox = {};
  api = api || {};
  for (var key in api) {
    sandbox[key] = api[key];
  }
  if (typeof comp.data == 'object') {
    for (var key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  var proc = ChildProcess.spawn('node', [Path.join(__dirname, 'sandbox')], {
    // pipe stdin/stdout, let stderr go to this process's stderr
    stdio: ['pipe', 'pipe', process.stderr]
  });
  var coder = new StreamCoder({
    instream: proc.stdout, 
    outstream: proc.stdin
  });
  coder.getApiObject(function(err, runCode) {
    if(err) {
      callback(err);
    } else {
      runCode.async([comp.code, sandbox], callback);
    }
  });
  // TODO: handle closing
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
  evalComputationInProcess: evalComputationInProcess,
  evalComputation: evalComputation,
  identityComputation: identityComputation
};
