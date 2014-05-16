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

var UDP_TIMEOUT_MS = 1000;
var UDP_TRIES = 3;

var LOG_TRAFFIC = true;

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
  if (LOG_TRAFFIC) console.warn('sending', peer, msg);
  msg.sender = self.selfPeer;
  var msgBinary = Value.encodeValue(msg);
  var peerEncoding = Value.encodeValue(peer).toString('hex');
 
  if (Value.valuesEqual(self.selfPeer, peer)) {
    process.nextTick(function() {
      self.onReceive(msgBinary, null);
    });
  } else {
    var peerMethod = self.peerMethods[peerEncoding];
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
  if (LOG_TRAFFIC) console.warn('receive', msg);
  if (Value.valueType(msg) != 'object') {
    console.warn('bad message:', msgBinary);
  } else {

    if ('sender' in msg) {
      var encodedPeer = Value.encodeValue(msg.sender);
      if (rinfo) {
        if (rinfo.addr == msg.sender.internal.ip && rinfo.port ==
            msg.sender.internal.port) {
          self.peerMethods[encodedPeer] = 'internal';
        } else if (rinfo.addr == msg.sender.external.ip && rinfo.port ==
            msg.sender.external.port) {
          self.peerMethods[encodedPeer] == 'external';
        } else {
          console.warn('message sender does not match internal or external' +
              ' ip/port pair');
        }
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
    if (tries < UDP_TRIES) {
      // UDP hole punching
      self.sendMessage({external: {ip: '54.187.175.36', port: 13337}},
          {askaskpunch: {source: peer, dest: self.selfPeer}});
    }
    if (self.messageCallbackList[reqid]) {
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
      if(!err) {
        assert(stunresp.type == 'Open Internet' || 
               stunresp.type == 'Full Cone NAT',
               'Bad NAT type: ' + stunresp.type);
        var externalIP = stunresp.public.host;
        var externalPort = stunresp.public.port;
        assert(externalIP);
        assert(externalPort);

        Dns.lookup(Os.hostname(), function(err, addr, fam) {
          var internalIP = addr; 
          var internalPort = stunresp.local.port;
          assert(internalIP);
          assert(internalPort);
          self.selfPeer = {external: {ip: externalIP, port: externalPort},
            internal: {ip: internalIP, port: stunresp.local.port}};
          callback(null, self.selfPeer);
        });
      } else {
        callback(err);
      }
    });
  }
};

module.exports = {
  UdpTransport: UdpTransport
};
