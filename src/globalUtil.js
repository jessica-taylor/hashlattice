require('babel-polyfill');

function rg(it) {
  if (typeof it == 'function') {
    it = it();
  }
  function restPromise(getNext) {
    let ret;
    try {
      ret = getNext();
    } catch (err) {
      return Promise.reject(err);
    }

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
        return restPromise(() => it.next(val));
      }, function(err) {
        return restPromise(() => it.throw(err));
      });
    }
    throw "bad object " + ret.value;
  }
  return restPromise(() => it.next());
}

function rgf(f: Function) {
  return function(...args) {
    return rg(f.apply(this, args));
  };
}

function cbpromise(fn: Function, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

function lazy(fn: () => Promise) {
  return Promise.resolve().then(fn);
}

function waitMs(ms: number) {
  return new Promise(function(resolve, reject) {
    setTimeout(() => resolve(), ms);
  });
}

function waitUntil(condition: () => boolean) {
  return lazy(() => condition() ? Promise.resolve() : waitMs(30).then(waitUntil(condition)));
}

module.exports = {
  rg: rg,
  rgf: rgf,
  cbpromise: cbpromise,
  lazy: lazy,
  waitMs: waitMs,
  waitUntil: waitUntil
};
