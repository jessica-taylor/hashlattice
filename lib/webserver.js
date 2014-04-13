var http = require('http')
var Server = require('./server')

function WebServer(server) {
    // server : Server
    this.server = server;
}

WebServer.prototype.start = function() {
    http.createServer(function(req, res) {
        var url = req.url;
        if (url === '/') {
            // TODO Serve an HTML welcome page.
        } else {
            // Get the hash and convert it to a Buffer.
            var hash = url.substring(1);

            try {
                var hashBuffer = new Buffer(hash, 'hex');
            } catch (err) {
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end('You have entered an invalid hash code. Please try ' +
                        'again with a valid hash code.');
                return;
            }

            serv.getHash(hashBuffer, function(err, data) {
                if (!err) {
                    res.writeHead(200, data.headers);
                    res.end(data.content);
                } else {
                    // TODO Handle the error appropriately depending on the type of
                    // error. For now, just 404.
                    res.writeHead(404, {'Content-Type': 'text/plain'});
                    res.end('404. An error occurred and the content could ' +
                            'not be found.');
                }
            });
        }
    }).listen(1337, '127.0.0.1');
    console.log('HashLattice server running at 127.0.0.1 port 1337');
};
