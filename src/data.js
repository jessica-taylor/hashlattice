/**
 * Facilities for working with data values.
 */

var crypto = require('crypto');

/**
 * @typedef BufferReader
 * @type {object}
 * @property {Buffer} buffer The buffer.  Should not be changed.
 * @property {number} pos Current index in the buffer.  Should be incremented
 *                        as data is read.
 */

/**
 * Interface for encoder/decoder for a specific data type.
 * @interface
 */
function DataCoder() {
}

/**
 * Encode a value.
 * @param {*} value Value to encode.
 * @param {Array.<Buffer>} bufs List of buffers to append encoding to.
 */
DataCoder.encode = function(value, bufs) { };

/**
 * Decode a value.
 * @param {BufferReader} reader Reader for the buffer.  Position should be 
 *                              increased appropriately.
 * @return {*} The value read.
 */
DataCoder.decode = function(reader) { };

function encodeWith(coder, value) {
  bufs = [];
  coder.encode(value, bufs);
  return Buffer.concat(bufs);
}

function decodeWith(coder, buf) {
  return coder.decode({buffer: buf, pos: 0});
}

// Coders are monad-like.
function coderSequence(firstCoder, getFirst, secondCoderGetter) {
  return {
    encode: function(value, bufs) {
      var first = getFirst(value);
      firstCoder.encode(first, bufs);
      secondCoderGetter(first).encode(value, bufs);
    },
    decode: function(reader) {
      var first = firstCoder.decode(reader);
      return secondCoderGetter(first).decode(reader);
    }
  };
}


// see http://nodejs.org/api/buffer.html for more types
doubleCoder = numberCoder('DoubleLE');
int32Coder = numberCoder('Int32LE');
uint8Coder = numberCoder('Uint8');

bigSizeCoder = {
  // TODO: big integer stuff
};

// TODO: switch to bigSizeCoder
lengthCoder = int32Coder;

stringCoder = {
  encode: function(str, bufs) {
    var strbuf = new Buffer(str, 'utf-8');
    lengthCoder.encode(strbuf.length, bufs);
    bufs.push(strbuf);
  },
  decode: function(reader) {
    var len = lengthCoder.decode(reader);
    var str = reader.buffer.toString('utf-8', reader.pos);
    reader.pos += len;
    return str;
  }
};

bufferCoder = {
  encode: function(buf, bufs) {
    lengthCoder.encode(buf.length, bufs);
    bufs.push(buf);
  },
  decode: function(reader) {
    var len = lengthCoder.decode(reader);
    var buf = reader.buffer.slice(reader.pos, reader.pos + len);
    reader.pos += len;
    return buf;
  }
};

function arrayCoder(elemCoder) {
  return {
    encode: function(arr, bufs) {
      lengthCoder.encode(arr.length, bufs);
      for (var i = 0; i < arr.length; i++) {
        elemCoder.encode(arr[i], bufs);
      }
    },
    decode: function(reader) {
      var len = lengthCoder.decode(reader);
      var arr = [];
      for (var i = 0; i < len; i++) {
        arr.push(elemCoder.decode(reader));
      }
      return arr;
    }
  };
};

function dictCoder(elemCoder) {
  return {
    encode: function(dict, bufs) {
      var keys = dict.keys();
      keys.sort();
      lengthCoder.encode(keys.length, bufs);
      for (var i = 0; i < keys.length; i++) {
        stringCoder.encode(keys[i], bufs);
        elemCoder.encode(dict[keys[i]], bufs);
      }
    },
    decode: function(reader) {
      var len = lengthCoder.decode(reader);
      var dict = {};
      for (var i = 0; i < len; i++) {
        var key = stringCoder.decode(reader);
        var value = elemCoder.decode(reader);
        dict[key] = value;
      }
      return dict;
    }
  };
};

// Will be set later.
var valueTypeCoders = {};
var valueCoderTypeList = ['double', 'string', 'buffer', 'array', 'dict'];
var valueTypeToIndex = {};
for (var i = 0; i < valueCoderTypeList.length; i++) {
  valueTypeToIndex[valueCoderTypeList[i]] = i;
}

function valueType(value) {
  if (typeof value == 'string') {
    return 'string';
  }
  if (typeof value == 'number') {
    return 'double';
  }
  if (typeof value == 'object') {
    if (Array.isArray(value)) {
      return 'array'
    } else if (Buffer.isBuffer(value)) {
      return 'buffer';
    } else {
      return 'dict';
    }
  }
  throw 'unknown type: ' + value;
}

var valueCoder = {
  encode: function(value, bufs) {
    var type = valueType(value);
    uint8Coder.encode(valueTypeToIndex[type], bufs);
    valueTypeCoders[type].encode(value, bufs);
  },
  decode: function(reader) {
    var typeIndex = uint8Coder.decode(reader);
    var type = valueCoderTypeList[typeIndex];
    return valueTypeCoders[type].decode(reader);
  }
};

valueTypeCoders = {
  'double': doubleCoder,
  'string': stringCoder,
  'buffer': bufferCoder,
  'array': arrayCoder(valueCoder),
  'dict': dictCoder(valueCoder)
};

function encodeData(data) {
  return encodeWith(valueCoder, data);
}

function decodeData(buf) {
  return decodeWith(valueCoder, buf);
}

function hashBytes(buf) {
  var h = crypto.createHash('sha256');
  h.update(buf);
  return new Buffer(h.digest('hex'), 'hex');
}

function hashData(data) {
  return hashBytes(encodeData(data));
}

module.exports = {
  encodeData: encodeData,
  decodeData: decodeData,
  hashBytes: hashBytes,
  hashData: hashData
};
