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
  self.hostToIP = {};
  // TODO: pass topology as argument to mininet_client?
  var args = topology ? ['--topo', topology] : [];
  self.mn = ChildProcess.spawn('mn', args, {stdio: ['pipe', 'pipe', 'pipe']});
  self.mn.stdin.write('py sys.stderr.write("HOSTS " + __import__("json").dumps([{"name": h.name, "ip": h.IP()} for h in net.hosts]) + "\\n")\n');
  var loggingAllLines = false;
  Carrier.carry(self.mn.stderr).on('line', function(line) {
    if (line.substring(0, 5) == 'HOSTS') {
      var hosts = JSON.parse(line.substring(6));
      for (var i = 0; i < hosts.length; i++) {
        self.hostToIP[hosts[i].name] = hosts[i].ip;
      }
    } else {
      if (line.indexOf('Traceback') > -1) {
        loggingAllLines = true;
      }
      if (loggingAllLines) {
        console.warn(line);
      }
    }
  });
}

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
  var self = this;
  var pipePrefix = '/tmp/hashlattice_mininet_fifo_' + new Date().getTime();
  var stdoutPipeName = pipePrefix + '_stdout';
  var stderrPipeName = pipePrefix + '_stderr';
  ChildProcess.spawn('mkfifo', [stdoutPipeName, stderrPipeName], {
    stdio: ['ignore', 'ignore', process.stderr]
  }).on('exit', function(code) {
    assert.equal(0, code);
    self.mn.stdin.write('h' + virtualHost + ' ' + cmd + ' > ' + stdoutPipeName + ' 2> ' + stderrPipeName + ' &\n');
  });
  var readStdoutProcess = ChildProcess.spawn('cat', [stdoutPipeName], {
    stdio: ['pipe', 'pipe', process.stderr]
  });
  var readStderrProcess = ChildProcess.spawn('cat', [stderrPipeName], {
    stdio: ['pipe', process.stderr, process.stderr]
  });
  return readStdoutProcess.stdout;
};

Mininet.prototype.close = function() {
  this.mn.stdin.end();
};

module.exports = Mininet;
