var ChildProcess = require('child_process');
var Path = require('path');
var Readline = require('readline');

/* n.b.: MININET CREATION MUST BE DONE IN ROOT MODE! */

/* Specify topology according to Mininet's rules
 * (see man page for details; should be a string like linear,4
 * or tree,5 which gives a shape and number of nodes)
 *
 * TODO : add ability to specify custom topologies (see http://mininet.org/walkthrough/#custom-topologies)
 */
function VirtualNetwork(topology) {
  var self = this;
  // TODO: pass topology as argument to mininet_client?
  this.mininetClient = ChildProcess.spawn('python', [Path.join(__dirname, 'mininet_client.py')]);
  this.readline = Readline.createInterface({
    output: this.mininetClient.stdout,
    input: this.mininetClient.stdin
  });
}

/* virtualHost should be an integer specifying the virtual host to run cmd on
 * cmd should be a command line command to run on the virtual host
*/ 
VirtualNetwork.prototype.runCommand = function(virtualHost, cmd, callback) {
  this.readline.question('h' + virtualHost + ' ' + cmd, function(pipe) {
    var readProcess = ChildProcess.spawn('cat', [pipe]);
    callback(readProcess.stdout);
  });
};
