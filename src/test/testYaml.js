var fs = require('fs');
var assert = require('assert');

var U = require('underscore');

var Value = require('../lib/value');
var Yaml = require('../lib/yaml');

var testDataValues = require('./testingUtil').testDataValues;

var simpleDataYamlFile = './build/test/testdata/simpleData.yaml';
var simpleData = [
  1,
  [1, 2, 3],
  'hello',
  {a: 'b', c: {}},
  new Buffer('R0lGODlhDAAMAIQAAP//9/X17unp5WZmZgAAAOfn515eXvPz7Y6OjuDg4J+fn5OTk6enp56enmleECcgggoBADs=', 'base64')
];

var image = fs.readFileSync('./build/test/testdata/image.png');
var dependentYamlFile = './build/test/testdata/dependent.yaml';
var dependentData = [1, 2, simpleData, Value.hashData(simpleData),
                     image, Value.hashData(image)];

describe('yaml', function() {
  describe('dataToYaml', function() {
    it('should convert data to readable YAML', function() {
      for(const data of testDataValues) {
        assert(Value.valuesEqual(data, Yaml.yamlToData(Yaml.dataToYaml(data))));
      }
    });
  });
  describe('loadYamlFile', function() {
    it('should read simple data YAML files', async function() {
      assert(Value.valuesEqual(simpleData, await Yaml.loadYamlFile(simpleDataYamlFile)));
    });
    it('should allow dependencies', async function() {
      assert(Value.valuesEqual(dependentData, await Yaml.loadYamlFile(dependentYamlFile)));
    });
    it('should detect circular dependencies', async function() {
      try {
        await Yaml.loadYamlFile('./build/test/testdata/circular.yaml');
        assert.fail();
      } catch (err) {
        assert.equal('circular dependency', err);
      }
    });
    it('should detect mutual dependencies', async function() {
      try {
        await Yaml.loadYamlFile('./build/test/testdata/mutual1.yaml');
        assert.fail();
      } catch (err) {
        assert.equal('circular dependency', err);
      }
    });
  });
});
