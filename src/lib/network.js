var assert = require('assert');

var Concat = require('concat-stream');
var WebTorrent = require('webtorrent');

var Value = require('./value');


function WebTorrentNode() {
  this.client = new WebTorrent();
}

WebTorrentNode.prototype.getHashData = function(hash, callback) {
  this.client.download({
    infoHash: hash,
    announce: ['wss://tracker.webtorrent.io']
  }, function(torrent) {
    assert.equal(1, torrent.files.length);
    torrent.files[0].createReadStream().pipe(Concat(function(buf) {
      callback(null, Value.decodeValue(buf));
    }));
  });
};

WebTorrentNode.prototype.putHashData = function(data, callback) {
  var input = [{buffer: Value.encodeValue(data)}];
  this.client.seed(input, function(torrent) {
    callback();
  });
};

module.exports = {
  WebTorrentNode: WebTorrentNode
};
