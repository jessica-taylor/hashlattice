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

udpTransport.serverStart(
  function(reqObj, cb) {
    console.log('Hark, a request object!');
    console.log(reqObj);
    cb();
  },
  function (err, data) {
  });
udpTransport.sendMessage(targetVirtualIP, targetVirtualPort, 'hi there');
// TODO : how do we confirm that this message was actually sent and received?
