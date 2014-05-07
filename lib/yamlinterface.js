var mime = require('mime');

// Returns the appropriate HTTP header to add to the file based on its
// path, including the extension.
YamlInterface.prototype.getHeader = function(path) {
  return 'Content-Type: ' + mime.lookup(path);
}
