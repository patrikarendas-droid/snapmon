// The Android app's packaged web game (android-app/www, built by tools/android/build-web.js) in headless Chromium,
// with a FAKE Capacitor bridge: the SaveStore plugin is a Node-side map (standing in for the app's private files) and
// the App plugin records listeners. This checks the shared game + native boot logic, NOT a real Android WebView or
// phone (the CI emulator smoke test and the owner's phone test cover those).
// Covers: fresh install = brand-new player, nothing loaded from the network (fonts, models, runtimes all local),
// no download notice, engine starts by itself from the bundled files with no second browser-cache copy, saves are
// mirrored to the native store and restored when WebView storage is lost, the newer copy wins in both directions,
// hardware Back (close → Hunt → double-Back exit after saves are flushed), pause closes the camera and saves,
// native camera-permission text, development-build label.
// Usage: node tests/e2e-android-web.js <www-dir> <screenshot-dir>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const cam = require('./fake-camera');
const [wwwDir, outDir] = process.argv.slice(2);
const WWW = path.resolve(wwwDir || 'android-app/www');
fs.mkdirSync(outDir || 'shots', { recursive: true });
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.wasm': 'application/wasm', '.json': 'application/json',
  '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.onnx': 'application/octet-stream', '.bin': 'application/octet-stream', '.md': 'text/markdown', '.txt': 'text/plain' };

// the fake native side
const store = new Map(); let failSets = false, setCalls = 0;
const FAKE_CAP = `window.__app = { listeners: {}, exited: 0 };
window.Capacitor = { isNativePlatform: () => true, registerPlugin: name => {
  if (name === 'SnapmonSaveStore') return { set: a => window.__nativeStore('set', a), remove: a => window.__nativeStore('remove', a), getAll: () => window.__nativeStore('getAll', {}) };
  if (name === 'App') return { addListener: (ev, fn) => { (window.__app.listeners[ev] = window.__app.listeners[ev] || []).push(fn); return Promise.resolve({ remove() {} }); }, exitApp: () => { window.__app.exited++; } };
  return {};
} };`;

(async () => {
  // like Capacitor's WebViewLocalServer: a path whose last segment has no "." is answered with index.html when
  // server.html5mode is on (Capacitor's default) and not served at all otherwise — which broke the extensionless TF.js
  // weight shards in the real app (emulator test, CI runs 2–3) until build-web.js gave them a ".bin" name
  const capCfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../android-app/capacitor.config.json'), 'utf8'));
  const html5mode = !(capCfg.server && capCfg.server.html5mode === false);
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const noExt = !u.endsWith('/') && !u.split('/').pop().includes('.');
    if (noExt && !html5mode) { res.writeHead(404); return res.end(); }
    const f = path.join(WWW, u.endsWith('/') || noExt ? (u.endsWith('/') ? u : '/') + 'index.html' : u);
    if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  const base = `http://localhost:${server.address().port}/`;
  const realEngine = fs.statSync(path.join(WWW, 'models/clip/tinyclip-39m16/vision.onnx')).size > 5e6;
  const b = await chromium.launch();
  const external = [];
  async function app(opts = {}) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 870 }, isMobile: true, hasTouch: true });
    await ctx.exposeBinding('__nativeStore', async (_src, op, a) => {
      if (op === 'set') { setCalls++; if (failSets) throw new Error('simulated disk failure'); store.set(a.key, { rev: a.rev, value: a.value }); return null; }
      if (op === 'remove') { store.delete(a.key); return null; }
      return { entries: Object.fromEntries(store) };
    });
    await ctx.route(/\/native\/capacitor\.js$/, r => r.fulfill({ contentType: 'application/javascript', body: FAKE_CAP }));
    await ctx.addInitScript(cam.init);
    const page = await ctx.newPage();
    page.on('request', r => { const h = new URL(r.url()).hostname; if (!/^(localhost|127\.0\.0\.1)$/.test(h) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
    page.on('pageerror', e => errors.push('page error: ' + e.message));
    await page.goto(base + 'index.html');
    await page.waitForFunction(() => window.__snapmon && window.SnapmonNav && window.__app.listeners.backButton, null, { timeout: 20000 });
    return { ctx, page };
  }
  const S = page => page.evaluate(() => { const s = window.__snapmon.S; return { level: s.level, coins: s.coins, monsters: s.monsters.length, created: s.created }; });
  const flush = page => page.evaluate(() => window.SNAPMON_NATIVE.storage.flush(4000));
  const savedCoins = () => { const e = store.get('snapmon.save.v1'); return e ? JSON.parse(e.value).coins : null; };

  // 1. fresh install
  let { ctx, page } = await app();
  let s = await S(page);
  ok(s.level === 1 && s.monsters === 0 && s.coins === 40, `fresh install starts as a brand-new player (level ${s.level}, ${s.monsters} monsters, ${s.coins} coins)`);
  ok(await page.evaluate(() => Platform.name === 'android' && Platform.native && Platform.assets.bundled && !Platform.assets.webgpu), 'Platform reports the Android app with bundled engine files');
  ok(!(await page.$('[data-act="engineDownload"]')) && await page.evaluate(() => snapState() !== 'download'), 'no one-time download notice / SNAP never asks to download');
  await flush(page);
  ok(savedCoins() === 40, 'the new save is mirrored to the native store at start-up');
  const fontsOk = await page.evaluate(async () => {
    await Promise.all(['500 16px "Pixelify Sans"', '700 16px "Pixelify Sans"', '400 16px "Chakra Petch"', '700 16px "Chakra Petch"'].map(f => document.fonts.load(f)));
    const got = performance.getEntriesByType('resource').filter(e => /\/fonts\/.*\.woff2$/.test(e.name) && new URL(e.name).hostname === location.hostname);
    return got.length >= 2 && document.fonts.check('500 16px "Pixelify Sans"') && document.fonts.check('400 16px "Chakra Petch"');
  });
  ok(fontsOk, 'UI fonts come from the bundled files');

  // 2. engine from the bundled files
  const stub = () => realEngine ? null : page.evaluate(() => {
    Lens.load = async () => { Lens.status.state = 'ready'; Lens.status.backend = 'webgl'; return true; };
    Lens.recognize = async img => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').drawImage(img, 0, 0, 320, 240);
      return { decision: 'auto', reason: 'confident', candidates: [{ label: 'coffee mug', obj: 'mug', cat: 'mug', conf: 0.9, box: [0.25, 0.2, 0.5, 0.6], src: 'photo' }], image: c, boxes: [],
        debug: { decision: 'auto', reason: 'stub', thresholds: { min: .25, auto: .55, detMin: .45 }, times: { total: 3 }, sources: {}, backend: 'stub', full: [], detections: [], crops: [], candidates: [] } }; };
    Engine.status.state = 'idle'; ClipLens.reset();
  });
  await stub();
  const eng = await page.evaluate(async () => { const r = await Engine.load(); return { r, st: Engine.status.state, err: Engine.status.error, clip: ClipLens.status.info, lens: Lens.status.sources, caches: await caches.keys() }; });
  ok(eng.r && eng.st === 'ready', `recognition engine starts from the bundled files (${realEngine ? 'REAL models' : 'test colour model, detector stubbed'}) ${eng.err || ''}`);
  ok(eng.clip && eng.clip.backend === 'wasm' && eng.clip.threads === 1, 'TinyCLIP runs on WASM, one thread');
  ok(!eng.caches.includes('snapmon-models-v1'), 'no second copy of the models in the browser cache');
  if (realEngine) ok(eng.lens.classifier === 'app' && eng.lens.detector === 'app', 'detector and classifier read from the app package');
  await cam.show(page, path.join(__dirname, 'fixtures/red_mug.jpg'));
  const rec = await page.evaluate(async () => { const i = new Image(); i.src = 'icon.svg'; const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d'); x.fillStyle = '#c22'; x.fillRect(0, 0, 640, 480);
    try { const r = await Engine.recognize(c); return { decision: r.rec.decision, n: r.rec.candidates.length }; } catch (e) { return { error: String(e.message || e) }; } });
  ok(!rec.error && rec.decision, `a photo is recognised with the bundled engine (decision ${rec.decision || rec.error})`);

  // 3. progress is mirrored, and restored when the WebView's storage is lost
  await page.evaluate(() => { window.__snapmon.S.coins = 777; persist(true); });
  await flush(page);
  ok(savedCoins() === 777, 'a save reaches the native store');
  const created = (await S(page)).created;
  await ctx.close();
  ({ ctx, page } = await app()); // new context = empty localStorage, same native files
  s = await S(page);
  ok(s.coins === 777 && s.created === created, `progress restored from the native store after WebView storage was lost (${s.coins} coins)`);

  // 4. the newer copy wins: localStorage newer than the files (a file write failed)
  failSets = true;
  await page.evaluate(() => { window.__snapmon.S.coins = 888; persist(true); });
  await flush(page);
  ok(savedCoins() === 777 && (await page.evaluate(() => window.SNAPMON_NATIVE.storage.status().failures)) > 0, 'a failed native write is counted (files still hold the older save)');
  failSets = false;
  await page.reload(); await page.waitForFunction(() => window.__snapmon && window.__app.listeners.backButton);
  s = await S(page); await flush(page);
  ok(s.coins === 888 && savedCoins() === 888, `newer localStorage save kept and copied back to the files (${s.coins} / ${savedCoins()})`);
  //    files newer than localStorage (e.g. localStorage restored from an old state)
  // (inject while the app is closed: a running app may still write its own pending saves, e.g. after the engine loads)
  await page.waitForFunction(() => Engine.status.state !== 'loading', null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => window.SNAPMON_NATIVE.storage.flush());
  await page.goto('about:blank');
  const e = store.get('snapmon.save.v1'); const v = JSON.parse(e.value); v.coins = 999; store.set('snapmon.save.v1', { rev: e.rev + 50, value: JSON.stringify(v) });
  await page.goto(base + 'index.html'); await page.waitForFunction(() => window.__snapmon && window.__app.listeners.backButton);
  ok((await S(page)).coins === 999, 'newer file copy wins over an older localStorage copy');
  const rev = await page.evaluate(() => { window.__snapmon.S.coins = 1000; persist(true); return window.SNAPMON_NATIVE.storage.flush().then(() => 0); });
  ok(store.get('snapmon.save.v1').rev > e.rev + 50 && savedCoins() === 1000, 'revision numbers continue above the restored copy');

  // 5. hardware Back
  const back = () => page.evaluate(() => window.__app.listeners.backButton.forEach(f => f({ canGoBack: false })));
  await page.evaluate(() => window.__snapmon.actions.tab('dex'));
  await back();
  ok(await page.evaluate(() => window.__snapmon.ui.tab === 'hunt'), 'Back on another tab returns to Hunt');
  await page.evaluate(() => { window.__snapmon.S.coins = 1234; persist(); }); // debounced save still pending
  await back();
  ok(await page.evaluate(() => window.__app.exited === 0), 'first Back on Hunt only arms the exit');
  await back();
  await page.waitForFunction(() => window.__app.exited === 1, null, { timeout: 6000 }).catch(() => {});
  ok(await page.evaluate(() => window.__app.exited === 1) && savedCoins() === 1234, 'second Back exits the app after the latest save reached the files');

  // 6. pause: camera stops, progress saved; camera texts are the app's
  await page.waitForFunction(() => Engine.status.state !== 'loading', null, { timeout: 30000 }).catch(() => {}); // the auto-start after reload
  await stub(); const st6 = await page.evaluate(async () => { const r = await Engine.load(); return Engine.status.state + ' ' + Engine.status.error; });
  if (!/ready/.test(st6)) console.log('engine before camera:', st6);
  await page.evaluate(() => window.__snapmon.actions.openCamera());
  await page.waitForFunction(() => Platform.camera.isOpen(), null, { timeout: 10000 }).catch(() => {});
  const opened = await page.evaluate(() => Platform.camera.isOpen());
  await page.evaluate(() => { window.__snapmon.S.coins = 4321; window.__app.listeners.pause.forEach(f => f()); });
  await flush(page);
  ok(opened && !(await page.evaluate(() => Platform.camera.isOpen())) && await page.evaluate(() => window.__cam.tracks.every(t => t.readyState === 'ended')), 'pause stops the camera (all tracks ended)');
  ok(savedCoins() === 4321, 'pause saves immediately');
  const denied = await page.evaluate(() => Platform.camera.describe({ name: 'NotAllowedError' }).text);
  ok(/Android Settings/.test(denied) && !/lock icon/.test(denied), 'camera-denied help points to Android settings, not a browser address bar');
  await page.evaluate(() => { window.__cam.deny = 'NotAllowedError'; window.__snapmon.actions.openCamera(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir || 'shots', 'android-camera-denied.png') });
  ok(await page.evaluate(() => /Camera permission is off/.test(document.body.innerText)), 'denied camera permission shows the explanation (no crash)');
  await page.evaluate(() => { window.__cam.deny = null; $('#overlay').innerHTML = ''; window.__snapmon.actions.settings && window.__snapmon.actions.settings(); });
  await page.evaluate(() => typeof settingsSheet === 'function' && settingsSheet());
  ok(await page.evaluate(() => /Android app .*DEVELOPMENT BUILD/.test(document.body.innerText) === !!(window.SNAPMON_BUILD && window.SNAPMON_BUILD.devTools)), 'Settings names the Android build (and marks a development build)');
  await page.screenshot({ path: path.join(outDir || 'shots', 'android-settings.png') });
  await page.evaluate(() => window.__snapmon.actions.licences());
  await page.waitForFunction(() => /Capacitor/.test(document.querySelector('#sheet').innerText), null, { timeout: 5000 }).catch(() => {});
  ok(await page.evaluate(() => /TinyCLIP/.test(document.querySelector('#sheet').innerText) && /Capacitor/.test(document.querySelector('#sheet').innerText)), 'Settings → Open-source licences shows the packaged notices');

  // 7. developer tools: available only in a --dev-tools build; a release-safe build cannot reach them at all,
  //    even with a save that has them switched on (e.g. a backup code from a development build)
  const dev = await page.evaluate(() => {
    const S0 = window.__snapmon.S; S0.settings.devUnlocked = false; window.__snapmon.ui.devTaps = 0;
    for (let i = 0; i < 7; i++) window.__snapmon.actions.devTap();
    const unlockedByTaps = !!S0.settings.devUnlocked;
    S0.settings.devUnlocked = true; S0.settings.quickTest = true; S0.settings.godMode = true; // forced, as from an old save
    const r = { DEV_TOOLS, unlockedByTaps, devOn: devOn(), quickTest: quickTest(), god: enableGodMode({ m: { test: true } }),
      menu: (settingsSheet(), !!developerHTML() && /Developer &(amp;)? ?testing/.test(document.querySelector('#sheet').textContent)) };
    S0.settings.devUnlocked = false; S0.settings.quickTest = false; S0.settings.godMode = false; closeSheet();
    return r;
  });
  if (dev.DEV_TOOLS) ok(dev.unlockedByTaps && dev.devOn && dev.menu, 'development build: 7 taps unlock the developer tools (Quick Monster Test Mode, God Mode, Force CPU)');
  else ok(!dev.unlockedByTaps && !dev.devOn && !dev.quickTest && !dev.god && !dev.menu, `release-safe build: developer tools, Quick Monster Test Mode and God Mode unreachable, even with them forced on in the save (${JSON.stringify(dev)})`);
  await ctx.close();

  ok(external.length === 0, `nothing requested from the network (${external.slice(0, 3).join(', ')})`);
  await b.close(); server.close();
  console.log(errors.length ? `\n${errors.length} FAILED` : '\nall Android web checks passed');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
