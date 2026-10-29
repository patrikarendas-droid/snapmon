/* SNAPMON — photo-derived monster colours (pure functions, no DOM: unit-tested in Node and reusable in a native build).

   extractPalette(rgba, w, h, box) reads a small RGBA image (the photo downscaled to ~128 px) and returns the colours of
   the photographed OBJECT, trying hard not to pick up the table, wall or floor behind it:

   1. Regions. The object region is the detected box (shrunk 6%) or, without a box, a central ellipse. The background
      model comes from pixels outside the box (a ring around it) plus the photo's border strip.
   2. Background model. k-means (k = 3) in CIELAB on the background pixels; clusters with ≥ 12% of them count.
   3. Foreground. Object-region pixels within ΔE 14 of a background cluster are dropped (unless that would drop
      almost everything: then the object probably matches its surroundings, and the result is marked as a fallback).
      Pixels are weighted towards the region's centre, where the object almost certainly is.
   4. Surfaces. k-means (k = 5) on the foreground, then clusters that differ mainly in lightness (the same surface in
      light and shadow) are merged into "surfaces". Specular glints (very light, colourless) and deep shadows only
      count as a surface when they dominate (white or black objects).
   5. Roles. primary = largest surface (its mid-tone), secondary = next clearly different surface (≥ 12%),
      highlight = lightest tone of the primary surface, shadow = darkest tone of the primary surface.
   6. Confidence. 'confident' when a box was used, enough foreground survived and one surface clearly leads;
      otherwise 'fallback' (the sprite then only leans towards the photo instead of copying it).

   Colours are returned as [h, s, l] (HSL in degrees / percent) for the sprite engine, plus hex for swatches. */
'use strict';

const ColorX = (() => {
  /* ---------- colour spaces ---------- */
  const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const f3 = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  function rgb2lab(r, g, b) {
    const R = lin(r), G = lin(g), B = lin(b);
    const x = f3((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f3(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f3((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [Math.round(h), Math.round(Math.min(1, s) * 100), Math.round(l * 100)];
  }
  const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const chroma = lab => Math.hypot(lab[1], lab[2]);
  const hueAngle = lab => (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
  const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  /* ---------- weighted k-means (deterministic seeding: farthest-point from the heaviest pixel) ---------- */
  function kmeans(pts, wts, k, iters = 8) {
    const n = pts.length; if (!n) return [];
    k = Math.min(k, n);
    let first = 0; for (let i = 1; i < n; i++) if (wts[i] > wts[first]) first = i;
    const C = [pts[first].slice()];
    const dmin = pts.map(p => dE(p, C[0]));
    while (C.length < k) {
      let bi = 0, bd = -1; for (let i = 0; i < n; i++) { const d = dmin[i] * wts[i]; if (d > bd) { bd = d; bi = i; } }
      if (bd <= 0) break;
      C.push(pts[bi].slice());
      for (let i = 0; i < n; i++) dmin[i] = Math.min(dmin[i], dE(pts[i], C[C.length - 1]));
    }
    const asg = new Int32Array(n);
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) { let bj = 0, bd = Infinity; for (let j = 0; j < C.length; j++) { const d = dE(pts[i], C[j]); if (d < bd) { bd = d; bj = j; } } asg[i] = bj; }
      const S = C.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < n; i++) { const s = S[asg[i]], w = wts[i]; s[0] += pts[i][0] * w; s[1] += pts[i][1] * w; s[2] += pts[i][2] * w; s[3] += w; }
      for (let j = 0; j < C.length; j++) if (S[j][3] > 0) C[j] = [S[j][0] / S[j][3], S[j][1] / S[j][3], S[j][2] / S[j][3]];
    }
    const out = C.map(c => ({ lab: c, w: 0, rgb: [0, 0, 0], n: 0 }));
    for (let i = 0; i < n; i++) { const o = out[asg[i]]; o.w += wts[i]; o.n++; }
    return { clusters: out, asg };
  }

  /* ---------- main ---------- */
  // rgba: Uint8ClampedArray (w*h*4). box: [x, y, w, h] fractions or null. Returns the palette (see header).
  function extractPalette(rgba, w, h, box, opts = {}) {
    const t0 = Date.now();
    const useBox = box && box[2] > 0.04 && box[3] > 0.04 && box[2] * box[3] < 0.92 ? box : null;
    const bx0 = useBox ? useBox[0] : 0.2, by0 = useBox ? useBox[1] : 0.2, bw = useBox ? useBox[2] : 0.6, bh = useBox ? useBox[3] : 0.6;
    const cx = bx0 + bw / 2, cy = by0 + bh / 2, shrink = useBox ? 0.06 : 0;
    const inObj = (fx, fy) => {
      if (useBox) return fx >= bx0 + bw * shrink && fx <= bx0 + bw * (1 - shrink) && fy >= by0 + bh * shrink && fy <= by0 + bh * (1 - shrink);
      const ex = (fx - 0.5) / 0.3, ey = (fy - 0.5) / 0.32; return ex * ex + ey * ey <= 1; // central ellipse
    };
    const border = 0.07, ring = useBox ? 0.12 : 0;
    const inBg = (fx, fy) => {
      if (fx < border || fx > 1 - border || fy < border || fy > 1 - border) return !(useBox && inObj(fx, fy));
      if (!useBox) return false;
      const inBox = fx >= bx0 && fx <= bx0 + bw && fy >= by0 && fy <= by0 + bh;
      const nearBox = fx >= bx0 - bw * ring && fx <= bx0 + bw * (1 + ring) && fy >= by0 - bh * ring && fy <= by0 + bh * (1 + ring);
      return nearBox && !inBox;
    };
    const step = Math.max(1, Math.round(Math.sqrt((w * h) / 4000))); // ~4k samples whatever the input size
    const objPts = [], objW = [], objRGB = [], objXY = [], bgPts = [];
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4; if (rgba[i + 3] < 128) continue;
      const fx = (x + 0.5) / w, fy = (y + 0.5) / h, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      if (inObj(fx, fy)) {
        const lab = rgb2lab(r, g, b);
        const dx = (fx - cx) / (bw / 2), dy = (fy - cy) / (bh / 2), rr = Math.min(1, Math.hypot(dx, dy));
        objPts.push(lab); objW.push(1 - 0.65 * rr * rr); objRGB.push([r, g, b]); objXY.push([x, y]);
      } else if (inBg(fx, fy)) bgPts.push(rgb2lab(r, g, b));
    }
    if (!objPts.length) return null;

    // background model
    let bgCenters = [];
    if (bgPts.length >= 12) {
      const km = kmeans(bgPts, bgPts.map(() => 1), 3, 6);
      const tot = bgPts.length;
      bgCenters = km.clusters.filter(c => c.w / tot >= 0.12).map(c => c.lab);
    }
    const BG_DE = opts.bgDE || 14;
    const isBg = lab => bgCenters.some(c => dE(lab, c) < BG_DE);
    let keep = objPts.map((p, i) => !isBg(p));
    let kept = keep.filter(Boolean).length;
    const fgShare = kept / objPts.length;
    let bgSuppressed = true;
    if (kept < Math.max(8, objPts.length * 0.12)) { keep = objPts.map(() => true); kept = objPts.length; bgSuppressed = false; } // object looks like its surroundings

    const pts = [], wts = [], rgbs = [];
    for (let i = 0; i < objPts.length; i++) if (keep[i]) { pts.push(objPts[i]); wts.push(objW[i]); rgbs.push(objRGB[i]); }
    const km = kmeans(pts, wts, 5, 8);
    const cl = km.clusters;
    for (let i = 0; i < pts.length; i++) { const c = cl[km.asg[i]]; c.rgb[0] += rgbs[i][0] * wts[i]; c.rgb[1] += rgbs[i][1] * wts[i]; c.rgb[2] += rgbs[i][2] * wts[i]; }
    const totW = cl.reduce((a, c) => a + c.w, 0) || 1;
    for (const c of cl) { if (c.w) c.rgb = c.rgb.map(v => v / c.w); c.share = c.w / totW; c.C = chroma(c.lab); c.H = hueAngle(c.lab); c.L = c.lab[0]; }
    const live = cl.filter(c => c.share > 0.02);

    // merge clusters into surfaces: same hue family (or both colourless) differing mainly in lightness
    const sameSurface = (a, b) => {
      const ach = c => c.C < 10;
      if (ach(a) && ach(b)) return Math.abs(a.L - b.L) < 32;
      if (ach(a) !== ach(b)) return false;
      return hueDiff(a.H, b.H) < 22 && Math.abs(a.C - b.C) < 30;
    };
    const surfaces = [];
    for (const c of live.sort((a, b) => b.share - a.share)) {
      const s = surfaces.find(s => s.members.some(m => sameSurface(m, c)));
      if (s) { s.members.push(c); s.share += c.share; } else surfaces.push({ members: [c], share: c.share });
    }
    // glints and deep shadows are lighting, not paint: they only lead when they really dominate (white/black objects)
    const lighting = s => s.members.every(m => (m.L > 92 && m.C < 8) || m.L < 9);
    surfaces.sort((a, b) => (b.share * (lighting(b) && b.share < 0.5 ? 0.35 : 1)) - (a.share * (lighting(a) && a.share < 0.5 ? 0.35 : 1)));
    const prim = surfaces[0];
    const midTone = s => s.members.slice().sort((a, b) => b.share - a.share)[0];
    const P = midTone(prim);
    const byL = prim.members.slice().sort((a, b) => a.L - b.L);
    const sec = surfaces.slice(1).find(s => s.share >= 0.12 && dE(midTone(s).lab, P.lab) > 20 && !lighting(s));
    const toHSL = c => rgb2hsl(...c.rgb);
    const primary = toHSL(P), shadow = toHSL(byL[0]), highlight = toHSL(byL[byL.length - 1]);
    const secondary = sec ? toHSL(midTone(sec)) : null;
    // confident only if the object's main colour is clearly unlike its surroundings (a red mug on a red cloth is not)
    const bgGap = bgCenters.length ? Math.min(...bgCenters.map(c => dE(c, P.lab))) : 100;
    const confident = !!useBox && bgSuppressed && prim.share >= 0.35 && fgShare >= 0.15 && bgGap >= 16;
    const res = {
      v: 1, primary, secondary, highlight, shadow,
      swatches: { primary: hex(P.rgb), secondary: sec ? hex(midTone(sec).rgb) : null, highlight: hex(byL[byL.length - 1].rgb), shadow: hex(byL[0].rgb) },
      conf: confident ? 'confident' : 'fallback',
      method: (useBox ? 'box' : 'centre') + (bgSuppressed ? '+bg' : ''),
      fgShare: +fgShare.toFixed(2), primaryShare: +prim.share.toFixed(2), bgGap: Math.round(bgGap),
      ms: Date.now() - t0,
    };
    if (opts.mask) { // which sampled pixels counted as the object (for the field-test preview)
      res.mask = { step, w, h, obj: objXY.filter((_, i) => keep[i]), bg: objXY.filter((_, i) => !keep[i]) };
    }
    return res;
  }

  return { extractPalette, rgb2lab, rgb2hsl, dE };
})();
if (typeof module !== 'undefined') module.exports = ColorX;
