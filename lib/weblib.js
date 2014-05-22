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
      return makeAsyncRequest(url, Value.encodeValue([].slice.call(arguments,
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

function makeSyncRequest(url, postdata) {
  var arr = bufferToUInt8Array(postdata);
  var req = new XMLHttpRequest();
  req.open('PUT', url, false);
  req.send(
  return decodeData($.ajax(url, {type: 'PUT', data: arr, async: false}));
}


function makeAsyncRequest(url, postdata, callback) {
  var arr = bufferToUInt8Array(postdata);
  $.ajax(url, postdata, function(binary) {
    callback(decodeData(binary));
  });
}

var api = makeSyncRequest('/' + getHashURL() + '/_api/apiObject', null);
