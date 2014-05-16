var mime = require('mime');
var Walk = require('walk');
var Fs = require('fs');

var Path = require('path');

// Returns the appropriate HTTP header to add to the file based on its
// path, including the extension.
function getHeader(path) {
  return '{"Content-Type": "' + mime.lookup(path) + '"}';
};

function getCode() {
  // TODO How should we get the API?
  var code = 'code: \'function(hl) {' +
    'var path = hl.path;' +
    'if (path.length >= 1 && path.charAt(0) == "/") path = path.substring(1);' +
    'return {' + 
    'headers:pages[path].headers,' +
    'content:new Buffer(pages[path].content, "utf8"),'+
    'api:{}' +
    '};' +
    '}\'';
  return code;
}

function toYaml(directory, cb) {
  // pageContents maps from file names to the string 
  //      '!includeBinary <path_to_file>'
  //      where '<path_to_file>' is relative to root directory of web page
  var pageContents = {};

  var yamlDataHdr = 'data:\n\tpages:\n';

  var fileNames = walk(directory);
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
      yamlData += '\t\t\theader: ' + getHeader(filename) + '\n';
    }
  }

  cb(null, yamlDataHdr + yamlData + getCode());
}

// From
// http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
// Reads a directory and returns a list of files in that directory.
function walk(basedir, reldir) {
  reldir = reldir || '';
  var results = [];
  var dir = Path.join(basedir, reldir);
  var list = Fs.readdirSync(dir);
  list.forEach(function(file) {
    var relfile = Path.join(reldir, file);
    var fullpath = Path.join(dir, file);
    var stat = Fs.statSync(fullpath);
    if (stat && stat.isDirectory()) results = results.concat(walk(basedir, relfile));
    else results.push(relfile);
  });
  return results;
}

module.exports = {
  toYaml: toYaml
};
