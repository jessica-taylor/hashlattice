/*
 * Process used by code.js to run code safely.
 */
var Vm = require('vm');

var Esprima = require('esprima');

var StreamCoder = require('./streamcoder');
var _ = require('underscore');

function runCode(code, sandbox) {
  var sandbox = _.clone(sandbox);
  // TODO: this is bad.  Somehow copy buffer?
  sandbox.Buffer = Buffer;
  sandbox._ = _;
  // TODO: remove random/time/etc?
  try {
    return Vm.runInNewContext('(' + code + ')', sandbox);
  } catch(ex) {
    try {
      if (ex.constructor.name == 'SyntaxError') {
        try {
          Esprima.parse(code)
        } catch (ex2) {
          ex = ex2;
        }
      }
    } catch (ex3) { }
    throw ex;
  }
}

function main() {
  // This will exit when the other end calls close(), as this removes the
  // listener, which is the only thing in the event queue.
  var coder = new StreamCoder({
    instream: process.stdin,
    outstream: process.stdout,
    apiObject: runCode
  });
}

if (require.main === module) {
  main();
}
