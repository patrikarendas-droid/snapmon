/* SNAPMON — TinyCLIP half of the standard Hybrid recogniser (see engine.js): zero-shot recognition over a large
   everyday-object vocabulary. Every player runs the same model, vocabulary and thresholds.
   Pipeline: production COCO-SSD boxes (if any) + the whole photo → 224 px crops → image encoder in a worker →
   cosine similarity against precomputed text embeddings → per-object probabilities → rejection rules.
   CLIP similarities are NOT probabilities: the shown "calibrated confidence" comes from a reliability table measured
   on a labelled benchmark (lab/), and is absent when no calibration is available. */
'use strict';

const ClipLens = (() => {
  const CFG = {
    variant: 'tinyclip-39m16',
    base: 'models/clip/',          // packaged assets (Platform.assets)
    localOrt: 'vendor/ort/',
    workerPath: 'src/workers/clip-worker.js',
    backend: 'wasm',                // standard for every player: CPU (WebAssembly), identical results on every device.
                                    // 'webgpu' = developer comparison only (GPU, faster on some phones, ~4.5% of outcomes differ)
    expect: null,                   // { file: {bytes, sha256} } from the deploy manifest, checked by the worker
    test: null,                     // automated tests only: { failGPU, failCPU } simulates backend failures
    // fallback thresholds; replaced by the benchmark's calibration in vocab.json when present
    accept: { p: 0.35, margin: 0.12 },
    MAX_CROPS: 4,
    TIMEOUT_MS: 30000,
  };
  const st = { state: 'off', error: '', errorKind: '', info: null, worker: null, seq: 0, pending: new Map(), meta: null, busy: false, progress: {} };

  function workerURL() {
    if (window.__SNAPMON_CLIP_WORKER) return URL.createObjectURL(new Blob([window.__SNAPMON_CLIP_WORKER], { type: 'text/javascript' }));
    return new URL(CFG.workerPath, location.href).href;
  }

  async function load() {
    if (st.state === 'ready') return true;
    if (st.loading) return st.loading;
    st.loading = (async () => {
      st.state = 'loading'; st.error = '';
      try {
        const base = Platform.assets.url(CFG.base + CFG.variant + '/'), ortBase = Platform.assets.url(CFG.localOrt);
        st.worker = new Worker(workerURL());
        st.worker.onmessage = ev => {
          const m = ev.data;
          if (m.type === 'progress') { st.progress[m.file] = { loaded: m.loaded, total: m.total }; if (CFG.onProgress) CFG.onProgress(st.progress); return; }
          const pend = st.pending.get(m.id != null ? m.id : 'init');
          if (!pend) return;
          st.pending.delete(m.id != null ? m.id : 'init'); clearTimeout(pend.timer);
          m.type === 'error' ? pend.reject(Object.assign(new Error(m.error), { kind: m.kind })) : pend.resolve(m);
        };
        // the worker process itself can die (Android reclaiming memory): reject whatever was waiting
        st.worker.onerror = e => { for (const p of st.pending.values()) p.reject(Object.assign(new Error('recognition worker stopped: ' + (e.message || 'unknown')), { kind: 'crash' })); st.pending.clear(); st.state = 'failed'; };
        const ready = await call('init', { type: 'init', base, ortBase, backend: CFG.backend, expect: CFG.expect || {}, test: CFG.test || {} }, 240000);
        st.info = ready.info;
        st.meta = await (await fetch(base + 'vocab.json')).json(); // served from the HTTP/Cache copy the worker just verified
        st.state = 'ready';
      } catch (e) { st.state = 'failed'; st.error = String(e.message || e); st.errorKind = e.kind || (e.code === 'timeout' ? 'timeout' : 'init'); if (st.worker) st.worker.terminate(); st.worker = null; }
      st.loading = null;
      return st.state === 'ready';
    })();
    return st.loading;
  }
  function call(id, msg, timeout = CFG.TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { st.pending.delete(id); reject(Object.assign(new Error('recognition timed out'), { code: 'timeout', kind: 'timeout' })); }, timeout);
      st.pending.set(id, { resolve, reject, timer });
      st.worker.postMessage(msg, msg.crops ? [msg.crops.buffer] : []);
    });
  }

  /* CLIP preprocessing: square crop (with padding) → 224×224 → RGB normalised with CLIP mean/std, CHW */
  function prep(src, box, size, mean, std) {
    const W = src.width, H = src.height;
    let x, y, w, h;
    if (box) { x = box[0] * W; y = box[1] * H; w = box[2] * W; h = box[3] * H; } else { x = 0; y = 0; w = W; h = H; }
    const side = Math.min(Math.max(w, h) * (box ? 1.15 : 1), Math.max(W, H));
    const sx = Math.max(0, Math.min(W - side, x + w / 2 - side / 2)), sy = Math.max(0, Math.min(H - side, y + h / 2 - side / 2));
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#7f7f7f'; ctx.fillRect(0, 0, size, size);
    const sw = Math.min(side, W), sh = Math.min(side, H);
    ctx.drawImage(src, sx, sy, sw, sh, (size - size * sw / side) / 2, (size - size * sh / side) / 2, size * sw / side, size * sh / side);
    const d = ctx.getImageData(0, 0, size, size).data, out = new Float32Array(3 * size * size), n = size * size;
    for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) out[ch * n + i] = (d[i * 4 + ch] / 255 - mean[ch]) / std[ch];
    return out;
  }

  // Aggregate label probabilities per object, apply rejection, attach calibrated confidence.
  // Scores are rounded to 3 decimals before any threshold or comparison: WebGPU and the CPU produce float results
  // that differ in the last digits, and rounding makes those differences flip a decision far less often (the
  // remaining risk is a score sitting exactly on a boundary; measured in docs/RECOGNITION.md).
  const r3 = x => Math.round(x * 1000) / 1000;
  function judge(top) {
    const labels = st.meta.labels, per = new Map();
    top = top.map(t => ({ ...t, p: r3(t.p) }));
    for (const t of top) { const L = labels[t.i]; const key = L.o || '__none'; const e = per.get(key) || { obj: L.o || null, label: L.l, p: 0, cos: t.cos }; e.p += t.p; if (t.cos > e.cos) { e.cos = t.cos; } per.set(key, e); }
    for (const e of per.values()) e.p = r3(e.p);
    // ties are broken by name so every device ranks equal scores the same way
    const ranked = [...per.values()].sort((a, b) => b.p - a.p || String(a.obj || a.label).localeCompare(String(b.obj || b.label)));
    const best = ranked[0], second = ranked[1] || { p: 0 };
    const th = (st.meta.calib && st.meta.calib.accept) || CFG.accept;
    const margin = r3(best.p - second.p);
    let accepted = !!best.obj && best.p >= th.p && margin >= th.margin, why = accepted ? 'accepted' : !best.obj ? 'background or person' : best.p < th.p ? 'low score' : 'ambiguous';
    if (accepted && st.meta.calib && st.meta.calib.minCos && best.cos < st.meta.calib.minCos) { accepted = false; why = 'weak match'; }
    return { best, ranked: ranked.slice(0, 5), margin, accepted, why, calibrated: calibrate(best.p) };
  }
  function calibrate(p) {
    const bins = st.meta && st.meta.calib && st.meta.calib.reliability;
    if (!bins) return null; // never invent a probability
    const b = bins.find(x => p >= x.lo && p < x.hi) || bins[bins.length - 1];
    return b && b.n >= 5 ? b.acc : null;
  }

  /* recognise: regions = production boxes (if any) + whole photo */
  async function recognize(img, prodRec) {
    if (st.state !== 'ready') throw new Error('experimental lens not ready');
    if (st.busy) throw Object.assign(new Error('a recognition is already running'), { code: 'busy' });
    st.busy = true;
    try {
      const t0 = performance.now(), m = st.meta, size = m.image.size;
      const regions = [{ box: null, cls: 'whole photo' }, ...((prodRec && prodRec.boxes) || []).slice(0, CFG.MAX_CROPS - 1)];
      const buf = new Float32Array(regions.length * 3 * size * size);
      regions.forEach((r, i) => buf.set(prep(img, r.box, size, m.image.mean, m.image.std), i * 3 * size * size));
      const res = await call(++st.seq, { type: 'run', id: st.seq, crops: buf, n: regions.length });
      const per = regions.map((r, i) => ({ ...r, ...judge(res.top[i]) }));
      return { regions: per, inferMs: res.ms, totalMs: Math.round(performance.now() - t0), backend: st.info.backend };
    } finally { st.busy = false; }
  }

  /* Hybrid decision: CLIP refines production results; production stays the fallback.
     Rules (documented in docs/RECOGNITION.md and tested in tests/clip-fusion.js):
       1. A region where CLIP is accepted AND agrees with the production object → that object (both models agree).
       2. CLIP accepted, production names the same category → CLIP's object (more specific: truck → forklift).
       3. CLIP accepted and trusted, production disagrees or found nothing → CLIP's object. "Trusted" = the calibrated
          confidence for its score bin, or (bins too sparse) the held-out precision of the calibrated thresholds, is ≥ 0.7.
          Without deployed calibration this rule never fires.
       4. Otherwise → the production candidate for that region (or nothing). */
  function trust(r) {
    if (r.calibrated != null) return r.calibrated;
    const h = st.meta && st.meta.calib && st.meta.calib.heldOut;
    return h && h.precision != null && h.accepted >= 10 ? h.precision : 0;
  }
  function fuse(prodRec, clipRes) {
    const out = [], cands = prodRec.candidates || [], claimed = new Map();
    // each production candidate belongs to one region: boxed regions claim theirs first, the whole photo takes what is
    // left (otherwise one detected clock was counted twice, as "wall clock" and "clock", in the third field test)
    const sameBox = (c, r) => c.box && Math.abs(c.box[0] - r.box[0]) < 0.02 && Math.abs(c.box[1] - r.box[1]) < 0.02;
    const regions = [...clipRes.regions].sort((a, b) => (a.box ? 0 : 1) - (b.box ? 0 : 1));
    for (const r of regions) {
      const free = cands.filter(c => !claimed.has(c));
      const prod = r.box ? free.find(c => sameBox(c, r)) : free.find(c => !c.box) || free[0];
      if (prod) claimed.set(prod, r);
      const c = r.best;
      let pick = null, rule = 4;
      if (r.accepted && prod && prod.obj === c.obj) { pick = { ...prod, label: c.label, obj: c.obj, conf: Math.max(prod.conf, r.calibrated || c.p) }; rule = 1; }
      else if (r.accepted && prod && OBJECTS[c.obj] && OBJECTS[c.obj].cat === prod.cat) { pick = { ...prod, label: c.label, obj: c.obj, conf: Math.max(prod.conf, r.calibrated || c.p) }; rule = 2; }
      else if (r.accepted && trust(r) >= 0.7) { pick = { label: c.label, obj: c.obj, cat: OBJECTS[c.obj].cat, conf: trust(r), box: r.box, src: 'clip' }; rule = 3; }
      else if (prod) pick = prod;
      if (pick && !out.some(o => o.obj === pick.obj)) out.push({ ...pick, rule });
    }
    // production's other ideas stay available as choices (rule 4), so fusing never removes a right answer
    for (const c of cands) if (!claimed.has(c) && !out.some(o => o.obj === c.obj)) out.push({ ...c, rule: 4 });
    return out.sort((a, b) => b.conf - a.conf);
  }

  /* Hybrid decision for one photo (developer "Hybrid" mode): fuse per region, then re-decide with the production
     lens's own thresholds (L = Lens.CFG). Then CLIP's best whole-photo object (score >= SECOND_P) is offered as a
     "second opinion" choice when:
       5.  production would identify the photo automatically but CLIP names a different object (not a near-synonym);
       5b. production is unsure (one object, low confidence) and CLIP's object is not among its ideas;
       6.  production found nothing (not a person) but CLIP has an object.
     Evidence from three phone field tests is in docs/RECOGNITION.md. The choices still come only from the two lenses:
     no typed input, and "none of these" leads to a retake. */
  const SECOND_P = 0.08;
  function hybridDecision(rec, clip, L) {
    const fused = fuse(rec, clip).filter(c => c.conf >= L.MIN_CONF).slice(0, L.MAX_CHOICES);
    let decision, reason;
    if (!fused.length) { decision = 'unknown'; reason = rec.reason === 'person' ? 'person' : 'low'; }
    else if (fused.filter(c => c.box).length >= 2) { decision = 'choose'; reason = 'multiple'; }
    else if (fused[0].conf >= L.AUTO_CONF && (!fused[1] || fused[1].conf < fused[0].conf * L.CLEAR_MARGIN)) { decision = 'auto'; reason = 'confident'; }
    else { decision = 'choose'; reason = 'unsure'; }
    const whole = clip.regions.find(r => !r.box), alt = whole && whole.best;
    if (!alt || !alt.obj || !OBJECTS[alt.obj] || alt.p < SECOND_P || fused.some(c => c.obj === alt.obj)) return { candidates: fused, decision, reason };
    // near-synonyms are not a disagreement: same category and CLIP rates production's object at least half as high
    // (wall clock 0.075 vs clock 0.118 = agree; coffeepot 0.104 vs electric kettle 0.267 = disagree; second field test)
    const backed = fused[0] && OBJECTS[fused[0].obj] && OBJECTS[alt.obj].cat === OBJECTS[fused[0].obj].cat &&
      (whole.ranked || []).some(x => x.obj === fused[0].obj && x.p >= alt.p * 0.5);
    const offer = (decision === 'auto' && !backed) || (decision === 'choose' && reason === 'unsure') || (decision === 'unknown' && reason !== 'person');
    if (!offer) return { candidates: fused, decision, reason };
    if (fused.length >= L.MAX_CHOICES) fused.pop(); // keep the list short: the weakest production idea makes room
    fused.push({ label: alt.label, obj: alt.obj, cat: OBJECTS[alt.obj].cat, conf: alt.p, box: null, src: 'clip', rule: decision === 'auto' ? 5 : decision === 'unknown' ? 6 : '5b' });
    return { candidates: fused, decision: 'choose', reason: decision === 'auto' ? 'disagree' : decision === 'unknown' ? 'second-opinion' : 'unsure' };
  }

  // is the worker still alive and holding a session? (it can be frozen or killed while the app is in the background)
  async function ping(ms = 4000) {
    if (st.state !== 'ready' || !st.worker) return false;
    if (st.busy) return true;
    try { const r = await call('ping' + (++st.seq), { type: 'ping', id: 'ping' + st.seq }, ms); return !!r.ok; } catch (e) { return false; }
  }
  function reset() { if (st.worker) st.worker.terminate(); Object.assign(st, { state: 'off', error: '', info: null, worker: null, meta: null, busy: false, loading: null }); st.pending.clear(); }
  return { load, recognize, fuse, judge, hybridDecision, reset, ping, status: st, CFG };
})();
