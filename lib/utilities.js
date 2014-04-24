

function readAllFromStream(stream, callback) {
  res.on('data', function(buf) { bufs.push(buf); });
  res.on('end', function() {
    callback(null, Value.decodeValue(Buffer.concat(bufs)));
  });
}

module.exports = {
  readAllFromStream: readAllFromStream
};
