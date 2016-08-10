var Value = require('./value');

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


function when(condition, callback) {
  if (condition()) {
    callback();
  } else {
    setTimeout(function() { when(condition, callback); }, 30);
  }
}

function inBrowser() {
  return Boolean((function() { return this && this.window; })());
}


module.exports = {
  readAllFromStream: readAllFromStream,
  when: when,
  inBrowser: inBrowser
};
