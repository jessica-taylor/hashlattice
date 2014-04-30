var Readline = require('readline');
var Fs = require('fs');
var _ = require('underscore');

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
