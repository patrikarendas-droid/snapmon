// Recognition-engine test with the REAL TinyCLIP worker and ONNX Runtime Web (WASM in headless Chromium), using the
// tiny colour test model (tools/make-test-model.py) in place of the 39 MB TinyCLIP file. The detector/classifier part
// is stubbed (tests/e2e-lens.js runs the real one). Covers: one-time notice, progress, caching across reloads,
// interrupted and corrupted downloads (never cached), WebGPU failure -> CPU with the same model, CPU failure ->
// clear error and no monster, memory errors, timeouts, and that players cannot pick another recogniser.
// Usage: node tests/e2e-engine.js <url> <ort-dist-dir> <screenshot-dir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const cam = require('./fake-camera');
const [url, ortDir, outDir] = process.argv.slice(2);
const MODEL = path.join(__dirname, 'fixtures/testcolor-model');
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(MODEL, f))).digest('hex');
const size = f => fs.statSync(path.join(MODEL, f)).size;
const manifest = (over = {}) => ({ engine: 'hybrid-1', groups: { lens: 32610304, clip: 43725619 },
  files: ['vision.onnx', 'vocab.bin', 'vocab.json'].map(f => ({ path: 'models/clip/tinyclip-39m16/' + f, bytes: size(f), sha256: sha(f), ...(over[f] || {}) })) });

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 870 }, isMobile: true, hasTouch: true });
  let man = manifest(), modelRoute = null, modelHits = 0;
  await ctx.route(/\/models\/manifest\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(man) }));
  await ctx.route(/\/models\/clip\/tinyclip-39m16\//, r => {
    const f = r.request().url().split('/').pop();
    if (f === 'vision.onnx') { modelHits++; if (modelRoute) return modelRoute(r); }
    r.fulfill({ path: path.join(MODEL, f), contentType: f.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  });
  await ctx.route(/\/vendor\/ort\//, r => r.fulfill({ path: path.join(ortDir, r.request().url().split('/').pop()) }));
  await ctx.route(/\/vendor\/tfjs\/|\/models\/(mobilenet|ssdlite)|cdn\.jsdelivr|tfhub|googleapis/, r => r.abort());
  await ctx.addInitScript(cam.init);
  // detector/classifier stub: one blue mug candidate with a box (the colour test model sees a blue photo as a mug too)
  const stubLens = page => page.evaluate(() => {
    Lens.load = async () => { Lens.status.state = 'ready'; Lens.status.backend = 'webgl'; return true; };
    Lens.recognize = async img => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').drawImage(img, 0, 0, 320, 240);
      return { decision: 'auto', reason: 'confident', candidates: [{ label: 'coffee mug', obj: 'mug', cat: 'mug', conf: 0.9, box: [0.25, 0.2, 0.5, 0.6], src: 'photo' }], image: c, boxes: [],
        debug: { decision: 'auto', reason: 'stub', thresholds: { min: .25, auto: .55, detMin: .45 }, times: { total: 3 }, sources: {}, backend: 'stub', full: [], detections: [], crops: [], candidates: [] } }; };
  });
  // a blue mug on a brown table
  const blueMug = page => page.evaluate(() => new Promise(res => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d');
    g.fillStyle = '#d6c8ac'; g.fillRect(0, 0, 320, 130); g.fillStyle = '#784e2c'; g.fillRect(0, 130, 320, 110);
    g.fillStyle = '#2350cd'; g.beginPath(); g.ellipse(160, 120, 62, 72, 0, 0, Math.PI * 2); g.fill();
    const i = new Image(); i.onload = () => { window.__cam.img = i; res(); }; i.src = c.toDataURL();
  }));
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
  const shot = n => p.screenshot({ path: `${outDir}/${n}.png` });
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));
  await p.goto(url); await p.waitForTimeout(400); await stubLens(p);
  await p.evaluate(() => window.__snapmon.setRNG(() => 0.01));

  // 1) no way for a player to choose another recogniser
  await p.click('[data-act="settings"]'); await p.waitForTimeout(200);
  const settingsText = await p.textContent('#sheet');
  ok(/Every player uses the same engine/.test(settingsText) && !/Experimental lens|Compare|Production/i.test(settingsText) && !(await p.$('[data-act="expLens"]')), 'settings offer no alternative recogniser (developer tools hidden)');
  await p.click('.sheet [data-act="closeSheet"]');

  // 2) interrupted download: the model arrives truncated -> clear error, nothing broken is cached, Retry works
  modelRoute = r => r.fulfill({ body: fs.readFileSync(path.join(MODEL, 'vision.onnx')).subarray(0, 100), contentType: 'application/octet-stream' });
  await p.evaluate(() => window.__snapmon.actions.openCamera());
  await p.waitForSelector('text=One-time download'); await shot('E01-notice');
  await p.click('[data-act="engineDownload"]');
  await p.waitForSelector('text=The recognition engine could not download', { timeout: 30000 }); await shot('E02-interrupted');
  const cachedBad = await p.evaluate(async () => { const c = await caches.open('snapmon-models-v1'); return (await c.keys()).map(k => k.url.split('/').pop()); });
  ok(!cachedBad.includes('vision.onnx'), 'an interrupted model download is not cached (cached: ' + cachedBad.join(', ') + ')');
  ok(!!(await p.$('[data-act="engineDownload"]')) && (await S()).stats.encounters === 0, 'download failure offers Try again and creates no monster');

  // 3) corrupted download (right size, wrong bytes) is rejected by the SHA-256 check
  const goodModel = fs.readFileSync(path.join(MODEL, 'vision.onnx'));
  const bad = Buffer.from(goodModel); bad[bad.length - 5] ^= 0xff;
  modelRoute = r => r.fulfill({ body: bad, contentType: 'application/octet-stream' });
  await p.click('[data-act="engineDownload"]');
  await p.waitForSelector('text=The recognition engine could not download', { timeout: 30000 });
  ok(/corrupted/.test(await p.evaluate(() => Engine.status.error)), 'a corrupted model download is detected (checksum) and rejected');

  // 4) WebGPU fails -> the SAME model runs on the CPU (WASM)
  modelRoute = null;
  await p.evaluate(() => { ClipLens.CFG.test = { failGPU: true }; });
  await p.click('[data-act="engineDownload"]');
  await p.waitForSelector('#camShutter:not([disabled])', { timeout: 60000 });
  let info = await p.evaluate(() => ({ ...ClipLens.status.info, engine: Engine.status.state }));
  ok(info.engine === 'ready' && info.backend === 'wasm' && /simulated WebGPU failure/.test(info.gpuError || ''), 'WebGPU failure falls back to the CPU backend (gpuError: ' + info.gpuError + ')');
  ok(info.variant === 'testcolor' && info.modelBytes === size('vision.onnx'), 'the CPU fallback runs the very same model file (' + info.modelBytes + ' bytes)');
  await p.click('[data-act="camClose"]');

  // 5) hunting with the real worker: blue mug on a brown table -> mug, blue monster (colour from the object, not the table)
  await blueMug(p); await cam.snap(p);
  await p.waitForSelector('[data-act="fight"]', { timeout: 30000 }); await p.waitForTimeout(1200); await shot('E03-blue-mug');
  const m = await p.evaluate(() => window.__snapmon.ui.discovered);
  ok(m && m.obj === 'mug' && m.dna.pal && m.dna.pal.conf === 'confident', 'hunting runs the full Hybrid engine and creates a mug monster with a confident photo palette');
  ok(m && m.dna.col.h > 205 && m.dna.col.h < 240 && m.dna.col.s > 40, `the monster is blue like the photographed mug (hue ${m && m.dna.col.h}), not brown like the table`);
  ok(m && m.photo && m.photo.engine === 'hybrid-1', 'the monster records which engine identified it');
  await p.click('[data-act="ignore"]');

  // 6) reload: engine comes from the on-phone cache (no second download, no notice)
  const hitsBefore = modelHits;
  await p.reload(); await p.waitForTimeout(300); await stubLens(p);
  await p.evaluate(() => Engine.load());
  info = await p.evaluate(() => ClipLens.status.info);
  ok(info.fromCache === true && modelHits === hitsBefore, 'after a reload the model is read from the cache, not downloaded again');
  await p.evaluate(() => window.__snapmon.actions.openCamera());
  ok(!(await p.$('text=One-time download')), 'the download notice is shown only once');
  await p.waitForSelector('#camShutter:not([disabled])'); await p.click('[data-act="camClose"]');

  // 7) consistency: the same photo gives the same decision on two engine loads (here both WASM; real GPU vs CPU is a phone test)
  const decide = () => p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d'); g.fillStyle = '#c8641e'; g.fillRect(0, 0, 320, 240); // between red and yellow: a mid-range score, not a saturated 1.0
    const r = await Engine.recognize(c); return { d: r.rec.decision, top: r.rec.candidates.map(x => x.obj), p: r.clip.regions[0].best.p, backend: r.clip.backend };
  });
  const r1 = await decide();
  await p.evaluate(() => { Engine.setForceCPU(true); }); await p.evaluate(() => Engine.load());
  const r2 = await decide();
  ok(JSON.stringify([r1.d, r1.top, r1.p]) === JSON.stringify([r2.d, r2.top, r2.p]), `same photo, same decision and score after reloading on the forced CPU path (${r1.p} vs ${r2.p})`);

  // 8) CPU failure too -> the device cannot run the engine: clear message, Retry, collection still usable, no monster
  await p.evaluate(() => { Engine.setForceCPU(false); ClipLens.CFG.test = { failGPU: true, failCPU: 'simulated CPU failure' }; });
  await p.evaluate(() => window.__snapmon.actions.openCamera());
  await p.waitForSelector('#camShutter:not([disabled])', { timeout: 15000 }).catch(() => {});
  await blueMug(p); await cam.snap(p);
  await p.waitForSelector("text=couldn't run on this device", { timeout: 30000 }); await shot('E04-engine-failed');
  ok(!!(await p.$('[data-act="lensRetry"]')) && !(await p.$('[data-act="fight"]')), 'when neither backend works: the suggested message, a Retry button, and no monster');
  await p.click('[data-act="cancelPhoto"]');
  await p.click('[data-act="tab"][data-arg="dex"]'); await p.waitForTimeout(200);
  ok(!!(await p.$('[data-act="dexView"]')), 'the collection still works while recognition is unavailable');
  await p.click('[data-act="tab"][data-arg="hunt"]');

  // 9) memory errors are reported as such
  await p.evaluate(() => { ClipLens.reset(); Engine.status.state = 'idle'; ClipLens.CFG.test = { failGPU: true, failCPU: 'memory access out of bounds' }; });
  const kind = await p.evaluate(async () => { await Engine.load(); return Engine.status.kind; });
  ok(kind === 'memory', 'an out-of-memory failure is classified as memory (' + kind + ')');

  // 10) excessively slow recognition times out with a message instead of hanging
  await p.evaluate(() => { ClipLens.reset(); Engine.status.state = 'idle'; ClipLens.CFG.test = null; });
  await p.evaluate(() => Engine.load());
  const slow = await p.evaluate(async () => {
    const orig = Lens.recognize; Lens.recognize = () => new Promise(() => {});
    try { await Engine.recognize(document.createElement('canvas'), { timeoutMs: 300 }); return 'no error'; } catch (e) { return e.kind; } finally { Lens.recognize = orig; }
  });
  ok(slow === 'timeout', 'excessively slow recognition ends with a timeout error (' + slow + ')');
  ok(await p.evaluate(() => !Object.keys(Lens.CFG).some(k => /fallback|lite|alt/i.test(k)) && typeof Lens.CFG.localUrls.classifier === 'string'), 'no alternative model is configured anywhere in the detector/classifier part');

  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S)` : '\nALL ENGINE CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
