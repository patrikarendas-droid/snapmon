#!/usr/bin/env node
// Fails the deploy if any file the standard Hybrid engine needs is missing from the assembled site: hunting must
// never go live with a partial recogniser. Usage: node tools/check-site.js _site
const fs = require('fs'), path = require('path');
const site = process.argv[2] || '_site';
const variant = (fs.readFileSync(path.join(__dirname, '../src/lens-clip.js'), 'utf8').match(/variant: '([^']+)'/) || [])[1];
const need = ['index.html', 'src/engine.js', 'src/workers/clip-worker.js', 'src/color.js', 'src/curated.js', 'src/curated-data.js',
  'vendor/tfjs/tf.min.js', 'vendor/tfjs/mobilenet.min.js', 'vendor/tfjs/coco-ssd.min.js',
  'models/mobilenet_v2_100/model.json', 'models/ssdlite_mobilenet_v2/model.json',
  'vendor/ort/ort.min.js', 'vendor/ort/ort.webgpu.min.js', 'vendor/ort/ort-wasm-simd-threaded.wasm', 'vendor/ort/ort-wasm-simd-threaded.jsep.wasm',
  `models/clip/${variant}/vision.onnx`, `models/clip/${variant}/vocab.bin`, `models/clip/${variant}/vocab.json`, 'models/manifest.json'];
const missing = need.filter(f => { try { return fs.statSync(path.join(site, f)).size === 0; } catch (e) { return true; } });
const vocab = JSON.parse(fs.readFileSync(path.join(site, `models/clip/${variant}/vocab.json`), 'utf8'));
if (!vocab.calib) missing.push(`models/clip/${variant}/vocab.json has no calibration`);
if (missing.length) { console.error('MISSING engine assets:\n  ' + missing.join('\n  ')); process.exit(1); }
console.log(`site check ok: all ${need.length} engine files present (TinyCLIP variant ${variant}, calibrated)`);
