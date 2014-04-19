var Child_process = require('child_process')
var spawn = Child_process.spawn

var python_cli = spawn('python', ['./mininet_client.py'])

python_cli.stdout.on('data', function(filename) {
  spawn('cat', ['./' + filename]);
})

python_cli.stderr.on('data', function(error) {
  console.log('Error: ' + error);
})
