if (window.top !== window) {
  window.top.openPath(window.location.path);
}
(function() {
  var Util = require('util');
  var assert = require('assert');

  var $ = require('jquery');
  var _ = require('underscore');

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

  function getServer() {
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
    var node = new Network.Node({
      transport: new Network.WebRTCTransport(),
      hashDataStore: backingHashDataStore,
      varStore: backingVarStore,
      bootstraps: ['server']
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

  function displayError(err) {
    alert(Util.inspect(err));
  }
  var server = getServer();

  function getResponseByPath(pathname, callback) {
    var match = pathname.match(/\/(\w*)\/(.*)/);
    if (!match) {
      calback('bad path ' + pathname);
    } else {
      var hash = match[0];
      var restPath = '/' + match[1];
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
        if (!err && typeof getData != 'function') {
          err = 'computation returned a non-function: ' + Util.inspect(getData);
        }
        if (err) {
          callback(err);
        } else {
          getData.async(hl, function(err, data) {
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

  function openPath(pathname) {
    if (window.location.pathname !== pathname) {
      window.history.pushState('', '', pathname);
    }
    getResponseByPath(pathname, function(err, data) {
      if (err) {
        displayError(err);
      } else {
        window.api = data.api;
        var contentType = data.headers && data.headers['Content-Type'];
        contentType = contentType || 'text/plain';
        var content = data.content;
        $('#content_holder').empty();
        if (contentType == 'text/html') {
          if (content instanceof Buffer) {
            content = content.toString('utf8');
          }
          assert(typeof content == 'string');
          // TODO sandbox?
          var iframe = $('<iframe>').attr('srcdoc', content);
          $('#content_holder').append(iframe);
        } else if (contentType.indexOf('image/') == 0) {
          assert(content instanceof Buffer);
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

  $(function() {
    var pathname = window.location.pathname;
    openPath(pathname);
  });
})();
