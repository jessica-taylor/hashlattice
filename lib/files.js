/**
 * Working with locally stored files.
 */
var Fs = require('fs');
var Path = require('path');

// HashLattice files go in ~/.hashlattice
HASHLATTICE_DIR = Path.join(
    process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
    '.hashlattice');

function localPath(file) {
  return Path.join(HASHLATTICE_DIR, file);
}

function relativePath(file1, file2) {
  return Path.join(Path.dirname(file1), file2);
}

module.exports = {
  HASHLATTICE_DIR: HASHLATTICE_DIR,
  localPath: localPath,
  relativePath: relativePath
};
