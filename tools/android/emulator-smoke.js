#!/usr/bin/env node
/* Android EMULATOR test of the built debug APK (CI: .github/workflows/android-apk.yml). Drives the real app — real
   Android System WebView, real Capacitor bridge, real SaveStore files, real bundled models — through adb, Android's
   UI automator and Playwright's Android support (the debug build's WebView inspector). This is NOT a phone test: no
   real camera sensor, GPU or phone-specific WebView; the owner's phone checklist in docs/ANDROID.md covers those.

   Runs in AIRPLANE MODE (and the app has no INTERNET permission anyway). Checks, in order:
     install + launch, Capacitor bridge, brand-new player, nothing restored, no network
     → the complete Hybrid engine from the APK + a recognition
     → camera permission: Android's real dialog, "Don't allow" → explanation, then "Allow" → preview (virtual camera)
     → Home with the camera open → resume: camera closed, engine still recognises
     → Back closes the camera / returns to Hunt; double Back leaves the app
     → saves: written to the app's private files; survive force-stop; restored from the files after the WebView's own
       storage is wiped; survive an UPDATE to a newer build (higher versionCode, same key); uninstall + install = clean
   Usage: node tools/android/emulator-smoke.js <apk> [<newer-apk>] <screenshot-dir>
   Writes <screenshot-dir>/emulator-report.md (every check with its result). */
'use strict';
const { _android: android } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const { checkScreens, seed } = require('../../tests/layout-checks');
const args = process.argv.slice(2);
const outDir = args[args.length - 1], apk = args[0], newer = args.length > 2 ? args[1] : null;
const PKG = 'io.github.patrikarendas.snapmon.dev', ACT = 'io.github.patrikarendas.snapmon.MainActivity';
fs.mkdirSync(outDir, { recursive: true });
const results = [];
const ok = (c, msg) => { results.push([c ? 'PASS' : 'FAIL', msg]); console.log(c ? 'ok  ' : 'FAIL', msg); };
const note = msg => { results.push(['NOTE', msg]); console.log('note', msg); };
const adb = c => execSync('adb ' + c, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const tryAdb = c => { try { return adb(c); } catch (e) { return ''; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = name => { try { fs.writeFileSync(path.join(outDir, name + '.png'), execSync('adb exec-out screencap -p')); } catch (e) {} };
const versionCode = () => +((adb(`shell dumpsys package ${PKG}`).match(/versionCode=(\d+)/) || [])[1] || 0);

let device;
// (re)start the app and attach to its WebView; after the app closed itself, the first handle can still be the old,
// dying WebView, so retry until a live page answers
async function launch() {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      adb(`shell am start -W -n ${PKG}/${ACT}`);
      await sleep(attempt ? 2000 : 300);
      const webview = await device.webView({ pkg: PKG }, { timeout: 240000 });
      const page = await webview.page();
      await page.waitForFunction(() => window.__snapmon && window.SNAPMON_NATIVE && window.SnapmonNav, null, { timeout: 240000 });
      return page;
    } catch (e) { last = e; await sleep(1500); }
  }
  throw last;
}
async function stop() { adb(`shell am force-stop ${PKG}`); await sleep(1500); }
const state = page => page.evaluate(() => { const s = window.__snapmon.S; return { level: s.level, coins: s.coins, monsters: s.monsters.length, storage: window.SNAPMON_NATIVE.storage.status() }; });
const ready = page => page.evaluate(async () => { const r = await Engine.load(); return { r, st: Engine.status.state, err: Engine.status.error, backends: Engine.status.backends, clip: ClipLens.status.info, lens: Lens.status.sources }; });
const recognise = page => page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d');
  x.fillStyle = '#ddd'; x.fillRect(0, 0, 640, 480); x.fillStyle = '#b22'; x.fillRect(220, 140, 200, 220); x.fillStyle = '#eee'; x.fillRect(240, 160, 160, 30);
  const t = performance.now();
  try { const r = await Engine.recognize(c); return { decision: r.rec.decision, top: r.rec.candidates.slice(0, 3).map(c => c.label), ms: Math.round(performance.now() - t) }; } catch (e) { return { error: String(e.message || e) }; }
});
// Android's permission dialog (permission controller) — tap a button by resource id; returns false if not shown
async function tapPermission(ids, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    tryAdb('shell uiautomator dump /sdcard/ui.xml');
    const xml = tryAdb('shell cat /sdcard/ui.xml');
    for (const id of ids) {
      const m = xml.match(new RegExp(`resource-id="[^"]*:id/${id}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
      if (m) { adb(`shell input tap ${(+m[1] + +m[3]) >> 1} ${(+m[2] + +m[4]) >> 1}`); return id; }
    }
    await sleep(700);
  }
  return false;
}
// Android's "isn't responding" (ANR) dialog would swallow key presses: report it as a failure and dismiss it (Wait)
async function anrCheck(where, fatal = true) {
  const xml = tryAdb('shell uiautomator dump /sdcard/ui.xml') && tryAdb('shell cat /sdcard/ui.xml');
  if (/isn.t responding|aerr_wait/.test(xml)) {
    const msg = `Android showed "SnapMon Dev isn't responding" (${where})`;
    fatal ? ok(false, msg) : note(msg); shot('emulator-anr-' + where.replace(/\W+/g, '-'));
    const m = xml.match(/resource-id="android:id\/aerr_wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (m) adb(`shell input tap ${(+m[1] + +m[3]) >> 1} ${(+m[2] + +m[4]) >> 1}`);
    await sleep(1000); return true;
  }
  return false;
}
const focus = () => (tryAdb('shell dumpsys window').match(/mCurrentFocus=[^\n]*/) || ['?'])[0];
async function pressBack(page, wait = 700) {
  const before = await page.evaluate(() => window.SNAPMON_NATIVE.storage.status().backPresses).catch(() => -1);
  adb('shell input keyevent KEYCODE_BACK'); await sleep(wait);
  const after = await page.evaluate(() => window.SNAPMON_NATIVE.storage.status()).catch(() => null);
  if (!after || after.backPresses <= before) note(`Back press did not reach the game (${before} → ${after && after.backPresses}); focus: ${focus()}`);
  return after && after.lastBack;
}
const bodyHas = (page, re) => page.evaluate(src => new RegExp(src).test(document.body.innerText), re.source);

(async () => {
  tryAdb(`uninstall ${PKG}`);
  tryAdb('shell cmd connectivity airplane-mode enable');
  note('airplane mode: ' + (tryAdb('shell settings get global airplane_mode_on') === '1' ? 'on' : 'could not be switched on (the app has no INTERNET permission anyway)'));
  adb(`install ${apk}`);
  [device] = await android.devices();
  ok(!!device, 'emulator found: Android ' + tryAdb('shell getprop ro.build.version.release') + ', WebView ' + ((tryAdb('shell dumpsys package com.google.android.webview').match(/versionName=(\S+)/) || [])[1] || '?'));
  const dump = adb(`shell dumpsys package ${PKG}`);
  ok(versionCode() > 0, `installed ${PKG} (versionCode ${versionCode()})`);
  const requested = ((dump.split('requested permissions:')[1] || '').split(/install permissions:|runtime permissions:|User 0:/)[0]).match(/android\.permission\.\w+/g) || [];
  ok(requested.length === 1 && requested[0] === 'android.permission.CAMERA', `requested permissions: ${requested.join(', ')}`);

  // 1. fresh install
  let page = await launch();
  let s = await state(page);
  ok(await page.evaluate(() => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Platform.name === 'android' && Platform.assets.bundled), 'Capacitor bridge initialised (native Android platform, bundled assets)');
  ok(s.level === 1 && s.monsters === 0 && s.coins === 40, `fresh install: brand-new player (level ${s.level}, ${s.monsters} monsters, ${s.coins} coins)`);
  ok(s.storage.nativeKeys === 0 && s.storage.restored === 0 && !s.storage.hydrateError, `nothing restored on a fresh install (${s.storage.nativeKeys} save files)`);
  const net = await page.evaluate(async () => { try { await fetch('https://example.com/', { mode: 'no-cors', cache: 'no-store' }); return 'reachable'; } catch (e) { return 'blocked'; } });
  ok(net === 'blocked', `no network access from the app (${net})`);
  ok(await page.evaluate(() => !document.querySelector('[data-act="engineDownload"]') && snapState() !== 'download'), 'no download notice');
  shot('emulator-1-start');

  // The emulator has no real GPU: TF.js's WebGL backend runs on SwiftShader (software) and compiles its shaders on the
  // page's main thread, which took > 3 min and triggered Android's "isn't responding" in CI run 4. For the emulator
  // the detector/classifier therefore use TF.js's CPU backend (the developer "Force CPU" switch: the same weights; the
  // engine's own fallback when WebGL fails). The WebGL path is checked on the phone. TinyCLIP is WASM either way.
  await page.evaluate(() => { const S0 = window.__snapmon.S; S0.settings.devUnlocked = true; S0.settings.forceCPU = true; persist(true); return window.SNAPMON_NATIVE.storage.flush(); });
  // an ANR left over from the first launch's automatic engine start on the software GPU is an emulator observation
  await anrCheck('first launch: automatic engine start on the emulator\'s software WebGL — watch the first start on the phone', false);
  await stop();
  page = await launch();
  ok(await page.evaluate(() => Lens.CFG.forceCPU === true), 'emulator: detector/classifier on the TF.js CPU backend (same weights; the emulator GPU is software-only — WebGL is a phone check)');

  // 2. the full Hybrid engine from the APK, offline
  const t0 = Date.now();
  const eng = await ready(page);
  // with the CPU backend the emulator's slow CPU can still keep the page busy for tens of seconds (seen once, CI run 10)
  await anrCheck('engine load on the emulator CPU backend — watch the first start on the phone', false);
  ok(eng.r && eng.st === 'ready', `recognition engine ready offline in ${((Date.now() - t0) / 1000).toFixed(1)} s (${JSON.stringify(eng.backends)}) ${eng.err || ''}`);
  ok(eng.clip && eng.clip.backend === 'wasm' && eng.clip.threads === 1 && eng.clip.labels > 2000, `TinyCLIP: WASM, 1 thread, ${eng.clip && eng.clip.labels} labels, ${eng.clip && eng.clip.modelBytes} model bytes`);
  ok(eng.lens && eng.lens.classifier === 'app' && eng.lens.detector === 'app', 'detector + classifier loaded from the APK');
  let rec = await recognise(page);
  ok(!rec.error && rec.decision, `a picture is recognised on the device: ${rec.error || `${rec.decision} [${rec.top.join(', ')}] in ${rec.ms} ms`}`);

  // 3. camera permission: Android's real dialog
  await page.evaluate(() => { window.__snapmon.actions.openCamera(); });
  const denied = await tapPermission(['permission_deny_button', 'permission_deny_and_dont_ask_again_button']);
  if (!denied) note('camera permission dialog did not appear (cannot test denial on this image)');
  else {
    await page.waitForFunction(() => /Camera permission is off/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    ok(await bodyHas(page, /Camera permission is off/) && await bodyHas(page, /Android Settings/), '"Don\'t allow" on Android\'s dialog → explanation pointing to Android settings, no crash');
    shot('emulator-2-camera-denied');
    await page.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; render(); });
  }
  await page.evaluate(() => { window.__snapmon.actions.openCamera(); });
  const allowed = await tapPermission(['permission_allow_foreground_only_button', 'permission_allow_button', 'permission_allow_one_time_button']);
  if (!allowed) { note('second permission dialog not shown; granting with pm grant'); tryAdb(`shell pm grant ${PKG} android.permission.CAMERA`); await page.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.actions.openCamera(); }); }
  ok(/android\.permission\.CAMERA: granted=true/.test(adb(`shell dumpsys package ${PKG}`)), `camera permission granted (${allowed || 'pm grant'})`);
  const preview = await page.waitForFunction(() => { const v = document.querySelector('#camVideo'); return v && v.videoWidth > 0; }, null, { timeout: 20000 }).then(() => true, () => false);
  if (preview) {
    note('virtual camera preview runs: ' + await page.evaluate(() => { const v = document.querySelector('#camVideo'); return v.videoWidth + 'x' + v.videoHeight + ', zoom ' + JSON.stringify(Platform.camera.zoomInfo()); }));
    shot('emulator-3-camera');
    // 4. Home with the camera open → resume
    adb('shell input keyevent KEYCODE_HOME'); await sleep(2500);
    adb(`shell am start -W -n ${PKG}/${ACT}`); await sleep(2000);
    ok(!(await page.evaluate(() => Platform.camera.isOpen())) && !(await page.$('#camVideo')), 'Home while the camera is open → the camera is stopped; after resume it is closed');
    await page.waitForFunction(() => Engine.status.state === 'ready', null, { timeout: 60000 }).catch(() => {});
    rec = await recognise(page);
    ok(!rec.error && rec.decision, `after background/resume the engine still recognises (${rec.error || rec.ms + ' ms'})`);
    await page.evaluate(() => { window.__snapmon.actions.openCamera(); });
    await page.waitForFunction(() => Platform.camera.isOpen(), null, { timeout: 20000 }).catch(() => {});
    adb('shell input keyevent KEYCODE_BACK'); await sleep(1000);
    ok(!(await page.evaluate(() => Platform.camera.isOpen())), 'hardware Back closes the camera');
  } else note('no camera preview in this emulator image (virtual camera unavailable): preview, Home-with-camera and Back-closes-camera need the phone');

  // 5. hardware Back navigation
  await anrCheck('before Back tests');
  await page.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; render(); window.__snapmon.actions.settings(); });
  await pressBack(page);
  ok(await page.evaluate(() => !document.querySelector('#sheet').innerHTML), 'Back closes an open sheet (Settings)');
  await page.evaluate(() => window.__snapmon.actions.tab('dex'));
  await pressBack(page);
  ok(await page.evaluate(() => window.__snapmon.ui.tab === 'hunt'), 'Back on another tab returns to Hunt');

  // 6. layout in the real WebView with the real Android status/navigation bars (phone bug of build 9: the HUD covered
  //    the top of every screen). Every main tab and sub-page: nothing under the HUD, every control hittable, page end
  //    clears the tab bar; then a REAL touch (adb input tap) on "Shop & Craft", the control that was unreachable.
  {
    const coinsBefore = await page.evaluate(() => window.__snapmon.S.coins);
    await page.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; closeSheet(); });
    await page.evaluate(seed); // five test monsters so the monster grid / sheet exist (emulator test install only)
    const geo = await page.evaluate(() => ({ top: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')) || 0,
      bottom: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')) || 0, w: innerWidth, h: innerHeight, dpr: devicePixelRatio }));
    note(`WebView ${geo.w}x${geo.h} CSS px at ${geo.dpr}x; Android status bar ${geo.top} px, navigation bar ${geo.bottom} px (Capacitor insets)`);
    // Android 15+ draws apps edge-to-edge (target SDK 36), like the owner's phone; older Android does not
    const api = +tryAdb('shell getprop ro.build.version.sdk') || 0;
    if (api >= 35) ok(geo.top > 0, `Android ${api}: edge-to-edge, the status bar inset reaches the page (${geo.top} px) — the condition of the phone bug`);
    else note(`Android API ${api} is not edge-to-edge (inset ${geo.top} px): the phone's status-bar condition is not reproduced here`);
    const res = await checkScreens(page, 'emulator', geo.top, 800, name => (name === 'gear-arsenal' || name === 'hunt') && shot('emulator-layout-' + name));
    const bad = res.filter(r => !r[0]);
    ok(!bad.length, `layout on every main tab and sub-page (${res.length} checks${bad.length ? '; failed: ' + bad.slice(0, 3).map(r => r[1]).join(' | ') : ''})`);
    await page.evaluate(() => { window.__snapmon.actions.tab('gear'); window.__snapmon.actions.gearTab('arsenal'); window.scrollTo(0, 0); });
    await sleep(800);
    const g = await page.evaluate(() => { const r = e => e.getBoundingClientRect(); const hud = r(document.querySelector('.topbar')), b = r(document.querySelector('[data-act="gearTab"][data-arg="shop"]'));
      return { hudBottom: hud.bottom, top: b.top, x: b.left + b.width / 2, y: b.top + b.height / 2, dpr: devicePixelRatio }; });
    ok(g.top >= g.hudBottom - 0.5, `"Shop & Craft" lies below the HUD at scroll 0 (button top ${Math.round(g.top)}, HUD bottom ${Math.round(g.hudBottom)} CSS px)`);
    // screen position of the WebView from Android's UI dump (0,0 when edge-to-edge), then CSS px x devicePixelRatio
    tryAdb('shell uiautomator dump /sdcard/ui.xml');
    const wv = (tryAdb('shell cat /sdcard/ui.xml').match(/class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]/) || [0, 0, 0]).slice(1).map(Number);
    note(`WebView on screen at ${wv[0]},${wv[1]} px; tapping Shop & Craft at ${Math.round(wv[0] + g.x * g.dpr)},${Math.round(wv[1] + g.y * g.dpr)}`);
    adb(`shell input tap ${Math.round(wv[0] + g.x * g.dpr)} ${Math.round(wv[1] + g.y * g.dpr)}`); await sleep(1000);
    ok(await page.evaluate(() => window.__snapmon.ui.gearTab === 'shop'), 'a real touch on "Shop & Craft" at scroll 0 opens the shop');
    shot('emulator-layout-gear-shop');
    await page.evaluate(c => { window.__snapmon.S.coins = c; window.__snapmon.actions.tab('hunt'); }, coinsBefore);
  }

  // 7. saves
  await page.evaluate(() => { window.__snapmon.S.coins = 4242; persist(true); return window.SNAPMON_NATIVE.storage.flush(); });
  s = await state(page);
  ok(s.storage.written > 0 && s.storage.failures === 0, `saves written to the app's files (${s.storage.written} written, ${s.storage.failures} failed)`);
  const files = tryAdb(`shell run-as ${PKG} ls files/snapmon-store`);
  ok(/k_[0-9a-f]+\.json/.test(files), `save files exist in the app's private storage (${files.split(/\s+/).filter(Boolean).length} files)`);
  const first = await pressBack(page, 400);
  adb('shell input keyevent KEYCODE_BACK'); await sleep(2500);
  if (first !== 'armed') note('first Back on Hunt returned ' + first);
  ok(!new RegExp(`(mResumedActivity|topResumedActivity)[^\\n]*${PKG.replace(/\./g, '\\.')}`).test(tryAdb('shell dumpsys activity activities')), 'double Back on Hunt leaves the app');
  // Android keeps the finished app's process (and its old WebView handle) alive: stop it, then reopen
  await stop();
  page = await launch();
  ok((await state(page)).coins === 4242, 'progress kept after leaving with double Back and reopening');
  await stop();
  page = await launch();
  ok((await state(page)).coins === 4242, 'progress kept after force-stop');
  await stop();
  // wipe ALL of the WebView's own data (localStorage, IndexedDB, caches); the app's files/ directory stays
  const wvBefore = tryAdb(`shell run-as ${PKG} ls app_webview/Default`).split(/\s+/).filter(Boolean);
  tryAdb(`shell run-as ${PKG} rm -rf app_webview`);
  const wvAfter = tryAdb(`shell run-as ${PKG} ls app_webview`);
  ok(wvBefore.length > 0 && !wvAfter, `WebView data wiped (had: ${wvBefore.slice(0, 6).join(', ')})`);
  page = await launch();
  s = await state(page);
  ok(s.coins === 4242 && s.storage.restored > 0, `progress restored from the app's files after the WebView storage was wiped (${s.coins} coins, ${s.storage.restored} keys restored)`);
  await stop();
  const before = versionCode();
  if (newer) {
    adb(`install -r ${newer}`);
    ok(versionCode() > before, `update installed over the old build (versionCode ${before} → ${versionCode()}, same signing key)`);
  } else { adb(`install -r ${apk}`); note('no newer APK given: reinstalled the same build over itself'); }
  page = await launch();
  ok((await state(page)).coins === 4242, 'progress kept after the update');
  ok(await page.evaluate(() => Engine.load()), 'engine starts after the update');
  shot('emulator-4-after-update');
  await stop();
  adb(`uninstall ${PKG}`);
  adb(`install ${apk}`);
  page = await launch();
  s = await state(page);
  ok(s.coins === 40 && s.level === 1 && s.storage.nativeKeys === 0, `uninstall + install starts clean again (${s.coins} coins, ${s.storage.nativeKeys} save files)`);

  await device.close();
  tryAdb('shell cmd connectivity airplane-mode disable');
  const fails = results.filter(r => r[0] === 'FAIL').length;
  fs.writeFileSync(path.join(outDir, 'emulator-report.md'), '| Result | Check (Android emulator, real APK) |\n|---|---|\n' + results.map(r => `| ${r[0]} | ${r[1].replace(/\|/g, '/')} |`).join('\n') + '\n');
  console.log(fails ? `\n${fails} FAILED` : '\nemulator test passed');
  process.exit(fails ? 1 : 0);
})().catch(e => {
  console.error(e); shot('emulator-error');
  fs.writeFileSync(path.join(outDir, 'emulator-report.md'), '| Result | Check |\n|---|---|\n' + results.map(r => `| ${r[0]} | ${r[1]} |`).join('\n') + `\n| FAIL | aborted: ${String(e.message || e).split('\n')[0]} |\n`);
  process.exit(1);
});
