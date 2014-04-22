var assert = require('assert');

var Mininet = require('../lib/mininet');


describe('Network', function() {
  it('should allow getting put values from other nodes', function(done) {
    this.timeout(4000);
    var mininet = new Mininet();
    var didOne = false;
    function completeOne() {
      if (didOne) {
        mininet.close();
        done();
      } else {
        didOne = true;
      }
    }
    mininet.runCommand(1, 'node ./sutest/networkNode first').on('data', function(chunk) {
      console.log('got 1', chunk.toString('utf8'));
      assert.equal('done\n', chunk.toString('utf8'));
      console.log('finished first');
      completeOne();
    });
    mininet.runCommand(2, 'node ./sutest/networkNode second').on('data', function(chunk) {
      console.log('got 2', chunk.toString('utf8'));
      assert.equal('done\n', chunk.toString('utf8'));
      console.log('finished second');
      completeOne();
    });
  });
});

