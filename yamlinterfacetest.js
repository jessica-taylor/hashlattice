var YamlInterface = require('./lib/yamlinterface');

var yaml = new YamlInterface.YamlInterface();

yaml.toYaml('apps/static', function(err, data) { console.log(data); });
