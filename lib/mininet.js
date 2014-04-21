var assert = require('assert');
var Stream = require('stream');
var Events = require('events');
var ChildProcess = require('child_process');
var Path = require('path');
var Readline = require('readline');

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
  self.readline = Readline.createInterface({
    input: self.mininetClient.stdout,
    output: self.mininetClient.stdin
  });
  // self.mininetClient.stdout.on('data', function(chunk) {
  //   var text = chunk.toString('utf8');
  //   console.log('got data', text);
  //   assert.equal('\n', text.substring(text.length - 1));
  //   text = text.substring(0, text.length - 1);
  //   assert(self.currentCommandCallback);
  //   self.currentCommandCallback(text);
  //   self.currentCommandCallback = null;
  //   self.tryDoCommands();
  // });
  // self.commandQueue = [];
  // self.currentCommandCallback = null;
  self.hostToIP = {};
  self.readline.question('<TODO settings here>\n', function(hostIPs) {
    _.each(hostIPs.split(','), function(hostSpaceIP) {
      var hostIP = hostSpaceIP.split(' ');
      self.hostToIP[hostIP[0]] = hostIP[1];
    });
    console.log('got host to ip');
  });
}

Mininet.prototype.mininetCommand = function(command, callback) {
  this.commandQueue.push([command, callback]);
  this.tryDoCommands();
};

Mininet.prototype.tryDoCommands = function() {
  console.log('tryDoCommands');
  if (!this.currentCommandCallback && this.commandQueue.length > 0) {
    var cmd = this.commandQueue.shift();
    console.log('actually doing', cmd);
    this.mininetClient.stdin.write(cmd[0] + '\n');
    this.currentCommandCallback = cmd[1];
  };
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
  self.readline.question(host + ' ' + cmd + '\n', function(pipe) {
    console.log('got pipe', pipe);
    readProcess = ChildProcess.spawn('cat', [pipe], {
      stdio: ['pipe', 'pipe', process.stderr]
    });
  });
  // A stream to forward data from readProcess whenever it exists.
  var stream = new Stream.Readable();
  stream._read = function(size) {
    if (readProcess) {
      var data = readProcess.stdout.read(size);
      if (data) {
        stream.push(data);
      }
    }
  };
  return stream;
};

module.exports = Mininet;
