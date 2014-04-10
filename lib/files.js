/**
 * Working with locally stored files.
 */
var Fs = require('fs');
var Path = require('path');

// HashLattice files go in ~/.hashlattice
HASHLATTICE_DIR = Path.join(
    process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
    '.hashlattice');

function localFilePath(file) {
  return Path.join(HASHLATTICE_DIR, file);
}
