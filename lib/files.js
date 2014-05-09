/**
 * Working with locally stored files.
 */
var Fs = require('fs');
var Path = require('path');

var Value = require('./value');

// HashLattice files go in ~/.hashlattice
HASHLATTICE_DIR = Path.join(
    process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
    '.hashlattice');

var CONFIG_NAME = 'config.yaml';

function localPath(file) {
  return Path.join(HASHLATTICE_DIR, file);
}

function relativePath(file1, file2) {
  return Path.join(Path.dirname(file1), file2);
}

function loadConfig(dir, callback) {
  dir = dir || HASHLATTICE_DIR;
  fs.readFile(dir, function(err, data) {
    if (err) {
      callback(err);
    } else {
      // TODO
    }
  });
}

module.exports = {
  HASHLATTICE_DIR: HASHLATTICE_DIR,
  localPath: localPath,
  relativePath: relativePath
};
