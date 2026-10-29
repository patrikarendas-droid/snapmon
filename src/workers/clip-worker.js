/* SNAPMON — TinyCLIP worker (part of the standard Hybrid recogniser, see engine.js). Runs off the main thread.
   Receives preprocessed 224×224 crops, returns vocabulary scores. Text embeddings for the whole vocabulary are
   precomputed offline (lab/export_clip.py), so only the image encoder runs on the phone.

   Standard backend for every player: WebAssembly (CPU), single-threaded, so every device does the same arithmetic
   and reaches the same decision (WebGPU gave a different outcome on ~4.5% of photos, docs/RECOGNITION.md). WebGPU is
   kept only as a developer comparison option ('webgpu': tries the GPU, falls back to WASM with the same weights). Downloads stream with progress, are checked for completeness
   (and against the deploy manifest's SHA-256 when one is given) before they are cached, and a cached file that fails
   to load is purged so a retry downloads it again.

   Messages: {type:'init', base, ortBase, backend:'wasm'|'webgpu', expect} → progress* → {type:'ready', info}
             {type:'run', id, crops:Float32Array, n} → {type:'result', id, top, ms} */
'use strict';
let session = null, vocab = null, meta = null, dim = 0, nLabels = 0, backend = '';
const CACHE = 'snapmon-models-v1';
const progress = (file, loaded, total) => self.postMessage({ type: 'progress', file, loaded, total });

async function sha256(buf) {
  if (!self.crypto || !crypto.subtle) return null;
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Cache API keeps model files on the phone after the first complete download.
async function cachedFetch(url, file, expect) {
  let cache = null;
  try { cache = await caches.open(CACHE); } catch (e) { /* storage blocked: plain download every time */ }
  if (cache) {
    const hit = await cache.match(url);
    if (hit) { const buf = await hit.arrayBuffer(); progress(file, buf.byteLength, buf.byteLength); return { buf, cached: true }; }
  }
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error('download failed (' + r.status + ') ' + file), { kind: 'download' });
  const total = +r.headers.get('content-length') || (expect && expect.bytes) || 0;
  let buf;
  if (r.body && r.body.getReader) {
    const reader = r.body.getReader(), parts = []; let got = 0, last = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      parts.push(value); got += value.byteLength;
      if (got - last > 262144) { last = got; progress(file, got, total); }
    }
    const u8 = new Uint8Array(got); let o = 0; for (const p of parts) { u8.set(p, o); o += p.byteLength; }
    buf = u8.buffer;
  } else buf = await r.arrayBuffer();
  progress(file, buf.byteLength, total || buf.byteLength);
  // an interrupted transfer must never be cached as if it were the model
  if (total && buf.byteLength !== total && !r.headers.get('content-encoding')) throw Object.assign(new Error('download interrupted: ' + file), { kind: 'download' });
  if (expect && expect.bytes && buf.byteLength !== expect.bytes) throw Object.assign(new Error('incomplete download: ' + file), { kind: 'download' });
  if (expect && expect.sha256) { const h = await sha256(buf); if (h && h !== expect.sha256) throw Object.assign(new Error('corrupted download: ' + file), { kind: 'download' }); }
  if (cache) { try { await cache.put(url, new Response(buf.slice(0), { headers: { 'content-type': 'application/octet-stream' } })); } catch (e) { /* quota: fine */ } }
  return { buf, cached: false };
}
async function purge(urls) { try { const c = await caches.open(CACHE); for (const u of urls) await c.delete(u); } catch (e) {} }

function f16ToF32(u16) {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i], s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
    out[i] = e === 0 ? s * Math.pow(2, -14) * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + f / 1024);
  }
  return out;
}
const memoryError = e => /memory|allocation|RangeError|Aborted\(\)|OOM/i.test(String(e && (e.message || e)));

async function makeSession(modelBuf, which) {
  const s = await ort.InferenceSession.create(new Uint8Array(modelBuf), { executionProviders: which === 'webgpu' ? ['webgpu'] : ['wasm'], graphOptimizationLevel: 'all' });
  // warm-up (also proves the backend really runs this model) so the first photo is not slowed down by compilation
  const sz = meta.image.size;
  await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', new Float32Array(3 * sz * sz), [1, 3, sz, sz]) });
  return s;
}

// test: { failGPU, failCPU } lets automated tests simulate backend failures; never set by the game itself
async function init({ base, ortBase, backend: want = 'wasm', expect = {}, test = {} }) {
  const t0 = performance.now();
  let gpu = false;
  if (want === 'webgpu') {
    gpu = !!test.failGPU;
    if (!gpu && navigator.gpu) { try { gpu = !!(await navigator.gpu.requestAdapter()); } catch (e) { gpu = false; } }
  }
  // the WebGPU bundle also contains the WASM backend; the standard path loads only the smaller CPU build
  importScripts(ortBase + (gpu ? 'ort.webgpu.min.js' : 'ort.min.js'));
  ort.env.wasm.wasmPaths = ortBase;
  // one thread on every device: the same WASM binary, the same operation order, the same result
  ort.env.wasm.numThreads = 1;
  const urls = { meta: base + 'vocab.json', vocab: base + 'vocab.bin' };
  meta = JSON.parse(new TextDecoder().decode((await cachedFetch(urls.meta, 'vocab.json', expect['vocab.json'])).buf));
  urls.model = base + meta.model;
  const [m, v] = await Promise.all([cachedFetch(urls.model, meta.model, expect[meta.model]), cachedFetch(urls.vocab, 'vocab.bin', expect['vocab.bin'])]);
  dim = meta.dim; nLabels = meta.labels.length;
  vocab = f16ToF32(new Uint16Array(v.buf));
  if (vocab.length !== dim * nLabels) { await purge(Object.values(urls)); throw Object.assign(new Error('vocabulary file does not match the model'), { kind: 'download' }); }
  let gpuError = null;
  if (gpu) {
    try { if (test.failGPU) throw new Error('simulated WebGPU failure'); session = await makeSession(m.buf, 'webgpu'); backend = 'webgpu'; }
    catch (e) { gpuError = String(e.message || e); session = null; }
  }
  if (!session) {
    try { if (test.failCPU) throw new Error(test.failCPU); session = await makeSession(m.buf, 'wasm'); backend = 'wasm'; }
    catch (e) {
      if (m.cached) await purge([urls.model]); // maybe a damaged cached copy: download it again next time
      throw Object.assign(new Error('the model failed to run on the CPU: ' + (e.message || e)), { kind: memoryError(e) ? 'memory' : 'init' });
    }
  }
  return { backend, requested: want, threads: ort.env.wasm.numThreads, gpuError, loadMs: Math.round(performance.now() - t0), labels: nLabels, dim, modelBytes: m.buf.byteLength, vocabBytes: v.buf.byteLength,
    name: meta.name, variant: meta.variant, fromCache: m.cached && v.cached };
}

async function run({ crops, n, k = 8 }) {
  const t0 = performance.now(), s = meta.image.size;
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', crops, [n, 3, s, s]) });
  const emb = out[session.outputNames[0]].data;
  const scale = meta.scale, top = [];
  for (let c = 0; c < n; c++) {
    let norm = 0; for (let d = 0; d < dim; d++) norm += emb[c * dim + d] ** 2; norm = Math.sqrt(norm) || 1;
    const cos = new Float32Array(nLabels);
    let mx = -1e9;
    for (let l = 0; l < nLabels; l++) { let dot = 0; const o = l * dim; for (let d = 0; d < dim; d++) dot += emb[c * dim + d] * vocab[o + d]; cos[l] = dot / norm; if (cos[l] > mx) mx = cos[l]; }
    // softmax over the whole vocabulary (temperature = model's logit scale); summed per object later
    let sum = 0; const p = new Float32Array(nLabels);
    for (let l = 0; l < nLabels; l++) { p[l] = Math.exp(scale * (cos[l] - mx)); sum += p[l]; }
    const idx = Array.from({ length: nLabels }, (_, i) => i).sort((a, b) => p[b] - p[a]).slice(0, k);
    top.push(idx.map(i => ({ i, p: p[i] / sum, cos: +cos[i].toFixed(4) })));
  }
  return { top, ms: Math.round(performance.now() - t0) };
}

self.onmessage = async ev => {
  const m = ev.data;
  try {
    if (m.type === 'init') self.postMessage({ type: 'ready', info: await init(m) });
    else if (m.type === 'run') self.postMessage({ type: 'result', id: m.id, ...(await run(m)) });
  } catch (e) { self.postMessage({ type: 'error', id: m.id, error: String(e && e.message || e), kind: (e && e.kind) || (memoryError(e) ? 'memory' : 'init') }); }
};
