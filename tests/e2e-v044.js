// v0.4.4: (1) the Analysing screen is painted before CPU-heavy recognition starts (the Force CPU shutter freeze),
// (2) the developer Quick Monster Test Mode is retired (2026-11-26; replaced by the real-save developer tools, tested in
// tests/e2e-devtools.js): no test-mode switches remain, hunts are always normal hunts, Wrong object / unknown come first.
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

  /* ---- 2) Quick Monster Test Mode is retired (2026-11-26): no test-mode switches, hunts are always normal hunts ---- */
  await p.evaluate(() => { const st = window.__snapmon.S.settings; st.devUnlocked = true; st.devOpen = true; st.quickTest = true; st.instantCapture = true; }); // an old save's stored switches
  await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="devSpawn"]');
  ok(!(await p.$('[data-act="toggleQuickTest"]')) && !(await p.$('[data-act="toggleInstantCapture"]')) && !(await p.$('[data-act="testCollection"]')) && !(await p.$('[data-act="testClear"]')), 'the developer menu no longer has Quick Monster Test Mode, Instant capture or the test collection');
  ok(!!(await p.$('[data-act="toggleFieldTest"]')) && !!(await p.$('[data-act="toggleDebug"]')), 'Field-test mode and recognition debug info are still there');
  await p.click('.sheet [data-act="closeSheet"]');
  ok(!(await p.$('.test-banner')), 'no test-mode banner on the Hunt screen, even with an old save\'s quickTest switch still stored');
  // the stored old switch has no effect: a forced "no encounter" roll finds nothing, and the photo is counted
  await p.evaluate(() => window.__snapmon.setRNG(() => 0.999));
  let s0 = await S();
  await cam.snap(p); await p.waitForSelector('text=Object identified'); await p.click('[data-act="pickCand"]');
  await waitText(/All quiet|Already scanned|Fight!/, 8000); // (the very first photo of a save always finds a monster)
  const s1 = await S();
  ok(s1.stats.photos === s0.stats.photos + 1 && !(await p.evaluate(() => /TEST MONSTER|test collection/i.test(document.querySelector('#overlay').textContent))), 'a hunt is a normal hunt: counted, the normal roll, no test monster');
  ok(await p.evaluate(() => localStorage.getItem('snapmon.testroster.v1') === null), 'nothing is written to the retired test-roster storage');
  if (await p.$('[data-act="ignore"]')) await p.click('[data-act="ignore"]'); else await p.click('[data-act="closeOverlay"]');
  // Wrong object and unknown still come first: no monster
  await p.evaluate(() => { window.__snapmon.S.enc.disturbed = {}; window.__snapmon.S.enc.quiet = {}; window.__snapmon.setRNG(() => 0.01); });
  s0 = await S();
  await cam.snap(p); await p.waitForSelector('text=Object identified');
  await p.click('[data-act="wrongObject"]'); await waitText(/Which one is it|couldn't identify/, 5000);
  await p.click('[data-act="cancelPhoto"]').catch(() => {});
  await stubLens([], 'unknown');
  await cam.snap(p); await waitText(/Unknown object|Could it be|few ideas|Object identified|disagree/, 8000);
  await p.waitForTimeout(3000); // whatever the engine shows, nothing happens until the player accepts something
  await p.click('[data-act="cancelPhoto"]');
  ok((await S()).stats.encounters === s0.stats.encounters, 'rejected (Wrong object) and unknown photos create no encounter');

  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S)` : '\nALL v0.4.4 CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
