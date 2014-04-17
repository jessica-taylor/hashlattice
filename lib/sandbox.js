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
  var coder = new StreamCoder({
    instream: process.stdin,
    outstream: process.stdout,
    apiObject: runCode
  });
}

if (require.main === module) {
  main();
}
