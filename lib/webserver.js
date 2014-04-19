var assert = require('assert');
var http = require('http');
var util = require('util');
var _ = require('underscore');

var Server = require('./server');
var Value = require('./value');
var FunctionServer = require('./functionserver');

function WebServer(server) {
    // server : Server
    this.server = server;
    this.httpserver = null;
    this.functionserver = new FunctionServer();
    this.apiCache = {};
}

WebServer.prototype.handleAPI = function(funcName, args, req, res) {
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

            var fn = self.functionserver.getFunction(funcID);
          
            if (!fn) {
                 res.writeHead(400, {'Content-Type': 'text/plain'});
                 res.end('You have specified an invalid function ID. Please ' +
                         'try again.');
                 break;
            }

            // Extract the function arguments from the POST data. These values
            // should be encoded as an array by the client.
            var fnArgs = Value.decodeValue(req.read());

            // TODO How do we handle functions that do not take a callback?
            var result = fn.apply(null, fnArgs.concat([function(err, data) {
                if (!err) {
                    res.writeHead(200, {'Content-Type':
                        'application/octet-stream'});
                    res.end(self.functionserver.encodeValue(data));
                } else {
                    res.writeHead(404, {'Content-Type': 'text/plain'});
                    res.end(util.inspect(err));
                }
            }]));

            break;
        case 'apiObject':
           var apiObject = {
               getHash: _.bind(self.server.getHash, self.server),
               putHash: _.bind(self.server.putHash, self.server),
               getHashData: _.bind(self.server.getHashData, self.server),
               evalComputation: _.bind(self.server.evalComputation,
                       self.server),
               getVar: _.bind(self.server.getVar, self.server),
               putVar: _.bind(self.server.putVar, self.server)
           }
           var binApiObject = self.functionserver.encodeValue(apiObject);
           res.writeHead(200, {'Content-Type': 'application/octet-stream'});
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
                self.handleAPI(splitUrl[3], splitUrl.slice(4), req, res);
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

            // Object containing the default HashLattice API. This is the same
            // object the user gets when calling /<hash>/_api/apiObject.
            var hl = {
               getHash: _.bind(self.server.getHash, self.server),
               putHash: _.bind(self.server.putHash, self.server),
               getHashData: _.bind(self.server.getHashData, self.server),
               evalComputation: _.bind(self.server.evalComputation,
                       self.server),
               getVar: _.bind(self.server.getVar, self.server),
               putVar: _.bind(self.server.putVar, self.server)
            }

            // getData is a function passed to getHash as a callback. It takes
            // as an argument the HashLattice (hl) object which contains
            // function bindings to the default API.
            self.server.getHash(hashBuffer, function(err, getData) {
                if (!err) {
                    var data = getData(hl);
                    // Cache the API. TODO Figure out how to have separate
                    // caches for separate hashes. Check that cache before
                    // calling getData?
                    self.apiCache = data.api;
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
