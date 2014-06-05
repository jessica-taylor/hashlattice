var assert = require('assert');
var Readline = require('readline');
var Fs = require('fs');
var Vm = require('vm');

var _ = require('underscore');
var wait = require('wait.for');

var Yaml = require('./yaml');
var Store = require('./store');
var Server = require('./server');
var Network = require('./network');
var Files = require('./files');
var WebServer = require('./webserver');
var YamlInterface = require('./yamlinterface');
var Path = require('path');
var Value = require('./value');

var argv = require('optimist').argv;
console.log('argv:', argv);

function getServer(options) {
  // This gets set later, before it is needed.
  var serverVarEvaluator = null;
  var varEvaluator = {
    defaultValue: function(varSpec, callback) {
      serverVarEvaluator.defaultValue(varSpec, callback);
    },
    merge: function(varSpec, value1, value2, callback) {
      serverVarEvaluator.merge(varSpec, value1, value2, callback);
    }
  };
  // NOTE: we're ignoring directory right now.
  var backingHashDataStore = new Store.CheckingHashStore(new Store.FileStore(Files.localPath('hashDataStore')));
  var backingVarStore = new Store.MergingVarStore(varEvaluator, new Store.FileStore(Files.localPath('varStore')));
  var transport, bootstraps;
  if (options.webrtc) {
    transport = new Network.WebRTCTransport(argv);
    bootstraps = ['ec2'];
  } else {
    transport = new Network.UdpTransport();
    bootstraps = [{external: {ip: '54.187.175.36', port: 13337},
                  internal: {ip: '172.31.41.77', port: 13337}}];
  }
  var node = new Network.Node({
    transport: transport,
    hashDataStore: backingHashDataStore,
    varStore: backingVarStore,
    bootstraps: bootstraps
  });
  var server = new Server.Server({
    hashDataStore: Store.layerHashStores(backingHashDataStore, node),
    varStore: Store.layerVarStores(backingVarStore, node),
  });
  serverVarEvaluator = server.getVarEvaluator();
  node.startServer(function(){});
  return server;
}

function printUsage() {
  console.log('Usage: nodejs cli (run|interactive) [args]');
}

var cli = Readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: function completer(line) {
    // this function shamelessly stolen from the NodeJS docs on readline
    var completions = 'getHash putHashData getVar putVar'.split(' ');
    var hits = completions.filter(function (c) { return c.indexOf(line) == 0 });
    return [hits.length ? hits : completions, line];
  }
});
var hashlatticePrompt = 'hashlattice> ';

// FIXME : is this the right way to do closures in JavaScript...
function mkHandleInput(server) {
  var code =
    '(function(expr, wait, cb) {\n' +
    '  wait.launchFiber(function() {\n' +
    '    cb(null, eval(expr));\n' +
    '  });\n' +
    '})';
  var localEval = Vm.runInNewContext(code, mkSandbox(server));
  function handleInput(input) {
    localEval(input, wait, function(err, result) {
      console.log(result);
      cli.question(hashlatticePrompt, handleInput);
    });
  }
  return handleInput;
}

function mkSandbox(server) {
  return {
    getHash: function (hash) { return wait.forMethod(server, 'getHash', hash); },
    getHashData: function (hash) { return wait.forMethod(server, 'getHashData', hash); },
    putHashData: function (data) { return wait.forMethod(server, 'putHashData', data); },
    getVar: function (variable) { return wait.forMethod(server, 'getVar', variable); },
    putVar: function (variable, data) { return wait.forMethod(server, 'putVar', variable, data); },
    // TODO this is questionable!
    Buffer: Buffer
  };
}

wait.launchFiber(function() {
  var server = getServer(argv);
  switch (process.argv[2]) {
    case 'interactive':
      cli.question(hashlatticePrompt, mkHandleInput(server));
      break;
    case 'run':
      console.log(Vm.runInNewContext(process.argv[3], mkSandbox(server)));
      process.exit();
      break;
    case 'gethash':
      console.log(Yaml.dataToYaml(wait.forMethod(server, 'getHash', process.argv[3])));
      process.exit();
      break;
    case 'startserver':
      // we already started it
      break;
    case 'start':
      var webServer = new WebServer.WebServer(server);
      webServer.start(function() {
        console.log('HashLattice server running at 127.0.0.1');
      });
      break;
    case 'putDirectory':
      var yamlFileName = Path.join(process.argv[3], 'website.yaml');
      YamlInterface.toYaml(process.argv[3], function(err, yaml) {
        Fs.writeFile(yamlFileName, yaml, 
          function(err) {
            if (!err) {
              Yaml.loadYamlFile(yamlFileName, function(err, yamlData) {
                server.putHashDataSplit(yamlData, function(err, hash) {
                  if (!err) {
                    console.log('Directory put into HashLattice with hash ' +
                      hash.toString('hex'));
                  } else {
                   console.warn(err); 
                  }
                });
              });
            } else {
              console.warn(err);
            }
          });
      });
      break;
    case 'putYaml':
      var yamlFileName = process.argv[3];
      Yaml.loadYamlFile(yamlFileName, function(err, yamlData) {
        assert(!err, err);
        server.putHashDataSplit(yamlData, function(err, hash) {
          assert(!err, err);
          console.log('YAML put into HashLattice with hash ' +
                      hash.toString('hex'));
        });
      });
      break;
    default:
      printUsage();
      process.exit();
  }
});
