var _ = require('underscore');
var U = require('../globalUtil');

function readAllFromStream(stream) {
  return new Promise(function(resolve, reject) {
    var bufs = [];
    stream.on('data', function(buf) {
      bufs.push(buf);
    });
    stream.on('end', function() {
      resolve(Buffer.concat(bufs));
    });
  });
}

function inBrowser() {
  return Boolean((function() { return this && this.window; })());
}

module.exports = {
  readAllFromStream: readAllFromStream,
  inBrowser: inBrowser
};

_.extend(module.exports, U);
