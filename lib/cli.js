var Readline = require('readline');
var Fs = require('fs');

/* ashwins1: Should the following be in a big function, so
 * as not to pollute the global namespace? */

function getServer(directory) {
  // TODO : implement black magic
}

function printUsage() {
  console.log('Usage: nodejs cli (run|interactive) [args]');
}

var cli = Readline.createInterface({
  input: process.stdin,
  output: process.stdout
  // TODO : add completer field to get autocompletion
});
var hashlatticePrompt = 'hashlattice> ';

// FIXME : is this the right way to do closures in JavaScript...
function mkHandleInput(server) {
  function handleInput(input) {
    var getHash = server.getHash;
    var putHash = server.putHash;
    var getVar = server.getVar;
    var putVar = server.putVar;

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
}
