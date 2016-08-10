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
      U.each(testDataValues, function(data) {
        assert(Value.valuesEqual(data, Yaml.yamlToData(Yaml.dataToYaml(data))));
      });
    });
  });
  describe('loadYamlFile', function() {
    it('should read simple data YAML files', function(done) {
      Yaml.loadYamlFile(simpleDataYamlFile, function(err, data) {
        assert(!err, err);
        assert(Value.valuesEqual(simpleData, data));
        done();
      });
    });
    it('should allow dependencies', function(done) {
      Yaml.loadYamlFile(dependentYamlFile, function(err, data) {
        assert(!err, err);
        assert(Value.valuesEqual(dependentData, data));
        done();
      });
    });
    it('should detect circular dependencies', function(done) {
      Yaml.loadYamlFile('./test/testdata/circular.yaml', function(err, data) {
        assert.equal('circular dependency', err);
        done();
      });
    });
    it('should detect mutual dependencies', function(done) {
      Yaml.loadYamlFile('./test/testdata/mutual1.yaml', function(err, data) {
        assert.equal('circular dependency', err);
        done();
      });
    });
  });
});
