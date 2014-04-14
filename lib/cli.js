var Readline = require('readline');

/* Should the following be in a big function, so as not to pollute the 
 * global namespace? */

function printGetHashUsage() {
  console.log('Usage: getHash <hashcode>');
}

function printPutHashUsage() {
  console.log('Usage: putHash <hashcode>');
}

function printLoadYamlFileUsage() {
  console.log('Usage: loadYamlFile <filename>');
}

var cli = Readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
var hashlatticePrompt = 'hashlattice> ';

function dealWithInput(input) {
  if (input.length == 0) {
    return;
  }

  var splitInput = input.split(' ');
  var command = splitInput[0],
      args    = splitInput.slice(1);

  switch (command) {
    case 'getHash':
      if (args.length != 1) {
        printGetHashUsage();
      }
      else {
        console.log('getting file given by hash ' + args[0]);
      }
      break;
    case 'putHash':
      if (args.length != 1) {
        printPutHashUsage();
      }
      else {
        console.log('putting file given by hash ' + args[0]);
      }
      break;
    case 'loadYamlFile':
      if (args.length != 1) {
        printLoadYamlFileUsage();
      }
      else {
        console.log('loading yaml file ' + args[0]);
      }
      break;
    default :
      console.log('Unknown command ' + command);
  }

  cli.question(hashlatticePrompt, dealWithInput);
}

cli.question(hashlatticePrompt, dealWithInput);
