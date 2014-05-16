var Readline = require('readline');
var Dgram = require('dgram');

var argv = require('optimist').argv;
console.log(argv);

var ip = argv._[0];
var port = 13337 || argv.port;
var nosend = argv.nosend || false;
var sendout = argv.sendout || false;

var socket = Dgram.createSocket('udp4', function(msg) {
  console.log('got ' + msg.toString('utf8'));
});

function sendMessageTo(ipaddr) {
  console.log('sending');
  var buf = new Buffer('hello', 'utf8');
  socket.send(buf, 0, buf.length, port, ipaddr);
}

socket.bind(port, function() {
  if (sendout) {
    sendMessageTo('8.8.8.8');
  }
  console.log('bound');
  if (!nosend) {
    function sendMessageToIP() {
      sendMessageTo(ip);
      setTimeout(sendMessageToIP, 1000);
    }
    setTimeout(sendMessageToIP, 100);
  }
});
