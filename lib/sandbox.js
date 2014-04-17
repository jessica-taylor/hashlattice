/*
 * Process used by code.js to run code safely.
 */
var Vm = require('vm');

var StreamCoder = require('./streamcoder');
var _ = require('underscore');

function runCode(code, sandbox) {
  var sandbox = _.clone(sandbox);
  // TODO: this is bad.  Somehow copy buffer?
  sandbox.Buffer = Buffer;
  // TODO: remove random/time/etc?
  return Vm.runInNewContext('(' + code + ')', sandbox);
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
