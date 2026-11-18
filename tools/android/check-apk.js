#!/usr/bin/env node
/* Integrity check of a BUILT APK (not just the folder it was built from): unpacks assets/public and runs the same
   checks as tools/android/check-web.js on what is really inside the package — every engine file present, every
   SHA-256 matching models/manifest.json, nothing loaded from the network, no catalogue, DEV_TOOLS as expected —
   plus the packaged Capacitor config (game served from the APK, never from a website URL).
   Usage: node tools/android/check-apk.js <app.apk> [--expect-release]          (needs `unzip`) */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const apk = process.argv[2], release = process.argv.includes('--expect-release');
if (!apk || !fs.existsSync(apk)) { console.error('usage: check-apk.js <app.apk> [--expect-release]'); process.exit(2); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snapmon-apk-'));
const problems = [];
try {
  execFileSync('unzip', ['-q', '-o', apk, 'assets/*', '-d', tmp]);
  const pub = path.join(tmp, 'assets/public');
  if (!fs.existsSync(path.join(pub, 'index.html'))) problems.push('APK has no assets/public/index.html');
  const cfg = JSON.parse(fs.readFileSync(path.join(tmp, 'assets/capacitor.config.json'), 'utf8'));
  if (cfg.server && cfg.server.url) problems.push('Capacitor server.url is set (the app would load a website): ' + cfg.server.url);
  if (!cfg.server || cfg.server.androidScheme !== 'https') problems.push('androidScheme is not https (secure context needed for the camera)');
  if (!cfg.server || cfg.server.html5mode !== false) problems.push('server.html5mode is on: Capacitor would answer extensionless model files with index.html');
  const plugins = JSON.parse(fs.readFileSync(path.join(tmp, 'assets/capacitor.plugins.json'), 'utf8')).map(p => p.pkg);
  if (!plugins.includes('@capacitor/app')) problems.push('@capacitor/app plugin not registered (hardware Back, lifecycle)');
  if (!problems.length) {
    const info = JSON.parse(fs.readFileSync(path.join(pub, 'native/build-info.json'), 'utf8'));
    console.log(`APK ${path.basename(apk)}: game ${info.gameVersion}, ${info.versionName}, commit ${info.commit}, DEV_TOOLS ${info.devTools}`);
    execFileSync('node', [path.join(__dirname, 'check-web.js'), pub, ...(release ? ['--expect-release'] : [])], { stdio: 'inherit' });
  }
} catch (e) { problems.push(String(e.message || e).split('\n')[0]); }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
if (problems.length) { console.error('APK check FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('APK contents verified');
