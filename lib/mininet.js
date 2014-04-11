var cp = require('child_process');
var spawn = cp.spawn;

/* n.b.: MININET CREATION MUST BE DONE IN ROOT MODE! */

/* Specify topology according to Mininet's rules
 * (see man page for details; should be a string like linear,4
 * or tree,5 which gives a shape and number of nodes)
 *
 * TODO : add ability to specify custom topologies (see http://mininet.org/walkthrough/#custom-topologies)
 */
function createVirtualNetwork(topology) {
  mn = spawn('mn', ['--topo', topology]);
  // do we really want to log output to the console?
  mn.stdout.on('data', function(data) {
    console.log('mininet stdout: ' + data);
  });
  mn.stderr.on('data', function(data) {
    console.log('mininet stderr: ' + data);
  });
  return mn;
}

/* mn is a virtual network object returned by createVirtualNetwork
 * virtualHost should be an integer specifying the virtual host to run cmd on
 * cmd should be a command line command to run on the virtual host
 */
function runCommand(mn, virtualHost, cmd) {
  mn.stdin.write(virtualHost + ' ' + cmd);
}
