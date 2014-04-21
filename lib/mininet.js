var assert = require('assert');
var Stream = require('stream');
var Events = require('events');
var ChildProcess = require('child_process');
var Path = require('path');

var Carrier = require('carrier');

var _ = require('underscore');
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
  self.mininetClient = ChildProcess.spawn(
      'python', [Path.join(__dirname, 'mininet_client.py')],
      {stdio: ['pipe', 'pipe', process.stderr]});
  self.currentCommandCallback = null;
  self.commandsToRun = [];
  Carrier.carry(self.mininetClient.stdout, function(line) {
    self.currentCommandCallback(line);
    self.currentCommandCallback = null;
    self.tryRunCommand();
  });
  self.hostToIP = {};
  self.doCommand('<TODO settings here>', function(hostIPs) {
    _.each(hostIPs.split(','), function(hostSpaceIP) {
      var hostIP = hostSpaceIP.split(' ');
      self.hostToIP[hostIP[0]] = hostIP[1];
    });
    console.log('got host to ip');
  });
}

Mininet.prototype.doCommand = function(command, callback) {
  this.commandsToRun.push([command, callback]);
  this.tryRunCommand();
};

Mininet.prototype.tryRunCommand = function() {
  console.log('tryRunCommand', this.commandsToRun);
  if (this.currentCommandCallback === null && this.commandsToRun.length > 0) {
    var comm = this.commandsToRun.shift();
    this.currentCommandCallback = comm[1];
    console.log('printing', comm[0]);
    this.mininetClient.stdin.write(comm[0] + '\n');
  }
};

// gets IP of a host corresponding to a certain index.
Mininet.prototype.getIP = function(virtualHost, callback) {
  var self = this;
  var host = 'h' + virtualHost;
  if (host in self.hostToIP) {
    callback(self.hostToIP[host]);
  } else {
    setTimeout(function() { self.getIP(virtualHost, callback); }, 30);
  }
};

/* virtualHost should be an integer specifying the virtual host to run cmd on
 * cmd should be a command line command to run on the virtual host
*/ 
Mininet.prototype.runCommand = function(virtualHost, cmd) {
  console.log('running command', cmd);
  var self = this;
  var host = 'h' + virtualHost;
  var readProcess = null;
  // A stream to forward data from readProcess whenever it exists.
  var stream = new Stream.Readable();
  stream._read = function(size) { console.log('trying to read!'); };
  // stream._read = function(size) {
  //   console.log('trying to read!');
  //   if (readProcess) {
  //     var data = readProcess.stdout.read(size);
  //     if (data) {
  //       stream.push(data);
  //     }
  //   }
  // };
  self.doCommand(host + ' ' + cmd, function(pipe) {
    console.log('got pipe', pipe);
    readProcess = ChildProcess.spawn('cat', [pipe], {
      stdio: ['pipe', 'pipe', process.stderr]
    });
    readProcess.stdout.on('data', function(chunk) {
      console.log('got chunk', chunk);
      stream.push(chunk);
    });
  });
  return stream;
};

module.exports = Mininet;
