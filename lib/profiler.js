var assert = require('assert');
var _ = require('underscore');
var Util = require('util')

var $ = window.jQuery = require('jquery');
require('flot');


function Run(name) {
  this.name = name;
  this.startTime = new Date().getTime();
  this.stopTime = 0;
}

Run.prototype.stop = function() {
  this.stopTime = new Date().getTime();
  console.log(this.name, this.stopTime - this.startTime);
};

function Profiler() {
  var self = this;
  self.runs = [];
  window.makeGanttChart = function() { self.makeGanttChart(); };
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
  var horizontal = false;
  if (!div) {
    div = $('<div>');
    $('body').prepend(div);
  }
  var minTime = _.min(_.pluck(self.runs, 'startTime'));
  var data = _.map(self.runs, function(run, i) {
    var t1 = run.startTime - minTime, t2 = run.stopTime - minTime; 
    return horizontal ? [t2, i, t1] : [i, t2, t1];
  });
  console.log('data', Util.inspect(data));
  var series = {
    data: data,
    bars: {
      show: true,
      horizontal: horizontal,
      align: 'center'
    }
  };
  var options = {
    xaxis: {
      ticks: _.map(self.runs, function(run, i) { return [i, run.name]; })
    }
  };
  console.log('options', options);
  $.plot(div, [series], options);
};

module.exports = Profiler;
