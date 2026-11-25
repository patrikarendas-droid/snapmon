// The catalogue-only Pages site (tools/catalogue/build-site.js), tested as it would be served:
// under /snapmon/ on one origin, exactly like https://patrikarendas-droid.github.io/snapmon/.
//   • contents: the catalogue + only the files its page references; no game UI, camera, engine, models or runtimes
//   • the catalogue page: every request answered (no 404), nothing fetched from models/ or vendor/, the camera never
//     requested, all 2,308 objects with real sprites at phone and desktop widths, Firebase blocked → "Local only"
//   • the notice page that replaces the game: links to the catalogue; with old browser progress present it offers that
//     progress as a valid SNAPMON1 backup code and leaves the stored save byte-identical (read-only)
// The full catalogue suites (local, AI, sync, sprite, storage) are ALSO run against this preview in CI.
// Usage: node tests/e2e-catalogue-preview.js <site-dir> [<port>] [<screenshot-dir>]   (starts its own server)
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [dir, port = '8799', out = 'shots'] = process.argv.slice(2);
const ROOT = path.resolve(dir);
fs.mkdirSync(out, { recursive: true });
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogue-site.json'), 'utf8'));
const files = manifest.files;
ok(files.includes('catalogue/index.html') && files.includes('index.html') && files.includes('src/game.js'), `site has the catalogue, the notice page and the game data code it needs (${files.length} files)`);
const forbidden = files.filter(f => /^(models|vendor|dist)\/|^src\/(ui|engine|lens|lens-clip|platform|combatlog|guide)\.js$|^src\/workers\/|manifest\.webmanifest/.test(f));
ok(!forbidden.length, `no game UI, camera, recognition engine, models, runtimes or PWA files${forbidden.length ? ': ' + forbidden.join(', ') : ''}`);
ok(manifest.dependencies.length >= 9 && manifest.dependencies.every(d => d === 'icon.svg' || d.startsWith('src' + path.sep)), `dependencies outside catalogue/: ${manifest.dependencies.join(', ')}`);

const srv = require('../tools/catalogue/serve')(ROOT, port);
const base = `http://localhost:${port}/snapmon/`;

(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[412, 900], [1280, 900]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/gstatic\.com/, r => r.abort());
    await ctx.addInitScript(() => { window.__cam = 0; if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__cam++; return Promise.reject(new Error('no')); }; });
    const p = await ctx.newPage(), errs = [], reqs = [], missing = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('request', r => reqs.push(r.url()));
    p.on('response', r => { if (r.status() >= 400) missing.push(r.status() + ' ' + r.url()); });
    await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
    await p.waitForFunction(() => /could not be loaded/.test(document.querySelector('#sync').textContent), null, { timeout: 20000 });
    ok(await p.textContent('#count') === '2308' && /Local only — NOT synced/.test(await p.textContent('#sync')), `${w}px: 2,308 objects; Firebase blocked → "Local only — NOT synced"`);
    await p.fill('#q', 'umbrella'); await p.waitForTimeout(300); await p.click('.row[data-id="umbrella"]'); await p.waitForSelector('.rars canvas');
    const d = await p.evaluate(() => ({ n: document.querySelectorAll('.rars canvas').length, px: [...document.querySelectorAll('.rars canvas')].every(c => { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < x.length; i += 4) if (x[i]) return true; return false; }), ov: document.documentElement.scrollWidth <= innerWidth }));
    ok(d.n === 5 && d.px && d.ov, `${w}px: umbrella detail draws 5 real sprites, no horizontal overflow`);
    ok(!missing.length, `${w}px: every request of the catalogue is answered from the preview site${missing.length ? ': ' + missing.slice(0, 3).join(', ') : ''}`);
    const heavy = reqs.filter(u => /\/models\/|\/vendor\/|\.onnx|\.wasm|tfhub|storage\.googleapis/.test(u));
    ok(!heavy.length && (await p.evaluate(() => window.__cam)) === 0, `${w}px: no AI model/runtime download and no camera request (${reqs.length} requests)`);
    ok(!errs.length, `${w}px: no page errors${errs.length ? ': ' + errs[0] : ''}`);
    await p.screenshot({ path: path.join(out, `catalogue-preview-${w}.png`) });
    await ctx.close();
  }
  // the notice page
  {
    const ctx = await b.newContext({ viewport: { width: 412, height: 860 } });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base);
    ok(/Android app/.test(await p.textContent('body')) && await p.isHidden('#old'), 'notice page: "SnapMon is now an Android app"; no old progress → nothing offered');
    await p.click('a[href="catalogue/"]'); await p.waitForSelector('.row');
    ok(/\/snapmon\/catalogue\/$/.test(p.url()), 'notice page links to the catalogue at /snapmon/catalogue/');
    const save = JSON.stringify({ v: 3, level: 5, monsters: [{ id: 'm1', name: 'Zoë' }], hunterName: 'Zoë', coins: 77 });
    await p.goto(base); await p.evaluate(s => localStorage.setItem('snapmon.save.v1', s), save); await p.reload();
    await p.click('#show');
    const code = await p.inputValue('#code');
    const back = JSON.parse(Buffer.from(code.slice(9), 'base64').toString('utf8'));
    ok(code.startsWith('SNAPMON1:') && back.coins === 77 && back.hunterName === 'Zoë', 'old browser progress is offered as a valid SNAPMON1 backup code (UTF-8 names intact)');
    ok(await p.evaluate(() => localStorage.getItem('snapmon.save.v1')) === save && !errs.length, 'the notice page never changes the stored browser save; no page errors');
    await p.screenshot({ path: path.join(out, 'catalogue-preview-notice.png') });
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(bad ? `\n${bad} PROBLEM(S)` : '\ncatalogue-only preview: all checks passed'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
