#!/usr/bin/env node
// Labelled contact sheets of REAL game sprites for the recognition → identity → visual audit (docs/review/MAPPING_AUDIT.md).
// Renders with the game's own sprite code in headless Chromium (Playwright), one row per entry: the recognised label,
// the object it resolves to, its visual tier/source, and five rarities. Usage:
//   node tools/audit-sheet.js <out.png> "<title>" <entry> [<entry> …]
//   entry = object id, or "label=<recogniser label>" (resolved like the game does), optionally suffixed "|note".
//   --dna-shape=<shape>[:<sub>] on an entry ("id@fish") draws the object with a stored older design (before/after).
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const [out, title, ...entries] = process.argv.slice(2);
if (!out || !entries.length) { console.log('usage: node tools/audit-sheet.js out.png "title" id|label=<label>[@shape[:sub]][|note] …'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const SRC = ['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 400 }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#16121f;color:#eee;font:13px/1.25 system-ui,sans-serif;width:900px}
    h1{font-size:16px;margin:10px 12px}.row{display:flex;align-items:center;gap:8px;padding:6px 12px;border-top:1px solid #2c2540}
    .cap{width:300px;flex:none}.cap b{color:#fff}.cap small{color:#a99fc4;display:block}.cell{text-align:center;font-size:10px;color:#a99fc4}
    canvas{image-rendering:pixelated;background:#221b33;border-radius:6px;display:block}</style><h1></h1><div id="rows"></div>`);
  await p.addScriptTag({ content: SRC });
  await p.evaluate(({ title, entries }) => {
    document.querySelector('h1').textContent = title;
    const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'], rows = document.getElementById('rows');
    entries.forEach((raw, row) => {
      const [spec, note = ''] = raw.split('|'); const [key, stored] = spec.split('@');
      const label = key.startsWith('label=') ? key.slice(6) : null, id = label ? objectForLabel(label) : key, o = OBJECTS[id];
      const div = document.createElement('div'); div.className = 'row';
      const src = o ? visualSource(o) : null;
      div.innerHTML = `<div class="cap">${label ? `“${label}” →<br>` : ''}<b>${o ? o.name : '(none)'}</b> <small>${id || 'no object'} · ${o ? objectTier(o) : ''}${src && src !== o ? ' · drawn like ' + src.name : ''}${stored ? ' · stored design ' + stored : ''}${note ? ' · ' + note : ''}</small></div>`;
      if (o) RAR.forEach((r, c) => {
        const dna = makeDNA({ cat: o.cat, obj: id, rarity: r, seed: (row * 7919 + c * 104729 + 17) >>> 0, photo: null, variant: null });
        if (stored) { const [sh, sub] = stored.split(':'); dna.shape = sh; dna.sub = sub || null; }
        const cv = document.createElement('canvas'); renderSprite(cv, dna, 3);
        const cell = document.createElement('div'); cell.className = 'cell'; cell.append(cv, r); div.append(cell);
      });
      rows.append(div);
    });
  }, { title, entries });
  const h = await p.evaluate(() => document.body.scrollHeight); await p.setViewportSize({ width: 900, height: h });
  await p.screenshot({ path: out, fullPage: true }); await b.close(); console.log('wrote', out, entries.length, 'rows');
})().catch(e => { console.error(e); process.exit(1); });
