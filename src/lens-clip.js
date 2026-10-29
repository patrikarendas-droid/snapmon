/* SNAPMON — EXPERIMENTAL Spirit Lens: CLIP-style zero-shot recognition over a large everyday-object vocabulary.
   Developer-only (Settings → Developer). Never downloaded for normal players.
   Pipeline: production COCO-SSD boxes (if any) + the whole photo → 224 px crops → image encoder in a worker →
   cosine similarity against precomputed text embeddings → per-object probabilities → rejection rules.
   CLIP similarities are NOT probabilities: the shown "calibrated confidence" comes from a reliability table measured
   on a labelled benchmark (lab/), and is absent when no calibration is available. */
'use strict';

const ClipLens = (() => {
  const CFG = {
    variant: 'tinyclip-39m16',
    base: 'models/clip/',
    ortBase: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/',
    localOrt: 'vendor/ort/',
    workerPath: 'src/workers/clip-worker.js',
    // fallback thresholds; replaced by the benchmark's calibration in vocab.json when present
    accept: { p: 0.35, margin: 0.12 },
    MAX_CROPS: 4,
    TIMEOUT_MS: 30000,
  };
  const st = { state: 'off', error: '', info: null, worker: null, seq: 0, pending: new Map(), meta: null, busy: false };

  function workerURL() {
    if (window.__SNAPMON_CLIP_WORKER) return URL.createObjectURL(new Blob([window.__SNAPMON_CLIP_WORKER], { type: 'text/javascript' }));
    return new URL(CFG.workerPath, location.href).href;
  }
  async function exists(url) { try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch (e) { return false; } }

  async function load() {
    if (st.state === 'ready') return true;
    if (st.loading) return st.loading;
    st.loading = (async () => {
      st.state = 'loading'; st.error = '';
      try {
        const base = new URL(CFG.base + CFG.variant + '/', location.href).href;
        if (!(await exists(base + 'vocab.json'))) throw Object.assign(new Error('experimental model files are not deployed on this site'), { code: 'model-missing' });
        st.meta = await (await fetch(base + 'vocab.json')).json();
        const ortBase = (await exists(new URL(CFG.localOrt + 'ort.min.js', location.href).href)) ? new URL(CFG.localOrt, location.href).href : CFG.ortBase;
        st.worker = new Worker(workerURL());
        st.worker.onmessage = ev => {
          const m = ev.data, pend = st.pending.get(m.id != null ? m.id : 'init');
          if (!pend) return;
          st.pending.delete(m.id != null ? m.id : 'init'); clearTimeout(pend.timer);
          m.type === 'error' ? pend.reject(new Error(m.error)) : pend.resolve(m);
        };
        st.worker.onerror = e => { for (const p of st.pending.values()) p.reject(new Error('worker crashed: ' + (e.message || 'unknown'))); st.pending.clear(); };
        const ready = await call('init', { type: 'init', base, ortBase, preferGPU: true }, 180000);
        st.info = ready.info; st.state = 'ready';
      } catch (e) { st.state = 'failed'; st.error = String(e.message || e); if (st.worker) st.worker.terminate(); st.worker = null; }
      st.loading = null;
      return st.state === 'ready';
    })();
    return st.loading;
  }
  function call(id, msg, timeout = CFG.TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { st.pending.delete(id); reject(Object.assign(new Error('recognition timed out'), { code: 'timeout' })); }, timeout);
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
  function judge(top) {
    const labels = st.meta.labels, per = new Map();
    for (const t of top) { const L = labels[t.i]; const key = L.o || '__none'; const e = per.get(key) || { obj: L.o || null, label: L.l, p: 0, cos: t.cos }; e.p += t.p; if (t.cos > e.cos) { e.cos = t.cos; } per.set(key, e); }
    const ranked = [...per.values()].sort((a, b) => b.p - a.p);
    const best = ranked[0], second = ranked[1] || { p: 0 };
    const th = (st.meta.calib && st.meta.calib.accept) || CFG.accept;
    const margin = best.p - second.p;
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
    const out = [];
    const prodFor = r => r.box ? (prodRec.candidates || []).find(c => c.box && Math.abs(c.box[0] - r.box[0]) < 0.02 && Math.abs(c.box[1] - r.box[1]) < 0.02) : (prodRec.candidates || []).find(c => !c.box) || (prodRec.candidates || [])[0];
    for (const r of clipRes.regions) {
      const prod = prodFor(r), c = r.best;
      let pick = null, rule = 4;
      if (r.accepted && prod && prod.obj === c.obj) { pick = { ...prod, label: c.label, obj: c.obj, conf: Math.max(prod.conf, r.calibrated || c.p) }; rule = 1; }
      else if (r.accepted && prod && OBJECTS[c.obj] && OBJECTS[c.obj].cat === prod.cat) { pick = { ...prod, label: c.label, obj: c.obj, conf: Math.max(prod.conf, r.calibrated || c.p) }; rule = 2; }
      else if (r.accepted && trust(r) >= 0.7) { pick = { label: c.label, obj: c.obj, cat: OBJECTS[c.obj].cat, conf: trust(r), box: r.box, src: 'clip' }; rule = 3; }
      else if (prod) pick = prod;
      if (pick && !out.some(o => o.obj === pick.obj)) out.push({ ...pick, rule });
    }
    // production's other ideas stay available as choices (rule 4), so fusing never removes a right answer
    const replaced = new Set(clipRes.regions.map(prodFor).filter(Boolean));
    for (const c of prodRec.candidates || []) if (!replaced.has(c) && !out.some(o => o.obj === c.obj)) out.push({ ...c, rule: 4 });
    return out.sort((a, b) => b.conf - a.conf);
  }

  /* Hybrid decision for one photo (developer "Hybrid" mode): fuse per region, then re-decide with the production
     lens's own thresholds (L = Lens.CFG). Rule 5, from the first phone field test: when production would identify the
     photo automatically but CLIP's best object for the whole photo is a different object with some support
     (score >= DISAGREE_P), the player chooses between them instead. Production was confidently wrong on 7 of 30 phone
     photos, and in each of those CLIP's best guess differed. Choices still come only from the lenses, never typed input. */
  const DISAGREE_P = 0.08;
  function hybridDecision(rec, clip, L) {
    const fused = fuse(rec, clip).filter(c => c.conf >= L.MIN_CONF).slice(0, L.MAX_CHOICES);
    let decision, reason;
    if (!fused.length) { decision = 'unknown'; reason = rec.reason === 'person' ? 'person' : 'low'; }
    else if (fused.filter(c => c.box).length >= 2) { decision = 'choose'; reason = 'multiple'; }
    else if (fused[0].conf >= L.AUTO_CONF && (!fused[1] || fused[1].conf < fused[0].conf * L.CLEAR_MARGIN)) { decision = 'auto'; reason = 'confident'; }
    else { decision = 'choose'; reason = 'unsure'; }
    const whole = clip.regions.find(r => !r.box), alt = whole && whole.best;
    if (decision === 'auto' && alt && alt.obj && OBJECTS[alt.obj] && alt.obj !== fused[0].obj && alt.p >= DISAGREE_P) {
      if (!fused.some(c => c.obj === alt.obj)) {
        if (fused.length >= L.MAX_CHOICES) fused.pop(); // keep the list short: the weakest production idea makes room
        fused.push({ label: alt.label, obj: alt.obj, cat: OBJECTS[alt.obj].cat, conf: alt.p, box: null, src: 'clip', rule: 5 });
      }
      decision = 'choose'; reason = 'disagree';
    }
    return { candidates: fused, decision, reason };
  }

  function reset() { if (st.worker) st.worker.terminate(); Object.assign(st, { state: 'off', error: '', info: null, worker: null, meta: null, busy: false, loading: null }); st.pending.clear(); }
  return { load, recognize, fuse, judge, hybridDecision, reset, status: st, CFG };
})();
