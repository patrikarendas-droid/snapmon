#!/usr/bin/env node
/* Identifies and verifies one SnapMon Dev APK file: SHA-256, package id, versionCode, versionName, permissions and
   the signing-certificate SHA-256 (Android build-tools aapt2 + apksigner). Used
     • by every APK build, to write provenance.json next to the APK in the artifact (--write <file>), and
     • by the milestone workflow (and by hand) to check that an archived APK is EXACTLY the approved original
       (--expect-sha256, --expect-version-code, --expect-commit …). Exit code 1 on any mismatch.
   Usage: node tools/android/verify-apk.js <apk> [--build-tools <dir>] [--expect-sha256 <hex>] [--expect-version-code <n>]
          [--expect-version-name <s>] [--expect-commit <sha>] [--provenance <provenance.json>] [--write <file>]
          [--run-url <url>] [--run-attempt <n>] [--artifact <name>] [--commit <sha>] [--allow-unstable]
   The expected package and certificate come from tools/android/recovery-points.json. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const apk = args[0];
if (!apk || !fs.existsSync(apk)) { console.error('usage: node tools/android/verify-apk.js <apk> [options]'); process.exit(2); }
const POINTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'recovery-points.json'), 'utf8'));
const BT = opt('--build-tools') || (process.env.ANDROID_HOME && process.env.ANDROID_BUILD_TOOLS ? path.join(process.env.ANDROID_HOME, 'build-tools', process.env.ANDROID_BUILD_TOOLS) : null);
const tool = n => { const p = BT ? path.join(BT, n) : n; return p; };
const run = (n, a) => execFileSync(tool(n), a, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 << 20 }).toString();

const errors = [];
const check = (c, msg) => { if (!c) errors.push(msg); console.log((c ? 'ok   ' : 'FAIL ') + msg); };
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
const badging = run('aapt2', ['dump', 'badging', apk]);
const pkg = (badging.match(/package: name='([^']+)'/) || [])[1];
const versionCode = +((badging.match(/versionCode='(\d+)'/) || [])[1] || 0);
const versionName = (badging.match(/versionName='([^']*)'/) || [])[1];
const perms = [...badging.matchAll(/^uses-permission: name='([^']+)'/gm)].map(m => m[1]).filter(p => !/DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION$/.test(p));
const certs = run('apksigner', ['verify', '--print-certs', apk]);
const cert = (certs.match(/certificate SHA-256 digest: ([0-9a-f]{64})/) || [])[1];
const schemes = (run('apksigner', ['verify', '--verbose', apk]).match(/Verified using v\d+ scheme[^\n]*: true/g) || []).map(s => s.match(/v\d+/)[0]);

const info = { file: path.basename(apk), bytes: fs.statSync(apk).size, sha256, package: pkg, versionCode, versionName, permissions: perms,
  certificateSha256: cert, signatureSchemes: schemes };
check(pkg === POINTS.package, `package ${pkg}`);
if (args.includes('--allow-unstable') && cert !== POINTS.certificateSha256) console.log(`WARN signing certificate ${cert} is NOT the stable SnapMon Dev key (UNSTABLE-SIGNING build: cannot update an installed SnapMon Dev)`);
else check(cert === POINTS.certificateSha256, `signing certificate SHA-256 ${cert} (stable SnapMon Dev key)`);
check(perms.length === 1 && perms[0] === 'android.permission.CAMERA', `permissions: ${perms.join(', ')}`);
check(versionCode > 1000, `versionCode ${versionCode}, versionName ${versionName}`);
console.log(`     APK SHA-256 ${sha256} (${info.bytes} bytes)`);

const prov = opt('--provenance') ? JSON.parse(fs.readFileSync(opt('--provenance'), 'utf8')) : null;
const exp = { sha256: opt('--expect-sha256'), versionCode: opt('--expect-version-code'), versionName: opt('--expect-version-name'), commit: opt('--expect-commit') };
if (exp.sha256) check(sha256 === exp.sha256.toLowerCase().trim(), `APK SHA-256 equals the expected ${exp.sha256}`);
if (exp.versionCode) check(versionCode === +exp.versionCode, `versionCode equals the expected ${exp.versionCode}`);
if (exp.versionName) check(versionName === exp.versionName, `versionName equals the expected ${exp.versionName}`);
if (exp.commit) check(versionName && versionName.endsWith('+' + exp.commit.slice(0, 7)), `versionName names the expected commit ${exp.commit.slice(0, 7)}`);
if (prov) {
  check(prov.apk && prov.apk.sha256 === sha256, 'APK SHA-256 equals the one recorded at build time (provenance.json)');
  check(prov.apk && prov.apk.versionCode === versionCode && prov.apk.certificateSha256 === cert, 'versionCode and certificate equal the build-time record');
  if (exp.commit) check(prov.commit === exp.commit, `provenance commit ${prov.commit} equals the expected commit`);
}
if (opt('--write')) {
  const out = { schema: 'snapmon-apk-provenance/1', builtAt: new Date().toISOString(), commit: opt('--commit') || null, run: opt('--run-url') || null,
    runAttempt: opt('--run-attempt') ? +opt('--run-attempt') : null, artifact: opt('--artifact') || null, apk: info };
  fs.writeFileSync(opt('--write'), JSON.stringify(out, null, 2) + '\n');
  console.log('     provenance written to ' + opt('--write'));
}
console.log(errors.length ? `\n${errors.length} MISMATCH(ES) — do not archive or install this file as the approved build` : '\nAPK verified');
process.exit(errors.length ? 1 : 0);
