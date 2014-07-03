var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var _ = require('underscore');

var Value = require('./value');
var Utilities = require('./utilities');

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

// Only need this if not browserifying.
if (Utilities.inBrowser()) {
  var require2 = require;
  var Wait = require2('wait.for');
  var StreamCoder = require2('./streamcoder');
}

var API_VAR = '__hl_api';

function AsyncFunction(name, fun) {
  this.name = name;
  this.fun = fun;
  assert(typeof this.name == 'string');
  assert(typeof this.fun == 'function');
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
        var fun = withLength(getFunLength(subvalue), function() {
          var unAsyncArgs = _.map(arguments, function(arg) {
            return Value.map(arg, function(subarg, recurseArg) {
              if (subarg instanceof AsyncFunction) {
                return options.unAsyncFunction(subarg.name, withLength(getFunLength(subarg.fun), function() {
                  var args = [].slice.call(arguments, 0, arguments.length - 1);
                  var cb = arguments[arguments.length - 1];
                  subarg.fun.apply(null, _.map(args, translateValue).concat([cb])); 
                }));
              } else {
                return recurseArg();
              }
            });
          });
          return translateValue(subvalue.apply(null, unAsyncArgs));
        });
        fun.async = options.asyncVersion(fun);
        return fun;
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
  tApiToValue.async(api, callback);
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
    var fun = function() {
      var args = [].slice.call(arguments);
      return Wait.for(function(cb) {
        async.apply(null, args.concat([cb]));
      });
    };
    fun.length = getFunLength(async) - 1;
  }
  function asyncVersion(fun) {
    var async = function() {
      var args = [].slice.call(arguments, 0, arguments.length - 1);
      var cb = arguments[arguments.length - 1];
      Wait.launchFiber(function() {
        var result;
        try {
          result = fun.apply(null, args);
        } catch (ex) {
          cb(ex);
          return;
        }
        cb(null, result);
      });
    };
    async.length = fun.length + 1;
  }
  Wait.launchFiber(function() { 
    coder.getApiObject(function(err, runCode) {
      if(err) {
        callback(err);
      } else {
        evalComputationGeneral(comp, api, {runCode: runCode, unAsyncFunction: unAsyncFunction, asyncVersion: asyncVersion}, callback);
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
    sandbox.console = console;
    return Vm.runInNewContext('(' + code + ')', sandbox);
  }
  var asyncErrors = {};
  var asyncValues = {};
  function unAsyncFunction(name, asyncFun) {
    return withLength(getFunLength(asyncFun) - 1, function unAsync() {
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
          tryRun();
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
    });
  }
  var toRun = [];
  function runUntilItWorks(fun, cb) {
    fun(function(err, result) {
      if (err) {
        if (err instanceof AsyncWaitError) {
          toRun.push(function() { runUntilItWorks(fun, cb); });
        } else {
          cb(err);
        }
      } else {
        cb(null, result);
      }
    });
  }
  function asyncVersion(fun) {
    return withLength(getFunLength(fun) + 1, function async() {
      var args = [].slice.call(arguments, 0, arguments.length - 1);
      var cb = arguments[arguments.length - 1];
      runUntilItWorks(function(cb2) { 
        var result;
        try {
          result = fun.apply(null, args);
        } catch(ex) {
          cb2(ex);
          return;
        }
        cb2(null, result);
      }, cb);
    });
  }
  function tryRun() {
    var toRunCopy = toRun;
    toRun = [];
    _.each(toRunCopy, function(f) { f(); });
  }

  runUntilItWorks(function(cb) {
    evalComputationGeneral(comp, api, {runCode: runCode, unAsyncFunction: unAsyncFunction, asyncVersion: asyncVersion}, cb);
  }, callback);
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
