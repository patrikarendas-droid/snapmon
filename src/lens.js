/* SNAPMON — Spirit Lens: on-device object recognition.
   Two open-source TensorFlow.js models share one runtime (WebGL on Android Chrome):
     • MobileNet v2 (ImageNet, 1000 classes) — what is this object, fine-grained ("coffee mug", "strawberry", "golden retriever").
     • COCO-SSD lite (80 classes, bounding boxes) — where are the objects, so a photo with several things offers a choice.
   Each detected box is cropped and re-classified with MobileNet for a more specific label.
   Weights are downloaded once (~30 MB) and cached in IndexedDB. Photos never leave the device. */
'use strict';

const Lens = (() => {
  const CFG = {
    tfjs: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
    mobilenetLib: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js',
    cocoLib: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js',
    cacheKeys: { classifier: 'indexeddb://snapmon-lens-mobilenet-v2-100', detector: 'indexeddb://snapmon-lens-cocossd-lite' },
    localUrls: { classifier: 'models/mobilenet_v2_100/model.json', detector: 'models/ssdlite_mobilenet_v2/model.json' },
    MIN_CONF: 0.25,      // below this nothing counts as recognised
    AUTO_CONF: 0.55,     // at or above this (with a clear winner) the object is identified automatically
    CLEAR_MARGIN: 0.7,   // runner-up must be below top × this for an automatic pick
    DET_MIN: 0.45,       // detector boxes below this score are ignored
    MAX_DET_CROPS: 3,
    MAX_CHOICES: 4,
    INPUT_MAX: 640,      // photos are downscaled to this before inference (memory + speed on phones)
  };
  const SURFACES = new Set(['dining table', 'bed', 'couch', 'bench']);
  const st = { state: 'idle', error: '', classifier: null, detector: null, backend: '', loadMs: 0, sources: {}, progress: '' };
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(st); } catch (e) {} });
  let loading = null;

  function addScript(src) {
    return new Promise((res, rej) => {
      if ([...document.scripts].some(s => s.src === src && s.dataset.loaded)) return res();
      const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => { s.dataset.loaded = '1'; res(); }; s.onerror = () => rej(new Error('could not download ' + src.split('/npm/')[1]));
      document.head.appendChild(s);
    });
  }
  const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' timed out')), ms))]);

  // Try IndexedDB cache → same-origin copy (GitHub Pages build) → public model host. Cache on first network success.
  async function loadModel(kind, loaders) {
    const errs = [];
    for (const [source, fn] of loaders) {
      try {
        const m = await fn();
        st.sources[kind] = source;
        if (source !== 'cache') { try { await m.model.save(CFG.cacheKeys[kind]); } catch (e) { /* storage full or blocked: fine, HTTP cache still helps */ } }
        return m;
      } catch (e) { errs.push(source + ': ' + (e.message || e)); }
    }
    throw new Error(kind + ' unavailable (' + errs.join('; ') + ')');
  }

  async function load() {
    if (st.state === 'ready') return true;
    if (loading) return loading;
    loading = (async () => {
      const t0 = performance.now();
      st.state = 'loading'; st.error = ''; st.progress = 'Downloading the AI runtime…'; emit();
      try {
        await withTimeout(addScript(CFG.tfjs), 60000, 'AI runtime');
        await Promise.all([addScript(CFG.mobilenetLib), addScript(CFG.cocoLib)].map(p => withTimeout(p, 60000, 'model library')));
        try { await tf.setBackend('webgl'); } catch (e) { /* falls back to whatever is available */ }
        await tf.ready();
        st.backend = tf.getBackend();
        try { tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0); } catch (e) {} // free GPU textures eagerly on low-memory phones
        st.progress = 'Loading recognition models…'; emit();
        const mnLocal = new URL(CFG.localUrls.classifier, location.href).href, coLocal = new URL(CFG.localUrls.detector, location.href).href;
        const [cls, det] = await Promise.allSettled([
          withTimeout(loadModel('classifier', [
            ['cache', () => mobilenet.load({ version: 2, alpha: 1.0, modelUrl: CFG.cacheKeys.classifier, inputRange: [0, 1] })],
            ['site', () => mobilenet.load({ version: 2, alpha: 1.0, modelUrl: mnLocal, inputRange: [0, 1] })],
            ['tfhub', () => mobilenet.load({ version: 2, alpha: 1.0 })],
            ['tfhub-lite', () => mobilenet.load({ version: 2, alpha: 0.5 })],
          ]), 120000, 'classifier'),
          withTimeout(loadModel('detector', [
            ['cache', () => cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: CFG.cacheKeys.detector })],
            ['site', () => cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: coLocal })],
            ['google', () => cocoSsd.load({ base: 'lite_mobilenet_v2' })],
          ]), 120000, 'detector'),
        ]);
        st.classifier = cls.status === 'fulfilled' ? cls.value : null;
        st.detector = det.status === 'fulfilled' ? det.value : null;
        if (!st.classifier && !st.detector) throw new Error((cls.reason && cls.reason.message) || 'models unavailable');
        st.state = 'ready';
        st.error = !st.detector ? 'multi-object detector unavailable: ' + det.reason.message : !st.classifier ? 'fine classifier unavailable: ' + cls.reason.message : '';
        st.loadMs = Math.round(performance.now() - t0);
        st.progress = '';
      } catch (e) {
        st.state = 'failed'; st.error = String(e.message || e); st.progress = '';
      }
      loading = null; emit();
      return st.state === 'ready';
    })();
    return loading;
  }

  /* ---------- helpers ---------- */
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  function toCanvas(src, maxSide) {
    const w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
    const s = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function crop(src, x, y, w, h, size = 224) {
    // square crop around the box with 12% padding, clamped to the image
    const W = src.width, H = src.height, side = Math.min(Math.max(w, h) * 1.12, Math.max(W, H));
    let cx = x + w / 2 - side / 2, cy = y + h / 2 - side / 2;
    cx = Math.max(0, Math.min(W - side, cx)); cy = Math.max(0, Math.min(H - side, cy));
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(src, cx, cy, Math.min(side, W), Math.min(side, H), 0, 0, size * Math.min(side, W) / side, size * Math.min(side, H) / side);
    return c;
  }
  function parse(code) { if (!code) return null; const [cat, sub] = code.split(':'); return CATEGORY[cat] ? { cat, sub: sub || null } : null; }
  function mapImagenet(className) {
    const code = LABEL_MAP.imagenet[className];
    if (code === 0) return 'excluded';
    if (code) return parse(code);
    const cat = matchCategory(className.replace(/,/g, ' ')); // safety net if a model ships different label text
    return cat ? { cat, sub: null } : { cat: 'other', sub: null };
  }
  function mapCoco(name) { const code = LABEL_MAP.coco[name]; return code === 0 ? 'excluded' : code ? parse(code) : null; }
  const pretty = s => s.split(',')[0].trim().replace(/^./, c => c.toLowerCase());

  /* ---------- recognition ---------- */
  async function recognize(src) {
    if (st.state !== 'ready') throw new Error('Spirit Lens is not ready');
    const T = { start: performance.now() }, dbg = { backend: st.backend, sources: { ...st.sources }, detections: [], full: [], crops: [] };
    const img = toCanvas(src, CFG.INPUT_MAX);
    await nextFrame();
    let dets = [];
    if (st.detector) {
      const t = performance.now();
      dets = (await st.detector.detect(img, 8, 0.3)).map(d => ({ ...d, map: mapCoco(d.class) }));
      T.detect = Math.round(performance.now() - t);
      // a table/bed/sofa under another object is usually just the background: let the object on top win
      for (const d of dets) {
        if (!SURFACES.has(d.class)) continue;
        const [x, y, w, h] = d.bbox;
        if (dets.some(o => o !== d && !SURFACES.has(o.class) && o.class !== 'person' && o.score >= CFG.DET_MIN && (() => { const cx = o.bbox[0] + o.bbox[2] / 2, cy = o.bbox[1] + o.bbox[3] / 2; return cx > x && cx < x + w && cy > y && cy < y + h; })())) { d.score *= 0.55; d.surface = true; }
      }
      dbg.detections = dets.map(d => ({ label: d.class, score: d.score, map: (d.map === 'excluded' ? 'excluded' : d.map ? d.map.cat + (d.map.sub ? ':' + d.map.sub : '') : '?') + (d.surface ? ' (background surface)' : '') }));
      await nextFrame();
    }
    const cands = [];
    if (st.classifier) {
      // whole photo (centre 90% square)
      const t = performance.now();
      const W = img.width, H = img.height, side = Math.min(W, H) * 0.9;
      const preds = await st.classifier.classify(crop(img, (W - side) / 2, (H - side) / 2, side, side), 5);
      T.classify = Math.round(performance.now() - t);
      dbg.full = preds.map(p => ({ label: pretty(p.className), prob: p.probability, map: fmtMap(mapImagenet(p.className)) }));
      for (const p of preds) {
        const m = mapImagenet(p.className);
        if (m === 'excluded' || p.probability < 0.08) continue;
        cands.push({ label: pretty(p.className), cat: m.cat, sub: m.sub, conf: p.probability, box: null, src: 'photo' });
      }
      await nextFrame();
    }
    // detected objects, most prominent first, refined by classifying each crop
    const objects = dets.filter(d => d.map && d.map !== 'excluded' && d.score >= CFG.DET_MIN)
      .sort((a, b) => b.score * Math.sqrt(b.bbox[2] * b.bbox[3]) - a.score * Math.sqrt(a.bbox[2] * a.bbox[3]));
    const tc = performance.now();
    for (const [i, d] of objects.entries()) {
      const [x, y, w, h] = d.bbox;
      let label = d.class, cat = d.map.cat, sub = d.map.sub, conf = d.score;
      if (st.classifier && i < CFG.MAX_DET_CROPS) {
        const p = (await st.classifier.classify(crop(img, x, y, w, h), 3))[0];
        const m = p && mapImagenet(p.className);
        dbg.crops.push({ box: d.class, label: p ? pretty(p.className) : '-', prob: p ? p.probability : 0, map: fmtMap(m) });
        if (m && m !== 'excluded' && m.cat === cat && p.probability >= 0.2) { label = pretty(p.className); sub = m.sub || sub; conf = Math.min(0.99, Math.max(conf, p.probability) + 0.08); }
        await nextFrame();
      }
      cands.push({ label, cat, sub, conf, box: [x / img.width, y / img.height, w / img.width, h / img.height], aspect: h / w, src: 'detector' });
    }
    T.crops = Math.round(performance.now() - tc);
    // merge: one entry per category, keep the strongest; agreement between whole-photo and detector raises confidence
    const byCat = new Map();
    for (const c of cands) {
      const prev = byCat.get(c.cat);
      if (!prev) { byCat.set(c.cat, { ...c }); continue; }
      const best = (c.box && !prev.box) || c.conf > prev.conf ? { ...c } : { ...prev };
      if (c.src !== prev.src) best.conf = Math.min(0.99, Math.max(c.conf, prev.conf) + 0.1);
      if (!best.box) { best.box = prev.box || c.box; best.aspect = prev.aspect || c.aspect; }
      best.src = c.src !== prev.src ? 'both' : best.src;
      byCat.set(c.cat, best);
    }
    const ranked = [...byCat.values()].sort((a, b) => b.conf - a.conf);
    const valid = ranked.filter(c => c.conf >= CFG.MIN_CONF).slice(0, CFG.MAX_CHOICES);
    const people = dets.filter(d => d.class === 'person' && d.score > 0.6).length;
    const fullTop = dbg.full[0];
    let decision, reason;
    if (!valid.length) {
      decision = 'unknown';
      reason = people && !objects.length ? 'person' : fullTop && fullTop.map === 'excluded' && fullTop.prob > 0.3 ? 'scene' : 'low';
    } else if (valid.filter(c => c.box && c.src !== 'photo').length >= 2) { decision = 'choose'; reason = 'multiple'; }
    else if (valid[0].conf >= CFG.AUTO_CONF && (!valid[1] || valid[1].conf < valid[0].conf * CFG.CLEAR_MARGIN)) { decision = 'auto'; reason = 'confident'; }
    else { decision = 'choose'; reason = 'unsure'; }
    T.total = Math.round(performance.now() - T.start);
    T.lensLoad = st.loadMs; dbg.times = T; dbg.decision = decision; dbg.reason = reason; dbg.candidates = ranked.map(c => ({ label: c.label, cat: c.cat, sub: c.sub, conf: c.conf, src: c.src }));
    dbg.thresholds = { min: CFG.MIN_CONF, auto: CFG.AUTO_CONF, detMin: CFG.DET_MIN };
    return { decision, reason, candidates: valid, image: img, debug: dbg };
  }
  function fmtMap(m) { return m === 'excluded' ? 'excluded' : m ? m.cat + (m.sub ? ':' + m.sub : '') : '?'; }

  async function clearCache() {
    for (const k of Object.values(CFG.cacheKeys)) { try { await tf.io.removeModel(k); } catch (e) {} }
  }

  return { load, recognize, clearCache, status: st, onChange: f => { listeners.add(f); return () => listeners.delete(f); }, CFG };
})();
