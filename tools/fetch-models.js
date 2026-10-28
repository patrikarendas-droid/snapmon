#!/usr/bin/env node
// Mirrors the two open-source TF.js models into the deployed site (used by the GitHub Pages workflow),
// so players download them from the same origin as the game. Best effort: the game falls back to the
// public model hosts if this mirror is missing. Usage: node tools/fetch-models.js <out-dir>
const fs = require('fs'), path = require('path');
const out = process.argv[2] || '_site/models';
const MODELS = [
  { dir: 'mobilenet_v2_100', base: 'https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2', query: '?tfjs-format=file' },
  { dir: 'ssdlite_mobilenet_v2', base: 'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2', query: '' },
];
async function get(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
(async () => {
  let okAll = true;
  for (const m of MODELS) {
    try {
      const dir = path.join(out, m.dir); fs.mkdirSync(dir, { recursive: true });
      const json = await get(`${m.base}/model.json${m.query}`);
      const manifest = JSON.parse(json.toString());
      let bytes = json.length;
      for (const group of manifest.weightsManifest) for (const p of group.paths) {
        const buf = await get(`${m.base}/${p}${m.query}`);
        fs.writeFileSync(path.join(dir, path.basename(p)), buf); bytes += buf.length;
      }
      fs.writeFileSync(path.join(dir, 'model.json'), json);
      console.log(`mirrored ${m.dir}: ${(bytes / 1048576).toFixed(1)} MB`);
    } catch (e) { okAll = false; console.log(`could not mirror ${m.dir}: ${e.message}`); fs.rmSync(path.join(out, m.dir), { recursive: true, force: true }); }
  }
  if (!okAll) console.log('Some models were not mirrored; the game will download them from the public hosts instead.');
})();
