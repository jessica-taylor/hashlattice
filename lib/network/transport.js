var Util = require('util');
var Http = require('http');
var Dgram = require('dgram');

var _ = require('underscore');

var Value = require('../value');
var Utilities = require('../utilities');

var UDP_TIMEOUT_MS = 500;
var UDP_TRIES = 4;

function HttpTransport() {
  this.webServer = null;
}

HttpTransport.prototype.respondWithError = function(res, message) {
  res.writeHead(400, {'Content-Type': 'text/plain'});
  res.end(message);
};

HttpTransport.prototype.request = function(ip, port, reqObj, callback) {
  var reqOptions = {
    method: 'POST',
    hostname: ip,
    port: port,
    path: '/api'
  };
  var req = Http.request(reqOptions, function(res) {
    if (res.statusCode == 200) {
      var reqObj = Value.decodeValue(Utilities.readAllFromStream(res));
      callback(null, reqObj);
    } else {
      callback(null, {error: 'HTTP ' + res.statusCode});
    }
  });
  req.write(Value.encodeValue(rejObj));
  req.end();
};

HttpTransport.startServer = function(handler, callback) {
  var self = this;
  assert(self.webServer == null);
  self.webServer = Http.createServer(function(req, res) {
    var url = req.url;
    var splitUrl = url.split('/');

    if (splitUrl.length < 2 || splitUrl[1] === '') {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end("You are currently communicating with a HashLattice node!");
      // TODO Serve an HTML welcome page.
    } else {
      var endpoint = splitUrl[1];
      if (endpoint == 'api') {
        if (req.method != 'POST') {
          self.respondWithError(res, 'API requires you to use POST');
          return;
        }
        Utilities.readAllFromStream(req, function(err, reqObjBinary) {
          if (err) {
            self.respondWithError(res, 'Bad stream?');
            return;
          }
          var reqObj = Value.decodeValue(reqObjBinary);
          reqObj.sender = {
            ip: req.connection.remoteAddress,
            port: req.connection.remotePort
          };
          handler(reqObj, function(err, resp) {
            if (err) {
              self.respondWithError(res, Util.inspect(err));
            } else {
              res.writeHead(200, {'Content-Type': 'application/octet-stream'});
              res.end(Value.encodeValue(resp));
            }
          });
        });
      } else {
        self.respondWithError(res, 'Did you forget /api in your URL?');
      }
    }
  }).listen(13337, callback);
};

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
