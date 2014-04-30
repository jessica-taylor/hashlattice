var Transport = require('../../lib/network/transport');

var udpServer = Transport.serverStart(
  function(reqObj, cb) {
    console.log('Hark, a request object!');
    console.log(reqObj);
    cb();
  },
  function (err, data) {
  });

