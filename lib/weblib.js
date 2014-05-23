
(function() {
  var Value = require('./value');
  var $ = require('jquery');

  // This doesn't actually work yet.  It's mostly for reference for the web server.

  function getHashURL() {
    var hash = window.location.pathname;
    hash = hash.match(/\/(\w*)\//);
    return hash[1];
  }

  function decodeData(binary) {
    return decodeValue(binary, function(id) {
      var url = '/' + getHashURL() + '/_api/callFunction/' + id + '/'
      var fn = function() {
        return makeSyncRequest(url, Value.encodeValue([].slice.call(arguments,
              0)));
      };
      fn.async = function(callback) {
        makeAsyncRequest(url, Value.encodeValue([].slice.call(arguments,
              0)), callback);
      };
      return fn;
    });
  }

  function bufferToUInt8Array(buffer) {
    var bytesArray = new Uint8Array(buffer.length);
    for (var i = 0; i < buffer.length; i++) {
      bytesArray[i] = buffer.readUInt8(i);
    }
    return bytesArray;
  }

  function UInt8ArrayToBuffer(bytesArray) {
    var buffer = new Buffer(bytesArray.length);
    for (var i = 0; i < bytesArray.length; i++) {
      buffer.writeUInt8(bytesArray[i], i);
    }
    return buffer;
  }

  function makeSyncRequest(url, postdata) {
    var arr = bufferToUInt8Array(postdata || new Buffer(0));
    var req = new XMLHttpRequest();
    req.open('POST', url, false);
    req.responseType = 'arraybuffer';
    req.send(arr);
    if (req.status === 200) {
      return decodeData(UInt8ArrayToBuffer(req.response));
    } else {
      throw new Exception('Sync request to ' + url + ' failed - no 200 response'); 
    }
  }


  function makeAsyncRequest(url, postdata, callback) {
    var arr = bufferToUInt8Array(postdata || new Buffer(0));
    var req = new XMLHttpRequest();
    req.responseType = 'arraybuffer';
    req.open('POST', url, true);
    req.onload = function(e) {
      if (req.readyState === 4) {
        if (req.status === 200) {
          var binary = UInt8ArrayToBuffer(req.response);
          callback(null, decodeData(binary));
        } else {
          callback(new Exception('Async request to ' + url + ' failed - no 200' +
              'response'));
        }
      } else {
        callback(new Exception('Async request to ' + url + ' failed - request ' +
            ' did not reach a ready state'));
      }
    }
    req.send(arr);
  }

  var api = makeSyncRequest('/' + getHashURL() + '/_api/apiObject', null);

  window.api = api;
})();
