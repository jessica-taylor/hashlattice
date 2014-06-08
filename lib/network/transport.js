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
if ((function() { return this.window; })()) {
  // this works in the browser
  Peer = require("./peerjs").Peer;
  $ = require('jquery');
}

var LOG_TRAFFIC = true;

var WEBRTC_TIMEOUT_MS = 8000;

function WebRTCTransport(options) {
  var self = this;
  var id = options.id || null;
  // self.peer = new window.Peer(id, {key: 'j06d4hq2wat9be29', debug: 3});
  self.peer = new window.Peer(id, {host: '54.187.175.36', port: 80, debug: 3});
  self.peer.on('error', function(err) { 
    console.warn('(peer error)');
    console.warn(err);
    var match = err.message.match(/Could not connect to peer (.*)/);
    console.warn('match', match);
    if (match) {
      self.closeConnection(match[1]);
    }
  });
  self.id = null;
  self.peer.on('open', function(id) {
    self.id = id;
  });
  $('window').bind('beforeunload', function() {
    self.peer.destroy();
  });
  self.idToConnection = {};
  self.idToClosed = {};
  self.messageCallbackList = [];
  self.handler = null;
}

WebRTCTransport.prototype.closeConnection = function(peer) {
  var self = this;
  var key = 'id_' + peer;
  if (key in this.idToConnection) {
    console.warn('closing connection to', peer);
    var conn = this.idToConnection[key];
    conn.close();
    self.idToClosed[key] = true;
    delete self.idToConnection[key];
    for (var i = 0; i < self.messageCallbackList.length; i++) {
      var cb = self.messageCallbackList[i];
      if (cb && cb.peer == peer) {
        console.log('timing out request', i);
        self.callRequestCallback(i, {error: 'timeout'});
      }
    }
  }
};

WebRTCTransport.prototype.addConnection = function(conn) {
  var self = this;
  var key = 'id_' + conn.peer;
  if (key in this.idToConnection) {
    self.closeConnection(conn.peer);
  }
  self.idToClosed[key] = false;
  self.idToConnection[key] = conn;
  conn.on('error', function(err) { 
    console.warn(err);
    self.closeConnection(conn.peer);
  });
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
    if (self.idToClosed[key]) {
      callback('closed');
      return;
    }
    if (!(key in self.idToConnection)) {
      if (LOG_TRAFFIC) console.warn('add connection', id);
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
    cb.callback(null, response);
  } else {
    console.warn('cannot respond to request', reqid, 'with', response);
  }
};

WebRTCTransport.prototype.sendMessage = function(id, obj) {
  var self = this;
  var binary = Value.encodeValue(obj);
  // TODO: more efficient (blobs?)
  self.getConnection(id, function(err, conn) {
    assert(!err || err == 'closed', err);
    if (!err) {
      if (LOG_TRAFFIC) console.warn('send', id, Util.inspect(obj, {depth: null}));
      conn.send(binary.toString('hex'));
    } else {
      console.warn('not sending due to', err);
    }
  });
};

WebRTCTransport.prototype.startServer = function(handler, callback) {
  var self = this;
  assert(!self.handler);
  self.handler = handler;
  self.peer.on('connection', function(conn) {
    var key = 'id_' + conn.peer;
    if (LOG_TRAFFIC) console.warn('got connection', conn.peer, 'already', key in self.idToConnection);
    self.addConnection(conn);
  });
  self.getSelfPeer(function(err) { callback(err); });
};

WebRTCTransport.prototype.request = function(peer, reqObj, callback) {
  var self = this;
  var key = 'id_' + peer;
  if (peer == self.id) {
    if (LOG_TRAFFIC) {
      console.warn('self request', reqObj);
    }
    reqObj = _.clone(reqObj);
    reqObj.sender = self.id;
    self.handler(reqObj, function(err, resp) {
      if (LOG_TRAFFIC) {
        console.warn('self response', err, resp);
      }
      process.nextTick(function() { callback(err, resp); });
    });
    return;
  }
  if (self.idToClosed[key]) {
    console.warn('not contacting because closed: ', peer);
    callback(null, {error: 'timeout'});
    return;
  }
  var reqid = self.messageCallbackList.length;
  self.messageCallbackList.push({peer: peer, callback: callback});
  var msg = {reqid: reqid, request: reqObj};
  self.sendMessage(peer, msg);
  setTimeout(function() {
    if (self.messageCallbackList[reqid]) {
      console.warn('timed out: ', peer, msg);
      self.closeConnection(peer);
      self.callRequestCallback(reqid, {error: 'timeout'});
    }
  }, WEBRTC_TIMEOUT_MS);
};

WebRTCTransport.prototype.getSelfPeer = function(callback) {
  var self = this;
  Utilities.when(function() { return self.id !== null; }, function() {
    callback(null, self.id);
  });
};

WebRTCTransport.prototype.getBootstraps = function(callback) {
  this.peer.listAllPeers(function(peers) {
    console.log('bootstraps', peers);
    callback(null, peers);
  });
};

module.exports = {
};

if (Peer !== null) {
  module.exports.WebRTCTransport = WebRTCTransport;
}
