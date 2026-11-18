#!/usr/bin/env node
/* Assembles the web game for the Android app (Capacitor webDir, android-app/www) from the SAME files the website
   serves. Nothing here changes the website or its build.

   Usage:
     node tools/android/build-web.js --engine <dir> [--out android-app/www] [--dev-tools] [--version-name X]
       --engine     a folder holding the recognition engine exactly as the Pages deploy assembles it:
                    models/… (detector, classifier, TinyCLIP) and vendor/… (TF.js, ONNX Runtime Web)
                    (tools/android/fetch-engine.sh builds it with the same pinned versions as .github/workflows/pages.yml)
       --dev-tools  keep the developer tools (DEV_TOOLS = true) — private debug APK only. Without it the packaged game
                    has DEV_TOOLS = false (safe default); a release build refuses a dev-tools web game (app/build.gradle).
       --allow-incomplete  skip the engine completeness check (only for local shell experiments; never in CI)

   What differs from the website, and why (all native-only; the shared game code is untouched apart from the
   Platform/engine hooks documented in docs/ANDROID.md):
     • no developer catalogue (catalogue/), no single-file builds (dist/), no PWA manifest
     • the developer-only WebGPU runtime (ort.webgpu.min.js, *.jsep.*, ~22 MB) is left out
     • fonts are bundled (fontsource woff2, SIL OFL) instead of loaded from Google Fonts — no network needed
     • env(safe-area-inset-*) also reads Capacitor's --safe-area-inset-* values (older WebViews report 0)
     • the game scripts are loaded by native/boot.js, after the saved progress has been restored
     • models/manifest.json is rebuilt for exactly the packaged files; every file is size- and SHA-256-checked */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const APP = path.join(ROOT, 'android-app');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const flag = name => args.includes(name);
const OUT = path.resolve(opt('--out') || path.join(APP, 'www'));
const ENGINE = opt('--engine') ? path.resolve(opt('--engine')) : null;
const DEV = flag('--dev-tools');
const fail = msg => { console.error('build-web: ' + msg); process.exit(1); };

if (!ENGINE && !flag('--allow-incomplete')) fail('--engine <dir> is required (see tools/android/fetch-engine.sh)');
if (OUT === ROOT || !OUT.startsWith(APP + path.sep)) fail('refusing to write outside android-app/: ' + OUT);

const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };
const copyDir = (from, to, skip = () => false) => {
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    if (skip(a)) continue;
    fs.statSync(a).isDirectory() ? copyDir(a, b, skip) : copy(a, b);
  }
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

/* ---- game code (same files as the website) ---- */
copyDir(path.join(ROOT, 'src'), path.join(OUT, 'src'));
copy(path.join(ROOT, 'icon.svg'), path.join(OUT, 'icon.svg'));

// DEV_TOOLS: one exact line in src/game.js; a release-safe build flips it to false
const gamePath = path.join(OUT, 'src/game.js');
let game = fs.readFileSync(gamePath, 'utf8');
const devLine = /^const DEV_TOOLS = (true|false);/m;
if (!devLine.test(game)) fail('src/game.js: "const DEV_TOOLS = …;" line not found');
game = game.replace(devLine, `const DEV_TOOLS = ${DEV ? 'true' : 'false'};`);
fs.writeFileSync(gamePath, game);
const GAME_VERSION = (game.match(/const GAME_VERSION = '([^']+)'/) || [])[1];

/* ---- recognition engine: models + runtimes, without the developer-only WebGPU build ---- */
const NOT_PACKAGED = /(^|\/)(ort\.webgpu\.min\.js|[^/]*\.jsep\.(mjs|wasm))$|(^|\/)manifest\.json$/;
if (ENGINE) {
  for (const d of ['models', 'vendor']) {
    if (!fs.existsSync(path.join(ENGINE, d))) fail(`engine folder has no ${d}/: ${ENGINE}`);
    copyDir(path.join(ENGINE, d), path.join(OUT, d), f => NOT_PACKAGED.test(path.relative(ENGINE, f).split(path.sep).join('/')));
  }
}

/* ---- TF.js weight shards get a ".bin" name ----
   Capacitor's local server cannot serve a file whose name has no "." (it returns nothing, or index.html with
   html5mode), and tools/fetch-models.js stores the shards as "group1-shardNofM". Renaming the files and their entries
   in model.json changes no byte of the weights (still SHA-256-checked against models/manifest.json). */
const walkFiles = d => fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walkFiles(p) : [p]; });
if (ENGINE) for (const mj of walkFiles(path.join(OUT, 'models')).filter(f => f.endsWith('model.json'))) {
  const model = JSON.parse(fs.readFileSync(mj, 'utf8')); let renamed = 0;
  for (const g of model.weightsManifest || []) g.paths = g.paths.map(p => {
    const base = path.basename(p); if (base.includes('.')) return p;
    fs.renameSync(path.join(path.dirname(mj), base), path.join(path.dirname(mj), base + '.bin')); renamed++;
    return p + '.bin';
  });
  if (renamed) { fs.writeFileSync(mj, JSON.stringify(model)); console.log(`build-web: ${path.relative(OUT, mj)}: ${renamed} weight shards served as .bin`); }
}

/* ---- fonts (bundled; same families and weights as the website's Google Fonts link) ---- */
const FONTS = { 'pixelify-sans': [500, 700], 'chakra-petch': [400, 500, 600, 700] };
let css = '/* Bundled UI fonts (fontsource, SIL Open Font License 1.1): the Android app needs no network. */\n';
for (const [fam, weights] of Object.entries(FONTS)) {
  const dir = path.join(APP, 'node_modules/@fontsource', fam);
  if (!fs.existsSync(dir)) fail(`@fontsource/${fam} missing: run "npm ci" in android-app/`);
  for (const w of weights) {
    const src = fs.readFileSync(path.join(dir, `${w}.css`), 'utf8');
    css += src.replace(/url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\), url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, (m, f) => {
      copy(path.join(dir, 'files', f), path.join(OUT, 'fonts', f));
      return `url(${f}) format('woff2')`;
    }) + '\n';
  }
  copy(path.join(dir, 'LICENSE'), path.join(OUT, 'fonts', `${fam}-LICENSE.txt`));
}
if (/url\(\.\//.test(css)) fail('font CSS still references unbundled files');
fs.writeFileSync(path.join(OUT, 'fonts/fonts.css'), css);

/* ---- native runtime (Capacitor core, IIFE build) + boot script ---- */
copy(path.join(APP, 'node_modules/@capacitor/core/dist/capacitor.js'), path.join(OUT, 'native/capacitor.js'));
copy(path.join(APP, 'native/boot.js'), path.join(OUT, 'native/boot.js'));
copy(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), path.join(OUT, 'THIRD_PARTY_NOTICES.md'));

/* ---- index.html ---- */
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const mustReplace = (re, to, what) => { if (!re.test(html)) fail('index.html: ' + what + ' not found'); html = html.replace(re, to); };
mustReplace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n/, '', 'Google Fonts preconnect');
mustReplace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2[^"]*">/, '<link rel="stylesheet" href="fonts/fonts.css">', 'Google Fonts stylesheet');
mustReplace(/<link rel="manifest" href="manifest\.webmanifest">\n/, '', 'web app manifest link');
html = html.replace(/env\(safe-area-inset-(top|right|bottom|left)(, *0px)?\)/g, (m, side) => `var(--safe-area-inset-${side}, env(safe-area-inset-${side}, 0px))`);
const block = html.match(/<!--SCRIPTS-->\n([\s\S]*?)<!--\/SCRIPTS-->/);
if (!block) fail('index.html: <!--SCRIPTS--> block not found');
const scripts = [...block[1].matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (!scripts.length || block[1].replace(/<script src="[^"]+"><\/script>\s*/g, '').trim()) fail('index.html: unexpected content in the SCRIPTS block');
for (const s of scripts) if (!fs.existsSync(path.join(OUT, s))) fail('script missing: ' + s);

let sha = 'unknown';
try { sha = execSync('git rev-parse --short=12 HEAD', { cwd: ROOT }).toString().trim(); } catch (e) {}
const build = {
  app: 'snapmon-android', gameVersion: GAME_VERSION, versionName: opt('--version-name') || process.env.SNAPMON_VERSION_NAME || `${GAME_VERSION}-local`,
  versionCode: +(process.env.SNAPMON_VERSION_CODE || 1), commit: sha, devTools: DEV, built: new Date().toISOString(),
};
const inline = `<script>window.SNAPMON_BUILD=${JSON.stringify(build)};window.SNAPMON_SCRIPTS=${JSON.stringify(scripts)};</script>`;
html = html.replace(block[0], `<!--SCRIPTS: loaded by native/boot.js after saved progress is restored (Android app)-->\n${inline}\n<script src="native/capacitor.js"></script>\n<script src="native/boot.js"></script>\n`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'native/build-info.json'), JSON.stringify(build, null, 1) + '\n');

/* ---- manifest of the packaged engine files (same tool and format as the website) ---- */
if (ENGINE) execSync(`node ${JSON.stringify(path.join(ROOT, 'tools/make-manifest.js'))} ${JSON.stringify(OUT)}`, { stdio: 'inherit' });

const total = dir => fs.readdirSync(dir).reduce((a, f) => { const p = path.join(dir, f), s = fs.statSync(p); return a + (s.isDirectory() ? total(p) : s.size); }, 0);
console.log(`build-web: ${path.relative(ROOT, OUT)} ready — game ${GAME_VERSION}, ${scripts.length} scripts, DEV_TOOLS ${DEV}, ${(total(OUT) / 1048576).toFixed(1)} MB`);
if (!flag('--no-check')) execSync(`node ${JSON.stringify(path.join(__dirname, 'check-web.js'))} ${JSON.stringify(OUT)}${ENGINE ? '' : ' --no-engine'}`, { stdio: 'inherit' });
