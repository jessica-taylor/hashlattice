/**
 * Facilities for binary encoding values.
 */

var assert = require('assert');
var Util = require('util');

var _ = require('underscore');

var Types = require('./types')

/**
 * @typedef BufferReader
 * @type {object}
 * @property {Buffer} buffer The buffer.  Should not be changed.
 * @property {number} pos Current index in the buffer.  Should be incremented
 *                        as data is read.
 */

/**
 * The interface for data coders can be described as follows:
 * encode: function(value: *, bufs: [Buffer])
 *   Encodes a value and adds its data, as some number of buffers, to the bufs
 *   list.
 * decode: function(reader: BufferReader): *
 *   Reads a value from the BufferReader, incrementing its pos appropriately
 *   to skip over all read bytes.  Returns the value read.
 */

function encodeWith(coder, value) {
  bufs = [];
  coder.encode(value, bufs);
  return Buffer.concat(bufs);
}

function decodeWith(coder, buf) {
  return coder.decode({buffer: buf, pos: 0});
}

function constCoder(value) {
  return {
    encode: function(val, bufs) { 
      assert(val == value);
    },
    decode: function(reader) { 
      return value; 
    }
  };
}

function composeFunctionWithCoder(encodeFun, decodeFun, coder) {
  return {
    encode: function(value, bufs) { 
      coder.encode(encodeFun(value), bufs);
    },
    decode: function(reader) {
      return decodeFun(coder.decode(reader));
    }
  };
}

function numberCoder(bytes, name) {
  var writeMethod = Buffer.prototype['write' + name];
  var readMethod = Buffer.prototype['read' + name];
  return {
    encode: function(value, bufs) {
      var buffer = new Buffer(bytes);
      writeMethod.call(buffer, value, 0);
      bufs.push(buffer);
    },
    decode: function(reader) {
      var value = readMethod.call(reader.buffer, reader.pos);
      reader.pos += bytes;
      return value;
    }
  };
}

// see http://nodejs.org/api/buffer.html for more types
doubleCoder = numberCoder(8, 'DoubleLE');
int32Coder = numberCoder(4, 'Int32LE');
uint8Coder = numberCoder(1, 'UInt8');

nullCoder = constCoder(null);
booleanCoder = composeFunctionWithCoder(Number, Boolean, uint8Coder);

// This stores a number of bytes in the number as a byte, then all the number's
// bytes (in little endian order).  In theory, it can store any number up to
// 256^255-1.  In practice, this will be restricted to 2^32-1 to prevent issues
// with numeric precision.
bigSizeCoder = {
  encode: function(value, bufs) {
    assert(value <= Math.pow(2, 32), 'value too big: ' + value);
    var bytes = [0];
    while (value > 0) {
      bytes[0]++;
      bytes.push(value % 256);
      value = Math.floor(value / 256);
    }
    assert(bytes[0] <= 4);
    bufs.push(new Buffer(bytes));
  },
  decode: function(reader) {
    var size = uint8Coder.decode(reader);
    assert(size <= 4, 'size is too big: ' + size);
    var value = 0;
    var multiplier = 1;
    for (var i = 0; i < size; i++) {
      value += multiplier * uint8Coder.decode(reader);
      multiplier *= 256;
    }
    return value;
  }
};


lengthCoder = bigSizeCoder;

functionRefCoder = composeFunctionWithCoder(
    function(fnref) { return fref.identifier; },
    function(id) { return new FunctionRef(id); },
    lengthCoder);

stringCoder = {
  encode: function(str, bufs) {
    var strbuf = new Buffer(str, 'utf-8');
    lengthCoder.encode(strbuf.length, bufs);
    bufs.push(strbuf);
  },
  decode: function(reader) {
    var len = lengthCoder.decode(reader);
    var str = reader.buffer.toString('utf-8', reader.pos, reader.pos + len);
    reader.pos += len;
    return str;
  }
};

bufferCoder = {
  encode: function(buf, bufs) {
    lengthCoder.encode(buf.length, bufs);
    var newBuf = new Buffer(buf.length);
    buf.copy(newBuf);
    bufs.push(newBuf);
  },
  decode: function(reader) {
    var len = lengthCoder.decode(reader);
    // note that Buffer.slice() does not copy the data
    var buf = new Buffer(len);
    reader.buffer.copy(buf, 0, reader.pos, reader.pos + len);
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

function objectCoder(elemCoder) {
  return {
    encode: function(object, bufs) {
      var keys = Types.getObjectKeys(object);
      keys.sort();
      lengthCoder.encode(keys.length, bufs);
      for (var i = 0; i < keys.length; i++) {
        stringCoder.encode(keys[i], bufs);
        elemCoder.encode(object[keys[i]], bufs);
      }
    },
    decode: function(reader) {
      var len = lengthCoder.decode(reader);
      var object = {};
      for (var i = 0; i < len; i++) {
        var key = stringCoder.decode(reader);
        var value = elemCoder.decode(reader);
        object[key] = value;
      }
      return object;
    }
  };
};

// Will be set later.
var valueTypeCoders = {};

function valueCoder(addFunction, getFunction) {
  return {
    encode: function(value, bufs) {
      var type = Types.valueType(value);
      if (!type) {
        throw new Error('unknown value type ' + Util.inspect(value));
      }
      uint8Coder.encode(Types.typeToIndex(type), bufs);
      if (type == 'function') {
        lengthCoder.encode(addFunction(value), bufs);
      } else {
        valueTypeCoder(valueCoder(addFunction, getFunction), type).encode(value, bufs);
      }
    },
    decode: function(reader) {
      var typeIndex = uint8Coder.decode(reader);
      var type = Types.typeList[typeIndex];
      if (!type) {
        throw new Error('unknown value type ' + typeIndex);
      } else if (type == 'function') {
        return getFunction(lengthCoder.decode(reader));
      } else {
        return valueTypeCoder(valueCoder(addFunction, getFunction), type).decode(reader);
      }
    }
  }
};

function valueTypeCoder(valueCoder, type) {
  return {
    'null': nullCoder,
    'boolean': booleanCoder,
    'double': doubleCoder,
    'string': stringCoder,
    'buffer': bufferCoder,
    'array': arrayCoder(valueCoder),
    'object': objectCoder(valueCoder)
  }[type];
};

function notProvided() {
  throw 'Function not provided';
}

function encodeValue(value, addFunction) {
  return encodeWith(valueCoder(addFunction || notProvided, notProvided), value);
}

function decodeValue(buf, getFunction) {
  try {
    return decodeWith(valueCoder(notProvided, getFunction || notProvided), buf);
  } catch (ex) {
    throw new Error('error decoding: ' + Util.inspect(ex, {depth: null}) + ', buffer ' + buf.toString('hex'));
  }
}

module.exports = {
  encodeValue: encodeValue,
  decodeValue: decodeValue
};
