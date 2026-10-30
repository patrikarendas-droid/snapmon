// v0.4.4: (1) the Analysing screen is painted before CPU-heavy recognition starts (the Force CPU shutter freeze),
// (2) developer Quick Monster Test Mode: guaranteed test monsters only after an accepted identification, isolated from
// the real save, instant capture without rewards, test battles undone afterwards.
// A headless browser cannot show the Android graphics glitch itself; this checks the order of events that caused it.
// Usage: node tests/e2e-v044.js <url> <ort-dist-dir> <screenshot-dir>
const { chromium } = require('playwright');
const path = require('path');
const cam = require('./fake-camera');
const [url, ortDir, outDir] = process.argv.slice(2);
const MODEL = path.join(__dirname, 'fixtures/testcolor-model');
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 870 }, isMobile: true, hasTouch: true });
  await ctx.route(/\/models\/manifest\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ engine: 'hybrid-1', groups: { lens: 32610304, clip: 43725619 }, files: [] }) }));
  await ctx.route(/\/models\/clip\/tinyclip-39m16\//, r => r.fulfill({ path: path.join(MODEL, r.request().url().split('/').pop()) }));
  await ctx.route(/\/vendor\/ort\//, r => r.fulfill({ path: path.join(ortDir, r.request().url().split('/').pop()) }));
  await ctx.route(/\/vendor\/tfjs\/|\/models\/(mobilenet|ssdlite)|cdn\.jsdelivr|tfhub|googleapis/, r => r.abort());
  await ctx.addInitScript(cam.init);
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
  const shot = n => p.screenshot({ path: `${outDir}/${n}.png` });
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));
  const roster = () => p.evaluate(() => TestRoster.list().length);
  const waitText = (re, timeout = 10000) => p.waitForFunction(src => new RegExp(src).test(document.querySelector('#overlay').textContent), re.source, { timeout });
  await p.goto(url); await p.waitForTimeout(400);
  // detector/classifier stub; `cpuBusyMs` blocks the main thread synchronously like TF.js on the CPU backend
  const stubLens = (cands, decision = 'auto', cpuBusyMs = 0) => p.evaluate(([cands, decision, cpuBusyMs]) => {
    Lens.load = async () => { Lens.status.state = 'ready'; Lens.status.backend = cpuBusyMs ? 'cpu' : 'webgl'; return true; };
    Lens.recognize = async img => {
      const img0 = document.querySelector('#lensFrame img');
      window.__atRecognize = { frames: window.__framesSinceAnalysing || 0, decoded: !!(img0 && img0.complete && img0.naturalWidth > 0), camLive: window.__cam.tracks.filter(t => t.readyState === 'live').length };
      const t = performance.now(); while (performance.now() - t < cpuBusyMs) {} // CPU backend: synchronous work on the main thread
      const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').drawImage(img, 0, 0, 320, 240);
      return { decision, reason: decision === 'auto' ? 'confident' : 'low', candidates: cands.map(x => ({ ...x, cat: OBJECTS[x.obj].cat, src: 'photo' })), image: c, boxes: [],
        debug: { decision, reason: 'stub', thresholds: { min: .25, auto: .55, detMin: .45 }, times: { total: 3 }, sources: {}, backend: 'stub', full: [], detections: [], crops: [], candidates: [] } };
    };
  }, [cands, decision, cpuBusyMs]);
  // count painted frames from the moment the Analysing screen is inserted
  await p.evaluate(() => {
    new MutationObserver(() => {
      if (document.querySelector('#lensClock') && !window.__countingFrames) {
        window.__countingFrames = true; window.__framesSinceAnalysing = 0;
        const tick = () => { if (!document.querySelector('#lensClock')) { window.__countingFrames = false; return; } window.__framesSinceAnalysing++; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
    }).observe(document.querySelector('#overlay'), { childList: true, subtree: true });
  });
  await stubLens([{ label: 'light switch', obj: 'x_light_switch', conf: 0.95, box: null }], 'auto', 900);
  await p.evaluate(async () => { window.__snapmon.S.settings.engineCached = true; Engine.setForceCPU(true); await Engine.load(); });
  ok(await p.evaluate(() => Engine.ready() && Lens.status.backend === 'cpu'), 'engine ready with the detector on the CPU backend (Force CPU)');

  /* ---- 1) Force CPU shutter: the Analysing screen is on screen before the CPU work starts ---- */
  await cam.snap(p);
  await p.waitForSelector('text=Object identified', { timeout: 20000 });
  const at = await p.evaluate(() => window.__atRecognize);
  ok(at && at.frames >= 2 && at.decoded, `the photo was decoded and the Analysing screen painted (${at && at.frames} frames) before the CPU detector started`);
  ok(at && at.camLive === 0 && await cam.live(p) === 0, 'the camera was released after that paint, before recognition (no live stream during the CPU work)');
  const sweep = await p.evaluate(() => { const el = document.createElement('i'); el.className = 'vf-sweep'; document.body.appendChild(el); const st = getComputedStyle(el); const r = { name: st.animationName, transform: st.transform }; el.remove(); return r; });
  ok(sweep.name === 'sweep' && sweep.transform !== 'none', 'the scan sweep animates with transform (a compositor animation keeps moving while the main thread is busy)');
  const times = await p.evaluate(() => window.__snapmon.ui.snapTimes);
  ok(times && times.paintMs >= 0, `timings for the developer panel: Analysing screen after ${times && times.paintMs} ms`);
  await p.click('[data-act="cancelPhoto"]');
  await p.evaluate(async () => { Engine.setForceCPU(false); await Engine.load(); });
  await stubLens([{ label: 'light switch', obj: 'x_light_switch', conf: 0.95, box: null }]);

  /* ---- 2) Quick Monster Test Mode ---- */
  ok(!(await S()).settings.quickTest && !(await p.$('.test-banner')), 'Quick Monster Test Mode is off by default');
  // off: the normal encounter roll applies (RNG forced high -> no monster)
  await p.evaluate(() => window.__snapmon.setRNG(() => 0.999));
  let s0 = await S();
  await cam.snap(p); await p.waitForSelector('text=Object identified'); await p.click('[data-act="pickCand"]');
  await waitText(/All quiet|Already scanned|Fight!/, 8000); // (the very first photo of a save always finds a monster)
  ok((await S()).stats.photos === s0.stats.photos + 1 && await roster() === 0, 'with the mode off a hunt is a normal hunt (counted, normal odds), nothing goes to the test roster');
  if (await p.$('[data-act="ignore"]')) await p.click('[data-act="ignore"]'); else await p.click('[data-act="closeOverlay"]');
  // turn it on from the developer menu
  await p.evaluate(() => { window.__snapmon.S.settings.devUnlocked = true; window.__snapmon.S.settings.devOpen = true; });
  await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="toggleQuickTest"]');
  await p.click('[data-act="toggleQuickTest"]');
  ok(await p.$eval('[data-act="toggleInstantCapture"]', e => e.classList.contains('on')), 'instant capture is on by default inside test mode');
  await p.$eval('[data-act="toggleQuickTest"]', e => e.scrollIntoView()); await shot('T01-dev-test-mode');
  await p.click('.sheet [data-act="closeSheet"]');
  ok(!!(await p.$('.test-banner')), 'the Hunt screen shows that Quick Monster Test Mode is on');
  // guaranteed monster after an accepted identification, even with the RNG forced to "no encounter"
  s0 = await S();
  await cam.snap(p); await p.waitForSelector('text=Object identified');
  const accepted = await p.evaluate(() => window.__snapmon.ui.pending.rec.candidates[0].obj);
  await p.click('[data-act="pickCand"]');
  await waitText(/Added to the test collection/, 8000); await p.waitForTimeout(1300); await shot('T02-test-monster');
  let s1 = await S();
  const strip = s => JSON.stringify({ ...s, lastTick: 0, settings: 0 });
  ok(await roster() === 1 && strip(s1) === strip(s0), 'accepted photo -> guaranteed test monster in the test collection; the real save is unchanged (photos, pity, dex, coins, items)');
  const tm = await p.evaluate(() => TestRoster.list()[0]);
  ok(tm.test && tm.obj === accepted && tm.dna.obj === accepted && tm.lore && tm.lore === tm.lore.trim(), `the test monster is made from the accepted object with the real design, name and lore (${accepted} -> ${tm.name})`);
  // Wrong object and unknown still come first: no monster
  await p.click('[data-act="testCollection"]').catch(() => {}); await p.waitForTimeout(200); await p.click('.sheet [data-act="closeSheet"]').catch(() => {});
  await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.render(); });
  await cam.snap(p); await p.waitForSelector('text=Object identified');
  await p.click('[data-act="wrongObject"]'); await waitText(/Which one is it|couldn't identify/, 5000);
  await p.click('[data-act="cancelPhoto"]').catch(() => {});
  await stubLens([], 'unknown');
  await cam.snap(p); await waitText(/Unknown object|Could it be|few ideas|Object identified|disagree/, 8000);
  await p.waitForTimeout(3000); // whatever the engine shows, nothing happens until the player accepts something
  await p.click('[data-act="cancelPhoto"]');
  ok(await roster() === 1, 'rejected (Wrong object) and unknown photos create no test monster');
  // instant capture off: a test battle; everything is undone afterwards, a capture goes to the test roster
  await stubLens([{ label: 'security camera', obj: 'x_security_camera', conf: 0.95, box: null }]);
  await p.evaluate(() => { window.__snapmon.S.settings.instantCapture = false; });
  await p.evaluate(() => window.__snapmon.setRNG(() => 0.01));
  s0 = await S();
  await cam.snap(p); await p.waitForSelector('text=Object identified'); await p.click('[data-act="pickCand"]');
  await waitText(/Test fight/, 8000);
  await p.click('[data-act="fight"]'); await p.waitForSelector('#actions');
  for (let i = 0; i < 25 && await p.evaluate(() => !!window.__snapmon.ui.battle); i++) {
    await p.evaluate(() => { const B = window.__snapmon.ui.battle; if (B) { B.enemy.hp = 1; B.disp.enemy = 1; } });
    await p.click('[data-act="bCapture"]').catch(() => {});
    await p.waitForFunction(() => !window.__snapmon.ui.busy || !window.__snapmon.ui.battle, null, { timeout: 15000 });
  }
  await waitText(/Test capture|Test battle over/, 15000); await shot('T03-test-battle');
  s1 = await S();
  ok(strip(s1) === strip(s0) && s1.items.trap === s0.items.trap && s1.hp === s0.hp, 'after a test battle the real save is exactly as before (traps, HP, coins, XP, stats)');
  ok(await roster() === 2, 'the monster captured in the test battle went to the test collection, not the real one');
  ok(await p.evaluate(() => { const raw = localStorage.getItem('snapmon.save.v1'); return !raw.includes('test-'); }), 'no test monster ever reaches the stored save');
  await p.click('[data-act="closeOverlay"]');
  // the test collection can be viewed and cleared
  await p.click('[data-act="settings"]'); await p.click('[data-act="testCollection"]'); await p.waitForSelector('[data-act="testView"]');
  await p.click('[data-act="testView"]'); await p.waitForSelector('text=TEST MONSTER · NOT PART OF YOUR COLLECTION'); await shot('T04-test-monster-sheet');
  await p.click('.sheet [data-act="testCollection"]'); await p.click('.sheet [data-act="closeSheet"]');
  await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="testClear"]');
  await p.click('[data-act="testClear"]'); await p.click('[data-act="testClear"]');
  ok(await roster() === 0, 'the test collection can be cleared');
  // turning the mode off restores normal hunting
  await p.click('[data-act="toggleQuickTest"]'); await p.click('.sheet [data-act="closeSheet"]');
  await p.evaluate(() => window.__snapmon.setRNG(() => 0.999));
  s0 = await S();
  await cam.snap(p); await p.waitForSelector('text=Object identified'); await p.click('[data-act="pickCand"]');
  await waitText(/All quiet|Already scanned|Fight!/, 8000);
  ok(!(await p.$('.test-banner')) && (await S()).stats.photos === s0.stats.photos + 1 && await roster() === 0, 'turning the mode off returns to normal hunts (counted, normal odds, nothing in the test roster)');

  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S)` : '\nALL v0.4.4 CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
