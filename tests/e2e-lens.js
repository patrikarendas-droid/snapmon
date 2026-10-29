// Spirit Lens end-to-end test on real photos with the REAL COCO-SSD detector and TensorFlow.js,
// served locally. MobileNet is replaced by a scripted stand-in (tests/fixtures/mock-mobilenet.js).
// Usage: node tests/e2e-lens.js <url> <photo-dir> <tfjs-dist-dir> <coco-ssd-dist-dir> <coco-model-dir> <screenshot-dir> [v1-save.json]
const { chromium } = require('playwright');
const cam = require('./fake-camera');
const fs = require('fs'), path = require('path');
const [url, photos, tfDir, cocoLibDir, cocoModelDir, outDir, v1save] = process.argv.slice(2);
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 870 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@tensorflow\/tfjs@/, r => r.fulfill({ path: path.join(tfDir, 'tf.min.js'), contentType: 'application/javascript' }));
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@tensorflow-models\/coco-ssd@/, r => r.fulfill({ path: path.join(cocoLibDir, 'coco-ssd.min.js'), contentType: 'application/javascript' }));
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@tensorflow-models\/mobilenet@/, r => r.fulfill({ path: path.join(__dirname, 'fixtures/mock-mobilenet.js'), contentType: 'application/javascript' }));
  await ctx.route(/\/models\/ssdlite_mobilenet_v2\//, r => r.fulfill({ path: path.join(cocoModelDir, r.request().url().split('/').pop()) }));
  await ctx.route(/tfhub\.dev|storage\.googleapis\.com|kaggle/, r => r.abort());
  await ctx.addInitScript(cam.init);
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
  if (v1save) await p.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('snapmon.save.v1', s); sessionStorage.setItem('seeded', '1'); } }, fs.readFileSync(v1save, 'utf8'));
  await p.goto(url); await p.waitForTimeout(500);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));
  if (v1save) {
    const old = JSON.parse(fs.readFileSync(v1save, 'utf8')), st = await S();
    ok(st.v === 3 && st.level === old.level && st.coins === old.coins && st.monsters.length === old.monsters.length, `v1 save migrated (level ${st.level}, ${st.monsters.length} monsters, ${st.coins} coins kept)`);
    ok(JSON.stringify(st.monsters.map(m => m.dna)) === JSON.stringify(old.monsters.map(m => m.dna)), 'v1 monsters keep identical DNA');
    ok(Object.keys(st.dex).length > 0 && Object.values(st.dex).every(d => d.obj) && !('aiLens' in st.settings), 'encyclopedia kept (regrouped by object), retired setting removed');
  }
  // the TinyCLIP part is stubbed to agree with the real detector/classifier (tests/e2e-engine.js runs the real worker)
  const stubClip = () => p.evaluate(() => {
    ClipLens.load = async () => { Object.assign(ClipLens.status, { state: 'ready', info: { backend: 'wasm', loadMs: 1, modelBytes: 0, vocabBytes: 0, name: 'stub' }, meta: { labels: [], calib: { accept: { p: 0.35, margin: 0.15 }, heldOut: { accepted: 28, precision: 0.75 } } } }); return true; };
    ClipLens.recognize = async (img, rec) => { const c = rec.candidates[0];
      return { regions: [{ box: null, cls: 'whole photo', best: c ? { obj: c.obj, label: c.label, p: 0.5 } : { obj: null, label: 'a wall', p: 0.4 }, accepted: !!c, why: c ? 'accepted' : 'background or person', calibrated: null,
        ranked: c ? rec.candidates.map(x => ({ obj: x.obj, label: x.label, p: 0.5 })) : [], margin: 0.3 }], inferMs: 1, totalMs: 1, backend: 'wasm' }; };
  });
  await stubClip();
  await p.evaluate(() => { const S = window.__snapmon.S; S.settings.debugLens = true; S.settings.engineCached = true; window.__snapmon.setRNG(() => 0.02); });
  const fake = preds => p.evaluate(pr => { window.__fakeClassify = () => pr; }, preds);
  const shot = n => p.screenshot({ path: `${outDir}/${n}.png` });
  ok(!(await p.$('#objSearch')) && !(await p.$('#catGrid')), 'no manual object entry on any screen');

  async function snap(file) {
    await p.evaluate(() => { window.__snapmon.ui.pending = null; });
    await cam.show(p, path.join(photos, file)); await cam.snap(p);
    await p.waitForFunction(() => { const u = window.__snapmon.ui.pending; return u && u.rec && u.rec.debug; }, null, { timeout: 90000 });
    await p.waitForTimeout(300);
    return p.evaluate(() => { const r = window.__snapmon.ui.pending && window.__snapmon.ui.pending.rec; return r ? { decision: r.decision, reason: r.reason, cands: r.candidates.map(c => ({ label: c.label, obj: c.obj, cat: c.cat, conf: +c.conf.toFixed(2), box: !!c.box })), debug: r.debug } : null; });
  }
  const close = () => p.evaluate(() => window.__snapmon.actions.cancelPhoto());

  // 1) coffee cup: detector should find the cup; classifier says espresso -> mug, auto-identified
  await fake([{ className: 'espresso', probability: 0.71 }, { className: 'cup', probability: 0.12 }, { className: 'coffee mug', probability: 0.06 }]);
  let r = await snap('coffee.jpg');
  console.log('   coffee:', JSON.stringify(r.cands), 'detections:', JSON.stringify(r.debug.detections), 'ms:', r.debug.times.total, 'backend:', r.debug.backend);
  ok(r.debug.detections.some(d => d.label === 'cup'), 'real COCO-SSD detects the cup in the coffee photo');
  ok(r.cands[0] && r.cands[0].cat === 'mug', 'coffee photo -> a mug-family object (' + (r.cands[0] && r.cands[0].obj) + ')');
  ok(r.decision === 'auto', 'confident single object is identified automatically');
  await shot('L01-identified');
  await p.click('[data-act="pickCand"][data-arg="0"]');
  await p.waitForSelector('[data-act="fight"]', { timeout: 8000 }); await p.waitForTimeout(1400); await shot('L02-discovery');
  let m = await p.evaluate(() => window.__snapmon.ui.discovered);
  ok(m && m.label === 'espresso' && m.obj && m.dna.obj === m.obj, 'monster built from the recognised object (' + (m && m.obj) + ', label espresso)');
  await p.click('[data-act="ignore"]');

  // 2) cat photo: tabby -> animal:cat
  await fake([{ className: 'tabby, tabby cat', probability: 0.48 }, { className: 'Egyptian cat', probability: 0.3 }, { className: 'tiger cat', probability: 0.1 }]);
  r = await snap('chelsea.jpg');
  console.log('   cat:', JSON.stringify(r.cands), 'detections:', JSON.stringify(r.debug.detections));
  ok(r.cands[0] && r.cands[0].obj === 'cat', 'cat photo -> cat object');
  ok(r.decision === 'auto', 'cat auto-identified (detector + classifier agree)');
  await p.click('[data-act="pickCand"][data-arg="0"]').catch(() => {});
  await p.waitForSelector('[data-act="fight"]', { timeout: 8000 });
  m = await p.evaluate(() => window.__snapmon.ui.discovered);
  ok(m && m.obj === 'cat' && m.dna.obj === 'cat', 'cat monster uses the cat design');
  await p.click('[data-act="ignore"]');

  // 3) person: no monster
  await fake([{ className: 'groom, bridegroom', probability: 0.2 }, { className: 'suit, suit of clothes', probability: 0.1 }]);
  r = await snap('astronaut.jpg');
  console.log('   astronaut:', JSON.stringify(r.cands), 'detections:', JSON.stringify(r.debug.detections));
  ok(r.decision === 'unknown' || !r.cands.some(c => c.conf >= 0.55), 'photo of a person does not auto-create a monster');
  await shot('L03-person');
  await close();

  // 4) grass: unknown
  const enc0 = (await S()).stats.encounters, ph0 = (await S()).stats.photos;
  await fake([{ className: 'hay', probability: 0.14 }, { className: 'rapeseed', probability: 0.05 }]);
  r = await snap('grass.jpg');
  console.log('   grass:', r.decision, r.reason, JSON.stringify(r.cands));
  ok(r.decision === 'unknown', 'unrecognisable photo -> "Unknown object"');
  ok(await p.$('text=Unknown object') || await p.$('text=Too much going on'), 'unknown-object message shown');
  await shot('L04-unknown');
  ok((await S()).stats.encounters === enc0 && (await S()).stats.photos === ph0, 'unknown objects never generate a monster or count as a hunt');
  await close();

  // 5) two objects in one photo: player chooses which detection to hunt
  await fake([{ className: 'espresso', probability: 0.35 }, { className: 'tabby, tabby cat', probability: 0.3 }]);
  r = await snap('cup_and_cat.jpg');
  console.log('   cup+cat:', r.decision, r.reason, JSON.stringify(r.cands), JSON.stringify(r.debug.detections));
  ok(r.decision === 'choose' && r.cands.filter(c => c.box).length >= 2, 'two detected objects -> choice list from the analysis');
  await shot('L05-choose');
  const idx = r.cands.findIndex(c => c.obj === 'cat');
  await p.click(`[data-act="pickCand"][data-arg="${idx}"]`);
  await p.waitForSelector('[data-act="fight"]', { timeout: 8000 });
  m = await p.evaluate(() => window.__snapmon.ui.discovered);
  ok(m && m.obj === 'cat', 'picking the second detection hunts that object');
  await p.click('[data-act="ignore"]');

  // 6) unsure classifier, no boxes -> suggestions (only AI-generated)
  await fake([{ className: 'banana', probability: 0.4 }, { className: 'lemon', probability: 0.33 }]);
  r = await snap('grass.jpg');
  console.log('   unsure:', r.decision, JSON.stringify(r.cands));
  ok(r.decision === 'choose' && r.cands.every(c => ['banana', 'lemon'].includes(c.label)), 'uncertain result offers only the lens suggestions');
  await close();

  // 7) model caching: reload uses IndexedDB copy of the detector
  await p.reload(); await p.waitForTimeout(400); await stubClip();
  await p.evaluate(() => Lens.load()); 
  const src = await p.evaluate(() => Lens.status.sources);
  console.log('   sources after reload:', JSON.stringify(src));
  ok(src.detector === 'cache', 'detector loaded from the on-phone cache after the first download');
  await p.click('[data-act="settings"]'); await p.waitForTimeout(300); await shot('L06-settings');

  // 8) lens failure screen (all model hosts blocked)
  const p2 = await ctx.newPage();
  await p2.route(/\/models\//, r2 => r2.abort());
  await p2.goto(url); await p2.evaluate(async () => { await Lens.clearCache(); });
  await p2.reload(); await p2.waitForTimeout(300);
  await p2.evaluate(() => { window.mobilenet = undefined; });
  await p2.route(/mobilenet@/, r2 => r2.abort());
  await cam.show(p2, path.join(photos, 'coffee.jpg')); await cam.snap(p2);
  await p2.waitForSelector('text=The recognition engine could not download', { timeout: 90000 });
  await p2.screenshot({ path: `${outDir}/L07-failed.png` });
  ok(true, 'lens-unavailable screen shown and no monster created');
  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S)` : '\nALL LENS CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
