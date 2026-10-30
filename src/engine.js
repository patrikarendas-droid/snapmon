/* SNAPMON — the recognition engine: ONE standard Hybrid recogniser for every player.

   Parts (all on the device, nothing uploaded):
     • Lens (lens.js)      — COCO-SSD lite detector + MobileNet v2 classifier (TF.js; WebGL, CPU fallback)
     • ClipLens (lens-clip.js + workers/clip-worker.js) — TinyCLIP ViT-39M/16 image encoder over a 2,940-label
                             vocabulary (ONNX Runtime Web; WebAssembly/CPU for everyone)
     • ClipLens.hybridDecision — the fusion and second-opinion rules (docs/RECOGNITION.md)

   Every player gets the same model files, vocabulary, thresholds and rules (ENGINE_ID names that set). TinyCLIP always
   runs on the CPU (WASM, one thread) so its scores are identical on every device; the detector/classifier uses the
   GPU (WebGL) where it works, otherwise the CPU with the same weights (measured differences ≤ 0.0001). If either part cannot load or run, hunting
   stops with an explanation and a Retry. There is no weaker fallback recogniser.

   Model files come from Platform.assets (the website today, the APK's bundled assets later). The deploy writes
   models/manifest.json (sizes + SHA-256), used for the download notice and to verify downloads. */
'use strict';

const ENGINE_ID = 'hybrid-1'; // bump whenever a model file, the vocabulary, a threshold or a decision rule changes

const Engine = (() => {
  const FALLBACK_SIZES = { lens: 32.6 * 1048576, clip: 53.5 * 1048576 }; // used if the manifest is missing (upper bounds)
  const st = { state: 'idle', stage: '', loaded: 0, total: 0, error: '', kind: '', loadMs: 0, manifest: null, backends: {} };
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(st); } catch (e) {} });
  let loading = null;
  // timing of every recognition (not only field tests), kept on this phone for the developer panel; never uploaded
  const PERF_KEY = 'snapmon-perf', PERF_MAX = 200;
  function perfLog() { try { return JSON.parse(Platform.storage.get(PERF_KEY) || '[]'); } catch (e) { return []; } }
  function perfAdd(e) { try { const l = perfLog(); l.push(e); Platform.storage.set(PERF_KEY, JSON.stringify(l.slice(-PERF_MAX))); } catch (er) {} }

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
    // after a failure, start both parts from scratch (Retry must really reinitialise, not reuse a broken part)
    if (st.state === 'failed') { ClipLens.reset(); Lens.reset && Lens.reset(); }
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
        const tL = performance.now(); st.stageMs = {};
        if (!(await Lens.load())) throw Object.assign(new Error(Lens.status.error || 'detector/classifier failed to load'), { part: 'lens' });
        st.stageMs.lens = Math.round(performance.now() - tL);
        st.loaded = lensBytes; st.backends.lens = Lens.status.backend; st.stage = 'Object vocabulary model'; emit();
        const tC = performance.now();
        ClipLens.CFG.onProgress = prog => { const got = Object.values(prog).reduce((a, p) => a + (p.loaded || 0), 0); st.loaded = lensBytes + Math.min(clipBytes, got); emit(); };
        if (!(await ClipLens.load())) throw Object.assign(new Error(ClipLens.status.error || 'vocabulary model failed to load'), { kind: ClipLens.status.errorKind, part: 'clip' });
        st.backends.clip = ClipLens.status.info.backend; st.stageMs.clip = Math.round(performance.now() - tC);
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

  /* Recovery. Android Chrome may freeze or discard parts of a page in the background: the GPU (WebGL) context can be
     lost, taking the detector/classifier weights with it, and the TinyCLIP worker can be frozen or stopped. Before
     v0.4.2 the engine still reported "ready" afterwards, so every hunt failed until the page was reloaded.
     check() asks both parts whether they still work (called when the app returns to the foreground); recover() throws
     both parts away and loads them again from the copies saved on the phone (no download). Only one recovery runs at a
     time, and it waits for any load already in progress. A page Chrome has killed entirely restarts from scratch. */
  let recovering = null, checkingP = null;
  // while checking, the engine does not count as ready (the game disables SNAP), so a stale "ready" is never used
  async function check() {
    if (st.state !== 'ready') return st.state !== 'failed';
    if (checkingP) return checkingP;
    st.checking = true; emit(); // not "ready" from this moment until the check is over
    checkingP = (async () => {
      try {
        const ok = Lens.healthy() && await ClipLens.ping();
        if (!ok) { st.recoveries = (st.recoveries || 0) + 1; await recover('check'); }
        return st.state === 'ready';
      } finally { st.checking = false; checkingP = null; emit(); }
    })();
    return checkingP;
  }
  const ready = () => st.state === 'ready' && !st.checking && !recovering && !loading;
  function recover(why) {
    if (recovering) return recovering;
    recovering = (async () => {
      if (loading) { try { await loading; } catch (e) {} }
      st.lastRecovery = { why, t: Date.now() };
      ClipLens.reset(); Lens.reset && Lens.reset();
      Object.assign(st, { state: 'idle', backends: {} }); emit();
      const ok = await load();
      recovering = null;
      return ok;
    })();
    return recovering;
  }

  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('recognition timed out'), { kind: 'timeout' })), ms))]);
  // Recognise one photo with the standard pipeline. Returns { rec, prodOnly, clip }: rec carries the final decision.
  async function recognize(img, { timeoutMs = 45000 } = {}) {
    if (st.state !== 'ready') throw Object.assign(new Error('recognition engine not ready'), { kind: 'not-ready' });
    try { return await recognizeOnce(img, timeoutMs); }
    catch (e) {
      const kind = (e && e.kind) || kindOf(e, 'run');
      if (kind === 'busy') throw Object.assign(e instanceof Error ? e : new Error(String(e)), { kind });
      // too slow: report it now (no second long wait), but reload in the background in case something is stuck
      if (kind === 'timeout') { st.recoveries = (st.recoveries || 0) + 1; recover('timeout'); throw Object.assign(e instanceof Error ? e : new Error(String(e)), { kind }); }
      // the engine may have lost its GPU context or worker (e.g. after the app was in the background): reload both
      // parts from the phone's cache and try this photo once more, with the same models
      st.recoveries = (st.recoveries || 0) + 1;
      if (await recover('run: ' + kind)) {
        try { return await recognizeOnce(img, timeoutMs); }
        catch (e2) { st.state = 'failed'; st.error = String(e2.message || e2); st.kind = (e2 && e2.kind) || kindOf(e2, 'run'); emit(); throw Object.assign(e2 instanceof Error ? e2 : new Error(String(e2)), { kind: st.kind }); }
      }
      throw Object.assign(e instanceof Error ? e : new Error(String(e)), { kind: st.kind || kind });
    }
  }
  async function recognizeOnce(img, timeoutMs) {
    const t0 = performance.now();
    const rec = await timeout(Lens.recognize(img), timeoutMs);
    const prodOnly = { decision: rec.decision, reason: rec.reason, candidates: rec.candidates.slice() };
    const clip = await timeout(ClipLens.recognize(rec.image, rec), timeoutMs);
    const h = ClipLens.hybridDecision(rec, clip, Lens.CFG);
    rec.candidates = h.candidates; rec.decision = h.decision; rec.reason = h.reason;
    rec.debug.decision = h.decision + (h.reason === 'disagree' ? ' (lenses disagree)' : h.reason === 'second-opinion' ? ' (second opinion)' : '');
    const ms = Math.round(performance.now() - t0), backends = { lens: Lens.status.backend, clip: ClipLens.status.info.backend };
    rec.debug.engine = { id: ENGINE_ID, backends, totalMs: ms };
    perfAdd({ t: Date.now(), ms, lensMs: rec.debug.times && rec.debug.times.total, clipMs: clip.totalMs, clipInferMs: clip.inferMs, crops: clip.regions.length, backends });
    return { rec, prodOnly, clip, ms };
  }

  // developer testing only (same models, reloads the engine):
  //   setForceCPU — the detector/classifier on TF.js's CPU backend instead of WebGL (TinyCLIP is on the CPU anyway)
  //   setClipGPU  — TinyCLIP on WebGPU, to compare speed and results with the standard CPU path
  const reload = () => { ClipLens.reset(); Lens.reset && Lens.reset(); Object.assign(st, { state: 'idle', backends: {} }); emit(); };
  function setForceCPU(on) { Lens.CFG.forceCPU = !!on; reload(); }
  function setClipGPU(on) { ClipLens.CFG.backend = on ? 'webgpu' : 'wasm'; reload(); }
  async function clearCache() {
    try { await caches.delete('snapmon-models-v1'); } catch (e) {}
    try { await Lens.clearCache(); } catch (e) {}
    reload();
  }

  return { load, recognize, check, recover, ready, downloadBytes, manifest, setForceCPU, setClipGPU, clearCache, perfLog, clearPerf: () => Platform.storage.remove(PERF_KEY), status: st, onChange: f => { listeners.add(f); return () => listeners.delete(f); }, ID: ENGINE_ID };
})();
