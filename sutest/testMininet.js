var assert = require('assert');

var wait = require('wait.for');

var Mininet = require('../lib/mininet');


describe('Mininet', function() {
  it('should allow running commands on both hosts', function(done) {
    this.timeout(4000);
    var mn = new Mininet();
    console.log('got mn');
    var stream1 = mn.runCommand(1, 'bash -c "sleep 0.1; echo hi"');
    var stream2 = mn.runCommand(2, 'echo hello');
    var oneDone = false;
    stream2.on('readable', function() {
      console.log('read2');
      assert.equal('hello', stream2.read());
      assert.equal(null, stream1.read());
      if (oneDone) {
        done();
      } else {
        oneDone = true;
      }
    });
    stream1.on('readable', function() {
      console.log('read1');
      assert.equal('hi', stream1.read());
      if (oneDone) {
        done();
      } else {
        oneDone = true;
      }
    });
  });

});
