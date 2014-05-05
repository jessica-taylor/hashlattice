var assert = require('assert');

var Transport = require('../lib/network/transport');


var udpTransport = new Transport.UdpTransport();

console.warn('receiver starting');
udpTransport.startServer(
  function(reqObj, cb) {
    console.log('Hark, a request object!');
    assert.equal('hi there', reqObj);
    cb(null, 'hello to you too');
    // cb();
  },
  function (err, data) {
console.warn('receiver started!');
    assert(!err, err);
  });
// TODO : how do we confirm that this message was actually sent and received?
