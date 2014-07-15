var Value = require('./value');
var U = require('underscore');

var Nacl = require('js-nacl').instantiate();


function makeDatedPost(publicKey) {
  function isValid(post) {
    if (post === null || typeof post != 'object') {
      return false;
    }
    if (typeof post.timestamp != 'number') {
      return false;
    }
    
    var postVerifying = {value: post.value, timestamp: post.timestamp};
    var binPostVerifying = new Uint8Array(Value.encodeValue(postVerifying));
    var binSignature = Nacl.from_hex(post.signature);
    var binPublicKey = Nacl.from_hex(publicKey);
    return Nacl.crypto_sign_verify_detached(binSignature, binPostVerifying,
        binPublicKey);
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
  var binPost = new Uint8Array(Value.encodeValue(post)); 
  var binSignature = Nacl.crypto_sign_detached(binPost,
      Nacl.from_hex(privateKey));
  post.signature = Nacl.to_hex(binSignature);
  //post.signature = privateKey;
  return post;
};

function genKeyPair() {
  return {public: '' + Math.random(), private: '' + Math.random()};
};


// TODO : is all of this friends list stuff right? I copied the dated post
// stuff from above (roughly), but without authentication.

function makeSet() {
  function setUnion(friendsListA, friendsListB) {
    return U.union(friendsListA, friendsListB);
  }
  return {
    defaultValue: function() { return []; },
    merge: setUnion
  };
}

function makeDatedPostList(publicKey) {
  function mergeFn(postListA, postListB) {
    return U.sortBy(U.uniq(postListA.concat(postListB), false,
          function(post) { return Value.encodeValue(post).toString('hex'); }),
        function(post) { return -post.timestamp; });
  }

  return {
    defaultValue: function() { return []; },
    merge: mergeFn
  }
}

module.exports = {
  makeDatedPost: makeDatedPost,
  datedPostValue: datedPostValue,
  genKeyPair: genKeyPair,
  value: Value, // ashwins1: why do we do this?
  makeSet: makeSet,
  makeDatedPostList: makeDatedPostList
};
