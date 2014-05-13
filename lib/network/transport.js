var assert = require('assert');
var Util = require('util');
var Http = require('http');
var Dgram = require('dgram');
var Stun = require('vs-stun');

var _ = require('underscore');

var Value = require('../value');
var Utilities = require('../utilities');

var Util = require('util');

var UDP_TIMEOUT_MS = 500;
var UDP_TRIES = 4;

function UdpTransport() {
  var self = this;
  self.messageCallbackList = [];
  self.socket = null;
}

UdpTransport.prototype.sendMessage = function(peer, msg) {
  var msgBinary = Value.encodeValue(msg);
  this.socket.send(msgBinary, 0, msgBinary.length, peer.port, peer.ip);
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

UdpTransport.prototype.startServer = function(handler, callback) {
  var self = this;
  assert.equal(null, self.socket);
  self.socket = Dgram.createSocket('udp4', function(msgBinary, rinfo) {
    var msg = Value.decodeValue(msgBinary);
    if (Value.valueType(msg) != 'object') {
      console.warn('bad message:', msgBinary);
    } else if ('request' in msg) {
      var reqObj = msg.request;
      reqObj.sender = {
        ip: rinfo.address,
        port: rinfo.port
      };
      handler(reqObj, function(err, resp) {
        assert(!err, err);
        self.sendMessage({ip: rinfo.address, port: rinfo.port}, {reqid: msg.reqid, response: resp});
      });
    } else if ('response' in msg) {
      self.callRequestCallback(msg.reqid, msg.response);
    }
  });
  self.socket.bind(13337, callback);
};

UdpTransport.prototype.request = function(peer, reqObj, callback) {
  var self = this;
  var reqid = self.messageCallbackList.length;
  self.messageCallbackList.push(callback);
  var tries = UDP_TRIES;
  function trySend() {
    if (tries == 0) {
      if (self.messageCallbackList[reqid]) {
        self.callRequestCallback(reqid, {error: 'timeout'});
      }
    } else {
      tries--;
      self.sendMessage(peer, {reqid: reqid, request: reqObj});
      setTimeout(trySend, UDP_TIMEOUT_MS);
    }
  }
  trySend();
};

UdpTransport.prototype.getSelfPeer = function(callback) {
  var server = { host: 'stun.l.google.com', port: 19302 };
  Stun.resolve(this.socket, server, function(err, stunresp) {
    if(!err) {
      callback(null, {ip: stunresp.public.host, port: stunresp.public.port});
    } else {
      callback(err);
    }
  });
 
}

module.exports = {
  UdpTransport: UdpTransport
};
