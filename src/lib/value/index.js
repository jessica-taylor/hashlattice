/**
 * Facilities for working with values.
 */

var Crypto = require('crypto');
var assert = require('assert');
var U = require('underscore');

var Types = require('./types');
var Encoding = require('./encoding'),
    encodeValue = Encoding.encodeValue,
    decodeValue = Encoding.decodeValue;

function isData(data) {
  var type = Types.valueType(data);
  switch (type) {
    case 'null':
    case 'boolean':
    case 'double':
    case 'string':
    case 'buffer':
      return true;
    case 'array':
      for (var i = 0; i < data.length; i++) {
        if (!isData(data[i])) return false;
      }
      return true;
    case 'object':
      U.each(Types.getObjectKeys(data), function(key) {
        if (!isData(data[key])) return false;
      });
      return true;
    default:
      return false;
  }
}

function valuesEqual(v1, v2) {
  var t1 = Types.valueType(v1), t2 = Types.valueType(v2);
  if (t1 != t2) return false;
  switch (t1) {
    case 'null':
    case 'boolean':
    case 'double':
    case 'string':
      return v1 == v2;
    case 'buffer':
      return v1.toString('hex') == v2.toString('hex');
    case 'array':
      return v1.length == v2.length &&
        U.every(U.zip(v1, v2), function(x1x2) {
          return valuesEqual(x1x2[0], x1x2[1]);
        });
    case 'object':
      var keys1 = Types.getObjectKeys(v1);
      var keys2 = Types.getObjectKeys(v2);
      keys1.sort();
      keys2.sort();
      return valuesEqual(keys1, keys2) && U.every(keys1, function(key) {
        return valuesEqual(v1[key], v2[key]);
      });
  }
  return false;
}

function map(value, fn) {
  return fn(value, function() {
    switch (Types.valueType(value)) {
      case 'array':
        return U.map(value, function(x) {
          return map(x, fn);
        });
      case 'object':
        var result = {};
        U.each(Types.getObjectKeys(value), function(k) {
          result[k] = map(value[k], fn);
        });
        return result;
      default:
        return value;
    }
  });
}

function hashBytes(buf) {
  var h = Crypto.createHash('sha256');
  h.update(buf);
  return new Buffer(h.digest('hex'), 'hex');
}

function hashData(data) {
  return hashBytes(encodeValue(data));
}

module.exports = {
  valueType: Types.valueType,
  isData: isData,
  valuesEqual: valuesEqual,
  map: map,
  encodeValue: encodeValue,
  decodeValue: decodeValue,
  hashBytes: hashBytes,
  hashData: hashData
};
