var Util = require('util');
var Http = require('http');
var Dgram = require('dgram');

var _ = require('underscore');

var Value = require('../value');
var Utilities = require('../utilities');

var UDP_TIMEOUT_MS = 500;
var UDP_TRIES = 4;

function UdpTransport() {
  var self = this;
  self.messageCallbackList = [];
  self.socket = null;
}

UdpTransport.prototype.sendMessage = function(ip, port, msg) {
  var msgBinary = Value.encodeValue(msg);
  self.socket.send(msg, 0, msg.length, port, ip);
};

UdpTransport.prototype.startServer = function(handler, callback) {
  assert.equal(null, self.socket);
  self.socket = Dgram.createSocket('udp4', function(msgBinary, rinfo) {
    var msg = Value.decodeValue(msgBinary);
    if ('request' in msg) {
      var reqObj = msg.request;
      reqObj.sender = {
        ip: rinfo.address,
        port: rinfo.port
      };
      handler(reqObj, function(err, resp) {
        assert(!err, err);
        self.sendMessage(rinfo.address, rinfo.port, {reqid: msg.reqid, response: resp});
      });
    } else if ('response' in msg) {
      assert(self.messageCallbackList[msg.reqid]);
      var cb = self.messageCallbackList[msg.reqid];
      self.messageCallbackList[msg.reqid] = null;
      cb(null, msg.response);
    }
  });
  self.socket.on('listening', callback);
};

UdpTransport.prototype.request = function(ip, port, reqObj, callback) {
  var self = this;
  var reqid = self.messageCallbackList.length;
  self.messageCallbackList.push(callback);
  var tries = UDP_TRIES;
  function trySend() {
    if (tries == 0) {
      if (self.messageCallbackList[reqid]) {
        var cb = self.messageCallbackList[reqid];
        self.messageCallbackList[reqid] = null;
        cb(null, {error: 'timeout'});
      }
    } else {
      tries--;
      self.sendMessage(ip, port, {reqid: reqid, request: reqObj});
      setTimeout(trySend, UDP_TIMEOUT_MS);
    }
  });
  trySend();
};

module.exports = {
  HttpTransport: HttpTransport,
  UdpTransport, UdpTransport
};
