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

const rgf = f => function(...args) {
  return rg(f.apply(this, args));
};

const cbpromise = (fn, ...args) => new Promise((resolve, reject) => {
  fn(...args, function(err, res) {
    if (err) {
      reject(err);
    } else {
      resolve(res);
    }
  });
});

const lazy = fn => Promise.resolve().then(fn);

const waitMs = ms => new Promise(function(resolve, reject) {
  setTimeout(() => resolve(), ms);
});

const waitUntil = condition => lazy(() =>
    condition() ? Promise.resolve() : waitMs(30).then(waitUntil(condition))
  );

module.exports = {
  rg: rg,
  rgf: rgf,
  cbpromise: cbpromise,
  lazy: lazy,
  waitMs: waitMs,
  waitUntil: waitUntil
};
