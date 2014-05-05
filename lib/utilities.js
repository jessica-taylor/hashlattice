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

module.exports = {
  readAllFromStream: readAllFromStream
};
