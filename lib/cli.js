var Readline = require('readline');
var Fs = require('fs');
var _ = require('underscore');

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
  function handleInput(input) {
    var getHash = _.bind(server.getHash, server);
    var putHashData = _.bind(server.putHashData, server);
    var getVar = _.bind(server.getVar, server);
    var putVar = _.bind(server.putVar, server);

    eval(input);
    cli.question(hashlatticePrompt, handleInput);
  }
  return handleInput;
}

switch (process.argv[2]) {
  case 'interactive':
    var server = getServer(process.argv[3]);
    cli.question(hashlatticePrompt, mkHandleInput(server));
    break;
  case 'run':
    eval(process.argv[3]);
    break;
  case 'gethash':
    // TODO : implement this
    break;
  default :
    printUsage();
    process.exit();
}
