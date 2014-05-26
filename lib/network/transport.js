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

var WebRTC = null;
try {
  WebRTC = require('wrtc');
} catch(err) {
  try {
    var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
    var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
    if (RTCSessionDescription) {
      WebRTC = {
        RTCSessionDescription: RTCSessionDescription,
        RTCPeerConnection: RTCPeerConnection,
        RTCIceCandidate: RTCIceCandidate
      };
    }
  } catch (err) {
    console.warn('warning: no webrtc found');
  }
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
      var reqObj = msg.request;
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
        var internalIP = getInternalIPAddress();
        var internalPort = stunresp.local.port;
        assert(internalIP);
        self.selfPeer = {external: {ip: externalIP, port: externalPort},
          internal: {ip: internalIP, port: stunresp.local.port}};
        if (LOG_TRAFFIC) console.warn('got stun response', self.selfPeer);
        callback(null, self.selfPeer);
      } else {
        callback(err);
      }
    });
  }
};

function WebRTCTransport() {
  var self = this;
  self.localPeerConnection = null;
  self.remotePeerConnection = null;
  self.sendChannel = null;
  self.receiveChannel = null;
}

WebRTCTransport.prototype.startServer = function(handler, callback) {
  var servers = null;
  assert.equal(null, self.localPeerConnection);
  self.handler = handler;
  self.localPeerConnection = new WebRTC.RTCPeerConnection(servers,
    {optional: [{RtpDataChannels: true}]});
  console.warn('Created local peer connection object localPeerConnection');

  try {
    // Reliable Data Channels not yet supported in Chrome
    self.sendChannel = localPeerConnection.createDataChannel("sendDataChannel",
      {reliable: false});
    console.warn('Created send data channel');
  } catch (e) {
    alert('Failed to create data channel. ' +
          'You need Chrome M25 or later with RtpDataChannel enabled');
    console.warn('createDataChannel() failed with exception: ' + e.message);
  }
  self.localPeerConnection.onicecandidate = function(event) {
    if (event.candidate) {
      self.remotePeerConnection.addIceCandidate(event.candidate);
    }
  };
  self.sendChannel.onopen = self.sendChannel.onclose = function() {
    var readyState = self.sendChannel.readyState;
    console.warn('Send channel state is: ' + readyState);
  };

  self.remotePeerConnection = new WebRTC.RTCPeerConnection(servers,
    {optional: [{RtpDataChannels: true}]});
  console.warn('Created remote peer connection object remotePeerConnection');

  self.remotePeerConnection.onicecandidate = function(event) {
    console.warn('remote ice callback');
    if (event.candidate) {
      self.localPeerConnection.addIceCandidate(event.candidate);
      console.warn('Remote ICE candidate: \n ' + event.candidate.candidate);
    }
  };
  self.remotePeerConnection.ondatachannel = function(event) {
    console.warn('Receive Channel Callback');
    self.receiveChannel = event.channel;
    self.receiveChannel.onopen = receiveChannel.onclose = function() {
      var readyState = self.receiveChannel.readyState;
      console.warn('Receive channel state is: ' + readyState);
    };
    self.receiveChannel.onmessage = _.bind(function(event) {
      self.onReceive(event.data);
    });
  };

  self.localPeerConnection.createOffer(function(desc) {
    self.localPeerConnection.setLocalDescription(desc);
    console.warn('Offer from localPeerConnection \n' + desc.sdp);
    self.remotePeerConnection.setRemoteDescription(desc);
    self.remotePeerConnection.createAnswer(function(desc) {
      self.remotePeerConnection.setLocalDescription(desc);
      console.warn('Answer from remotePeerConnection \n' + desc.sdp);
      self.localPeerConnection.setRemoteDescription(desc);
    });
  });
};

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
  UdpTransport: UdpTransport,
  HttpTransport: HttpTransport
};

if (WebRTC) {
  module.exports.WebRTCTransport = WebRTCTransport;
}
