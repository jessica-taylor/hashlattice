var assert = require('assert');

var _ = require('underscore');

var $ = require('jquery');

require('flot');

function Run(name) {
  this.name = name;
  this.startTime = new Date().getTime();
}

Run.prototype.stop = function() {
  this.stopTime = new Date().getTime();
  console.log(this.name, this.stopTime - this.startTime);
};

function Profiler() {
  var runs = [];
}

Profiler.prototype.start = function(name) {
  var run = new Run(name);
  this.runs.push(run);
  return run;
};

Profiler.prototype.profileCallback = function(name, fun, callback) {
  var self = this;
  var run = self.start(name);
  fun(function() {
    run.stop();
    callback.apply(this, arguments);
  });
};

Profiler.prototype.profileMethod = function(obj, methodName) {
  var self = this;
  var oldMethod = obj[methodName];
  assert(oldMethod);
  function newMethod() {
    var args = [].slice.call(arguments, 0, arguments.length - 1);
    var cb = arguments[arguments.length - 1];
    var run = self.start(methodName);
    oldMethod.apply(this, args.concat([function() {
      run.stop();
      cb.apply(this, arguments);
    }]));
  }
  obj[methodName] = newMethod;
};

Profiler.prototype.makeGanttChart = function(div) {
  var self = this;
  var data = _.map(self.runs, function(run, i) {
    return [i, run.endTime(), run.startTime()];
  });
  var options = {
    series: {
      bars: {
        show: true,
        horizontal: true
      }
    }
  };
  $.plot(div, data, options);
};
