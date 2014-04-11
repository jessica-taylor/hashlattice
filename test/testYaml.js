var assert = require('assert');

var Value = require('../lib/value');
var Yaml = require('../lib/yaml');

var testDataValues = require('./testingUtil').testDataValues;

describe('yaml', function() {
  describe('dataToYaml', function() {
    it('should convert data to readable YAML', function() {
      _.each(testDataValues, function(data) {
        assert.equal(data, Yaml.yamlToData(Yaml.dataToYaml(data)));
      });
    });
  });
});
