var mime = require('mime');

// Returns the appropriate HTTP header to add to the file based on its
// path, including the extension.
YamlInterface.prototype.getHeader = function(path) {
  return 'Content-Type: ' + mime.lookup(path);
}

YamlInterface.prototype.getCode = function() {
  var self = this;
  // TODO How should we get the API?
  var code = 'code: |\n\tfunction(hl) {\n' +
    '\t\tvar path = hl[path];\n' +
    '\t\treturn { headers: pages[path][headers],\n' +
    '\t\t\tcontent: new Buffer(pages[path][content], "utf8"),\n'+
    '\t\t\tapi: {}\n' +
    '};\n' +
    '}';
  return code;
}
