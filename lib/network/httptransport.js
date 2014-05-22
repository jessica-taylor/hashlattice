var assert = require('assert');
var Util = require('util');
var Http = require('http');
var Stun = require('vs-stun');

var _ = require('underscore');

var Value = require('../value');
var Utilities = require('../utilities');

var Util = require('util');

function getInternalIPAddress() {
  var interfaces = require('os').networkInterfaces();
  for (var devName in interfaces) {
    var iface = interfaces[devName];

    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
        return alias.address;
    }
  }
  return '0.0.0.0';
}

function HttpTransport() {
  var self = this;
  self.server = null;
  self.handler = null;
  self.serverListenPort = 13337;
}

HttpTransport.prototype.startServer = function(handler, callback) {
  var self = this;
  assert.equal(null, self.socket);
  self.handler = handler;
  self.server = Http.createServer(function(req, res) {
    Utilities.readAllFromStream(req, function(err, buf) {
      if (!err) {
        self.handler(Value.decodeValue(buf), function(err, responseData) {
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.end(responseData);
        });
      } else {
        self.handler(err, null);
      }
    });
  });
  self.server.listen(self.serverListenPort, callback);
};

HttpTransport.prototype.request = function(peer, reqObject, callback) {
  var req = http.request({host: peer.ip, port: peer.port}, function(res) {
    Utilities.readAllFromStream(res, function(err, buf) {
      if (!err) {
        callback(null, Value.decodeValue(buf));
      } else {
        callback(err, null);
      }
    });
  });

  req.on('error', callback(e.message, null));

  req.write(Value.encodeValue(reqObject));

  req.end();
};

HttpTransport.prototype.getSelfPeer = function(callback) {
  var self = this;
  if (self.selfPeer) {
    callback(null, self.selfPeer);
  } else {
    var stunServer = { host: 'stun.l.google.com', port: 19302 };
    socket = Dgram.createSocket('udp4', _.bind(self.onReceive, self));
    socket.bind(self.serverListenPort, callback);

    Stun.resolve(self.socket, stunServer, function(err, stunresp) {
      if (LOG_TRAFFIC) console.warn('got stun response', stunresp);
      if (!err) {
        assert(stunresp.type == 'Open Internet' || 
               stunresp.type == 'Full Cone NAT',
               'Bad NAT type: ' + stunresp.type);
        var externalIP = stunresp.public.host;
        var externalPort = stunresp.public.port;
        assert(externalIP);
        assert(externalPort);
        var internalIP = getInternalIPAddress();
        var internalPort = stunresp.local.port;
        assert(internalIP);
        self.selfPeer = {ip: externalIP, port: externalPort}
        callback(null, self.selfPeer);
      } else {
        callback(err);
      }
    });
  }
};

module.exports = {
  HttpTransport: HttpTransport
};
