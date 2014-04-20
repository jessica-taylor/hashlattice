var assert = require('assert');
var http = require('http');

var Cache = require('../lib/cache');
var Server = require('../lib/server');
var Value = require('../lib/value');
var WebServer = require('../lib/webserver');
var Yaml = require('../lib/yaml');
var FunctionServer = require('../lib/functionserver');

Yaml.loadYamlFile('./test/testdata/staticweb/page1.yaml', function(err, comp1) {
  assert(!err, err);
  Yaml.loadYamlFile('./test/testdata/staticweb/page2.yaml', function(err, comp2) {
    assert(!err, err);
    Yaml.loadYamlFile('./test/testdata/staticweb/page3.yaml', function(err, 
        comp3) {
      var server = new Server.Server();
      server.putHash(comp1, function(err) {
        assert(!err, err);
        server.putHash(comp2, function(err) {
          assert(!err, err);
          server.putHash(comp3, function(err) {
            var webserver = new WebServer.WebServer(server);
            var funcserver = new FunctionServer.FunctionServer();
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
                  http.get('http://127.0.0.1:1337/' + hash, function(res) {
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
                it('should serve API', function(done) {
                  http.get('http://127.0.0.1:1337/' + hash + '/_api/apiObject',
                    function(res) {
                      res.on('data', function(chunk) {
                        var apiObj = funcserver.decodeValue(chunk);
                        var returnOne = apiObj.returnOne;
                        assert.equal(1, returnOne());
                        done();
                      });
                  }).on('error', function(err) {
                    assert(!err, err);    
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
