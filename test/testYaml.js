var assert = require('assert');
var _ = require('underscore');

var Value = require('../lib/value');
var Yaml = require('../lib/yaml');

var testDataValues = require('./testingUtil').testDataValues;

describe('yaml', function() {
  describe('dataToYaml', function() {
    it('should convert data to readable YAML', function() {
      _.each(testDataValues, function(data) {
        assert(Value.valuesEqual(data, Yaml.yamlToData(Yaml.dataToYaml(data))));
      });
    });
  });
});
