/* SNAPMON — experimental Spirit Lens worker (CLIP-style image encoder via ONNX Runtime Web).
   Runs off the main thread. Receives preprocessed 224×224 crops, returns vocabulary scores.
   Text embeddings for the whole vocabulary are precomputed offline (lab/export_clip.py), so phones
   only download the image encoder. Messages: {type:'init', base, ortBase, preferGPU} → {type:'ready'}
                                             {type:'run', id, crops:Float32Array, n} → {type:'result', id, top} */
'use strict';
let session = null, vocab = null, meta = null, dim = 0, nLabels = 0, backend = '';

async function cachedFetch(url) {
  // Cache API keeps the model on the phone after the first download (falls back to a normal fetch)
  try {
    const c = await caches.open('snapmon-models-v1');
    const hit = await c.match(url);
    if (hit) return hit;
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status + ' ' + url);
    try { await c.put(url, r.clone()); } catch (e) {}
    return r;
  } catch (e) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('download failed (' + r.status + ') ' + url.split('/').pop());
    return r;
  }
}
function f16ToF32(u16) {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i], s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
    out[i] = e === 0 ? s * Math.pow(2, -14) * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + f / 1024);
  }
  return out;
}

async function init({ base, ortBase, preferGPU }) {
  const t0 = performance.now();
  let useGPU = false;
  if (preferGPU && typeof navigator !== 'undefined' && navigator.gpu) { try { useGPU = !!(await navigator.gpu.requestAdapter()); } catch (e) { useGPU = false; } }
  importScripts(ortBase + (useGPU ? 'ort.webgpu.min.js' : 'ort.min.js'));
  ort.env.wasm.wasmPaths = ortBase;
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
  meta = await (await cachedFetch(base + 'vocab.json')).json();
  const [modelBuf, vocBuf] = await Promise.all([
    cachedFetch(base + meta.model).then(r => r.arrayBuffer()),
    cachedFetch(base + 'vocab.bin').then(r => r.arrayBuffer()),
  ]);
  dim = meta.dim; nLabels = meta.labels.length;
  vocab = f16ToF32(new Uint16Array(vocBuf));
  const providers = useGPU ? ['webgpu', 'wasm'] : ['wasm'];
  session = await ort.InferenceSession.create(new Uint8Array(modelBuf), { executionProviders: providers, graphOptimizationLevel: 'all' });
  backend = useGPU ? 'webgpu' : 'wasm';
  // warm-up so the first real photo is not slowed down by kernel compilation
  const s = meta.image.size;
  await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', new Float32Array(3 * s * s), [1, 3, s, s]) });
  return { backend, loadMs: Math.round(performance.now() - t0), labels: nLabels, dim, modelBytes: modelBuf.byteLength, vocabBytes: vocBuf.byteLength, name: meta.name };
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
  } catch (e) { self.postMessage({ type: 'error', id: m.id, error: String(e && e.message || e) }); }
};
