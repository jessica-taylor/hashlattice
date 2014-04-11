var cp = require('child_process');
var spawn = cp.spawn;

/* n.b.: MININET CREATION MUST BE DONE IN ROOT MODE! */

/* Specify topology according to Mininet's rules
 * (see man page for details; should be a string like linear,4
 * or tree,5 which gives a shape and number of nodes)
 *
 * TODO : add ability to specify custom topologies (see http://mininet.org/walkthrough/#custom-topologies)
 */
function VirtualNetwork(topology) {
  var self = this;

  this.mn = (typeof(topology) == 'undefined') ? spawn('mn') : spawn('mn', ['--topo', topology]);
  // do we really want to log output to the console?
  this.mn.stdout.on('data', function(data) {
    console.log('mininet stdout: ' + data);
  });
  this.mn.stderr.on('data', function(data) {
    console.log('mininet stderr: ' + data);
  });

  /* virtualHost should be an integer specifying the virtual host to run cmd on
   * cmd should be a command line command to run on the virtual host
  */ 
  VirtualNetwork.prototype.runCommand = function(virtualHost, cmd) {
    self.mn.stdin.write('h' + virtualHost + ' ' + cmd);
  }
}

vn = new VirtualNetwork();
// console.log(vn);
setTimeout(function() {vn.runCommand(1, './helloworld');}, 5000);
