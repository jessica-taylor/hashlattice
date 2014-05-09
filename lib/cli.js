var Readline = require('readline');
var Fs = require('fs');
var _ = require('underscore');
var Yaml = require('yaml');

var Store = require('./store');
var Server = require('./server');
var Network = require('./network');
var Files = require('./files');


function getServer(directory) {
  var backingHashDataStore = new Store.CheckingHashStore(new Store.FileStore(Files.localPath('hashDataStore')));
  var backingVarStore = new Store.MergingVarStore(new Store.FileStore(Files.localPath('varStore')));
  var node = new Network.Node({
    transport: new Network.UdpTransport(),
    hashDataStore: backingHashDataStore,
    varStore: backingVarStore,
    // TODO bootstraps!
    bootstraps: []
  });
  return new Server({
    hashDataStore: node,
    varStore: node,
  });
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
  var getVar = function (varName) { return wait.forMethod(server, 'getVar', varName); }
  var putVar = function (varName) { return wait.forMethod(server, 'putVar', varName); }
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
