console.log('WEBLIB LOADED!!!! :D :D :D');
console.log('WEBLIB LOADED!!!! :D :D :D');
console.log('WEBLIB LOADED!!!! :D :D :D');
console.log('WEBLIB LOADED!!!! :D :D :D');
console.log('WEBLIB LOADED!!!! :D :D :D');
console.log('WEBLIB LOADED!!!! :D :D :D');
(function() {
  var assert = require('assert');
  var URL = require('url');
  var Path = require('path');

  var Async = require('async');
  var $ = require('jquery');
  var _ = require('underscore');

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


  var linkTypes = {
    img: {
      attr: 'src',
      defaultContentType: 'image/jpg'
    },
    script: {
      attr: 'src',
      defaultContentType: 'text/javascript'
    },
    link: {
      attr: 'href',
      defaultContentType: 'text/css'
    },
    a: {
      attr: 'href',
      defaultContentType: 'text/html'
    }
  };

  function onLinkInserted(elem) {
    elem = $(elem);
    var tag = elem.prop('nodeName').toLowerCase();
    console.log('tag', tag);
    var options = linkTypes[tag];
    if (!options) return;
    console.log('options', options);
    var attr = options.attr;
    var oldSrc = elem.attr(attr);
    console.log('oldSrc', oldSrc);
    if (oldSrc == undefined) return;
    if (oldSrc == '/weblib.js') return;
    var parse = URL.parse(oldSrc, false, true);
    console.log('parse', parse);
    if (parse.hostname != null && parse.hostname != window.top.location.hostname) return;
    var pathname = Path.resolve(Path.dirname(window.top.location.pathname), oldSrc);
    if (tag == 'a') {
      elem.click(function() {
        window.top.openPath(pathname);
        return false;
      });
      return;
    }
    window.parent.getResponseByPath(pathname, function(err, data) {
      if (err) {
        console.warn(err);
      } else {
        console.log('got', data);
        var content = data.content;
        var contentType = data.headers && data.headers['Content-Type'];
        contentType = contentType || options.defaultContentType;
        if (typeof content == 'string') {
          content = new Buffer(content, 'utf8');
        }
        assert(Buffer.isBuffer(content));
        var src = 'data:' + contentType + ';base64,' + content.toString('base64');
        elem.attr(attr, src);
      }
    });
  }
  $(function() {
    console.log('document ready!');
    $(_.keys(linkTypes).join(',')).each(function(i, el) {
      onLinkInserted(el);
    });
    document.addEventListener('DOMNodeInserted', function (event) {
      onLinkInserted(event.target);
    });
  });
})();
