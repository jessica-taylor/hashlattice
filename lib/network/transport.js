var assert = require('assert');
var Util = require('util');
var Http = require('http');
var Dgram = require('dgram');
var Stun = require('vs-stun');
var Dns = require('dns');
var Os = require('os');

var _ = require('underscore');

var Value = require('../value');
var Utilities = require('../utilities');

var Util = require('util');

var Peer = null;
try {
  // this works in the browser
  Peer = require("./peerjs").Peer;
} catch (ex) {
  // do nothing
}

var UDP_TIMEOUT_MS = 1000;
var UDP_TRIES = 3;

var LOG_TRAFFIC = true;

function getInternalIPAddress(callback) {
  var interfaces = require('os').networkInterfaces();
  console.warn(interfaces);
  for (var devName in interfaces) {
    var iface = interfaces[devName];

    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1') {
        callback(null, alias.address);
        return;
      }
    }
  }
  
  var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

  var exec = require('child_process').exec;
  var cached;
  var command;
  var filterRE;

  switch (process.platform) {
    // TODO: implement for OSs without ifconfig command
    case 'darwin':
      command = 'ifconfig';
      filterRE = /\binet\s+([^\s]+)/g;
      // filterRE = /\binet6\s+([^\s]+)/g; // IPv6
      break;
    default:
      command = 'ifconfig';
      filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
      // filterRE = /\binet6[^:]+:\s*([^\s]+)/g; // IPv6
      break;
  }
  // system call
  exec(command, function (error, stdout, sterr) {
    var ips = [];
    // extract IPs
    var matches = stdout.match(filterRE);
    // JS has no lookbehind REs, so we need a trick
    for (var i = 0; i < matches.length; i++) {
      ips.push(matches[i].replace(filterRE, '$1'));
    }

    // filter BS
    for (var i = 0, l = ips.length; i < l; i++) {
      if (!ignoreRE.test(ips[i])) {
        callback(error, ips[i]);
        return;
      }
    }
    // nothing found
    callback(error);
  });
}

function UdpTransport() {
  var self = this;
  self.messageCallbackList = [];
  self.socket = null;
  self.handler = null;
  self.selfPeer = null;
  // Mapping from peer to whether to send to internal, external, or both.
  // Defaults to both.
  self.peerMethods = {}
}

UdpTransport.prototype.sendMessage = function(peer, msg) {
  var self = this;
  self.getSelfPeer(function() {
    assert(self.selfPeer);
    if (LOG_TRAFFIC) console.warn('sending', peer, Util.inspect(msg, {depth: null}));
    msg.sender = self.selfPeer;
    var msgBinary = Value.encodeValue(msg);
    var peerEncoding = Value.encodeValue(peer).toString('hex');

    if (Value.valuesEqual(self.selfPeer, peer)) {
      process.nextTick(function() {
        self.onReceive(msgBinary, null);
      });
    } else {
      var peerMethod = self.peerMethods[peerEncoding];
      if (LOG_TRAFFIC) console.warn('size', msgBinary.length);
      if (!peerMethod || peerMethod == 'external') {
        if (peer.external) {
          self.socket.send(msgBinary, 0, msgBinary.length, peer.external.port,
              peer.external.ip);
        }
      } 
      if (!peerMethod || peerMethod == 'internal') {
        if (peer.internal) {
          self.socket.send(msgBinary, 0, msgBinary.length, peer.internal.port,
              peer.internal.ip);
        }
      }
    }
  });
};

UdpTransport.prototype.callRequestCallback = function(reqid, response) {
  var cb = this.messageCallbackList[reqid];
  if (cb) {
    this.messageCallbackList[reqid] = null;
    cb(null, response);
  } else {
    console.warn('cannot respond to request', reqid, 'with', response);
  }
};

UdpTransport.prototype.onReceive = function(msgBinary, rinfo) {
  var self = this;
  var msg = Value.decodeValue(msgBinary);
  if (LOG_TRAFFIC) console.warn('receive', Util.inspect(msg, {depth: null}));
  if (Value.valueType(msg) != 'object') {
    console.warn('bad message:', msgBinary);
  } else {
    if ('sender' in msg && rinfo) {
      var encodedPeer = Value.encodeValue(msg.sender).toString('hex');
      if (rinfo.address == msg.sender.internal.ip && rinfo.port ==
          msg.sender.internal.port) {
        self.peerMethods[encodedPeer] = 'internal';
      } else if (rinfo.address == msg.sender.external.ip && rinfo.port ==
          msg.sender.external.port) {
        self.peerMethods[encodedPeer] == 'external';
      } else {
        console.warn('message sender does not match internal or external' +
                     ' ip/port pair:', rinfo);
      }
    }
    if ('request' in msg) {
      var reqObj = _.clone(msg.request);
      reqObj.sender = msg.sender;
      self.handler(reqObj, function(err, resp) {
        assert(!err, err);
        self.sendMessage(msg.sender, {reqid: msg.reqid, response: resp});
      });
    } else if ('response' in msg) {
      self.callRequestCallback(msg.reqid, msg.response);
    } else if ('punch' in msg) {
      // do nothing
    } else if ('askpunch' in msg) {
      self.sendMessage(msg.askpunch.destination, {punch: 'punch'});
    } else if ('askaskpunch' in msg) {
      self.sendMessage(msg.askaskpunch.source, 
                       {askpunch: {destination: msg.askaskpunch.destination}});
    } else {
      console.log('bad message:', msg);
    }
  }
};

UdpTransport.prototype.startServer = function(handler, callback) {
  var self = this;
  assert.equal(null, self.socket);
  self.handler = handler;
  self.socket = Dgram.createSocket('udp4', _.bind(self.onReceive, self));
  self.socket.bind(13337, callback);
};

UdpTransport.prototype.request = function(peer, reqObj, callback) {
  var self = this;
  var reqid = self.messageCallbackList.length;
  self.messageCallbackList.push(callback);
  var tries = UDP_TRIES;
  function trySend() {
    if (self.messageCallbackList[reqid]) {
      if (tries < UDP_TRIES) {
        // UDP hole punching
        self.sendMessage({external: {ip: '54.187.175.36', port: 13337},
                          internal: {ip: '172.31.41.77', port: 13337}},
            {askaskpunch: {source: peer, destination: self.selfPeer}});
      }
      if (tries == 0) {
        self.callRequestCallback(reqid, {error: 'timeout'});
      } else {
        tries--;
        self.sendMessage(peer, {reqid: reqid, request: reqObj});
        setTimeout(trySend, UDP_TIMEOUT_MS);
      }
    }
  }
  trySend();
};

UdpTransport.prototype.getSelfPeer = function(callback) {
  var self = this;
  if (self.selfPeer) {
    callback(null, self.selfPeer);
  } else {
    var server = { host: 'stun.l.google.com', port: 19302 };
    Stun.resolve(self.socket, server, function(err, stunresp) {
      if (!err) {
        assert(stunresp.type == 'Open Internet' || 
               stunresp.type == 'Full Cone NAT',
               'Bad NAT type: ' + stunresp.type);
        var externalIP = stunresp.public.host;
        var externalPort = stunresp.public.port;
        assert(externalIP);
        assert(externalPort);
        var internalIP = getInternalIPAddress(function(err, ip) {
          assert(!err, err);
          var internalPort = stunresp.local.port;
          self.selfPeer = {external: {ip: externalIP, port: externalPort},
            internal: {ip: ip, port: internalPort}}

          if (LOG_TRAFFIC) console.warn('got stun response', self.selfPeer);
          callback(null, self.selfPeer);
        });
      } else {
        callback(err);
      }
    });
  }
};

var WEBRTC_TIMEOUT_MS = 5000;

function WebRTCTransport(options) {
  var self = this;
  var id = options.id || null;
  self.peer = new Peer(id, {key: 'j06d4hq2wat9be29'});
  self.peer.on('error', console.warn);
  self.id = null;
  self.peer.on('open', function(id) {
    self.id = id;
  });
  self.idToConnection = {};
  self.messageCallbackList = [];
  self.handler = null;
}

WebRTCTransport.prototype.addConnection = function(conn) {
  var self = this;
  var key = 'id_' + conn.peer;
  assert(!(key in this.idToConnection));
  self.idToConnection[key] = conn;
  conn.on('error', console.warn);
  conn.on('data', function(msgHex) {
    var msg = Value.decodeValue(new Buffer(msgHex, 'hex'));
    if (LOG_TRAFFIC) console.warn('receive', Util.inspect(msg, {depth: null}));
    if (Value.valueType(msg) != 'object') {
      console.warn('bad message:', msgBinary);
    } else {
      if ('request' in msg) {
        var reqObj = _.clone(msg.request);
        reqObj.sender = conn.peer;
        self.handler(reqObj, function(err, resp) {
          assert(!err, err);
          self.sendMessage(conn.peer, {reqid: msg.reqid, response: resp});
        });
      } else if ('response' in msg) {
        self.callRequestCallback(msg.reqid, msg.response);
      } else {
        console.log('bad message:', msg);
      }
    }
  });
};

WebRTCTransport.prototype.getConnection = function(id, callback) {
  var self = this;
  self.getSelfPeer(function() {
    var key = 'id_' + id;
    if (!(key in self.idToConnection)) {
      self.addConnection(self.peer.connect(id, {reliable: true}));
    }
    var conn = self.idToConnection[key];
    assert(conn);
    if (conn.open) {
      callback(null, conn);
    } else {
      conn.on('open', function() { callback(null, conn); });
    }
  });
};

WebRTCTransport.prototype.callRequestCallback = function(reqid, response) {
  var cb = this.messageCallbackList[reqid];
  if (cb) {
    this.messageCallbackList[reqid] = null;
    cb(null, response);
  } else {
    console.warn('cannot respond to request', reqid, 'with', response);
  }
};

WebRTCTransport.prototype.sendMessage = function(id, obj) {
  var self = this;
  var binary = Value.encodeValue(obj);
  // TODO: more efficient (blobs?)
  self.getConnection(id, function(err, conn) {
    assert(!err, err);
    conn.send(binary.toString('hex'));
  });
};

WebRTCTransport.prototype.startServer = function(handler, callback) {
  var self = this;
  assert(!self.handler);
  self.handler = handler;
  self.peer.on('connection', function(conn) {
    var key = 'id_' + conn.peer;
    if (!(key in self.idToConnection)) {
      self.addConnection(conn);
    }
  });
  self.getSelfPeer(function(err) { callback(err); });
};

WebRTCTransport.prototype.request = function(peer, reqObj, callback) {
  var self = this;
  var reqid = self.messageCallbackList.length;
  self.messageCallbackList.push(callback);
  self.sendMessage(peer, {reqid: reqid, request: reqObj});
  setTimeout(function() {
    self.callRequestCallback(reqid, {error: 'timeout'});
  }, WEBRTC_TIMEOUT_MS);
};

WebRTCTransport.prototype.getSelfPeer = function(callback) {
  var self = this;
  Utilities.when(function() { return self.id !== null; }, function() {
    callback(null, self.id);
  });
};

module.exports = {
  UdpTransport: UdpTransport
};

if (Peer !== null) {
  module.exports.WebRTCTransport = WebRTCTransport;
}
