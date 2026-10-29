// v0.4.2 playtest fixes, in a phone-sized headless Chromium:
//   camera status text, zoom (viewfinder = captured photo), Settings stability, the Guide, rarity lore,
//   "Wrong object" before any encounter roll, and recovery of the recognition engine after background/resume.
// The TinyCLIP part runs in the REAL worker with the tiny colour test model (as in tests/e2e-engine.js); the
// detector/classifier part is stubbed so each case can be set up exactly.
// Usage: node tests/e2e-qol.js <url> <ort-dist-dir> <screenshot-dir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const cam = require('./fake-camera');
const [url, ortDir, outDir] = process.argv.slice(2);
const MODEL = path.join(__dirname, 'fixtures/testcolor-model');
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 870 }, isMobile: true, hasTouch: true });
  let camDelay = 0;
  await ctx.route(/\/models\/manifest\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ engine: 'hybrid-1', groups: { lens: 32610304, clip: 43725619 }, files: [] }) }));
  await ctx.route(/\/models\/clip\/tinyclip-39m16\//, r => { const f = r.request().url().split('/').pop(); r.fulfill({ path: path.join(MODEL, f) }); });
  await ctx.route(/\/vendor\/ort\//, r => r.fulfill({ path: path.join(ortDir, r.request().url().split('/').pop()) }));
  await ctx.route(/\/vendor\/tfjs\/|\/models\/(mobilenet|ssdlite)|cdn\.jsdelivr|tfhub|googleapis/, r => r.abort());
  await ctx.addInitScript(cam.init);
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
  const shot = n => p.screenshot({ path: `${outDir}/${n}.png` });
  const waitText = (re, timeout = 10000) => p.waitForFunction(src => new RegExp(src).test(document.querySelector('#overlay').textContent), re.source, { timeout });
  const leaveResult = async () => { if (await p.$('[data-act="ignore"]')) await p.click('[data-act="ignore"]'); else if (await p.$('[data-act="closeOverlay"]')) await p.click('[data-act="closeOverlay"]'); };
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));
  await p.goto(url); await p.waitForTimeout(400);
  // stubbed detector/classifier: `cands` are its candidates; `loads` counts (re)initialisations
  const stubLens = (cands, decision = 'auto') => p.evaluate(([cands, decision]) => {
    window.__lensLoads = window.__lensLoads || 0;
    Lens.load = async () => { window.__lensLoads++; await new Promise(r => setTimeout(r, 30)); Lens.status.state = 'ready'; Lens.status.backend = 'webgl'; Lens.status.lost = false; return true; };
    Lens.recognize = async img => {
      if (window.__lensFailOnce) { window.__lensFailOnce = false; throw new Error('WebGL context lost'); }
      const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').drawImage(img, 0, 0, 320, 240);
      return { decision, reason: decision === 'auto' ? 'confident' : 'low', candidates: cands.map(x => ({ ...x, cat: OBJECTS[x.obj].cat, src: 'photo' })), image: c, boxes: [],
        debug: { decision, reason: 'stub', thresholds: { min: .25, auto: .55, detMin: .45 }, times: { total: 3 }, sources: {}, backend: 'stub', full: [], detections: [], crops: [], candidates: [] } };
    };
  }, [cands, decision]);
  const blue = () => p.evaluate(() => new Promise(res => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d'); g.fillStyle = '#2350cd'; g.fillRect(0, 0, 320, 240); const i = new Image(); i.onload = () => { window.__cam.img = i; res(); }; i.src = c.toDataURL(); }));
  await stubLens([{ label: 'coffee mug', obj: 'mug', conf: 0.95, box: null }]);
  await p.evaluate(() => { window.__snapmon.S.settings.engineCached = true; window.__snapmon.setRNG(() => 0.01); });
  await p.evaluate(() => Engine.load());
  ok(await p.evaluate(() => Engine.status.state) === 'ready', 'engine ready (stub detector + real TinyCLIP worker)');

  /* ---- 1) "Starting camera…" only while the camera is really starting ---- */
  await p.evaluate(() => { const gum = navigator.mediaDevices.getUserMedia; navigator.mediaDevices.getUserMedia = async c => { await new Promise(r => setTimeout(r, window.__camDelay || 0)); return gum(c); }; window.__camDelay = 600; });
  await p.evaluate(() => { window.__snapmon.actions.openCamera(); }); // do not wait for the camera to finish starting
  await p.waitForTimeout(150);
  const during = await p.evaluate(() => { const s = document.querySelector('#camStatus'); return !!s && getComputedStyle(s).display !== 'none' && s.textContent.includes('Starting camera'); });
  ok(during && await p.$eval('#camShutter', e => e.disabled), 'while the camera starts: "Starting camera…" is shown and SNAP is disabled');
  await shot('Q01-camera-starting');
  await p.waitForSelector('#camShutter:not([disabled])', { timeout: 10000 });
  const after = await p.evaluate(() => { const s = document.querySelector('#camStatus'); const v = document.querySelector('#camVideo'); return { status: !!s && getComputedStyle(s).display !== 'none', frames: v.videoWidth > 0 && v.readyState >= 2 }; });
  ok(!after.status && after.frames, 'once frames are showing, the status text is gone (it used to stay: CSS display:grid overrode [hidden])');
  await shot('Q02-camera-live');
  await p.click('[data-act="camClose"]');
  await p.evaluate(() => { window.__camDelay = 0; });
  await p.evaluate(() => window.__snapmon.actions.openCamera()); await p.waitForSelector('#camShutter:not([disabled])');
  ok(!(await p.$('#camStatus')) && await cam.live(p) === 1, 'reopening the camera: status resets and disappears again; one live stream');
  await p.click('[data-act="camClose"]');
  ok(await cam.live(p) === 0, 'closing the camera releases the stream');
  await p.evaluate(() => { window.__cam.deny = 'NotAllowedError'; });
  await p.evaluate(() => window.__snapmon.actions.openCamera()); await p.waitForSelector('text=Camera permission is off');
  ok(!(await p.$('#camStatus')), 'a camera failure shows the error, not "Starting camera…"');
  await p.evaluate(() => { window.__cam.deny = null; }); await p.click('[data-act="closeOverlay"]');

  /* ---- 2) zoom: controls, and the captured photo is exactly what the viewfinder shows ---- */
  // test pattern: a red centre square on blue; at 2× digital zoom the capture must be mostly the red centre
  await p.evaluate(() => new Promise(res => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; const g = c.getContext('2d'); g.fillStyle = '#1030c0'; g.fillRect(0, 0, 640, 480); g.fillStyle = '#e02020'; g.fillRect(240, 160, 160, 160); const i = new Image(); i.onload = () => { window.__cam.img = i; res(); }; i.src = c.toDataURL(); }));
  await p.evaluate(() => window.__snapmon.actions.openCamera()); await p.waitForSelector('#camShutter:not([disabled])');
  const z = await p.evaluate(() => Platform.camera.zoomInfo());
  ok(!(await p.$eval('#zoomRow', e => e.hidden)) && z.kind === 'digital' && z.max === 3, `zoom controls shown (this camera: ${z.kind} zoom, up to ${z.max}×)`);
  const redShare = () => p.evaluate(() => { const v = document.querySelector('#camVideo'); const c = Platform.camera.capture(v); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let red = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 2] < 100) red++; return { share: red / (d.length / 4), w: c.width, h: c.height, vis: Platform.camera.visibleRect(v) }; });
  const r1 = await redShare();
  await p.click('[data-act="camZoom"][data-arg="+"]'); await p.click('[data-act="camZoom"][data-arg="+"]'); await p.waitForTimeout(100);
  await p.evaluate(() => window.__snapmon.ui.camZoom.apply(2)); await p.waitForTimeout(150);
  const r2 = await redShare();
  ok(Math.abs(r1.vis.w / r2.vis.w - 2) < 0.01 && r2.share > r1.share * 2.5, `at 2× the capture covers half the width and the centre object fills more of it (red ${Math.round(r1.share * 100)}% → ${Math.round(r2.share * 100)}%)`);
  ok(await p.$eval('#zoomVal', e => e.textContent) === '2.0×' && /scale\(2\)/.test(await p.$eval('#camVideo', e => e.style.transform)), 'the preview shows the same 2× zoom');
  await shot('Q03-zoom-2x');
  // the photo handed to recognition is the zoomed one
  await stubLens([{ label: 'coffee mug', obj: 'mug', conf: 0.95, box: null }]);
  await p.evaluate(() => { const orig = Lens.recognize; Lens.recognize = async img => { window.__recSize = [img.width, img.height]; return orig(img); }; });
  await p.click('#camShutter'); await p.waitForSelector('text=Object identified');
  const recSize = await p.evaluate(() => window.__recSize);
  ok(recSize && Math.abs(recSize[0] - Math.round(r2.vis.w)) <= 1, `recognition receives the zoomed photo (${recSize} = visible region ${Math.round(r2.vis.w)}×${Math.round(r2.vis.h)})`);
  ok(await cam.live(p) === 0, 'camera released after the zoomed shot');
  await p.click('[data-act="cancelPhoto"]');

  /* ---- 3) "Wrong object": possible before any encounter roll ---- */
  const before = await S();
  // high-confidence WRONG answer (air freshener read as a coffee mug); TinyCLIP proposed other objects too
  await blue(); await cam.snap(p);
  await p.waitForSelector('text=Object identified'); await p.waitForTimeout(1200); await shot('Q04-identified-countdown');
  ok(!!(await p.$('[data-act="wrongObject"]')), '"Wrong object" is offered even for a 95% confident identification');
  await p.click('[data-act="wrongObject"]');
  await waitText(/SnapMon couldn't identify this object|Which one is it\?/);
  await p.waitForTimeout(4000); // longer than the countdown: nothing may start in the background
  let st = await S();
  ok(st.stats.encounters === before.stats.encounters && st.stats.photos === before.stats.photos && st.monsters.length === before.monsters.length && !(await p.$('[data-act="fight"]')), 'after rejecting: no encounter roll, no monster, no photo counted');
  const altsShown = await p.$$eval('[data-act="pickAlt"]', els => els.map(e => e.textContent));
  ok(!altsShown.some(t => /coffee mug/i.test(t)), `the rejected object is not offered again (alternatives: ${altsShown.length ? altsShown.join(' | ') : 'none'})`);
  await shot('Q05-after-reject');
  const rej = await p.evaluate(() => JSON.parse(localStorage.getItem('snapmon.rejections.v1') || '[]'));
  ok(rej.length === 1 && rej[0].rejected[0] === 'mug', 'the rejection is logged locally for field tests (no upload)');
  // retake after rejecting
  await p.click('[data-act="retakePhoto"]'); await p.waitForSelector('#camShutter:not([disabled])');
  ok(await cam.live(p) === 1, 'Retake opens the live camera');
  // wrong answer WITH alternatives from the models: pick one -> that object is hunted, never the rejected one
  await stubLens([{ label: 'coffee mug', obj: 'mug', conf: 0.93, box: null }, { label: 'water bottle', obj: 'bottle', conf: 0.31, box: null }]);
  await p.click('#camShutter'); await p.waitForSelector('text=Object identified');
  await p.click('[data-act="wrongObject"]'); await p.waitForSelector('text=Which one is it?');
  const alts = await p.$$eval('[data-act="pickAlt"]', els => els.map(e => e.textContent));
  await p.waitForTimeout(500); await shot('Q06-alternatives'); ok(alts.length >= 1 && alts.some(t => /bottle/i.test(t)) && !alts.some(t => /coffee mug/i.test(t)), `genuine alternatives from the recogniser are offered (${alts.join(' | ')})`);
  await shot('Q06-alternatives');
  const altIdx = alts.findIndex(t => /bottle/i.test(t));
  await p.click(`[data-act="pickAlt"][data-arg="${altIdx}"]`);
  await waitText(/Fight!|All quiet|Already scanned/, 8000);
  const disc = await p.evaluate(() => window.__snapmon.ui.discovered);
  st = await S();
  ok(st.stats.photos === before.stats.photos + 1 && (!disc || disc.obj === 'bottle'), `picking an alternative hunts that object (${disc ? disc.obj : 'no monster this time'})`);
  await leaveResult();
  // repeated rejection: rejecting the alternatives too ends with a retake, never an encounter
  const before2 = await S();
  await stubLens([{ label: 'coffee mug', obj: 'mug', conf: 0.93, box: null }, { label: 'water bottle', obj: 'bottle', conf: 0.31, box: null }]);
  await cam.snap(p); await p.waitForSelector('text=Object identified');
  await p.click('[data-act="wrongObject"]'); await p.waitForSelector('text=Which one is it?');
  await p.click('[data-act="retakePhoto"]'); await p.waitForSelector('#camShutter:not([disabled])'); await p.click('[data-act="camClose"]');
  st = await S();
  ok(st.stats.photos === before2.stats.photos && st.stats.encounters === before2.stats.encounters, 'rejecting every suggestion creates nothing and counts no photo');
  // the countdown pauses when the player touches the screen, and Scan still works afterwards
  await stubLens([{ label: 'coffee mug', obj: 'mug', conf: 0.95, box: null }]);
  await cam.snap(p); await p.waitForSelector('text=Object identified');
  await p.tap('#lensFrame'); await p.waitForTimeout(4200);
  ok(!!(await p.$('text=Object identified')) && /Paused/.test(await p.textContent('#confirmHint')), 'touching the result pauses the countdown, so the player can read and decide');
  // a CORRECT identification: just wait, the hunt continues by itself
  await p.click('[data-act="cancelPhoto"]');
  const before3 = await S();
  await cam.snap(p); await p.waitForSelector('text=Object identified');
  await p.waitForSelector('text=Scanning for supernatural activity', { timeout: 6000 });
  await waitText(/Fight!|All quiet|Already scanned/, 8000);
  st = await S();
  ok(st.stats.photos === before3.stats.photos + 1, 'a correct identification continues to the scan automatically after the short countdown');

  /* ---- 4) lore on the discovery screen reflects rarity ---- */
  const m = await p.evaluate(() => window.__snapmon.ui.discovered);
  if (m) {
    ok(typeof m.lore === 'string' && m.lore.length > 20 && (await p.textContent('.overlay')).includes(m.lore), 'the discovery screen shows the monster\'s own stored flavour text');
    await shot('Q07-discovery-lore');
    await p.click('[data-act="ignore"]');
  } else await leaveResult();
  const legend = await p.evaluate(() => { const S = window.__snapmon.S; const m = createMonster(S, { obj: 'apple', cat: 'fruit', rarity: 'legendary', photo: { hue: 0, sat: .8, lit: .45, pal: { conf: 'confident', method: 'box+bg', primary: [2, 80, 45], secondary: [20, 60, 30], highlight: [6, 75, 68], shadow: [0, 70, 22] } } }); window.__snapmon.ui.discovered = m; showDiscovery(m, { isNew: false }); return m; });
  await p.waitForTimeout(800); await shot('Q08-legendary-apple');
  ok(!(await p.textContent('.overlay')).includes('One bad apple spoils the bunch. This is the bad apple.') && (await p.textContent('.overlay')).includes(legend.lore), 'a Legendary apple shows its own Legendary text, not the shared Common apple text');
  console.log('   Legendary apple:', legend.name, '—', legend.lore);
  await p.click('[data-act="ignore"]');

  /* ---- 5) Settings: toggles and engine progress never rebuild the sheet or jump to the top ---- */
  await p.click('[data-act="settings"]'); await p.waitForSelector('.sheet');
  await p.evaluate(() => { const s = document.querySelector('.sheet'); s.scrollTop = s.scrollHeight; });
  await p.fill('#importBox', 'half-typed text');
  const marker = await p.evaluate(() => { const s = document.querySelector('.sheet'); s.__marker = 1; return s.scrollTop; });
  for (let i = 0; i < 5; i++) await p.evaluate(() => window.__snapmon.actions.toggleKeep(null, document.querySelector('[data-act="toggleKeep"]')));
  const afterToggle = await p.evaluate(() => { const s = document.querySelector('.sheet'); return { same: s.__marker === 1, top: s.scrollTop, keep: window.__snapmon.S.settings.keepPhotos, cls: document.querySelector('[data-act="toggleKeep"]').classList.contains('on') }; });
  ok(afterToggle.same && Math.abs(afterToggle.top - marker) < 2 && afterToggle.keep === true && afterToggle.cls, `rapid toggling keeps the sheet and its scroll position (${marker} → ${afterToggle.top}) and the setting is applied`);
  await p.evaluate(() => { const s = document.querySelector('.sheet'); s.scrollTop = s.scrollHeight; });
  const viewPos = () => p.evaluate(() => { const s = document.querySelector('.sheet'), r = document.querySelector('#importBox').getBoundingClientRect(); return r.top - s.getBoundingClientRect().top; });
  const top2 = await viewPos();
  // real engine status changes while Settings is open: reloads and a full load with its progress events
  const emits = await p.evaluate(async () => { let n = 0; const off = Engine.onChange(() => n++); for (let i = 0; i < 8; i++) { Engine.setClipGPU(false); await new Promise(r => requestAnimationFrame(r)); } await Engine.load(); await new Promise(r => setTimeout(r, 100)); off(); return n; });
  const afterProgress = await p.evaluate(() => { const s = document.querySelector('.sheet'); return { same: s.__marker === 1, typed: document.querySelector('#importBox').value }; });
  const pos2 = await viewPos();
  ok(emits >= 10 && afterProgress.same && Math.abs(pos2 - top2) < 3 && afterProgress.typed === 'half-typed text', `${emits} engine status updates did not rebuild Settings, move what is on screen (${Math.round(top2)} → ${Math.round(pos2)} px), or erase typed text`);
  // a structural change (open developer tools) updates in place too
  await p.evaluate(() => { window.__snapmon.S.settings.devUnlocked = true; window.__snapmon.S.settings.devOpen = false; });
  await p.evaluate(() => settingsSheet());
  const st3 = await p.evaluate(() => { const s = document.querySelector('.sheet'); return { same: s.__marker === 1, typed: document.querySelector('#importBox').value }; });
  ok(st3.same && st3.typed === 'half-typed text', 'refreshing Settings (e.g. developer tools appearing) keeps the sheet and typed text');
  await shot('Q09-settings-bottom');
  await p.click('.sheet [data-act="closeSheet"]');

  /* ---- 6) the Guide ---- */
  await p.click('[data-act="guide"]'); await p.waitForSelector('.guide-sec');
  const secs = await p.$$eval('.guide-sec summary', e => e.map(x => x.textContent));
  ok(secs.length >= 10 && secs.some(s => /Status effects/.test(s)) && secs.some(s => /Capturing/.test(s)), `Guide opens from the top bar with ${secs.length} sections`);
  await p.click('.guide-sec[data-sec="status"] summary'); await p.waitForTimeout(150);
  const statusText = await p.textContent('.guide-sec[data-sec="status"]');
  ok(/7% of max HP/.test(statusText) && /Antidote/.test(statusText) && /next 3 turns/.test(statusText), 'status effects show the real numbers, durations and counters');
  ok(await p.evaluate(() => document.querySelector('.sheet').scrollWidth <= document.querySelector('.sheet').clientWidth + 1), 'the Guide fits the phone width (tables scroll inside their own box)');
  await shot('Q10-guide-status');
  await p.goBack({ waitUntil: 'commit', timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300);
  ok(!(await p.$('.guide-sec')) && (await p.title()).includes('SNAPMON'), 'Android Back closes the Guide and stays in the game');

  /* ---- 7) background / resume: the engine recovers without a page reload ---- */
  // a) GPU context lost while in the background -> detected on resume, reloaded from the cache
  const loads0 = await p.evaluate(() => window.__lensLoads);
  await p.evaluate(async () => { Lens.status.lost = true; document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 50)); });
  await p.waitForFunction(() => Engine.status.state === 'ready' && !Lens.status.lost, null, { timeout: 30000 });
  ok(await p.evaluate(() => window.__lensLoads) === loads0 + 1 && await p.evaluate(() => ClipLens.status.info.fromCache) === true, 'resume after a lost GPU context: the engine reloads itself from the phone\'s cache');
  // b) the TinyCLIP worker died in the background -> the ping notices, the worker is restarted
  await p.evaluate(() => { ClipLens.status.worker.terminate(); });
  const healthy = await p.evaluate(async () => { await Engine.check(); return Engine.status.state; });
  ok(healthy === 'ready' && await p.evaluate(() => ClipLens.ping()), 'a stopped TinyCLIP worker is detected and restarted');
  // c) a hunt fails because the engine broke while nobody looked -> automatic recovery, the photo still works
  await stubLens([{ label: 'coffee mug', obj: 'mug', conf: 0.95, box: null }]);
  await p.evaluate(() => { window.__lensFailOnce = true; });
  const rec = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').fillRect(0, 0, 320, 240); try { const r = await Engine.recognize(c); return { ok: true, d: r.rec.decision, rec: Engine.status.recoveries }; } catch (e) { return { ok: false, e: e.message }; } });
  ok(rec.ok && rec.d === 'auto', 'a recognition that fails on a broken engine is recovered and retried once (same models)');
  // d) two recoveries at the same time do not initialise the engine twice
  const l1 = await p.evaluate(() => window.__lensLoads);
  await p.evaluate(() => Promise.all([Engine.recover('a'), Engine.recover('b'), Engine.check()]));
  ok(await p.evaluate(() => window.__lensLoads) === l1 + 1 && await p.evaluate(() => Engine.status.state) === 'ready', 'concurrent recovery requests share one reinitialisation');
  // e) initialisation fails -> clear message; Retry genuinely reinitialises (no page reload)
  await p.evaluate(() => { ClipLens.CFG.test = { failCPU: 'simulated CPU failure' }; Engine.status.state = 'failed'; });
  await blue(); await cam.snap(p);
  await p.waitForSelector("text=couldn't run on this device", { timeout: 30000 });
  ok(!(await p.$('[data-act="fight"]')), 'failed initialisation: message and no monster');
  await p.evaluate(() => { ClipLens.CFG.test = null; });
  const l2 = await p.evaluate(() => window.__lensLoads);
  await p.click('[data-act="lensRetry"]');
  await p.waitForSelector('text=Object identified', { timeout: 30000 });
  ok(await p.evaluate(() => window.__lensLoads) === l2 + 1, 'Retry reinitialises both parts of the engine and the same photo is recognised');
  await p.click('[data-act="cancelPhoto"]');
  // f) game state survived all of this
  ok((await S()).stats.photos >= before.stats.photos, 'progress kept through recovery');

  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S)` : '\nALL v0.4.2 CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
