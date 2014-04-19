var assert = require('assert');
var http = require('http');

var Cache = require('../lib/cache');
var Server = require('../lib/server');
var Value = require('../lib/value');
var WebServer = require('../lib/webserver');
var Yaml = require('../lib/yaml');

Yaml.loadYamlFile('./test/testdata/staticweb/page1.yaml', function(err, comp1) {
  assert(!err, err);
  Yaml.loadYamlFile('./test/testdata/staticweb/page2.yaml', function(err, comp2) {
    assert(!err, err);
    var server = new Server.Server();
    server.putHash(comp1, function(err) {
      assert(!err, err);
      server.putHash(comp2, function(err) {
        assert(!err, err);
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
          });
        });
      });
    });
  });
});
