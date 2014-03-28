/**
 * Facilities for working with values.
 */

var Crypto = require('crypto');
var assert = require('better-assert');

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
