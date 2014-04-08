/**
 * Facilities for working with values.
 */

var Crypto = require('crypto');
var assert = require('better-assert');
var _ = require('underscore');

var Types = require('./types');
var Encoding = require('./encoding'),
    encodeData = Encoding.encodeData,
    decodeData = Encoding.decodeData;

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
      for (var i = 0, i < data.length; i++) {
        if (!isData(data[i])) return false;
      }
      return true;
    case 'dict':
      for (var key in data) {
        if (!isData(data[key])) return false;
      }
      return true;
    default:
      return false;
  }
}

function valuesEqual(v1, v2) {
  var t1 = Types.valueType(v1), t2 = Types.valueType(t2);
  if (t1 != t2) return false;
  switch (t1) {
    case 'null':
    case 'boolean':
    case 'double':
    case 'string':
      return v1 == v2;
    case 'buffer':
      return v1.toString() == v2.toString();
    case 'array':
      return v1.length == v2.length &&
        _.every(_.zip(v1, v2), function(x1x2) {
          return valuesEqual(x1[0], x2[0]);
        });
    case 'dict':
      var keys1 = _.keys(t1);
      var keys2 = _.keys(t2);
      keys1.sort();
      keys2.sort();
      return keys1 == keys2 && _.every(keys1, function(key) {
        return valuesEqual(v1[key], v2[key]);
      });
  }
  return false;
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
  encodeValue: encodeValue,
  decodeValue: decodeValue,
  hashBytes: hashBytes,
  hashData: hashData
};
