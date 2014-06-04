(function() {
  var Async = require('async');
  var $ = require('jquery');
  var Path = require('path');

  var Value = require('./value');

  function getHashURL() {
    var hash = window.location.pathname;
    hash = hash.match(/\/(\w*)\//);
    return hash[1];
  }

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
  window.Buffer = Buffer;
  window.UInt8ArrayToBuffer = UInt8ArrayToBuffer;
  window.getHashURL = getHashURL;

  window.api = window.parent.api;

  Async.map($('img').makeArray(), function(img, cb) {
    img = $(img);
    window.parent.getResponseByPath(img.attr('src'), function(err, data) {
      if (err) {
        console.warn(err);
      } else {
        var content = data.content;
        assert(content instanceof Buffer);
        var src = 'data:' + contentType + ';base64,' + content.toString('base64');
        img.attr('src', src);
      }
      cb();
    });
  }, function() {
  });
})();
