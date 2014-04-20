var Stream = require('stream');
var Events = require('events');
var ChildProcess = require('child_process');
var Path = require('path');
var Readline = require('readline');

var wait = require('wait.for');

/* n.b.: MININET CREATION MUST BE DONE IN ROOT MODE! */

/* Specify topology according to Mininet's rules
 * (see man page for details; should be a string like linear,4
 * or tree,5 which gives a shape and number of nodes)
 *
 * TODO : add ability to specify custom topologies (see http://mininet.org/walkthrough/#custom-topologies)
 */
function Mininet(topology) {
  var self = this;
  // TODO: pass topology as argument to mininet_client?
  self.mininetClient = ChildProcess.spawn('python', [Path.join(__dirname, 'mininet_client.py')]);
  self.readline = Readline.createInterface({
    output: self.mininetClient.stdout,
    input: self.mininetClient.stdin
  });
  self.hostToIP = {};
  // This is not great practice, but it won't be much of a performance hit
  // because we will not create a large number of mininets.
  wait.for(function(callback) {
    self.readline.question('<TODO settings here>', function(resp) {
      _.each(resp.split(','), function(hostSpaceIP) {
        var hostIP = hostSpaceIP.split(' ');
        self.hostToIP[hostIP[0]] = hostIP[1];
      });
      callback();
    });
  });
}

// gets IP of a host corresponding to a certain index.
Mininet.prototype.getIP = function(virtualHost, callback) {
  return this.hostToIP['h' + virtualHost];
};

/* virtualHost should be an integer specifying the virtual host to run cmd on
 * cmd should be a command line command to run on the virtual host
*/ 
Mininet.prototype.runCommand = function(virtualHost, cmd) {
  var host = 'h' + virtualHost;
  var readProcess = null;
  this.readline.question(host + ' ' + cmd, function(pipe) {
    readProcess = ChildProcess.spawn('cat', [pipe]);
  });
  // A stream to forward data from readProcess whenever it exists.
  var stream = new Stream.ReadStream();
  stream._read = function(size) {
    if (readProcess) {
      var data = readProcess.stdout.read(size);
      if (data) {
        stream.push(data);
      }
    }
  };
};

module.exports = Mininet;
