
(function() {

  var Value = require('./value');

  // This doesn't actually work yet.  It's mostly for reference for the web server.

  function decodeData(binary) {
    return decodeValue(binary, function(id) {
      var url = '/myhash/_api/callFunction/' + id + '/'
      var fn = function() {
        return makeSyncRequest(url, Value.encodeValue([].slice.call(arguments, 0)));
      };
      fn.async = function(callback) {
        return makeAsyncRequest(url, Value.encodeValue([].slice.call(arguments, 0)),
                                callback);
      };
      return fn;
    });
  }

  function makeSyncRequest(url, postdata) {
    return decodeData(ajax(url, postdata));
  }

  function makeAsyncRequest(url, postdata, callback) {
    ajaxAsync(url, postdata, function(binary) {
      callback(decodeData(binary));
    });
  }

  makeRequest('...') = function(hash) {
    return makeRequest('/myhash/_api/callFunction/1/' + hash);
  }

  var api = makeSyncRequest('/myhash/_api/apiObject', null);

  window.api = api;
})();
