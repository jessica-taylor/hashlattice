var assert = require('assert')

var NetUtil = require('../../lib/network/netutil.js')

describe('netutil', function() {
  describe('logDistance', function() {
    it('should return 0 log distance for equal buffers', function() {
      var hash1 = new Buffer(32);
      var hash2 = new Buffer(32);
      hash1.write('1234', null, null, 'hex');
      hash1.fill('0', 2);
      hash2.write('1234', null, null, 'hex');
      hash2.fill('0', 2);
      assert.equal(0, NetUtil.logDistance(hash1, hash2));
    });
    /*it('should return 32 log distance for buffers differing by 4 hex value',
      function() {
        var hash1 = new Buffer(32);
        var hash2 = new Buffer(32);
        hash1.write('1234', null, null, 'hex');
        hash1.fill('0', 2);
        hash2.write('5678', null, null, 'hex');
        hash2.fill('0', 2);
        assert.equal(32, NetUtil.logDistance(hash1, hash2));
      });*/
  });
});
