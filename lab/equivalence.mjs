// GPU vs CPU consistency of the standard engine on the labelled photos (lab/bench.html → runEquivalence).
// Usage: node lab/equivalence.mjs <base-url> <photos-dir> <variant>
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));
const [base, photos, variant] = process.argv.slice(2);
const labels = JSON.parse(fs.readFileSync(path.join(photos, 'labels.json'), 'utf8'));
// SwiftShader gives headless Chromium a software WebGPU adapter where the runner supports it
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('page:', m.text().slice(0, 200)); });
await page.goto(base + '/lab/bench.html');
console.log('webgpu adapter in page:', await page.evaluate(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter())));
const { gpu, cpu } = await page.evaluate(([l, v]) => window.runEquivalence(l, v), [labels, variant]);
await browser.close();
const by = Object.fromEntries(cpu.results.map(r => [r.file, r]));
let n = 0, sameDecision = 0, sameTop = 0, sameAll = 0, maxDp = 0, maxDconf = 0, nearThreshold = 0; const diffs = [];
for (const g of gpu.results) {
  const c = by[g.file]; if (!c || g.error || c.error) continue; n++;
  if (g.decision === c.decision) sameDecision++;
  if (g.top[0] === c.top[0]) sameTop++;
  if (JSON.stringify([g.decision, g.top]) === JSON.stringify([c.decision, c.top])) sameAll++; else diffs.push({ file: g.file, gpu: [g.decision, g.top], cpu: [c.decision, c.top] });
  g.clip.forEach((r, i) => { const o = c.clip[i]; if (o) { maxDp = Math.max(maxDp, Math.abs(r.p - o.p)); if (Math.abs(r.p - 0.35) < 0.01 || Math.abs(r.margin - 0.15) < 0.01) nearThreshold++; } });
  g.prod.forEach((x, i) => { const o = c.prod[i]; if (o && o[0] === x[0]) maxDconf = Math.max(maxDconf, Math.abs(x[1] - o[1])); });
}
const ms = rs => { const v = rs.filter(r => r.ms).map(r => r.ms).sort((a, b) => a - b); return v.length ? { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), p95: v[Math.floor(v.length * 0.95)], max: v[v.length - 1] } : null; };
const report = { variant, photos: n, backends: { gpuPass: gpu.load.backends, cpuPass: cpu.load.backends }, load: { gpu: gpu.load, cpu: cpu.load },
  sameFinalDecisionAndChoices: sameAll, sameDecision, sameTop1: sameTop, maxTinyclipScoreDiff: +maxDp.toFixed(5), maxDetectorConfDiff: +maxDconf.toFixed(5),
  regionsWithin001OfAThreshold: nearThreshold, timeMs: { gpu: ms(gpu.results), cpu: ms(cpu.results) }, differing: diffs.slice(0, 15) };
console.log('EQUIV ' + JSON.stringify(report, null, 1));
