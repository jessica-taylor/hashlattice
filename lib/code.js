var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var Wait = require('wait.for');
var _ = require('underscore');

var Value = require('./value');
var StreamCoder = require('./streamcoder');

// Evaluates computation in another process (sandbox.js).
function evalComputation(comp, syncApi, asyncApi, callback) {
  assert(typeof comp == 'object');
  assert(typeof comp.code == 'string');
  var sandbox = {};
  for (var key in syncApi) {
    sandbox[key] = syncApi[key];
  }
  function getAsyncApi(asyncFun) {
    return function() {
      var args = [].slice.call(arguments);
      var result = Wait.for(function(cb) {
        asyncFun.apply(null, args.concat([cb]));
      });
      return result;
    }
  }
  for (var key in asyncApi) {
    sandbox[key] = getAsyncApi(asyncApi[key]);
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

function AsyncWaitError() {
}

function evalComputationWithoutWait(comp, syncApi, asyncApi, callback) {
  assert(typeof comp == 'object');
  assert(typeof comp.code == 'string');
  var sandbox = {};
  if (typeof comp.data == 'object') {
    for (var key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  for (var key in syncApi) {
    sandbox[key] = syncApi[key];
  }
  sandbox.Buffer = Buffer;
  sandbox._ = _;
  var asyncErrors = {};
  var asyncValues = {};
  var currentlyRunning = false;
  function getAsyncApi(asyncFunName, asyncFun) {
    return function() {
      var args = [].slice.call(arguments);
      var key = {fun: asyncFunName, args: args};
      var keyHex = Value.encodeValue(key).toString('hex');
      if (keyHex in asyncErrors) {
        throw asyncErrors[keyHex];
      } else if (keyHex in asyncValues) {
        return asyncValues[keyHex];
      } else {
        asyncFun.apply(null, args.concat([function(err, res) {
          if (err) {
            asyncErrors[keyHex] = err;
          } else {
            asyncValues[keyHex] = res;
          }
          if (!currentlyRunning) {
            tryRun();
          }
        }]));
        // check again, in case callback was just called
        if (keyHex in asyncErrors) {
          throw asyncErrors[keyHex];
        } else if (keyHex in asyncValues) {
          return asyncValues[keyHex];
        } else {
          throw new AsyncWaitError();
        }
      }
    };
  }
  for (var fun in asyncApi) {
    sandbox[fun] = getAsyncApi(fun, asyncApi[fun]);
  }
  function tryRun() {
    assert(!currentlyRunning);
    currentlyRunning = true;
    try {
      var result = Vm.runInNewContext('(' + comp.code + ')', sandbox);
      currentlyRunning = false;
      callback(null, result);
    } catch(ex) {
      currentlyRunning = false;
      if (!(ex instanceof AsyncWaitError)) {
        callback(ex);
      }
    }
  }
  tryRun();
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
  evalComputationWithoutWait: evalComputationWithoutWait,
  identityComputation: identityComputation
};
