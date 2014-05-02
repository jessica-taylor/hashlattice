var Path = require('path');

var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Transport = require('../lib/network/transport');
var Mininet = require('../lib/mininet');

describe('Transport', function() {
  describe('startServer', function() {
    var mn = new Mininet();
    it('should start the UDP transport layer correctly', function (done) {
      mn.runCommand(1, 'node ' + Path.join(__dirname, 'transportTestStartServer'));
      done();
    });
  });
  describe('sendMessage', function() {
    var mn = new Mininet('tree,5');
    it('should send messages correctly', function (done) {
      mn.getIP(2, function(err, destIP) {
        if (err) {
          done('Error while retrieving destination IP');
        } else {
          mn.getPort(2, function(err, destPort) {
            if (err) {
              done('Error while retrieving destination port');
            }
            mn.runCommand(1, 'node ' + Path.join(__dirname, 'transportTestSend') + ' ' + destIP + ' ' + destPort);
            done();
          });
        }
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
