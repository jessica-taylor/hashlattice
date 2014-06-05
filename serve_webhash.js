var assert = require('assert');
var Fs = require('fs');
var Path = require('path');
var ChildProcess = require('child_process');
var Http = require('http');

var Async = require('async');
var _ = require('underscore');

var Value = require('./lib/value');
var Yaml = require('./lib/yaml');

var argv = require('optimist').argv;
console.log(argv);

var port = argv.p || 1337;

var staticContent = ['webhash.js', 'weblib.js'];

ChildProcess.exec('node_modules/.bin/browserify ./lib/webhash_weblib.js -o webhash/weblib.js && node_modules/.bin/browserify ./lib/webhash.js -o webhash/webhash.js', function(err, stdout, stderr) {
  if (stdout || stderr) {
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
  }
  assert(!err, err);
  var configdata = {};
  if (argv.i) {
    configdata.id = argv.i;
  }
  var yamlDocs = argv.y;
  if (yamlDocs == undefined) {
    yamlDocs = [];
  }
  if (!Array.isArray(yamlDocs)) {
    yamlDocs = [yamlDocs];
  }
  Async.map(yamlDocs, function(yamlDoc, cb) {
    Yaml.loadYamlFile(Path.resolve(yamlDoc), cb);
  }, function(err, docContents) {
    assert(!err, err);
    configdata.hashDataList = docContents;

    var httpServer = Http.createServer(function(req, res) {
      var url = req.url;
      var splitUrl = url.split('/');
      if (splitUrl.length == 2 && _.contains(staticContent, splitUrl[1])) {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        var path = Path.join(__dirname, 'webhash', splitUrl[1]);
        Fs.readFile(path, function(err, data) {
          assert(!err, err);
          res.end(data);
        });
      } else if (url == '/configdata') {
        res.writeHead(200, {'Content-Type': 'application/octet-stream'});
        res.end(Value.encodeValue(configdata));
      } else {
        res.writeHead(200, {'Content-Type': 'text/html'});
        var path = Path.join(__dirname, 'webhash', 'hashpage.html');
        Fs.readFile(path, function(err, data) {
          assert(!err, err);
          res.end(data);
        });
      }
    });
    httpServer.listen(port, '127.0.0.1', function() {
      console.log('http://127.0.0.1:' + port + '/');
    });
  });
});
