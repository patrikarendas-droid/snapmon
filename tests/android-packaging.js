// Android packaging guard (Node only, no Android SDK needed). Android is the only supported playable platform: this
// guards the Android build itself, it does NOT require the APK to mirror the website. Fails when:
//   • the bundled engine drifts from its pins (runtime versions + file list, TinyCLIP variant/export, cache key) —
//     the engine stays the single standard Hybrid recogniser and an older commit stays rebuildable (docs/RECOVERY.md)
//   • a test file is neither run by the Android workflow nor listed below with the reason it is not (no silent loss of
//     coverage); the Pages deploy must not depend on the Android project
//   • the app could ask for more than CAMERA, be backed up behind the player's back, or ship DEV_TOOLS in a release
//   • a signing key is committed; dependency versions are not pinned exactly
//   • the APK artifact is not kept 90 days, or the milestone workflow could publish without the owner's approval
//   • on the website (no SNAPMON_NATIVE) the Platform layer would behave differently (the catalogue still uses src/)
// Usage: node tests/android-packaging.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

const pages = R('.github/workflows/pages.yml'), apk = R('.github/workflows/android-apk.yml');
const fetchEngine = R('tools/android/fetch-engine.sh'), runTests = R('tools/android/run-tests.sh');

// the engine pins (tools/android/fetch-engine.sh + the workflow env); changing them is an engine change on purpose
const PIN = {
  npm: '@tensorflow/tfjs@4.22.0 @tensorflow-models/mobilenet@2.1.1 @tensorflow-models/coco-ssd@2.2.3 onnxruntime-web@1.20.1',
  ort: 'ort.min.js,ort.webgpu.min.js,ort-wasm-simd-threaded.mjs,ort-wasm-simd-threaded.wasm,ort-wasm-simd-threaded.jsep.mjs,ort-wasm-simd-threaded.jsep.wasm',
  CLIP_VARIANT: 'tinyclip-39m16', CLIP_HF: 'wkcn/TinyCLIP-ViT-39M-16-Text-19M-YFCC15M',
  cacheKey: "clip-${{ env.CLIP_VARIANT }}-${{ hashFiles('lab/export_clip.py', 'lab/vocab-labels.json', 'lab/calib/*.json') }}",
  exportCmd: 'python lab/export_clip.py $CLIP_HF $CLIP_VARIANT lab/vocab-labels.json models/clip lab/calib/$CLIP_VARIANT.json',
};
const npmLine = s => (s.match(/npm i --no-save --silent (@tensorflow\/tfjs@[^\n)]+)/) || [])[1];
ok((npmLine(fetchEngine) || '').trim() === PIN.npm, `engine runtime versions pinned (${npmLine(fetchEngine)})`);
const ortList = s => (s.match(/onnxruntime-web\/dist\/\{([^}]+)\}/) || [])[1];
ok(ortList(fetchEngine) === PIN.ort, 'ONNX Runtime file list pinned');
ok(/node tools\/fetch-models\.js/.test(fetchEngine), 'detector/classifier weights fetched by tools/fetch-models.js');
for (const k of ['CLIP_VARIANT', 'CLIP_HF']) {
  const v = (apk.match(new RegExp(`${k}: (\\S+)`)) || [])[1];
  ok(v === PIN[k], `${k} pinned (${v})`);
}
ok((apk.match(/key: (clip-\$\{\{[^\n]+)/) || [])[1] === PIN.cacheKey, 'TinyCLIP export cache key pinned to the export script, vocabulary and calibration');
ok((apk.match(/python lab\/export_clip\.py [^\n]+/) || [])[0] === PIN.exportCmd, 'TinyCLIP export command pinned');
ok(fs.existsSync(path.join(__dirname, '../models/manifest.json')) || /models\/manifest\.json/.test(R('tools/android/check-web.js')), 'packaged engine files are checked against models/manifest.json (SHA-256)');

// every test file is run by the Android workflow or listed here with the reason it is not
const NOT_IN_CI = {
  'load.js': 'helper (loads src/ into a Node VM)', 'fake-camera.js': 'helper (canvas camera stream)', 'layout-checks.js': 'helper (shared by e2e-layout and the emulator test)',
  'e2e-catalogue.js': 'real Firebase SDK + local Firebase emulators (Java); run by hand, docs/CATALOGUE.md',
  'e2e-lens.js': 'real photo set + COCO-SSD; superseded in CI by e2e-engine.js and the real-model lab workflow (lab.yml)',
};
const ran = runTests + '\n' + apk;
const testFiles = fs.readdirSync(path.join(__dirname)).filter(f => f.endsWith('.js'));
const unaccounted = testFiles.filter(f => !NOT_IN_CI[f] && !new RegExp(`tests/${f.replace(/\./g, '\\.')}\\b`).test(ran));
ok(testFiles.length >= 40 && !unaccounted.length, `every one of ${testFiles.length} test files runs before an APK is built, or is listed with a reason (${Object.keys(NOT_IN_CI).length})${unaccounted.length ? ' — NOT RUN: ' + unaccounted.join(', ') : ''}`);
ok(/tools\/android\/run-tests\.sh/.test(apk) && /tests\/e2e-android-web\.js/.test(apk) && /tools\/android\/emulator-smoke\.js/.test(apk), 'APK workflow runs the fast suite, the packaged-game test and the emulator test');
const longSuite = runTests.split('\n').filter(l => /^\s+node (tests|tools)\//.test(l)).length;
ok(longSuite >= 45, `the fast suite stays broad (${longSuite} commands in tools/android/run-tests.sh)`);

// the website deploy is independent of the Android project
ok(!/android/i.test(pages), 'pages.yml does not reference the Android project');
const triggers = apk.split('\njobs:')[0];
ok(/workflow_dispatch:/.test(triggers) && !/claude\/snapmon-game-dev-7o667u|main|master/.test((triggers.match(/branches: \[([^\]]*)\]/) || [, ''])[1]), 'APK workflow runs manually or on feature-branch pushes, never on production pushes');
ok(/permissions:\s*\n\s*contents: read/.test(apk) && !/pages: write|id-token: write|contents: write/.test(apk), 'APK workflow is read-only (cannot deploy or push)');
ok(!fs.existsSync(path.join(__dirname, '../.github/workflows/pages-catalogue-only.yml')) && fs.existsSync(path.join(__dirname, '../docs/staged/pages-catalogue-only.yml')), 'the catalogue-only Pages workflow is STAGED outside .github/workflows (cannot run)');

// artifact retention and provenance
const mainUpload = (apk.match(/- id: upload\n\s+uses: actions\/upload-artifact@v4\n[\s\S]*?retention-days: (\d+)/) || [])[1];
ok(mainUpload === '90', `the main APK artifact is kept 90 days (${mainUpload})`);
const others = [...apk.matchAll(/retention-days: (\d+)/g)].map(m => +m[1]);
ok(others.filter(d => d === 90).length === 1 && others.every(d => d === 90 || d <= 7), `diagnostics are kept briefly (${others.join(', ')} days)`);
ok(/out\/provenance\.json/.test(apk) && /tools\/android\/verify-apk\.js/.test(apk), 'every APK artifact carries provenance.json (hash, version, certificate, commit, run)');

// the milestone (long-term archive) workflow publishes only with explicit approval
const ms = R('.github/workflows/android-milestone.yml');
ok(/^on:\n  workflow_dispatch:/m.test(ms) && !/^\s+(push|pull_request|schedule|workflow_run):/m.test(ms), 'milestone workflow: manual only');
ok(/default: verify/.test(ms) && /if: inputs\.mode == 'publish'/.test(ms) && /"I approve publishing build \$BUILD publicly"/.test(ms), 'milestone workflow: verify by default; publishing needs mode=publish and the exact approval sentence');
ok(/--prerelease/.test(ms) && /--latest=false/.test(ms) && /refusing to move or replace it/.test(ms) && !/git push[^\n]*(--force|-f\b|--delete)|git tag -f|gh release delete/.test(ms), 'milestone workflow: pre-release only, never "latest", never moves/deletes a tag');
ok(/--expect-sha256 "\$APK_SHA"/.test(ms) && /actions\/download-artifact@v4/.test(ms) && !/gradlew|build-web/.test(ms), 'milestone workflow archives the ORIGINAL CI binary after checking its hash (never rebuilds)');
ok(!/pages: write|id-token: write/.test(ms), 'milestone workflow cannot deploy Pages');
const points = JSON.parse(R('tools/android/recovery-points.json'));
ok(points.package === 'io.github.patrikarendas.snapmon.dev' && /^[0-9a-f]{64}$/.test(points.certificateSha256) && points.ownerVerified.length >= 1 && /^[0-9a-f]{40}$/.test(points.drill), `recovery points recorded (${points.ownerVerified.map(b => 'build ' + b.build).join(', ')}; drill ${points.drill.slice(0, 7)})`);

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
