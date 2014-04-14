var Readline = require('readline');
var Fs = require('fs');

/* ashwins1: Should the following be in a big function, so
 * as not to pollute the global namespace? */

function printUsage() {
  console.log('Usage: nodejs cli (run|interactive) [args]');
}

function getHashCallback(err, data) {
  if (err) {
    console.log("An error occurred.");
  }
  else {
    // TODO : how to determine filename?
    Fs.writeFile("./" + filename, data, function(err) {
      if (err) {
        console.log(err);
      }});
  }
}

var cli = Readline.createInterface({
  input: process.stdin,
  output: process.stdout
  // TODO : add completer field to get autocompletion
});
var hashlatticePrompt = 'hashlattice> ';

function handleInput(input) {
  eval(input);
  cli.question(hashlatticePrompt, handleInput);
}

switch (process.argv[2]) {
  case 'interactive':
    cli.question(hashlatticePrompt, handleInput);
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
