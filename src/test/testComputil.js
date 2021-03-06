/*
 * TODO actually make this a test
 
// Input: validity -- a string consisting solely of the characters V and I
//          (all other characters will be treated as I)
// Output: posts -- an array of dated post objects
//           posts[i] will be properly signed iff validity[i] == 'V'
function makePostsArray(validity, privateKey, publicKey) {
  posts = new Array(validity.length);

  for (var i = 0; i < validity.length; i++) {
    posts[i] = makeDatedPost(publicKey);
    posts[i].value = 'Test post, please ignore ' + i;

    if (validity.charAt(i) == 'V') {
      var postSigner = Ursa.createSigner('sha256');
      postSigner.update(posts[i].value);
      posts[i].signature = postSigner.sign(privateKey);
    }
    else {
      // purposely make signature something invalid
      posts[i].signature = new Buffer([0,0,0,0,0,0,0]);
    }

    posts[i].timestamp = new Date();
  }

  return posts;
}

// actual do some tests
var keys = Ursa.generatePrivateKey();

var privateKey = Ursa.createPrivateKey(keys.toPrivatePem('base64'), '', 'base64');
var publicKey = Ursa.createPublicKey(keys.toPublicPem('base64'), 'base64');

posts = makePostsArray('VVIIVIVVII', privateKey, publicKey);
console.log(posts);

console.log(posts.reduce(function(acc, post, idx, arr) {
  return acc.merge(acc, post);
}));
*/
