var mime = require('mime');
var Walk = require('walk');
var Fs = require('fs');

function YamlInterface() {
}

// Returns the appropriate HTTP header to add to the file based on its
// path, including the extension.
YamlInterface.prototype.getHeader = function(path) {
  return '{"Content-Type": "' + mime.lookup(path) + '"}';
};

YamlInterface.prototype.getCode = function() {
  var self = this;
  // TODO How should we get the API?
  var code = 'code: |\n\tfunction(hl) {\n' +
    '\t\tvar path = hl.path;\n' +
    '\t\tif (path.length >= 1 && path.charAt(0) == "/") path = path.substring(1);\n' +
    '\t\treturn { headers: pages[path].headers,\n' +
    '\t\t\tcontent: new Buffer(pages[path].content, "utf8"),\n'+
    '\t\t\tapi: {}\n' +
    '\t\t};\n' +
    '\t}';
  return code;
}

YamlInterface.prototype.toYaml = function(directory, cb) {
  // pageContents maps from file names to the string 
  //      '!includeBinary <path_to_file>'
  //      where '<path_to_file>' is relative to root directory of web page
  var self = this;
  var pageContents = {};

  var yamlDataHdr = 'data:\n\tpages:\n';

  var fileNames = self.walk(directory);
  var pageContents = {}

  for (var i = 0; i < fileNames.length; i++) {
    pageContents[fileNames[i]] = '!includeBinary ' + fileNames[i];
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
YamlInterface.prototype.walk = function(basedir, reldir) {
  var self = this;
  reldir = reldir || '';
  var results = [];
  var dir = Path.join(basedir, reldir);
  var list = Fs.readdirSync(dir);
  list.forEach(function(file) {
    var relfile = Path.join(reldir, file);
    var fullpath = Path.join(dir, file);
    var stat = Fs.statSync(fullpath);
    if (stat && stat.isDirectory()) results = results.concat(self.walk(basedir, relfile));
    else results.push(relfile);
  });
  return results;
}

module.exports = {
  YamlInterface: YamlInterface
};
