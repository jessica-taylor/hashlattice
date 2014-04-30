var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Transport = require('../lib/network/transport');
var Mininet = require('../lib/mininet');

describe('Transport', function() {
  describe('startServer', function() {
    var mn = new Mininet();
    it('should start the UDP transport layer correctly', function (done) {
      mn.runCommand(1, 'node ./network/testTransportStartServer');
      done();
    });
  });
  describe('sendMessage', function() {
    var mn = new Mininet('tree,5');
    it('should send messages correctly', function (done) {
      mn.getIP(2, function(err, targetIP) {
        // FIXME : how do we determine the port to send to in this test?
        mn.runCommand(1, 'node ../network/testTransportSend ' + targetIP + ' 13337');
        done();
      })
    });
  });
  describe('request', function() {
    it('should send requests correctly, building on sendMessage', function (done) {
      // TODO : finish this test; mn.runCommand(herpderp);
      done();
    });
  });
});
