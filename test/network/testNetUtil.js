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
    it('should return 250 log distance for buffers with 6 bits in common ' +
      'before first difference',
      function() {
        var hash1 = new Buffer(32);
        var hash2 = new Buffer(32);
        hash1.write('0101', null, null, 'hex');
        hash1.fill('0', 2);
        hash2.write('0202', null, null, 'hex');
        hash2.fill('0', 2);
        assert.equal(250, NetUtil.logDistance(hash1, hash2));
      });
    it('should return 256 log difference for buffers that differ at first bit',
        function() {
          var hash1 = new Buffer(32);
          var hash2 = new Buffer(32);
          hash1.write('FF', null, null, 'hex');
          hash2.write('01', null, null, 'hex');
          hash1.fill('0', 1);
          hash2.fill('0', 1);
          assert.equal(256, NetUtil.logDistance(hash1, hash2));
        });
  });
});
