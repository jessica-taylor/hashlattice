var Webserver = require('./webserver');
var Opt = require('node-getopt');

function getServer(directory) {
  // TODO : black magic
}

opt = Opt.create([
    ['', 'dir=DIR', 'Directory in which to start the server']
    ])
  .bindHelp()
  .parseSystem();

var webserverInstance = WebServer(getServer(opt.options['dir']));
webserverInstance.start(function(e) {
  //TODO : maybe do something on the basis of error code?
  // e.g., could retry if port is already in use
});
