var assert = require('assert');

var Transport = require('../lib/network/transport');

function printUsage() {
  console.warn('Usage: node testTransportSend <target virtual IP> <target virtual port>');
}

if (process.argv.length != 4) {
  printUsage();
  process.exit();
}

var udpTransport = new Transport.UdpTransport();

var targetVirtualIP   = process.argv[2];
var targetVirtualPort = parseInt(process.argv[3]);

if (targetVirtualPort === NaN) {
  printUsage();
  process.exit();
}

udpTransport.startServer(
  function(reqObj, cb) {
    cb();
  },
  function (err) {
    assert(!err, err);
    udpTransport.request({ip: targetVirtualIP, port: targetVirtualPort}, 'hi there', function(err, respObj) {
      assert(!err, err);
      assert.equal('hello to you too', respObj);
      console.log('done');
      process.exit(0);
    });
  });
setTimeout(process.exit, 2000);
