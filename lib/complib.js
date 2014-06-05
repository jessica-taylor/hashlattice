try {
  var require2 = require;
  Ursa = require2('ursa');
} catch (ex) {
  // TODO: WebCrypto
}

var Value = require('./value');
var _ = require('underscore')

function makeDatedPost(publicKey) {
  function isValid(post) {
    if (post === null || typeof post != 'object') {
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


// TODO : is all of this friends list stuff right? I copied the dated post
// stuff from above (roughly), but without authentication.

function makeSet() {
  function setUnion(friendsListA, friendsListB) {
    return _.union(friendsListA, friendsListB);
  }
  return {
    defaultValue: function() { return []; },
    merge: setUnion
  };
}

module.exports = {
  makeDatedPost: makeDatedPost,
  datedPostValue: datedPostValue,
  genKeyPair: genKeyPair,
  value: Value, // ashwins1: why do we do this?
  makeSet: makeSet
};
