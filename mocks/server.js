const http = require('http');
const fs = require('fs');
const path = require('path');

const responses = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'responses.json'), 'utf8')
);

const server = http.createServer((req, res) => {
  const key = `${req.method} ${req.url}`;
  const mock = responses[key];
  if (mock) {
    res.writeHead(mock.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mock.body));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'no mock defined for ' + key }));
  }
});

const port = process.env.MOCK_PORT || 4000;
server.listen(port, () => console.log(`Mock server on :${port}`));
