var assert = require('assert');
var Util = require('util');
var Http = require('http');
var Stun = require('vs-stun');

var _ = require('underscore');

var Value = require('../value');
var Utilities = require('../utilities');

var Util = require('util');


function HttpTransport() {
  var self = this;
  self.socket = null;
}


HttpTransport.prototype.getSelfPeer = function(callback) {
  var socket, server = { host: 'stun.l.google.com', port: 19302 };
  var cb = function(err, value) {
    if(!err) {
      socket = value;
      socket.close();

      callback(null, {ip: socket.stun.public.host, port: socket.stun.public.port});
    } else {
      callback(err);
    }
  }

  Stun.connect(server, cb);
 
}

module.exports = {
  HttpTransport: HttpTransport
};
