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
    return postVerifier.verify(Ursa.createPublicKey(publicKey, 'base64'), post.signature);
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

function datedPostValue(privateKey, timestamp, value) {
  var post = {
    timestamp: timestamp,
    value: value
  };
  var postSigner = Ursa.createSigner('sha256');
  postSigner.update(Value.encodeValue(post));
  post.signature = postSigner.sign(Ursa.createPrivateKey(privateKey, '', 'base64'));
  return post;
};

function genKeyPair() {
  var keys = Ursa.generatePrivateKey();
  var privateKey = keys.toPrivatePem('base64');
  var publicKey = keys.toPublicPem('base64');
  return {public: publicKey, private: privateKey};
};


module.exports = {
  makeDatedPost: makeDatedPost,
  datedPostValue: datedPostValue,
  genKeyPair: genKeyPair,
  value: Value
};