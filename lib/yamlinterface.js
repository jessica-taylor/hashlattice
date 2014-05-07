var mime = require('mime');
var Walk = require('walk');
var Fs = require('fs');

function YamlInterface() {
}

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

YamlInterface.prototype.toYaml = function(directory, cb) {
  var self = this;

  // maps from file names to either
  //  1. HTML contents of web page (if file name is 'index.html')
  //  2. the string '!includeBinary <path_to_file>'
  //      where '<path_to_file>' is relative to root directory of web page
  //      (if file name is not 'index.html')
  var pageContents = {};
  var walkerErrs = null;

  var yamlDataHdr = 'data:\n\tpages:\n';

  var htmlDirectoryWalker = Walk.walk(directory);
  walker.on('file', function (root, fileStats) {
    // FIXME : does fileStats.name give an absolute or relative name?
    // in the following, I assume relative to the directory argument
    // passed to Walk.walk above. Please correct if necessary.
    if (fileStats.name === 'index.html') {
      fs.readFile(fileStats.name, function (err, indexHtmlData) {
        if (err) {
          walkerErrs = err;
        } else {
          self.pageContents['index.html'] = indexHtmlData;
        }
      });
    } else {
      self.pageContents[fileStats.name] = '!includeBinary ' + fileStats.name;
    }
  });
  walker.on('end', function () {
    // aggregate together final YAML data, pass to cb
    yamlData = '';
    for (var filename in pageContents) {
      if (pageContents.hasOwnProperty(filename)) {
        yamlData += '\t\t';
        yamlData += filename + ': |\n';
        yamlData += '\t\t\t' + pageContents[filename];
        yamlData += '\n';
      }
    }
    cb (walkerErrs, yamlDataHdr + yamlData + self.getCode());
  });
}

module.exports = {
  YamlInterface: YamlInterface
};
