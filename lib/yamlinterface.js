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
          self.pageContents['index.html'] = '|\n' + indexHtmlData;
        }
      });
    } else {
      self.pageContents[fileStats.name] = '!includeBinary ' + fileStats.name;
    }
  });
  walker.on('end', function () {
    // aggregate together final YAML data, pass to cb
    var yamlData = '';
    for (var filename in self.pageContents) {
      if (self.pageContents.hasOwnProperty(filename)) {
        yamlData += '\t\t';
        yamlData += filename + ': |\n';
        yamlData += '\t\t\tcontent: \n' + self.pageContents[filename] + '\n';
        yamlData += '\t\t\theader: ' + self.getHeader(filename) + '\n';
      }
    }
    cb (self.walkerErrs, self.yamlDataHdr + yamlData + self.getCode());
  });
}

module.exports = {
  YamlInterface: YamlInterface
};
