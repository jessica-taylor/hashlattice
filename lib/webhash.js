if (window.top !== window) {
  window.top.openPath(window.location.path);
}
(function() {
  var Util = require('util');
  var assert = require('assert');

  var $ = require('jquery');
  var _ = require('underscore');
  var Async = require('async');

  var Server = require('./server');
  var Network = require('./network');
  var Value = require('./value');
  var Store = require('./store');
  var Code = require('./code');

  function getValueStore(prefix) {
    return Store.layerValueStores(
        new Store.MemoryStore(),
        new Store.BrowserLocalStore(prefix));
  }

  function getServer(configdata) {
    // This gets set later, before it is needed.
    var serverVarEvaluator = null;
    var varEvaluator = {
      defaultValue: function(varSpec, callback) {
        serverVarEvaluator.defaultValue(varSpec, callback);
      },
      merge: function(varSpec, value1, value2) {
        serverVarEvaluator.merge(varSpec, value1, value2, callback);
      }
    };
    var backingHashDataStore = new Store.CheckingHashStore(getValueStore('hashDataStore'));
    var backingVarStore = new Store.MergingVarStore(varEvaluator, getValueStore('varStore'));
    var id = configdata && configdata.id;
    var node = new Network.Node({
      transport: new Network.WebRTCTransport({id: id}),
      hashDataStore: backingHashDataStore,
      varStore: backingVarStore
    });
    var server = new Server.Server({
      hashDataStore: Store.layerHashStores(backingHashDataStore, node),
      varStore: Store.layerVarStores(backingVarStore, node),
      evalComputationFunction: Code.evalComputationWithoutWait
    });
    serverVarEvaluator = server.getVarEvaluator();
    node.startServer(function(){});
    return server;
  }
  var server = null;

  function displayError(err) {
    alert(Util.inspect(err));
  }

  function getResponseByPath(pathname, callback) {
    console.log('getResponseByPath', pathname);
    var match = pathname.match(/\/(\w*)\/(.*)/);
    if (!match) {
      callback('bad path ' + pathname);
    } else {
      var hash = match[1];
      console.log('hash', Util.inspect(hash));
      var restPath = '/' + match[2];
      var localStore = getValueStore('local.' + hash);
      var hl = {
        path: restPath,
        putHashData: new Code.AsyncFunction('putHashData', _.bind(server.putHashData, server)),
        getVar: new Code.AsyncFunction('getVar', _.bind(server.getVar, server)),
        putVar: new Code.AsyncFunction('putVar', _.bind(server.putVar, server)),
        getLocal: new Code.AsyncFunction('getLocal/' + hash, _.bind(localStore.get, localStore)),
        putLocal: new Code.AsyncFunction('putLocal/' + hash, _.bind(localStore.put, localStore))
      };
      server.getHash(new Buffer(hash, 'hex'), function(err, getData) {
        console.log('called getHash');
        if (!err && typeof getData != 'function') {
          err = 'computation returned a non-function: ' + Util.inspect(getData);
        }
        if (err) {
          callback(err);
        } else {
          getData.async(hl, function(err, data) {
            console.log('asyncd', data);
            if (!err && (typeof data != 'object' || data === null)) {
              err = 'web page function returned a non-object: ' + Util.inspect(data);
            }
            if (err) {
              callback(err);
            } else {
              callback(null, data);
            }
          });
        }
      });
    }
  }
  window.getResponseByPath = getResponseByPath;

  function changePath(pathname) {
    if (window.location.pathname !== pathname) {
      window.history.pushState('', '', pathname);
    }
  }
  window.changePath = changePath;

  function openPath(pathname) {
    changePath(pathname);
    getResponseByPath(pathname, function(err, data) {
      if (err) {
        displayError(err);
      } else {
        window.api = data.api;
        console.log('data', data);
        var contentType = data.headers && data.headers['Content-Type'];
        contentType = contentType || 'text/plain';
        var content = data.content;
        $('#content_holder').empty();
        if (contentType == 'text/plain') {
          if (Buffer.isBuffer(content)) {
            content = content.toString('utf8');
          }
          assert(typeof content == 'string');
          var pre = $('<pre>').text(content);
          $('#content_holder').append(pre);
        } else if (contentType == 'text/html') {
          if (Buffer.isBuffer(content)) {
            content = content.toString('utf8');
          }
          assert(typeof content == 'string');
          // TODO sandbox?
          var iframe = $('<iframe>').attr('srcdoc', content);
          $('#content_holder').append(iframe);
        } else if (contentType.indexOf('image/') == 0) {
          assert(Buffer.isBuffer(content));
          var src = 'data:' + contentType + ';base64,' + content.toString('base64');
          var img = $('<img>').attr('src', src);
          $('#content_holder').append(img);
        } else {
          displayError('invalid content type ' + contentType);
        }
      }
    });
  }
  window.openPath = openPath;

  function bufferToUInt8Array(buffer) {
    var bytesArray = new Uint8Array(buffer.length);
    for (var i = 0; i < buffer.length; i++) {
      bytesArray[i] = buffer.readUInt8(i);
    }
    return bytesArray;
  }

  function UInt8ArrayToBuffer(bytesArray) {
    var buffer = new Buffer(bytesArray.byteLength);
    for (var i = 0; i < bytesArray.byteLength; i++) {
      buffer.writeUInt8(bytesArray[i], i);
    }
    return buffer;
  }

  function getValue(path, callback) {
    var req = new XMLHttpRequest();
    req.responseType = 'arraybuffer';
    req.open('GET', window.location.origin + path, true);
    req.onload = function(e) {
      if (req.readyState === 4) {
        if (req.status === 200) {
          var responseBuffer = new Uint8Array(req.response);
          var binary = UInt8ArrayToBuffer(responseBuffer);
          callback(null, Value.decodeValue(binary));
        } else {
          callback(new Error('Async request to ' + url + ' failed - no 200' +
              'response'));
        }
      } else {
        callback(new Error('Async request to ' + url + ' failed - request ' +
            ' did not reach a ready state'));
      }
    }
    req.send();
  }

  $(function() {
    var pathname = window.location.pathname;
    getValue('/configdata', function(err, configdata) {
      server = getServer(configdata);
      var hashDataList = (configdata && configdata.hashDataList) || [];
      console.log('length', hashDataList.length);
      Async.map(hashDataList, function(d, cb) {
        server.putHashData(d, function(err) {
          if (err) {
            console.warn(err);
          } else {
            console.log(Value.hashData(d).toString('hex'));
          }
          cb();
        });
      }, function(err) {
        assert(!err, err);
        openPath(pathname);
      });
    });
  });
})();