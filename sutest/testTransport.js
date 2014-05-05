var Path = require('path');

var assert = require('assert');
var Async = require('async');
var _ = require('underscore');

var Utilities = require('../lib/utilities');
var Transport = require('../lib/network/transport');
var Mininet = require('../lib/mininet');

describe('Transport', function() {
  describe('request', function() {
    var mn = new Mininet('linear,2');
    it('should send messages correctly', function (done) {
      this.timeout(5000);
      mn.getIP(2, function(err, destIP) {
        if (err) {
          mn.close();
          done(err);
        } else {
          mn.getPort(2, function(err, destPort) {
            if (err) {
              mn.close();
              done('Error while retrieving destination port');
            }
            var sender = mn.runCommand(1, 'node ' + Path.join(__dirname, 'transportTestSend') + ' ' + destIP + ' ' + destPort);
            var receiver = mn.runCommand(2, 'node ' + Path.join(__dirname, 'transportTestReceive'));
            Utilities.readAllFromStream(sender, function(err, data) {
              assert(!err, err);
              assert.equal('done\n', data.toString('utf8'));
              mn.close();
              done();
            });
          });
        }
      })
    });
  });
});
