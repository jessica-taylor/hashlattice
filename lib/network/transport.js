var assert = require('assert');
var Util = require('util');
var Http = require('http');
var Dgram = require('dgram');
var Stun = require('vs-stun');

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
}

UdpTransport.prototype.sendMessage = function(peer, msg) {
  var self = this;
  if (LOG_TRAFFIC) console.warn('sending', peer, msg);
  var msgBinary = Value.encodeValue(msg);
  if (Value.valuesEqual(self.selfPeer, peer)) {
    process.nextTick(function() {
      self.onReceive(msgBinary, {address: peer.ip, port: peer.port});
    });
  } else {
    self.socket.send(msgBinary, 0, msgBinary.length, peer.port, peer.ip);
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
  } else if ('request' in msg) {
    var reqObj = msg.request;
    self.handler(reqObj, function(err, resp) {
      assert(!err, err);
      self.sendMessage({ip: rinfo.address, port: rinfo.port}, {reqid: msg.reqid, response: resp});
    });
  } else if ('response' in msg) {
    self.callRequestCallback(msg.reqid, msg.response);
  } else if ('ping' in msg) {
    // do nothing
  } else if ('askping' in msg) {
    self.sendMessage(msg.askping.destination, {ping: 'ping'});
  } else if ('askaskping' in msg) {
    self.sendMessage(msg.askaskping.source, 
                     {askping: {destination: msg.askaskping.destination}});
  } else {
    console.log('bad message:', msg);
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
        var ip = stunresp.public.host;
        var port = stunresp.public.port;
        assert(ip);
        assert(port);
        self.selfPeer = {ip: ip, port: port};
        callback(null, self.selfPeer);
      } else {
        callback(err);
      }
    });
  }
};

module.exports = {
  UdpTransport: UdpTransport
};
