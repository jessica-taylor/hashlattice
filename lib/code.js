var Path = require('path');
var ChildProcess = require('child_process');
var Vm = require('vm');
var assert = require('assert');

var Escodegen = require('escodegen');
var Esprima = require('esprima');
var Estraverse = require('estraverse');
var streamlineTransform = require('streamline/lib/callbacks/transform').transform;
var _ = require('underscore');

var Value = require('./value');
var Utilities = require('./utilities');

var STREAMLINE_CONT = '_streamline_cont_';

function addStreamlineCont(ast) {
  return Estraverse.replace(ast, {
    enter: function(node) {
      if (node.type == 'FunctionDeclaration' ||
          node.type == 'FunctionExpression') {
        return {
          type: node.type,
          id: node.id,
          params: [{type: 'Identifier', name: STREAMLINE_CONT}].concat(node.params),
          defaults: node.defaults,
          body: node.body,
          rest: node.rest,
          generator: node.generator,
          expression: node.expression
        };
      } else if (node.type == 'CallExpression') {
        return {
          type: node.type,
          callee: node.callee,
          arguments: [{type: 'Identifier', name: STREAMLINE_CONT}].concat(node.arguments)
        };
      }
    }
  });
}

function fullCPS(code) {
  code = 'this._mainval = function() { return ' + code + '; };';
  var ast = Esprima.parse(code);
  var withStreamline = Escodegen.generate(addStreamlineCont(ast));
  withStreamline = '// streamline.options = ' + JSON.stringify({callback: STREAMLINE_CONT}) + '\n' + withStreamline;
  var transStreamline = streamlineTransform(withStreamline);
  return '(function() { var __filename = "<computation>";' + transStreamline + ' return this._mainval; })()';
}


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

var API_VAR = '__hl_api';

function AsyncFunction(async) {
  this.async = async;
  assert(typeof this.async == 'function');
}

function evalComputation(comp, api, callback) {
  assert(typeof comp == 'object');
  assert(typeof comp.code == 'string');
  var sandbox = {};
  sandbox.Buffer = Buffer;
  sandbox._ = _;
  // TODO: this is kind of dangerous
  sandbox.require = require;

  if (typeof comp.data == 'object') {
    for (var key in comp.data) {
      sandbox[key] = comp.data[key];
    }
  }
  function fromSandboxValue(v) {
    return Value.map(v, function(subvalue, recurse) {
      if (typeof subvalue == 'function') {
        return new AsyncFunction(
          withLength(getFunLength(subvalue), function() {
            var args = [].slice.call(arguments, 0, arguments.length - 1);
            var cb = arguments[arguments.length - 1];
            subvalue.apply(null, [function(err, value) {
              if (err) {
                cb(err);
              } else {
                cb(null, fromSandboxValue(value));
              }
            }].concat(_.map(args, toSandboxValue)));
          })
        );
        return fun;
      } else {
        return recurse();
      }
    });
  }
  function toSandboxValue(v) {
    return Value.map(v, function(subvalue, recurseArg) {
      if (subvalue instanceof AsyncFunction) {
        return withLength(getFunLength(subvalue.async), function(cb) {
          var args = [].slice.call(arguments, 1, arguments.length);
          subvalue.async.apply(null, _.map(args, fromSandboxValue).concat([cb]));
        });
      } else if (typeof subvalue == 'function') {
        return withLength(getFunLength(subvalue) + 1, function(cb) {
          var args = [].slice.call(arguments, 1, arguments.length);
          cb(null, subvalue.apply(null, _.map(args, fromSandboxValue)));
        });
      } else {
        return recurseArg();
      }
    });
  }
  var apiKeys = _.keys(api);
  var apiValues = _.map(apiKeys, function(k) { return api[k]; });
  var getApiToValue;
  try {
    var code = fullCPS('(function(' + apiKeys.join(', ') + ') { return ' + comp.code + ';})');
    getApiToValue = Vm.runInNewContext(code, sandbox);
  } catch (ex) {
    callback(ex);
    return;
  }
  var tGetApiToValue = fromSandboxValue(getApiToValue);
  tGetApiToValue.async(function(err, apiToValue) {
    if (err) {
      callback(err);
    } else {
      apiToValue.async.apply(apiToValue, apiValues.concat([callback]));
    }
  });
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
  identityComputation: identityComputation
};
