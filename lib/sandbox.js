var Vm = require('vm');

var StreamCoder = require('./streamcoder');

function runCode(code, sandbox) {
  return Vm.runInNewContext('(' + code + ')', sandbox);
}

function main() {
  var coder = new StreamCoder(process.stdin, process.stdout, runCode);
}

if (require.main === module) {
  main();
}
