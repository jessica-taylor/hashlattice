var assert = require('assert');
var http = require('http');

var Store = require('../lib/store');
var Server = require('../lib/server');
var Value = require('../lib/value');
var WebServer = require('../lib/webserver');
var Yaml = require('../lib/yaml');

Yaml.loadYamlFile('./test/testdata/staticweb/page1.yaml', function(err, comp1) {
  assert(!err, err);
  Yaml.loadYamlFile('./test/testdata/staticweb/page2.yaml', function(err, comp2) {
    assert(!err, err);
    Yaml.loadYamlFile('./test/testdata/staticweb/page3.yaml', function(err, 
        comp3) {
      var server = new Server.Server();
      server.putHashData(comp1, function(err) {
        assert(!err, err);
        server.putHashData(comp2, function(err) {
          assert(!err, err);
          server.putHashData(comp3, function(err) {
            var webserver = new WebServer.WebServer(server);
            webserver.start(function() {
              describe('WebServer', function() {
                it('should serve string content', function(done) {
                  http.get('http://127.0.0.1:1337/' + Value.hashData(comp1).toString('hex'), function(res) {
                    res.on('data', function(chunk) {
                      assert.equal("<html><body><p>Here's a page!</p></body></html>\n", chunk.toString('utf8'));
                      done();
                    });
                  }).on('error', function(err) {
                    assert(!err, err);
                  });
                });
                it('should serve buffer content', function(done) {
                  http.get('http://127.0.0.1:1337/' + Value.hashData(comp2).toString('hex'), function(res) {
                    res.on('data', function(chunk) {
                      assert.equal("<html><body><p>Here's another page!</p></body></html>\n", chunk.toString('utf8'));
                      done();
                    });
                  }).on('error', function(err) {
                    assert(!err, err);
                  });
                });
                var hash = Value.hashData(comp3).toString('hex');
                it('should serve string content again', function(done) {
                  http.get('http://127.0.0.1:1337/' + hash + '/yay', function(res) {
                    res.on('data', function(chunk) {
                      assert.equal("<html><body><p>Here's another page " +
                        "with an API!</p></body></html>\n",
                        chunk.toString('utf8'));
                      done();
                    });
                  }).on('error', function(err) {
                    assert(!err, err); 
                  });
                });
                it('should serve API result', function(done) {
                  var reqOptions = {
                    hostname: '127.0.0.1',
                    port: 1337,
                    path: '/' + hash + '/_api/apiObject',
                    method: 'POST'
                  };
                  http.request(reqOptions, function(res) {
                    // Put our other request in here so that we wait for the
                    // API object to be served
                    var reqOptions = {
                      hostname: '127.0.0.1',
                      port: 1337,
                      path: '/' + hash + '/_api/callFunction/0',
                      method: 'POST'
                    };

                    var req = http.request(reqOptions, function(res) {
                      res.on('data', function(chunk) {
                        assert.equal(1, Value.decodeValue(chunk));
                        done();
                      });
                    });

                    req.write(Value.encodeValue([]));
                    req.end();
                  }).end('/yay');
                });
              });
            });
          });
        });
      });
    });
  });
});
