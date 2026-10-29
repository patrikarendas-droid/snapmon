/* SNAPMON — the recognition engine: ONE standard Hybrid recogniser for every player.

   Parts (all on the device, nothing uploaded):
     • Lens (lens.js)      — COCO-SSD lite detector + MobileNet v2 classifier (TF.js; WebGL, CPU fallback)
     • ClipLens (lens-clip.js + workers/clip-worker.js) — TinyCLIP ViT-39M/16 image encoder over a 2,940-label
                             vocabulary (ONNX Runtime Web; WebGPU, WASM/CPU fallback)
     • ClipLens.hybridDecision — the fusion and second-opinion rules (docs/RECOGNITION.md)

   Every player gets the same model files, vocabulary, thresholds and rules (ENGINE_ID names that set). Hardware only
   changes speed: GPU where it works, otherwise CPU with the same weights. If either part cannot load or run, hunting
   stops with an explanation and a Retry. There is no weaker fallback recogniser.

   Model files come from Platform.assets (the website today, the APK's bundled assets later). The deploy writes
   models/manifest.json (sizes + SHA-256), used for the download notice and to verify downloads. */
'use strict';

const ENGINE_ID = 'hybrid-1'; // bump whenever a model file, the vocabulary, a threshold or a decision rule changes

const Engine = (() => {
  const FALLBACK_SIZES = { lens: 32.6 * 1048576, clip: 63.4 * 1048576 }; // used if the manifest is missing (upper bounds)
  const st = { state: 'idle', stage: '', loaded: 0, total: 0, error: '', kind: '', loadMs: 0, manifest: null, backends: {} };
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(st); } catch (e) {} });
  let loading = null;

  async function manifest() {
    if (st.manifest) return st.manifest;
    try { const r = await fetch(Platform.assets.url('models/manifest.json'), { cache: 'no-cache' }); if (r.ok) st.manifest = await r.json(); } catch (e) {}
    return st.manifest;
  }
  // approximate one-time download, for the notice
  async function downloadBytes() {
    const m = await manifest();
    if (m && m.groups) return (m.groups.lens || FALLBACK_SIZES.lens) + (m.groups.clip || FALLBACK_SIZES.clip);
    return FALLBACK_SIZES.lens + FALLBACK_SIZES.clip;
  }

  // classify a failure into something the player can act on
  function kindOf(e, part) {
    const msg = String((e && (e.message || e)) || '');
    if (e && e.kind) return e.kind; // the worker already knows (download / memory / init / timeout / crash)
    if (!Platform.device.online()) return 'offline';
    if (/download|fetch|network|404|unavailable|could not/i.test(msg)) return 'download';
    if (/memory|allocation|RangeError|OOM|Aborted\(\)/i.test(msg)) return 'memory';
    if (/timed out|timeout/i.test(msg)) return 'timeout';
    if (!Platform.device.wasm()) return 'unsupported';
    return part === 'run' ? 'run' : 'init';
  }

  function load() {
    if (st.state === 'ready') return Promise.resolve(true);
    if (loading) return loading;
    loading = (async () => {
      const t0 = performance.now();
      Object.assign(st, { state: 'loading', error: '', kind: '', stage: 'Preparing…', loaded: 0, total: 0 }); emit();
      try {
        if (!Platform.device.wasm()) throw Object.assign(new Error('this browser cannot run WebAssembly'), { kind: 'unsupported' });
        const m = await manifest();
        const lensBytes = (m && m.groups && m.groups.lens) || FALLBACK_SIZES.lens, clipBytes = (m && m.groups && m.groups.clip) || FALLBACK_SIZES.clip;
        st.total = lensBytes + clipBytes;
        if (m && m.files) {
          const pre = 'models/clip/' + ClipLens.CFG.variant + '/', expect = {};
          for (const f of m.files) if (f.path.startsWith(pre)) expect[f.path.slice(pre.length)] = { bytes: f.bytes, sha256: f.sha256 };
          ClipLens.CFG.expect = expect;
        }
        // one part after the other keeps peak memory and bandwidth lower on phones
        st.stage = 'Object detector and classifier'; emit();
        if (!(await Lens.load())) throw Object.assign(new Error(Lens.status.error || 'detector/classifier failed to load'), { part: 'lens' });
        st.loaded = lensBytes; st.backends.lens = Lens.status.backend; st.stage = 'Object vocabulary model'; emit();
        ClipLens.CFG.onProgress = prog => { const got = Object.values(prog).reduce((a, p) => a + (p.loaded || 0), 0); st.loaded = lensBytes + Math.min(clipBytes, got); emit(); };
        if (!(await ClipLens.load())) throw Object.assign(new Error(ClipLens.status.error || 'vocabulary model failed to load'), { kind: ClipLens.status.errorKind, part: 'clip' });
        st.backends.clip = ClipLens.status.info.backend;
        st.loaded = st.total; st.loadMs = Math.round(performance.now() - t0); st.state = 'ready'; st.stage = '';
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {} // ask the browser not to evict the models
      } catch (e) {
        st.state = 'failed'; st.error = String(e.message || e); st.kind = kindOf(e, 'load'); st.stage = '';
      }
      loading = null; emit();
      return st.state === 'ready';
    })();
    return loading;
  }

  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('recognition timed out'), { kind: 'timeout' })), ms))]);
  // Recognise one photo with the standard pipeline. Returns { rec, prodOnly, clip }: rec carries the final decision.
  async function recognize(img, { timeoutMs = 45000 } = {}) {
    if (st.state !== 'ready') throw Object.assign(new Error('recognition engine not ready'), { kind: 'not-ready' });
    const t0 = performance.now();
    try {
      const rec = await timeout(Lens.recognize(img), timeoutMs);
      const prodOnly = { decision: rec.decision, reason: rec.reason, candidates: rec.candidates.slice() };
      const clip = await timeout(ClipLens.recognize(rec.image, rec), timeoutMs);
      const h = ClipLens.hybridDecision(rec, clip, Lens.CFG);
      rec.candidates = h.candidates; rec.decision = h.decision; rec.reason = h.reason;
      rec.debug.decision = h.decision + (h.reason === 'disagree' ? ' (lenses disagree)' : h.reason === 'second-opinion' ? ' (second opinion)' : '');
      rec.debug.engine = { id: ENGINE_ID, backends: { lens: Lens.status.backend, clip: ClipLens.status.info.backend }, totalMs: Math.round(performance.now() - t0) };
      return { rec, prodOnly, clip, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      // a crashed worker or a lost GPU context leaves the engine unusable: make the next attempt reload it
      if (ClipLens.status.state !== 'ready') { st.state = 'failed'; emit(); }
      throw Object.assign(e instanceof Error ? e : new Error(String(e)), { kind: (e && e.kind) || kindOf(e, 'run') });
    }
  }

  // developer testing: force the CPU path for both parts (same models) and reload
  function setForceCPU(on) {
    Lens.CFG.forceCPU = !!on; ClipLens.CFG.forceBackend = on ? 'wasm' : null;
    ClipLens.reset(); Lens.reset && Lens.reset(); Object.assign(st, { state: 'idle', backends: {} }); emit();
  }
  async function clearCache() {
    try { await caches.delete('snapmon-models-v1'); } catch (e) {}
    try { await Lens.clearCache(); } catch (e) {}
    ClipLens.reset(); Lens.reset && Lens.reset(); Object.assign(st, { state: 'idle', backends: {} }); emit();
  }

  return { load, recognize, downloadBytes, manifest, setForceCPU, clearCache, status: st, onChange: f => { listeners.add(f); return () => listeners.delete(f); }, ID: ENGINE_ID };
})();
