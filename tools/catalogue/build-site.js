#!/usr/bin/env node
/* STAGED (not deployed): assembles the catalogue-only GitHub Pages site that could replace the playable browser game
   once the owner approves (docs/CATALOGUE.md → "Keeping the catalogue online after the browser game"). Nothing here
   deploys: it only writes a folder. The live site is still assembled by .github/workflows/pages.yml.

   Layout (served at https://patrikarendas-droid.github.io/snapmon/ — same origin and paths as today, so the Firebase
   authorised domain, the owner's sign-in and the catalogue's IndexedDB/localStorage data stay exactly where they are):
     index.html            a small notice instead of the game: "SnapMon is now an Android app" + link to the catalogue
                           + a READ-ONLY "copy my old browser progress as a backup code" (reads snapmon.save.v1, never writes)
     catalogue/…           the catalogue unchanged
     icon.svg, src/…       exactly the files catalogue/index.html references (dependency graph read from its tags)
   Not included: the game UI, camera, recognition engine, models, vendor runtimes, PWA manifest, dist/ builds.
   Usage: node tools/catalogue/build-site.js <out-dir> */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('usage: node tools/catalogue/build-site.js <out-dir>'); process.exit(2); }
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
const copy = (rel, to = rel) => { const d = path.join(OUT, to); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), d); };

// 1. the catalogue folder as is
for (const f of fs.readdirSync(path.join(ROOT, 'catalogue'))) copy(path.join('catalogue', f));

// 2. every file the catalogue page loads from outside its folder (script src / link href / static import)
const html = fs.readFileSync(path.join(ROOT, 'catalogue/index.html'), 'utf8');
const refs = new Set();
for (const m of html.matchAll(/\b(?:src|href)="([^"#?]+)"/g)) if (!/^[a-z]+:|^\/\//i.test(m[1])) refs.add(m[1]);
for (const f of fs.readdirSync(path.join(ROOT, 'catalogue')).filter(f => f.endsWith('.js')))
  for (const m of fs.readFileSync(path.join(ROOT, 'catalogue', f), 'utf8').matchAll(/(?:import\s[^'"]*from\s*|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) refs.add(m[1]);
const outside = [];
for (const r of refs) {
  const rel = path.relative(ROOT, path.resolve(ROOT, 'catalogue', r));
  if (rel.startsWith('..')) throw new Error('catalogue references a file outside the repository: ' + r);
  if (!fs.existsSync(path.join(ROOT, rel))) throw new Error('catalogue references a missing file: ' + r);
  if (!rel.startsWith('catalogue' + path.sep)) { copy(rel); outside.push(rel); }
}

// 3. the notice page that replaces the game at /snapmon/
fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SnapMon</title><link rel="icon" href="icon.svg"><meta name="robots" content="noindex">
<style>:root{color-scheme:dark}body{margin:0;background:#120d1d;color:#efe8ff;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:560px;margin:0 auto;padding:28px 16px}h1{color:#7ff0c8;letter-spacing:.06em;font-size:22px}a{color:#c48bff}
.card{background:#1c1530;border:1px solid #3a2d57;border-radius:14px;padding:14px 16px;margin:16px 0}
.btn{background:#2a2045;color:#efe8ff;border:1px solid #3a2d57;border-radius:10px;padding:10px 14px;font:inherit;min-height:44px;cursor:pointer}
textarea{width:100%;box-sizing:border-box;min-height:110px;background:#0e0a17;color:#efe8ff;border:1px solid #3a2d57;border-radius:10px;font:12px/1.4 monospace;word-break:break-all}
.muted{color:#a99cc8;font-size:14px}</style></head>
<body><main>
<h1>SNAPMON</h1>
<p>SnapMon is now developed as an <b>Android app</b>. The browser version of the game is no longer available here.</p>
<div class="card" id="old" hidden><b>Progress from the old browser game</b>
<p class="muted">This browser still holds progress from the old website game. It is not deleted. You can copy it as a backup code
(it starts with <code>SNAPMON1:</code>) and restore it in the app: Settings → Restore from a backup code.</p>
<button class="btn" id="show">Show my backup code</button><p><textarea id="code" readonly hidden></textarea></p>
<p class="muted">Keep the code private: anyone with it can restore your progress.</p></div>
<p class="muted"><a href="catalogue/">Developer catalogue</a></p>
</main>
<script>
/* read-only: never writes, removes or sends anything */
(function () {
  var raw = null; try { raw = localStorage.getItem('snapmon.save.v1'); } catch (e) {}
  if (!raw) return;
  document.getElementById('old').hidden = false;
  document.getElementById('show').onclick = function () {
    var t = document.getElementById('code');
    t.value = 'SNAPMON1:' + btoa(unescape(encodeURIComponent(raw))); t.hidden = false; t.select();
  };
})();
</script>
</body></html>
`);

const list = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : list.push(path.relative(OUT, p)); } })(OUT);
fs.writeFileSync(path.join(OUT, 'catalogue-site.json'), JSON.stringify({ about: 'catalogue-only Pages site (staged); files and the catalogue dependencies outside its folder', dependencies: outside.sort(), files: list.sort() }, null, 1) + '\n');
console.log(`catalogue-only site in ${OUT}: ${list.length} files; dependencies outside catalogue/: ${outside.sort().join(', ')}`);
