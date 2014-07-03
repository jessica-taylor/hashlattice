var Value = require('./value');

function readAllFromStream(stream, callback) {
  var bufs = [];
  stream.on('data', function(buf) { 
    bufs.push(buf); 
  });
  stream.on('end', function() {
    callback(null, Buffer.concat(bufs));
  });
}

function when(condition, body) {
  if (condition()) {
    body();
  } else {
    setTimeout(function() { when(condition, body); }, 30);
  }
}

function inBrowser() {
  return Boolean((function() { return this.window; })());
}

module.exports = {
  readAllFromStream: readAllFromStream,
  when: when,
  inBrowser: inBrowser
};
