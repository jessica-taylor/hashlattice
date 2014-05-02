var assert = require('assert');
var http = require('http');
var util = require('util');
var _ = require('underscore');
var wait = require('wait.for');

var Server = require('./server');
var Value = require('./value');
var FunctionServer = require('./functionserver');

function WebServer(server) {
    // server : Server
    this.server = server;
    this.httpserver = null;
    this.functionserver = {};
    this.apiStore = {};
}

WebServer.prototype.handleAPI = function(hash, funcName, args, req, res) {
    // TODO Check the request to ensure that the API calls are coming from
    // localhost and ensure that it's a POST request for callFunction.
    var self = this;
    switch(funcName) {
        case 'callFunction':
            var funcID = parseInt(args[0]);
            if (isNaN(funcID)) {
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end('callFunction must be used with an integer argument ' +
                        'specifying the function ID of the function to be ' +
                        'called.');
                break;
            }

            if (!self.functionserver[hash]) {
              res.writeHead(400, {'Content-Type': 'text/plain'});
              res.end('No function server for this hash was found. ' +
                  'Please make sure you\'ve requested the API object ' +
                  'and try again.');
              break;
            }

            var fn = self.functionserver[hash].getFunction(funcID);
          
            if (!fn) {
                 res.writeHead(400, {'Content-Type': 'text/plain'});
                 res.end('You have specified an invalid function ID. Please ' +
                         'try again.');
                 break;
            }

            // Extract the function arguments from the POST data. These values
            // should be encoded as an array by the client.
            req.on('readable', function() {
              var fnArgs = Value.decodeValue(req.read());
              var result = fn.async(fnArgs, function(err, data) {
                  if (!err) {
                      res.writeHead(200, {'Content-Type':
                          'application/octet-stream'});
                      res.end(self.functionserver[hash].encodeValue(data));
                  } else {
                      res.writeHead(404, {'Content-Type': 'text/plain'});
                      res.end(util.inspect(err));
                  }
              });
            });


            break;
        case 'apiObject':
            // Make sure the hash is valid. 
            try {
                var hashBuffer = new Buffer(hash, 'hex');
            } catch (err) {
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end('You have entered an invalid hash code. Please try ' +
                        'again with a valid hash code.');
                return;
            }

            // If we get to this point without returning, the hash is valid.
            // Check that the hash is actually in the store, encode the API
            // object, and send it to the client.
            if (self.apiStore[hash]) {
              if(!self.functionserver[hash]) {
                self.functionserver[hash] = new FunctionServer();
              }
                var binApiObject =
                    self.functionserver[hash].encodeValue(self.apiStore[hash]);
                res.writeHead(200, {'Content-Type':
                    'application/octet-stream'});
                res.end(binApiObject);
            }

            res.end(binApiObject);
           break;
        default:
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end('You have called an invalid API function. Valid API ' +
                    ' calls are callFunction and apiObject.')
            break;
    }
}

WebServer.prototype.start = function(callback) {
    var self = this;
    assert(!this.httpserver, 'already started');
    this.httpserver = http.createServer(function(req, res) {
        var url = req.url;
        var splitUrl = url.split('/');

        if (splitUrl.length < 2 || splitUrl[1] === '') {
            // TODO Serve an HTML welcome page.
        } else if (splitUrl.length >= 3 && splitUrl[2] === '_api') {
            if (splitUrl.length >= 4) {
                self.handleAPI(splitUrl[1], splitUrl[3], splitUrl.slice(4), req, res);
            } else {
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end('Please specify an API call. Available functions ' +
                        'are callFunction and apiObject.');
            }
        } else {
            // Get the hash and convert it to a Buffer.
            var hash = splitUrl[1];

            try {
                var hashBuffer = new Buffer(hash, 'hex');
            } catch (err) {
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end('You have entered an invalid hash code. Please try ' +
                        'again with a valid hash code.');
                return;
            }

            // Object containing the default HashLattice API.
            var hl = {
               putHashData: function(value) { return wait.forMethod(self.server, 'putHashData', value); },
               getVar: function(v) { return wait.forMethod(self.server, 'getVar', v); },
               putVar: function(v, value) { return wait.forMethod(self.server, 'putVar', v, value); }
            };

            // getData is a function passed to getHash as a callback. It takes
            // as an argument the HashLattice (hl) object which contains
            // function bindings to the default API.
            self.server.getHash(hashBuffer, function(err, getData) {
                if (!err) {
                    var data = getData(hl);
                    // Store the API for this HashLattice site.. 
                    self.apiStore[hash] = data.api;
                    res.writeHead(200, data.headers);
                    // Note that this works for buffers and strings.
                    res.end(data.content);
                } else {
                    res.writeHead(404, {'Content-Type': 'text/plain'});
                    res.end(util.inspect(err));
                }
            });
        }
    }).listen(1337, '127.0.0.1', callback);
    console.log('HashLattice server running at 127.0.0.1 port 1337');
};

WebServer.prototype.close = function(callback) {
  this.httpserver.close(callback);
  this.httpserver = null;
};

module.exports = {
  WebServer: WebServer
};
