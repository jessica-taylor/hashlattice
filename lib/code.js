var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var Wait = require('wait.for');
var _ = require('underscore');

var Value = require('./value');
var StreamCoder = require('./streamcoder');

var API_VAR = '__hl_api';

function AsyncFunction(name, fun) {
  this.name = name;
  this.fun = fun;
}

function evalComputationGeneral(comp, api, options, callback) {
  assert(typeof comp == 'object');
  assert(typeof comp.code == 'string');
  var sandbox = {};

  if (typeof comp.data == 'object') {
    for (var key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  function translateValue(v) {
    return Value.map(v, function(subvalue, recurse) {
      if (typeof subvalue == 'function') {
        return function() {
          var unAsyncArgs = _.map(arguments, function(arg) {
            return Value.map(arg, function(subarg, recurseArg) {
              if (subarg instanceof AsyncFunction) {
                return options.unAsyncFunction(subarg.name, function() {
                  var args = [].slice.call(arguments, 0, arguments.length - 1);
                  var cb = arguments[arguments.length - 1];
                  subarg.fun.apply(null, _.map(args, translateValue).concat([cb])); 
                });
              } else {
                return recurseArg();
              }
            });
          });
          return subvalue.apply(null, unAsyncArgs);
        };
      } else {
        return recurse();
      }
    });
  }
  var code = 'function(' + API_VAR + ') { with(' + API_VAR + ') { return ' + comp.code + ';}}';
  var apiToValue;
  try {
    var apiToValue = options.runCode(code, sandbox);
  } catch (ex) {
    callback(ex);
    return;
  }
  var tApiToValue = translateValue(apiToValue);
  var result;
  try {
    result = tApiToValue(api);
  } catch (ex) {
    callback(ex);
    return;
  }
  callback(null, result);
}

// Evaluates computation in another process (sandbox.js).
function evalComputation(comp, api, callback) {
  var proc = ChildProcess.spawn('node', [Path.join(__dirname, 'sandbox')], {
    // pipe stdin/stdout, let stderr go to this process's stderr
    stdio: ['pipe', 'pipe', process.stderr]
  });
  var coder = new StreamCoder({
    instream: proc.stdout, 
    outstream: proc.stdin
  });
  function unAsyncFunction(name, async) {
    return function() {
      var args = [].slice.call(arguments);
      return Wait.for(function(cb) {
        async.apply(null, args.concat([cb]));
      });
    };
  }
  Wait.launchFiber(function() { 
    coder.getApiObject(function(err, runCode) {
      if(err) {
        callback(err);
      } else {
        evalComputationGeneral(comp, api, {runCode: runCode, unAsyncFunction: unAsyncFunction}, callback);
      }
    });
  });
  // TODO: handle closing
}

function AsyncWaitError() {
}

function evalComputationWithoutWait(comp, api, callback) {
  function runCode(code, sandbox) {
    sandbox.Buffer = Buffer;
    sandbox._ = _;
    return Vm.runInNewContext('(' + code + ')', sandbox);
  }
  var asyncErrors = {};
  var asyncValues = {};
  var currentlyRunning = false;
  var currentId = 0;
  var depth = 0;
  function unAsyncFunction(name, asyncFun) {
    return function() {
      var args = [].slice.call(arguments);
      var key = {fun: name, args: args};
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
            if (depth++ < 10) {
              tryRun();
            }
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
  function tryRun() {
    assert(!currentlyRunning);
    currentlyRunning = true;
    evalComputationGeneral(comp, api, {runCode: runCode, unAsyncFunction: unAsyncFunction}, function(err, result) {
      currentlyRunning = false;
      if (err) {
        if (!(err instanceof AsyncWaitError)) {
          callback(err);
        }
      } else {
        callback(null, result);
      }
    });
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
  AsyncFunction: AsyncFunction,
  evalComputation: evalComputation,
  evalComputationWithoutWait: evalComputationWithoutWait,
  identityComputation: identityComputation
};
