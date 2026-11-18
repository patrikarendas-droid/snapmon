// Android packaging guard (Node only, no Android SDK needed). Fails when the Android build could drift from the
// website or break a product rule:
//   • the APK workflow must assemble the SAME engine (pinned runtime versions, file list, TinyCLIP variant/export and
//     cache key) and run the SAME regression tests as the Pages deploy
//   • the Pages deploy must not depend on the Android project
//   • the app may only ask for the CAMERA permission (no network, media, storage, microphone or location),
//     must not be backed up/restored behind the player's back, and a release build must refuse DEV_TOOLS
//   • no signing key may ever be committed; dependency versions are pinned exactly
//   • on the website (no SNAPMON_NATIVE) the Platform layer behaves exactly as before
// Usage: node tests/android-packaging.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

const pages = R('.github/workflows/pages.yml'), apk = R('.github/workflows/android-apk.yml');
const fetchEngine = R('tools/android/fetch-engine.sh'), runTests = R('tools/android/run-tests.sh');

// same engine as the website
const npmLine = s => (s.match(/npm i --no-save --silent (@tensorflow\/tfjs@[^\n)]+)/) || [])[1];
ok(npmLine(pages) && npmLine(pages).trim() === npmLine(fetchEngine).trim(), `runtime versions identical to Pages (${npmLine(pages)})`);
const ortList = s => (s.match(/onnxruntime-web\/dist\/\{([^}]+)\}/) || [])[1];
ok(ortList(pages) && ortList(pages) === ortList(fetchEngine), 'ONNX Runtime file list identical to Pages');
ok(/node tools\/fetch-models\.js/.test(fetchEngine), 'detector/classifier weights fetched by the same tools/fetch-models.js');
for (const k of ['CLIP_VARIANT', 'CLIP_HF']) {
  const v = s => (s.match(new RegExp(`${k}: (\\S+)`)) || [])[1];
  ok(v(pages) && v(pages) === v(apk), `${k} identical to Pages (${v(pages)})`);
}
const cacheKey = s => (s.match(/key: (clip-\$\{\{[^\n]+)/) || [])[1];
ok(cacheKey(pages) && cacheKey(pages) === cacheKey(apk), 'TinyCLIP export cache key identical to Pages');
const exportCmd = s => (s.match(/python lab\/export_clip\.py [^\n]+/) || [])[0];
ok(exportCmd(pages) && exportCmd(pages) === exportCmd(apk), 'TinyCLIP export command identical to Pages');

// same regression tests as the website
const testJob = pages.split(/\n  deploy:/)[0];
const pagesTests = [...testJob.matchAll(/^\s+(node (?:tests|tools)\/[^\n]+?)\s*$/gm)].map(m => m[1].replace(/\s*>\s*\/dev\/null$/, '').trim());
const missing = pagesTests.filter(t => !runTests.split('\n').some(l => l.trim().replace(/\s*>\s*\/dev\/null$/, '') === t));
ok(pagesTests.length >= 30 && !missing.length, `all ${pagesTests.length} Pages tests also run before an APK build${missing.length ? ' — missing: ' + missing.join('; ') : ''}`);
ok(/tools\/android\/run-tests\.sh/.test(apk) && /tests\/e2e-android-web\.js/.test(apk), 'APK workflow runs the regression suite and the Android web test');

// the website deploy is independent of the Android project
ok(!/android/i.test(pages), 'pages.yml does not reference the Android project');
const triggers = apk.split('\njobs:')[0];
ok(/workflow_dispatch:/.test(triggers) && !/claude\/snapmon-game-dev-7o667u|main|master/.test((triggers.match(/branches: \[([^\]]*)\]/) || [, ''])[1]), 'APK workflow runs manually or on feature-branch pushes, never on production pushes');
ok(/permissions:\s*\n\s*contents: read/.test(apk) && !/pages: write|id-token: write|contents: write/.test(apk), 'APK workflow is read-only (cannot deploy or push)');

// permissions, backup, identity
const man = R('android-app/android/app/src/main/AndroidManifest.xml');
const perms = [...man.matchAll(/<uses-permission android:name="([^"]+)"( tools:node="remove")?/g)];
const granted = perms.filter(p => !p[2]).map(p => p[1]);
ok(granted.length === 1 && granted[0] === 'android.permission.CAMERA', `only CAMERA is requested (${granted.join(', ')})`);
ok(perms.some(p => p[1] === 'android.permission.INTERNET' && p[2]), 'INTERNET is explicitly removed (offline by design)');
ok(!/READ_MEDIA|READ_EXTERNAL|WRITE_EXTERNAL|RECORD_AUDIO|LOCATION|MANAGE_EXTERNAL/.test(man.replace(/<!--[\s\S]*?-->/g, '')), 'no media, storage, microphone or location permission');
ok(/android:allowBackup="false"/.test(man) && /android:dataExtractionRules=/.test(man), 'saves are excluded from Android backup and device transfer');
const gradle = R('android-app/android/app/build.gradle'), cap = JSON.parse(R('android-app/capacitor.config.json'));
ok(gradle.includes(`applicationId "${cap.appId}"`) && gradle.includes(`namespace = "${cap.appId}"`), `package id ${cap.appId} consistent`);
ok(/applicationIdSuffix "\.dev"/.test(gradle), 'debug APK is a separate app (…snapmon.dev)');
ok(/preReleaseBuild[\s\S]*checkWebBuild\(true\)/.test(gradle) && /DEV_TOOLS enabled/.test(gradle), 'a release build refuses a web game with DEV_TOOLS');
ok(/^const DEV_TOOLS = (true|false);$/m.test(R('src/game.js')), 'src/game.js keeps the single DEV_TOOLS line the build flips');
ok(/^const DEV = flag\('--dev-tools'\);$/m.test(R('tools/android/build-web.js')), 'packaged game has DEV_TOOLS off unless --dev-tools is passed');
ok(cap.server && cap.server.androidScheme === 'https' && !cap.server.url, 'game served from the APK (https://localhost), never from a website URL');
ok(cap.server && cap.server.html5mode === false, 'server.html5mode is off: extensionless files (TF.js weight shards) are served as files, not as index.html');

// secrets and pinning
let tracked = '';
try { tracked = execSync('git ls-files', { cwd: path.join(__dirname, '..') }).toString(); } catch (e) {}
ok(tracked && !/\.(jks|keystore|p12|pfx|pem)$/m.test(tracked), 'no signing key or certificate file is committed');
ok(!/signingConfig[\s\S]{0,200}storePassword\s+["'][^"'$]/.test(gradle), 'no signing password in build.gradle');
const pkg = JSON.parse(R('android-app/package.json'));
const deps = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies });
ok(deps.length && deps.every(([, v]) => /^\d+\.\d+\.\d+$/.test(v)), 'Android npm dependencies pinned to exact versions');
ok(fs.existsSync(path.join(__dirname, '../android-app/package-lock.json')), 'package-lock.json committed (npm ci)');

// the website's Platform is unchanged without SNAPMON_NATIVE; the Android one switches on with it
function platformFor(native) {
  const store = {};
  const ctx = { window: native ? { SNAPMON_NATIVE: native } : {}, navigator: {}, location: { href: 'https://example.test/snapmon/' }, URL,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  vm.createContext(ctx); vm.runInContext(R('src/platform.js') + '\nthis.Platform = Platform;', ctx);
  return { P: ctx.Platform, store };
}
const web = platformFor(null);
ok(web.P.name === 'web' && !web.P.native && !web.P.assets.bundled && web.P.assets.webgpu, 'website: Platform name "web", engine downloaded, WebGPU comparison available');
ok(web.P.storage.set('k', 'v') === true && web.store.k === 'v' && web.P.storage.get('k') === 'v', 'website: storage is plain localStorage');
ok(/lock icon/.test(web.P.camera.describe({ name: 'NotAllowedError' }).text), 'website: camera help text unchanged');
const mirrored = [];
const and = platformFor({ platform: 'android', storage: { mirror: (k, v) => { mirrored.push([k, v]); return true; }, remove: k => mirrored.push([k, null]) } });
and.P.storage.set('snapmon.save.v1', '{"x":1}'); and.P.storage.remove('snapmon.save.v1');
ok(and.P.name === 'android' && and.P.assets.bundled && !and.P.assets.webgpu, 'Android: bundled engine, no WebGPU runtime');
ok(mirrored.length === 2 && mirrored[0][0] === 'snapmon.save.v1' && mirrored[1][1] === null, 'Android: every write and removal is mirrored to the native store');
try { new vm.Script(R('android-app/native/boot.js')); ok(true, 'native boot script compiles'); } catch (e) { ok(false, 'native boot script: ' + e.message); }

console.log(errors.length ? `\n${errors.length} FAILED` : '\nandroid packaging checks passed');
process.exit(errors.length ? 1 : 0);
