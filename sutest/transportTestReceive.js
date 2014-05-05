var assert = require('assert');

var Transport = require('../lib/network/transport');


var udpTransport = new Transport.UdpTransport();

udpTransport.startServer(
  function(reqObj, cb) {
    assert.equal('hi there', reqObj);
    cb(null, 'hello to you too');
  },
  function (err, data) {
    assert(!err, err);
  });

setTimeout(process.exit, 2000);
