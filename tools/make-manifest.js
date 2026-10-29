#!/usr/bin/env node
// Writes <site>/models/manifest.json: every packaged model/runtime file with its size and SHA-256, grouped into the
// two engine parts. The game uses it for the one-time download notice and to verify TinyCLIP downloads; a native
// build can use the same list to bundle and check its assets. Usage: node tools/make-manifest.js _site
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const site = process.argv[2] || '_site';
const files = [];
const walk = dir => { if (!fs.existsSync(path.join(site, dir))) return; for (const f of fs.readdirSync(path.join(site, dir))) { const rel = dir + '/' + f, st = fs.statSync(path.join(site, rel)); st.isDirectory() ? walk(rel) : files.push(rel); } };
walk('models'); walk('vendor');
const out = files.filter(f => !f.endsWith('manifest.json')).sort().map(f => {
  const buf = fs.readFileSync(path.join(site, f));
  return { path: f, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
});
const sum = re => out.filter(f => re.test(f.path)).reduce((a, f) => a + f.bytes, 0);
const manifest = {
  engine: process.env.ENGINE_ID || 'hybrid-1', created: new Date().toISOString(),
  // clip: model + vocabulary + the CPU (WASM) runtime build every player loads (the WebGPU build is developer-only)
  groups: { lens: sum(/^models\/(mobilenet|ssdlite)|^vendor\/tfjs\//), clip: sum(/^models\/clip\/|^vendor\/ort\/(ort\.min\.js|ort-wasm-simd-threaded\.(wasm|mjs))$/) },
  files: out,
};
fs.mkdirSync(path.join(site, 'models'), { recursive: true });
fs.writeFileSync(path.join(site, 'models/manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`manifest: ${out.length} files, detector+classifier ${(manifest.groups.lens / 1048576).toFixed(1)} MB, TinyCLIP ${(manifest.groups.clip / 1048576).toFixed(1)} MB`);
