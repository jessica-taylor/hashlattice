var assert = require('assert');

var wait = require('wait.for');

var Mininet = require('../lib/mininet');


describe('Mininet', function() {
  var mn = new Mininet();
  after(function() {
    mn.close();
  });
  it('should allow running commands on both hosts', function(done) {
    this.timeout(4000);
    var stream1 = mn.runCommand(1, 'bash -c "sleep 0.1; echo hi"');
    var stream2 = mn.runCommand(2, 'echo hello');
    var oneDone = false;
    stream2.on('data', function(chunk) {
      assert.equal('hello\n', chunk.toString('utf8'));
      assert.equal(null, stream1.read());
      if (oneDone) {
        done();
      } else {
        oneDone = true;
      }
    });
    stream1.on('data', function(chunk) {
      assert.equal('hi\n', chunk.toString('utf8'));
      if (oneDone) {
        done();
      } else {
        oneDone = true;
      }
    });
  });
});
