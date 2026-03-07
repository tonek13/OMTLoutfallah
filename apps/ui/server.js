const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.UI_PORT || 4173);
const rootDir = __dirname;
const templateSignature = 'omt-v2-starter | owner: Tony Loutfallah | id: tony-loutfallah-v1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const send = (res, statusCode, content, contentType = 'text/plain; charset=utf-8') => {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(content);
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(rootDir, normalized);

  if (!filePath.startsWith(rootDir)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, 'Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        send(res, 500, 'Internal server error');
        return;
      }
      send(res, 200, data, contentType);
    });
  });
});

server.listen(port, () => {
  console.log(`OMT UI available at http://localhost:${port}`);
  console.log(`Template signature: ${templateSignature}`);
});
