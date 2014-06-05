var assert = require('assert');
var Fs = require('fs');
var Yaml = require('./yaml');

var writeYamlConfig = function() {
  var yamlPath = process.argv[2];
  var resultPath = process.argv[3];
  Yaml.loadYamlFile(yamlPath, function(err, yamlData) {
    assert(!err, err):
    var binYaml = Value.encodeValue(yamlData); 
    Fs.writeFile(resultPath, binYaml, function(err) { throw err; });    
  });
}

module.exports = {
  writeYamlConfig: writeYamlConfig
}
