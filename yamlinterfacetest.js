var YamlInterface = require('./lib/yamlinterface');

YamlInterface.toYaml('apps/static', function(err, data) { console.log(data); });
