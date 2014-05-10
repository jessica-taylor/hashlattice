var Readline = require('readline');
var Fs = require('fs');
var _ = require('underscore');
var Yaml = require('yaml');


function getServer(directory) {
  // TODO : implement black magic
}

function printUsage() {
  console.log('Usage: nodejs cli (run|interactive) [args]');
}

var cli = Readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: function completer(line) {
    // this function shamelessly stolen from the NodeJS docs on readline
    var completions = 'getHash putHashData getVar putVar'.split(' ');
    var hits = completions.filter(function (c) { return c.indexOf(line) == 0 });
    return [hits.length ? hits : completions, line];
  }
});
var hashlatticePrompt = 'hashlattice> ';

// FIXME : is this the right way to do closures in JavaScript...
function mkHandleInput(server) {
  var localEval = Vm.runInNewContext('eval', mkSandbox(server));
  function handleInput(input) {
    localEval(input);
    cli.question(hashlatticePrompt, handleInput);
  }
  return handleInput;
}

function mkSandbox(server) {
  var getHash = function (hash) { return wait.forMethod(server, 'getHash', hash); }
  var getHashData = function (hash) { return wait.forMethod(server, 'getHashData', hash); }
  var putHashData = function (data) { return wait.forMethod(server, 'putHashData', data); }
  var getVar = function (variable) { return wait.forMethod(server, 'getVar', variable); }
  var putVar = function (variable, data) { return wait.forMethod(server, 'putVar', variable, data); }
}

switch (process.argv[2]) {
  case 'interactive':
    var server = getServer(process.argv[3]);
    cli.question(hashlatticePrompt, mkHandleInput(server));
    break;
  case 'run':
    Vm.runInNewContext(process.argv[3], mkSandbox(server));
    break;
  case 'gethash':
    console.log(Yaml.dataToYaml(wait.forMethod(server, 'getHash', process.argv[3])));
    break;
  default :
    printUsage();
    process.exit();
}
