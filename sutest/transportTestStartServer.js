var Transport = require('../lib/network/transport');

var udpTransport = new Transport.UdpTransport();
udpTransport.startServer(
  function(reqObj, cb) {
    console.log('Hark, a request object!');
    console.log(reqObj);
    cb();
  },
  function (err, data) {
  });

