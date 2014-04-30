var Transport = require('../../lib/network/transport');

var udpTransport = new UdpTransport();
udpTransport.serverStart(
  function(reqObj, cb) {
    console.log('Hark, a request object!');
    console.log(reqObj);
    cb();
  },
  function (err, data) {
  });

