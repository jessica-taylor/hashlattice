var Ursa = require('ursa'); // TODO : is there another library for generating RSA key pairs?

var Value = require('./value');

function makeDatedPost(publicKey) {
  function isValid(post) {
    if (typeof post != 'object') {
      return false;
    }
    if (typeof post.timestamp != 'number') {
      return false;
    }
    var postVerifier = Ursa.createVerifier('sha256');
    postVerifier.update(Value.encodeValue({
      timestamp: post.timestamp,
      value: post.value
    }));
    return postVerifier.verify(publicKey, post.signature);
  }
  function mergeFn(postA, postB) {
    if (isValid(postA)) {
      if (isValid(postB)) {
        return postA.timestamp >= postB.timestamp ? postA : postB;
      } else {
        return postA;
      }
    } else {
      if (isValid(postB)) {
        return postB;
      } else {
        return null;
      }
    }
  }
  return {
    defaultValue: function() { return null; },
    merge: mergeFn
  };
}

module.exports = {
  makeDatedPost: makeDatedPost
};
