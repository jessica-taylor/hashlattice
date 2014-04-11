/**
 * Convert data values to/from YAML.
 */

var Async = require('async');
var JsYaml = require('js-yaml');
var _ = require('underscore');

var Value = require('./value');

// We need 4 custom types:
// !includeYaml foo.yaml -- include a YAML file.  Directory is relative to this file.
// !includeBinary foo.png -- include a binary file.
// !hashYaml foo.yaml -- hash of a YAML file.
// !hashBinary foo.png -- hash of a binary file.

// schema with JSON + binary

// Reference to a file.  This can be embedded in YAML.
// fn: 'include' to represent the data of the file, or 'hash' to represent its
//     hash.
// datatype: 'yaml' or 'binary'
// filename: name of the file
function FileRef(fn, datatype, filename) {
  this.fn = fn;
  this.datatype = datatype;
  this.filename = filename;
};

// Maps a function over file references in the data.  That is, the function is
// called with all file references, and these references are replaced with the
// function return value (non-destructively).
function mapOverFileRefs(data, fn) {
  if (data instanceof FileRef) {
    return fn(data);
  } else {
    switch (Value.valueType(data)) {
      case 'array':
      case 'dict':
        return _.map(data, function(x) {
          return mapOverFileRefs(x, fn);
        });
      default:
        return data;
    }
  }
};

// Creates a YAML schema type for a given function and datatype.
function createType(fn, datatype) {
  var self = this;
  var map = self[datatype + 'Map'];
  var name = '!' + fn + datatype.charAt(0).toUpperCase() + datatype.slice(1);
  return new JsYaml.Type(name, {
    loadKind: 'string',
    loadResolver: function(state) {
      var filename = state.result;
      state.result = new FileRef(fn, datatype, filename);
      return true;
    }
  });
};

// YAML schema used for YAML files containing file references.
var fileRefSchema = JsYaml.Schema.create(
    [JsYaml.JSON_SCHEMA],
    [JsYaml.type.binary, 
     createType('inculde', 'yaml'), createType('include', 'binary'),
     createType('hash', 'yaml'), createType('hash', 'binary')]);

// Reads YAML and handles file references.
function YamlReader() {
  // Maps from data type + file name to file data.
  this.maps = {yaml: {}, binary: {}};
  // Maps from data type + file name to boolean of whether or not this file
  // currently being loaded.  This can detect circular dependencies.
  this.loading = {yaml: {}, binary: {}};
}

YamlReader.prototype.load = function(datatype, filename, callback) {
  var self = this;
  // TODO: check filename?
  if (!(filename in self.maps[datatype])) {
    fs.readFile(filename, function(err, contents) {
      // TODO: handle binary
      if (err) {
        callback(err);
      } else {
        var dataWithFileRefs = JsYaml.safeLoad(contents, {schema: fileRefSchema});
        var fileRefs = [];
        mapOverFileRefs(dataWithFileRefs, function(fref) {
          fileRefs.push(fref);
          return fref;
        });
        if (_.some(fileRefs, function(fref) {
          return self.loading[fref.datatype][fref.filename];
        }) {
          callback('circular dependency');
        } else {
          self.loading[datatype][filename] = true;
          Async.map(fileRefs, function(fref, cb) {
            self.load(fref.datatype, fref.filename, cb);
          }, function(err) {
            if (err) {
              callback(err);
            } else {
              var dataSubstituted = mapOverFileRefs(dataWithFileRefs, function(fref) {
                return self.runFunction(fref.fn, self.maps[fref.datatype][fref.filename]);
              });
              self.loading[datatype][filename] = false;
              self.maps[datatype][filename] = dataSubstituted;
              callback(null);
            }
          });
        }
      }
    });
  }
};

YamlReader.prototype.runFunction = function(fn, data) {
  if (fn == 'include') {
    return data;
  } else {
    return Value.hashData(data);
  }
};

YamlReader.prototype.evalFileRef = function(fref, callback) {
  var self = this;
  self.load(fref.datatype, fref.filename, function(err, data) {
    if (err) {
      callback(err);
    } else {
      callback(null, self.runFunction(fref.fn, data));
    }
  });
};

function loadYamlFile(filename, callback) {
  var reader = new YamlReader();
  reader.evalFileRef(new FileRef('include', 'yaml', filename), callback);
}

// minimal schema for reading/writing from strings, with no file references
var minimalSchema = JsYaml.Schema.create(
    [JsYaml.JSON_SCHEMA],
    [JsYaml.type.binary]);

function yamlToData(yaml) {
  return JsYaml.safeLoad(yaml, {schema: minimialSchema});
}

function dataToYaml(data) {
  return JsYaml.safeDump(data, {schema: minimalSchema});
}

module.exports = {
  loadYamlFile: loadYamlFile,
  yamlToData: yamlToData,
  dataToYaml: dataToYaml
};
