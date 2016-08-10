

function rg(it) {
  if (typeof it == 'function') {
    it = it();
  }
  function restPromise(ret) {
    if (ret.done) {
      return Promise.resolve(undefined);
    }
    const v = ret.value;
    if (typeof v != 'object') {
      throw "not object " + ret.value;
    }
    if (v.constructor === Array) {
      return Promise.resolve(v[0]);
    }
    if ('then' in v) {
      return v.then(function(val) {
        return restPromise(it.next(val));
      }, function(err) {
        return restPromise(it.throw(err));
      });
    }
    throw "bad object " + ret.value;
  }
  return restPromise(it.next());
}

const rgf = f => function(...args) {
  return rg(f.apply(this, args));
};

module.exports = {
  rg: rg,
  rgf: rgf
};
