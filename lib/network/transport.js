var Util = require('util');
var Http = require('http');

var _ = require('underscore');

var Value = require('../value');
var Utilities = require('../utilities');

function HttpTransport() {
  this.webServer = null;
}

HttpTransport.prototype.respondWithError = function(res, message) {
  res.writeHead(400, {'Content-Type': 'text/plain'});
  res.end(message);
};

HttpTransport.prototype.request = function(ip, port, reqObj, callback) {
  var reqOptions = {
    method: 'POST',
    hostname: ip,
    port: port,
    path: '/api'
  };
  var req = Http.request(reqOptions, function(res) {
    if (res.statusCode == 200) {
      callback(null, Value.decodeValue(Utilities.readAllFromStream(res)));
    } else {
      callback(null, {error: 'HTTP ' + res.statusCode});
    }
  });
  req.write(Value.encodeValue(rejObj));
  req.end();
};

HttpTransport.startServer = function(handler, callback) {
  var self = this;
  assert(self.webServer == null);
  self.webServer = Http.createServer(function(req, res) {
    var url = req.url;
    var splitUrl = url.split('/');

    if (splitUrl.length < 2 || splitUrl[1] === '') {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end("You are currently communicating with a HashLattice node!");
      // TODO Serve an HTML welcome page.
    } else {
      var endpoint = splitUrl[1];
      if (endpoint == 'api') {
        if (req.method != 'POST') {
          self.respondWithError(res, 'API requires you to use POST');
          return;
        }
        Utilities.readAllFromStream(req, function(err, reqObjBinary) {
          if (err) {
            self.respondWithError(res, 'Bad stream?');
            return;
          }
          var reqObj = Value.decodeValue(reqObjBinary);
          handler(reqObj, function(err, resp) {
            if (err) {
              self.respondWithError(res, Util.inspect(err));
            } else {
              res.writeHead(200, {'Content-Type': 'application/octet-stream'});
              res.end(Value.encodeValue(resp));
            }
          });
        });
      } else {
        self.respondWithError(res, 'Did you forget /api in your URL?');
      }
    }
  }).listen(13337, callback);
};