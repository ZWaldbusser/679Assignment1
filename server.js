// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  // Set the content type to HTML
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');

  // Read the index.html file and send its content as the response
  fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('404: File Not Found');
    } else {
      res.end(data);
    }
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});