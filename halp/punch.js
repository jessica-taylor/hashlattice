var Readline = require('readline');
var Dgram = require('dgram');
var Stun = require('vs-stun');

var Longjohn = require('longjohn');

var argv = require('optimist').argv;
console.log(argv);

var socket = Dgram.createSocket('udp4', function(msg) {
  console.log('got ' + msg.toString('utf8'));
});

function sendMessageTo(ipaddr, otherPort) {
  console.log('sending to', ipaddr, otherPort);
  var buf = new Buffer('hello', 'utf8');
  socket.send(buf, 0, buf.length, otherPort, ipaddr);
}

function sendMessagesTo(ipaddr, otherPort) {
  sendMessageTo(ipaddr, otherPort);
  setTimeout(function() { sendMessagesTo(ipaddr, otherPort); }, 500);
}

socket.bind(port, function() {
  console.log('bound');
  var server = { host: 'stun.l.google.com', port: 19302 };
  Stun.resolve(socket, server, function(err, stunresp) {
    console.warn('got stun response', stunresp);
    if (!err) {
      assert(stunresp.type == 'Open Internet' || 
             stunresp.type == 'Full Cone NAT',
             'Bad NAT type: ' + stunresp.type);
      externalIP = stunresp.public.host;
      externalPort = stunresp.public.port;
      console.log('ip', externalIP, 'port', externalPort);
      var rl = readline.createInterface({input: process.stdin,
                                         output: process.stdout});
      rl.question('ip?', function(otherIP) {
        rl.question('port?', function(otherPort) {
          otherPort = Number(otherPort);
          sendMessagesTo(otherIP, otherPort);
        });
      });
    }
  });
});


