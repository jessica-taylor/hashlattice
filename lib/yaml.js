/**
 * Convert data values to/from YAML.
 */

var JsYaml = require('js-yaml');

// We need 4 custom types:
// !includeYaml foo.yaml -- include a YAML file.  Directory is relative to this file.
// !includeBinary foo.png -- include a binary file.
// !hashYaml foo.yaml -- hash of a YAML file.
// !hashBinary foo.png -- hash of a binary file.

// schema with JSON + binary
var schema = JsYaml.Schema.create(
    [JsYaml.JSON_SCHEMA],
    [JsYaml.type.binary]);

function yamlToData(yaml) {
  return JsYaml.safeLoad(yaml, {schema: schema});
}

function dataToYaml(data) {
  return JsYaml.safeDump(data, {schema: schema});
}
