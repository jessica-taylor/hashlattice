var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Transport = require('../lib/network/transport');
var Mininet = require('../lib/mininet');

describe('Transport', function() {
  describe('startServer', function() {
    var mn = new Mininet();
    it('should start the UDP transport layer correctly', function (done) {
      mn.runCommand(herpderp);
      done();
    });
  });
  describe('sendMessage', function() {
    it('should send messages correctly', function (done) {
      mn.runCommand(herpderp);
      done();
    });
  });
  describe('request', function() {
    it('should send requests correctly, building on sendMessage', function (done) {
      mn.runCommand(herpderp);
      done();
    });
  });
});
