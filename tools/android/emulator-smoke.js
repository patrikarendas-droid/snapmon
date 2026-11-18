#!/usr/bin/env node
/* Android EMULATOR smoke test of a built debug APK (CI: .github/workflows/android-apk.yml). Drives the real app — real
   Android System WebView, real Capacitor bridge, real SaveStore files, real bundled models — through Playwright's
   Android support (adb + the debug build's WebView inspector). This is NOT a phone test: no real camera, GPU or
   phone-specific WebView; the owner's phone checklist in docs/ANDROID.md covers those.

   Checks: fresh install starts as a new player; nothing restored from anywhere; the full Hybrid engine loads from
   the APK and recognises a picture; no network permission (fetch fails) yet the engine works; progress survives a
   force-stop, the loss of the WebView's own storage (restored from the app's files), and an update install
   (adb install -r, same signature); hardware Back twice leaves the app. Camera preview with the emulator's virtual
   camera is reported but not required.
   Usage: node tools/android/emulator-smoke.js <apk> <screenshot-dir> */
'use strict';
const { _android: android } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const [apk, outDir = 'shots'] = process.argv.slice(2);
const PKG = 'io.github.patrikarendas.snapmon.dev', ACT = 'io.github.patrikarendas.snapmon.MainActivity';
fs.mkdirSync(outDir, { recursive: true });
const errors = [], notes = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const note = msg => { notes.push(msg); console.log('note', msg); };
const adb = c => execSync('adb ' + c, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = name => { try { fs.writeFileSync(path.join(outDir, name + '.png'), execSync('adb exec-out screencap -p')); } catch (e) {} };

let device;
async function launch() {
  adb(`shell am start -W -n ${PKG}/${ACT}`);
  const webview = await device.webView({ pkg: PKG }, { timeout: 90000 });
  const page = await webview.page();
  await page.waitForFunction(() => window.__snapmon && window.SNAPMON_NATIVE && window.SnapmonNav, null, { timeout: 120000 });
  return page;
}
async function stop() { adb(`shell am force-stop ${PKG}`); await sleep(1500); }
const state = page => page.evaluate(() => { const s = window.__snapmon.S; return { level: s.level, coins: s.coins, monsters: s.monsters.length, storage: window.SNAPMON_NATIVE.storage.status() }; });

(async () => {
  try { adb(`uninstall ${PKG}`); } catch (e) {}
  adb(`install ${apk}`);
  [device] = await android.devices();
  ok(!!device, 'emulator found');
  const dump = adb(`shell dumpsys package ${PKG}`);
  ok(/versionCode=\d+/.test(dump), 'installed: ' + ((dump.match(/versionName=\S+/) || [''])[0]));
  ok(!/android\.permission\.INTERNET/.test(dump.split('requested permissions:')[1] || ''), 'no INTERNET permission requested');

  // 1. fresh install
  let page = await launch();
  let s = await state(page);
  ok(s.level === 1 && s.monsters === 0 && s.coins === 40, `fresh install: brand-new player (level ${s.level}, ${s.monsters} monsters, ${s.coins} coins)`);
  ok(s.storage.nativeKeys === 0 && !s.storage.hydrateError, `nothing restored on a fresh install (${s.storage.nativeKeys} files, ${s.storage.hydrateError || 'no error'})`);
  ok(await page.evaluate(() => Platform.name === 'android' && Capacitor.isNativePlatform()), 'running inside the native app');
  const net = await page.evaluate(async () => { try { await fetch('https://example.com/', { mode: 'no-cors' }); return 'reachable'; } catch (e) { return 'blocked'; } });
  ok(net === 'blocked', `the app has no network access (${net})`);
  shot('emulator-1-start');

  // 2. the full Hybrid engine from the APK
  const t0 = Date.now();
  const eng = await page.evaluate(async () => { const r = await Engine.load(); return { r, st: Engine.status.state, err: Engine.status.error, kind: Engine.status.kind, backends: Engine.status.backends, clip: ClipLens.status.info, lens: Lens.status.sources }; });
  ok(eng.r && eng.st === 'ready', `recognition engine ready in ${((Date.now() - t0) / 1000).toFixed(1)} s (${JSON.stringify(eng.backends)}) ${eng.err || ''}`);
  ok(eng.clip && eng.clip.backend === 'wasm' && eng.clip.threads === 1 && eng.clip.labels > 2000, `TinyCLIP: WASM, 1 thread, ${eng.clip && eng.clip.labels} labels`);
  ok(eng.lens && eng.lens.classifier === 'app' && eng.lens.detector === 'app', 'detector + classifier loaded from the APK');
  const rec = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d');
    x.fillStyle = '#ddd'; x.fillRect(0, 0, 640, 480); x.fillStyle = '#b22'; x.fillRect(220, 140, 200, 220); x.fillStyle = '#eee'; x.fillRect(240, 160, 160, 30);
    const t = performance.now();
    try { const r = await Engine.recognize(c); return { decision: r.rec.decision, top: r.rec.candidates.slice(0, 3).map(c => c.label), ms: Math.round(performance.now() - t) }; } catch (e) { return { error: String(e.message || e) }; }
  });
  ok(!rec.error && rec.decision, `a picture is recognised on the device: ${rec.error || `${rec.decision} [${rec.top.join(', ')}] in ${rec.ms} ms`}`);

  // 3. saving: force-stop, lost WebView storage, update install
  await page.evaluate(() => { window.__snapmon.S.coins = 4242; persist(true); return window.SNAPMON_NATIVE.storage.flush(); });
  s = await state(page);
  ok(s.storage.written > 0 && s.storage.failures === 0, `saves reach the app's files (${s.storage.written} written, ${s.storage.failures} failed)`);
  await stop();
  page = await launch();
  ok((await state(page)).coins === 4242, 'progress kept after force-stop');
  await stop();
  // wipe only the WebView's own storage (localStorage etc.); the app's files stay → progress must come back from them
  adb(`shell run-as ${PKG} rm -rf app_webview/Default/Local\\ Storage app_webview/Default/Session\\ Storage`);
  page = await launch();
  s = await state(page);
  ok(s.coins === 4242 && s.storage.restored > 0, `progress restored from the app's files after the WebView storage was wiped (${s.coins} coins, ${s.storage.restored} keys restored)`);
  await stop();
  adb(`install -r ${apk}`);
  page = await launch();
  ok((await state(page)).coins === 4242, 'progress kept after installing the update over the old app (same signing key)');
  shot('emulator-2-after-update');

  // 4. camera with the emulator's virtual camera (informational)
  try {
    adb(`shell pm grant ${PKG} android.permission.CAMERA`);
    await page.evaluate(() => Engine.load());
    await page.evaluate(() => window.__snapmon.actions.openCamera());
    await page.waitForFunction(() => { const v = document.querySelector('#camVideo'); return v && v.videoWidth > 0; }, null, { timeout: 20000 });
    note('virtual camera preview runs: ' + await page.evaluate(() => { const v = document.querySelector('#camVideo'); return v.videoWidth + 'x' + v.videoHeight + ', zoom ' + JSON.stringify(Platform.camera.zoomInfo()); }));
    shot('emulator-3-camera');
    adb('shell input keyevent KEYCODE_BACK'); await sleep(800);
    ok(!(await page.evaluate(() => Platform.camera.isOpen())), 'Back closes the camera');
  } catch (e) { note('virtual camera not available in this emulator: ' + String(e.message || e).split('\n')[0]); }

  // 5. hardware Back: Hunt → armed → exit
  await page.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.actions.tab('dex'); });
  adb('shell input keyevent KEYCODE_BACK'); await sleep(700);
  ok(await page.evaluate(() => window.__snapmon.ui.tab === 'hunt'), 'Back returns to the Hunt screen');
  adb('shell input keyevent KEYCODE_BACK'); await sleep(400);
  adb('shell input keyevent KEYCODE_BACK'); await sleep(2500);
  const top = adb('shell dumpsys activity activities');
  ok(!new RegExp(`(mResumedActivity|topResumedActivity).*${PKG.replace(/\./g, '\\.')}`).test(top), 'double Back leaves the app');

  await device.close();
  console.log(errors.length ? `\n${errors.length} FAILED` : '\nemulator smoke test passed' + (notes.length ? ` (${notes.length} notes)` : ''));
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); shot('emulator-error'); process.exit(1); });
