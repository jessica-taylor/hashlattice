var mime = require('mime');
var Walk = require('walk');
var Fs = require('fs');

function YamlInterface() {
  var self = this;
}

// Returns the appropriate HTTP header to add to the file based on its
// path, including the extension.
YamlInterface.prototype.getHeader = function(path) {
  return 'Content-Type: ' + mime.lookup(path);
};

YamlInterface.prototype.getCode = function() {
  return '';
};


YamlInterface.prototype.toYaml = function(directory, cb) {
  // pageContents maps from file names to either
  //  1. HTML contents of web page (if file name is 'index.html')
  //  2. the string '!includeBinary <path_to_file>'
  //      where '<path_to_file>' is relative to root directory of web page
  //      (if file name is not 'index.html')
  var pageContents = {};
  var walkerErrs = null;

  var yamlDataHdr = 'data:\n\tpages:\n';

  var htmlDirectoryWalker = Walk.walk(directory);
  htmlDirectoryWalker.on('file', function (root, fileStats, next) {
    // FIXME : does fileStats.name give an absolute or relative name?
    // in the following, I assume relative to the directory argument
    // passed to Walk.walk above. Please correct if necessary.
    console.warn('visiting file ' + fileStats.name);

    if (fileStats.name === 'index.html') {
      fs.readFile(fileStats.name, function (err, indexHtmlData) {
        if (err) {
          walkerErrs = err;
        } else {
          pageContents['index.html'] = '|\n' + indexHtmlData;
        }
        next();
      });
    } else {
      pageContents[fileStats.name] = '!includeBinary ' + root + '/' + fileStats.name;
    }

    next();
  });
  htmlDirectoryWalker.on('end', function () {
    console.warn('The walk is over! Aggregating YAML data ...');

    // aggregate together final YAML data, pass to cb
    var yamlData = '';
    for (var filename in pageContents) {
      if (pageContents.hasOwnProperty(filename)) {
        yamlData += '\t\t';
        yamlData += filename + ': \n';
        yamlData += '\t\t\tcontent: \n' + pageContents[filename] + '\n';
        yamlData += '\t\t\theader: ' + self.getHeader(filename) + '\n';
      }
    }
    cb (walkerErrs, yamlDataHdr + yamlData + self.getCode());
  });
  // TODO : allow recursive entry into subdirectories
}

module.exports = {
  YamlInterface: YamlInterface
};
