/**
 * Convert data values to/from YAML.
 */

var assert = require('assert');
var Util = require('util');
var fs = require('fs');

var Async = require('async');
var JsYaml = require('js-yaml');
var _ = require('underscore');

var Files = require('./files');
var U = require('./utilities');
var Value = require('./value');

// We need 4 custom types:
// !includeYaml foo.yaml -- include a YAML file.  Directory is relative to this file.
// !includeBinary foo.png -- include a binary file.
// !hashYaml foo.yaml -- hash of a YAML file.
// !hashBinary foo.png -- hash of a binary file.

// Reference to a file.  This can be embedded in YAML.
// fn: 'include' to represent the data of the file, or 'hash' to represent its
//     hash.
// datatype: 'yaml' or 'binary'
// filename: name of the file
class FileRef {
  constructor(fn, datatype, filename) {
    this.fn = fn;
    this.datatype = datatype;
    this.filename = filename;
  }
}

// Maps a function over file references in the data.  That is, the function is
// called with all file references, and these references are replaced with the
// function return value (non-destructively).
function mapOverFileRefs(data, fn) {
  return Value.map(data, function(v, recurse) {
    if (v instanceof FileRef) {
      return fn(v);
    } else {
      return recurse();
    }
  });
};

// Creates a YAML schema type for a FileRef with a given function and datatype.
function createFileRefType(name, fn, datatype) {
  // e.g. !includeYaml
  return new JsYaml.Type(name, {
    loadKind: 'scalar',
    loadResolver: function(state) {
      // actual representation is as a FileRef
      var filename = state.result;
      state.result = new FileRef(fn, datatype, filename);
      return true;
    },
    dumpInstanceOf: FileRef,
    dumpPredicate: function(fref) {
      return fref.fn == fn && fref.datatype == datatype;
    },
    dumpRepresenter: function(fref) {
      return fref.filename;
    }
  });
};

// YAML binary type
var BINARY_TYPE =
  JsYaml.DEFAULT_SAFE_SCHEMA.compiledTypeMap['tag:yaml.org,2002:binary']

// YAML schema used for YAML files containing file references.
var fileRefSchema = JsYaml.Schema.create(
    [JsYaml.JSON_SCHEMA],
    [BINARY_TYPE, 
     createFileRefType('!includeYaml', 'include', 'yaml'),
     createFileRefType('!includeBinary', 'include', 'binary'),
     createFileRefType('!hashYaml', 'hash', 'yaml'), 
     createFileRefType('!hashBinary', 'hash', 'binary')]);

// Reads YAML and handles file references.
class YamlReader {
  constructor() {
    // Maps from data type + file name to file data.
    this.dataMap = {yaml: {}, binary: {}};
    // Maps from data type + file name to boolean of whether or not this file
    // currently being loaded.  This can detect circular dependencies.
    this.loading = {yaml: {}, binary: {}};
  }

  // Loads a given file as data into this.dataMap.
  async load(datatype, filename) {
    if (filename in this.dataMap[datatype]) return;
    var encoding = datatype == 'yaml' ? 'utf8' : undefined;
    var contents = await U.cbpromise(fs.readFile, filename, {encoding: encoding});
    // Contents is a string if YAML, Buffer if binary.
    if (datatype == 'binary') {
      // For binary files, the data is just the binary file contents.
      this.dataMap[datatype][filename] = contents;
    } else {
      // For YAML, first parse the file into data with file refs.
      var dataWithFileRefs = JsYaml.safeLoad(contents, {schema: fileRefSchema});
      // Extract file references.
      var fileRefs = [];
      mapOverFileRefs(dataWithFileRefs, function(fref) {
        fileRefs.push(fref);
        return fref;
      });
      // If any of these is currently loading, this indicates a circular
      // dependency.
      // Interpret file paths relative to this yaml file's directory.
      if (_.some(fileRefs, fref => this.loading[fref.datatype][Files.relativePath(filename, fref.filename)])) {
        throw 'circular dependency';
      } else {
        this.loading[datatype][filename] = true;
        // Note lack of parallelism.  This prevents the system from detecting
        // spurious circular dependencies.
        for (const fref of fileRefs) {
          await this.load(fref.datatype, Files.relativePath(filename, fref.filename));
        }
        // Replace file references with data/hashes.
        var dataSubstituted = mapOverFileRefs(dataWithFileRefs, fref =>
          this.runFunction(fref.fn, this.dataMap[fref.datatype][Files.relativePath(filename, fref.filename)]));
        this.loading[datatype][filename] = false;
        this.dataMap[datatype][filename] = dataSubstituted;
      }
    }
  }

  // Applies a function ('include' or 'hash') to data.
  runFunction(fn, data) {
    if (fn == 'include') {
      return data;
    } else {
      assert(fn == 'hash');
      return Value.hashData(data);
    }
  }

  // Evaluates a file reference, applying its function to its data.
  async evalFileRef(fref) {
    await this.load(fref.datatype, fref.filename);
    return await this.runFunction(fref.fn, this.dataMap[fref.datatype][fref.filename]);
  }
}

// Loads the data in a YAML file, allowing it to refer to other files.
async function loadYamlFile(filename) {
  var reader = new YamlReader();
  return await reader.evalFileRef(new FileRef('include', 'yaml', filename));
}

// minimal schema for reading/writing from strings, with no file references
// JSON + binary
var minimalSchema = JsYaml.Schema.create(
    [JsYaml.JSON_SCHEMA],
    [BINARY_TYPE]);

// Converts a YAML string to data.
function yamlToData(yaml) {
  return JsYaml.safeLoad(yaml, {schema: fileRefSchema});
}

// Converts data to a YAML string.
function dataToYaml(data) {
  return JsYaml.safeDump(data, {schema: fileRefSchema});
}

module.exports = {
  FileRef: FileRef,
  loadYamlFile: loadYamlFile,
  yamlToData: yamlToData,
  dataToYaml: dataToYaml
};
