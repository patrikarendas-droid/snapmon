#!/usr/bin/env node
/* Local preview server for the catalogue-only site: serves <dir> under /snapmon/ (the same paths as
   https://patrikarendas-droid.github.io/snapmon/). Usage: node tools/catalogue/serve.js <dir> [<port>] */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css', '.png': 'image/png' };
function serve(dir, port) {
  const ROOT = path.resolve(dir);
  return http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (!u.startsWith('/snapmon/')) { res.writeHead(404); return res.end(); }
    let f = path.join(ROOT, u.slice('/snapmon/'.length));
    if (f !== ROOT && !f.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }).listen(+port);
}
module.exports = serve;
if (require.main === module) {
  const [dir, port = '8799'] = process.argv.slice(2);
  if (!dir) { console.error('usage: node tools/catalogue/serve.js <dir> [<port>]'); process.exit(2); }
  serve(dir, port); console.log(`catalogue-only preview: http://localhost:${port}/snapmon/  (catalogue: /snapmon/catalogue/)`);
}
