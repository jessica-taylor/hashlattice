var Readline = require('readline');
var Dgram = require('dgram');

var argv = require('optimist').argv;
console.log(argv);

var ip = argv._[0];
var port = 13337 || argv.port;
var nosend = argv.nosend || false;

var socket = Dgram.createSocket('udp4', function(msg) {
  console.log('got ' + msg.toString('utf8'));
});

socket.bind(port, function() {
  console.log('bound');
  function sendMessageToOther() {
    console.log('sending');
    var buf = new Buffer('hello', 'utf8');
    socket.send(buf, 0, buf.length, port, ip);
    setTimeout(sendMessageToOther, 1000);
  }
  if (!nosend) {
    sendMessageToOther();
  }
});
