/**
 * Different types of value.
 */

var typeList = ['null', 'boolean', 'double', 'string', 'buffer', 'array', 'object', 'function'];

var _typeToIndex = {};
for (var i = 0; i < typeList.length; i++) {
  _typeToIndex[typeList[i]] = i;
}

function typeToIndex(type) {
  return _typeToIndex[type];
}

function valueType(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value == 'boolean') {
    return 'boolean';
  }
  if (typeof value == 'string') {
    return 'string';
  }
  if (typeof value == 'number') {
    return 'double';
  }
  if (typeof value == 'function') {
    return 'function';
  }
  if (typeof value == 'object') {
    if (Array.isArray(value)) {
      return 'array'
    } else if (Buffer.isBuffer(value)) {
      return 'buffer';
    } else {
      return 'object';
    }
  }
  return null;
}

module.exports = {
  typeList: typeList,
  typeToIndex: typeToIndex,
  valueType: valueType
};
