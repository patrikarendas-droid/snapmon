#!/usr/bin/env node
/* Verifies the Android app's packaged web game (android-app/www) before it goes into an APK. Fails (exit 1) on:
   • a missing or empty file of the standard Hybrid engine (same list as tools/check-site.js, minus the developer-only
     WebGPU runtime, which the APK does not ship), or an uncalibrated TinyCLIP vocabulary
   • a models/manifest.json entry whose size or SHA-256 does not match the packaged file, or a packaged model/runtime
     file that the manifest does not list
   • anything that would load from the network at runtime: http(s) URLs in index.html, the font CSS or the boot script
   • the developer catalogue, the WebGPU runtime, or a DEV_TOOLS value that disagrees with native/build-info.json
   Usage: node tools/android/check-web.js android-app/www [--no-engine] [--expect-release] */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = path.resolve(process.argv[2] || 'android-app/www');
const noEngine = process.argv.includes('--no-engine'), expectRelease = process.argv.includes('--expect-release');
const problems = [];
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const exists = f => { try { return fs.statSync(path.join(dir, f)).size > 0; } catch (e) { return false; } };
const walk = (rel, out = []) => { const p = path.join(dir, rel); if (!fs.existsSync(p)) return out; for (const f of fs.readdirSync(p)) { const r = rel + '/' + f; fs.statSync(path.join(dir, r)).isDirectory() ? walk(r, out) : out.push(r); } return out; };

// game + native shell
const html = read('index.html');
const scripts = JSON.parse((html.match(/window\.SNAPMON_SCRIPTS=(\[[^\]]*\])/) || [, 'null'])[1]) || [];
if (!scripts.length) problems.push('index.html has no SNAPMON_SCRIPTS list');
for (const f of [...scripts, 'native/boot.js', 'native/capacitor.js', 'native/build-info.json', 'fonts/fonts.css', 'src/workers/clip-worker.js', 'icon.svg', 'THIRD_PARTY_NOTICES.md'])
  if (!exists(f)) problems.push('missing: ' + f);

// nothing loads from the network: no absolute URLs in markup, styles or the boot code
for (const f of ['index.html', 'fonts/fonts.css', 'native/boot.js']) {
  if (!exists(f)) continue;
  const urls = (read(f).match(/(src|href)\s*=\s*["']https?:\/\/[^"']+|url\(\s*["']?https?:\/\/[^)]+/g) || []);
  for (const u of urls) problems.push(`${f} loads from the network: ${u}`);
}
if (/fonts\.googleapis|fonts\.gstatic/.test(html)) problems.push('index.html still references Google Fonts');
for (const m of read('fonts/fonts.css').matchAll(/url\(([^)]+)\)/g)) if (!exists('fonts/' + m[1])) problems.push('font file missing: ' + m[1]);

// not part of the player APK
if (fs.existsSync(path.join(dir, 'catalogue'))) problems.push('developer catalogue must not be packaged');
for (const f of walk('vendor')) if (/ort\.webgpu|\.jsep\./.test(f)) problems.push('developer-only WebGPU runtime packaged: ' + f);

// DEV_TOOLS agrees with build-info (and with --expect-release)
const info = JSON.parse(read('native/build-info.json'));
const dev = (read('src/game.js').match(/^const DEV_TOOLS = (true|false);/m) || [])[1];
if (String(info.devTools) !== dev) problems.push(`build-info devTools=${info.devTools} but src/game.js has DEV_TOOLS = ${dev}`);
if (expectRelease && dev !== 'false') problems.push('release build expected, but DEV_TOOLS is on');

// engine: complete, calibrated, and exactly what the manifest says
let summary = 'engine not checked (--no-engine)';
if (!noEngine) {
  const variant = (read('src/lens-clip.js').match(/variant: '([^']+)'/) || [])[1];
  const need = ['vendor/tfjs/tf.min.js', 'vendor/tfjs/mobilenet.min.js', 'vendor/tfjs/coco-ssd.min.js',
    'models/mobilenet_v2_100/model.json', 'models/ssdlite_mobilenet_v2/model.json',
    'vendor/ort/ort.min.js', 'vendor/ort/ort-wasm-simd-threaded.wasm', 'vendor/ort/ort-wasm-simd-threaded.mjs',
    `models/clip/${variant}/vision.onnx`, `models/clip/${variant}/vocab.bin`, `models/clip/${variant}/vocab.json`, 'models/manifest.json'];
  for (const f of need) if (!exists(f)) problems.push('missing engine file: ' + f);
  try { if (!JSON.parse(read(`models/clip/${variant}/vocab.json`)).calib) problems.push('TinyCLIP vocabulary has no calibration'); } catch (e) { problems.push('vocab.json unreadable'); }
  // TF.js model shards referenced by each model.json
  for (const mj of walk('models').filter(f => f.endsWith('/model.json'))) {
    try { for (const g of JSON.parse(read(mj)).weightsManifest || []) for (const p of g.paths) { const f = path.posix.join(path.posix.dirname(mj), path.posix.basename(p)); /* tools/fetch-models.js stores shards flat */ if (!exists(f)) problems.push('missing weight shard: ' + f); } }
    catch (e) { problems.push('unreadable ' + mj); }
  }
  let man = null;
  try { man = JSON.parse(read('models/manifest.json')); } catch (e) { problems.push('models/manifest.json unreadable'); }
  if (man) {
    const listed = new Set();
    for (const e of man.files) {
      listed.add(e.path);
      let buf; try { buf = fs.readFileSync(path.join(dir, e.path)); } catch (er) { problems.push('manifest lists a missing file: ' + e.path); continue; }
      if (buf.length !== e.bytes) problems.push(`size mismatch: ${e.path}`);
      else if (crypto.createHash('sha256').update(buf).digest('hex') !== e.sha256) problems.push(`SHA-256 mismatch: ${e.path}`);
    }
    for (const f of [...walk('models'), ...walk('vendor')]) if (!f.endsWith('manifest.json') && !listed.has(f)) problems.push('not in manifest: ' + f);
    summary = `${man.files.length} engine files verified (detector+classifier ${(man.groups.lens / 1048576).toFixed(1)} MB, TinyCLIP ${(man.groups.clip / 1048576).toFixed(1)} MB, TinyCLIP variant ${variant})`;
  }
}

if (problems.length) { console.error('Android web check FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`android web check ok: ${scripts.length} game scripts, no network URLs, no catalogue, DEV_TOOLS ${dev}; ${summary}`);
