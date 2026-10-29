// Runs lab/bench.html in headless Chromium and scores the results.
// Usage: node lab/bench.mjs <base-url> <photos-dir> <variant|-> <out-json>
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));
const [base, photos, variantArg, outFile] = process.argv.slice(2);
const variant = variantArg === '-' ? null : variantArg;
const labels = JSON.parse(fs.readFileSync(path.join(photos, 'labels.json'), 'utf8'));
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('page:', m.text().slice(0, 200)); });
await page.goto(base + '/lab/bench.html');
const raw = await page.evaluate(([l, v]) => window.runBench(l, v), [labels, variant]);
await browser.close();
const truthOf = Object.fromEntries(labels.map(l => [l.file, l]));
// score
const S = { prod: [], clip: [], hybrid: [] };
for (const r of raw.results) {
  const L = truthOf[r.file], unknown = L.truth === '__unknown';
  if (r.error) { console.log('error', r.file, r.error); continue; }
  const prodAccepted = r.prod.decision !== 'unknown';
  const prodTop = prodAccepted ? r.prod.cands.map(c => c.obj) : [];
  S.prod.push({ unknown, accepted: prodAccepted, top: prodTop, truth: L.truth, ms: r.prod.ms, conf: r.prod.cands[0] ? r.prod.cands[0].conf : 0 });
  if (r.clip) {
    const best = [...r.clip.regions].sort((a, b) => b.p - a.p)[0], acc = r.clip.regions.filter(g => g.accepted).sort((a, b) => b.p - a.p);
    const top = acc.length ? [...new Set(acc.flatMap(g => g.top.map(t => t.obj)).filter(Boolean))] : [];
    S.clip.push({ unknown, accepted: acc.length > 0, top, truth: L.truth, ms: r.clip.ms, p: best.p, margin: best.margin, cos: best.cos, bestObj: best.top[0] && best.top[0].obj, regions: r.clip.regions });
    S.hybrid.push({ unknown, accepted: r.hybrid.length > 0, top: r.hybrid.map(h => h.obj), truth: L.truth, ms: r.prod.ms + r.clip.ms });
  }
}
function metrics(rows) {
  if (!rows.length) return null;
  const inv = rows.filter(r => !r.unknown), oov = rows.filter(r => r.unknown);
  const top1 = inv.filter(r => r.top[0] === r.truth).length, top3 = inv.filter(r => r.top.slice(0, 3).includes(r.truth)).length;
  const acc = inv.filter(r => r.accepted), wrongAcc = acc.filter(r => r.top[0] !== r.truth).length;
  const ms = rows.map(r => r.ms).sort((a, b) => a - b);
  return { photos: rows.length, objectPhotos: inv.length, oovPhotos: oov.length, top1: +(top1 / inv.length).toFixed(3), top3: +(top3 / inv.length).toFixed(3),
    acceptRate: +(acc.length / inv.length).toFixed(3), precisionWhenAccepted: acc.length ? +((acc.length - wrongAcc) / acc.length).toFixed(3) : null, wrongConfident: +(wrongAcc / inv.length).toFixed(3),
    oovRejected: oov.length ? +(oov.filter(r => !r.accepted).length / oov.length).toFixed(3) : null, msAvg: Math.round(ms.reduce((a, b) => a + b, 0) / ms.length), msP95: ms[Math.floor(ms.length * 0.95)], msMax: ms[ms.length - 1] };
}
// calibration for the experimental lens: choose thresholds on half the photos, report on the other half
let calib = null;
if (S.clip.length) {
  const rows = S.clip.map((r, i) => ({ ...r, split: i % 2 }));
  const correct = r => !r.unknown && r.bestObj === r.truth;
  let bestT = null;
  for (const p of [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7]) for (const m of [0, 0.05, 0.1, 0.15, 0.2, 0.3]) {
    const cal = rows.filter(r => r.split === 0), acc = cal.filter(r => r.bestObj && r.p >= p && r.margin >= m);
    const good = acc.filter(correct).length, bad = acc.length - good, score = good - 3 * bad; // a wrong confident answer costs three right ones
    if (!bestT || score > bestT.score) bestT = { p, margin: m, score, good, bad };
  }
  const test = rows.filter(r => r.split === 1), tAcc = test.filter(r => r.bestObj && r.p >= bestT.p && r.margin >= bestT.margin);
  const bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01].slice(0, -1).map((lo, i, a) => ({ lo, hi: i + 1 < a.length ? a[i + 1] : 1.01 }));
  const reliability = bins.map(b => { const inB = rows.filter(r => r.bestObj && r.p >= b.lo && r.p < b.hi); return { ...b, n: inB.length, acc: inB.length ? +(inB.filter(correct).length / inB.length).toFixed(3) : null }; });
  calib = { accept: { p: bestT.p, margin: bestT.margin }, reliability, heldOut: { photos: test.length, accepted: tAcc.length, precision: tAcc.length ? +(tAcc.filter(correct).length / tAcc.length).toFixed(3) : null,
    oovRejected: +(test.filter(r => r.unknown && !(r.bestObj && r.p >= bestT.p && r.margin >= bestT.margin)).length / Math.max(1, test.filter(r => r.unknown).length)).toFixed(3) }, variant };
  // re-score the experimental lens with the calibrated thresholds
  S.clipCal = rows.map(r => ({ ...r, accepted: !!r.bestObj && r.p >= bestT.p && r.margin >= bestT.margin, top: (r.bestObj && r.p >= bestT.p && r.margin >= bestT.margin) ? [r.bestObj, ...r.regions.flatMap(g => g.top.map(t => t.obj)).filter(o => o && o !== r.bestObj)] : [] }));
}
// "trusted" hybrid: when the experimental lens accepts under the calibrated thresholds its answer goes first, otherwise
// production decides (this is fusion rule 3 in src/lens-clip.js once calibration is deployed). Scored on the held-out half
// only, next to production on the same photos, so the thresholds are not judged on the photos that chose them.
let trusted = null;
if (S.clipCal) {
  const held = S.clipCal.map((r, i) => ({ r, p: S.prod[i] })).filter(x => x.r.split === 1);
  const rows = held.map(({ r, p }) => r.accepted ? { ...p, accepted: true, top: [r.bestObj, ...p.top.filter(o => o !== r.bestObj)], ms: p.ms + r.ms } : { ...p, ms: p.ms + r.ms });
  trusted = { heldOutProduction: metrics(held.map(x => x.p)), heldOutTrustedHybrid: metrics(rows) };
}
// specific pairs from the brief: is a forklift told apart from a train, etc.?
function pairCheck(rows, a, b) { const ra = rows.filter(r => r.truth === a), rb = rows.filter(r => r.truth === b); return { [a]: ra.map(r => r.top[0] || '-').join(','), [b]: rb.map(r => r.top[0] || '-').join(',') }; }
const report = { variant, prodLoad: raw.prodLoad, clipLoad: raw.clipLoad, production: metrics(S.prod), experimental: metrics(S.clip), experimentalCalibrated: S.clipCal ? metrics(S.clipCal) : null, hybrid: metrics(S.hybrid), calib,
  pairs: [['forklift', 'train'], ['office_chair', 'sofa'], ['mug', 'teapot'], ['laptop', 'tv'], ['banana', 'cucumber']].map(([a, b]) => ({ prod: pairCheck(S.prod, a, b), exp: S.clipCal ? pairCheck(S.clipCal, a, b) : null })) };
fs.writeFileSync(outFile, JSON.stringify({ report, raw }, null, 1));
console.log('BENCH ' + JSON.stringify({ ...report, calib: calib && { accept: calib.accept, heldOut: calib.heldOut } }, null, 1));
if (trusted) console.log('TRUSTED ' + JSON.stringify(trusted));
if (calib) console.log('CALIB ' + JSON.stringify(calib));
if (calib) fs.writeFileSync(outFile.replace(/\.json$/, '.calib.json'), JSON.stringify(calib));
// per-object breakdown for the experimental lens
if (S.clipCal) { const by = {}; for (const r of S.clipCal.filter(r => !r.unknown)) { (by[r.truth] = by[r.truth] || []).push(r.top[0] || 'rejected'); } console.log('PER-OBJECT experimental: ' + Object.entries(by).map(([k, v]) => `${k}=[${v.join(',')}]`).join(' ')); }
{ const by = {}; for (const r of S.prod.filter(r => !r.unknown)) { (by[r.truth] = by[r.truth] || []).push(r.top[0] || 'rejected'); } console.log('PER-OBJECT production: ' + Object.entries(by).map(([k, v]) => `${k}=[${v.join(',')}]`).join(' ')); }
