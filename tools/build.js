#!/usr/bin/env node
// Builds dist/snapmon.html: one self-contained file (all scripts inlined).
// Also builds dist/artifact.html: the same content without <html>/<head>/<body> wrappers, for publishing as a Claude Artifact.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const between = (s, a, b) => s.slice(s.indexOf(a) + a.length, s.indexOf(b));
const inline = s => s.replace(/<script src="(src\/[^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
let head = between(html, '<!--ARTIFACT-HEAD-->', '<!--/ARTIFACT-HEAD-->').replace(/<link rel="(manifest|icon)"[^>]*>\n?/g, '');
// the experimental lens worker is embedded as text so single-file builds can start it from a blob URL
const worker = fs.readFileSync(path.join(root, 'src/workers/clip-worker.js'), 'utf8');
const body = `<script>window.__SNAPMON_CLIP_WORKER = ${JSON.stringify(worker).replace(/<\/script/gi, '<\\/script')};</script>\n` + inline(between(html, '<!--ARTIFACT-BODY-->', '<!--/ARTIFACT-BODY-->'));
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact.html'), head.trim() + '\n' + body.trim() + '\n');
fs.writeFileSync(path.join(root, 'dist/snapmon.html'), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head.trim()}\n</head>\n<body>\n${body.trim()}\n</body>\n</html>\n`);
console.log('built dist/artifact.html and dist/snapmon.html', (fs.statSync(path.join(root, 'dist/snapmon.html')).size / 1024).toFixed(1) + ' KB');
