var mime = require('mime');
var Walk = require('walk');
var Fs = require('fs');

function YamlInterface() {
}

// Returns the appropriate HTTP header to add to the file based on its
// path, including the extension.
YamlInterface.prototype.getHeader = function(path) {
  return 'Content-Type: ' + mime.lookup(path);
};

YamlInterface.prototype.getCode = function() {
  var self = this;
  // TODO How should we get the API?
  var code = 'code: |\n\tfunction(hl) {\n' +
    '\t\tvar path = hl[path];\n' +
    '\t\treturn { headers: pages[path][headers],\n' +
    '\t\t\tcontent: new Buffer(pages[path][content], "utf8"),\n'+
    '\t\t\tapi: {}\n' +
    '\t\t};\n' +
    '\t}';
  return code;
}

YamlInterface.prototype.toYaml = function(directory, cb) {
  // pageContents maps from file names to either
  //  1. HTML contents of web page (if file name is 'index.html')
  //  2. the string '!includeBinary <path_to_file>'
  //      where '<path_to_file>' is relative to root directory of web page
  //      (if file name is not 'index.html')
  var self = this;
  var pageContents = {};

  var yamlDataHdr = 'data:\n\tpages:\n';

  var fileNames = self.walk(directory);
  var pageContents = {}

  for (var i = 0; i < fileNames.length; i++) {
    if (fileNames[i].length >= 10 && fileNames[i].slice(-10) == 'index.html') {
      pageContents[fileNames[i]] = ' |\n\t\t\t' +
        Fs.readFileSync(fileNames[i], 'utf8').split('\n').join('\n\t\t\t');
    } else {
      pageContents[fileNames[i]] = '!includeBinary ' + fileNames[i];
    }
  }

  var yamlData = ''; 
  for (var filename in pageContents) {
    if (pageContents.hasOwnProperty(filename)) {
      yamlData += '\t\t';
      yamlData += filename + ': \n';
      yamlData += '\t\t\tcontent: ' + pageContents[filename] + '\n';
      yamlData += '\t\t\theader: ' + self.getHeader(filename) + '\n';
    }
  }

  cb(null, yamlDataHdr + yamlData + self.getCode());
}

// From
// http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
// Reads a directory and returns a list of files in that directory.
YamlInterface.prototype.walk = function(dir) {
  var self = this;
  var results = [];
  var list = Fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file
    var stat = Fs.statSync(file)
    if (stat && stat.isDirectory()) results = results.concat(self.walk(file));
    else results.push(file);
  });
  return results;
}

module.exports = {
  YamlInterface: YamlInterface
};
