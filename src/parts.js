/* SNAPMON — v3 object sprite components, parametric templates and dedicated designs.
   Builders draw onto the 40×40 palette grid from sprites.js and return face/limb anchors:
     { eyes:{x,y,span}, mouth:{x,y,w}, arms:[{x,y,d}], legs:{y,xs}|null, noLegs, float, top:{x,y}, rigid }
   `rigid` objects (machines, furniture…) keep their silhouette: rarity adds no wings or spikes to them.
   Three tiers (see objects.js): dedicated builder (PARTS.D), composed template (PARTS.T + params), family fallback. */
'use strict';

const PARTS = (() => {
  const B = P.BODY, BD = P.BODY_D, BL = P.BODY_L, A = P.ACC, AD = P.ACC_D, AL = P.ACC_L, M = P.METAL, MD = P.METAL_D,
    S = P.SEC, SL = P.SEC_L, G = P.GLOW, W = P.WHITE, K = P.PUPIL, PA = P.PAPER, GO = P.GOLD, ST = P.STEAM, E = P.EMPTY, TO = P.TONGUE;
  const clampi = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));

  /* ---------- reusable components ---------- */
  const C = {
    wheel(g, cx, cy, r) { ell(g, cx, cy, r, r, MD); ell(g, cx, cy, r * 0.45, r * 0.45, M); gset(g, cx, cy, MD); },
    track(g, x, y, w, h) { rrect(g, x, y, w, h, Math.floor(h / 2), MD); for (let i = x + 2; i < x + w - 1; i += 3) gset(g, i, y, M); for (let i = 0; i < 4; i++) ell(g, x + h / 2 + i * (w - h) / 3, y + h / 2, h * 0.3, h * 0.3, M); },
    window(g, x, y, w, h, c = S) { rect(g, x, y, w, h, c); if (w > 2 && h > 2) line(g, x + 1, y + h - 2, x + Math.min(w - 2, 2), y + 1, SL); },
    screen(g, x, y, w, h, bezel = 1) { rect(g, x - bezel, y - bezel, w + bezel * 2, h + bezel * 2, MD); rect(g, x, y, w, h, S); },
    door(g, x, y, w, h, side = 'right') { rect(g, x, y, w, h, BD); rect(g, x + 1, y + 1, w - 2, h - 2, B); rect(g, side === 'right' ? x + w - 3 : x + 1, y + Math.floor(h / 2) - 1, 2, 3, M); },
    handleRing(g, cx, cy, rx, ry, c = B) { ell(g, cx, cy, rx, ry, c); ell(g, cx, cy, Math.max(1, rx - 2.5), Math.max(1, ry - 2.5), E); },
    knob(g, x, y, r = 1.5, c = M) { ell(g, x, y, r, r, c); },
    buttons(g, x, y, n, dx = 0, dy = 2, c = A) { for (let i = 0; i < n; i++) rect(g, x + i * dx, y + i * dy, 2, 1, c); },
    dial(g, x, y, r = 2) { ell(g, x, y, r, r, MD); ell(g, x, y, r - 0.8, r - 0.8, M); gset(g, x, y - 1, MD); },
    legs4(g, x0, x1, y0, y1, c = BD) { rect(g, x0, y0, 2, y1 - y0, c); rect(g, x1 - 1, y0, 2, y1 - y0, c); },
    caster(g, cx, y, spread) { line(g, cx, y - 6, cx, y - 2, MD, 2); line(g, cx - spread, y, cx + spread, y, MD, 2); line(g, cx - spread / 2, y - 1, cx, y - 2, MD); line(g, cx + spread / 2, y - 1, cx, y - 2, MD); for (const x of [cx - spread, cx, cx + spread]) ell(g, x, y + 2, 1.5, 1.5, P.OUT); },
    fork(g, x, y, len, dir = -1) { rect(g, dir < 0 ? x - len : x, y, len, 1, M); rect(g, dir < 0 ? x - len : x, y + 2, len, 1, M); rect(g, x - (dir < 0 ? 1 : 0), y - 3, 1, 6, MD); },
    mast(g, x, y0, y1) { rect(g, x, y0, 2, y1 - y0, MD); rect(g, x + 3, y0, 2, y1 - y0, MD); for (let y = y0 + 2; y < y1; y += 4) rect(g, x, y, 5, 1, M); },
    bucket(g, x, y, s = 1) { poly(g, [[x, y], [x + 6 * s, y - 1], [x + 7 * s, y + 4], [x + 2 * s, y + 6]], A); for (let i = 0; i < 3; i++) gset(g, x + (2 + i * 2) * s, y + 6, M); },
    arm(g, pts, t = 3, c = A) { for (let i = 0; i + 1 < pts.length; i++) line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t); for (const [x, y] of pts) ell(g, x, y, 1.5, 1.5, MD); },
    stack(g, x, y, h) { rect(g, x, y - h, 3, h, MD); rect(g, x - 1, y - h, 5, 1, MD); for (let s = 0; s < 4; s++) gset(g, x + 1 + (s % 2), y - h - 2 - s, ST); },
    leaves(g, cx, y, n, h, spread, c = S) { for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) - 0.5; poly(g, [[cx + t * spread - 1.5, y], [cx + t * spread + 1.5, y], [cx + t * spread * 1.8, y - h + Math.abs(t) * h * 0.6]], c); } },
    stem(g, x, y0, y1, c = MD) { line(g, x, y0, x, y1, c, 2); },
    strings(g, x0, y0, x1, y1, n) { for (let i = 0; i < n; i++) line(g, x0 + i, y0, x1 + i, y1, M); },
    keys(g, x, y, w) { rect(g, x, y, w, 4, PA); for (let i = x + 1; i < x + w; i += 2) rect(g, i, y, 1, 2, K); },
    grille(g, x, y, w, h) { rect(g, x, y, w, h, MD); for (let i = x + 1; i < x + w; i += 2) rect(g, i, y + 1, 1, h - 2, M); },
    light(g, x, y, w = 2, h = 2) { rect(g, x, y, w, h, G); },
    antenna(g, x, y, len, dx = 0) { line(g, x, y, x + dx, y - len, MD); ell(g, x + dx, y - len, 1, 1, A); },
    spout(g, x, y, dir, len, c = B) { poly(g, [[x, y], [x + dir * len, y - len * 0.9], [x + dir * (len + 1.5), y - len * 0.9 + 1], [x + dir * 1, y + 4]], c); },
    lid(g, cx, y, w, c = A) { ell(g, cx, y, w / 2, 1.8, c); ell(g, cx, y - 2.5, 1.6, 1.4, c); },
    cushion(g, x, y, w, h, c = B) { rrect(g, x, y, w, h, 2, c); line(g, x + 1, y + h - 1, x + w - 2, y + h - 1, BD); },
    slats(g, x, y, w, h, n, c = BD) { for (let i = 1; i < n; i++) rect(g, x + Math.round(i * w / n), y, 1, h, c); },
    shelfLines(g, x, y, w, h, n, c = BD) { for (let i = 1; i < n; i++) rect(g, x, y + Math.round(i * h / n), w, 1, c); },
    crossBrace(g, x, y, w, h, c = BD) { line(g, x, y, x + w, y + h, c); line(g, x + w, y, x, y + h, c); },
    flames(g, x, y) { ell(g, x, y, 2, 3, G); ell(g, x, y + 1, 1, 1.5, W); },
    redCross(g, x, y) { rect(g, x - 1, y - 3, 3, 7, TO); rect(g, x - 3, y - 1, 7, 3, TO); },
  };

  /* ---------- parametric templates (composed tier) ---------- */
  // p: object params, v: individual variation in [-1,1] (proportions), R: seeded rng
  const T = {
    vehicle(g, p, v) {
      const L = clampi((p.len || 30) + v * 2, 20, 37), x0 = Math.round(20 - L / 2), x1 = x0 + L, yb = p.low ? 29 : 28, wr = (p.wr || 3.5) + (v > 0.5 ? 0.5 : 0);
      const top = p.h ? yb - p.h : 12, cabW = clampi(p.cabW || L * 0.32, 8, 16);
      let eyes, mouth;
      if (p.tracks) C.track(g, x0, yb - 1, L, 6);
      if (p.cargo === 'tank') { rrect(g, x0 + cabW, top + 4, L - cabW, yb - top - 4, 5, M); line(g, x0 + cabW + 2, top + 6, x1 - 3, top + 6, P.WHITE); }
      else if (p.cargo === 'mixer') { ell(g, x0 + cabW + (L - cabW) / 2 + 1, top + 9, (L - cabW) / 2, 7, M); for (let i = 0; i < 4; i++) line(g, x0 + cabW + 3 + i * 4, top + 3, x0 + cabW + 1 + i * 4, top + 15, MD); }
      else if (p.cargo === 'dump') { poly(g, [[x0 + cabW + 1, yb - 7], [x1, yb - 7], [x1 + 1, top + 2], [x0 + cabW + 3, top + 5]], A); C.slats(g, x0 + cabW + 2, top + 5, L - cabW - 2, 6, 4, AD); }
      else if (p.cargo === 'flat') { rect(g, x0 + cabW, yb - 9, L - cabW, 3, BD); if (p.hook) { line(g, x1 - 6, yb - 9, x1 + 1, top + 3, MD, 2); line(g, x1 + 1, top + 3, x1 + 1, top + 8, MD); gset(g, x1, top + 8, MD); } }
      else if (p.cargo === 'hopper') { rrect(g, x0 + cabW, top, L - cabW, yb - top, 2, B); poly(g, [[x1 - 6, top + 2], [x1 + 2, top + 6], [x1 + 2, yb - 4], [x1 - 6, yb - 4]], A); C.slats(g, x0 + cabW + 1, top + 2, L - cabW - 8, 1, 3); }
      else if (p.cargo === 'box' || p.cargo === 'bus') {
        const bx = p.cargo === 'bus' ? x0 : x0 + cabW + 1;
        rrect(g, bx, top, x1 - bx, yb - top, 2, p.cargo === 'bus' ? B : (p.boxAcc ? A : B));
        if (p.cargo === 'bus') for (let x = x0 + 3; x < x1 - 3; x += 6) C.window(g, x, top + 3, 4, 5);
        if (p.cross) C.redCross(g, bx + (x1 - bx) / 2, top + (yb - top) / 2 - 1);
        if (p.stripe) rect(g, bx, yb - 6, x1 - bx, 2, A);
        if (p.ladder) { line(g, bx + 1, top - 2, x1, top - 2, M, 1); line(g, bx + 1, top, x1, top, M); for (let x = bx + 2; x < x1; x += 3) rect(g, x, top - 2, 1, 3, M); }
      }
      // cab (front = left)
      if (p.cargo !== 'bus') {
        if (p.sedan) {
          poly(g, [[x0 + 6, yb - 8], [x0 + 10, top + 1], [x1 - 9, top + 1], [x1 - 4, yb - 8]], B);
          rrect(g, x0, yb - 9, L, 9, 3, B);
          poly(g, [[x0 + 9, yb - 9], [x0 + 12, top + 3], [x1 - 11, top + 3], [x1 - 7, yb - 9]], S);
          line(g, 20, top + 3, 20, yb - 9, B);
          if (p.lightbar) { rect(g, 17, top - 1, 3, 2, TO); rect(g, 20, top - 1, 3, 2, P.SEC); }
          if (p.taxi) { rect(g, 17, top - 1, 6, 2, GO); }
          if (p.spoiler) { rect(g, x1 - 6, yb - 12, 7, 1, BD); rect(g, x1 - 2, yb - 11, 1, 2, BD); }
          eyes = { x: 20, y: top + 6, span: 4 }; mouth = { x: x0 + 7, y: yb - 5, w: 8 };
        } else {
          rrect(g, x0, top + (p.cabLow ? 4 : 0), cabW, yb - top - (p.cabLow ? 4 : 0), 2, B);
          C.window(g, x0 + 2, top + (p.cabLow ? 6 : 2), cabW - 4, 5);
          eyes = { x: x0 + cabW / 2, y: top + (p.cabLow ? 8 : 4), span: Math.max(2, Math.floor(cabW / 4)) };
          mouth = { x: x0 + cabW / 2, y: yb - 6, w: Math.max(4, cabW - 4) };
        }
      } else { eyes = { x: 20, y: top + 5, span: 6 }; mouth = { x: 20, y: yb - 6, w: 12 }; }
      if (!p.cargo || p.cargo === 'none') rect(g, x0 + cabW - 1, yb - 7, L - cabW + 1, 7, B);
      if (p.stack) C.stack(g, x0 + cabW - 2, top + (p.cabLow ? 4 : 0), 4);
      if (p.cone) { poly(g, [[x1 - 8, top], [x1 - 2, top], [x1 - 5, top - 6]], A); ell(g, x1 - 5, top - 7, 2.5, 2, PA); }
      rect(g, x0, yb - 4, 2, 2, G);
      if (!p.tracks) {
        const n = p.wheels || 2, wy = yb + 1;
        const xs = n === 2 ? [x0 + 6, x1 - 6] : n === 3 ? [x0 + 6, x1 - 11, x1 - 5] : [x0 + 5, x0 + 11, x1 - 11, x1 - 5];
        for (const x of xs) C.wheel(g, x, wy, wr);
      }
      return { eyes, mouth, arms: [], legs: null, noLegs: true, top: { x: eyes.x, y: top }, rigid: true };
    },
    seat(g, p, v) {
      const w = clampi((p.w || 16) + v * 2, 10, 30), x0 = Math.round(20 - w / 2), seatY = p.seatY || 21, back = p.back || 'tall';
      const by0 = back === 'tall' ? 4 : back === 'low' ? 11 : back === 'round' ? 7 : seatY;
      if (p.base === 'caster') C.caster(g, 20, 34, 8);
      else if (p.base === 'rocker') { C.legs4(g, x0 + 1, x0 + w - 1, seatY + 3, 31); for (let x = x0 - 3; x <= x0 + w + 3; x++) gset(g, x, 31 + Math.round(((x - 20) / (w / 2 + 3)) ** 2 * 2), BD); }
      else if (p.base === 'pedestal') { rect(g, 19, seatY + 3, 3, 9, MD); ell(g, 20, 34, 6, 1.6, MD); }
      else if (p.base === 'stool') { line(g, x0 + 2, seatY + 3, x0, 35, BD, 2); line(g, x0 + w - 2, seatY + 3, x0 + w, 35, BD, 2); rect(g, x0 + 1, 29, w - 2, 1, BD); }
      else C.legs4(g, x0 + 1, x0 + w - 1, seatY + 3, 35);
      if (back !== 'none') {
        if (back === 'round') ell(g, 20, by0 + 6, w / 2, 7, B); else rrect(g, x0 + 1, by0, w - 2, seatY - by0 + 1, 2, B);
        if (p.slats) C.slats(g, x0 + 2, by0 + 2, w - 4, seatY - by0 - 3, 4);
        if (p.tufts) for (let x = x0 + 4; x < x0 + w - 3; x += 4) gset(g, x, by0 + 4, BD);
      }
      rrect(g, x0, seatY, w, back === 'none' ? 7 : 4, 1, p.cushion ? A : B);
      if (p.arms) { rrect(g, x0 - 2, seatY - 5, 3, 8, 1, BD); rrect(g, x0 + w - 1, seatY - 5, 3, 8, 1, BD); }
      if (p.wheelchair) { C.handleRing(g, 20, 28, 8, 8, MD); ell(g, x0 + 2, 33, 1.5, 1.5, P.OUT); }
      const fy = back === 'none' ? seatY + 1 : by0 + (seatY - by0) / 2 - 1;
      return { eyes: { x: 20, y: back === 'none' ? seatY + 2 : fy - 1, span: Math.min(5, Math.floor(w / 4)) }, mouth: { x: 20, y: back === 'none' ? seatY + 4 : fy + 4, w: Math.min(10, w - 6) }, arms: [{ x: x0, y: seatY, d: -1 }, { x: x0 + w, y: seatY, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: by0 }, rigid: true };
    },
    table(g, p, v) {
      const w = clampi((p.w || 30) + v * 2, 18, 36), x0 = Math.round(20 - w / 2), ty = p.ty || 15, th = p.thick || 3;
      if (p.legs === 'pedestal') { rect(g, 18, ty + th, 4, 33 - ty - th, BD); ell(g, 20, 34, 7, 1.6, BD); }
      else if (p.legs === 'trestle') { C.crossBrace(g, x0 + 2, ty + th, 6, 34 - ty - th); C.crossBrace(g, x0 + w - 8, ty + th, 6, 34 - ty - th); }
      else C.legs4(g, x0 + 1, x0 + w - 2, ty + th, 35);
      rect(g, x0, ty, w, th, B);
      if (p.apron !== false) rect(g, x0 + 2, ty + th, w - 4, p.drawer ? 5 : 2, BD);
      if (p.drawer) C.knob(g, 20, ty + th + 2, 1, M);
      if (p.cloth) { rect(g, x0, ty, w, 8, A); for (let x = x0; x < x0 + w; x += 3) gset(g, x, ty + 8, A); }
      if (p.felt) rect(g, x0 + 2, ty, w - 4, 1, S);
      if (p.net) { rect(g, 19, ty - 4, 2, 4, PA); }
      if (p.bars) { rect(g, x0, ty - 12, w, 2, B); for (let x = x0 + 1; x < x0 + w; x += 3) rect(g, x, ty - 10, 1, 10, B); rect(g, x0, ty - 12, 2, 14, BD); rect(g, x0 + w - 2, ty - 12, 2, 14, BD); }
      if (p.items) { rect(g, x0 + 4, ty - 4, 4, 4, A); ell(g, x0 + w - 7, ty - 2, 2.5, 2, PA); }
      const fy = p.cloth ? ty + 3 : ty + th + (p.drawer ? 0 : 1);
      if (p.bars) return { eyes: { x: 20, y: ty - 7, span: 5 }, mouth: { x: 20, y: ty + 2, w: 10 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: ty - 12 }, rigid: true };
      return { eyes: { x: 20, y: p.cloth ? ty + 2 : ty + 1, span: 6 }, mouth: { x: 20, y: p.cloth ? ty + 5 : fy + 2, w: 10 }, arms: [{ x: x0, y: ty + 1, d: -1 }, { x: x0 + w, y: ty + 1, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: ty }, rigid: true };
    },
    storage(g, p, v) {
      const w = clampi((p.w || 24) + v * 2, 10, 34), h = clampi(p.h || 30, 10, 34), x0 = Math.round(20 - w / 2), y0 = 35 - h - (p.feet ? 2 : 0);
      if (p.feet) { rect(g, x0 + 1, 33, 2, 2, MD); rect(g, x0 + w - 3, 33, 2, 2, MD); }
      rrect(g, x0, y0, w, h, 1, B);
      if (p.top) rect(g, x0 - 1, y0, w + 2, 2, A);
      if (p.shelves) { rect(g, x0 + 2, y0 + 2, w - 4, h - 4, BD); C.shelfLines(g, x0 + 2, y0 + 2, w - 4, h - 4, p.shelves, B); for (let s = 0; s < p.shelves; s++) for (let x = x0 + 3; x < x0 + w - 3; x += 2) { const yy = y0 + 2 + Math.round((s + 1) * (h - 4) / p.shelves) - 1; if ((x * 7 + s) % 5 < 4) rect(g, x, yy - 3 - ((x + s) % 2), 1, 3 + ((x + s) % 2), [A, S, PA, AL][(x + s) % 4]); } }
      if (p.drawers) { const dh = (h - 2) / p.drawers; for (let i = 0; i < p.drawers; i++) { const yy = Math.round(y0 + 1 + i * dh); rect(g, x0 + 1, yy + Math.round(dh) - 1, w - 2, 1, BD); C.knob(g, 20, yy + dh / 2, 1, M); } }
      if (p.doors) { if (p.doors === 2) line(g, 20, y0 + 2, 20, y0 + h - 2, BD); C.knob(g, p.doors === 2 ? 18 : x0 + w - 3, y0 + h / 2, 1, M); if (p.doors === 2) C.knob(g, 22, y0 + h / 2, 1, M); }
      if (p.glass) rect(g, x0 + 3, y0 + 3, w - 6, Math.floor(h / 2) - 3, S);
      if (p.vents) for (let y = y0 + 3; y < y0 + 8; y += 2) rect(g, x0 + 3, y, w - 6, 1, BD);
      if (p.dial) C.dial(g, 20, y0 + h / 2, 3);
      if (p.lid) { rect(g, x0 - 1, y0 - 1, w + 2, 4, A); rect(g, 19, y0 + 2, 2, 3, GO); }
      return { eyes: { x: 20, y: y0 + Math.min(6, h / 3), span: Math.min(6, Math.floor(w / 4)) }, mouth: { x: 20, y: y0 + Math.min(12, h * 0.6), w: Math.min(12, w - 6) }, arms: [{ x: x0, y: y0 + h / 2, d: -1 }, { x: x0 + w, y: y0 + h / 2, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: y0 }, rigid: true };
    },
    bed(g, p, v) {
      const w = clampi(34 + v, 28, 36), x0 = Math.round(20 - w / 2);
      if (p.bunk) { rect(g, x0, 4, 2, 31, BD); rect(g, x0 + w - 2, 4, 2, 31, BD); rect(g, x0 + 2, 10, w - 4, 4, A); rect(g, x0 + 2, 9, 6, 2, PA); rect(g, x0 + 2, 24, w - 4, 5, A); rect(g, x0 + 2, 22, 6, 3, PA); for (let y = 6; y < 30; y += 3) rect(g, x0 + w - 5, y, 3, 1, BD); return { eyes: { x: 20, y: 11, span: 5 }, mouth: { x: 20, y: 26, w: 10 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 4 }, rigid: true }; }
      rrect(g, x0, p.posts ? 6 : 12, 4, p.posts ? 28 : 22, 1, BD);
      if (p.posts) rect(g, x0 + w - 3, 10, 3, 24, BD);
      rect(g, x0 + 2, 22, w - 3, 6, PA); rrect(g, x0 + 4, 18, 7, 5, 2, W);
      rrect(g, x0 + 10, 19, w - 11, 9, 2, B); rect(g, x0 + 10, 26, w - 11, 2, BD);
      rect(g, x0 + 1, 28, w - 1, 3, BD); C.legs4(g, x0 + 1, x0 + w - 1, 31, 35);
      if (p.canopy) { rect(g, x0, 6, w, 2, A); for (let x = x0; x < x0 + w; x += 3) gset(g, x, 8, A); }
      return { eyes: { x: x0 + 20, y: 22, span: 5 }, mouth: { x: x0 + 20, y: 26, w: 10 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 12 }, rigid: true };
    },
    appliance(g, p, v) {
      const w = clampi((p.w || 26) + v * 2, 12, 34), h = clampi(p.h || 22, 10, 34), x0 = Math.round(20 - w / 2), y0 = 34 - h;
      if (p.feet !== false) { rect(g, x0 + 2, 34, 3, 2, MD); rect(g, x0 + w - 5, 34, 3, 2, MD); }
      rrect(g, x0, y0, w, h, 2, B);
      let face = { x: 20, y: y0 + h / 2 - 2 };
      const pw = p.panel && p.panel !== 'none' ? (p.door === 'glass' ? Math.max(5, Math.floor(w / 4)) : w) : 0;
      if (p.door === 'glass') { rect(g, x0 + 2, y0 + 3, w - pw - 4, h - 6, S); rect(g, x0 + 3, y0 + 4, w - pw - 6, 1, SL); face = { x: x0 + (w - pw) / 2, y: y0 + h / 2 - 2 }; C.knob(g, x0 + w - pw - 3, y0 + h / 2, 1, M); }
      if (p.door === 'round') { const r = Math.min(w, h) / 2 - 3; ell(g, 20, y0 + h / 2 + 2, r + 1, r + 1, MD); ell(g, 20, y0 + h / 2 + 2, r, r, S); face = { x: 20, y: y0 + h / 2 + 1 }; }
      if (p.door === 'front') { rect(g, x0 + 2, y0 + 6, w - 4, h - 8, BD); rect(g, x0 + 3, y0 + 7, w - 6, h - 10, B); rect(g, x0 + 4, y0 + 8, w - 8, 1, M); if (p.window) rect(g, x0 + 5, y0 + 12, w - 10, h - 17, S); face = { x: 20, y: y0 + 13 }; }
      if (p.door === 'split') { line(g, x0 + 1, y0 + Math.floor(h * 0.35), x0 + w - 2, y0 + Math.floor(h * 0.35), BD); rect(g, x0 + w - 4, y0 + 3, 1, 4, M); rect(g, x0 + w - 4, y0 + h * 0.35 + 3, 1, 6, M); face = { x: 20, y: y0 + h * 0.6 }; }
      if (p.panel === 'dial' || p.panel === 'buttons' || p.panel === 'screen') {
        if (p.door === 'glass') { const px = x0 + w - pw - 1; rect(g, px, y0 + 2, pw - 1, h - 4, BD); if (p.panel === 'screen') rect(g, px + 1, y0 + 3, pw - 3, 2, G); C.buttons(g, px + 1, y0 + 7, Math.floor((h - 10) / 2), 0, 2, M); }
        else { rect(g, x0 + 1, y0 + 1, w - 2, 4, BD); if (p.panel === 'dial') { C.dial(g, x0 + 4, y0 + 3, 1.8); C.dial(g, x0 + w - 5, y0 + 3, 1.8); } else if (p.panel === 'screen') rect(g, x0 + w / 2 - 3, y0 + 2, 6, 2, G); else C.buttons(g, x0 + 3, y0 + 2, 4, 3, 0, M); }
      }
      if (p.topSlots) { rect(g, x0 + 4, y0 - 1, 5, 2, MD); rect(g, x0 + w - 9, y0 - 1, 5, 2, MD); if (p.toast) { rect(g, x0 + 4, y0 - 4, 5, 3, AL); rect(g, x0 + w - 9, y0 - 4, 5, 3, AL); } }
      if (p.burners) { rect(g, x0, y0 - 1, w, 2, MD); ell(g, x0 + 7, y0 - 1, 3, 1, P.OUT); ell(g, x0 + w - 7, y0 - 1, 3, 1, P.OUT); if (p.flame) C.flames(g, x0 + 7, y0 - 4); }
      if (p.vents) for (let y = y0 + 3; y < y0 + h - 3; y += 2) rect(g, x0 + 3, y, w - 6, 1, BD);
      if (p.fins) for (let x = x0 + 2; x < x0 + w - 1; x += 3) rect(g, x, y0 + 1, 1, h - 2, BD);
      if (p.lever) rect(g, x0 + w, y0 + 4, 2, 6, M);
      if (p.spoutBox) { rect(g, 18, y0 + h - 8, 4, 3, MD); rect(g, 17, y0 + h - 3, 6, 1, M); }
      return { eyes: { x: face.x, y: face.y, span: Math.min(5, Math.floor(w / 5)) }, mouth: { x: face.x, y: face.y + 6, w: Math.min(10, w - 8) }, arms: [{ x: x0, y: y0 + h / 2, d: -1 }, { x: x0 + w, y: y0 + h / 2, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: y0 }, rigid: true };
    },
    device(g, p, v) {
      const w = clampi((p.w || 24) + v, 6, 36), h = clampi(p.h || 16, 6, 34), x0 = Math.round(20 - w / 2), y0 = p.y0 || Math.round(26 - h);
      if (p.stand === 'base') { rect(g, 19, y0 + h, 3, 5, MD); rect(g, 13, y0 + h + 5, 15, 2, MD); }
      if (p.stand === 'legs') { rect(g, x0 + 3, y0 + h, 2, 6, MD); rect(g, x0 + w - 5, y0 + h, 2, 6, MD); }
      if (p.tower) { rrect(g, x0 + w + 1, y0 - 2, 7, h + 9, 1, BD); rect(g, x0 + w + 3, y0 + 1, 3, 1, G); }
      if (p.antennas) for (let i = 0; i < p.antennas; i++) C.antenna(g, x0 + 3 + i * (w - 6) / Math.max(1, p.antennas - 1), y0, 6, (i - (p.antennas - 1) / 2) * 2);
      rrect(g, x0, y0, w, h, p.round ? Math.min(5, Math.floor(h / 2)) : 2, B);
      let face = { x: 20, y: y0 + h / 2 - 2 };
      if (p.screen) { const sw = p.screen === 'small' ? Math.floor(w * 0.5) : w - 4, sh = p.screen === 'small' ? Math.max(3, Math.floor(h * 0.35)) : h - 4; const sx = Math.round(20 - sw / 2), sy = p.screen === 'small' ? y0 + 2 : y0 + 2; rect(g, sx, sy, sw, sh, S); face = { x: 20, y: sy + Math.min(sh / 2, 4) }; }
      if (p.keys) { const ky = y0 + h - 7; for (let r = 0; r < 3; r++) for (let x = x0 + 2; x < x0 + w - 2; x += 2) gset(g, x + (r % 2), ky + r * 2, MD); }
      if (p.buttons) C.buttons(g, x0 + 2, y0 + h - 4, Math.min(5, Math.floor((w - 4) / 3)), 3, 0, A);
      if (p.grille) C.grille(g, x0 + 3, y0 + h - 6, w - 6, 4);
      if (p.speaker) { ell(g, 20, y0 + h * 0.62, Math.min(w, h) * 0.28, Math.min(w, h) * 0.28, MD); ell(g, 20, y0 + h * 0.62, Math.min(w, h) * 0.14, Math.min(w, h) * 0.14, M); }
      if (p.dpad) { rect(g, x0 + 4, y0 + h / 2 - 1, 5, 1, K); rect(g, x0 + 6, y0 + h / 2 - 3, 1, 5, K); ell(g, x0 + w - 5, y0 + h / 2 - 1, 1.2, 1.2, TO); ell(g, x0 + w - 7, y0 + h / 2 + 1, 1.2, 1.2, S); face = { x: 20, y: y0 + 3 }; }
      if (p.lens) { ell(g, 20, y0 + h / 2, Math.min(w, h) / 3, Math.min(w, h) / 3, MD); ell(g, 20, y0 + h / 2, Math.min(w, h) / 4.5, Math.min(w, h) / 4.5, S); }
      if (p.light) C.light(g, x0 + w - 3, y0 + 1, 1, 1);
      if (p.strap) { line(g, x0 - 1, y0 + h / 2, x0 - 4, 33, A, 2); line(g, x0 + w, y0 + h / 2, x0 + w + 3, 33, A, 2); }
      return { eyes: { x: face.x, y: face.y, span: Math.max(2, Math.min(5, Math.floor(w / 5))), forceStyle: p.lens ? 'cyclops' : undefined }, mouth: { x: face.x, y: Math.min(y0 + h - 2, face.y + 5), w: Math.max(4, Math.min(10, w - 8)) }, arms: [{ x: x0, y: y0 + h / 2, d: -1 }, { x: x0 + w, y: y0 + h / 2, d: 1 }], legs: p.stand ? null : { y: Math.min(35, y0 + h + 1), xs: [20 - Math.min(6, w / 3), 20 + Math.min(6, w / 3)] }, noLegs: !!p.stand || h < 8, top: { x: 20, y: y0 }, rigid: true };
    },
    // vessels drawn from a list of half-widths per section: [[height, halfWidth], ...] bottom-up
    vessel(g, p, v) {
      const prof = p.prof || [[12, 8], [8, 9], [4, 4]], total = prof.reduce((a, s) => a + s[0], 0), scale = Math.min(1, 31 / total);
      let y = 35, top = 35;
      const widths = [];
      for (const [hh, hw] of prof) { const h = Math.max(1, Math.round(hh * scale)); const ww = hw * (1 + v * 0.06); rrect(g, Math.round(20 - ww), y - h, Math.round(ww * 2), h, Math.min(3, Math.floor(h / 2)), B); widths.push([y - h, y, ww]); y -= h; top = y; }
      const mid = widths[0], body = widths.reduce((a, b) => (b[2] > a[2] ? b : a));
      if (p.cap) rect(g, Math.round(20 - (p.cap || 3)), top - 3, Math.round((p.cap || 3) * 2), 3, A);
      if (p.label) rect(g, Math.round(20 - body[2]), Math.round(body[0] + (body[1] - body[0]) * 0.3), Math.round(body[2] * 2), Math.max(3, Math.round((body[1] - body[0]) * 0.35)), A);
      if (p.liquid) rect(g, Math.round(20 - body[2]) + 1, Math.round(body[0] + (body[1] - body[0]) * 0.45), Math.round(body[2] * 2) - 2, Math.round((body[1] - body[0]) * 0.5), S);
      if (p.handle) C.handleRing(g, Math.round(20 + body[2] + 2), (body[0] + body[1]) / 2, 4, 5);
      if (p.spout) C.spout(g, Math.round(20 - body[2]) + 1, (body[0] + body[1]) / 2, -1, p.spout);
      if (p.lid) C.lid(g, 20, top, Math.min(14, body[2] * 1.4));
      if (p.rim) rect(g, Math.round(20 - widths[widths.length - 1][2]) - 1, top, Math.round(widths[widths.length - 1][2] * 2) + 2, 2, BL);
      if (p.straw) line(g, 22, top + 2, 25, top - 7, TO, 2);
      if (p.gable) { poly(g, [[Math.round(20 - body[2]), top + 1], [20, top - 5], [Math.round(20 + body[2]), top + 1]], BL); rect(g, 19, top - 7, 2, 2, PA); }
      if (p.nozzle) { rect(g, 18, top - 3, 4, 3, A); rect(g, 14, top - 3, 4, 1, A); }
      if (p.steam) for (let s = 0; s < 4; s++) gset(g, 20 + (s % 2), top - 3 - s, ST);
      const tw = widths[widths.length - 1][2];
      if (p.foam) { ell(g, 20, top, tw + 0.5, 2.2, PA); ell(g, 20 - tw * 0.5, top - 1, 2.5, 2, PA); ell(g, 20 + tw * 0.4, top - 1.5, 2.5, 2, PA); } // milkshake / beer head
      if (p.pearls) for (let i = 0; i < 7; i++) ell(g, 20 - mid[2] + 2.5 + (i * 3) % Math.max(3, Math.round(mid[2] * 2 - 4)), mid[1] - 2.5 - (i % 2) * 2, 1.2, 1.2, K); // bubble-tea tapioca
      if (p.tip) poly(g, [[18, top], [22, top], [20, top - 4]], A); // squeeze-bottle nozzle
      const fy = body[0] + (body[1] - body[0]) * (p.label ? 0.2 : 0.35);
      return { eyes: { x: 20, y: Math.round(fy) + 1, span: Math.max(2, Math.min(5, Math.floor(body[2] / 2))) }, mouth: { x: 20, y: Math.round(body[0] + (body[1] - body[0]) * 0.7), w: Math.max(4, Math.min(10, Math.round(body[2]))) }, arms: [{ x: Math.round(20 - body[2]), y: (body[0] + body[1]) / 2, d: -1 }, { x: Math.round(20 + body[2]), y: (body[0] + body[1]) / 2, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: top }, rigid: !!p.rigid };
    },
    produce(g, p, v) {
      const sh = p.shape || 'round', s = 1 + v * 0.06;
      let cx = 20, cy = 23, rx = 11 * s, ry = 11 * s;
      if (sh === 'oval') { rx = 13 * s; ry = 9 * s; }
      if (sh === 'tall') { rx = 9 * s; ry = 12 * s; }
      if (sh === 'long') { rx = 15 * s; ry = 6 * s; cy = 25; }
      if (sh === 'small') { rx = 7; ry = 7; cy = 27; }
      if (sh === 'cluster') { for (let r = 0; r < 4; r++) for (let i = 0; i <= 3 - r; i++) ell(g, 20 + (i - (3 - r) / 2) * 6, 12 + r * 6, 3.2, 3.2, B); rect(g, 19, 6, 2, 4, MD); ell(g, 23, 7, 3, 1.5, S); return { eyes: { x: 20, y: 17, span: 4 }, mouth: { x: 20, y: 23, w: 5 }, arms: [{ x: 8, y: 16, d: -1 }, { x: 32, y: 16, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 6 } }; }
      if (sh === 'pair') { line(g, 14, 22, 20, 6, MD); line(g, 26, 24, 20, 6, MD); ell(g, 21, 6, 3, 1.5, S); ell(g, 13, 26, 7, 7, B); ell(g, 27, 28, 6.5, 6.5, B); return { eyes: { x: 13, y: 25, span: 3 }, mouth: { x: 13, y: 29, w: 4 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 6 } }; }
      if (sh === 'stalk') { for (const [x, y0] of [[13, 11], [18, 8], [23, 12]]) { rect(g, x, y0, 4, 36 - y0, B); rect(g, x, y0, 1, 36 - y0, BL); } C.leaves(g, 20, 11, 5, 7, 12); rect(g, 12, 27, 16, 2, A); cy = 20; ry = 10; rx = 7; }
      else if (sh === 'leaf') { ell(g, 20, 20, 11 * s, 14 * s, B); poly(g, [[16, 31], [24, 31], [20, 37]], B); line(g, 20, 8, 20, 36, BD); for (let y = 12; y < 32; y += 5) { line(g, 20, y + 3, 13, y, BD); line(g, 20, y + 3, 27, y, BD); } cy = 20; ry = 12; rx = 11; }
      else if (sh === 'pod') { ell(g, 20, 24, 15 * s, 6, B); for (let x = 10; x <= 30; x += 5) ell(g, x, 23, 2.2, 2.2, BL); line(g, 6, 22, 3, 18, MD); cy = 24; ry = 6; rx = 15; }
      else if (sh === 'chili') { for (const [x, y, r] of [[15, 15, 6], [19, 21, 5.5], [23, 26, 4.5], [26, 30, 3.2], [28, 33, 2]]) ell(g, x, y, r, r, B); ell(g, 14, 9, 4.5, 2, S); line(g, 14, 9, 12, 4, S); cx = 17; cy = 18; rx = 6; ry = 6; }
      else if (sh === 'nut') { ell(g, 20, 22, 10 * s, 12 * s, B); line(g, 20, 11, 20, 33, BD); for (let i = 0; i < 8; i++) gset(g, 14 + (i * 5) % 12, 15 + (i * 7) % 15, BD); cy = 22; ry = 12; rx = 10; }
      else if (sh === 'pear') { ell(g, 20, 27, 10 * s, 8 * s, B); ell(g, 20, 16, 6 * s, 7 * s, B); cy = 24; ry = 10; }
      else if (sh === 'carrot') { poly(g, [[12, 12], [28, 12], [21, 37], [19, 37]], B); for (let y = 16; y < 32; y += 4) line(g, 15 + (y - 12) * 0.2, y, 18, y, BD); cy = 18; ry = 6; rx = 8; }
      else if (sh === 'curved') { ell(g, 20, 22, 14, 8, B); ell(g, 22, 15, 12, 6, E); cy = 25; ry = 5; }
      else if (sh === 'heart') { ell(g, 20, 17, 13, 9, B); poly(g, [[7, 18], [33, 18], [20, 36]], B); cy = 20; ry = 8; }
      else if (sh === 'spiky') { // sea urchin (recognition audit 2026-11): a round body with radiating spines
        cy = 23; rx = ry = 9 * s;
        for (let i = 0; i < 20; i++) { const t = (i / 20) * Math.PI * 2, r1 = rx + (i % 2 ? 4 : 6.5); line(g, cx + Math.cos(t) * (rx - 1), cy + Math.sin(t) * (ry - 1), cx + Math.cos(t) * r1, cy + Math.sin(t) * r1, i % 2 ? BD : A); }
        ell(g, cx, cy, rx, ry, B);
        for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2 + 0.3; gset(g, Math.round(cx + Math.cos(t) * (rx - 2.5)), Math.round(cy + Math.sin(t) * (ry - 2.5)), BL); }
      }
      else if (sh === 'spinner') { // fidget spinner (recognition audit 2026-11): three weighted lobes round a bearing
        cy = 23; rx = ry = 7;
        for (const t of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) { const lx = cx + Math.cos(t) * 9, ly = cy + Math.sin(t) * 9; line(g, cx, cy, lx, ly, B, 5); ell(g, lx, ly, 5, 5, B); ell(g, lx, ly, 2, 2, M); }
        ell(g, cx, cy, rx, ry, B); ell(g, cx, cy + 3, 2, 1.5, BD);
      }
      else ell(g, cx, cy, rx, ry, B);
      if (p.stripes) paintOn(g, (x, y) => (Math.floor((x - 20) / 3) % 2 === 0 ? BD : null), [B]);
      if (p.seeds) for (let y = cy - ry + 3; y < cy + ry - 1; y += 4) for (let x = cx - rx + 3 + ((y >> 2) % 2) * 2; x < cx + rx - 2; x += 5) if (gget(g, x, y) === B) gset(g, x, y, p.seeds === 'dark' ? K : PA);
      if (p.flesh) { rect(g, 4, cy, 33, 13, E); rect(g, Math.round(cx - rx), cy, Math.round(rx * 2), 1, S); }
      if (p.dimples) for (let i = 0; i < 9; i++) gset(g, 13 + (i * 7) % 15, cy - 6 + (i * 5) % 12, BD);
      if (p.ridges) for (let x = cx - rx + 4; x < cx + rx - 2; x += 4) line(g, x, cy - ry + 2, x, cy + ry - 2, BD);
      const topY = Math.round(cy - ry);
      if (p.top === 'stem') { rect(g, 19, topY - 3, 2, 4, MD); ell(g, 23, topY - 2, 3, 1.5, S); }
      if (p.top === 'crown') C.leaves(g, 20, topY + 1, 5, 10, 8);
      if (p.top === 'leafy') C.leaves(g, 20, topY + 1, 4, 8, 7);
      if (p.top === 'cap') { ell(g, 20, topY + 1, 5, 2.5, S); rect(g, 19, topY - 3, 2, 3, S); }
      if (p.top === 'sprout') { line(g, 20, topY, 20, topY - 5, S); ell(g, 22, topY - 5, 2, 1, S); }
      return { eyes: { x: cx, y: Math.round(cy - ry * 0.15), span: Math.max(3, Math.min(5, Math.round(rx / 3))) }, mouth: { x: cx, y: Math.round(cy + ry * 0.35), w: Math.max(4, Math.min(8, Math.round(rx * 0.6))) }, arms: [{ x: Math.round(cx - rx), y: cy, d: -1 }, { x: Math.round(cx + rx), y: cy, d: 1 }], legs: { y: Math.min(35, Math.round(cy + ry)), xs: [cx - 4, cx + 4] }, top: { x: 20, y: topY } };
    },
    quadruped(g, p, v) {
      const neck = p.neck || 0, long = p.legs === 'long', bodyY = long ? 21 : 25, bodyRX = (p.body === 'long' ? 13 : p.body === 'round' ? 11 : 10) + v, bodyRY = p.body === 'round' ? 8 : 6;
      const hx = 12 - (p.body === 'long' ? 3 : 0), hy = bodyY - 8 - neck;
      const lh = long ? 11 : 6;
      for (const x of [20 - bodyRX + 3, 20 - bodyRX + 7, 20 + bodyRX - 7, 20 + bodyRX - 3]) rect(g, x, bodyY + bodyRY - 2, 2, lh, BD);
      if (p.tail === 'thin') line(g, 20 + bodyRX - 1, bodyY - 2, 20 + bodyRX + 4, bodyY + 3, B);
      if (p.tail === 'fluffy') ell(g, 20 + bodyRX + 2, bodyY - 2, 3, 4, B);
      if (p.tail === 'curly') { gset(g, 20 + bodyRX + 1, bodyY - 2, B); gset(g, 20 + bodyRX + 2, bodyY - 3, B); gset(g, 20 + bodyRX + 3, bodyY - 2, B); }
      if (p.tail === 'tuft') { line(g, 20 + bodyRX - 1, bodyY - 2, 20 + bodyRX + 3, bodyY + 4, B); ell(g, 20 + bodyRX + 3, bodyY + 5, 1.5, 2, A); }
      ell(g, 20, bodyY, bodyRX, bodyRY, B);
      if (neck) line(g, hx + 2, bodyY - 3, hx, hy + 3, B, 3);
      if (p.hump) ell(g, 20, bodyY - bodyRY + 1, 5, 4, B);
      if (p.mane) ell(g, hx, hy, 8, 8, A);
      ell(g, hx, hy, 6, 5.5, B);
      if (p.snout === 'long') ell(g, hx - 5, hy + 2, 4, 3, AL);
      else if (p.snout === 'trunk') { line(g, hx - 4, hy + 2, hx - 7, hy + 10, B, 3); }
      else if (p.snout === 'flat') ell(g, hx - 1, hy + 3, 3.5, 2.5, AL);
      else ell(g, hx - 2, hy + 2.5, 3, 2, AL);
      gset(g, p.snout === 'long' ? hx - 8 : hx - 4, hy + 2, K);
      if (p.ears === 'pointy') { poly(g, [[hx - 5, hy - 3], [hx - 4, hy - 9], [hx - 1, hy - 4]], B); poly(g, [[hx + 1, hy - 4], [hx + 4, hy - 9], [hx + 5, hy - 3]], B); }
      if (p.ears === 'floppy') { ell(g, hx - 5, hy + 1, 2, 4.5, A); ell(g, hx + 5, hy + 1, 2, 4.5, A); }
      if (p.ears === 'round') { ell(g, hx - 4, hy - 5, 2.2, 2.2, B); ell(g, hx + 4, hy - 5, 2.2, 2.2, B); }
      if (p.ears === 'long') { ell(g, hx - 2, hy - 8, 1.6, 5, B); ell(g, hx + 2, hy - 8, 1.6, 5, B); }
      if (p.ears === 'big') { ell(g, hx + 5, hy, 5, 6, BL); }
      if (p.horns === 'curl') { C.handleRing(g, hx - 5, hy - 3, 3, 3, PA); C.handleRing(g, hx + 5, hy - 3, 3, 3, PA); }
      if (p.horns === 'antler') { line(g, hx - 3, hy - 4, hx - 7, hy - 11, AD); line(g, hx - 5, hy - 8, hx - 9, hy - 9, AD); line(g, hx + 3, hy - 4, hx + 7, hy - 11, AD); line(g, hx + 5, hy - 8, hx + 9, hy - 9, AD); }
      if (p.horns === 'nose') poly(g, [[hx - 7, hy + 1], [hx - 4, hy], [hx - 7, hy - 5]], PA);
      if (p.horns === 'small') { poly(g, [[hx - 3, hy - 4], [hx - 2, hy - 8], [hx - 1, hy - 4]], PA); poly(g, [[hx + 1, hy - 4], [hx + 2, hy - 8], [hx + 3, hy - 4]], PA); }
      if (p.ossicones) { rect(g, hx - 2, hy - 8, 1, 4, AD); rect(g, hx + 2, hy - 8, 1, 4, AD); }
      if (p.pattern === 'spots') for (let i = 0; i < 7; i++) ell(g, 20 - bodyRX + 4 + (i * 5) % (bodyRX * 2 - 6), bodyY - 3 + (i * 3) % 6, 1.4, 1.2, A, [B]);
      if (p.pattern === 'stripes') paintOn(g, (x) => (x % 4 === 0 ? K : null), [B]);
      if (p.pattern === 'patches') { ell(g, 16, bodyY - 1, 4, 3, K, [B]); ell(g, 25, bodyY + 1, 3, 2.5, K, [B]); }
      if (p.pattern === 'belly') ell(g, 20, bodyY + 2, bodyRX - 3, bodyRY - 2, AL, [B]);
      if (p.shell) { ell(g, 20, bodyY - 2, bodyRX, bodyRY + 1, A); paintOn(g, (x, y) => ((x + y) % 5 === 0 ? AD : null), [A]); }
      return { eyes: { x: hx, y: hy - 1, span: 3 }, mouth: { x: hx - 1, y: hy + 3, w: 4 }, arms: [], legs: null, noLegs: true, top: { x: hx, y: hy - 5 } };
    },
    /* v0.4.3 — reusable designs for objects that used to borrow their category's look (a toolbox for a light switch).
       wallplate: switches, sockets, thermostats, doorbells, intercoms, keypads, fuse boxes, ceiling detectors */
    wallplate(g, p, v) {
      const k = p.kind || 'rocker';
      if (k === 'disc') { // smoke detector / fire alarm: round ceiling disc with vents and a status light
        ell(g, 20, 19, 14, 12, B); ell(g, 20, 19, 11, 9, BL); for (let a = 0; a < 6.28; a += 0.45) gset(g, 20 + Math.cos(a) * 12.5, 19 + Math.sin(a) * 10.5, BD);
        ell(g, 20, 22, 3, 2.5, MD); rect(g, 27, 13, 2, 2, TO);
        return { eyes: { x: 20, y: 16, span: 4 }, mouth: { x: 20, y: 25, w: 6 }, arms: [{ x: 6, y: 19, d: -1 }, { x: 34, y: 19, d: 1 }], legs: { y: 31, xs: [15, 25] }, top: { x: 20, y: 7 }, rigid: true };
      }
      const wide = !!p.wide, w = clampi((wide ? 26 : 18) + v, 14, 30), h = k === 'box' ? 28 : 26, x0 = Math.round(20 - w / 2), y0 = 6, cy = y0 + Math.round(h / 2) + 1;
      rrect(g, x0, y0, w, h, 2, B); rect(g, x0 + 2, y0 + 1, w - 4, 1, BL); rect(g, x0 + 1, y0 + h - 2, w - 2, 1, BD);
      const screws = () => { gset(g, 20, y0 + 2, MD); gset(g, 20, y0 + h - 3, MD); };
      const socket = cx => { ell(g, cx, cy, 5, 5, BD); ell(g, cx, cy, 4, 4, BL); rect(g, cx - 2, cy - 2, 1, 3, K); rect(g, cx + 2, cy - 2, 1, 3, K); gset(g, cx, cy + 2, K); };
      let eyes = { x: 20, y: y0 + 5, span: 3 }, mouth = { x: 20, y: y0 + h - 5, w: 5 };
      switch (k) {
        case 'rocker': screws(); rrect(g, 16, cy - 6, 8, 11, 1, MD); rect(g, 17, cy - 5, 6, 5, BL); rect(g, 17, cy, 6, 4, BD); if (wide) { rrect(g, 25, cy - 6, 6, 11, 1, MD); rect(g, 26, cy - 5, 4, 5, BL); } break;
        case 'toggle': screws(); rrect(g, 17, cy - 3, 6, 7, 1, MD); line(g, 20, cy, 20, cy - 7, M, 2); ell(g, 20, cy - 7, 1.6, 1.6, BL); break;
        case 'socket': screws(); if (wide) { socket(14); socket(26); } else socket(20); eyes = { x: 20, y: y0 + 4, span: 3 }; break;
        case 'dial': rrect(g, x0 + 3, y0 + 4, w - 6, 4, 1, S); ell(g, 20, cy + 2, 6, 6, MD); ell(g, 20, cy + 2, 4.5, 4.5, BL); rect(g, 20, cy - 3, 1, 3, TO); eyes = { x: 20, y: y0 + 6, span: 3 }; mouth = { x: 20, y: y0 + h - 4, w: 4 }; break;
        case 'bell': rect(g, 16, cy - 7, 8, 3, PA); ell(g, 20, cy + 2, 4.5, 4.5, MD); ell(g, 20, cy + 2, 3, 3, G); eyes = { x: 20, y: y0 + 4, span: 3 }; break;
        case 'grille': C.grille(g, x0 + 3, cy - 7, w - 6, 7); ell(g, 20, cy + 4, 2.2, 2.2, A); rect(g, x0 + w - 5, y0 + 3, 2, 2, G); eyes = { x: 20, y: y0 + 4, span: 3 }; break;
        case 'keypad': rrect(g, x0 + 3, y0 + 4, w - 6, 3, 1, S); for (let r = 0; r < 4; r++) for (let c = -1; c <= 1; c++) rect(g, 20 + c * 4 - 1, cy - 4 + r * 3, 2, 2, r === 3 && c ? A : MD); eyes = { x: 20, y: y0 + 5, span: 3 }; mouth = { x: 20, y: y0 + h - 3, w: 4 }; break;
        case 'box': rect(g, x0 + 2, y0 + 3, w - 4, h - 6, BD); rect(g, x0 + 3, y0 + 4, w - 6, h - 8, B); for (let i = 0; i < (wide ? 5 : 3); i++) rect(g, x0 + 5 + i * 4, cy - 1, 2, 4, i % 2 ? M : BL); rect(g, x0 + w - 5, y0 + h / 2, 1, 3, M); line(g, 21, cy + 6, 25, cy + 10, G); line(g, 25, cy + 10, 23, cy + 10, G); break;
      }
      return { eyes, mouth, arms: [{ x: x0, y: cy, d: -1 }, { x: x0 + w, y: cy, d: 1 }], legs: { y: Math.min(35, y0 + h + 1), xs: [16, 24] }, top: { x: 20, y: y0 }, rigid: true };
    },
    /* cctv: security cameras (bullet on a wall arm, ceiling dome), webcams, dashcams and action cameras */
    cctv(g, p, v) {
      const k = p.kind || 'bullet';
      if (k === 'dome') { // ceiling dome: mount plate, half-sphere of smoked glass, lens + infrared ring
        ell(g, 20, 10, 13, 13, B); rect(g, 5, 1, 30, 9, E); rect(g, 5, 7, 30, 3, MD); rect(g, 6, 6, 28, 1, M);
        ell(g, 20, 13, 8, 8, S); rect(g, 10, 4, 20, 9, E); rect(g, 5, 7, 30, 3, MD); ell(g, 20, 15, 3, 3, MD); gset(g, 21, 14, G);
        for (const x of [14, 26]) gset(g, x, 15, TO);
        return { eyes: { x: 20, y: 15, span: 3, forceStyle: 'cyclops' }, mouth: { x: 20, y: 20, w: 5 }, arms: [{ x: 8, y: 14, d: -1 }, { x: 32, y: 14, d: 1 }], legs: null, noLegs: true, float: true, top: { x: 20, y: 6 }, rigid: true };
      }
      if (k === 'webcam' || k === 'box') {
        const w = k === 'box' ? 20 : 16, h = k === 'box' ? 13 : 14, x0 = Math.round(20 - w / 2), y0 = 11;
        if (k === 'webcam') { rect(g, 15, y0 + h, 10, 2, MD); rect(g, 13, y0 + h + 2, 14, 2, MD); } else { rect(g, 18, y0 - 4, 4, 4, MD); rect(g, 14, y0 - 5, 12, 2, M); }
        rrect(g, x0, y0, w, h, k === 'webcam' ? 6 : 3, B); ell(g, 20, y0 + h / 2, 4.5, 4.5, MD); ell(g, 20, y0 + h / 2, 3, 3, S); gset(g, 21, y0 + h / 2 - 1, G); rect(g, x0 + w - 3, y0 + 2, 1, 1, TO);
        return { eyes: { x: 20, y: Math.round(y0 + h / 2), span: 3, forceStyle: 'cyclops' }, mouth: { x: 20, y: y0 + h - 2, w: 4 }, arms: [{ x: x0, y: y0 + h / 2, d: -1 }, { x: x0 + w, y: y0 + h / 2, d: 1 }], legs: k === 'webcam' ? null : { y: y0 + h + 1, xs: [16, 24] }, noLegs: k === 'webcam', top: { x: 20, y: y0 }, rigid: true };
      }
      // bullet camera on a wall bracket: housing with sun hood, lens at the front, red infrared light
      const len = clampi(22 + v * 2, 18, 24), x0 = 10, y0 = 13;
      rect(g, 3, 9, 4, 14, MD); rect(g, 2, 10, 1, 12, M); line(g, 6, 16, 11, 20, MD, 2); ell(g, 11, 20, 1.6, 1.6, M);
      rrect(g, x0, y0, len, 10, 3, B); rect(g, x0 - 1, y0 - 2, len + 3, 3, BD); rect(g, x0, y0 + 7, len, 1, BD);
      const lx = x0 + len; rect(g, lx - 2, y0 + 1, 3, 8, MD); ell(g, lx, y0 + 5, 3, 3.5, MD); ell(g, lx, y0 + 5, 2, 2.5, S); gset(g, lx, y0 + 4, G); gset(g, lx - 4, y0 + 1, TO);
      return { eyes: { x: x0 + len / 2 - 1, y: y0 + 4, span: 3 }, mouth: { x: x0 + len / 2 - 1, y: y0 + 8, w: 5 }, arms: [{ x: x0 + 4, y: y0 + 9, d: -1 }, { x: lx - 4, y: y0 + 9, d: 1 }], legs: null, noLegs: true, float: true, top: { x: x0 + len / 2, y: y0 - 2 }, rigid: true };
    },
    /* pole: street furniture on a post (street lamp, traffic light, parking meter, signs, bollards, coat stands) */
    pole(g, p, v) {
      const k = p.kind || 'lamp';
      if (k === 'bollard') { rrect(g, 14, 12, 12, 23, 4, B); rect(g, 14, 17, 12, 2, G); rect(g, 14, 22, 12, 1, BD); rect(g, 12, 34, 16, 2, MD);
        return { eyes: { x: 20, y: 25, span: 3 }, mouth: { x: 20, y: 30, w: 4 }, arms: [{ x: 14, y: 24, d: -1 }, { x: 26, y: 24, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 12 }, rigid: true }; }
      const post = (y0, x = 20) => { rect(g, x - 1, y0, 3, 36 - y0, MD); rect(g, x - 3, 34, 7, 2, MD); };
      let eyes, mouth, arms, top;
      switch (k) {
        case 'lamp': post(12); line(g, 20, 12, 24, 7, MD, 2); rrect(g, 21, 3, 15, 6, 2, B); rect(g, 22, 9, 13, 2, G); rect(g, 23, 11, 11, 1, G);
          eyes = { x: 28, y: 5, span: 3 }; mouth = { x: 20, y: 22, w: 3 }; arms = [{ x: 19, y: 20, d: -1 }, { x: 21, y: 20, d: 1 }]; top = { x: 28, y: 3 }; break;
        case 'lights': post(27); rrect(g, 14, 2, 12, 26, 2, B); for (const [y, c] of [[8, TO], [15, GO], [22, G]]) { rect(g, 13, y - 4, 14, 1, BD); ell(g, 20, y, 3.2, 3.2, MD); ell(g, 20, y, 2.4, 2.4, c); }
          eyes = { x: 20, y: 15, span: 3, forceStyle: 'cyclops' }; mouth = { x: 20, y: 26, w: 4 }; arms = [{ x: 14, y: 15, d: -1 }, { x: 26, y: 15, d: 1 }]; top = { x: 20, y: 2 }; break;
        case 'meter': post(22); rrect(g, 13, 5, 14, 17, 4, M); rrect(g, 15, 8, 10, 6, 2, S); line(g, 20, 13, 23, 10, TO); rect(g, 18, 17, 4, 1, K); rect(g, 13, 20, 14, 2, MD);
          eyes = { x: 20, y: 10, span: 3 }; mouth = { x: 20, y: 18, w: 4 }; arms = [{ x: 13, y: 14, d: -1 }, { x: 27, y: 14, d: 1 }]; top = { x: 20, y: 5 }; break;
        case 'sign8': { post(22); const pts = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; pts.push([20 + Math.cos(a) * 12, 12 + Math.sin(a) * 12]); } poly(g, pts, TO); const pts2 = pts.map(([x, y]) => [20 + (x - 20) * 0.82, 12 + (y - 12) * 0.82]); poly(g, pts2, B); rect(g, 13, 14, 15, 2, PA);
          eyes = { x: 20, y: 9, span: 4 }; mouth = { x: 20, y: 18, w: 5 }; arms = [{ x: 9, y: 12, d: -1 }, { x: 31, y: 12, d: 1 }]; top = { x: 20, y: 1 }; break; }
        case 'signrect': post(20); rect(g, 7, 4, 26, 16, PA); rect(g, 8, 5, 24, 14, B); poly(g, [[22, 9], [28, 12], [22, 15]], PA); rect(g, 13, 11, 9, 2, PA);
          eyes = { x: 16, y: 8, span: 3 }; mouth = { x: 16, y: 16, w: 4 }; arms = [{ x: 7, y: 12, d: -1 }, { x: 33, y: 12, d: 1 }]; top = { x: 20, y: 4 }; break;
        default: post(8); for (const d of [-1, 1]) { line(g, 20, 9, 20 + d * 8, 5, MD, 2); ell(g, 20 + d * 8, 5, 1.5, 1.5, A); } rrect(g, 15, 12, 10, 9, 3, B);
          eyes = { x: 20, y: 15, span: 3 }; mouth = { x: 20, y: 19, w: 4 }; arms = [{ x: 15, y: 16, d: -1 }, { x: 25, y: 16, d: 1 }]; top = { x: 20, y: 4 };
      }
      return { eyes, mouth, arms, legs: null, noLegs: true, top, rigid: true };
    },
    /* board: whiteboards, chalkboards, easels, canvases, projector screens, pin boards */
    board(g, p, v) {
      const k = p.kind || 'white', w = clampi(26 + v * 2, 22, 30), x0 = Math.round(20 - w / 2), y0 = k === 'screen' ? 7 : 5, h = k === 'easel' ? 18 : 20;
      if (k === 'easel') { line(g, 14, 20, 9, 36, AD, 2); line(g, 26, 20, 31, 36, AD, 2); line(g, 20, 20, 20, 36, AD, 2); rect(g, x0 - 1, y0 + h, w + 2, 2, AD); }
      else if (k === 'screen') { rect(g, x0 - 2, y0 - 2, w + 4, 3, MD); rect(g, 19, y0 + h, 2, 13, MD); line(g, 14, 36, 20, 33, MD); line(g, 26, 36, 20, 33, MD); }
      else { rect(g, x0 + 2, y0 + h, 2, 36 - y0 - h, MD); rect(g, x0 + w - 4, y0 + h, 2, 36 - y0 - h, MD); }
      const surface = k === 'chalk' ? S : k === 'cork' ? AL : PA;
      rect(g, x0, y0, w, h, k === 'canvas' || k === 'easel' ? AD : BD); rect(g, x0 + 2, y0 + 2, w - 4, h - 4, surface);
      if (k === 'white') { line(g, x0 + 4, y0 + h - 5, x0 + 10, y0 + h - 7, A); rect(g, x0 + 2, y0 + h - 2, w - 4, 1, M); rect(g, x0 + 5, y0 + h - 3, 3, 1, TO); }
      if (k === 'chalk') { line(g, x0 + 4, y0 + h - 6, x0 + 12, y0 + h - 6, PA); rect(g, x0 + 2, y0 + h - 2, w - 4, 1, AD); }
      if (k === 'canvas' || k === 'easel') { ell(g, x0 + w - 7, y0 + 6, 3, 2, A); poly(g, [[x0 + 3, y0 + h - 3], [x0 + 10, y0 + h - 9], [x0 + 15, y0 + h - 3]], S); }
      if (k === 'cork') for (const [dx, dy, c] of [[4, 4, PA], [w - 9, 5, A], [6, h - 8, S]]) rect(g, x0 + dx, y0 + dy, 4, 3, c);
      return { eyes: { x: 20, y: y0 + Math.round(h * 0.4), span: 4 }, mouth: { x: 20, y: y0 + Math.round(h * 0.7), w: 6 }, arms: [{ x: x0, y: y0 + h / 2, d: -1 }, { x: x0 + w, y: y0 + h / 2, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: y0 }, rigid: true };
    },
    /* part: small everyday things that have no template of their own (batteries, plugs, cables, screws, cards,
       coins, discs, chips, rings, bandages, medical and science kit, tents, fences, bells, scales...) */
    part(g, p, v) {
      const k = p.kind;
      let eyes = { x: 20, y: 18, span: 3 }, mouth = { x: 20, y: 23, w: 5 }, arms = [{ x: 11, y: 22, d: -1 }, { x: 29, y: 22, d: 1 }], legs = { y: 34, xs: [16, 24] }, noLegs = false, float = false, top = { x: 20, y: 8 };
      switch (k) {
        case 'battery': rrect(g, 13, 9, 14, 25, 2, B); rect(g, 13, 9, 14, 7, A); rect(g, 17, 6, 6, 3, M); rect(g, 19, 11, 2, 1, PA); rect(g, 18, 12, 4, 1, PA); rect(g, 19, 13, 2, 1, PA); rect(g, 17, 29, 6, 1, BD); top = { x: 20, y: 6 }; eyes = { x: 20, y: 20, span: 3 }; mouth = { x: 20, y: 25, w: 5 }; arms = [{ x: 13, y: 22, d: -1 }, { x: 27, y: 22, d: 1 }]; break;
        case 'plug': rrect(g, 12, 12, 16, 15, 3, B); rect(g, 15, 6, 2, 6, M); rect(g, 23, 6, 2, 6, M); line(g, 20, 27, 20, 31, A, 2); line(g, 20, 31, 30, 35, A, 2); eyes = { x: 20, y: 17, span: 3 }; mouth = { x: 20, y: 22, w: 5 }; arms = [{ x: 12, y: 19, d: -1 }, { x: 28, y: 19, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 6 }; break;
        case 'strip': rrect(g, 5, 18, 30, 9, 2, B); for (const x of [10, 17, 24]) { ell(g, x, 22, 2.5, 2.5, BD); gset(g, x - 1, 22, K); gset(g, x + 1, 22, K); } rect(g, 30, 20, 3, 2, TO); line(g, 5, 22, 2, 30, A, 2); eyes = { x: 20, y: 14, span: 3 }; mouth = { x: 20, y: 28, w: 6 }; top = { x: 20, y: 12 }; arms = [{ x: 6, y: 22, d: -1 }, { x: 34, y: 22, d: 1 }]; legs = { y: 28, xs: [12, 28] }; break;
        case 'coil': for (let r = 12; r >= 4; r -= 3) { ell(g, 20, 21, r, r * 0.8, r % 2 ? A : B); } ell(g, 20, 21, 2.5, 2, E); line(g, 30, 25, 35, 33, A, 2); eyes = { x: 20, y: 17, span: 4 }; mouth = { x: 20, y: 26, w: 5 }; legs = null; noLegs = true; top = { x: 20, y: 11 }; break;
        case 'screw': rrect(g, 11, 6, 18, 6, 2, M); rect(g, 19, 7, 2, 4, MD); rect(g, 17, 12, 6, 18, M); for (let y = 13; y < 30; y += 3) line(g, 16, y + 1, 24, y, MD); poly(g, [[17, 30], [23, 30], [20, 35]], M); eyes = { x: 20, y: 16, span: 2 }; mouth = { x: 20, y: 22, w: 3 }; arms = [{ x: 17, y: 20, d: -1 }, { x: 23, y: 20, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 6 }; break;
        case 'nut': { const pts = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; pts.push([20 + Math.cos(a) * 12, 21 + Math.sin(a) * 12]); } poly(g, pts, M); ell(g, 20, 21, 5, 5, E); ell(g, 20, 21, 6.5, 6.5, MD, [M]); ell(g, 20, 21, 5, 5, E); eyes = { x: 20, y: 12, span: 4 }; mouth = { x: 20, y: 30, w: 6 }; top = { x: 20, y: 10 }; legs = { y: 33, xs: [15, 25] }; break; }
        case 'chain': for (let i = 0; i < 4; i++) { const cx = 9 + i * 7, cy = 21 + (i % 2 ? -2 : 2); C.handleRing(g, cx, cy, 4.5, 3.5, i % 2 ? M : MD); } eyes = { x: 20, y: 13, span: 3 }; mouth = { x: 20, y: 29, w: 5 }; top = { x: 20, y: 12 }; break;
        case 'clip': for (const [rx, ry] of [[7, 13], [5, 10], [3, 7]]) { ell(g, 20, 20, rx, ry, M); ell(g, 20, 20, rx - 1.2, ry - 1.2, E); } rect(g, 17, 8, 1, 16, E); eyes = { x: 20, y: 16, span: 2 }; mouth = { x: 20, y: 24, w: 3 }; legs = null; noLegs = true; float = true; top = { x: 20, y: 7 }; break;
        case 'block': rrect(g, 10, 14, 20, 16, 3, B); rect(g, 10, 14, 20, 4, A); rect(g, 11, 28, 18, 1, BD); eyes = { x: 20, y: 21, span: 4 }; mouth = { x: 20, y: 26, w: 6 }; top = { x: 20, y: 14 }; arms = [{ x: 10, y: 22, d: -1 }, { x: 30, y: 22, d: 1 }]; legs = { y: 31, xs: [15, 25] }; break;
        case 'card': rrect(g, 7, 11, 26, 17, 2, B); rect(g, 7, 15, 26, 3, A); rrect(g, 10, 20, 5, 4, 1, GO); rect(g, 18, 24, 12, 1, BD); eyes = { x: 24, y: 20, span: 3 }; mouth = { x: 24, y: 25, w: 4 }; top = { x: 20, y: 11 }; arms = [{ x: 7, y: 20, d: -1 }, { x: 33, y: 20, d: 1 }]; legs = { y: 29, xs: [14, 26] }; break;
        case 'coin': ell(g, 20, 20, 12, 12, GO); ell(g, 20, 20, 9.5, 9.5, B); ell(g, 20, 20, 9.5, 9.5, GO, [B]); ell(g, 20, 20, 8.5, 8.5, AL); rect(g, 19, 12, 2, 3, GO); eyes = { x: 20, y: 18, span: 4 }; mouth = { x: 20, y: 24, w: 5 }; top = { x: 20, y: 8 }; legs = { y: 32, xs: [15, 25] }; break;
        case 'disc': ell(g, 20, 20, 13, 13, B); ell(g, 20, 20, 10, 10, BL); ell(g, 20, 20, 6, 6, S); ell(g, 20, 20, 2, 2, E); line(g, 12, 12, 16, 9, PA); eyes = { x: 20, y: 14, span: 4 }; mouth = { x: 20, y: 27, w: 5 }; top = { x: 20, y: 7 }; legs = { y: 33, xs: [15, 25] }; break;
        case 'chip': rrect(g, 8, 13, 24, 15, 1, S); for (let x = 10; x < 31; x += 3) { rect(g, x, 11, 1, 2, GO); rect(g, x, 28, 1, 2, GO); } rrect(g, 15, 16, 10, 9, 1, MD); rect(g, 10, 15, 3, 2, GO); eyes = { x: 20, y: 19, span: 3 }; mouth = { x: 20, y: 23, w: 4 }; top = { x: 20, y: 11 }; arms = [{ x: 8, y: 20, d: -1 }, { x: 32, y: 20, d: 1 }]; legs = { y: 31, xs: [14, 26] }; break;
        case 'ring': ell(g, 20, 24, 11, 9, GO); ell(g, 20, 24, 8, 6, E); poly(g, [[16, 15], [24, 15], [26, 11], [20, 6], [14, 11]], S); line(g, 17, 11, 20, 8, SL); eyes = { x: 20, y: 12, span: 2 }; mouth = { x: 20, y: 31, w: 4 }; arms = [{ x: 9, y: 24, d: -1 }, { x: 31, y: 24, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 6 }; break;
        case 'bandage': rrect(g, 4, 16, 32, 10, 5, B); rrect(g, 14, 16, 12, 10, 1, PA); for (const [x, y] of [[7, 19], [9, 22], [31, 19], [33, 22]]) gset(g, x, y, BD); eyes = { x: 20, y: 19, span: 3 }; mouth = { x: 20, y: 23, w: 4 }; top = { x: 20, y: 16 }; arms = [{ x: 5, y: 21, d: -1 }, { x: 35, y: 21, d: 1 }]; legs = { y: 27, xs: [14, 26] }; break;
        case 'stetho': C.handleRing(g, 20, 11, 9, 7, MD); rect(g, 10, 3, 20, 8, E); ell(g, 11, 4, 1.5, 1.5, M); ell(g, 29, 4, 1.5, 1.5, M); line(g, 20, 18, 20, 22, MD, 2); ell(g, 20, 29, 7, 7, M); ell(g, 20, 29, 5.5, 5.5, BL); eyes = { x: 20, y: 27, span: 3 }; mouth = { x: 20, y: 32, w: 4 }; arms = [{ x: 15, y: 30, d: -1 }, { x: 25, y: 30, d: 1 }]; legs = null; noLegs = true; float = true; top = { x: 20, y: 5 }; break;
        case 'kit': rrect(g, 8, 12, 24, 20, 2, PA); rect(g, 8, 12, 24, 3, B); C.handleRing(g, 20, 11, 4, 3, MD); C.redCross(g, 20, 23); eyes = { x: 14, y: 20, span: 2 }; mouth = { x: 26, y: 28, w: 3 }; top = { x: 20, y: 8 }; arms = [{ x: 8, y: 22, d: -1 }, { x: 32, y: 22, d: 1 }]; legs = { y: 33, xs: [13, 27] }; break;
        case 'scope': line(g, 14, 30, 26, 8, B, 5); rrect(g, 24, 5, 6, 6, 1, MD); ell(g, 13, 31, 2.5, 2, MD); line(g, 20, 20, 13, 35, MD); line(g, 20, 20, 27, 35, MD); line(g, 20, 20, 20, 35, MD); eyes = { x: 21, y: 16, span: 2 }; mouth = { x: 18, y: 22, w: 3 }; arms = [{ x: 17, y: 20, d: -1 }, { x: 23, y: 18, d: 1 }]; legs = null; noLegs = true; top = { x: 27, y: 5 }; break;
        case 'tent': poly(g, [[4, 34], [20, 8], [36, 34]], B); poly(g, [[15, 34], [20, 22], [25, 34]], BD); line(g, 20, 8, 20, 5, MD); line(g, 4, 34, 2, 36, MD); line(g, 36, 34, 38, 36, MD); eyes = { x: 20, y: 17, span: 3 }; mouth = { x: 20, y: 21, w: 4 }; arms = [{ x: 12, y: 25, d: -1 }, { x: 28, y: 25, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 6 }; break;
        case 'fence': for (const x of [7, 14, 21, 28]) { rect(g, x, 12, 5, 23, B); poly(g, [[x, 12], [x + 2.5, 8], [x + 5, 12]], B); } rect(g, 5, 17, 30, 2, BD); rect(g, 5, 27, 30, 2, BD); eyes = { x: 20, y: 21, span: 4 }; mouth = { x: 20, y: 25, w: 5 }; arms = [{ x: 5, y: 22, d: -1 }, { x: 35, y: 22, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 8 }; break;
        case 'knob': rect(g, 11, 8, 8, 26, B); ell(g, 15, 13, 1.5, 2, K); ell(g, 25, 21, 7, 7, GO); ell(g, 25, 21, 5, 5, AL); rect(g, 17, 20, 3, 3, GO); eyes = { x: 25, y: 20, span: 2 }; mouth = { x: 25, y: 24, w: 3 }; arms = [{ x: 18, y: 21, d: -1 }, { x: 32, y: 21, d: 1 }]; legs = null; noLegs = true; top = { x: 25, y: 14 }; break;
        case 'bell': poly(g, [[13, 26], [15, 12], [20, 8], [25, 12], [27, 26]], GO); rect(g, 11, 26, 18, 3, GO); ell(g, 20, 31, 2.5, 2.5, AD); C.handleRing(g, 20, 7, 3, 2.5, MD); eyes = { x: 20, y: 17, span: 3 }; mouth = { x: 20, y: 23, w: 5 }; arms = [{ x: 14, y: 20, d: -1 }, { x: 26, y: 20, d: 1 }]; legs = null; noLegs = true; float = true; top = { x: 20, y: 5 }; break;
        case 'scale': rrect(g, 7, 22, 26, 10, 3, B); ell(g, 20, 17, 8, 8, PA); ell(g, 20, 17, 6.5, 6.5, BL); line(g, 20, 17, 24, 13, TO); rect(g, 7, 22, 26, 1, BL); eyes = { x: 20, y: 26, span: 4 }; mouth = { x: 20, y: 30, w: 5 }; arms = [{ x: 7, y: 26, d: -1 }, { x: 33, y: 26, d: 1 }]; legs = { y: 33, xs: [12, 28] }; top = { x: 20, y: 9 }; break;
        case 'treadmill': line(g, 4, 31, 30, 27, MD, 4); ell(g, 6, 32, 2.5, 2.5, MD); ell(g, 29, 28, 2.5, 2.5, MD); line(g, 27, 27, 31, 8, M, 2); rrect(g, 25, 5, 12, 7, 2, B); rect(g, 27, 7, 7, 2, S); eyes = { x: 31, y: 7, span: 2 }; mouth = { x: 15, y: 27, w: 5 }; arms = [{ x: 27, y: 12, d: -1 }, { x: 37, y: 9, d: 1 }]; legs = null; noLegs = true; top = { x: 31, y: 5 }; break;
        case 'globe': ell(g, 20, 16, 11, 11, S); poly(g, [[13, 10], [19, 8], [21, 13], [16, 18]], A); poly(g, [[22, 18], [28, 16], [27, 23], [23, 24]], A); C.handleRing(g, 20, 16, 13, 13, MD); rect(g, 5, 4, 30, 6, E); rect(g, 19, 29, 2, 4, MD); rect(g, 13, 33, 14, 2, MD); ell(g, 20, 16, 11, 11, S, [E]); eyes = { x: 20, y: 14, span: 4 }; mouth = { x: 20, y: 21, w: 5 }; arms = [{ x: 8, y: 17, d: -1 }, { x: 32, y: 17, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 5 }; break;
        case 'grater': poly(g, [[14, 8], [26, 8], [30, 34], [10, 34]], M); for (let y = 12; y < 32; y += 3) for (let x = 14; x < 27; x += 3) gset(g, x, y, MD); C.handleRing(g, 20, 7, 4, 3, A); eyes = { x: 20, y: 17, span: 3 }; mouth = { x: 20, y: 25, w: 5 }; arms = [{ x: 12, y: 21, d: -1 }, { x: 28, y: 21, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 4 }; break;
        case 'clamp': rect(g, 9, 8, 4, 26, M); rect(g, 9, 8, 16, 4, M); rect(g, 9, 30, 16, 4, M); line(g, 21, 12, 21, 26, MD, 2); rect(g, 17, 26, 9, 3, MD); rect(g, 19, 4, 5, 4, A); eyes = { x: 17, y: 18, span: 2 }; mouth = { x: 17, y: 22, w: 3 }; arms = [{ x: 9, y: 20, d: -1 }, { x: 25, y: 20, d: 1 }]; legs = null; noLegs = true; top = { x: 17, y: 8 }; break;
        case 'cassette': rrect(g, 6, 12, 28, 18, 2, B); rect(g, 9, 14, 22, 5, PA); C.handleRing(g, 15, 22, 3, 3, MD); C.handleRing(g, 25, 22, 3, 3, MD); rect(g, 13, 26, 14, 3, BD); eyes = { x: 20, y: 16, span: 4 }; mouth = { x: 20, y: 27, w: 5 }; top = { x: 20, y: 12 }; arms = [{ x: 6, y: 21, d: -1 }, { x: 34, y: 21, d: 1 }]; legs = { y: 31, xs: [13, 27] }; break;
        default: rrect(g, 11, 13, 18, 18, 4, B); eyes = { x: 20, y: 20, span: 3 }; mouth = { x: 20, y: 25, w: 5 };
      }
      return { eyes, mouth, arms, legs, noLegs, float, top, rigid: true };
    },
    // v0.4.5: prepared food and pantry items (before, every unlisted meal borrowed the burger body)
    meal(g, p, v) {
      const k = p.kind;
      let eyes = { x: 20, y: 22, span: 3 }, mouth = { x: 20, y: 27, w: 5 }, arms = [{ x: 9, y: 24, d: -1 }, { x: 31, y: 24, d: 1 }], legs = { y: 34, xs: [15, 25] }, noLegs = false, float = false, top = { x: 20, y: 10 };
      switch (k) {
        case 'bowl': {
          const f = p.fill || 'rice', fc = f === 'salad' ? S : f === 'noodles' || f === 'cereal' ? GO : f === 'beans' ? AD : PA;
          ell(g, 20, 20, 12, 5, fc); ell(g, 20, 17, 8, 4, fc);
          if (f === 'noodles') { for (let i = 0; i < 5; i++) line(g, 11 + i * 4, 15 + (i % 2), 13 + i * 4, 21, AL); line(g, 26, 9, 30, 20, AD); line(g, 28, 9, 31, 20, AD); }
          if (f === 'rice') for (let i = 0; i < 6; i++) gset(g, 14 + i * 2.5, 17 + (i % 2) * 2, A);
          if (f === 'cereal' || f === 'beans') for (let i = 0; i < 9; i++) ell(g, 11 + (i * 7) % 19, 16 + (i * 3) % 6, 1.2, 1, f === 'beans' ? BD : AD);
          if (f === 'salad') for (let i = 0; i < 5; i++) ell(g, 12 + i * 4, 16 + (i % 2) * 3, 1.5, 1.5, i % 2 ? TO : SL);
          poly(g, [[6, 21], [34, 21], [30, 31], [10, 31]], B); ell(g, 20, 30, 10, 3, B); rect(g, 6, 21, 29, 2, BL); rect(g, 15, 33, 10, 2, BD);
          eyes = { x: 20, y: 25, span: 4 }; mouth = { x: 20, y: 29, w: 6 }; arms = [{ x: 7, y: 24, d: -1 }, { x: 33, y: 24, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 12 }; break;
        }
        case 'sack': poly(g, [[15, 13], [25, 13], [28, 8], [12, 8]], B); rrect(g, 10, 14, 20, 21, 6, B); rect(g, 14, 12, 12, 2, AD); rrect(g, 13, 21, 14, 8, 1, PA); rect(g, 15, 26, 10, 1, BD);
          eyes = { x: 20, y: 18, span: 3 }; mouth = { x: 20, y: 24, w: 5 }; arms = [{ x: 10, y: 24, d: -1 }, { x: 30, y: 24, d: 1 }]; legs = { y: 35, xs: [15, 25] }; top = { x: 20, y: 8 }; break;
        case 'box': rrect(g, 11, 8, 18, 26, 1, B); rect(g, 11, 8, 18, 5, A); rrect(g, 14, 24, 12, 7, 1, PA); for (let x = 15; x < 25; x += 3) line(g, x, 26, x + 2, 29, GO);
          eyes = { x: 20, y: 16, span: 3 }; mouth = { x: 20, y: 21, w: 5 }; arms = [{ x: 11, y: 20, d: -1 }, { x: 29, y: 20, d: 1 }]; top = { x: 20, y: 8 }; legs = { y: 35, xs: [15, 25] }; break;
        case 'wedge': poly(g, [[4, 32], [36, 32], [36, 13]], B); line(g, 4, 32, 36, 13, BL); line(g, 36, 13, 36, 32, BD); for (const [x, y, r] of [[28, 27, 2], [32, 20, 1.5], [21, 29, 1.5], [33, 29, 1]]) ell(g, x, y, r, r * 0.8, BD);
          eyes = { x: 28, y: 23, span: 3 }; mouth = { x: 27, y: 28, w: 4 }; arms = [{ x: 16, y: 28, d: -1 }, { x: 36, y: 23, d: 1 }]; legs = { y: 33, xs: [14, 30] }; top = { x: 34, y: 13 }; break;
        case 'block': rrect(g, 8, 17, 24, 14, 2, B); rect(g, 8, 17, 24, 3, BL); rect(g, 8, 17, 7, 14, PA); rect(g, 14, 17, 1, 14, BD);
          eyes = { x: 23, y: 23, span: 3 }; mouth = { x: 23, y: 27, w: 4 }; arms = [{ x: 8, y: 24, d: -1 }, { x: 32, y: 24, d: 1 }]; legs = { y: 32, xs: [14, 26] }; top = { x: 20, y: 17 }; break;
        case 'bacon': for (let x = 4; x < 37; x++) { const o = Math.round(Math.sin(x / 3.2) * 2.5); rect(g, x, 17 + o, 1, 10, B); gset(g, x, 20 + o, PA); gset(g, x, 21 + o, PA); gset(g, x, 25 + o, BL); }
          eyes = { x: 20, y: 21, span: 4 }; mouth = { x: 20, y: 25, w: 5 }; arms = [{ x: 5, y: 22, d: -1 }, { x: 35, y: 22, d: 1 }]; legs = { y: 29, xs: [13, 27] }; top = { x: 20, y: 15 }; break;
        case 'steak': ell(g, 20, 23, 14, 10, PA); ell(g, 20, 23, 12.5, 8.5, B); ell(g, 12, 23, 2.5, 3.5, PA); line(g, 12, 18, 12, 28, PA); for (const x of [16, 22, 28]) line(g, x - 3, 30, x + 3, 16, BD);
          eyes = { x: 22, y: 20, span: 3 }; mouth = { x: 22, y: 27, w: 5 }; arms = [{ x: 6, y: 23, d: -1 }, { x: 34, y: 23, d: 1 }]; legs = { y: 33, xs: [15, 25] }; top = { x: 20, y: 13 }; break;
        case 'drumstick': line(g, 24, 26, 33, 34, PA, 3); ell(g, 34, 33, 2, 2, PA); ell(g, 32, 36, 2, 2, PA); ell(g, 17, 19, 11, 10, B); ell(g, 21, 25, 7, 6, B); for (let i = 0; i < 7; i++) gset(g, 10 + (i * 5) % 14, 14 + (i * 3) % 10, BD);
          eyes = { x: 16, y: 18, span: 3 }; mouth = { x: 16, y: 24, w: 5 }; arms = [{ x: 6, y: 20, d: -1 }, { x: 27, y: 18, d: 1 }]; legs = { y: 30, xs: [12, 20] }; top = { x: 17, y: 9 }; break;
        case 'balls': for (const [x, y, r] of [[13, 27, 6], [27, 27, 6], [20, 17, 7.5]]) { ell(g, x, y, r, r, B); gset(g, x - 2, y - 2, BL); gset(g, x + 2, y + 1, BD); gset(g, x - 1, y + 3, BD); }
          eyes = { x: 20, y: 16, span: 3 }; mouth = { x: 20, y: 20, w: 4 }; arms = [{ x: 7, y: 26, d: -1 }, { x: 33, y: 26, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 9 }; break;
        case 'skewer': line(g, 20, 2, 20, 37, AL); rrect(g, 13, 6, 14, 6, 2, S); rrect(g, 11, 13, 18, 13, 3, B); rrect(g, 13, 27, 14, 6, 2, TO);
          eyes = { x: 20, y: 18, span: 3 }; mouth = { x: 20, y: 22, w: 5 }; arms = [{ x: 11, y: 19, d: -1 }, { x: 29, y: 19, d: 1 }]; legs = null; noLegs = true; float = true; top = { x: 20, y: 2 }; break;
        case 'roll': ell(g, 19, 24, 15, 7, B); ell(g, 33, 24, 3.5, 6, BL); ell(g, 33, 24, 2, 3.5, A); for (const x of [10, 16, 22]) line(g, x, 18, x + 3, 30, BD);
          eyes = { x: 18, y: 22, span: 3 }; mouth = { x: 18, y: 27, w: 5 }; arms = [{ x: 5, y: 24, d: -1 }, { x: 35, y: 24, d: 1 }]; legs = { y: 31, xs: [13, 25] }; top = { x: 19, y: 17 }; break;
        case 'slab': rect(g, 7, 14, 26, 3, GO); for (let x = 8; x < 33; x += 4) ell(g, x, 14, 1.8, 1.2, GO); rect(g, 7, 17, 26, 4, B); rect(g, 7, 21, 26, 2, PA); rect(g, 7, 23, 26, 4, BD); rect(g, 7, 27, 26, 2, PA); rect(g, 7, 29, 26, 4, B);
          eyes = { x: 20, y: 24, span: 4 }; mouth = { x: 20, y: 31, w: 6 }; arms = [{ x: 7, y: 24, d: -1 }, { x: 33, y: 24, d: 1 }]; legs = { y: 34, xs: [13, 27] }; top = { x: 20, y: 13 }; break;
        case 'fillet': ell(g, 18, 24, 14, 8, B); poly(g, [[30, 24], [37, 18], [37, 30]], B); for (const x of [10, 16, 22, 28]) line(g, x, 18, x - 2, 30, BL);
          eyes = { x: 15, y: 22, span: 3 }; mouth = { x: 15, y: 27, w: 5 }; arms = [{ x: 5, y: 24, d: -1 }, { x: 31, y: 22, d: 1 }]; legs = { y: 32, xs: [12, 24] }; top = { x: 18, y: 16 }; break;
        case 'shrimp': ell(g, 19, 21, 12, 11, B); ell(g, 21, 24, 5.5, 5.5, E); rect(g, 21, 24, 15, 14, E); for (let a = 0.6; a < 4; a += 0.7) line(g, 19 + Math.cos(a + 2.4) * 6, 21 - Math.sin(a + 2.4) * 6, 19 + Math.cos(a + 2.4) * 11, 21 - Math.sin(a + 2.4) * 11, BD);
          poly(g, [[22, 30], [30, 27], [31, 35]], B); line(g, 10, 12, 4, 6, TO); line(g, 12, 11, 8, 4, TO);
          eyes = { x: 14, y: 16, span: 3 }; mouth = { x: 13, y: 22, w: 3 }; arms = [{ x: 8, y: 22, d: -1 }, { x: 31, y: 20, d: 1 }]; legs = null; noLegs = true; float = true; top = { x: 16, y: 10 }; break;
        case 'shell': ell(g, 20, 14, 13, 6, B); ell(g, 20, 26, 14, 8, B); ell(g, 20, 22, 10, 3.5, BL); ell(g, 20, 21, 2.5, 2.5, PA); for (const x of [10, 15, 25, 30]) { line(g, 20, 33, x, 27, BD); line(g, 20, 9, x, 13, BD); }
          eyes = { x: 20, y: 27, span: 4 }; mouth = { x: 20, y: 31, w: 4 }; arms = [{ x: 6, y: 25, d: -1 }, { x: 34, y: 25, d: 1 }]; legs = null; noLegs = true; top = { x: 20, y: 8 }; break;
        case 'dumpling': ell(g, 20, 28, 15, 12, B); rect(g, 4, 30, 33, 9, E); rect(g, 6, 29, 28, 2, BD); for (let x = 9; x <= 31; x += 4) { ell(g, x, 17 + Math.abs(x - 20) / 3, 1.6, 1.6, BL); gset(g, x + 2, 18 + Math.abs(x - 20) / 3, BD); }
          eyes = { x: 20, y: 23, span: 4 }; mouth = { x: 20, y: 27, w: 6 }; arms = [{ x: 6, y: 26, d: -1 }, { x: 34, y: 26, d: 1 }]; legs = { y: 31, xs: [14, 26] }; top = { x: 20, y: 16 }; break;
        case 'samosa': poly(g, [[20, 8], [36, 33], [4, 33]], B); line(g, 20, 8, 36, 33, BD); line(g, 20, 8, 4, 33, BL); rect(g, 5, 32, 31, 1, BD); for (let i = 0; i < 5; i++) gset(g, 14 + i * 3, 30 - (i % 2), BD);
          eyes = { x: 20, y: 22, span: 3 }; mouth = { x: 20, y: 27, w: 5 }; arms = [{ x: 11, y: 24, d: -1 }, { x: 29, y: 24, d: 1 }]; legs = { y: 34, xs: [13, 27] }; top = { x: 20, y: 8 }; break;
        case 'bun': ell(g, 20, 25, 14, 11, B); rect(g, 4, 33, 33, 6, E); for (const x of [12, 16, 24, 28]) line(g, x, 19, 20, 14, BD); ell(g, 20, 14, 2, 1.5, BD);
          eyes = { x: 20, y: 24, span: 4 }; mouth = { x: 20, y: 29, w: 6 }; arms = [{ x: 6, y: 26, d: -1 }, { x: 34, y: 26, d: 1 }]; legs = { y: 33, xs: [14, 26] }; top = { x: 20, y: 14 }; break;
        case 'nachos': poly(g, [[5, 33], [15, 14], [24, 33]], B); poly(g, [[16, 33], [27, 13], [35, 33]], B); poly(g, [[10, 26], [21, 7], [31, 27]], BL); for (const [x, y] of [[14, 18], [21, 12], [27, 20], [10, 28]]) ell(g, x, y, 2, 1.5, GO); for (const [x, y] of [[18, 22], [25, 28], [30, 25]]) ell(g, x, y, 1.3, 1.3, TO);
          eyes = { x: 21, y: 18, span: 3 }; mouth = { x: 21, y: 23, w: 4 }; arms = [{ x: 8, y: 26, d: -1 }, { x: 33, y: 26, d: 1 }]; legs = { y: 34, xs: [13, 28] }; top = { x: 21, y: 7 }; break;
        case 'toast': ell(g, 14, 14, 6, 5, BD); ell(g, 26, 14, 6, 5, BD); rect(g, 8, 14, 24, 20, BD); ell(g, 14, 14, 4.5, 3.5, B); ell(g, 26, 14, 4.5, 3.5, B); rect(g, 10, 14, 20, 18, B);
          eyes = { x: 20, y: 20, span: 4 }; mouth = { x: 20, y: 26, w: 6 }; arms = [{ x: 8, y: 23, d: -1 }, { x: 32, y: 23, d: 1 }]; legs = { y: 35, xs: [14, 26] }; top = { x: 20, y: 9 }; break;
        case 'stack': for (let i = 0; i < 4; i++) { ell(g, 20, 31 - i * 4, 13, 3, B); line(g, 8, 32 - i * 4, 32, 32 - i * 4, BD); } ell(g, 20, 18, 11, 2.5, GO); rect(g, 10, 18, 2, 6, GO); rect(g, 27, 18, 2, 9, GO); rect(g, 17, 14, 6, 3, PA);
          eyes = { x: 20, y: 24, span: 4 }; mouth = { x: 20, y: 29, w: 6 }; arms = [{ x: 7, y: 26, d: -1 }, { x: 33, y: 26, d: 1 }]; legs = { y: 35, xs: [14, 26] }; top = { x: 20, y: 14 }; break;
        default: ell(g, 20, 23, 12, 9, B);
      }
      return { eyes, mouth, arms, legs, noLegs, float, top };
    },
    handtool(g, p, v) {
      const head = p.head || 'hammer', len = clampi((p.len || 20) + v * 2, 10, 26), hx = 20, hy = 12;
      if (!['blade', 'rollingpin', 'needle', 'ruler', 'cane', 'thermo', 'syringe', 'detector', 'rod', 'club'].includes(head)) { line(g, hx, hy + 2, hx, hy + len + 2, p.metalHandle ? MD : AD, 2); rect(g, hx - 1, hy + len - 4, 3, 6, A); }
      let eyes = { x: hx, y: hy, span: 3 }, mouth = { x: hx, y: hy + 4, w: 5 };
      switch (head) {
        case 'hammer': rrect(g, hx - 9, hy - 4, 16, 7, 1, M); poly(g, [[hx + 7, hy - 4], [hx + 11, hy - 6], [hx + 11, hy - 4], [hx + 7, hy + 2]], M); eyes = { x: hx - 2, y: hy - 2, span: 3 }; mouth = { x: hx - 2, y: hy + 1, w: 5 }; break;
        case 'axe': poly(g, [[hx - 1, hy - 5], [hx - 11, hy - 8], [hx - 12, hy + 4], [hx - 1, hy + 2]], M); rect(g, hx - 1, hy - 6, 3, 9, AD); eyes = { x: hx - 7, y: hy - 3, span: 2 }; mouth = { x: hx - 7, y: hy + 1, w: 4 }; break;
        case 'wrench': C.handleRing(g, hx, hy - 3, 5, 5, M); rect(g, hx - 1, hy - 9, 3, 5, E); line(g, hx, hy + 2, hx, hy + len + 2, M, 3); eyes = { x: hx, y: hy + 6, span: 1 }; mouth = { x: hx, y: hy + 10, w: 3 }; break;
        case 'screwdriver': rrect(g, hx - 3, hy + len - 10, 7, 12, 3, A); line(g, hx, hy - 6, hx, hy + len - 10, M, 2); eyes = { x: hx, y: hy + len - 7, span: 2 }; mouth = { x: hx, y: hy + len - 3, w: 3 }; break;
        case 'saw': poly(g, [[hx - 2, hy - 8], [hx + 10, hy - 6], [hx + 10, hy + 6], [hx - 2, hy + 10]], M); for (let y = hy - 7; y < hy + 10; y += 2) gset(g, hx - 3, y, MD); rrect(g, hx + 8, hy - 7, 7, 13, 2, A); eyes = { x: hx + 3, y: hy - 2, span: 2 }; mouth = { x: hx + 3, y: hy + 3, w: 5 }; break;
        case 'shovel': poly(g, [[hx - 6, hy - 9], [hx + 6, hy - 9], [hx + 5, hy + 2], [hx, hy + 5], [hx - 5, hy + 2]], M); eyes = { x: hx, y: hy - 5, span: 3 }; mouth = { x: hx, y: hy - 1, w: 5 }; break;
        case 'rake': rect(g, hx - 10, hy - 4, 21, 2, M); for (let x = hx - 10; x <= hx + 10; x += 3) rect(g, x, hy - 9, 1, 5, M); rrect(g, hx - 4, hy - 3, 9, 6, 2, A); eyes = { x: hx, y: hy - 1, span: 2 }; mouth = { x: hx, y: hy + 2, w: 4 }; break;
        case 'broom': poly(g, [[hx - 4, hy - 2], [hx + 4, hy - 2], [hx + 9, hy + 10], [hx - 9, hy + 10]], GO); for (let x = hx - 8; x < hx + 9; x += 2) gset(g, x, hy + 10, AD); line(g, hx, hy - 2, hx, hy - 16, AD, 2); eyes = { x: hx, y: hy + 3, span: 3 }; mouth = { x: hx, y: hy + 7, w: 6 }; break;
        case 'mop': for (let x = hx - 7; x <= hx + 7; x += 2) line(g, hx, hy - 2, x, hy + 10, PA, 1); ell(g, hx, hy, 5, 3, PA); line(g, hx, hy - 2, hx, hy - 16, M, 2); eyes = { x: hx, y: hy + 1, span: 3 }; mouth = { x: hx, y: hy + 5, w: 5 }; break;
        case 'pliers': line(g, hx - 6, hy - 8, hx + 2, hy + 8, M, 2); line(g, hx + 6, hy - 8, hx - 2, hy + 8, M, 2); line(g, hx + 2, hy + 8, hx + 4, hy + 20, A, 3); line(g, hx - 2, hy + 8, hx - 4, hy + 20, A, 3); ell(g, hx, hy, 2.5, 2.5, MD); eyes = { x: hx, y: hy + 12, span: 3 }; mouth = { x: hx, y: hy + 16, w: 4 }; break;
        case 'scissors': C.handleRing(g, hx - 5, hy + 12, 4, 4, A); C.handleRing(g, hx + 5, hy + 12, 4, 4, A); line(g, hx - 3, hy + 9, hx + 6, hy - 10, M, 2); line(g, hx + 3, hy + 9, hx - 6, hy - 10, M, 2); ell(g, hx, hy + 4, 1.5, 1.5, MD); eyes = { x: hx, y: hy - 1, span: 3 }; mouth = { x: hx, y: hy + 2, w: 3 }; break;
        case 'brush': rrect(g, hx - 5, hy - 10, 11, 9, 2, PA); rect(g, hx - 5, hy - 2, 11, 3, M); eyes = { x: hx, y: hy - 7, span: 3 }; mouth = { x: hx, y: hy - 4, w: 5 }; break;
        case 'spatula': rrect(g, hx - 5, hy - 10, 11, 12, 2, M); for (let y = hy - 8; y < hy; y += 3) rect(g, hx - 3, y, 7, 1, MD); eyes = { x: hx, y: hy - 6, span: 3 }; mouth = { x: hx, y: hy - 2, w: 5 }; break;
        case 'spoon': ell(g, hx, hy - 5, 5, 7, M); eyes = { x: hx, y: hy - 6, span: 2 }; mouth = { x: hx, y: hy - 2, w: 4 }; break;
        case 'fork': rect(g, hx - 5, hy - 2, 11, 3, M); for (let x = hx - 5; x <= hx + 5; x += 3) rect(g, x, hy - 11, 1, 9, M); eyes = { x: hx, y: hy - 1, span: 2 }; mouth = { x: hx, y: hy + 2, w: 3 }; break;
        case 'knife': poly(g, [[hx - 2, hy + 4], [hx + 3, hy + 4], [hx + 3, hy - 14], [hx - 2, hy - 8]], M); eyes = { x: hx + 1, y: hy - 4, span: 1 }; mouth = { x: hx + 1, y: hy, w: 3 }; break;
        case 'whisk': for (let i = -2; i <= 2; i++) ell(g, hx + i * 1.2, hy - 4, 2 + Math.abs(i) * 1.6, 8, M, [E]); ell(g, hx, hy - 4, 7, 8, E, []); for (let i = -2; i <= 2; i++) { for (let a = 0; a < 6.3; a += 0.25) { const xx = hx + Math.sin(a) * (1.5 + Math.abs(i) * 1.6) * (i < 0 ? -1 : 1), yy = hy - 4 + Math.cos(a) * 8; if (Math.sin(a) >= 0) gset(g, xx, yy, M); } } eyes = { x: hx, y: hy + 9, span: 1 }; mouth = { x: hx, y: hy + 13, w: 3 }; break;
        case 'ladle': ell(g, hx, hy - 4, 6, 5, M); rect(g, hx - 6, hy - 9, 13, 5, E); eyes = { x: hx, y: hy - 3, span: 3 }; mouth = { x: hx, y: hy, w: 5 }; break;
        case 'blade': poly(g, [[hx - 2, 34], [hx + 2, 34], [hx + 2, 8], [hx, 3], [hx - 2, 8]], M); rect(g, hx - 6, 26, 13, 2, GO); rect(g, hx - 1, 28, 3, 7, AD); eyes = { x: hx, y: 13, span: 1 }; mouth = { x: hx, y: 18, w: 3 }; break;
        case 'pen': poly(g, [[hx - 2, hy - 8], [hx + 2, hy - 8], [hx + 2, hy + 18], [hx, hy + 22], [hx - 2, hy + 18]], B); rect(g, hx - 2, hy - 8, 4, 4, A); rect(g, hx + 3, hy - 7, 1, 8, M); eyes = { x: hx, y: hy + 1, span: 1 }; mouth = { x: hx, y: hy + 5, w: 3 }; break;
        case 'bat': poly(g, [[hx - 1, 35], [hx + 1, 35], [hx + 4, 4], [hx - 4, 4]], AD); ell(g, hx, 5, 4, 2, AD); eyes = { x: hx, y: 10, span: 2 }; mouth = { x: hx, y: 15, w: 4 }; break;
        case 'racket': C.handleRing(g, hx, hy - 3, 8, 10, A); for (let x = hx - 6; x <= hx + 6; x += 2) line(g, x, hy - 11, x, hy + 5, M); for (let y = hy - 11; y <= hy + 5; y += 2) line(g, hx - 6, y, hx + 6, y, M); ell(g, hx, hy - 3, 4, 4, A); eyes = { x: hx, y: hy - 4, span: 2 }; mouth = { x: hx, y: hy - 1, w: 3 }; break;
        case 'drill': rrect(g, hx - 10, hy - 6, 18, 9, 3, B); rect(g, hx - 15, hy - 3, 5, 3, M); line(g, hx - 15, hy - 2, hx - 19, hy - 2, MD); rrect(g, hx - 1, hy + 2, 7, 14, 2, B); rect(g, hx - 1, hy + 16, 9, 4, BD); rect(g, hx + 5, hy + 4, 2, 3, A); eyes = { x: hx - 3, y: hy - 3, span: 3 }; mouth = { x: hx - 3, y: hy + 1, w: 5 }; break;
        case 'tape': C.handleRing(g, hx, hy + 4, 8, 8, B); ell(g, hx, hy + 4, 4, 4, PA); eyes = { x: hx, y: hy + 1, span: 4 }; mouth = { x: hx, y: hy + 9, w: 5 }; break;
        case 'club': line(g, hx + 4, hy - 14, hx - 2, hy + 14, M, 2); rrect(g, hx + 2, hy - 16, 5, 7, 2, A); poly(g, [[hx - 3, hy + 12], [hx + 1, hy + 14], [hx - 1, hy + 20], [hx - 12, hy + 20], [hx - 12, hy + 15]], M); eyes = { x: hx - 6, y: hy + 16, span: 2 }; mouth = { x: hx - 6, y: hy + 19, w: 3 }; break;
        case 'chisel': poly(g, [[hx - 2, hy - 10], [hx + 2, hy - 10], [hx + 2, hy + 2], [hx - 2, hy + 2]], M); rect(g, hx - 2, hy - 11, 4, 1, MD); eyes = { x: hx, y: hy - 5, span: 1 }; mouth = { x: hx, y: hy - 1, w: 3 }; break;
        case 'crowbar': line(g, hx, hy - 8, hx, hy + 2, M, 2); line(g, hx, hy - 8, hx + 5, hy - 10, M, 2); line(g, hx + 5, hy - 10, hx + 6, hy - 7, M, 2); eyes = { x: hx - 1, y: hy - 3, span: 1 }; mouth = { x: hx, y: hy + 1, w: 2 }; break;
        case 'pickaxe': poly(g, [[hx - 13, hy - 1], [hx - 4, hy - 7], [hx + 4, hy - 7], [hx + 13, hy - 1], [hx + 4, hy - 4], [hx - 4, hy - 4]], M); rect(g, hx - 2, hy - 8, 4, 6, AD); eyes = { x: hx, y: hy - 6, span: 2 }; mouth = { x: hx, y: hy - 2, w: 4 }; break;
        case 'trowel': poly(g, [[hx - 6, hy - 2], [hx + 6, hy - 2], [hx, hy - 14]], M); line(g, hx, hy - 2, hx, hy + 2, MD, 2); eyes = { x: hx, y: hy - 7, span: 2 }; mouth = { x: hx, y: hy - 4, w: 3 }; break;
        case 'roller': rrect(g, hx - 9, hy - 10, 18, 7, 3, B); line(g, hx + 9, hy - 6, hx + 11, hy - 6, MD); line(g, hx + 11, hy - 6, hx, hy + 2, MD); eyes = { x: hx, y: hy - 8, span: 3 }; mouth = { x: hx, y: hy - 5, w: 5 }; break;
        case 'rollingpin': rrect(g, hx - 11, hy - 3, 22, 7, 3, AL); rect(g, hx - 15, hy - 1, 4, 3, AD); rect(g, hx + 11, hy - 1, 4, 3, AD); eyes = { x: hx, y: hy - 1, span: 3 }; mouth = { x: hx, y: hy + 2, w: 5 }; break;
        case 'tongs': line(g, hx - 2, hy + 6, hx - 7, hy - 12, M, 2); line(g, hx + 2, hy + 6, hx + 7, hy - 12, M, 2); rect(g, hx - 8, hy - 13, 3, 2, MD); rect(g, hx + 6, hy - 13, 3, 2, MD); eyes = { x: hx, y: hy - 2, span: 2 }; mouth = { x: hx, y: hy + 2, w: 3 }; break;
        case 'syringe': rrect(g, hx - 3, hy - 8, 7, 18, 1, BL); rect(g, hx - 2, hy, 5, 9, TO); for (let y = hy - 6; y < hy + 9; y += 3) rect(g, hx + 2, y, 2, 1, MD); rect(g, hx - 5, hy + 10, 11, 2, M); line(g, hx, hy - 8, hx, hy - 15, M); eyes = { x: hx, y: hy - 4, span: 1 }; mouth = { x: hx, y: hy - 1, w: 3 }; break;
        case 'thermo': rrect(g, hx - 2, hy - 12, 5, 22, 2, PA); rect(g, hx, hy - 8, 1, 16, TO); ell(g, hx, hy + 11, 3, 3, TO); eyes = { x: hx, y: hy - 6, span: 1 }; mouth = { x: hx, y: hy - 2, w: 2 }; break;
        case 'magnifier': C.handleRing(g, hx, hy - 6, 8, 8, M); ell(g, hx, hy - 6, 6, 6, SL); eyes = { x: hx, y: hy - 7, span: 3 }; mouth = { x: hx, y: hy - 3, w: 4 }; break;
        case 'rod': line(g, hx, hy + 10, hx + 10, hy - 14, AD, 2); line(g, hx + 10, hy - 14, hx + 13, hy + 6, PA); ell(g, hx + 13, hy + 7, 1.5, 1.5, TO); C.handleRing(g, hx - 3, hy + 6, 3, 3, M); eyes = { x: hx + 3, y: hy - 2, span: 1 }; mouth = { x: hx + 3, y: hy + 2, w: 2 }; break;
        case 'paddle': ell(g, hx, hy - 6, 6, 10, AD); eyes = { x: hx, y: hy - 8, span: 3 }; mouth = { x: hx, y: hy - 3, w: 4 }; break;
        case 'cane': line(g, hx, hy - 6, hx, hy + 20, AD, 2); C.handleRing(g, hx - 4, hy - 6, 4, 4, AD); rect(g, hx - 9, hy - 6, 6, 5, E); eyes = { x: hx - 4, y: hy - 9, span: 1 }; mouth = { x: hx, y: hy + 2, w: 2 }; break;
        case 'needle': line(g, hx, hy - 14, hx, hy + 16, M, 1); C.handleRing(g, hx, hy - 12, 1.5, 2.5, M); line(g, hx, hy - 12, hx + 8, hy + 8, TO); eyes = { x: hx + 4, y: hy, span: 1 }; mouth = { x: hx + 5, y: hy + 4, w: 2 }; break;
        case 'ruler': rect(g, hx - 3, hy - 14, 7, 30, AL); for (let y = hy - 12; y < hy + 15; y += 2) rect(g, hx - 3, y, y % 4 ? 2 : 3, 1, AD); eyes = { x: hx + 1, y: hy - 4, span: 1 }; mouth = { x: hx + 1, y: hy, w: 2 }; break;
        case 'detector': ell(g, hx, hy + 14, 8, 3, M); ell(g, hx, hy + 14, 5, 1.5, E); line(g, hx, hy + 12, hx, hy - 6, MD, 2); rrect(g, hx - 4, hy - 9, 9, 6, 2, B); eyes = { x: hx, y: hy - 7, span: 2 }; mouth = { x: hx, y: hy - 4, w: 3 }; break;
        default: rrect(g, hx - 6, hy - 6, 13, 10, 2, M);
      }
      return { eyes, mouth, arms: [], legs: null, noLegs: true, float: true, top: { x: hx, y: 3 }, rigid: true };
    },
  };

  /* ---------- dedicated designs (one bespoke builder per object) ---------- */
  const D = {
    forklift(g) {
      C.mast(g, 8, 3, 32); C.fork(g, 8, 27, 7, -1); rect(g, 0, 28, 1, 1, M);
      rrect(g, 13, 8, 15, 4, 1, MD); line(g, 14, 12, 14, 22, MD); line(g, 27, 12, 27, 22, MD);
      rrect(g, 13, 20, 24, 10, 2, B); rect(g, 31, 15, 7, 7, B); rect(g, 15, 13, 11, 7, S);
      C.wheel(g, 17, 31, 4); C.wheel(g, 32, 31, 3.5); C.light(g, 13, 23);
      return { eyes: { x: 25, y: 23, span: 4 }, mouth: { x: 25, y: 27, w: 8 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 8 }, rigid: true };
    },
    excavator(g) {
      C.track(g, 10, 29, 26, 6); rect(g, 13, 26, 22, 3, MD);
      rrect(g, 12, 16, 22, 11, 2, B); rect(g, 26, 9, 9, 10, B); C.window(g, 28, 11, 5, 5);
      C.arm(g, [[14, 18], [7, 5], [2, 14]], 3, A); C.bucket(g, 0, 15, 1);
      C.stack(g, 18, 16, 3);
      return { eyes: { x: 21, y: 20, span: 4 }, mouth: { x: 21, y: 24, w: 8 }, arms: [], legs: null, noLegs: true, top: { x: 30, y: 9 }, rigid: true };
    },
    bulldozer(g) {
      C.track(g, 9, 28, 27, 7);
      rrect(g, 13, 17, 21, 11, 2, B); rect(g, 22, 8, 11, 10, B); C.window(g, 24, 10, 7, 6);
      line(g, 13, 25, 7, 25, MD, 2); poly(g, [[1, 16], [6, 15], [7, 35], [2, 35]], A); for (let y = 18; y < 34; y += 3) gset(g, 4, y, AD);
      C.stack(g, 16, 17, 4);
      return { eyes: { x: 20, y: 21, span: 4 }, mouth: { x: 20, y: 25, w: 8 }, arms: [], legs: null, noLegs: true, top: { x: 27, y: 8 }, rigid: true };
    },
    tractor(g) {
      rrect(g, 4, 19, 20, 9, 2, B); C.grille(g, 4, 21, 3, 6);
      rect(g, 19, 8, 13, 14, B); C.window(g, 21, 10, 9, 7); rect(g, 18, 7, 15, 2, BD);
      C.stack(g, 10, 19, 6);
      C.wheel(g, 9, 30, 4.5); ell(g, 27, 26, 9, 9, MD); ell(g, 27, 26, 5, 5, A); ell(g, 27, 26, 2, 2, M);
      for (let a = 0; a < 6.28; a += 0.6) gset(g, 27 + Math.cos(a) * 9, 26 + Math.sin(a) * 9, P.OUT);
      return { eyes: { x: 13, y: 22, span: 3 }, mouth: { x: 13, y: 26, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 25, y: 7 }, rigid: true };
    },
    crane(g) {
      C.wheel(g, 9, 32, 3); C.wheel(g, 17, 32, 3); C.wheel(g, 29, 32, 3);
      rrect(g, 4, 24, 32, 7, 1, B); rect(g, 6, 17, 9, 8, B); C.window(g, 8, 19, 5, 4);
      line(g, 18, 23, 36, 3, A, 3); for (let i = 0; i < 6; i++) gset(g, 21 + i * 3, 19 - i * 3, AD);
      line(g, 36, 3, 36, 18, MD); rect(g, 34, 18, 4, 2, M); poly(g, [[35, 20], [37, 20], [36, 23]], M);
      return { eyes: { x: 10, y: 20, span: 2 }, mouth: { x: 18, y: 26, w: 10 }, arms: [], legs: null, noLegs: true, top: { x: 10, y: 17 }, rigid: true };
    },
    steam_locomotive(g) {
      rrect(g, 3, 13, 22, 13, 4, B); ell(g, 5, 19.5, 3, 6, BD); rect(g, 24, 8, 13, 18, A); C.window(g, 27, 11, 6, 5);
      rect(g, 22, 6, 17, 2, AD); C.stack(g, 9, 13, 6); ell(g, 16, 12, 2.5, 2, GO);
      rect(g, 1, 26, 37, 2, MD); poly(g, [[0, 30], [4, 26], [4, 30]], A);
      C.wheel(g, 9, 31, 3.5); C.wheel(g, 17, 31, 3.5); C.wheel(g, 30, 32, 2.5); line(g, 9, 31, 17, 31, M);
      return { eyes: { x: 14, y: 17, span: 3 }, mouth: { x: 14, y: 22, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 14, y: 13 }, rigid: true };
    },
    train(g) {
      poly(g, [[2, 28], [2, 15], [8, 9], [37, 9], [37, 28]], B);
      poly(g, [[4, 16], [9, 11], [14, 11], [14, 17]], S); for (let x = 18; x < 35; x += 6) C.window(g, x, 12, 4, 5);
      rect(g, 2, 21, 35, 2, A); C.light(g, 3, 24); rect(g, 1, 28, 37, 2, MD);
      for (const x of [8, 14, 27, 33]) C.wheel(g, x, 32, 2.5);
      line(g, 22, 9, 26, 3, MD); line(g, 26, 3, 30, 9, MD);
      return { eyes: { x: 9, y: 14, span: 2 }, mouth: { x: 9, y: 24, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 9 }, rigid: true };
    },
    tram(g) {
      rrect(g, 3, 10, 34, 19, 3, B); for (let x = 6; x < 34; x += 7) C.window(g, x, 13, 5, 6); rect(g, 3, 22, 34, 2, A);
      line(g, 14, 10, 20, 2, MD); line(g, 26, 10, 20, 2, MD); rect(g, 10, 1, 20, 1, MD);
      C.wheel(g, 9, 31, 2.5); C.wheel(g, 31, 31, 2.5); rect(g, 1, 29, 38, 1, MD);
      return { eyes: { x: 20, y: 15, span: 7 }, mouth: { x: 20, y: 26, w: 12 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 10 }, rigid: true };
    },
    motorcycle(g) {
      C.wheel(g, 8, 29, 6); C.wheel(g, 32, 29, 6); ell(g, 8, 29, 3.5, 3.5, E); ell(g, 32, 29, 3.5, 3.5, E); gset(g, 8, 29, M); gset(g, 32, 29, M);
      line(g, 8, 29, 13, 16, M, 2); rrect(g, 13, 18, 14, 7, 3, B); rrect(g, 22, 16, 9, 3, 1, K); rect(g, 15, 25, 8, 4, MD); line(g, 27, 25, 32, 29, M, 2);
      line(g, 13, 16, 11, 11, MD, 2); rect(g, 8, 10, 6, 2, MD); ell(g, 10, 15, 2.5, 2.5, G);
      return { eyes: { x: 18, y: 20, span: 3 }, mouth: { x: 18, y: 23, w: 5 }, arms: [], legs: null, noLegs: true, top: { x: 18, y: 16 }, rigid: true };
    },
    scooter(g) {
      C.wheel(g, 8, 31, 3.5); C.wheel(g, 31, 31, 3.5);
      rect(g, 8, 28, 24, 3, B); line(g, 8, 28, 8, 8, MD, 2); rect(g, 4, 7, 9, 2, MD); rrect(g, 4, 11, 8, 8, 3, B);
      return { eyes: { x: 8, y: 14, span: 2 }, mouth: { x: 8, y: 17, w: 4 }, arms: [], legs: null, noLegs: true, top: { x: 8, y: 7 }, rigid: true };
    },
    airplane(g) {
      poly(g, [[16, 18], [30, 6], [33, 7], [24, 19]], A); poly(g, [[16, 22], [30, 33], [33, 32], [24, 21]], A);
      rrect(g, 2, 16, 34, 8, 4, B); poly(g, [[30, 17], [36, 8], [38, 9], [36, 17]], A);
      for (let x = 10; x < 30; x += 4) C.window(g, x, 18, 2, 2); ell(g, 4, 20, 2, 3, S);
      return { eyes: { x: 7, y: 19, span: 2 }, mouth: { x: 6, y: 22, w: 4 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 16 }, rigid: true };
    },
    helicopter(g) {
      rect(g, 2, 5, 36, 1, MD); rect(g, 19, 5, 2, 5, MD);
      ell(g, 16, 18, 11, 8, B); C.window(g, 7, 14, 7, 6); poly(g, [[25, 15], [38, 16], [38, 19], [25, 21]], B); rect(g, 36, 11, 2, 9, A);
      rect(g, 8, 28, 18, 1, MD); line(g, 11, 25, 11, 28, MD); line(g, 22, 25, 22, 28, MD);
      return { eyes: { x: 17, y: 17, span: 3 }, mouth: { x: 17, y: 21, w: 6 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 6 }, rigid: true };
    },
    sailboat(g) {
      ell(g, 20, 34, 18, 2, S); poly(g, [[3, 26], [37, 26], [32, 33], [8, 33]], B); rect(g, 19, 3, 2, 23, MD);
      poly(g, [[21, 4], [33, 24], [21, 24]], PA); poly(g, [[18, 7], [18, 24], [8, 24]], PA);
      return { eyes: { x: 20, y: 28, span: 5 }, mouth: { x: 20, y: 31, w: 8 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 3 }, rigid: true };
    },
    office_chair(g) {
      C.caster(g, 20, 33, 9);
      rrect(g, 12, 3, 16, 16, 4, B); line(g, 20, 18, 20, 21, MD, 2);
      rrect(g, 10, 21, 20, 5, 2, B); rrect(g, 8, 17, 3, 6, 1, MD); rrect(g, 29, 17, 3, 6, 1, MD);
      line(g, 14, 6, 26, 6, BD);
      return { eyes: { x: 20, y: 9, span: 4 }, mouth: { x: 20, y: 14, w: 8 }, arms: [{ x: 9, y: 18, d: -1 }, { x: 31, y: 18, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 3 }, rigid: true };
    },
    electric_fan(g) {
      rect(g, 19, 22, 3, 10, MD); ell(g, 20, 33, 8, 2, MD);
      ell(g, 20, 13, 11, 11, MD); ell(g, 20, 13, 10, 10, E);
      for (let k = 0; k < 3; k++) { const a = k * 2.094; ell(g, 20 + Math.cos(a) * 5, 13 + Math.sin(a) * 5, 4, 3, A); }
      ell(g, 20, 13, 3, 3, B); for (let a = 0; a < 6.28; a += 0.5) gset(g, 20 + Math.cos(a) * 10, 13 + Math.sin(a) * 10, M);
      return { eyes: { x: 20, y: 12, span: 1, forceStyle: 'cyclops' }, mouth: { x: 20, y: 28, w: 4 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 2 }, rigid: true };
    },
    vacuum_cleaner(g) {
      ell(g, 10, 32, 3, 3, MD); rrect(g, 3, 20, 16, 12, 5, B); rect(g, 5, 22, 6, 3, S);
      line(g, 17, 22, 26, 12, MD, 2); line(g, 26, 12, 30, 31, M, 2); rect(g, 26, 31, 11, 3, MD);
      return { eyes: { x: 10, y: 25, span: 3 }, mouth: { x: 10, y: 29, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 10, y: 20 }, rigid: true };
    },
    hair_dryer(g) {
      rrect(g, 4, 8, 26, 12, 6, B); rect(g, 29, 9, 6, 10, MD); for (let y = 10; y < 18; y += 2) rect(g, 30, y, 4, 1, M);
      rrect(g, 10, 18, 8, 15, 3, B); rect(g, 12, 22, 2, 3, A); line(g, 14, 33, 18, 37, P.OUT);
      return { eyes: { x: 16, y: 12, span: 4 }, mouth: { x: 16, y: 16, w: 6 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 16, y: 8 }, rigid: true };
    },
    iron(g) {
      poly(g, [[3, 30], [36, 30], [34, 20], [14, 18]], B); rect(g, 3, 30, 33, 3, M);
      C.handleRing(g, 25, 16, 8, 5, BD); C.dial(g, 25, 25, 2); for (let s = 0; s < 3; s++) gset(g, 8 + s * 3, 34, ST);
      return { eyes: { x: 16, y: 24, span: 3 }, mouth: { x: 16, y: 28, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 25, y: 11 }, rigid: true };
    },
    kettle(g) {
      C.handleRing(g, 20, 9, 9, 6, BD); poly(g, [[9, 33], [31, 33], [28, 12], [12, 12]], B); C.spout(g, 10, 22, -1, 7); rect(g, 9, 33, 22, 2, MD);
      rect(g, 26, 17, 2, 10, S); for (let s = 0; s < 4; s++) gset(g, 3 + (s % 2), 12 - s, ST);
      return { eyes: { x: 19, y: 19, span: 4 }, mouth: { x: 19, y: 26, w: 7 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 3 }, rigid: true };
    },
    blender(g) {
      rrect(g, 11, 27, 18, 8, 2, B); C.dial(g, 20, 31, 2); poly(g, [[12, 27], [28, 27], [30, 6], [10, 6]], S); rect(g, 9, 3, 22, 3, BD);
      C.handleRing(g, 31, 15, 4, 6, BD); line(g, 16, 22, 24, 24, M); rect(g, 13, 14, 14, 8, AL);
      return { eyes: { x: 20, y: 12, span: 4 }, mouth: { x: 20, y: 18, w: 7 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 3 }, rigid: true };
    },
    coffee_machine(g) {
      rrect(g, 6, 4, 26, 30, 2, B); rect(g, 10, 15, 18, 13, BD); rect(g, 17, 15, 4, 3, MD); ell(g, 19, 25, 4, 2.5, PA); rect(g, 15, 25, 8, 3, PA);
      rect(g, 9, 6, 20, 6, MD); rect(g, 11, 8, 6, 2, G); C.dial(g, 24, 9, 1.8); for (let s = 0; s < 3; s++) gset(g, 19, 23 - s, ST);
      return { eyes: { x: 19, y: 8, span: 4 }, mouth: { x: 19, y: 31, w: 8 }, arms: [{ x: 6, y: 18, d: -1 }, { x: 32, y: 18, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 4 }, rigid: true };
    },
    lightbulb(g) {
      ell(g, 20, 15, 11, 11, G); ell(g, 20, 15, 9, 9, B); rect(g, 15, 24, 11, 3, B); for (let y = 27; y < 34; y += 2) rect(g, 15, y, 11, 2, y % 4 ? M : MD); rect(g, 18, 34, 5, 2, MD);
      line(g, 17, 18, 19, 13, GO); line(g, 23, 18, 21, 13, GO);
      return { eyes: { x: 20, y: 12, span: 4 }, mouth: { x: 20, y: 18, w: 6 }, arms: [{ x: 9, y: 16, d: -1 }, { x: 31, y: 16, d: 1 }], legs: null, noLegs: true, float: true, top: { x: 20, y: 4 }, rigid: true };
    },
    headphones(g) {
      C.handleRing(g, 20, 17, 15, 14, MD); rect(g, 3, 17, 34, 19, E);
      rrect(g, 2, 17, 9, 13, 3, B); rrect(g, 29, 17, 9, 13, 3, B); rect(g, 9, 19, 2, 9, A); rect(g, 29, 19, 2, 9, A);
      rrect(g, 13, 2, 14, 4, 2, A);
      return { eyes: { x: 20, y: 12, span: 3 }, mouth: { x: 20, y: 17, w: 5 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 2 }, rigid: true };
    },
    game_controller(g) {
      ell(g, 9, 24, 7, 9, B); ell(g, 31, 24, 7, 9, B); rrect(g, 7, 13, 26, 13, 5, B);
      rect(g, 6, 18, 7, 2, K); rect(g, 8, 16, 2, 6, K); for (const [x, y, c] of [[30, 16, TO], [33, 19, S], [27, 19, GO], [30, 22, AL]]) ell(g, x, y, 1.3, 1.3, c);
      ell(g, 16, 22, 2, 2, MD); ell(g, 24, 22, 2, 2, MD);
      return { eyes: { x: 20, y: 16, span: 3 }, mouth: { x: 20, y: 20, w: 4 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 13 }, rigid: true };
    },
    microphone(g) {
      ell(g, 20, 9, 7, 7, MD); for (let y = 4; y < 15; y += 2) for (let x = 15; x < 26; x += 2) if (gget(g, x, y) === MD) gset(g, x, y, M);
      rect(g, 15, 15, 11, 2, A); poly(g, [[16, 17], [24, 17], [22, 34], [18, 34]], B); rect(g, 19, 25, 2, 3, G);
      return { eyes: { x: 20, y: 20, span: 2 }, mouth: { x: 20, y: 24, w: 3 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 2 }, rigid: true };
    },
    typewriter(g) {
      rrect(g, 4, 18, 32, 15, 2, B); rect(g, 6, 13, 28, 5, MD); rect(g, 9, 4, 22, 10, PA); for (let y = 6; y < 13; y += 2) rect(g, 11, y, 16, 1, MD);
      for (let r = 0; r < 3; r++) for (let x = 7 + r; x < 34; x += 3) ell(g, x, 23 + r * 3, 1, 1, PA);
      return { eyes: { x: 20, y: 7, span: 4 }, mouth: { x: 20, y: 11, w: 8 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 4 }, rigid: true };
    },
    sewing_machine(g) {
      rect(g, 3, 30, 34, 4, BD); rrect(g, 5, 8, 10, 22, 2, B); rrect(g, 5, 7, 29, 8, 3, B); rect(g, 29, 15, 4, 8, B); line(g, 31, 23, 31, 28, M);
      C.dial(g, 8, 10, 2); rect(g, 18, 9, 9, 3, A);
      return { eyes: { x: 22, y: 10, span: 3 }, mouth: { x: 10, y: 22, w: 5 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 7 }, rigid: true };
    },
    ladder(g) {
      line(g, 9, 35, 15, 2, AD, 2); line(g, 31, 35, 25, 2, AD, 2); for (let y = 6; y < 34; y += 5) line(g, 15 - (y - 2) * 0.18, y, 25 + (y - 2) * 0.18, y, A, 2);
      rrect(g, 13, 1, 14, 6, 1, B);
      return { eyes: { x: 20, y: 3, span: 3 }, mouth: { x: 20, y: 5, w: 5 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 1 }, rigid: true };
    },
    wheelbarrow(g) {
      C.wheel(g, 8, 30, 4.5); poly(g, [[4, 15], [30, 15], [26, 27], [9, 27]], B); rect(g, 3, 13, 28, 3, BD);
      line(g, 25, 26, 38, 22, AD, 2); line(g, 22, 27, 24, 35, AD, 2);
      return { eyes: { x: 17, y: 19, span: 4 }, mouth: { x: 17, y: 23, w: 8 }, arms: [], legs: null, noLegs: true, top: { x: 17, y: 13 }, rigid: true };
    },
    watering_can(g) {
      C.handleRing(g, 21, 10, 8, 6, BD); rrect(g, 11, 13, 20, 20, 3, B); poly(g, [[11, 26], [2, 9], [4, 7], [12, 20]], B); rect(g, 0, 6, 5, 3, A);
      return { eyes: { x: 21, y: 19, span: 4 }, mouth: { x: 21, y: 26, w: 7 }, arms: [], legs: null, noLegs: true, top: { x: 21, y: 4 }, rigid: true };
    },
    traffic_cone(g) {
      rect(g, 6, 32, 28, 3, B); poly(g, [[11, 32], [29, 32], [22, 4], [18, 4]], B); paintOn(g, (x, y) => (y > 13 && y < 17) || (y > 22 && y < 26) ? PA : null, [B]);
      return { eyes: { x: 20, y: 19, span: 2 }, mouth: { x: 20, y: 28, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 4 }, rigid: true };
    },
    fire_hydrant(g) {
      rect(g, 10, 32, 20, 3, BD); rrect(g, 13, 13, 14, 19, 2, B); ell(g, 20, 13, 7, 4, B); rect(g, 18, 6, 4, 4, BD);
      rrect(g, 8, 18, 5, 5, 1, BD); rrect(g, 27, 18, 5, 5, 1, BD); ell(g, 20, 21, 3, 3, BD);
      return { eyes: { x: 20, y: 15, span: 3 }, mouth: { x: 20, y: 26, w: 6 }, arms: [{ x: 8, y: 20, d: -1 }, { x: 32, y: 20, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 6 }, rigid: true };
    },
    mailbox(g) {
      rect(g, 18, 22, 4, 13, AD); rrect(g, 6, 8, 26, 14, 6, B); rect(g, 6, 15, 26, 7, B); rect(g, 30, 4, 2, 10, TO); rect(g, 32, 4, 4, 3, TO);
      ell(g, 9, 15, 2, 6, BD);
      return { eyes: { x: 19, y: 13, span: 4 }, mouth: { x: 19, y: 18, w: 7 }, arms: [], legs: null, noLegs: true, top: { x: 19, y: 8 }, rigid: true };
    },
    trophy(g) {
      rect(g, 12, 31, 16, 4, AD); rect(g, 17, 24, 6, 7, GO); poly(g, [[9, 4], [31, 4], [27, 20], [13, 20]], GO); ell(g, 20, 21, 7, 3, GO);
      C.handleRing(g, 8, 10, 4, 5, GO); C.handleRing(g, 32, 10, 4, 5, GO);
      return { eyes: { x: 20, y: 9, span: 4 }, mouth: { x: 20, y: 15, w: 7 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 4 }, rigid: true };
    },
    robot(g) {
      rect(g, 13, 30, 5, 5, MD); rect(g, 22, 30, 5, 5, MD); rrect(g, 10, 17, 20, 13, 1, B); C.buttons(g, 14, 23, 3, 3, 0, A);
      rrect(g, 12, 5, 16, 11, 2, B); C.antenna(g, 20, 5, 4); rect(g, 8, 18, 2, 9, MD); rect(g, 30, 18, 2, 9, MD);
      return { eyes: { x: 20, y: 9, span: 4 }, mouth: { x: 20, y: 13, w: 7 }, arms: [{ x: 8, y: 26, d: -1 }, { x: 32, y: 26, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 5 }, rigid: true };
    },
    rubber_duck(g) {
      ell(g, 20, 27, 14, 8, B); ell(g, 13, 14, 8, 7, B); poly(g, [[3, 15], [8, 13], [8, 17]], A); ell(g, 25, 24, 6, 4, BD);
      return { eyes: { x: 13, y: 12, span: 3 }, mouth: { x: 7, y: 16, w: 3 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 13, y: 7 } };
    },
    kite(g) {
      poly(g, [[20, 2], [33, 15], [20, 30], [7, 15]], B); line(g, 20, 2, 20, 30, BD); line(g, 7, 15, 33, 15, BD);
      for (let i = 0; i < 4; i++) { gset(g, 20 + i, 31 + i * 1.3, A); poly(g, [[19 + i * 2, 32 + i], [22 + i * 2, 32 + i], [20 + i * 2, 34 + i]], A); }
      return { eyes: { x: 20, y: 11, span: 4 }, mouth: { x: 20, y: 19, w: 6 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 2 } };
    },
    skateboard(g) {
      rrect(g, 3, 22, 34, 5, 2, B); rect(g, 3, 22, 34, 1, BL); C.wheel(g, 9, 30, 2.5); C.wheel(g, 31, 30, 2.5); rect(g, 7, 27, 4, 1, M); rect(g, 29, 27, 4, 1, M);
      return { eyes: { x: 20, y: 23, span: 5 }, mouth: { x: 20, y: 26, w: 6 }, arms: [{ x: 3, y: 24, d: -1 }, { x: 37, y: 24, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 22 }, rigid: true };
    },
    violin(g) {
      rect(g, 19, 1, 3, 13, AD); ell(g, 20, 2, 2, 2, AD); ell(g, 20, 19, 8, 6, B); ell(g, 20, 29, 10, 7, B); rect(g, 10, 23, 2, 2, E); rect(g, 28, 23, 2, 2, E);
      C.strings(g, 19, 2, 19, 31, 3); rect(g, 16, 31, 8, 1, AD); line(g, 30, 4, 36, 32, M);
      return { eyes: { x: 20, y: 18, span: 4 }, mouth: { x: 20, y: 28, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 1 } };
    },
    harp(g) {
      poly(g, [[8, 34], [12, 34], [12, 6], [8, 4]], AD); poly(g, [[8, 4], [32, 10], [33, 14], [10, 9]], B); line(g, 10, 34, 33, 13, B, 3);
      for (let x = 14; x < 31; x += 3) line(g, x, 9 + (x - 10) * 0.25, x, 34 - (x - 10) * 0.9, PA);
      return { eyes: { x: 20, y: 9, span: 3 }, mouth: { x: 22, y: 25, w: 4 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 4 } };
    },
    accordion(g) {
      rrect(g, 2, 9, 9, 21, 1, B); rrect(g, 29, 9, 9, 21, 1, B); for (let x = 11; x < 29; x += 3) poly(g, [[x, 11], [x + 3, 9], [x + 3, 30], [x, 28]], x % 2 ? A : AD);
      C.keys(g, 3, 12, 7); C.buttons(g, 31, 12, 6, 0, 3, PA);
      return { eyes: { x: 20, y: 16, span: 4 }, mouth: { x: 20, y: 22, w: 7 }, arms: [{ x: 2, y: 20, d: -1 }, { x: 38, y: 20, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 9 } };
    },
    xylophone(g) {
      for (let i = 0; i < 7; i++) rrect(g, 4 + i * 5, 10 + i * 1.5, 4, 18 - i * 2, 1, [TO, A, GO, S, SL, AL, B][i]);
      line(g, 3, 13, 38, 20, MD); line(g, 3, 26, 38, 25, MD); line(g, 28, 4, 34, 13, AD); ell(g, 28, 4, 1.6, 1.6, PA);
      return { eyes: { x: 20, y: 16, span: 5 }, mouth: { x: 20, y: 22, w: 7 }, arms: [], legs: { y: 28, xs: [8, 32] }, top: { x: 20, y: 10 } };
    },
    glasses(g) {
      ell(g, 10, 20, 7, 6, MD); ell(g, 10, 20, 5.5, 4.5, S); ell(g, 30, 20, 7, 6, MD); ell(g, 30, 20, 5.5, 4.5, S); rect(g, 17, 18, 6, 2, MD);
      line(g, 3, 18, 1, 13, MD); line(g, 37, 18, 39, 13, MD);
      return { eyes: { x: 20, y: 20, span: 10 }, mouth: { x: 20, y: 25, w: 6 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 14 }, rigid: true };
    },
    wristwatch(g) {
      rect(g, 15, 1, 10, 9, A); rect(g, 15, 30, 10, 9, A); ell(g, 20, 20, 10, 10, M); ell(g, 20, 20, 8, 8, PA); rect(g, 30, 19, 2, 2, M);
      line(g, 20, 20, 20, 15, K); line(g, 20, 20, 24, 21, K);
      return { eyes: { x: 20, y: 18, span: 4 }, mouth: { x: 20, y: 24, w: 5 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 1 }, rigid: true };
    },
    suitcase(g) {
      C.handleRing(g, 20, 6, 5, 4, MD); rrect(g, 5, 9, 30, 24, 2, B); rect(g, 5, 9, 30, 2, BD); rect(g, 11, 9, 2, 24, BD); rect(g, 27, 9, 2, 24, BD);
      C.wheel(g, 9, 34, 1.6); C.wheel(g, 31, 34, 1.6);
      return { eyes: { x: 20, y: 16, span: 5 }, mouth: { x: 20, y: 24, w: 8 }, arms: [{ x: 5, y: 20, d: -1 }, { x: 35, y: 20, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 2 }, rigid: true };
    },
    handbag(g) {
      C.handleRing(g, 20, 11, 9, 8, A); rect(g, 10, 12, 21, 8, E); poly(g, [[6, 33], [34, 33], [31, 14], [9, 14]], B); rect(g, 9, 14, 22, 4, BD); rect(g, 18, 16, 4, 3, GO);
      return { eyes: { x: 20, y: 22, span: 5 }, mouth: { x: 20, y: 28, w: 8 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 3 } };
    },
    padlock(g) {
      C.handleRing(g, 20, 13, 8, 9, M); rect(g, 10, 14, 21, 6, E); rrect(g, 7, 17, 26, 18, 3, B); ell(g, 20, 25, 2, 2, K); rect(g, 19, 26, 2, 4, K);
      return { eyes: { x: 20, y: 21, span: 5 }, mouth: { x: 20, y: 31, w: 8 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 4 }, rigid: true };
    },
    lantern(g) {
      C.handleRing(g, 20, 5, 5, 4, MD); rect(g, 12, 7, 16, 4, MD); rect(g, 13, 11, 14, 18, G); rect(g, 15, 13, 10, 14, B); for (const x of [13, 19, 26]) rect(g, x, 11, 1, 18, MD); rect(g, 11, 29, 18, 4, MD);
      return { eyes: { x: 20, y: 17, span: 3 }, mouth: { x: 20, y: 23, w: 5 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 1 }, rigid: true };
    },
    cactus(g) {
      poly(g, [[12, 28], [28, 28], [26, 36], [14, 36]], A); rrect(g, 15, 5, 10, 24, 5, B); rrect(g, 6, 12, 6, 11, 3, B); rect(g, 10, 19, 6, 3, B); rrect(g, 28, 9, 6, 10, 3, B); rect(g, 24, 15, 5, 3, B);
      for (let y = 8; y < 27; y += 4) { gset(g, 14, y, PA); gset(g, 26, y + 2, PA); } ell(g, 20, 5, 2.5, 2, TO);
      return { eyes: { x: 20, y: 13, span: 3 }, mouth: { x: 20, y: 19, w: 5 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 3 } };
    },
    sunflower(g) {
      C.stem(g, 20, 22, 36, S); ell(g, 14, 29, 4, 2, S); ell(g, 26, 27, 4, 2, S);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; ell(g, 20 + Math.cos(a) * 10, 13 + Math.sin(a) * 10, 3, 3, GO); }
      ell(g, 20, 13, 8, 8, AD); for (let i = 0; i < 12; i++) gset(g, 15 + (i * 7) % 11, 9 + (i * 5) % 9, K);
      return { eyes: { x: 20, y: 12, span: 3 }, mouth: { x: 20, y: 16, w: 5 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 1 } };
    },
    palm_tree(g) {
      for (let y = 12; y < 36; y++) rect(g, 18 + Math.round(Math.sin(y / 6) * 2), y, 4, 1, (y % 3) ? A : AD);
      for (const [dx, dy] of [[-14, 4], [-10, -4], [0, -8], [10, -4], [14, 4]]) line(g, 20, 11, 20 + dx, 11 + dy, B, 3);
      ell(g, 17, 14, 2, 2, AD); ell(g, 23, 14, 2, 2, AD);
      return { eyes: { x: 20, y: 22, span: 2 }, mouth: { x: 20, y: 27, w: 3 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 3 } };
    },
    tulip(g) {
      C.stem(g, 20, 18, 36, S); ell(g, 15, 28, 5, 2, S);
      poly(g, [[12, 6], [16, 10], [20, 4], [24, 10], [28, 6], [28, 14], [24, 19], [16, 19], [12, 14]], B);
      return { eyes: { x: 20, y: 11, span: 3 }, mouth: { x: 20, y: 15, w: 5 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 4 } };
    },
    rose(g) {
      C.stem(g, 20, 20, 36, S); for (let y = 24; y < 34; y += 4) gset(g, 18, y, S);
      ell(g, 20, 13, 9, 8, B); for (let a = 0; a < 12; a += 0.3) gset(g, 20 + Math.cos(a) * a * 0.6, 13 + Math.sin(a) * a * 0.5, BD); ell(g, 13, 20, 4, 2, S);
      return { eyes: { x: 20, y: 12, span: 4 }, mouth: { x: 20, y: 17, w: 5 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 5 } };
    },
    egg(g) {
      ell(g, 20, 21, 10, 13, B);
      return { eyes: { x: 20, y: 18, span: 4 }, mouth: { x: 20, y: 25, w: 6 }, arms: [{ x: 10, y: 22, d: -1 }, { x: 30, y: 22, d: 1 }], legs: { y: 34, xs: [16, 24] }, top: { x: 20, y: 8 } };
    },
    fried_egg(g) {
      for (let i = 0; i < 7; i++) { const a = i * 0.9; ell(g, 20 + Math.cos(a) * 8, 24 + Math.sin(a) * 4, 8, 5, PA); } ell(g, 20, 22, 6, 5, GO);
      return { eyes: { x: 20, y: 21, span: 3 }, mouth: { x: 20, y: 29, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 16 } };
    },
    croissant(g) {
      ell(g, 20, 24, 16, 9, B); ell(g, 20, 34, 12, 7, E); for (let x = 9; x < 32; x += 5) line(g, x, 17, x + 2, 28, BD);
      return { eyes: { x: 20, y: 20, span: 4 }, mouth: { x: 20, y: 24, w: 6 }, arms: [{ x: 4, y: 26, d: -1 }, { x: 36, y: 26, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 15 } };
    },
    cupcake(g) {
      poly(g, [[10, 22], [30, 22], [27, 35], [13, 35]], A); C.slats(g, 10, 23, 20, 12, 5, AD);
      ell(g, 20, 19, 12, 6, B); ell(g, 20, 13, 8, 5, B); ell(g, 20, 8, 4, 3, B); ell(g, 21, 3, 2, 2, TO);
      for (let i = 0; i < 6; i++) gset(g, 12 + i * 3, 15 + (i % 2) * 3, [PA, GO, S][i % 3]);
      return { eyes: { x: 20, y: 25, span: 4 }, mouth: { x: 20, y: 30, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 3 } };
    },
    sushi(g) {
      rrect(g, 6, 21, 28, 10, 3, PA); poly(g, [[4, 22], [36, 22], [33, 13], [7, 15]], B); paintOn(g, (x, y) => ((x + y) % 4 === 0 ? BL : null), [B]); rect(g, 17, 14, 6, 17, K);
      return { eyes: { x: 20, y: 25, span: 6 }, mouth: { x: 20, y: 28, w: 6 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 13 } };
    },
    taco(g) {
      ell(g, 20, 26, 16, 12, B); rect(g, 3, 27, 34, 12, E); for (let x = 6; x < 35; x += 3) ell(g, x, 18 + (x % 2), 2, 2, S); for (let x = 8; x < 33; x += 5) gset(g, x, 17, TO);
      ell(g, 20, 27, 16, 9, B); rect(g, 3, 28, 34, 10, E);
      return { eyes: { x: 20, y: 22, span: 4 }, mouth: { x: 20, y: 25, w: 6 }, arms: [{ x: 4, y: 26, d: -1 }, { x: 36, y: 26, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 15 } };
    },
    fries(g) {
      for (let x = 11; x < 30; x += 3) rect(g, x, 4 + (x % 4), 2, 16, GO);
      poly(g, [[9, 15], [31, 15], [28, 35], [12, 35]], B); paintOn(g, (x) => (x % 5 === 0 ? PA : null), [B]);
      return { eyes: { x: 20, y: 21, span: 4 }, mouth: { x: 20, y: 28, w: 7 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 4 } };
    },
    popcorn(g) {
      for (let i = 0; i < 14; i++) ell(g, 11 + (i * 7) % 19, 6 + (i * 5) % 9, 3, 3, PA);
      poly(g, [[9, 13], [31, 13], [28, 35], [12, 35]], B); paintOn(g, (x) => (Math.floor(x / 3) % 2 === 0 ? W : null), [B]);
      return { eyes: { x: 20, y: 19, span: 4 }, mouth: { x: 20, y: 26, w: 7 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 3 } };
    },
    coffee_cup(g) {
      poly(g, [[11, 9], [29, 9], [26, 35], [14, 35]], B); rect(g, 12, 17, 16, 8, A); rrect(g, 9, 5, 22, 4, 1, BD); rect(g, 13, 3, 14, 2, BD);
      return { eyes: { x: 20, y: 19, span: 4 }, mouth: { x: 20, y: 29, w: 6 }, arms: [{ x: 12, y: 22, d: -1 }, { x: 28, y: 22, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 3 } };
    },
    watermelon(g) {
      ell(g, 20, 20, 17, 17, P.SEC); ell(g, 20, 20, 15, 15, PA); ell(g, 20, 20, 13.5, 13.5, B); rect(g, 2, 21, 37, 18, E);
      for (let i = 0; i < 7; i++) gset(g, 10 + i * 3, 13 + (i % 2) * 3, K);
      return { eyes: { x: 20, y: 12, span: 5 }, mouth: { x: 20, y: 17, w: 8 }, arms: [{ x: 4, y: 19, d: -1 }, { x: 36, y: 19, d: 1 }], legs: { y: 21, xs: [13, 27] }, top: { x: 20, y: 3 } };
    },
    penguin(g) {
      ell(g, 20, 21, 11, 14, K); ell(g, 20, 24, 8, 10, W); ell(g, 20, 10, 7, 6, K); ell(g, 20, 11, 4.5, 4, W);
      poly(g, [[18, 13], [22, 13], [20, 16]], GO); rect(g, 13, 34, 5, 2, GO); rect(g, 22, 34, 5, 2, GO);
      return { eyes: { x: 20, y: 10, span: 2 }, mouth: { x: 20, y: 17, w: 3 }, arms: [{ x: 9, y: 21, d: -1 }, { x: 31, y: 21, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 4 } };
    },
    octopus(g) {
      for (let i = 0; i < 6; i++) { const x0 = 9 + i * 4.4; for (let y = 22; y < 36; y++) gset(g, x0 + Math.round(Math.sin(y * 0.5 + i) * 1.5), y, B); for (let y = 22; y < 36; y++) gset(g, x0 + 1 + Math.round(Math.sin(y * 0.5 + i) * 1.5), y, B); }
      ell(g, 20, 14, 12, 11, B); for (let i = 0; i < 6; i++) gset(g, 10 + i * 4, 33, AL);
      return { eyes: { x: 20, y: 13, span: 4 }, mouth: { x: 20, y: 20, w: 5 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 3 } };
    },
    elephant(g) {
      for (const x of [11, 16, 24, 29]) rect(g, x, 26, 4, 9, B);
      ell(g, 22, 22, 13, 9, B); ell(g, 10, 15, 7, 7, B); ell(g, 16, 15, 5, 7, BL); line(g, 5, 18, 3, 30, B, 3); gset(g, 3, 31, B); poly(g, [[7, 20], [9, 21], [5, 25]], PA);
      line(g, 34, 20, 37, 26, B);
      return { eyes: { x: 9, y: 13, span: 2 }, mouth: { x: 9, y: 19, w: 3 }, arms: [], legs: null, noLegs: true, top: { x: 10, y: 8 } };
    },
    giraffe(g) {
      for (const x of [14, 18, 24, 28]) rect(g, x, 25, 2, 10, B);
      ell(g, 21, 22, 10, 5, B); line(g, 14, 19, 9, 6, B, 3); ell(g, 7, 6, 4, 3, B); rect(g, 6, 1, 1, 3, AD); rect(g, 9, 1, 1, 3, AD);
      for (let i = 0; i < 9; i++) ell(g, 13 + (i * 5) % 16, 19 + (i * 3) % 6, 1.3, 1, A, [B]); for (let y = 9; y < 18; y += 3) gset(g, 11 - (y - 9) * 0.3, y, A);
      return { eyes: { x: 7, y: 5, span: 2 }, mouth: { x: 5, y: 8, w: 3 }, arms: [], legs: null, noLegs: true, top: { x: 7, y: 2 } };
    },
    bee(g) {
      ell(g, 13, 10, 6, 5, PA); ell(g, 25, 10, 6, 5, PA);
      ell(g, 20, 21, 12, 9, B); paintOn(g, (x) => (Math.floor((x - 8) / 4) % 2 === 1 ? K : null), [B]); poly(g, [[31, 21], [36, 20], [31, 24]], K);
      line(g, 12, 13, 9, 7, P.OUT); line(g, 16, 12, 15, 6, P.OUT);
      return { eyes: { x: 14, y: 20, span: 3 }, mouth: { x: 14, y: 25, w: 4 }, arms: [], legs: { y: 30, xs: [15, 20, 25] }, float: true, top: { x: 20, y: 12 } };
    },
    ladybug(g) {
      for (let i = 0; i < 3; i++) { line(g, 9, 20 + i * 5, 3, 18 + i * 6, P.OUT); line(g, 31, 20 + i * 5, 37, 18 + i * 6, P.OUT); }
      ell(g, 20, 11, 6, 4, K); ell(g, 20, 23, 12, 11, B); line(g, 20, 13, 20, 34, K);
      for (const [x, y] of [[14, 19], [26, 19], [13, 27], [27, 27], [20, 31]]) ell(g, x, y, 2, 2, K);
      return { eyes: { x: 20, y: 10, span: 3 }, mouth: { x: 20, y: 25, w: 4 }, arms: [], legs: null, noLegs: true, top: { x: 20, y: 7 } };
    },
    caterpillar(g) {
      for (let i = 0; i < 6; i++) ell(g, 32 - i * 5, 28 - Math.round(Math.sin(i * 0.9) * 2), 4, 4, i % 2 ? B : BL);
      ell(g, 6, 22, 5.5, 5.5, B); line(g, 4, 17, 2, 12, P.OUT); line(g, 8, 17, 10, 12, P.OUT);
      return { eyes: { x: 6, y: 21, span: 2 }, mouth: { x: 6, y: 25, w: 3 }, arms: [], legs: { y: 32, xs: [12, 17, 22, 27, 32] }, top: { x: 6, y: 16 } };
    },
    jeans(g) {
      rect(g, 10, 4, 20, 3, AD); for (let x = 12; x < 29; x += 4) gset(g, x, 5, GO);
      poly(g, [[10, 7], [30, 7], [32, 35], [22, 35], [20, 16], [18, 35], [8, 35]], B);
      line(g, 20, 8, 20, 15, BD); line(g, 13, 9, 15, 12, BD); line(g, 27, 9, 25, 12, BD);
      return { eyes: { x: 20, y: 10, span: 4 }, mouth: { x: 20, y: 14, w: 5 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 4 } };
    },
    dumbbell(g) {
      rect(g, 8, 18, 24, 4, M);
      for (const x of [4, 30]) { rrect(g, x, 10, 6, 20, 2, B); rrect(g, x + (x < 20 ? 5 : -2), 13, 3, 14, 1, BD); }
      return { eyes: { x: 7, y: 15, span: 1 }, mouth: { x: 7, y: 22, w: 3 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 10 }, rigid: true };
    },
    dragonfly(g) {
      ell(g, 11, 13, 9, 3, SL); ell(g, 29, 13, 9, 3, SL); ell(g, 11, 19, 8, 2.5, SL); ell(g, 29, 19, 8, 2.5, SL);
      ell(g, 20, 10, 4, 4, B); for (let y = 13; y < 36; y++) rect(g, 19, y, 2 + (y < 20 ? 1 : 0), 1, B);
      return { eyes: { x: 20, y: 9, span: 2 }, mouth: { x: 20, y: 12, w: 3 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 6 } };
    },
  };
  /* ---------- v0.6.0: object-specific designs (owner's catalogue sprite review), keyed by object id ---------- */
  const X = {};
  /* X-BEGIN */
  // anchors: creatures (soft: rarity may add wings/spikes) and objects (rigid)
  const AN = (ex, ey, span, mx, my, mw, tx, ty, extra) => ({ eyes: { x: ex, y: ey, span }, mouth: { x: mx, y: my, w: mw }, arms: [], legs: null, noLegs: true, top: { x: tx == null ? ex : tx, y: ty == null ? ey - 6 : ty }, ...extra });
  const RG = (ex, ey, span, mx, my, mw, tx, ty, extra) => AN(ex, ey, span, mx, my, mw, tx, ty, { rigid: true, ...extra });
  const tri = (g, a, b, c, col) => poly(g, [a, b, c], col);
  const dots = (g, pts, col) => { for (const [x, y] of pts) gset(g, x, y, col); };
  // side-view four-legged animal facing left. Returns anchors on the head.
  function quad(g, o) {
    const x = o.x || 22, y = o.y || 24, rx = o.rx || 10, ry = o.ry || 6, lh = o.lh || 7, lw = o.lw || 2, foot = o.foot || BD;
    const hx = o.hx || x - rx - 1, hy = o.hy || y - ry - 2, hrx = o.hrx || 5, hry = o.hry || 4.5, yl = y + ry - 2;
    const lx = o.legx || [x - rx + 2, x + rx - 5];
    for (const l of lx) { rect(g, l + 2, yl, lw, lh, BD); rect(g, l + 2, yl + lh - 1, lw, 1, foot); }
    if (o.tail) o.tail(g, x + rx - 1, y - ry + 2);
    ell(g, x, y, rx, ry, B);
    if (o.belly) ell(g, x, y + ry * 0.45, rx * 0.75, ry * 0.45, o.belly, [B]);
    for (const l of lx) { rect(g, l, yl, lw + (o.thick ? 1 : 0), lh + 1, B); rect(g, l, yl + lh, lw + (o.thick ? 1 : 0), 1, foot); }
    if (o.neck !== false) poly(g, [[x - rx + 3, y - ry + 1], [hx + 1, hy - 1], [hx + hrx - 1, hy + hry - 1], [x - rx + 5, y + 1]], B);
    ell(g, hx, hy, hrx, hry, B);
    const sl = o.snout == null ? 3 : o.snout, sy = hy + (o.sy == null ? 1.5 : o.sy);
    if (sl > 0) ell(g, hx - hrx + 1 - sl / 2, sy, sl / 2 + 1.5, o.sh || 2.2, o.muzzle || B);
    const nx = Math.round(hx - hrx - sl + 1); if (o.nose !== false) gset(g, nx, Math.round(sy) - 1, K);
    const ear = o.ears;
    if (ear === 'pointy') { tri(g, [hx - 1, hy - hry + 2], [hx + 1, hy - hry - 4], [hx + 3, hy - hry + 2], B); gset(g, hx + 1, hy - hry - 1, AL); }
    if (ear === 'tall') { tri(g, [hx - 1, hy - hry + 2], [hx + 1, hy - hry - 6], [hx + 3, hy - hry + 2], B); line(g, hx + 1, hy - hry - 3, hx + 1, hy - hry + 1, AL); }
    if (ear === 'round') ell(g, hx + 2, hy - hry, 2, 2, B);
    if (ear === 'floppy') ell(g, hx + 3, hy + 1, 2, 4, BD);
    if (ear === 'long') ell(g, hx + 3, hy - hry - 3, 1.6, 4.5, B);
    if (ear === 'small') ell(g, hx + 2, hy - hry + 0.5, 1.4, 1.4, B);
    if (o.feat) o.feat(g, { x, y, rx, ry, hx, hy, hrx, hry, nx, sy, yl, lh });
    return AN(hx, hy - 1, 2, Math.max(3, Math.round(hx - hrx + (sl > 2 ? 0 : 2))), Math.round(sy + 1), 3, hx, hy - hry - 2);
  }
  // upright animal (apes, kangaroo, meerkat-like): body + head, arms drawn by the builder
  function upright(g, o) {
    const x = o.x || 20, by = o.by || 25, brx = o.brx || 8, bry = o.bry || 9, hy = o.hy || 11, hr = o.hr || 7;
    if (o.back) o.back(g);
    ell(g, x, by, brx, bry, B);
    if (o.belly) ell(g, x, by + 1, brx * 0.6, bry * 0.7, o.belly, [B]);
    ell(g, x, hy, hr, hr * 0.92, B);
    if (o.mask) ell(g, x, hy + 1.5, hr * 0.75, hr * 0.62, o.mask, [B]);
    if (o.feat) o.feat(g, { x, by, brx, bry, hy, hr });
    return AN(x, hy, Math.max(2, Math.round(hr / 3)), x, Math.round(hy + hr * 0.55), 3, x, hy - hr);
  }
  const bushTail = (len = 7, up = 4, col = B) => (g, x, y) => { ell(g, x + len / 2 + 1, y - up / 2, len / 2 + 0.5, 3.5, col); };
  const thinTail = (dx = 6, dy = 5, col = B) => (g, x, y) => line(g, x, y, x + dx, y + dy, col);
  const upTail = (h = 7, col = B) => (g, x, y) => { line(g, x, y, x + 3, y - h, col, 2); };
  /* --- pets and wild animals --- */
  const dog = (o) => (g) => quad(g, { x: 22, y: 23, rx: 10, ry: 6, lh: 8, hx: 10, hy: 14, hrx: 5, hry: 4.5, snout: 4, ears: 'pointy', tail: upTail(6), ...o });
  X.cat = g => quad(g, { x: 23, y: 25, rx: 9, ry: 5.5, lh: 7, hx: 11, hy: 17, hrx: 5.5, hry: 5, snout: 1, ears: 'pointy', tail: (g, x, y) => { line(g, x, y, x + 4, y - 4, B, 2); line(g, x + 4, y - 4, x + 3, y - 10, B, 2); },
    feat: (g, a) => { for (const d of [-1, 1]) line(g, a.hx - 6, a.sy + d, a.hx - 9, a.sy + d * 2, PA); } });
  X.x_kitten_cat = g => quad(g, { x: 23, y: 27, rx: 7, ry: 5, lh: 5, hx: 13, hy: 19, hrx: 6.5, hry: 6, snout: 1, ears: 'pointy', tail: (g, x, y) => line(g, x, y, x + 3, y - 7, B, 2),
    feat: (g, a) => { for (const d of [-1, 1]) line(g, a.hx - 7, a.sy + d, a.hx - 10, a.sy + d * 2, PA); } });
  X.tiger = g => quad(g, { x: 22, y: 24, rx: 11, ry: 6.5, lh: 8, lw: 3, hx: 9, hy: 17, hrx: 6, hry: 5.5, snout: 2, muzzle: PA, ears: 'round', tail: (g, x, y) => { line(g, x, y, x + 5, y + 3, B, 2); line(g, x + 5, y + 3, x + 7, y - 3, B, 2); gset(g, x + 7, y - 4, K); },
    feat: (g, a) => { paintOn(g, (x, y) => (x > a.hx + 3 && (x + Math.floor(y / 3)) % 4 === 0 ? K : null), [B]); line(g, a.hx - 1, a.hy - 4, a.hx + 1, a.hy - 1, K); line(g, a.hx + 3, a.hy - 3, a.hx + 4, a.hy, K); ell(g, a.x, a.y + 3, 7, 2.5, PA, [B]); } });
  X.i_dalmatian = dog({ ears: 'floppy', muzzle: B, tail: thinTail(6, -2), feat: (g, a) => { for (const [x, y] of [[16, 21], [21, 24], [26, 21], [29, 25], [19, 27], [24, 28], [11, 13], [31, 20]]) ell(g, x, y, 1.2, 1, K, [B, BD, BL]); } });
  X.i_doberman = dog({ hy: 13, ears: 'tall', snout: 5, sh: 1.8, tail: (g, x, y) => line(g, x, y, x + 2, y - 2, B, 2), feat: (g, a) => { ell(g, a.hx - 4, a.sy + 1, 3, 1.5, GO, [B]); ell(g, a.x - 5, a.y + 1, 3, 2.5, GO, [B]); for (const l of [a.x - a.rx + 2]) rect(g, l, a.yl + 4, 2, 4, GO); } });
  X.i_german_shepherd = dog({ ears: 'tall', snout: 4, tail: bushTail(8, -2), feat: (g, a) => { ell(g, a.x + 1, a.y - 3, 8, 3.5, K, [B]); ell(g, a.hx + 1, a.hy - 1, 3, 2, K, [B]); } });
  X.i_golden_retriever = dog({ ears: 'floppy', snout: 4, tail: (g, x, y) => { for (let i = 0; i < 4; i++) ell(g, x + 2 + i * 2, y + 1 + i, 2, 1.5, B); }, feat: (g, a) => { for (let i = 0; i < 5; i++) gset(g, a.x - 6 + i * 3, a.y + a.ry, B); } });
  X.i_great_dane = dog({ y: 20, lh: 13, rx: 10, ry: 5, hy: 10, hrx: 4.5, hry: 4.5, snout: 5, sh: 2.5, ears: 'tall', tail: thinTail(4, 6) });
  X.i_malamute = dog({ ears: 'pointy', snout: 3, tail: (g, x, y) => { ell(g, x + 1, y - 4, 3, 4, B); ell(g, x + 1, y - 4, 1.5, 2, PA); }, feat: (g, a) => { ell(g, a.hx - 1, a.hy + 2, 4, 2.5, PA, [B]); ell(g, a.x - 1, a.y + 3, 7, 2.5, PA, [B]); line(g, a.hx, a.hy - 4, a.hx, a.hy, PA); } });
  X.i_white_wolf = dog({ ears: 'pointy', snout: 5, sh: 2, tail: bushTail(8, -4), feat: (g, a) => { for (let i = 0; i < 4; i++) gset(g, a.hx + 3 + i, a.hy + 4 + (i % 2), BL); } });
  X.x_wolf_pup = dog({ x: 23, y: 26, rx: 8, ry: 5, lh: 5, hx: 13, hy: 18, hrx: 6, hry: 5.5, snout: 2, ears: 'pointy', tail: bushTail(6, -3) });
  X.fox = dog({ snout: 4, sh: 1.8, ears: 'tall', muzzle: B, tail: (g, x, y) => { ell(g, x + 5, y + 1, 6, 3.5, B); ell(g, x + 10, y + 1, 2, 2.5, PA); }, foot: K, feat: (g, a) => { ell(g, a.hx - 3, a.sy + 1, 4, 1.6, PA, [B]); ell(g, a.x - 4, a.y + 2, 4, 3, PA, [B]); } });
  X.x_jackal = dog({ ears: 'tall', snout: 5, sh: 1.6, lh: 9, tail: bushTail(6, -6), feat: (g, a) => ell(g, a.x + 2, a.y - 3, 7, 2.5, BD, [B]) });
  X.x_hyena = g => quad(g, { x: 23, y: 23, rx: 10, ry: 6, lh: 9, legx: [14, 28], hx: 10, hy: 16, hrx: 5, hry: 4.5, snout: 3, sh: 2.5, ears: 'round', tail: thinTail(3, 7), feat: (g, a) => { for (const [x, y] of [[17, 21], [21, 24], [25, 21], [28, 24], [19, 27]]) ell(g, x, y, 1, 1, K, [B, BD, BL]); for (let i = 0; i < 6; i++) gset(g, a.hx + 4 + i * 2, a.hy - 1 + i * 0.6, K); } });
  X.x_donkey = g => quad(g, { x: 23, y: 22, rx: 10, ry: 6, lh: 10, foot: K, hx: 9, hy: 13, hrx: 4.5, hry: 4, snout: 5, sh: 2.8, muzzle: PA, ears: 'long', tail: (g, x, y) => { line(g, x, y, x + 3, y + 7, B); ell(g, x + 3, y + 8, 1, 2, K); }, feat: (g, a) => ell(g, a.x, a.y + 3, 7, 2.5, PA, [B]) });
  X.goat = g => quad(g, { x: 23, y: 23, rx: 9, ry: 6, lh: 9, foot: K, hx: 10, hy: 14, hrx: 4.5, hry: 4, snout: 4, sh: 2, ears: 'floppy', tail: upTail(3),
    feat: (g, a) => { line(g, a.hx + 1, a.hy - 4, a.hx + 5, a.hy - 8, PA, 2); gset(g, a.hx + 6, a.hy - 7, PA); poly(g, [[a.hx - 5, a.hy + 4], [a.hx - 3, a.hy + 4], [a.hx - 4, a.hy + 9]], PA); } });
  X.x_yak = g => quad(g, { x: 22, y: 23, rx: 12, ry: 8, lh: 6, lw: 3, foot: K, hx: 8, hy: 21, hrx: 5, hry: 4.5, snout: 2, ears: 'small', tail: thinTail(3, 8),
    feat: (g, a) => { for (let i = 0; i < 10; i++) line(g, 11 + i * 2.2, a.y + 4, 11 + i * 2.2, a.y + 9, BD); ell(g, a.x + 2, a.y - 6, 6, 3, B); for (const d of [-1, 1]) { line(g, a.hx + d * 2, a.hy - 4, a.hx + d * 6, a.hy - 6, PA, 2); gset(g, a.hx + d * 6, a.hy - 8, PA); } } });
  X.x_antelope = g => quad(g, { x: 23, y: 22, rx: 9, ry: 5, lh: 11, lw: 1, foot: K, hx: 11, hy: 12, hrx: 4, hry: 3.5, snout: 3, sh: 1.8, ears: 'pointy', tail: thinTail(2, 3), belly: PA,
    feat: (g, a) => { for (const d of [0, 3]) { line(g, a.hx + d - 1, a.hy - 3, a.hx + d + 1, a.hy - 11, K); gset(g, a.hx + d, a.hy - 7, PA); } line(g, a.x - 7, a.y + 1, a.x + 7, a.y + 1, K); } });
  X.x_moose_animal = g => quad(g, { x: 24, y: 21, rx: 10, ry: 6.5, lh: 11, foot: K, hx: 9, hy: 17, hrx: 4.5, hry: 4, snout: 5, sh: 3, ears: 'pointy', tail: thinTail(2, 3),
    feat: (g, a) => { ell(g, a.x - 7, a.y - 6, 5, 3, B); for (const d of [-1, 1]) { ell(g, a.hx + d * 6, a.hy - 7, 4, 2, PA); for (let i = -1; i <= 1; i++) gset(g, a.hx + d * 6 + i * 2, a.hy - 10, PA); } rect(g, a.hx - 4, a.hy + 4, 2, 4, BD); } });
  X.x_reindeer_animal = g => quad(g, { x: 23, y: 22, rx: 10, ry: 6, lh: 10, foot: K, hx: 10, hy: 14, hrx: 4.5, hry: 4, snout: 3, sh: 2, ears: 'pointy', nose: false, tail: upTail(2, PA), belly: PA,
    feat: (g, a) => { gset(g, a.nx, a.sy - 1, TO); gset(g, a.nx + 1, a.sy - 1, TO); for (const d of [0, 3]) { line(g, a.hx + d, a.hy - 4, a.hx + d + 2, a.hy - 13, AD); line(g, a.hx + d + 1, a.hy - 8, a.hx + d - 3, a.hy - 11, AD); line(g, a.hx + d + 2, a.hy - 11, a.hx + d + 5, a.hy - 13, AD); } ell(g, a.hx + 3, a.hy + 5, 3, 3, PA, [B]); } });
  X.x_rhino = g => quad(g, { x: 22, y: 24, rx: 12, ry: 7.5, lh: 6, lw: 4, thick: true, legx: [12, 28], hx: 8, hy: 22, hrx: 6, hry: 5, snout: 2, ears: 'pointy', tail: thinTail(3, 5),
    feat: (g, a) => { tri(g, [a.hx - 6, a.hy - 2], [a.hx - 9, a.hy - 10], [a.hx - 3, a.hy - 3], PA); tri(g, [a.hx - 2, a.hy - 4], [a.hx - 2, a.hy - 8], [a.hx + 1, a.hy - 4], PA); for (let i = 0; i < 3; i++) line(g, 16 + i * 6, a.y - 6, 17 + i * 6, a.y + 4, BD); } });
  X.hippo = g => quad(g, { x: 22, y: 24, rx: 13, ry: 8, lh: 5, lw: 4, thick: true, legx: [12, 28], hx: 8, hy: 19, hrx: 7, hry: 5, snout: 4, sh: 4, sy: 3, ears: 'small', nose: false, tail: thinTail(2, 3),
    feat: (g, a) => { gset(g, a.nx + 1, a.sy - 2, K); gset(g, a.nx + 3, a.sy - 2, K); line(g, a.nx, a.sy + 2, a.hx + 1, a.sy + 2, BD); rect(g, a.nx + 2, a.sy + 2, 1, 2, W); ell(g, a.x, a.y + 4, 9, 3, BL, [B]); } });
  X.x_kangaroo = g => upright(g, { x: 22, by: 25, brx: 7, bry: 9, hy: 10, hr: 4.5, belly: PA,
    back: g => { line(g, 27, 30, 36, 37, B, 3); ell(g, 18, 33, 5, 3, B); rect(g, 12, 35, 9, 2, BD); },
    feat: (g, a) => { ell(g, 17, 11, 3, 2.2, B); gset(g, 15, 10, K); tri(g, [22, 7], [23, 0], [25, 7], B); tri(g, [19, 7], [19, 1], [21, 7], B); line(g, 16, 21, 13, 25, B, 2); ell(g, 21, 28, 3.5, 3, PA, [B, PA]); } });
  X.squirrel = g => upright(g, { x: 17, by: 27, brx: 6, bry: 7, hy: 15, hr: 5.5, belly: PA,
    back: g => { ell(g, 28, 18, 6, 11, B); ell(g, 30, 12, 4, 5, BL); },
    feat: (g, a) => { tri(g, [13, 11], [14, 6], [16, 11], B); tri(g, [18, 11], [20, 6], [21, 11], B); ell(g, 13, 26, 2.5, 2, GO); rect(g, 12, 34, 4, 2, BD); rect(g, 19, 34, 4, 2, BD); } });
  X.x_raccoon = g => quad(g, { x: 22, y: 25, rx: 10, ry: 6, lh: 6, foot: K, hx: 10, hy: 18, hrx: 6, hry: 5, snout: 2, ears: 'pointy', muzzle: PA,
    tail: (g, x, y) => { ell(g, x + 5, y + 1, 6, 3, B); for (const i of [2, 5, 8]) line(g, x + i, y - 2, x + i, y + 4, K); },
    feat: (g, a) => { ell(g, a.hx, a.hy - 0.5, 5, 1.8, K, [B]); ell(g, a.hx, a.hy - 3, 3, 1, PA, [B]); } });
  X.x_skunk = g => quad(g, { x: 23, y: 26, rx: 9, ry: 5.5, lh: 5, foot: K, hx: 12, hy: 21, hrx: 5, hry: 4.5, snout: 2, ears: 'small',
    tail: (g, x, y) => { ell(g, x + 3, y - 8, 4.5, 8, B); ell(g, x + 3, y - 8, 1.6, 7, W); },
    feat: (g, a) => { line(g, a.hx, a.hy - 4, a.x + 8, a.y - 5, W, 2); } });
  X.x_badger = g => quad(g, { x: 22, y: 26, rx: 12, ry: 6, lh: 4, lw: 3, foot: K, hx: 9, hy: 23, hrx: 5.5, hry: 4, snout: 3, ears: 'small', tail: thinTail(3, 1),
    feat: (g, a) => { line(g, a.hx - 6, a.hy - 1, a.hx + 4, a.hy - 2, W, 2); ell(g, a.hx - 1, a.hy + 1, 4, 1, K, [B]); paintOn(g, (x, y) => ((x + y) % 3 === 0 ? BL : null), [B]); } });
  X.x_weasel = g => quad(g, { x: 23, y: 28, rx: 12, ry: 3.5, lh: 4, foot: BD, legx: [13, 31], hx: 9, hy: 24, hrx: 4, hry: 3.5, snout: 2, ears: 'small', belly: PA, tail: (g, x, y) => line(g, x, y + 1, x + 6, y - 2, B, 2) });
  X.x_ferret = g => quad(g, { x: 23, y: 28, rx: 12, ry: 4, lh: 4, legx: [13, 31], foot: K, hx: 9, hy: 24, hrx: 4.5, hry: 3.8, snout: 2, ears: 'small', muzzle: PA, tail: (g, x, y) => line(g, x, y + 1, x + 6, y - 1, BD, 2),
    feat: (g, a) => ell(g, a.hx, a.hy - 0.5, 4, 1.5, K, [B]) });
  X.x_otter = g => quad(g, { x: 22, y: 28, rx: 12, ry: 4.5, lh: 3, lw: 3, legx: [13, 30], hx: 9, hy: 24, hrx: 5, hry: 4, snout: 2, muzzle: PA, ears: 'small', belly: BL, tail: (g, x, y) => poly(g, [[x - 2, y], [x + 8, y + 5], [x - 1, y + 5]], B),
    feat: (g, a) => { for (const d of [-1, 1]) line(g, a.hx - 6, a.sy + d * 0.5, a.hx - 9, a.sy + d, PA); } });
  X.x_mole = g => { ell(g, 22, 28, 12, 7, B); ell(g, 10, 27, 4, 3, B); tri(g, [7, 26], [2, 28], [7, 29], TO); for (const x of [14, 26]) { ell(g, x, 34, 3, 1.5, PA); dots(g, [[x - 2, 35], [x, 36], [x + 2, 35]], PA); }
    return AN(11, 26, 1, 8, 30, 2, 12, 22); };
  X.x_hedgehog = g => { for (let i = 0; i < 14; i++) { const a = Math.PI * (0.05 + i * 0.07), cx = 22 + Math.cos(a) * 10, cy = 27 - Math.sin(a) * 9; tri(g, [22 + Math.cos(a) * 6, 27 - Math.sin(a) * 6], [cx + Math.cos(a) * 4, cy - Math.sin(a) * 4], [22 + Math.cos(a + 0.2) * 7, 27 - Math.sin(a + 0.2) * 7], BD); }
    ell(g, 22, 28, 11, 7, BD); ell(g, 11, 29, 5, 4, PA); tri(g, [8, 28], [3, 30], [8, 31], B); gset(g, 3, 30, K); for (const x of [13, 25]) rect(g, x, 34, 3, 2, B);
    return AN(11, 28, 1, 8, 31, 2, 20, 18); };
  X.x_porcupine = g => { for (let i = 0; i < 16; i++) { const a = Math.PI * (0.02 + i * 0.065); line(g, 22 + Math.cos(a) * 5, 26 - Math.sin(a) * 5, 22 + Math.cos(a) * 15, 26 - Math.sin(a) * 13, i % 2 ? PA : K); }
    ell(g, 22, 27, 10, 7, B); ell(g, 10, 28, 5, 4.5, BD); gset(g, 5, 28, K); for (const x of [13, 26]) rect(g, x, 33, 3, 3, BD);
    return AN(10, 27, 1, 8, 31, 2, 22, 12); };
  X.x_armadillo = g => { ell(g, 22, 25, 11, 8, B); for (let i = 0; i < 6; i++) line(g, 14 + i * 3.2, 18, 14 + i * 3.2, 32, BD);
    ell(g, 9, 27, 4, 3.5, B); tri(g, [6, 25], [1, 30], [7, 30], B); tri(g, [9, 23], [8, 19], [11, 23], B); line(g, 32, 27, 37, 33, B, 2); for (const x of [14, 27]) rect(g, x, 32, 3, 4, B);
    return AN(9, 26, 1, 5, 30, 2, 22, 15); };
  X.x_anteater = g => quad(g, { x: 24, y: 23, rx: 10, ry: 6, lh: 8, lw: 3, foot: K, hx: 12, hy: 20, hrx: 3.5, hry: 3, snout: 9, sh: 1.3, sy: 1.5, ears: 'small',
    tail: (g, x, y) => { ell(g, x + 3, y - 3, 3.5, 6, B); },
    feat: (g, a) => { poly(g, [[a.x - 9, a.y - 2], [a.x + 3, a.y + 2], [a.x - 8, a.y + 1]], K); } });
  X.x_opossum = X.x_possum = g => quad(g, { x: 22, y: 26, rx: 10, ry: 5.5, lh: 5, foot: TO, hx: 10, hy: 21, hrx: 5, hry: 4.5, snout: 4, sh: 1.8, muzzle: W, ears: 'round', nose: false,
    tail: (g, x, y) => { line(g, x, y + 1, x + 6, y + 4, TO); line(g, x + 6, y + 4, x + 7, y - 2, TO); line(g, x + 7, y - 2, x + 5, y - 3, TO); },
    feat: (g, a) => { gset(g, a.nx, a.sy - 1, TO); ell(g, a.hx - 1, a.hy - 1, 3.5, 1.5, W, [B]); } });
  X.x_platypus = g => { poly(g, [[30, 25], [38, 22], [38, 31], [30, 30]], BD); ell(g, 21, 27, 10, 5.5, B); ell(g, 12, 25, 4.5, 4, B);
    rrect(g, 1, 24, 9, 4, 2, K); for (const x of [14, 26]) { rect(g, x, 31, 3, 3, B); rect(g, x - 1, 34, 5, 1, K); }
    return AN(13, 24, 1, 6, 29, 3, 18, 18); };
  X.x_bat_animal = g => { for (const d of [-1, 1]) { poly(g, [[20 + d * 3, 15], [20 + d * 18, 9], [20 + d * 15, 14], [20 + d * 17, 19], [20 + d * 12, 18], [20 + d * 10, 23], [20 + d * 4, 22]], BD); line(g, 20 + d * 4, 16, 20 + d * 16, 10, B); }
    ell(g, 20, 19, 5, 6, B); ell(g, 20, 12, 4.5, 4, B); for (const d of [-1, 1]) tri(g, [20 + d * 1, 9], [20 + d * 4, 3], [20 + d * 4, 10], B); tri(g, [18, 15], [19, 17], [20, 15], W); tri(g, [21, 15], [22, 17], [23, 15], W);
    return AN(20, 12, 2, 20, 15, 3, 20, 4, { float: true }); };
  X.x_mouse = g => quad(g, { x: 23, y: 28, rx: 8, ry: 5, lh: 2, lw: 2, legx: [16, 27], foot: TO, hx: 13, hy: 25, hrx: 5, hry: 4, snout: 3, sh: 1.6, ears: 'round', nose: false,
    tail: (g, x, y) => { line(g, x, y + 3, x + 6, y + 5, TO); line(g, x + 6, y + 5, x + 8, y + 1, TO); }, feat: (g, a) => { ell(g, a.hx + 2, a.hy - 5, 3.5, 3.5, B); ell(g, a.hx + 2, a.hy - 5, 2, 2, TO); gset(g, a.nx, a.sy - 1, TO); for (const d of [-1, 1]) line(g, a.nx + 1, a.sy, a.nx - 3, a.sy + d * 2, PA); } });
  X.x_rat = g => quad(g, { x: 22, y: 27, rx: 10, ry: 5.5, lh: 3, lw: 2, legx: [14, 28], foot: TO, hx: 11, hy: 24, hrx: 4.5, hry: 3.8, snout: 4, sh: 1.5, ears: 'round', nose: false,
    tail: (g, x, y) => { line(g, x, y + 3, x + 6, y + 7, TO); line(g, x + 6, y + 7, x + 9, y + 3, TO); }, feat: (g, a) => { gset(g, a.nx, a.sy - 1, TO); for (const d of [-1, 1]) line(g, a.nx + 1, a.sy, a.nx - 3, a.sy + d * 2, PA); } });
  X.hamster = g => { ell(g, 20, 25, 11, 9, B); ell(g, 20, 28, 8, 6, PA, [B]); ell(g, 11, 26, 3.5, 3, BL); ell(g, 29, 26, 3.5, 3, BL); for (const d of [-1, 1]) { ell(g, 20 + d * 8, 16, 2.5, 2.5, B); ell(g, 20 + d * 8, 16, 1.2, 1.2, TO); }
    gset(g, 20, 25, TO); for (const x of [14, 26]) rect(g, x - 1, 33, 3, 2, TO); ell(g, 20, 31, 2.5, 1.5, GO);
    return AN(20, 22, 4, 20, 27, 3, 20, 14); };
  X.x_guinea_pig_pet = g => { ell(g, 21, 26, 13, 8, B); ell(g, 25, 24, 6, 5, PA, [B]); ell(g, 13, 22, 4, 3, K, [B]); ell(g, 10, 26, 5, 5, B); ell(g, 13, 20, 2.5, 2, BD); for (const x of [12, 28]) rect(g, x, 33, 3, 2, TO);
    return AN(10, 25, 1, 7, 29, 2, 18, 17); };
  X.x_polar_bear_cub = g => quad(g, { x: 23, y: 25, rx: 10, ry: 7, lh: 6, lw: 4, thick: true, legx: [14, 27], foot: K, hx: 11, hy: 19, hrx: 6, hry: 5, snout: 3, sh: 2.2, ears: 'round', tail: (g, x, y) => ell(g, x, y + 2, 2, 2, B) });
  X.wombat = g => quad(g, { x: 22, y: 27, rx: 12, ry: 7, lh: 3, lw: 4, thick: true, legx: [13, 28], foot: K, hx: 10, hy: 25, hrx: 6, hry: 5, snout: 1, sh: 3, ears: 'small', nose: false, tail: null,
    feat: (g, a) => { ell(g, a.hx - 5, a.hy + 1, 2.5, 2, K); } });
  X.i_madagascar_cat = X.x_lemur = g => upright(g, { x: 18, by: 26, brx: 6.5, bry: 7, hy: 15, hr: 5.5, mask: PA,
    back: g => { for (let i = 0; i < 9; i++) ell(g, 28 + Math.sin(i * 0.5) * 2, 33 - i * 3, 2.2, 1.8, i % 2 ? K : PA); },
    feat: (g, a) => { ell(g, 18, 15, 4, 2, K, [B, PA]); tri(g, [13, 12], [12, 8], [15, 11], B); tri(g, [21, 11], [24, 8], [23, 12], B); tri(g, [16, 18], [18, 21], [20, 18], K); for (const x of [14, 21]) rect(g, x, 32, 3, 4, B); line(g, 13, 23, 10, 29, B, 2); line(g, 23, 23, 26, 29, B, 2); } });
  const ape = (o) => (g) => upright(g, { x: 20, by: 26, brx: 8, bry: 8, hy: 13, hr: 6.5, mask: o.mask || PA, ...o,
    feat: (g, a) => { ell(g, a.x - 7, a.hy - 1, 2, 2.5, o.mask || PA); ell(g, a.x + 7, a.hy - 1, 2, 2.5, o.mask || PA);
      const ah = o.armLen || 10; line(g, a.x - a.brx + 1, a.by - 5, a.x - a.brx - 3, a.by - 5 + ah, B, 3); line(g, a.x + a.brx - 1, a.by - 5, a.x + a.brx + 3, a.by - 5 + ah, B, 3);
      rect(g, a.x - 6, a.by + a.bry - 2, 4, 4, B); rect(g, a.x + 2, a.by + a.bry - 2, 4, 4, B); if (o.feat2) o.feat2(g, a); } });
  X.x_chimp = ape({ hr: 6, feat2: (g, a) => { line(g, 17, 18, 23, 18, BD); } });
  X.x_gorilla_ape = ape({ brx: 11, bry: 9, hy: 12, hr: 6, mask: K, armLen: 13, feat2: (g, a) => { ell(g, 20, 6, 4, 2.5, B); ell(g, 20, 25, 6, 5, BD, [B]); } });
  X.x_orangutan_ape = ape({ brx: 9, hr: 6, armLen: 14, feat2: (g, a) => { ell(g, 11, 14, 3, 5, B); ell(g, 29, 14, 3, 5, B); for (let i = 0; i < 6; i++) line(g, 12 + i * 3, 30, 11 + i * 3, 34, BD); } });
  X.x_gibbon = ape({ brx: 6, bry: 7, hy: 13, hr: 5.5, armLen: 17, mask: K, feat2: (g, a) => { ell(g, 20, 12, 6, 6.5, PA, [B]); ell(g, 20, 14, 4, 3.5, K, [B, PA]); } });
  X.x_sloth = X.i_three_toed_sloth = g => { line(g, 2, 6, 38, 6, BD, 2); ell(g, 21, 21, 9, 9, B); for (const x of [13, 29]) { line(g, x, 15, x - (x < 20 ? 2 : -2), 7, B, 3); dots(g, [[x - 2, 5], [x, 5], [x + 2, 5]], PA); }
    ell(g, 21, 21, 5.5, 5, PA, [B]); ell(g, 18, 20, 2.2, 1.6, BD); ell(g, 24, 20, 2.2, 1.6, BD); gset(g, 21, 23, K); for (const x of [15, 27]) line(g, x, 28, x, 34, B, 3);
    return AN(21, 20, 3, 21, 25, 3, 21, 11, { float: true }); };
  X.x_seal = g => { poly(g, [[30, 27], [38, 23], [37, 33], [30, 31]], BD); ell(g, 21, 28, 11, 6, B); ell(g, 11, 22, 6, 5.5, B); ell(g, 7, 24, 3, 2.2, BL); tri(g, [16, 29], [12, 35], [20, 33], BD); gset(g, 5, 23, K); for (const d of [0, 2]) line(g, 6, 25 + d * 0.5, 2, 24 + d, PA);
    return AN(11, 21, 2, 8, 26, 3, 11, 15); };
  X.x_sea_lion = g => { line(g, 18, 26, 9, 12, B, 5); ell(g, 22, 29, 11, 5, B); ell(g, 9, 11, 4.5, 4, B); ell(g, 5, 12, 2.5, 1.8, B); gset(g, 3, 11, K); tri(g, [13, 30], [8, 36], [17, 34], BD); poly(g, [[31, 30], [38, 34], [36, 36], [30, 33]], BD);
    return AN(9, 10, 2, 6, 14, 2, 9, 5); };
  X.x_walrus = g => { ell(g, 22, 26, 13, 9, B); ell(g, 10, 20, 7, 6, B); ell(g, 8, 23, 4, 3, BL); for (const x of [6, 10]) { rect(g, x, 25, 2, 10, PA); gset(g, x, 35, PA); } for (let i = 0; i < 4; i++) gset(g, 5 + i * 2, 24, BD); tri(g, [17, 31], [12, 36], [22, 35], BD);
    paintOn(g, (x, y) => ((x * 3 + y) % 7 === 0 ? BD : null), [B]); return AN(10, 18, 2, 8, 22, 3, 10, 13); };
  X.x_manatee = g => { ell(g, 20, 24, 15, 8, B); ell(g, 37, 24, 2, 5, B); ell(g, 6, 25, 4, 4.5, BL); tri(g, [12, 29], [9, 35], [17, 31], BD); dots(g, [[3, 23], [4, 25], [3, 27]], BD);
    paintOn(g, (x, y) => ((x * 5 + y * 3) % 11 === 0 ? BD : null), [B]); return AN(9, 21, 2, 5, 28, 2, 12, 15, { float: true }); };
  /* --- fish and sea life (side view, facing left) --- */
  function fish(g, o) {
    const x = o.x || 21, y = o.y || 21, rx = o.rx || 11, ry = o.ry || 7;
    if (o.tail !== false) { const t = o.tail || 'fork', tx = x + rx - 2;
      if (t === 'fork') poly(g, [[tx, y], [tx + 8, y - 7], [tx + 6, y], [tx + 8, y + 7]], A);
      if (t === 'fan') poly(g, [[tx, y], [tx + 8, y - 6], [tx + 9, y + 6]], A);
      if (t === 'moon') { poly(g, [[tx, y], [tx + 6, y - 9], [tx + 4, y], [tx + 6, y + 9]], A); }
      if (t === 'veil') { ell(g, tx + 6, y + 2, 6, 8, AL); } }
    if (o.dorsal) poly(g, [[x - rx / 2, y - ry + 1], [x + (o.dorsalX || 0), y - ry - (o.dorsal)], [x + rx / 2, y - ry + 1]], A);
    if (o.belowFin) poly(g, [[x - 2, y + ry - 1], [x + 1, y + ry + o.belowFin], [x + 4, y + ry - 1]], A);
    ell(g, x, y, rx, ry, B);
    if (o.belly !== false) ell(g, x - 1, y + ry * 0.45, rx * 0.8, ry * 0.4, o.belly || BL, [B]);
    tri(g, [x - 2, y + 1], [x + 3, y + 4], [x + 3, y - 1], AD); // pectoral fin
    line(g, x - rx + 5, y - ry + 2, x - rx + 5, y + ry - 2, BD); // gill
    if (o.feat) o.feat(g, { x, y, rx, ry });
    return AN(x - rx + 3, y - 2, 1, x - rx + 2, y + 2, 2, x - 2, y - ry - 2, { float: true });
  }
  X.x_trout = g => fish(g, { rx: 12, ry: 5.5, tail: 'fan', dorsal: 3, feat: (g, a) => { line(g, 11, 21, 31, 21, TO); for (let i = 0; i < 9; i++) gset(g, 12 + i * 2.2, 17 + (i % 3), K); } });
  X.x_catfish = g => fish(g, { rx: 13, ry: 5, y: 23, tail: 'fan', dorsal: 4, dorsalX: -4, belly: PA, feat: (g, a) => { ell(g, 9, 24, 5, 4.5, B); for (const [dx, dy] of [[-5, 4], [-4, 7], [-6, 1]]) line(g, 7, 25, 7 + dx, 25 + dy, K); line(g, 6, 26, 4, 33, K); line(g, 8, 26, 7, 32, K); } });
  X.x_swordfish = g => fish(g, { x: 23, rx: 10, ry: 6, tail: 'moon', dorsal: 8, dorsalX: -5, feat: (g, a) => { line(g, 1, 20, 13, 20, PA, 1); line(g, 3, 21, 13, 21, PA); } });
  X.x_angelfish = g => { poly(g, [[20, 4], [26, 15], [14, 15]], A); poly(g, [[20, 36], [26, 25], [14, 25]], A); poly(g, [[27, 20], [36, 11], [35, 29]], A); ell(g, 20, 20, 9, 8, B);
    for (const x of [17, 22, 27]) line(g, x, 13, x, 27, K); return AN(14, 18, 1, 13, 22, 2, 20, 4, { float: true }); };
  X.x_guppy = g => { ell(g, 30, 20, 8, 10, A); paintOn(g, (x, y) => ((x + y) % 3 === 0 ? AL : null), [A]); ell(g, 16, 20, 9, 4.5, B); tri(g, [16, 16], [22, 13], [24, 17], A); return AN(11, 19, 1, 9, 22, 2, 15, 13, { float: true }); };
  X.x_pufferfish = g => { for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; tri(g, [20 + Math.cos(a) * 9, 20 + Math.sin(a) * 9], [20 + Math.cos(a + 0.1) * 14, 20 + Math.sin(a + 0.1) * 14], [20 + Math.cos(a + 0.3) * 9, 20 + Math.sin(a + 0.3) * 9], PA); }
    ell(g, 20, 20, 11, 11, B); ell(g, 20, 25, 8, 5, PA, [B]); poly(g, [[29, 20], [36, 15], [36, 25]], A); for (const [x, y] of [[16, 13], [22, 12], [26, 16], [14, 17]]) gset(g, x, y, K); return AN(15, 18, 2, 11, 23, 2, 20, 8, { float: true }); };
  X.x_eel = g => { for (let i = 0; i < 30; i++) { const x = 6 + i, y = 22 + Math.sin(i * 0.35) * 5; ell(g, x, y, 2.5, 3 - i * 0.06, B); } for (let i = 0; i < 26; i++) gset(g, 9 + i, 18 + Math.sin((i + 3) * 0.35) * 5, A);
    ell(g, 6, 22, 4, 3.2, B); return AN(6, 21, 1, 3, 24, 2, 8, 15, { float: true }); };
  X.x_seahorse = g => { ell(g, 20, 24, 6, 8, B); for (let i = 0; i < 8; i++) line(g, 15, 18 + i * 2, 21, 18 + i * 2, BD); ell(g, 19, 11, 5, 4.5, B); rect(g, 9, 11, 7, 3, B); ell(g, 22, 6, 2.5, 2, A);
    for (let i = 0; i < 10; i++) gset(g, 22 + Math.round(Math.sin(i * 0.6) * 3), 31 + i * 0.6, B), gset(g, 23 + Math.round(Math.sin(i * 0.6) * 3), 31 + i * 0.6, B); tri(g, [25, 19], [30, 22], [25, 26], A); return AN(20, 10, 1, 11, 13, 2, 20, 4, { float: true }); };
  const ray = (o) => (g) => { poly(g, [[20, 12], [37, 20], [26, 26], [20, 28], [14, 26], [3, 20]], B); ell(g, 20, 21, 4, 4, BL, [B]); line(g, 20, 28, 20, 38, BD); if (o.feat) o.feat(g); return AN(20, 18, 3, 20, 23, 3, 20, 10, { float: true }); };
  X.x_stingray = ray({ feat: g => { gset(g, 20, 34, K); dots(g, [[12, 19], [28, 19], [16, 23], [24, 23]], BD); } });
  X.x_manta_ray = ray({ feat: g => { tri(g, [15, 12], [16, 7], [18, 12], B); tri(g, [22, 12], [24, 7], [25, 12], B); ell(g, 20, 24, 6, 2, W, [B, BL]); } });
  X.i_electric_ray = g => { ell(g, 18, 21, 12, 10, B); poly(g, [[28, 20], [37, 17], [37, 25]], B); line(g, 30, 21, 38, 21, BD); for (const [x, y] of [[13, 8], [20, 6], [27, 8]]) { line(g, x, y, x + 2, y + 2, G); line(g, x + 2, y + 2, x, y + 4, G); }
    return AN(14, 18, 2, 14, 24, 3, 18, 9, { float: true }); };
  const whaleBody = (o) => (g) => { const top = o.top || 13; poly(g, [[3, 22], [6, top + 2], [16, top], [30, top + 4], [33, 20], [27, 27], [10, 29]], B); poly(g, [[31, 19], [38, 12], [36, 20], [38, 27]], B);
    if (o.belly) poly(g, [[4, 23], [10, 28], [27, 26], [24, 23]], o.belly); tri(g, [14, 26], [10, 33], [19, 27], BD); if (o.feat) o.feat(g); return AN(o.ex || 9, o.ey || 19, 1, 6, 24, 3, 18, top - 2, { float: true }); };
  X.whale = whaleBody({ belly: PA, feat: g => { for (let i = 0; i < 4; i++) line(g, 5 + i * 3, 24, 7 + i * 4, 27, BD); dots(g, [[17, 9], [16, 7], [18, 7], [15, 5], [19, 5]], ST); } });
  X.i_grey_whale = whaleBody({ feat: g => { paintOn(g, (x, y) => ((x * 7 + y * 3) % 9 === 0 ? PA : null), [B]); dots(g, [[16, 9], [15, 7], [17, 7]], ST); } });
  X.x_orca = whaleBody({ belly: W, feat: g => { ell(g, 11, 17, 2.5, 1.5, W); tri(g, [18, 14], [21, 4], [24, 15], B); } });
  X.x_narwhal = whaleBody({ belly: PA, feat: g => { line(g, 5, 17, 1, 3, PA, 1); line(g, 6, 17, 2, 3, PA); dots(g, [[2, 7], [3, 11], [4, 14]], BD); paintOn(g, (x, y) => ((x * 5 + y * 3) % 8 === 0 ? BD : null), [B]); } });
  X.x_whale_shark = g => { poly(g, [[3, 21], [8, 13], [28, 15], [33, 20], [28, 26], [8, 28]], B); poly(g, [[31, 20], [38, 10], [36, 20], [38, 30]], B); tri(g, [16, 14], [20, 7], [23, 15], B); rrect(g, 2, 21, 6, 3, 1, K);
    for (let y = 15; y < 27; y += 3) for (let x = 9 + (y % 2) * 2; x < 31; x += 4) gset(g, x, y, PA); return AN(9, 18, 1, 5, 22, 2, 18, 8, { float: true }); };
  X.x_prawn = g => { for (let i = 0; i < 6; i++) ell(g, 13 + i * 3, 21 - Math.sin(i * 0.5) * 4, 3.4 - i * 0.2, 4 - i * 0.2, B); for (let i = 0; i < 6; i++) line(g, 13 + i * 3, 23, 12 + i * 3, 31, BD);
    tri(g, [30, 22], [37, 30], [36, 22], B); line(g, 10, 17, 1, 6, AD); line(g, 11, 17, 4, 4, AD); tri(g, [8, 18], [3, 16], [9, 16], B); return AN(13, 19, 1, 10, 23, 2, 13, 13); };
  X.x_nautilus = g => { ell(g, 22, 21, 12, 12, B); for (let i = 0; i < 6; i++) { const a = i * 0.55; line(g, 22, 21, 22 + Math.cos(a) * 12, 21 - Math.sin(a) * 12, AD); } ell(g, 22, 21, 4, 4, BL);
    for (let i = 0; i < 6; i++) line(g, 10, 22 + i, 3, 25 + i * 2, PA); ell(g, 10, 24, 4, 5, PA); return AN(11, 20, 1, 7, 27, 2, 22, 8, { float: true }); };
  X.i_brain_coral = g => { ell(g, 20, 24, 15, 11, B); for (let k = 0; k < 6; k++) for (let i = 0; i < 26; i++) gset(g, 7 + i, 17 + k * 3 + Math.round(Math.sin(i * 0.9 + k) * 1), BD); rect(g, 6, 33, 28, 3, PA); return RG(20, 22, 5, 20, 28, 6, 20, 12); };
  X.x_coral = g => { const br = (x, y, a, l, d) => { if (d > 3 || l < 2) return; const x2 = x + Math.cos(a) * l, y2 = y - Math.sin(a) * l; line(g, x, y, x2, y2, B, 3 - Math.min(2, d)); br(x2, y2, a + 0.5, l * 0.7, d + 1); br(x2, y2, a - 0.5, l * 0.7, d + 1); };
    br(20, 36, Math.PI / 2, 10, 0); for (const [x, y] of [[9, 8], [31, 8], [14, 5], [26, 5], [20, 9]]) ell(g, x, y, 2, 2, BL); return RG(20, 24, 3, 20, 30, 3, 20, 4); };
  X.x_sea_sponge = g => { rrect(g, 11, 8, 18, 28, 5, B); paintOn(g, (x, y) => ((x * 3 + y * 5) % 7 === 0 ? BD : (x * 2 + y) % 11 === 0 ? BL : null), [B]); ell(g, 20, 9, 6, 2, K); return AN(20, 18, 4, 20, 26, 4, 20, 5); };
  X.x_clam = g => { ell(g, 20, 21, 14, 10, B); rect(g, 5, 22, 30, 15, E); poly(g, [[6, 24], [34, 24], [30, 32], [10, 32]], BD); for (let i = -3; i <= 3; i++) line(g, 20, 30, 20 + i * 4, 13, BL); ell(g, 20, 24, 8, 2, W); gset(g, 20, 24, PA);
    return RG(15, 18, 3, 20, 24, 6, 20, 10); };
  X.x_aquarium = g => { rect(g, 4, 9, 32, 25, SL); rect(g, 3, 8, 34, 2, MD); rect(g, 3, 33, 34, 3, MD); rect(g, 5, 28, 30, 5, PA); for (const x of [9, 12, 29]) line(g, x, 28, x + 1, 19, S, 2);
    ell(g, 20, 20, 5, 3, B); tri(g, [24, 20], [28, 17], [28, 23], B); ell(g, 13, 15, 2.5, 1.5, A); dots(g, [[31, 14], [30, 11], [32, 17]], W); return RG(20, 14, 5, 20, 24, 5, 20, 5); };
  X.x_goldfish_bowl = g => { ell(g, 20, 22, 15, 13, SL); rect(g, 4, 8, 32, 5, E); ell(g, 20, 10, 9, 2, SL); rect(g, 9, 32, 22, 4, E); rect(g, 10, 32, 20, 3, PA); ell(g, 20, 9, 9, 1.5, W);
    ell(g, 19, 22, 5, 3.5, GO); tri(g, [23, 22], [28, 18], [28, 26], GO); dots(g, [[13, 17], [12, 14], [14, 12]], W); return RG(20, 15, 6, 20, 27, 6, 20, 4); };
  /* --- birds (side view, facing left) --- */
  function bird(g, o) {
    const x = o.x || 22, y = o.y || 22, rx = o.rx || 8, ry = o.ry || 6, hx = o.hx || x - rx + 1, hy = o.hy || y - ry - 1, hr = o.hr || 4;
    const ll = o.legs == null ? 6 : o.legs; for (const lx of [x - 2, x + 2]) { line(g, lx, y + ry - 1, lx, y + ry + ll, GO); line(g, lx - 2, y + ry + ll, lx + 1, y + ry + ll, GO); }
    if (o.tail) o.tail(g, x + rx - 1, y); else poly(g, [[x + rx - 3, y - 2], [x + rx + 6, y + 2], [x + rx - 2, y + 4]], BD);
    ell(g, x, y, rx, ry, B); if (o.neck) line(g, x - rx + 3, y - 2, hx + 1, hy + 2, B, o.neckW || 3);
    ell(g, x + 1, y, rx * 0.65, ry * 0.6, BD, [B]); ell(g, hx, hy, hr, hr * 0.95, B);
    const bk = o.beak || 'short', bc = o.beakCol || GO;
    if (bk === 'short') tri(g, [hx - hr + 1, hy - 1], [hx - hr - 3, hy + 1], [hx - hr + 1, hy + 2], bc);
    if (bk === 'hook') { tri(g, [hx - hr + 1, hy - 2], [hx - hr - 3, hy], [hx - hr + 1, hy + 2], bc); gset(g, hx - hr - 3, hy + 1, bc); }
    if (bk === 'long') poly(g, [[hx - hr + 1, hy - 1], [hx - hr - (o.bl || 8), hy + 1], [hx - hr + 1, hy + 2]], bc);
    if (bk === 'pouch') { poly(g, [[hx - hr + 1, hy - 1], [hx - hr - 10, hy], [hx - hr + 1, hy + 1]], bc); ell(g, hx - hr - 4, hy + 3, 5, 2.5, AL); }
    if (bk === 'big') { ell(g, hx - hr - 4, hy + 1, 6, 3, GO); line(g, hx - hr - 9, hy + 1, hx - hr + 1, hy + 1, K); gset(g, hx - hr - 9, hy, TO); }
    if (o.feat) o.feat(g, { x, y, rx, ry, hx, hy, hr });
    return AN(hx, hy - 1, 1, hx - hr, hy + 2, 2, hx, hy - hr - 1);
  }
  X.x_crow = g => bird(g, { legs: 5, beak: 'short', beakCol: K });
  X.x_raven = g => bird(g, { rx: 9, legs: 5, beak: 'hook', beakCol: K, tail: (g, x, y) => poly(g, [[x - 2, y - 2], [x + 9, y + 1], [x + 7, y + 4], [x - 1, y + 4]], BD), feat: (g, a) => dots(g, [[a.hx - 1, a.hy + 3], [a.hx, a.hy + 4]], BD) });
  X.x_eagle = g => bird(g, { rx: 9, ry: 7, hr: 4.5, legs: 4, beak: 'hook', feat: (g, a) => { ell(g, a.hx, a.hy, 4.5, 4.3, W); } });
  X.x_hawk = g => bird(g, { legs: 5, beak: 'hook', feat: (g, a) => { ell(g, a.x - 2, a.y + 2, 4, 3, PA, [B]); for (let i = 0; i < 3; i++) gset(g, a.x - 3 + i * 2, a.y + 2, BD); } });
  X.x_vulture = g => bird(g, { rx: 9, ry: 7, hy: 11, hr: 3.2, neck: true, neckW: 1, legs: 4, beak: 'hook', feat: (g, a) => { ell(g, a.x - 6, a.y - 6, 4, 2.5, W); for (const yy of [a.hy]) gset(g, a.hx, yy - 3, TO); paintOn(g, (x, y) => (Math.hypot(x - a.hx, y - a.hy) < 3.3 ? TO : null), [B, BL, BD]); } });
  X.x_albatross = g => { poly(g, [[22, 18], [1, 13], [3, 16], [20, 22]], B); poly(g, [[24, 18], [39, 11], [37, 15], [25, 22]], B); line(g, 3, 14, 18, 18, K); line(g, 37, 12, 26, 19, K);
    ell(g, 22, 21, 8, 4, W); ell(g, 13, 19, 3.5, 3, W); poly(g, [[10, 19], [4, 21], [10, 21]], GO); tri(g, [29, 20], [35, 22], [29, 23], BD); return AN(13, 18, 1, 9, 21, 2, 13, 14, { float: true }); };
  X.x_pelican = g => bird(g, { rx: 9, ry: 7, y: 25, hy: 12, hr: 3.5, neck: true, beak: 'pouch', legs: 4 });
  X.x_flamingo = g => bird(g, { rx: 7, ry: 5, y: 18, hx: 17, hy: 6, hr: 3, neck: true, neckW: 2, legs: 15, beak: 'short', beakCol: K, feat: (g, a) => { line(g, 14, 9, 13, 14, B, 2); line(g, 13, 14, 16, 16, B, 2); } });
  X.x_stork = X.i_white_stork = g => bird(g, { rx: 8, ry: 5, y: 19, hy: 9, hr: 3, neck: true, neckW: 2, legs: 12, beak: 'long', bl: 8, beakCol: TO, feat: (g, a) => ell(g, a.x + 4, a.y, 5, 4, K, [B, BD]) });
  X.x_crane_bird = g => bird(g, { rx: 8, ry: 5, y: 19, hy: 8, hr: 3, neck: true, neckW: 2, legs: 12, beak: 'long', bl: 6, beakCol: PA, tail: (g, x, y) => ell(g, x + 2, y + 2, 5, 4, K), feat: (g, a) => { gset(g, a.hx, a.hy - 2, TO); gset(g, a.hx + 1, a.hy - 2, TO); line(g, a.hx + 1, a.hy + 2, a.x - 6, a.y - 4, K, 2); } });
  X.x_ostrich = g => bird(g, { rx: 10, ry: 7, y: 18, hy: 5, hr: 3, neck: true, neckW: 2, legs: 13, beak: 'short', tail: (g, x, y) => { ell(g, x + 2, y - 2, 4, 4, W); }, feat: (g, a) => { paintOn(g, () => K, [BD]); } });
  X.x_emu = g => bird(g, { rx: 10, ry: 8, y: 19, hy: 7, hr: 3, neck: true, neckW: 2, legs: 11, beak: 'short', feat: (g, a) => paintOn(g, (x, y) => ((x + y) % 3 === 0 ? BD : null), [B]) });
  X.x_turkey = g => bird(g, { rx: 9, ry: 8, y: 23, hy: 15, hr: 3.5, legs: 5, tail: (g, x, y) => { for (let i = 0; i < 7; i++) { const a = Math.PI * (0.25 + i * 0.12); line(g, x - 6, y, x - 6 + Math.cos(a) * 16, y - Math.sin(a) * 15, i % 2 ? A : BD, 3); } },
    feat: (g, a) => { ell(g, a.hx - 2, a.hy + 4, 1.5, 3, TO); paintOn(g, () => TO, []); } });
  X.x_peacock = g => bird(g, { rx: 6, ry: 6, y: 25, hy: 15, hr: 3, neck: true, neckW: 2, legs: 4, tail: (g, x, y) => { ell(g, x - 3, y - 6, 12, 14, S); for (let i = 0; i < 9; i++) { const a = Math.PI * (0.1 + i * 0.1), px = x - 3 + Math.cos(a) * 10, py = y - 6 - Math.sin(a) * 11; ell(g, px, py, 1.8, 1.8, GO); gset(g, px, py, K); } },
    feat: (g, a) => { for (let i = -1; i <= 1; i++) line(g, a.hx + i, a.hy - 3, a.hx + i * 2, a.hy - 6, B); } });
  X.x_parrot = g => bird(g, { rx: 6, ry: 8, x: 20, y: 20, hx: 19, hy: 10, hr: 5, legs: 4, beak: 'hook', beakCol: PA, tail: (g, x, y) => poly(g, [[x - 4, y + 4], [x + 2, y + 16], [x - 2, y + 17], [x - 6, y + 6]], A),
    feat: (g, a) => { ell(g, 22, 21, 4, 6, S); ell(g, 18, 11, 2.5, 2.5, W); } });
  X.x_toucan = g => bird(g, { rx: 7, ry: 8, x: 23, y: 22, hx: 21, hy: 13, hr: 4.5, legs: 4, beak: 'big', feat: (g, a) => { ell(g, 21, 18, 4, 3, PA); } });
  X.x_hummingbird = g => { poly(g, [[21, 17], [33, 5], [34, 10], [24, 20]], SL); ell(g, 21, 21, 6, 4, B); ell(g, 14, 18, 3.5, 3.2, B); line(g, 11, 19, 1, 21, K); tri(g, [26, 22], [34, 28], [30, 30], BD); ell(g, 18, 23, 3, 2, TO, [B]);
    return AN(14, 17, 1, 12, 20, 1, 14, 13, { float: true }); };
  /* --- reptiles --- */
  function croc(g, o) { const y = o.y || 27; poly(g, [[3, y - 2], [12, y - 4], [26, y - 4], [38, y + 1], [26, y + 4], [12, y + 3], [3, y + 1]], B);
    for (let i = 0; i < 9; i++) tri(g, [12 + i * 3, y - 4], [13 + i * 3, y - 6], [14 + i * 3, y - 4], BD); for (const x of [11, 23]) { rect(g, x, y + 2, 3, 5, B); rect(g, x - 1, y + 6, 5, 1, BD); }
    line(g, 3, y, 11, y, K); for (let i = 0; i < 4; i++) gset(g, 4 + i * 2, y - 1, W); if (o.feat) o.feat(g, y); return AN(12, y - 5, 1, 7, y, 3, 12, y - 9); }
  X.i_african_crocodile = g => croc(g, { feat: (g, y) => ell(g, 12, y - 5, 2.5, 1.5, B) });
  X.i_american_alligator = g => croc(g, { feat: (g, y) => { ell(g, 6, y - 1, 4, 2.5, B); ell(g, 12, y - 5, 2.5, 1.5, B); } });
  X.x_crocodile_toy = g => { const r = croc(g, { feat: (g, y) => { ell(g, 12, y - 5, 2.5, 1.5, B); for (const x of [16, 22, 28]) rect(g, x, y - 1, 2, 2, GO); } }); return { ...r, rigid: true }; };
  function lizard(g, o) { const y = o.y || 26; for (let i = 0; i < 10; i++) ell(g, 28 + i, y + 1 + i * 0.3 - (i > 6 ? (i - 6) * 0.8 : 0), 2 - i * 0.15, 1.6 - i * 0.1, B);
    for (const [x, d] of [[13, -1], [24, 1]]) { line(g, x, y + 2, x + d * 2, y + 7, B, 2); line(g, x + d * 2 - 1, y + 8, x + d * 2 + 2, y + 8, BD); }
    ell(g, 20, y, 9, o.fat || 4, B); ell(g, 9, y - 2, o.hrx || 5, 3.2, B); if (o.feat) o.feat(g, y); return AN(9, y - 3, 1, 6, y - 1, 2, 10, y - 7); }
  X.i_gila_monster = g => lizard(g, { fat: 5, feat: (g, y) => { paintOn(g, (x, yy) => ((Math.floor(x / 3) + Math.floor(yy / 2)) % 2 ? K : null), [B]); } });
  X.x_monitor_lizard = g => lizard(g, { hrx: 6, feat: (g, y) => { paintOn(g, (x, yy) => ((x * 3 + yy) % 6 === 0 ? PA : null), [B]); line(g, 3, y - 1, 1, y - 2, TO); } });
  X.i_spotted_salamander = g => lizard(g, { feat: (g, y) => dots(g, [[13, y - 2], [17, y - 3], [21, y - 2], [25, y - 3], [9, y - 4], [30, y]], GO) });
  X.x_newt = g => lizard(g, { feat: (g, y) => { for (let i = 0; i < 8; i++) tri(g, [15 + i * 3, y - 4], [16 + i * 3, y - 6], [17 + i * 3, y - 4], A); ell(g, 20, y + 2, 8, 2, GO, [B]); } });
  X.x_axolotl = g => { const r = lizard(g, { fat: 4.5, hrx: 6 }); for (const d of [-1, 1]) for (let i = 0; i < 3; i++) line(g, 11 + i * 2, 23 + d, 12 + i * 3, 23 + d * 6, TO);
    ell(g, 9, 24, 6, 4, B); return AN(8, 23, 2, 8, 26, 3, 10, 17); };
  const snake = (o) => (g) => { for (let i = 0; i < 46; i++) { const t = i / 45, a = t * Math.PI * 2.4; ell(g, 20 + Math.cos(a) * (12 - t * 6), 30 - Math.sin(a) * 3 - t * 2, 2.6, 2.4, B); }
    line(g, 18, 26, 14, 14, B, 4); if (o.hood) ell(g, 14, 14, 6, 6, B); ell(g, 12, 11, 4.5, 3.5, B); line(g, 7, 12, 4, 14, TO); line(g, 4, 14, 3, 13, TO);
    if (o.feat) o.feat(g); return AN(12, 10, 1, 9, 13, 2, 12, 6); };
  X.i_king_snake = snake({ feat: g => paintOn(g, (x, y) => ((x + y * 2) % 6 < 2 ? K : (x + y * 2) % 6 < 3 ? PA : null), [B, BD, BL]) });
  X.i_indian_cobra = snake({ hood: true, feat: g => { ell(g, 13, 16, 2, 1.4, K); ell(g, 16, 16, 2, 1.4, K); } });
  X.i_horned_viper = snake({ feat: g => { tri(g, [10, 9], [10, 4], [12, 9], PA); tri(g, [14, 9], [15, 4], [16, 9], PA); paintOn(g, (x, y) => ((x * 2 + y) % 7 === 0 ? BD : null), [B]); } });
  const dino = (o) => (g) => { // T-rex style biped
    poly(g, [[22, 20], [38, 30], [36, 32], [20, 27]], B); ell(g, 20, 22, 8, 7, B); line(g, 17, 18, 13, 11, B, 5); ell(g, 11, 9, 7, 5, B); rect(g, 4, 10, 6, 2, PA);
    for (const x of [16, 23]) { rect(g, x, 26, 4, 8, B); rect(g, x - 1, 34, 6, 2, BD); } line(g, 13, 16, 9, 19, B); line(g, 9, 19, 8, 20, PA);
    if (o.feat) o.feat(g); return AN(12, 7, 1, 7, 12, 4, 12, 3, o.rigid ? { rigid: true } : {}); };
  X.x_t_rex = dino({});
  X.x_dinosaur = g => { for (let i = 0; i < 14; i++) ell(g, 10 - i * 0.2, 24 - i * 1.4, 2.5, 2.2, B); ell(g, 9, 5, 4, 3, B); ell(g, 22, 25, 11, 7, B); poly(g, [[31, 23], [39, 31], [37, 33], [30, 28]], B);
    for (const x of [14, 19, 25, 30]) rect(g, x, 29, 3, 7, B); return AN(8, 4, 1, 6, 7, 2, 9, 1); };
  X.x_dinosaur_toy = g => { const r = X.x_dinosaur(g); for (let i = 0; i < 5; i++) tri(g, [16 + i * 3, 18], [17 + i * 3, 14], [18 + i * 3, 18], A); return { ...r, rigid: true }; };
  X.x_triceratops = g => { poly(g, [[30, 22], [39, 28], [37, 30], [29, 27]], B); ell(g, 22, 24, 10, 7, B); for (const x of [15, 20, 26, 31]) rect(g, x, 28, 3, 8, B);
    ell(g, 12, 15, 6, 8, A); ell(g, 9, 22, 6, 4.5, B); tri(g, [3, 22], [1, 18], [5, 20], PA); tri(g, [8, 17], [1, 11], [10, 19], PA); tri(g, [12, 17], [6, 9], [13, 18], PA); return AN(10, 20, 1, 5, 24, 2, 12, 7); };
  /* --- bugs and critters --- */
  const insect = (o) => (g) => { // top-down insect with wings
    if (o.wings) for (const d of [-1, 1]) ell(g, 20 + d * (o.ww || 8), o.wy || 17, o.wrx || 7, o.wry || 4, o.wcol || SL);
    for (const d of [-1, 1]) for (let i = 0; i < 3; i++) line(g, 20 + d * 3, 19 + i * 3, 20 + d * (o.legW || 9), 17 + i * 5, K);
    ell(g, 20, 13, o.hr || 3.5, o.hr || 3.5, B); ell(g, 20, 19, 3.5, 3, B); ell(g, 20, 27, o.arx || 4, o.ary || 7, o.acol || B);
    if (o.stripes) for (let y = 23; y < 34; y += 3) line(g, 16, y, 24, y, K); if (o.feat) o.feat(g); return AN(20, 12, 2, 20, 15, 2, 20, 7, { float: !!o.wings }); };
  X.x_housefly = X.x_fly = insect({ wings: true, ww: 6, wy: 22, wrx: 4, wry: 8, wcol: SL, hr: 4, feat: g => { ell(g, 17, 12, 1.8, 2, TO); ell(g, 23, 12, 1.8, 2, TO); } });
  X.x_mosquito = insect({ wings: true, ww: 5, wy: 20, wrx: 3, wry: 8, legW: 16, arx: 2, ary: 9, hr: 2.5, feat: g => line(g, 20, 15, 20, 4, K) });
  X.x_hornet = insect({ wings: true, ww: 6, wy: 17, wrx: 5, wry: 3, acol: GO, stripes: true, feat: g => tri(g, [19, 34], [20, 37], [21, 34], K) });
  X.x_firefly = insect({ wings: true, wy: 17, wrx: 5, wry: 4, acol: G, feat: g => { ell(g, 20, 30, 5, 5, G); gset(g, 14, 32, G); gset(g, 26, 33, G); } });
  X.x_moth_insect = insect({ wings: true, ww: 9, wy: 20, wrx: 9, wry: 8, wcol: BL, arx: 3, ary: 6, feat: g => { for (const d of [-1, 1]) { ell(g, 20 + d * 10, 18, 2, 2, BD); line(g, 20 + d * 1, 10, 20 + d * 5, 4, BD); } } });
  X.x_silverfish = g => { for (let i = 0; i < 9; i++) ell(g, 10 + i * 2.4, 21, 4 - Math.abs(i - 2) * 0.35, 3.2 - i * 0.2, B); for (const d of [-1, 1]) { line(g, 8, 20, 2, 20 + d * 6, BD); for (let i = 0; i < 3; i++) line(g, 13 + i * 3, 21, 11 + i * 3, 21 + d * 5, BD); }
    for (const d of [-1, 0, 1]) line(g, 31, 21, 38, 21 + d * 5, BD); paintOn(g, (x, y) => (x % 3 === 0 ? BL : null), [B]); return AN(10, 20, 1, 8, 22, 1, 12, 16); };
  X.x_woodlouse = g => { ell(g, 20, 22, 13, 8, B); for (let i = 0; i < 7; i++) line(g, 10 + i * 3.4, 15, 10 + i * 3.4, 29, BD); for (let i = 0; i < 7; i++) line(g, 10 + i * 3.4, 29, 9 + i * 3.4, 32, K); line(g, 7, 20, 2, 15, K); line(g, 7, 22, 2, 26, K);
    return AN(9, 20, 1, 7, 24, 2, 20, 13); };
  X.x_stick_insect = g => { line(g, 4, 20, 36, 20, B, 2); for (const x of [10, 18, 26]) { line(g, x, 20, x - 4, 31, B); line(g, x, 20, x - 3, 9, B); } line(g, 4, 20, 1, 14, B); return AN(5, 18, 1, 4, 21, 1, 6, 14); };
  X.x_praying_mantis = g => { line(g, 18, 25, 34, 33, B, 3); line(g, 16, 25, 14, 12, B, 2); tri(g, [10, 9], [19, 9], [14, 14], B); line(g, 15, 15, 10, 20, B, 2); line(g, 10, 20, 12, 13, B, 2); line(g, 17, 17, 22, 21, B, 2); line(g, 22, 21, 20, 14, B, 2);
    for (const x of [22, 28]) { line(g, x, 28, x - 3, 36, B); line(g, x, 28, x + 3, 36, B); } ell(g, 27, 27, 6, 2, SL); return AN(14, 10, 2, 14, 12, 2, 14, 5); };
  const worm = (o) => (g) => { for (let i = 0; i < 26; i++) ell(g, 7 + i, 23 + Math.sin(i * 0.3) * (o.wave || 3), o.w || 3, o.w || 3, B); if (o.feat) o.feat(g); return AN(8, 21, 1, 6, 24, 2, 9, 16); };
  X.x_leech = worm({ w: 3.2, feat: g => { ell(g, 7, 23, 3.5, 3.5, BD); ell(g, 33, 26, 4, 4, BD); } });
  X.i_flatworm = g => { ell(g, 21, 22, 16, 6, B); paintOn(g, (x, y) => ((x + y) % 4 === 0 ? BL : null), [B]); tri(g, [5, 21], [7, 16], [9, 20], B); tri(g, [9, 20], [11, 16], [12, 20], B); return AN(9, 21, 1, 8, 24, 2, 9, 14); };
  X.i_sea_cucumber = g => { ell(g, 20, 24, 15, 7, B); for (let i = 0; i < 12; i++) tri(g, [8 + i * 2.4, 18], [9 + i * 2.4, 15], [10 + i * 2.4, 18], BD); for (let i = 0; i < 5; i++) line(g, 6, 22, 2 + i, 17 + i * 2, PA); return AN(10, 22, 1, 7, 25, 2, 12, 14); };
  X.i_hermit_crab = g => { ell(g, 24, 18, 11, 11, A); for (let i = 0; i < 4; i++) ell(g, 24 + i * 1.5, 18 - i * 1.5, 7 - i * 1.6, 7 - i * 1.6, i % 2 ? AL : A); ell(g, 13, 26, 6, 5, B); ell(g, 6, 22, 4, 3.5, B); ell(g, 9, 30, 3, 2.5, B);
    for (let i = 0; i < 3; i++) line(g, 14 + i * 3, 29, 12 + i * 4, 35, B); line(g, 12, 21, 11, 15, B); line(g, 15, 21, 15, 15, B); return AN(13, 15, 2, 12, 27, 2, 13, 11); };
  X.x_tadpole = g => { ell(g, 15, 20, 8, 7, B); for (let i = 0; i < 18; i++) ell(g, 22 + i, 20 + Math.sin(i * 0.5) * 2.5, 2.5 - i * 0.11, 2.5 - i * 0.11, BL); return AN(12, 18, 2, 11, 23, 3, 15, 12, { float: true }); };
  X.x_ant_hill = g => { poly(g, [[3, 36], [14, 14], [26, 14], [37, 36]], B); paintOn(g, (x, y) => ((x * 3 + y * 7) % 5 === 0 ? BD : (x + y) % 9 === 0 ? BL : null), [B]); ell(g, 20, 15, 3, 1.5, K);
    for (const [x, y] of [[9, 30], [28, 26], [20, 9]]) { ell(g, x, y, 1.2, 1, K); ell(g, x + 2, y, 1.2, 1, K); } return RG(20, 24, 4, 20, 31, 5, 20, 10); };
  X.x_beehive = g => { for (let i = 0; i < 6; i++) ell(g, 20, 13 + i * 4, 6 + Math.sin(i * 0.6 + 0.5) * 7, 2.6, i % 2 ? GO : B); ell(g, 20, 34, 3, 1.5, K); line(g, 20, 3, 20, 8, BD, 2);
    for (const [x, y] of [[32, 14], [7, 22]]) { ell(g, x, y, 2, 1.5, GO); gset(g, x, y, K); } return RG(20, 20, 4, 20, 27, 5, 20, 7); };
  X.x_wasp_nest = g => { line(g, 20, 2, 20, 7, BD, 2); ell(g, 20, 20, 12, 13, B); for (let i = 0; i < 7; i++) ell(g, 20, 10 + i * 3.5, 12 - Math.abs(i - 3) * 1.5, 1, BD, [B]); ell(g, 20, 32, 3, 2, K); return RG(20, 17, 4, 20, 25, 5, 20, 6); };
  X.x_honeycomb = g => { for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const x = 8 + c * 6 + (r % 2) * 3, y = 10 + r * 5; poly(g, [[x, y - 3], [x + 3, y - 1], [x + 3, y + 2], [x, y + 4], [x - 3, y + 2], [x - 3, y - 1]], B); ell(g, x, y + 0.5, 1.5, 2, (r + c) % 3 ? GO : BD); }
    return RG(20, 18, 5, 20, 26, 5, 20, 5); };
  /* --- clothing (front view) --- */
  function top(g, o) { // shirts, jackets, dresses: torso + sleeves
    const y0 = o.y0 || 8, y1 = o.y1 || 32, w0 = o.w0 || 9, w1 = o.w1 || 9, sl = o.sleeve || 'short';
    if (sl === 'long') for (const d of [-1, 1]) poly(g, [[20 + d * (w0 - 1), y0], [20 + d * (w0 + 4), y0 + 2], [20 + d * (w0 + 6), y0 + 20], [20 + d * (w0 + 2), y0 + 20], [20 + d * (w0 - 1), y0 + 7]], o.sc || B);
    if (sl === 'short') for (const d of [-1, 1]) poly(g, [[20 + d * (w0 - 1), y0], [20 + d * (w0 + 5), y0 + 3], [20 + d * (w0 + 3), y0 + 9], [20 + d * (w0 - 1), y0 + 7]], o.sc || B);
    if (sl === 'puff') for (const d of [-1, 1]) ell(g, 20 + d * (w0 + 1), y0 + 3, 4, 4, B);
    poly(g, [[20 - w0, y0], [20 + w0, y0], [20 + w1, y1], [20 - w1, y1]], B);
    const nk = o.neck || 'round';
    if (nk === 'round') ell(g, 20, y0, 4, 2.5, E); if (nk === 'v') tri(g, [16, y0 - 1], [24, y0 - 1], [20, y0 + 6], E);
    if (nk === 'turtle') rrect(g, 15, y0 - 4, 10, 5, 2, BL); if (nk === 'collar') { tri(g, [15, y0], [20, y0 + 5], [17, y0 + 5], PA); tri(g, [25, y0], [20, y0 + 5], [23, y0 + 5], PA); }
    if (nk === 'hood') { ell(g, 20, y0 - 2, 7, 5, BD); ell(g, 20, y0 - 1, 4, 3, E); }
    if (o.zip) line(g, 20, y0 + 3, 20, y1 - 1, o.zip);
    if (o.feat) o.feat(g, { y0, y1, w0, w1 });
    return RG(20, Math.round(y0 + (y1 - y0) * 0.35), 3, 20, Math.round(y0 + (y1 - y0) * 0.55), 4, 20, y0 - 4);
  }
  X.jacket = g => top(g, { sleeve: 'long', neck: 'collar', zip: MD, feat: (g) => { rect(g, 13, 22, 4, 3, BD); rect(g, 23, 22, 4, 3, BD); } });
  X.x_windbreaker = g => top(g, { sleeve: 'long', neck: 'hood', zip: MD, feat: (g) => { line(g, 11, 16, 29, 16, A, 2); } });
  X.x_raincoat_jacket = g => top(g, { sleeve: 'long', neck: 'hood', w1: 11, y1: 34, feat: (g) => { for (let y = 13; y < 32; y += 5) { gset(g, 18, y, K); gset(g, 22, y, K); } dots(g, [[5, 6], [33, 4], [36, 10]], SL); } });
  X.x_puffer_jacket = g => { const r = top(g, { sleeve: 'long', neck: 'turtle', w0: 10, w1: 10, zip: MD }); for (let y = 12; y < 32; y += 5) line(g, 10, y, 30, y, BD); for (const x of [6, 33]) for (let y = 14; y < 28; y += 4) gset(g, x, y, BD); return r; };
  X.x_turtleneck = g => top(g, { sleeve: 'long', neck: 'turtle', feat: g => { for (let y = 14; y < 31; y += 2) line(g, 12, y, 28, y, BL); } });
  X.x_tank_top = g => { poly(g, [[14, 6], [17, 6], [17, 10], [23, 10], [23, 6], [26, 6], [29, 15], [29, 33], [11, 33], [11, 15]], B); ell(g, 20, 10, 3, 3, E); return RG(20, 19, 3, 20, 25, 4, 20, 4); };
  X.x_crop_top = g => { const r = top(g, { sleeve: 'short', y1: 22, neck: 'round' }); line(g, 11, 22, 29, 22, BD); return r; };
  X.x_vest = g => { poly(g, [[13, 6], [16, 6], [20, 20], [24, 6], [27, 6], [30, 13], [30, 33], [10, 33], [10, 13]], B); line(g, 20, 20, 20, 33, BD); for (const y of [23, 27, 31]) gset(g, 21, y, GO); rect(g, 12, 25, 4, 1, BD); rect(g, 24, 25, 4, 1, BD); return RG(20, 25, 5, 20, 30, 3, 20, 4); };
  X.x_uniform = g => top(g, { sleeve: 'long', neck: 'collar', feat: g => { for (let y = 14; y < 31; y += 4) gset(g, 20, y, GO); for (const x of [10, 30]) rect(g, x - 2, 8, 4, 2, GO); ell(g, 25, 15, 1.5, 1.5, GO); } });
  X.x_wetsuit = g => { const r = top(g, { sleeve: 'long', neck: 'turtle', y1: 24, w1: 8, feat: g => { line(g, 20, 6, 20, 24, MD); } }); for (const d of [-1, 1]) poly(g, [[20 + d, 24], [20 + d * 8, 24], [20 + d * 7, 37], [20 + d * 2, 37]], B); line(g, 9, 13, 31, 13, A); return r; };
  X.x_onesie = g => { const r = top(g, { sleeve: 'long', neck: 'hood', y1: 24, w1: 9, feat: g => { for (let y = 12; y < 24; y += 3) gset(g, 20, y, W); tri(g, [14, 1], [15, 6], [17, 4], BD); tri(g, [26, 1], [25, 6], [23, 4], BD); } }); for (const d of [-1, 1]) poly(g, [[20 + d, 24], [20 + d * 9, 24], [20 + d * 8, 37], [20 + d * 2, 37]], B); return r; };
  X.x_overalls = g => { for (const x of [14, 26]) rect(g, x - 1, 4, 2, 10, B); rrect(g, 12, 12, 16, 10, 1, B); for (const d of [-1, 1]) poly(g, [[20, 22], [20 + d * 8, 22], [20 + d * 9, 37], [20 + d * 2, 37]], B); rect(g, 16, 15, 8, 4, BD); dots(g, [[14, 14], [26, 14]], GO);
    return RG(20, 17, 3, 20, 26, 3, 20, 7); };
  X.dress = g => { const r = top(g, { sleeve: 'puff', neck: 'round', y0: 6, y1: 18, w0: 6, w1: 5 }); poly(g, [[15, 18], [25, 18], [33, 37], [7, 37]], B); line(g, 14, 18, 26, 18, A, 2); for (const x of [14, 20, 26]) line(g, x, 22, x + (x - 20) * 0.6, 36, BD); return r; };
  X.x_nightgown = g => { const r = top(g, { sleeve: 'long', neck: 'v', y0: 6, y1: 37, w0: 7, w1: 12 }); for (let i = 0; i < 6; i++) gset(g, 12 + i * 3.5, 36, W); ell(g, 13, 26, 1.5, 1.2, GO); ell(g, 25, 31, 1.5, 1.2, GO); return r; };
  X.x_robe = g => { const r = top(g, { sleeve: 'long', neck: 'v', y0: 6, y1: 37, w0: 8, w1: 11 }); poly(g, [[16, 6], [21, 6], [24, 37], [18, 37]], BL); line(g, 9, 21, 31, 21, BD, 2); ell(g, 25, 23, 2, 3, BD); return r; };
  X.x_cape = g => { poly(g, [[15, 6], [25, 6], [36, 37], [4, 37]], B); poly(g, [[16, 9], [24, 9], [30, 34], [10, 34]], A); ell(g, 20, 6, 6, 2, GO); return RG(20, 17, 4, 20, 25, 4, 20, 2); };
  X.x_cloak = g => { poly(g, [[13, 12], [27, 12], [35, 37], [5, 37]], B); ell(g, 20, 10, 9, 8, B); ell(g, 20, 12, 5.5, 5.5, K); line(g, 20, 19, 20, 37, BD); ell(g, 20, 19, 1.5, 1.5, GO); return RG(20, 12, 2, 20, 15, 2, 20, 2); };
  X.i_theater_curtain = g => { rect(g, 2, 3, 36, 3, GO); poly(g, [[3, 6], [19, 6], [14, 18], [17, 37], [3, 37]], B); poly(g, [[21, 6], [37, 6], [37, 37], [23, 37], [26, 18]], B); for (const x of [6, 10, 30, 34]) line(g, x, 7, x, 36, BD); tri(g, [3, 6], [37, 6], [20, 11], BD); rect(g, 14, 17, 3, 2, GO); rect(g, 24, 17, 3, 2, GO);
    return RG(20, 22, 6, 20, 30, 4, 20, 2); };
  // bottoms and swimwear
  const pants = (o) => (g) => { const y0 = o.y0 || 8, y1 = o.y1 || 37; rect(g, 11, y0, 18, 4, o.band || BD); for (const d of [-1, 1]) poly(g, [[20, y0 + 3], [20 + d * 9, y0 + 3], [20 + d * (o.flare || 8), y1], [20 + d * 2, y1]], B); if (o.feat) o.feat(g); return RG(20, y0 + 8, 3, 20, y0 + 13, 3, 20, y0 - 3); };
  X.x_leggings = pants({ flare: 6, feat: g => { line(g, 11, 22, 14, 37, BL); line(g, 29, 22, 26, 37, BL); } });
  X.x_tights = pants({ flare: 5, band: B, feat: g => paintOn(g, (x, y) => ((x + y) % 3 === 0 ? BD : null), [B]) });
  X.x_stockings = g => { for (const x of [13, 25]) { rect(g, x, 4, 5, 26, B); ell(g, x + 1, 32, 4, 3, B); rect(g, x, 4, 5, 3, A); } paintOn(g, (x, y) => ((x + y) % 2 === 0 && y > 7 ? BD : null), [B]); return RG(20, 14, 5, 20, 22, 3, 20, 2); };
  const shorts = (o) => (g) => { rect(g, 9, 12, 22, 4, o.band || BD); for (const d of [-1, 1]) poly(g, [[20, 15], [20 + d * 11, 15], [20 + d * 12, 28], [20 + d * 2, 28], [20 + d, 21]], B); if (o.feat) o.feat(g); return RG(20, 19, 4, 20, 24, 3, 20, 8); };
  X.x_swim_trunks = X.i_swimming_trunks = shorts({ feat: g => { for (let i = 0; i < 6; i++) ell(g, 11 + i * 4, 20 + (i % 2) * 4, 1.4, 1.4, A, [B]); line(g, 18, 13, 17, 17, W); line(g, 22, 13, 23, 17, W); } });
  X.x_underwear = g => { poly(g, [[8, 14], [32, 14], [30, 21], [23, 28], [17, 28], [10, 21]], B); rect(g, 8, 14, 24, 3, BD); return RG(20, 19, 4, 20, 24, 3, 20, 9); };
  X.i_diaper = g => { poly(g, [[6, 14], [34, 14], [31, 22], [24, 30], [16, 30], [9, 22]], PA); rect(g, 6, 14, 28, 3, B); rect(g, 6, 15, 4, 4, A); rect(g, 30, 15, 4, 4, A); ell(g, 20, 23, 3, 2, B); return RG(20, 20, 4, 20, 25, 3, 20, 9); };
  X.x_bikini = g => { for (const d of [-1, 1]) { ell(g, 20 + d * 5, 12, 4.5, 4, B); line(g, 20 + d * 5, 8, 20 + d * 7, 2, B); } line(g, 9, 12, 31, 12, B); poly(g, [[10, 24], [30, 24], [24, 33], [16, 33]], B); line(g, 8, 24, 32, 24, B, 2); return RG(20, 12, 5, 20, 28, 3, 20, 4); };
  X.x_swimsuit = g => { poly(g, [[13, 5], [16, 5], [18, 12], [22, 12], [24, 5], [27, 5], [29, 14], [27, 26], [31, 33], [24, 34], [20, 30], [16, 34], [9, 33], [13, 26], [11, 14]], B); line(g, 13, 20, 27, 20, A, 2); return RG(20, 16, 3, 20, 25, 3, 20, 2); };
  X.i_bib = g => { ell(g, 20, 22, 12, 13, B); ell(g, 20, 11, 5, 4, E); rect(g, 15, 3, 10, 5, E); line(g, 13, 11, 6, 9, A); line(g, 27, 11, 34, 9, A); ell(g, 20, 26, 6, 5, A, [B]); return RG(20, 20, 4, 20, 27, 4, 20, 8); };
  // armour
  X.i_breastplate = g => { poly(g, [[11, 6], [16, 8], [24, 8], [29, 6], [32, 13], [29, 30], [20, 35], [11, 30], [8, 13]], M); line(g, 20, 9, 20, 34, MD); ell(g, 20, 8, 4, 2, E); for (const d of [-1, 1]) ell(g, 20 + d * 11, 9, 4, 3, MD); dots(g, [[13, 12], [27, 12], [13, 26], [27, 26]], MD);
    return RG(20, 17, 4, 20, 25, 4, 20, 3); };
  X.i_chain_mail = g => { const r = top(g, { sleeve: 'short', neck: 'round', w1: 10, y1: 34 }); paintOn(g, (x, y) => ((x + (y % 2)) % 2 ? MD : M), [B, BD, BL]); return r; };
  X.helmet = g => { ell(g, 20, 20, 13, 13, B); rect(g, 6, 22, 28, 15, E); rect(g, 6, 20, 28, 3, BD); rrect(g, 9, 13, 22, 5, 2, S); line(g, 10, 14, 15, 14, SL); line(g, 20, 7, 20, 12, BL); return RG(20, 15, 4, 20, 26, 4, 20, 5, { mouth: { x: 20, y: 25, w: 4 }, eyes: { x: 20, y: 15, span: 4 } }); };
  // headwear
  X.i_bearskin = g => { rrect(g, 9, 2, 22, 30, 9, K); paintOn(g, (x, y) => ((x * 3 + y) % 5 === 0 ? BD : null), [K]); rect(g, 10, 31, 20, 4, B); line(g, 10, 32, 30, 32, GO); line(g, 9, 35, 31, 35, GO); return RG(20, 17, 4, 20, 25, 4, 20, 2); };
  X.x_balaclava = X.i_ski_mask = g => { ell(g, 20, 19, 13, 16, B); rrect(g, 11, 13, 18, 6, 2, PA); ell(g, 20, 26, 4, 2.5, PA); paintOn(g, (x, y) => (y % 3 === 0 ? BD : null), [B]); return RG(20, 15, 4, 20, 26, 3, 20, 3); };
  X.x_bandana = g => { poly(g, [[4, 12], [36, 12], [20, 34]], B); for (let i = 0; i < 8; i++) ell(g, 12 + (i % 4) * 5, 15 + Math.floor(i / 4) * 6, 1.3, 1.3, W, [B]); line(g, 33, 12, 37, 6, B, 2); line(g, 33, 12, 38, 16, B, 2); return RG(20, 17, 4, 20, 24, 3, 20, 7); };
  X.i_shower_cap = g => { ell(g, 20, 21, 15, 11, B); rect(g, 4, 23, 32, 14, E); for (let i = 0; i < 15; i++) ell(g, 6 + i * 2, 23, 1.5, 1.8, BL); paintOn(g, (x, y) => ((x + y) % 6 === 0 ? W : null), [B]); return RG(20, 16, 5, 20, 21, 4, 20, 8); };
  X.x_visor = g => { rrect(g, 7, 15, 26, 5, 2, B); poly(g, [[5, 19], [35, 19], [30, 27], [10, 27]], A); line(g, 6, 20, 34, 20, BD); return RG(20, 17, 6, 20, 23, 6, 20, 11); };
  X.x_crown = g => { poly(g, [[6, 30], [6, 12], [12, 20], [16, 9], [20, 19], [24, 9], [28, 20], [34, 12], [34, 30]], GO); rect(g, 6, 27, 28, 4, A); for (const [x, y] of [[11, 29], [20, 29], [29, 29]]) ell(g, x, y, 1.5, 1.5, S); for (const x of [6, 16, 24, 34]) ell(g, x, x === 6 || x === 34 ? 11 : 8, 1.5, 1.5, W);
    return RG(20, 22, 5, 20, 26, 3, 20, 4); };
  X.x_tiara = g => { ell(g, 20, 30, 15, 6, GO); ell(g, 20, 31, 13, 4.5, E); for (const [x, h] of [[9, 5], [14, 9], [20, 14], [26, 9], [31, 5]]) { tri(g, [x - 2, 27], [x, 27 - h], [x + 2, 27], GO); ell(g, x, 27 - h, 1.3, 1.3, S); } ell(g, 20, 14, 2, 2, S);
    return RG(20, 22, 4, 20, 27, 3, 20, 10); };
  X.x_earmuffs = g => { line(g, 9, 23, 9, 14, M, 2); line(g, 31, 23, 31, 14, M, 2); for (let x = 9; x <= 31; x++) gset(g, x, 14 - Math.round(Math.sin((x - 9) / 22 * Math.PI) * 9), M), gset(g, x, 15 - Math.round(Math.sin((x - 9) / 22 * Math.PI) * 9), M);
    for (const x of [8, 32]) { ell(g, x, 26, 6, 7, B); paintOn(g, (xx, y) => ((xx + y) % 3 === 0 ? BL : null), [B]); } return RG(20, 12, 2, 20, 16, 2, 20, 3); };
  X.x_headband = X.x_sweatband = g => { ell(g, 20, 21, 15, 12, B); ell(g, 20, 21, 12, 9, E); rect(g, 4, 21, 32, 12, E); if (true) for (let x = 6; x < 34; x += 3) gset(g, x, 20 - Math.round(Math.sin((x - 5) / 30 * Math.PI) * 10), BD); return RG(20, 13, 4, 20, 17, 3, 20, 8); };
  X.x_wig_hair = X.i_wig = g => { ell(g, 20, 16, 14, 13, B); for (let i = 0; i < 8; i++) ell(g, 7 + i * 3.7, 29 + (i % 2) * 2, 2.5, 6, B); ell(g, 20, 20, 8, 7, E); poly(g, [[12, 9], [28, 9], [26, 15], [15, 13]], B); paintOn(g, (x, y) => ((x * 2 + y) % 5 === 0 ? BD : null), [B]);
    return RG(20, 20, 3, 20, 24, 3, 20, 3); };
  // small accessories
  X.tie = g => { tri(g, [17, 4], [23, 4], [20, 9], BD); poly(g, [[18, 9], [22, 9], [26, 30], [20, 36], [14, 30]], B); for (let y = 12; y < 32; y += 4) line(g, 17, y + 2, 24, y - 1, A, 1); return RG(20, 17, 2, 20, 23, 2, 20, 2); };
  X.scarf = g => { rrect(g, 7, 6, 26, 9, 4, B); rect(g, 22, 12, 7, 22, B); for (let y = 8; y < 34; y += 4) line(g, 7, y, 33, y, A); for (let x = 22; x < 29; x += 2) line(g, x, 34, x, 37, B); paintOn(g, () => null, []); return RG(20, 10, 4, 20, 13, 3, 20, 2); };
  X.x_gloves_pair = g => { for (const [x, d] of [[12, -1], [28, 1]]) { rrect(g, x - 5, 14, 10, 12, 3, B); for (let i = 0; i < 4; i++) rect(g, x - 5 + i * 2.6, 6 + Math.abs(i - 1.5), 2, 10, B); line(g, x + d * 5, 18, x + d * 8, 13, B, 2); rect(g, x - 5, 26, 10, 5, A); } return RG(12, 19, 2, 28, 21, 3, 20, 5); };
  X.x_mittens_pair = g => { for (const [x, d] of [[12, -1], [28, 1]]) { rrect(g, x - 5, 8, 10, 18, 5, B); ell(g, x + d * 5, 16, 2.5, 3.5, B); rect(g, x - 5, 26, 10, 6, A); for (let y = 27; y < 32; y += 2) line(g, x - 5, y, x + 4, y, AL); } return RG(12, 16, 2, 28, 19, 3, 20, 3); };
  X.x_hair_tie = g => { ell(g, 20, 20, 13, 13, B); ell(g, 20, 20, 8, 8, E); paintOn(g, (x, y) => ((x * 2 + y) % 4 === 0 ? BD : null), [B]); return RG(20, 10, 4, 20, 30, 4, 20, 4); };
  X.x_cufflinks = g => { for (const [x, y] of [[13, 15], [27, 25]]) { ell(g, x, y, 7, 7, GO); ell(g, x, y, 5, 5, B); rect(g, x - 1, y + 7, 2, 4, GO); } return RG(13, 14, 2, 27, 26, 3, 20, 5); };
  X.x_suspenders = g => { for (const x of [13, 27]) { line(g, x, 4, x + (x < 20 ? 3 : -3), 34, B, 3); rect(g, x - 2 + (x < 20 ? 2 : -2), 32, 5, 4, M); } line(g, 15, 20, 25, 20, B, 2); rect(g, 18, 18, 4, 5, M); return RG(20, 12, 4, 20, 26, 3, 20, 2); };
  X.i_wool = g => { ell(g, 20, 22, 13, 13, B); for (let i = 0; i < 6; i++) { const a = i * 0.6; line(g, 20 - Math.cos(a) * 12, 22 - Math.sin(a) * 12, 20 + Math.cos(a) * 12, 22 + Math.sin(a) * 12, BD); } line(g, 31, 30, 38, 37, B); rect(g, 26, 2, 2, 14, M); rect(g, 30, 4, 2, 12, M);
    return RG(20, 20, 4, 20, 26, 4, 20, 9); };
  /* --- shoes --- */
  function shoe(g, o) { const y = o.y || 30; if (o.shaft) rrect(g, o.sx || 21, y - o.shaft, o.sw || 9, o.shaft + 2, 2, B);
    poly(g, [[4, y + 4], [5, y - 2], [16, y - 4], [o.back || 30, y - (o.heelH || 7)], [34, y - 7], [34, y + 4]], B); rect(g, 4, y + 4, 31, 2, o.sole || K);
    if (o.feat) o.feat(g, y); return RG(o.ex || 26, o.ey || y - 2, 2, o.mx || 14, o.my || y + 1, 4, 26, y - 10); }
  X.x_ice_skate = g => shoe(g, { y: 24, shaft: 10, sx: 21, sw: 13, sole: B, feat: (g, y) => { rect(g, 5, y + 7, 30, 1, M); line(g, 4, y + 6, 6, y + 8, M); for (const x of [10, 28]) rect(g, x, y + 6, 1, 2, M); for (let yy = y - 9; yy < y; yy += 2) line(g, 22, yy, 26, yy, W); } });
  X.x_roller_shoe = g => shoe(g, { y: 24, shaft: 9, sx: 21, sw: 13, feat: (g, y) => { for (const x of [9, 17, 25, 32]) ell(g, x, y + 9, 2.5, 2.5, A); rect(g, 6, y + 6, 28, 2, MD); } });
  X.x_ski_boot = g => shoe(g, { y: 28, shaft: 14, sx: 20, sw: 14, sole: MD, feat: (g, y) => { for (let yy = y - 12; yy < y; yy += 4) rect(g, 33, yy, 3, 2, M); line(g, 2, y + 7, 38, y + 7, A, 2); } });
  X.x_snow_boot = g => shoe(g, { y: 30, shaft: 14, sx: 19, sw: 14, sole: K, feat: (g, y) => { rect(g, 18, y - 15, 16, 4, PA); paintOn(g, (x, yy) => ((x + yy) % 3 === 0 && yy < y - 11 ? W : null), [PA]); } });
  X.x_knee_high_boot = g => shoe(g, { y: 33, shaft: 28, sx: 22, sw: 10, heelH: 6, feat: (g, y) => { rect(g, 29, y + 2, 4, 3, K); line(g, 23, y - 26, 23, y - 4, MD); } });
  X.x_high_heel = g => { poly(g, [[4, 32], [8, 28], [17, 29], [28, 16], [34, 15], [34, 20], [31, 22], [31, 33], [29, 33], [29, 23], [18, 34], [5, 34]], B); line(g, 30, 22, 30, 34, K); rect(g, 29, 33, 3, 2, K); ell(g, 23, 21, 3, 2, E);
    return RG(28, 18, 2, 14, 31, 3, 30, 10); };
  X.x_platform_shoe = g => shoe(g, { y: 24, sole: A, feat: (g, y) => { rect(g, 4, y + 4, 31, 8, A); paintOn(g, (x, yy) => (yy % 3 === 0 ? AD : null), [A]); } });
  X.x_football_boot = g => shoe(g, { feat: (g, y) => { for (const x of [7, 12, 18, 25, 31]) rect(g, x, y + 6, 2, 2, M); line(g, 12, y - 3, 30, y - 6, W, 2); for (let x = 14; x < 22; x += 2) gset(g, x, y - 4, PA); } });
  X.x_spikes_shoe = g => shoe(g, { y: 28, feat: (g, y) => { for (const x of [6, 10, 14, 18]) tri(g, [x, y + 6], [x + 1, y + 9], [x + 2, y + 6], M); line(g, 8, y - 1, 28, y - 5, A, 2); } });
  X.x_croc = g => { const r = shoe(g, { y: 28, sole: BD, feat: (g, y) => { for (let i = 0; i < 6; i++) ell(g, 9 + i * 3, y - 1 + (i % 2), 0.8, 0.8, BD); line(g, 29, y - 4, 36, y + 3, B, 2); ell(g, 30, y - 2, 2, 2, BL); } }); return r; };
  X.x_flip_flop = g => { ell(g, 20, 25, 9, 14, B); ell(g, 20, 26, 7.5, 12.5, BL); line(g, 20, 15, 12, 25, A, 2); line(g, 20, 15, 28, 25, A, 2); ell(g, 20, 15, 1.5, 1.5, A); return RG(20, 28, 3, 20, 33, 3, 20, 9); };
  X.x_shoelace = g => { for (let i = 0; i < 6; i++) { line(g, 12, 6 + i * 4, 28, 9 + i * 4, B, 2); line(g, 28, 6 + i * 4, 12, 9 + i * 4, B, 2); } for (const x of [11, 29]) for (let y = 6; y < 30; y += 4) ell(g, x, y + 1, 1.4, 1.4, M); line(g, 13, 30, 9, 37, B, 2); line(g, 27, 30, 31, 37, B, 2); rect(g, 8, 36, 2, 2, M); rect(g, 30, 36, 2, 2, M);
    return RG(20, 16, 3, 20, 24, 3, 20, 3); };
  /* --- sport --- */
  X.x_basketball_hoop = g => { rect(g, 6, 3, 28, 17, W); rect(g, 15, 9, 10, 7, E); rect(g, 15, 9, 10, 1, TO); rect(g, 15, 15, 10, 1, TO); rect(g, 15, 9, 1, 7, TO); rect(g, 24, 9, 1, 7, TO); rect(g, 13, 17, 14, 2, B);
    for (let i = 0; i < 6; i++) { line(g, 13 + i * 2.6, 19, 15 + i * 2, 29, PA); } line(g, 15, 24, 25, 24, PA); line(g, 15, 28, 25, 28, PA); rect(g, 19, 20, 2, 17, MD); return RG(20, 7, 4, 20, 13, 3, 20, 1); };
  X.x_football_goal = g => { rect(g, 3, 6, 2, 30, W); rect(g, 35, 6, 2, 30, W); rect(g, 3, 6, 34, 2, W); for (let x = 7; x < 35; x += 3) line(g, x, 8, x, 35, PA); for (let y = 11; y < 36; y += 3) line(g, 5, y, 34, y, PA); ell(g, 20, 31, 4, 4, W); dots(g, [[19, 30], [21, 32], [18, 32]], K);
    return RG(20, 18, 5, 20, 24, 4, 20, 2); };
  X.x_volleyball_net = g => { rect(g, 3, 6, 2, 31, MD); rect(g, 35, 6, 2, 31, MD); rect(g, 5, 8, 30, 2, W); for (let x = 7; x < 35; x += 3) line(g, x, 10, x, 21, PA); for (let y = 12; y < 22; y += 3) line(g, 5, y, 34, y, PA); rect(g, 5, 21, 30, 1, W);
    ell(g, 30, 30, 4, 4, W); line(g, 27, 28, 33, 32, GO); return RG(20, 14, 5, 20, 19, 4, 20, 3); };
  X.x_golf_tee = g => { ell(g, 20, 9, 6, 6, W); dots(g, [[18, 7], [21, 6], [23, 9], [19, 11], [17, 10]], PA); poly(g, [[14, 15], [26, 15], [21, 20], [21, 36], [19, 36], [19, 20]], B); return RG(20, 25, 1, 20, 31, 1, 20, 2); };
  X.x_hula_hoop = g => { ell(g, 20, 20, 17, 13, B); ell(g, 20, 20, 14, 10, E); paintOn(g, (x, y) => ((x + y) % 6 < 3 ? A : null), [B]); return RG(20, 9, 4, 20, 31, 4, 20, 4); };
  X.x_javelin = g => { line(g, 3, 36, 35, 4, B, 2); tri(g, [33, 2], [38, 1], [36, 7], M); rect(g, 17, 18, 5, 4, A); return RG(18, 15, 2, 22, 24, 2, 30, 4); };
  X.x_jump_rope = X.x_skipping_rope = g => { for (const x of [6, 34]) { rrect(g, x - 2, 22, 4, 13, 2, A); rect(g, x - 2, 21, 4, 1, M); } for (let x = 6; x <= 34; x++) gset(g, x, 21 - Math.round(Math.sin((x - 6) / 28 * Math.PI) * 18), B), gset(g, x, 22 - Math.round(Math.sin((x - 6) / 28 * Math.PI) * 18), B);
    return RG(20, 10, 3, 20, 14, 3, 20, 2); };
  const pad = (o) => (g) => { rrect(g, 11, 6, 18, 28, 7, B); rrect(g, 13, 12, 14, o.cap || 12, 5, A); rect(g, 9, o.s1 || 9, 22, 3, K); rect(g, 9, o.s2 || 29, 22, 3, K); if (o.feat) o.feat(g); return RG(20, 17, 3, 20, 22, 3, 20, 3); };
  X.x_knee_pads = pad({}); X.x_elbow_pads = pad({ cap: 9 });
  X.x_shin_guard = g => { poly(g, [[12, 4], [28, 4], [27, 30], [20, 36], [13, 30]], B); for (let y = 8; y < 30; y += 4) line(g, 15, y, 25, y, BD); rect(g, 10, 9, 20, 2, K); rect(g, 10, 24, 20, 2, K); return RG(20, 15, 3, 20, 20, 3, 20, 2); };
  X.x_boxing_glove = g => { ell(g, 19, 16, 12, 11, B); ell(g, 8, 20, 4, 6, B); rect(g, 12, 25, 16, 11, B); rect(g, 12, 28, 16, 3, W); line(g, 14, 16, 26, 16, BL); return RG(21, 13, 3, 21, 20, 3, 19, 5); };
  X.x_mouthguard = g => { ell(g, 20, 20, 15, 11, B); ell(g, 20, 21, 10, 7, E); rect(g, 4, 21, 32, 12, E); for (let i = 0; i < 9; i++) { const a = Math.PI * (0.1 + i * 0.1); ell(g, 20 - Math.cos(a) * 12.5, 21 - Math.sin(a) * 9, 1.5, 1.5, W); } return RG(20, 13, 4, 20, 18, 3, 20, 5); };
  X.x_ski_goggles = g => { line(g, 2, 20, 38, 20, A, 3); rrect(g, 6, 12, 28, 15, 6, B); rrect(g, 8, 14, 24, 11, 5, S); line(g, 10, 15, 16, 21, SL); line(g, 12, 15, 18, 21, W); return RG(20, 19, 6, 20, 24, 4, 20, 8); };
  X.x_swim_goggles = g => { line(g, 2, 21, 38, 21, A); for (const x of [12, 28]) { ell(g, x, 20, 7, 5, B); ell(g, x, 20, 5, 3.5, S); gset(g, x - 2, 18, W); } rect(g, 18, 19, 4, 2, B); return RG(20, 20, 8, 20, 27, 3, 20, 13); };
  X.x_snorkel_mask = g => { rrect(g, 7, 13, 26, 15, 6, B); rrect(g, 9, 15, 22, 10, 4, S); line(g, 11, 16, 15, 22, SL); line(g, 2, 20, 7, 20, A, 2); line(g, 33, 20, 38, 20, A, 2); rect(g, 33, 3, 3, 20, A); rect(g, 32, 2, 5, 2, TO);
    return RG(20, 19, 5, 20, 27, 3, 20, 8); };
  X.x_swim_cap = g => { ell(g, 20, 23, 15, 15, B); rect(g, 4, 28, 32, 12, E); paintOn(g, (x, y) => ((x * 3 + y * 2) % 13 === 0 ? BL : null), [B]); rect(g, 6, 26, 28, 2, BD); return RG(20, 18, 5, 20, 23, 4, 20, 8); };
  X.x_medal_ribbon = g => { poly(g, [[9, 2], [16, 2], [22, 20], [17, 22]], B); poly(g, [[31, 2], [24, 2], [18, 20], [23, 22]], A); ell(g, 20, 28, 8, 8, GO); ell(g, 20, 28, 5.5, 5.5, GO); line(g, 17, 25, 23, 31, W); tri(g, [19, 26], [20, 23], [21, 26], W); return RG(20, 27, 3, 20, 31, 3, 20, 2); };
  X.x_stopwatch_sport = g => { ell(g, 20, 23, 13, 13, B); ell(g, 20, 23, 10, 10, W); rect(g, 18, 4, 4, 6, M); rect(g, 15, 3, 10, 2, M); line(g, 30, 10, 33, 7, M, 2); line(g, 20, 23, 20, 15, K); line(g, 20, 23, 25, 25, TO); for (let i = 0; i < 12; i++) gset(g, 20 + Math.cos(i * 0.52) * 9, 23 + Math.sin(i * 0.52) * 9, K);
    return RG(20, 21, 4, 20, 28, 3, 20, 2); };
  X.x_whistle_sport = g => { rrect(g, 4, 15, 22, 10, 4, B); ell(g, 25, 23, 10, 10, B); ell(g, 25, 23, 4, 4, BD); rect(g, 4, 15, 4, 5, BD); ell(g, 34, 9, 3, 3, M); ell(g, 34, 9, 1.5, 1.5, E); line(g, 30, 14, 33, 11, M); return RG(14, 19, 2, 25, 26, 3, 15, 11); };
  /* --- toys and games --- */
  X.x_barbie_doll = g => { ell(g, 20, 8, 4, 4.5, PA); ell(g, 20, 6, 6, 5, GO); rect(g, 14, 6, 3, 14, GO); rect(g, 23, 6, 3, 14, GO); ell(g, 20, 9, 3.5, 3.5, PA); poly(g, [[16, 14], [24, 14], [23, 22], [27, 30], [13, 30], [17, 22]], B);
    for (const x of [17, 22]) rect(g, x, 30, 2, 7, PA); line(g, 15, 15, 12, 23, PA); line(g, 25, 15, 28, 23, PA); return AN(20, 9, 2, 20, 11, 2, 20, 2, { rigid: true }); };
  X.x_lego_figure = g => { rrect(g, 14, 2, 12, 3, 1, B); rrect(g, 13, 4, 14, 11, 3, GO); rect(g, 11, 15, 18, 10, B); rect(g, 7, 16, 4, 8, B); rect(g, 29, 16, 4, 8, B); ell(g, 9, 25, 2, 2, GO); ell(g, 31, 25, 2, 2, GO); rect(g, 12, 25, 16, 3, A); rect(g, 12, 28, 7, 9, A); rect(g, 21, 28, 7, 9, A);
    return RG(20, 8, 3, 20, 12, 3, 20, 1); };
  X.x_toy_soldier = g => { rrect(g, 15, 1, 10, 10, 3, K); rect(g, 15, 9, 10, 6, PA); rect(g, 14, 15, 12, 11, B); line(g, 14, 15, 26, 25, W); rect(g, 14, 24, 12, 2, K); rect(g, 15, 26, 4, 10, A); rect(g, 21, 26, 4, 10, A); rect(g, 27, 8, 2, 20, MD); rect(g, 11, 16, 3, 9, B);
    return RG(20, 11, 2, 20, 14, 2, 20, 0); };
  X.x_marionette = g => { rect(g, 6, 2, 28, 3, AD); for (const x of [8, 20, 32]) line(g, x, 4, x === 20 ? 20 : x + (x < 20 ? 5 : -5), x === 20 ? 9 : 22, PA); ell(g, 20, 13, 5, 5, PA); rect(g, 15, 18, 10, 10, B); line(g, 15, 19, 12, 25, B, 2); line(g, 25, 19, 28, 25, B, 2); for (const x of [16, 22]) rect(g, x, 28, 2, 8, A);
    return AN(20, 13, 2, 20, 16, 2, 20, 8, { rigid: true }); };
  X.x_puppet = g => { rrect(g, 11, 6, 18, 31, 7, B); ell(g, 20, 13, 7, 6, B); ell(g, 20, 19, 6, 2, TO); for (const x of [12, 28]) ell(g, x, 24, 3, 2, B); rect(g, 10, 33, 20, 4, A); return AN(20, 11, 3, 20, 19, 4, 20, 4, { rigid: true }); };
  X.x_ventriloquist_dummy = g => { ell(g, 20, 12, 8, 9, PA); rrect(g, 12, 2, 16, 6, 3, K); line(g, 15, 15, 15, 21, K); line(g, 25, 15, 25, 21, K); ell(g, 15, 13, 1.5, 1.5, TO); ell(g, 25, 13, 1.5, 1.5, TO); rect(g, 12, 21, 16, 12, B); tri(g, [18, 21], [22, 21], [20, 25], TO); rect(g, 14, 33, 4, 4, K); rect(g, 22, 33, 4, 4, K);
    return RG(20, 10, 3, 20, 17, 3, 20, 1); };
  X.x_doll_house = g => { tri(g, [3, 16], [20, 3], [37, 16], A); rect(g, 6, 16, 28, 21, B); line(g, 6, 26, 33, 26, BD); line(g, 20, 16, 20, 37, BD); for (const [x, y] of [[9, 18], [23, 18], [9, 28]]) { rect(g, x, y, 8, 6, S); rect(g, x + 4, y, 1, 6, BD); } rect(g, 24, 29, 6, 8, AD);
    return RG(20, 10, 3, 20, 13, 3, 20, 2); };
  X.x_chess_board = g => { rect(g, 4, 4, 32, 32, BD); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) rect(g, 5 + c * 3.75, 5 + r * 3.75, 4, 4, (r + c) % 2 ? K : W); return RG(20, 18, 5, 20, 26, 4, 20, 2); };
  X.x_chess_piece = g => { ell(g, 20, 7, 4, 4, B); tri(g, [16, 11], [24, 11], [20, 14], B); rect(g, 15, 13, 10, 2, B); poly(g, [[17, 15], [23, 15], [25, 29], [15, 29]], B); rrect(g, 11, 29, 18, 4, 1, B); rect(g, 9, 33, 22, 3, BD);
    return RG(20, 20, 2, 20, 25, 2, 20, 2); };
  X.x_domino = g => { rrect(g, 11, 2, 18, 36, 3, W); line(g, 12, 20, 28, 20, K); for (const [x, y] of [[15, 6], [20, 11], [25, 16], [15, 24], [25, 24], [15, 33], [25, 33], [20, 28]]) ell(g, x, y, 1.6, 1.6, K); return RG(20, 10, 4, 20, 15, 3, 20, 1); };
  X.x_playing_card = g => { rrect(g, 9, 3, 22, 34, 3, W); for (const [x, y, s] of [[13, 8, 1], [27, 32, -1]]) { ell(g, x - 1, y, 1.5, 1.5, TO); ell(g, x + 1, y, 1.5, 1.5, TO); tri(g, [x - 2.5, y], [x + 2.5, y], [x, y + s * 3], TO); }
    ell(g, 18, 20, 3, 3, TO); ell(g, 22, 20, 3, 3, TO); tri(g, [15, 21], [25, 21], [20, 27], TO); return RG(20, 14, 4, 20, 29, 3, 20, 1); };
  X.x_trading_card = g => { rrect(g, 9, 3, 22, 34, 2, GO); rect(g, 11, 5, 18, 3, B); rect(g, 11, 9, 18, 14, S); ell(g, 20, 17, 5, 4, A); rect(g, 11, 25, 18, 10, PA); for (let y = 27; y < 34; y += 2) line(g, 12, y, 27, y, BD); return RG(20, 15, 3, 20, 19, 2, 20, 1); };
  X.x_sticker = g => { ell(g, 20, 20, 15, 15, W); ell(g, 20, 20, 13, 13, B); poly(g, [[30, 28], [35, 22], [36, 31]], PA); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.257; line(g, 20, 20, 20 + Math.cos(a) * 9, 20 + Math.sin(a) * 9, GO, 2); } return RG(20, 17, 4, 20, 25, 3, 20, 4); };
  X.x_lego_brick = g => { rect(g, 4, 17, 32, 18, B); for (const x of [8, 16, 24, 32]) { rect(g, x - 3, 12, 6, 5, B); rect(g, x - 3, 12, 6, 1, BL); } rect(g, 4, 17, 32, 1, BD); return RG(20, 24, 5, 20, 30, 4, 20, 8); };
  X.x_rubik_cube = g => { const C3 = [TO, W, GO, S, A, BL]; rect(g, 6, 8, 28, 28, K); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rect(g, 7 + c * 9, 9 + r * 9, 8, 8, C3[(r * 2 + c) % 6]);
    poly(g, [[6, 8], [11, 3], [38, 3], [34, 8]], K); for (let c = 0; c < 3; c++) poly(g, [[8 + c * 9, 7], [11 + c * 9, 4], [19 + c * 9, 4], [16 + c * 9, 7]], C3[(c + 3) % 6]); return RG(20, 18, 6, 20, 27, 4, 20, 1); };
  X.puzzle = g => { for (const [x, y, c] of [[5, 6, B], [21, 6, A], [5, 22, A], [21, 22, B]]) rect(g, x, y, 14, 14, c); ell(g, 19, 13, 3, 3, B); ell(g, 12, 21, 3, 3, B); ell(g, 28, 20, 3, 3, A); ell(g, 20, 29, 3, 3, B); return RG(20, 14, 6, 20, 30, 4, 20, 4); };
  X.x_magic_8_ball = g => { ell(g, 20, 20, 15, 15, K); ell(g, 20, 19, 7, 7, S); tri(g, [17, 16], [23, 16], [20, 22], W); ell(g, 13, 11, 2.5, 2, BL); return RG(20, 16, 3, 20, 27, 4, 20, 5); };
  X.x_snow_globe = g => { ell(g, 20, 17, 13, 13, SL); rect(g, 8, 28, 24, 8, B); rect(g, 6, 34, 28, 3, BD); tri(g, [15, 26], [20, 13], [25, 26], S); rect(g, 19, 26, 2, 2, AD); dots(g, [[12, 11], [26, 9], [29, 17], [11, 20], [17, 7], [24, 22]], W); return RG(20, 14, 5, 20, 31, 4, 20, 3); };
  X.x_mobile_toy = g => { line(g, 20, 1, 20, 7, MD); line(g, 6, 7, 34, 7, MD); line(g, 12, 15, 28, 15, MD); line(g, 20, 7, 20, 15, MD);
    for (const [x, y, sh] of [[6, 14, 0], [34, 14, 1], [12, 24, 2], [28, 24, 3]]) { line(g, x, sh < 2 ? 7 : 15, x, y - 3, MD); if (sh === 0) ell(g, x, y, 3, 3, GO); if (sh === 1) tri(g, [x - 3, y + 2], [x, y - 3], [x + 3, y + 2], A); if (sh === 2) ell(g, x, y, 4, 2.5, S); if (sh === 3) { ell(g, x, y, 3, 3, B); } }
    rrect(g, 15, 22, 10, 10, 3, B); return RG(20, 26, 2, 20, 30, 2, 20, 3); };
  X.x_confetti = g => { const C5 = [TO, GO, S, A, B, W]; for (let i = 0; i < 26; i++) { const x = 4 + (i * 13) % 32, y = 3 + (i * 7) % 33; rect(g, x, y, 2 + (i % 2), 2 - (i % 2) + 1, C5[i % 6]); } rrect(g, 13, 14, 14, 14, 4, B); poly(g, [[13, 14], [27, 14], [24, 6], [16, 6]], A);
    return RG(20, 19, 3, 20, 24, 3, 20, 4); };
  X.x_party_hat = g => { tri(g, [7, 35], [20, 5], [33, 35], B); for (let i = 0; i < 4; i++) line(g, 10 + i * 2, 33 - i * 7, 30 - i * 2, 33 - i * 7, A, 2); ell(g, 20, 5, 3, 3, GO); for (let i = 0; i < 8; i++) ell(g, 8 + i * 3.4, 35, 2, 1.5, W); return RG(20, 24, 3, 20, 29, 3, 20, 2); };
  X.i_mask = g => { ell(g, 20, 19, 15, 13, B); for (const x of [13, 27]) ell(g, x, 16, 5, 4, E); ell(g, 20, 27, 5, 2, E); for (const x of [5, 35]) line(g, x, 16, x + (x < 20 ? -3 : 3), 13, A); paintOn(g, (x, y) => (y < 10 && (x + y) % 3 === 0 ? GO : null), [B]); return RG(20, 16, 7, 20, 27, 3, 20, 5); };
  X.i_pinwheel = g => { rect(g, 19, 20, 2, 17, AD); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, b = a + Math.PI / 4; tri(g, [20, 15], [20 + Math.cos(a) * 13, 15 + Math.sin(a) * 13], [20 + Math.cos(b) * 9, 15 + Math.sin(b) * 9], i % 2 ? B : A); } ell(g, 20, 15, 1.5, 1.5, GO);
    return RG(15, 13, 2, 25, 19, 2, 20, 2); };
  X.x_pool_float = g => { ell(g, 20, 22, 17, 11, B); ell(g, 20, 22, 9, 5, E); paintOn(g, (x) => (Math.floor(x / 5) % 2 ? W : null), [B]); return RG(20, 14, 5, 20, 31, 4, 20, 8); };
  X.x_pacifier = g => { ell(g, 20, 21, 13, 8, B); ell(g, 20, 21, 4, 4, A); ell(g, 20, 33, 4, 4, PA); ell(g, 20, 9, 6, 6, A); ell(g, 20, 9, 3.5, 3.5, E); return RG(20, 20, 7, 20, 26, 2, 20, 1); };
  X.x_teether = g => { ell(g, 20, 21, 14, 14, B); ell(g, 20, 21, 8, 8, E); for (let i = 0; i < 6; i++) ell(g, 20 + Math.cos(i) * 11, 21 + Math.sin(i) * 11, 2.5, 2.5, A); return RG(20, 10, 4, 20, 32, 3, 20, 5); };
  X.x_slinky = g => { for (let i = 0; i < 9; i++) { ell(g, 12 + i * 2, 12 + i * 2.5, 9, 3, B); ell(g, 12 + i * 2, 12 + i * 2.5, 7, 1.5, E); } return RG(20, 20, 3, 21, 26, 3, 12, 6); };
  X.x_yo_yo = g => { line(g, 20, 1, 20, 12, PA); ell(g, 20, 23, 13, 13, B); ell(g, 20, 23, 9, 9, A); ell(g, 20, 23, 2, 2, M); return RG(20, 19, 4, 20, 29, 3, 20, 9); };
  X.x_nerf_gun = X.x_toy_gun = g => { rrect(g, 4, 12, 30, 9, 3, B); rect(g, 30, 14, 7, 4, A); rect(g, 8, 9, 14, 4, A); poly(g, [[22, 20], [29, 20], [32, 34], [24, 34]], B); line(g, 18, 21, 20, 26, MD, 2); rect(g, 4, 14, 3, 5, GO); return RG(16, 15, 3, 16, 19, 3, 15, 6); };
  X.x_toy_robot_dog = g => { rrect(g, 13, 15, 20, 12, 3, M); rrect(g, 3, 9, 12, 11, 2, M); rect(g, 4, 12, 9, 4, S); rect(g, 12, 4, 3, 6, MD); for (const x of [15, 20, 26, 30]) { rect(g, x, 27, 3, 8, MD); rect(g, x - 1, 35, 5, 2, B); } line(g, 33, 16, 37, 10, MD, 2); ell(g, 37, 9, 1.5, 1.5, G);
    return RG(8, 13, 2, 7, 18, 2, 9, 5); };
  X.x_wind_up_toy = g => { rrect(g, 9, 9, 22, 22, 6, B); rect(g, 31, 17, 3, 3, M); for (const d of [-1, 1]) ell(g, 36, 18 + d * 3, 2, 3, M); for (const x of [13, 25]) rect(g, x, 31, 4, 5, A); return RG(20, 17, 4, 20, 25, 4, 20, 5); };
  X.x_toy_dinosaur = g => { const r = X.x_t_rex(g); return { ...r, rigid: true }; };
  X.x_xylophone_toy = g => { const C6 = [TO, A, GO, S, B, AL, SL]; for (let i = 0; i < 7; i++) rect(g, 5 + i * 4.3, 10 + i, 3, 22 - i * 2, C6[i]); line(g, 4, 14, 37, 20, MD); line(g, 4, 28, 37, 26, MD); ell(g, 8, 36, 2, 2, B); ell(g, 32, 36, 2, 2, B);
    line(g, 34, 3, 26, 11, AD); ell(g, 26, 11, 2, 2, W); return RG(20, 18, 5, 20, 24, 3, 20, 4); };
  X.x_baby_bottle = g => { tri(g, [17, 6], [23, 6], [20, 1], PA); rect(g, 16, 6, 8, 4, A); rrect(g, 13, 10, 14, 27, 4, W); rect(g, 14, 18, 12, 18, B); for (let y = 14; y < 34; y += 4) line(g, 25, y, 26, y, K); return RG(20, 20, 3, 20, 28, 3, 20, 1); };
  /* --- tools and household items --- */
  X.knife = g => { poly(g, [[3, 20], [8, 15], [26, 15], [26, 22], [8, 22]], M); line(g, 8, 16, 25, 16, W); rrect(g, 26, 15, 12, 7, 2, B); dots(g, [[29, 18], [34, 18]], M); return RG(15, 18, 3, 15, 21, 3, 16, 11); };
  X.saw = g => { poly(g, [[3, 14], [29, 10], [29, 24], [3, 22]], M); for (let x = 4; x < 29; x += 2) tri(g, [x, 22 + (x - 3) * 0.08], [x + 1, 25], [x + 2, 22 + (x - 3) * 0.08], M); rrect(g, 28, 8, 10, 18, 3, B); rect(g, 31, 12, 4, 9, E); return RG(15, 15, 3, 15, 20, 3, 15, 10); };
  X.whisk = g => { rrect(g, 18, 26, 4, 12, 1, B); for (const w of [2, 5, 8]) { ell(g, 20, 14, w, 12, M); ell(g, 20, 14, w - 1, 11, E); } line(g, 20, 2, 20, 26, M); return RG(20, 12, 3, 20, 17, 2, 20, 1); };
  X.paintbrush = g => { line(g, 4, 36, 22, 18, B, 3); rect(g, 21, 13, 6, 8, M); poly(g, [[22, 13], [27, 13], [33, 5], [31, 3], [25, 8]], A); return RG(13, 26, 2, 15, 30, 2, 13, 20); };
  X.i_hook = g => { rect(g, 18, 2, 4, 6, MD); line(g, 20, 8, 20, 24, M, 3); for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; ell(g, 14 + Math.cos(a) * 6, 25 + Math.sin(a) * 6, 1.6, 1.6, M); } tri(g, [7, 25], [10, 19], [11, 25], M); return RG(20, 14, 2, 20, 19, 2, 20, 2); };
  X.i_coil = g => { for (let i = 0; i < 8; i++) { ell(g, 20, 6 + i * 4, 10, 3, M); ell(g, 20, 6 + i * 4, 8, 1.5, E); } line(g, 10, 6, 6, 3, M); line(g, 30, 34, 34, 37, M); return RG(20, 18, 4, 20, 26, 3, 20, 2); };
  X.i_knot = g => { for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2; ell(g, 20 + (Math.sin(t) + 2 * Math.sin(2 * t)) * 4.3, 20 + (Math.cos(t) - 2 * Math.cos(2 * t)) * 4.3, 2.2, 2.2, B); } line(g, 6, 36, 10, 30, B, 2); return RG(20, 18, 3, 20, 24, 2, 20, 4); };
  X.x_rope = g => { for (let r = 0; r < 4; r++) { ell(g, 20, 22, 16 - r * 3.5, 12 - r * 2.6, B); ell(g, 20, 22, 14.5 - r * 3.5, 10.8 - r * 2.6, BD); } ell(g, 20, 22, 3, 2, E); line(g, 33, 18, 38, 6, B, 2); paintOn(g, (x, y) => ((x + y) % 3 === 0 ? BL : null), [B]); return RG(20, 18, 4, 20, 26, 3, 20, 7); };
  X.x_yarn = g => { ell(g, 20, 21, 14, 14, B); for (let i = 0; i < 7; i++) { const a = i * 0.45; line(g, 20 - Math.cos(a) * 13, 21 - Math.sin(a) * 13, 20 + Math.cos(a) * 13, 21 + Math.sin(a) * 13, BD); } line(g, 31, 30, 38, 37, B); return RG(20, 18, 4, 20, 25, 3, 20, 7); };
  X.x_rubber_band = g => { ell(g, 20, 21, 15, 11, B); ell(g, 20, 21, 13, 9, E); return RG(20, 12, 4, 20, 30, 3, 20, 7); };
  X.x_washer = g => { ell(g, 20, 20, 14, 14, M); ell(g, 20, 20, 6, 6, E); return RG(20, 10, 4, 20, 30, 3, 20, 3); };
  X.x_cable = X.x_usb_cable = g => { for (let i = 0; i < 28; i++) ell(g, 6 + i, 22 + Math.sin(i * 0.4) * 7, 1.3, 1.3, B); rect(g, 1, 17, 7, 6, M); rect(g, 2, 18, 3, 4, MD); rect(g, 32, 24, 7, 6, B); rect(g, 35, 25, 3, 4, M); return RG(14, 14, 2, 22, 22, 2, 20, 10); };
  X.x_chopsticks = g => { line(g, 6, 36, 28, 4, B, 2); line(g, 12, 37, 34, 6, B, 2); rect(g, 7, 30, 6, 4, A); return RG(18, 20, 2, 23, 24, 2, 20, 8); };
  X.x_toothpick = g => { line(g, 4, 34, 36, 6, B, 2); return RG(20, 18, 2, 22, 22, 2, 20, 10); };
  X.x_compass = g => { ell(g, 20, 21, 14, 14, M); ell(g, 20, 21, 11, 11, W); tri(g, [20, 11], [17, 21], [23, 21], TO); tri(g, [20, 31], [17, 21], [23, 21], K); ell(g, 20, 21, 1.5, 1.5, GO); ell(g, 20, 6, 3, 2, M); return RG(20, 19, 5, 20, 27, 3, 20, 4); };
  X.x_fishing_reel = g => { rect(g, 4, 12, 32, 3, MD); ell(g, 20, 24, 10, 10, M); ell(g, 20, 24, 6, 6, B); rect(g, 18, 14, 4, 4, MD); line(g, 30, 24, 36, 30, MD, 2); ell(g, 36, 31, 2, 2, A); for (let i = 0; i < 6; i++) gset(g, 14 + i * 2, 24, PA); return RG(20, 22, 3, 20, 28, 3, 20, 9); };
  X.x_flower_pot_saucer = g => { ell(g, 20, 24, 17, 6, B); ell(g, 20, 22, 14, 4, BD); ell(g, 20, 21, 12, 2.5, B); return RG(20, 22, 6, 20, 27, 4, 20, 16); };
  X.x_garden_gnome = g => { tri(g, [12, 15], [20, 1], [28, 15], TO); ell(g, 20, 17, 6, 4, PA); poly(g, [[14, 18], [26, 18], [24, 31], [16, 31]], W); rrect(g, 12, 24, 16, 11, 4, B); rect(g, 13, 34, 6, 3, K); rect(g, 21, 34, 6, 3, K); ell(g, 20, 19, 2, 1.5, TO);
    return AN(20, 16, 2, 20, 21, 2, 20, 4, { rigid: true }); };
  X.x_garlic_press = g => { line(g, 4, 18, 30, 14, M, 3); line(g, 4, 25, 30, 20, M, 3); rrect(g, 26, 10, 10, 14, 2, MD); rect(g, 28, 12, 6, 10, M); dots(g, [[30, 14], [32, 16], [30, 18], [32, 20]], K); rect(g, 2, 16, 8, 3, B); rect(g, 2, 23, 8, 3, B); return RG(16, 17, 2, 16, 22, 2, 16, 11); };
  X.x_nutcracker = g => { rrect(g, 13, 3, 14, 7, 2, TO); rect(g, 12, 9, 16, 2, GO); ell(g, 20, 15, 6, 5, PA); rect(g, 15, 19, 10, 3, W); rect(g, 13, 22, 14, 10, B); for (let y = 23; y < 31; y += 3) line(g, 14, y, 26, y, GO); rect(g, 14, 32, 5, 5, K); rect(g, 21, 32, 5, 5, K);
    return RG(20, 14, 3, 20, 20, 3, 20, 1); };
  X.x_peeler = g => { rrect(g, 3, 17, 18, 6, 3, B); ell(g, 8, 20, 1.5, 1.5, E); line(g, 21, 15, 34, 15, M); line(g, 21, 25, 34, 25, M); line(g, 34, 15, 34, 25, M); rect(g, 22, 19, 12, 2, M); for (let x = 23; x < 34; x += 2) gset(g, x, 18, MD); return RG(13, 19, 2, 13, 22, 2, 13, 12); };
  X.i_pencil_sharpener = X.x_sharpener = g => { rrect(g, 9, 13, 22, 18, 3, B); ell(g, 13, 22, 3, 3, K); tri(g, [1, 22], [10, 19], [10, 25], PA); line(g, 1, 22, 4, 22, K); rect(g, 22, 17, 7, 8, M); return RG(22, 19, 3, 22, 26, 3, 20, 8); };
  X.i_mousetrap = g => { rect(g, 3, 26, 34, 8, PA); rect(g, 6, 22, 28, 4, M); ell(g, 6, 24, 2, 2, M); ell(g, 34, 24, 2, 2, M); rect(g, 6, 14, 2, 10, M); rect(g, 6, 14, 26, 2, M); tri(g, [24, 26], [30, 20], [33, 26], GO); dots(g, [[28, 23], [31, 24]], BD);
    return RG(20, 29, 5, 20, 32, 4, 20, 10); };
  X.i_swing = g => { line(g, 3, 37, 9, 3, BD, 2); line(g, 37, 37, 31, 3, BD, 2); rect(g, 7, 2, 26, 2, BD); line(g, 15, 4, 15, 26, M); line(g, 25, 4, 25, 26, M); rect(g, 12, 26, 16, 3, B); return RG(20, 14, 3, 20, 20, 2, 20, 4); };
  X.i_tripod = g => { rrect(g, 13, 6, 14, 8, 2, MD); line(g, 20, 14, 20, 20, M, 2); line(g, 20, 20, 7, 37, M, 2); line(g, 20, 20, 33, 37, M, 2); line(g, 20, 20, 20, 37, M); rect(g, 26, 9, 5, 3, MD); return RG(20, 9, 3, 20, 12, 2, 20, 2); };
  X.i_wing = g => { poly(g, [[4, 22], [12, 14], [36, 6], [34, 12], [24, 18], [30, 18], [20, 24], [26, 26], [14, 28]], B); for (let i = 0; i < 4; i++) line(g, 12, 20 + i, 30 - i * 3, 8 + i * 5, BD); return RG(14, 20, 2, 14, 24, 3, 18, 12); };
  X.x_bird_feeder = g => { tri(g, [6, 12], [20, 3], [34, 12], A); rect(g, 10, 12, 20, 17, SL); rect(g, 10, 22, 20, 7, GO); paintOn(g, (x, y) => ((x + y) % 2 ? BD : null), [GO]); rect(g, 6, 29, 28, 3, B); line(g, 20, 1, 20, 3, MD); for (const x of [4, 36]) rect(g, x - 1, 28, 2, 2, B);
    return RG(20, 16, 4, 20, 20, 3, 20, 1); };
  X.x_birdhouse = g => { tri(g, [5, 15], [20, 3], [35, 15], A); rect(g, 9, 15, 22, 18, B); ell(g, 20, 21, 4, 4, K); rect(g, 19, 27, 2, 4, BD); rect(g, 19, 33, 2, 5, BD); return RG(20, 14, 5, 20, 30, 3, 20, 2); };
  X.x_shed = g => { poly(g, [[3, 16], [20, 6], [37, 16]], A); rect(g, 5, 16, 30, 21, B); C.slats(g, 5, 16, 30, 21, 8); rect(g, 15, 22, 10, 15, BD); rect(g, 7, 20, 6, 5, S); return RG(20, 12, 4, 20, 19, 3, 20, 4); };
  X.x_gutter = g => { rect(g, 2, 8, 36, 6, M); rect(g, 2, 8, 36, 1, MD); rect(g, 28, 14, 6, 22, M); rect(g, 26, 34, 10, 3, M); dots(g, [[29, 37], [31, 38]], SL); return RG(15, 10, 4, 15, 13, 3, 15, 4); };
  X.x_manhole = g => { ell(g, 20, 20, 16, 16, MD); ell(g, 20, 20, 14, 14, M); for (let y = 10; y < 31; y += 4) line(g, 8, y, 32, y, MD); for (let x = 10; x < 31; x += 4) line(g, x, 7, x, 33, MD); return RG(20, 17, 5, 20, 26, 4, 20, 4); };
  X.x_hearing_aid = g => { ell(g, 24, 16, 8, 11, B); ell(g, 24, 16, 4, 7, E); line(g, 17, 20, 12, 30, B, 3); ell(g, 11, 31, 4, 4, B); ell(g, 11, 31, 2, 2, K); return RG(24, 12, 2, 24, 22, 2, 24, 4); };
  X.x_hedge_trimmer = g => { rrect(g, 24, 13, 14, 12, 3, B); rect(g, 26, 9, 8, 4, BD); rect(g, 2, 17, 23, 5, M); for (let x = 3; x < 24; x += 3) { gset(g, x, 16, M); gset(g, x, 22, M); } return RG(31, 18, 2, 31, 22, 2, 30, 6); };
  X.x_leaf_blower = g => { rrect(g, 18, 11, 18, 16, 5, B); rect(g, 2, 21, 18, 6, M); rect(g, 22, 6, 10, 5, BD); line(g, 2, 22, 2, 26, MD); dots(g, [[3, 31], [6, 34], [1, 36]], S); return RG(27, 17, 3, 27, 22, 3, 27, 6); };
  X.x_pressure_washer = g => { rrect(g, 6, 14, 18, 18, 3, B); for (const x of [8, 22]) ell(g, x, 33, 3, 3, K); rect(g, 10, 8, 2, 6, MD); rect(g, 10, 8, 10, 2, MD); line(g, 24, 22, 32, 28, A, 2); line(g, 32, 28, 37, 17, M, 2); dots(g, [[37, 13], [36, 10], [38, 15]], SL); return RG(15, 20, 3, 15, 26, 3, 15, 10); };
  X.x_soldering_iron = g => { line(g, 4, 34, 18, 20, B, 4); rect(g, 17, 16, 5, 5, MD); line(g, 21, 17, 34, 4, M, 2); gset(g, 35, 3, G); dots(g, [[34, 1], [36, 2]], ST); return RG(11, 25, 2, 12, 29, 2, 11, 19); };
  X.x_laser_pointer = g => { rrect(g, 6, 18, 20, 6, 3, M); rect(g, 13, 18, 3, 2, TO); line(g, 26, 21, 38, 21, TO); ell(g, 37, 21, 1.5, 1.5, G); return RG(15, 21, 2, 15, 23, 2, 15, 14); };
  X.x_life_jacket = g => { const r = top(g, { sleeve: 'none', neck: 'v', w0: 9, w1: 10, y1: 32 }); paintOn(g, () => null, []); for (const y of [16, 24]) { line(g, 10, y, 30, y, K, 2); rect(g, 18, y - 1, 4, 3, M); } rect(g, 11, 10, 2, 20, W); rect(g, 27, 10, 2, 20, W); return r; };
  X.x_oven_mitt = g => { rrect(g, 10, 8, 18, 26, 8, B); ell(g, 9, 21, 4, 6, B); rect(g, 10, 30, 18, 7, A); paintOn(g, (x, y) => ((x + y) % 4 === 0 ? BL : null), [B]); return RG(20, 17, 3, 20, 24, 3, 19, 4); };
  X.x_microscope = g => { rect(g, 6, 33, 26, 4, MD); line(g, 26, 33, 26, 14, MD, 3); line(g, 26, 14, 18, 6, MD, 3); rect(g, 14, 2, 6, 5, K); rrect(g, 13, 12, 7, 12, 2, B); rect(g, 15, 24, 3, 3, M); rect(g, 9, 27, 16, 2, M); return RG(16, 15, 1, 16, 20, 2, 16, 1); };
  X.x_petri_dish = g => { ell(g, 20, 22, 17, 9, SL); ell(g, 20, 21, 15, 7, W); for (const [x, y, r] of [[13, 20, 2], [24, 23, 3], [18, 25, 1.5], [27, 18, 1.5]]) ell(g, x, y, r, r * 0.7, B); return RG(20, 19, 5, 20, 25, 4, 20, 12); };
  X.x_paint_can = g => { rrect(g, 9, 11, 22, 25, 2, M); ell(g, 20, 11, 11, 3, MD); rect(g, 9, 18, 22, 12, B); poly(g, [[9, 11], [16, 11], [15, 18], [12, 14], [9, 17]], B); line(g, 8, 11, 20, 2, MD); line(g, 20, 2, 32, 11, MD); return RG(20, 22, 4, 20, 27, 3, 20, 6); };
  X.x_paint_tube = g => { poly(g, [[5, 14], [27, 14], [33, 18], [33, 22], [27, 26], [5, 26], [7, 20]], B); rect(g, 33, 18, 5, 4, A); rect(g, 10, 17, 12, 6, PA); line(g, 5, 14, 5, 26, BD); return RG(18, 19, 3, 18, 23, 3, 18, 10); };
  X.x_sandpaper = g => { rect(g, 6, 6, 28, 28, B); paintOn(g, (x, y) => ((x * 7 + y * 13) % 5 === 0 ? BD : (x * 3 + y) % 7 === 0 ? BL : null), [B]); poly(g, [[34, 26], [34, 34], [26, 34]], PA); return RG(20, 17, 5, 20, 25, 4, 20, 2); };
  X.x_sleeping_mat = g => { ell(g, 9, 20, 7, 12, B); ell(g, 9, 20, 4, 9, BD); rect(g, 9, 8, 26, 24, B); for (let y = 11; y < 32; y += 4) line(g, 15, y, 35, y, BD); rect(g, 20, 6, 3, 28, A); return RG(26, 17, 4, 26, 24, 3, 26, 5); };
  const board = (o) => (g) => { const len = o.len || 34; rrect(g, 20 - len / 2, 17, len, o.w || 6, 3, B); if (o.tip) ell(g, 20 - len / 2 + 1, 17, 3, 2, B); if (o.feat) o.feat(g); return RG(20, 19, 4, 20, 22, 3, 20, 12); };
  X.x_ski = board({ len: 36, w: 4, tip: true, feat: g => { rect(g, 16, 14, 8, 3, MD); rect(g, 17, 13, 6, 1, A); line(g, 4, 18, 36, 18, A); } });
  X.x_snowboard = board({ len: 36, w: 9, feat: g => { for (const x of [12, 26]) { rect(g, x - 2, 15, 5, 4, K); rect(g, x - 2, 14, 5, 1, MD); } line(g, 8, 21, 32, 21, A, 2); } });
  X.x_surfboard = g => { for (let i = 0; i < 34; i++) { const t = i / 33, w = Math.sin(t * Math.PI) * 6 + 1; line(g, 20 - w, 3 + i, 20 + w, 3 + i, B); } line(g, 20, 4, 20, 35, A); tri(g, [18, 34], [20, 38], [22, 34], BD); return RG(20, 16, 3, 20, 22, 2, 20, 2); };
  X.x_sled = g => { rect(g, 6, 18, 28, 6, B); C.slats(g, 6, 18, 28, 6, 6); for (const x of [10, 26]) rect(g, x, 24, 2, 5, MD); line(g, 4, 29, 33, 29, M, 2); line(g, 4, 29, 2, 25, M, 2); line(g, 2, 25, 6, 21, A); return RG(20, 20, 4, 20, 23, 3, 20, 14); };
  X.x_stamp = g => { rect(g, 8, 26, 24, 6, BD); rect(g, 6, 32, 28, 3, K); rect(g, 15, 14, 10, 12, B); ell(g, 20, 9, 7, 6, B); return RG(20, 18, 2, 20, 23, 2, 20, 3); };
  X.x_sticky_note = g => { rect(g, 6, 5, 28, 29, B); poly(g, [[34, 26], [34, 34], [26, 34]], BD); for (let y = 12; y < 26; y += 4) line(g, 10, y, 28, y, BD); return RG(20, 16, 5, 20, 22, 3, 20, 2); };
  X.x_tape_gun = g => { ell(g, 22, 15, 11, 11, B); ell(g, 22, 15, 5, 5, M); rect(g, 6, 23, 18, 5, MD); rect(g, 13, 27, 6, 10, BD); line(g, 4, 21, 4, 27, M); line(g, 5, 23, 11, 20, SL); return RG(22, 13, 3, 22, 19, 2, 22, 3); };
  X.x_walkie_talkie = g => { rrect(g, 11, 10, 18, 27, 3, B); rect(g, 13, 2, 3, 9, K); rect(g, 13, 13, 14, 8, MD); for (let y = 14; y < 21; y += 2) line(g, 14, y, 25, y, M); rect(g, 13, 24, 14, 6, S); ell(g, 25, 9, 2, 2, A); return RG(20, 26, 3, 20, 33, 3, 20, 6); };
  X.x_wall_lamp = g => { rect(g, 3, 8, 4, 12, MD); line(g, 6, 14, 18, 12, M, 2); tri(g, [12, 22], [20, 8], [28, 22], B); ell(g, 20, 23, 5, 2, G); dots(g, [[20, 27], [16, 29], [24, 29]], G); return RG(20, 16, 3, 20, 20, 3, 20, 6); };
  X.x_chandelier = g => { line(g, 20, 1, 20, 9, GO); ell(g, 20, 13, 6, 4, GO); for (const d of [-14, -7, 0, 7, 14]) { line(g, 20, 14, 20 + d, 20 - Math.abs(d) * 0.2, GO); rect(g, 19 + d, 15 - Math.abs(d) * 0.2, 2, 5, W); ell(g, 20 + d, 13 - Math.abs(d) * 0.2, 1, 2, G); }
    for (const d of [-10, -3, 4, 11]) for (let k = 0; k < 3; k++) gset(g, 20 + d, 24 + k * 2, SL); ell(g, 20, 22, 4, 4, GO); return RG(20, 12, 2, 20, 23, 2, 20, 1); };
  /* --- small items --- */
  X.x_comb = g => { rect(g, 4, 12, 32, 6, B); for (let x = 5; x < 35; x += 2) rect(g, x, 18, 1, 10 - (x < 18 ? 0 : 3), B); return RG(20, 14, 5, 20, 16, 3, 20, 8); };
  X.x_hair_brush = g => { rrect(g, 4, 9, 18, 18, 8, B); rect(g, 6, 12, 14, 12, PA); dots(g, Array.from({ length: 16 }, (_, i) => [7 + (i % 4) * 4, 13 + Math.floor(i / 4) * 3]), K); line(g, 20, 20, 36, 30, B, 4); return RG(13, 16, 3, 13, 22, 3, 13, 5); };
  X.x_eyeliner = g => { rect(g, 6, 18, 26, 5, B); tri(g, [32, 18], [37, 20], [32, 23], AD); rect(g, 2, 17, 8, 7, K); return RG(19, 19, 3, 19, 22, 2, 19, 13); };
  X.x_nail_polish = g => { rrect(g, 10, 20, 20, 16, 4, B); rect(g, 15, 5, 10, 15, K); rect(g, 15, 18, 10, 2, MD); line(g, 13, 23, 13, 31, BL); return RG(20, 25, 4, 20, 31, 3, 20, 2); };
  X.x_nail_clippers = g => { poly(g, [[4, 18], [30, 15], [32, 19], [4, 21]], M); poly(g, [[4, 23], [30, 22], [32, 19], [4, 26]], MD); line(g, 30, 15, 12, 9, M, 2); ell(g, 30, 19, 2, 2, MD); return RG(16, 19, 2, 16, 24, 3, 16, 12); };
  X.x_razor = g => { rect(g, 6, 9, 28, 6, B); rect(g, 7, 15, 26, 2, M); rect(g, 7, 17, 26, 1, SL); line(g, 20, 15, 20, 37, B, 3); return RG(20, 11, 4, 20, 13, 3, 20, 4); };
  X.x_lighter = g => { rrect(g, 13, 14, 14, 23, 2, B); rect(g, 14, 9, 12, 6, M); ell(g, 17, 11, 2, 2, MD); ell(g, 22, 6, 2, 4, G); ell(g, 22, 7, 1, 2, W); return RG(20, 22, 3, 20, 29, 3, 20, 4); };
  X.x_zippo = g => { rrect(g, 11, 15, 18, 22, 2, M); rect(g, 11, 7, 18, 8, M); line(g, 11, 15, 29, 15, MD); for (let x = 21; x < 28; x += 2) gset(g, x, 9, MD); ell(g, 16, 6, 2, 3, G); return RG(20, 23, 4, 20, 30, 3, 20, 3); };
  X.x_matches = g => { rect(g, 6, 16, 28, 18, B); rect(g, 6, 16, 28, 3, BD); rect(g, 6, 31, 28, 3, K); for (let i = 0; i < 6; i++) { rect(g, 9 + i * 4, 8, 2, 9, PA); ell(g, 10 + i * 4, 7, 1.5, 2, TO); } return RG(20, 23, 5, 20, 28, 4, 20, 3); };
  X.x_cigarette = g => { rect(g, 3, 17, 34, 6, W); rect(g, 27, 17, 10, 6, GO); rect(g, 3, 17, 2, 6, TO); dots(g, [[2, 12], [3, 9], [1, 6]], ST); return RG(16, 19, 3, 16, 21, 3, 16, 13); };
  X.x_vape = g => { rrect(g, 13, 8, 14, 26, 3, B); rect(g, 16, 2, 8, 6, K); rect(g, 15, 14, 10, 6, S); ell(g, 20, 27, 2, 2, G); dots(g, [[19, 0], [22, 1]], ST); return RG(20, 16, 3, 20, 23, 2, 20, 1); };
  X.x_pipe = g => { rrect(g, 22, 13, 12, 17, 3, B); ell(g, 28, 13, 6, 2, K); line(g, 3, 20, 22, 25, B, 3); rect(g, 2, 18, 5, 4, K); dots(g, [[28, 9], [30, 6], [27, 3]], ST); return RG(28, 20, 2, 28, 25, 2, 28, 5); };
  X.x_dice = g => { rrect(g, 7, 7, 26, 26, 4, W); for (const [x, y] of [[13, 13], [27, 13], [20, 20], [13, 27], [27, 27]]) ell(g, x, y, 2, 2, K); return RG(20, 14, 5, 20, 26, 3, 20, 2); };
  X.x_marble = g => { ell(g, 20, 20, 15, 15, SL); for (let i = 0; i < 3; i++) { const a = i * 2.1; poly(g, [[20, 20], [20 + Math.cos(a) * 13, 20 + Math.sin(a) * 13], [20 + Math.cos(a + 0.6) * 12, 20 + Math.sin(a + 0.6) * 12]], B); } ell(g, 13, 13, 3, 2, W); return RG(20, 18, 4, 20, 26, 3, 20, 5); };
  X.x_keyring = g => { ell(g, 14, 12, 9, 9, M); ell(g, 14, 12, 7, 7, E); for (const [a, l] of [[0.8, 20], [1.3, 17]]) { const x = 14 + Math.cos(a) * 8, y = 12 + Math.sin(a) * 8; line(g, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, GO, 2); ell(g, x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 3, GO); }
    rrect(g, 24, 24, 12, 12, 3, B); return RG(30, 28, 2, 30, 32, 2, 30, 20); };
  X.x_usb_key = g => { rrect(g, 4, 14, 22, 12, 3, B); rect(g, 26, 16, 10, 8, M); dots(g, [[29, 18], [33, 18]], K); ell(g, 7, 20, 1.5, 1.5, E); return RG(15, 18, 3, 15, 22, 3, 15, 10); };
  X.x_sim_card = g => { poly(g, [[8, 5], [26, 5], [32, 11], [32, 35], [8, 35]], B); rrect(g, 13, 14, 14, 14, 2, GO); line(g, 13, 21, 27, 21, AD); line(g, 20, 14, 20, 28, AD); return RG(20, 10, 4, 20, 31, 3, 20, 2); };
  X.x_id_card = g => { rrect(g, 4, 9, 32, 22, 2, W); rect(g, 4, 9, 32, 5, B); rect(g, 7, 16, 9, 11, PA); ell(g, 11, 20, 2.5, 2.5, BD); for (let y = 17; y < 28; y += 3) line(g, 19, y, 32, y, BD); return RG(26, 17, 3, 26, 26, 3, 20, 4); };
  X.x_ticket = g => { rect(g, 3, 10, 34, 20, B); for (const x of [3, 37]) ell(g, x, 20, 3, 3, E); for (let y = 11; y < 30; y += 2) gset(g, 28, y, BD); rect(g, 8, 13, 16, 3, PA); return RG(16, 20, 3, 16, 25, 3, 16, 7); };
  X.x_receipt = g => { rect(g, 9, 2, 22, 34, W); for (let x = 9; x < 31; x += 2) gset(g, x, 36, W); for (let y = 6; y < 30; y += 3) line(g, 12, y, 12 + ((y * 7) % 14), y, PA); line(g, 22, 31, 28, 31, K); return RG(20, 14, 4, 20, 22, 3, 20, 1); };
  X.x_necklace = g => { for (let i = 0; i <= 24; i++) { const a = Math.PI * (0.1 + 0.8 * i / 24); ell(g, 20 - Math.cos(a) * 14, 6 + Math.sin(a) * 18, 1.5, 1.5, i % 2 ? W : PA); } ell(g, 20, 27, 5, 5, B); ell(g, 20, 27, 2.5, 2.5, BL); return RG(20, 27, 2, 20, 30, 2, 20, 18); };
  X.x_pendant = g => { line(g, 10, 2, 20, 16, GO); line(g, 30, 2, 20, 16, GO); poly(g, [[20, 15], [30, 24], [20, 37], [10, 24]], B); poly(g, [[20, 18], [26, 24], [20, 32], [14, 24]], BL); return RG(20, 23, 3, 20, 29, 2, 20, 14); };
  X.x_charm_bracelet = g => { ell(g, 20, 16, 14, 9, GO); ell(g, 20, 16, 12, 7, E); for (const [x, y, k] of [[10, 25, 0], [20, 28, 1], [30, 25, 2]]) { line(g, x, y - 3, x, y - 1, GO); if (k === 0) { ell(g, x - 1, y + 1, 2, 2, TO); ell(g, x + 1, y + 1, 2, 2, TO); tri(g, [x - 3, y + 1], [x + 3, y + 1], [x, y + 5], TO); } if (k === 1) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.257; line(g, x, y + 2, x + Math.cos(a) * 3, y + 2 + Math.sin(a) * 3, S); } if (k === 2) ell(g, x, y + 2, 2.5, 2.5, B); }
    return RG(20, 10, 4, 20, 22, 2, 20, 4); };
  X.x_cufflink = g => { ell(g, 20, 15, 10, 10, GO); ell(g, 20, 15, 7, 7, B); rect(g, 18, 25, 4, 6, GO); rrect(g, 14, 31, 12, 4, 2, GO); return RG(20, 14, 3, 20, 19, 2, 20, 3); };
  X.x_pocket_watch = g => { ell(g, 20, 23, 13, 13, GO); ell(g, 20, 23, 10, 10, W); rect(g, 18, 6, 4, 5, GO); for (let x = 18; x < 37; x++) gset(g, x, 4 + Math.round(Math.sin((x - 18) * 0.35) * 2), GO); line(g, 20, 23, 20, 16, K); line(g, 20, 23, 25, 23, K); for (let i = 0; i < 12; i++) gset(g, 20 + Math.cos(i * 0.52) * 8.5, 23 + Math.sin(i * 0.52) * 8.5, K);
    return RG(20, 21, 4, 20, 28, 3, 20, 3); };
  X.x_stopwatch = X.x_stopwatch_sport;
  X.x_compass_small = X.x_compass;
  X.x_whistle_small = X.x_whistle_sport;
  X.x_harmonica_small = g => { rect(g, 3, 13, 34, 14, M); rect(g, 3, 13, 34, 3, MD); rect(g, 3, 24, 34, 3, MD); for (let x = 5; x < 36; x += 3) rect(g, x, 18, 2, 4, K); return RG(20, 15, 5, 20, 26, 4, 20, 8); };
  X.i_oxygen_mask = g => { poly(g, [[12, 8], [28, 8], [32, 22], [20, 30], [8, 22]], SL); poly(g, [[14, 10], [26, 10], [29, 21], [20, 27], [11, 21]], W); line(g, 2, 14, 12, 14, A); line(g, 28, 14, 38, 14, A); line(g, 20, 30, 24, 38, B, 3); return RG(20, 16, 3, 20, 22, 3, 20, 4); };
  X.i_snorkel = g => { rect(g, 25, 2, 4, 26, B); line(g, 27, 28, 20, 34, B, 4); rect(g, 15, 30, 7, 6, A); rect(g, 24, 1, 6, 3, TO); return RG(27, 12, 1, 27, 18, 2, 27, 0); };
  /* --- vehicles (side view, facing left) --- */
  function car(g, o) { // profile points (top outline from front to back) + wheels
    const yb = o.yb || 29, wr = o.wr || 4, wx = o.wx || [10, 30];
    poly(g, [[o.x0 || 3, yb], ...(o.prof || [[3, 22], [9, 20], [13, 13], [27, 13], [32, 20], [37, 21]]), [o.x1 || 37, yb]], B);
    if (o.win !== false) for (const w of o.win || [[14, 14, 6, 5], [22, 14, 5, 5]]) C.window(g, ...w);
    if (o.feat) o.feat(g, yb);
    for (const x of wx) C.wheel(g, x, yb, wr); rect(g, 2, yb - 4, 2, 2, GO);
    return RG(o.ex || 20, o.ey || yb - 5, o.span || 3, o.mx || 20, o.my || yb - 2, 4, o.tx || 20, o.ty || 9);
  }
  X.x_coupe = g => car(g, { prof: [[3, 23], [10, 21], [15, 15], [25, 15], [33, 21], [37, 22]], win: [[16, 16, 8, 4]] });
  X.x_hatchback_car = g => car(g, { prof: [[3, 23], [9, 21], [13, 13], [33, 13], [36, 18], [36, 22]], win: [[14, 14, 7, 5], [23, 14, 9, 5]] });
  X.x_station_wagon_car = g => car(g, { prof: [[3, 23], [9, 21], [12, 14], [36, 14], [37, 23]], win: [[13, 15, 6, 5], [21, 15, 6, 5], [29, 15, 6, 5]] });
  X.x_electric_car = g => car(g, { prof: [[3, 24], [8, 21], [14, 14], [26, 14], [34, 20], [37, 22]], win: [[15, 15, 10, 5]], feat: (g, yb) => { line(g, 24, 22, 22, 25, G); line(g, 22, 25, 25, 25, G); line(g, 25, 25, 23, 28, G); } });
  X.x_limousine = g => car(g, { wx: [7, 33], wr: 3.5, prof: [[2, 24], [5, 21], [8, 16], [33, 16], [36, 21], [38, 22]], x0: 2, x1: 38, win: [[9, 17, 5, 4], [16, 17, 5, 4], [23, 17, 5, 4], [30, 17, 4, 4]], ty: 12 });
  X.x_rally_car = g => car(g, { prof: [[3, 23], [9, 20], [13, 13], [29, 13], [34, 19], [37, 19], [37, 23]], feat: (g, yb) => { ell(g, 22, 22, 3.5, 3.5, W); rect(g, 21, 21, 2, 3, K); line(g, 3, 25, 37, 25, A, 2); rect(g, 33, 11, 5, 2, BD); } });
  X.x_hot_rod = g => car(g, { wx: [9, 31], wr: 5, prof: [[3, 22], [17, 20], [20, 13], [29, 13], [33, 19], [37, 20]], win: [[21, 14, 6, 4]], feat: (g) => { for (let x = 4; x < 18; x += 3) tri(g, [x, 21], [x + 3, 21], [x + 2, 24], TO); rect(g, 13, 15, 2, 5, M); rect(g, 16, 15, 2, 5, M); } });
  X.i_model_t = g => car(g, { wr: 5, prof: [[4, 23], [8, 20], [14, 20], [15, 10], [30, 10], [30, 22], [36, 22]], win: [[17, 12, 10, 6]], feat: (g) => { rect(g, 14, 9, 17, 2, K); rect(g, 3, 18, 3, 6, M); } });
  X.x_formula_one_car = g => { poly(g, [[2, 26], [12, 22], [26, 21], [34, 18], [38, 26]], B); rect(g, 33, 13, 5, 3, BD); rect(g, 35, 15, 2, 5, BD); rect(g, 1, 25, 7, 2, BD); ell(g, 22, 20, 3, 2, K); for (const x of [10, 30]) C.wheel(g, x, 28, 5); return RG(19, 24, 3, 19, 27, 3, 22, 14); };
  X.x_monster_truck = g => { const r = car(g, { yb: 23, wr: 8, wx: [10, 30], prof: [[4, 18], [10, 16], [13, 9], [26, 9], [28, 15], [36, 15], [36, 18]], win: [[14, 10, 6, 4], [21, 10, 4, 4]] }); for (const x of [10, 30]) { C.wheel(g, x, 29, 8); paintOn(g, (xx, y) => ((xx + y) % 3 === 0 ? K : null), [MD]); } return { ...r, eyes: { x: 20, y: 18, span: 3 }, mouth: { x: 20, y: 21, w: 3 } }; };
  X.garbage_truck = g => car(g, { prof: [[3, 23], [4, 14], [12, 13], [12, 10], [37, 10], [37, 23]], win: [[5, 15, 6, 5]], feat: (g) => { C.slats(g, 13, 11, 24, 12, 5); rect(g, 35, 18, 3, 8, MD); C.light(g, 6, 11); } });
  X.x_street_sweeper = g => car(g, { prof: [[3, 23], [4, 12], [14, 11], [14, 16], [37, 16], [37, 25]], win: [[5, 13, 8, 6]], feat: (g, yb) => { for (const x of [14, 22]) { ell(g, x, yb + 3, 4, 2, A); for (let i = -3; i <= 3; i += 2) gset(g, x + i, yb + 5, A); } } });
  X.x_combine_harvester = X.i_harvester = g => car(g, { wx: [14, 31], wr: 6, prof: [[10, 25], [14, 14], [20, 14], [20, 7], [30, 7], [30, 13], [37, 13], [37, 25]], win: [[21, 8, 8, 5]], x0: 10, feat: (g) => { rect(g, 1, 24, 11, 6, A); for (let x = 2; x < 11; x += 2) line(g, x, 24, x, 29, AD); rect(g, 32, 4, 3, 9, MD); line(g, 34, 4, 38, 2, MD); } });
  X.i_mobile_home = g => car(g, { wx: [14, 22], wr: 3.5, prof: [[3, 27], [3, 9], [37, 9], [37, 27]], win: [[6, 13, 6, 5], [26, 13, 7, 5]], feat: (g) => { rect(g, 15, 13, 6, 12, BD); line(g, 3, 20, 37, 20, A, 2); rect(g, 37, 24, 2, 2, MD); } });
  X.x_tuk_tuk = g => car(g, { wx: [10, 30], wr: 3.5, prof: [[4, 26], [5, 16], [12, 9], [36, 9], [36, 26]], win: [[7, 13, 6, 6]], feat: (g) => { rect(g, 4, 8, 33, 3, A); rect(g, 18, 12, 14, 9, E); rect(g, 19, 17, 12, 4, BD); } });
  X.x_rickshaw = g => { line(g, 2, 24, 20, 24, BD, 2); rect(g, 20, 14, 14, 11, B); poly(g, [[18, 14], [26, 4], [36, 6], [36, 14]], A); C.wheel(g, 28, 29, 7); paintOn(g, (x, y) => ((Math.atan2(y - 29, x - 28) * 3 | 0) % 2 ? null : MD), []); return RG(27, 18, 3, 27, 22, 3, 28, 4); };
  X.i_horse_cart = X.i_oxcart = g => { line(g, 1, 24, 20, 24, BD, 2); rect(g, 15, 15, 22, 10, B); C.slats(g, 15, 15, 22, 10, 5); C.wheel(g, 26, 28, 8); for (let i = 0; i < 8; i++) line(g, 26, 28, 26 + Math.cos(i * 0.785) * 7, 28 + Math.sin(i * 0.785) * 7, BD); return RG(26, 18, 3, 26, 22, 3, 26, 10); };
  X.i_hay = g => { rrect(g, 4, 10, 32, 24, 4, GO); for (let y = 12; y < 33; y += 2) line(g, 5, y, 35, y + (y % 4 ? 1 : -1), AD); for (const x of [12, 28]) rect(g, x, 10, 2, 24, B); return RG(20, 19, 5, 20, 26, 4, 20, 5); };
  X.x_pram = X.x_baby_carriage = g => { ell(g, 19, 21, 12, 9, B); rect(g, 6, 13, 26, 9, E); poly(g, [[7, 21], [12, 9], [21, 6], [21, 21]], A); rect(g, 7, 20, 25, 2, B); line(g, 31, 20, 36, 10, M, 2); rect(g, 34, 8, 4, 2, K); for (const x of [10, 28]) C.wheel(g, x, 33, 4); line(g, 10, 29, 28, 33, M); line(g, 28, 29, 10, 33, M);
    return RG(22, 23, 3, 22, 27, 3, 20, 5); };
  X.x_stroller = g => { line(g, 30, 6, 22, 30, M, 2); rect(g, 28, 4, 5, 2, K); poly(g, [[10, 10], [22, 8], [24, 18], [12, 20]], A); rrect(g, 11, 17, 14, 9, 3, B); line(g, 11, 25, 7, 32, M); for (const x of [8, 22]) C.wheel(g, x, 33, 3.5); return RG(18, 20, 2, 18, 23, 2, 16, 6); };
  X.x_shopping_trolley = g => { poly(g, [[4, 10], [34, 10], [30, 26], [9, 26]], M); for (let x = 7; x < 33; x += 3) line(g, x, 11, x - (x - 20) * 0.1, 25, MD); for (let y = 13; y < 26; y += 3) line(g, 5, y, 33, y, MD); line(g, 34, 10, 38, 6, M, 2); rect(g, 9, 26, 22, 2, M); for (const x of [11, 28]) C.wheel(g, x, 33, 3);
    rect(g, 34, 5, 4, 2, A); return RG(19, 15, 4, 19, 21, 4, 19, 6); };
  X.x_luggage_cart = g => { line(g, 30, 3, 30, 32, M, 2); rect(g, 27, 3, 7, 2, K); rect(g, 8, 32, 24, 2, M); rrect(g, 9, 13, 18, 19, 2, B); rect(g, 15, 10, 6, 3, BD); line(g, 9, 22, 27, 22, BD); for (const x of [10, 28]) C.wheel(g, x, 35, 2.5); return RG(18, 17, 3, 18, 27, 3, 18, 7); };
  X.x_pallet_jack = g => { rect(g, 3, 28, 26, 3, M); line(g, 29, 31, 33, 10, MD, 2); rect(g, 31, 7, 6, 3, K); rrect(g, 24, 18, 10, 12, 2, B); for (const x of [6, 26]) C.wheel(g, x, 33, 2.5); return RG(29, 22, 2, 29, 26, 2, 29, 12); };
  X.x_quad_bike = g => { poly(g, [[5, 23], [10, 17], [20, 17], [24, 13], [30, 13], [36, 18], [36, 23]], B); rect(g, 10, 13, 6, 4, BD); line(g, 12, 13, 9, 9, M, 2); rect(g, 7, 8, 5, 2, K); for (const x of [10, 30]) { C.wheel(g, x, 29, 6); paintOn(g, (xx, y) => ((xx + y) % 2 ? K : null), [MD]); } return RG(24, 18, 2, 24, 21, 3, 26, 8); };
  X.x_segway = g => { line(g, 20, 6, 20, 30, M, 2); rect(g, 14, 5, 13, 2, K); rect(g, 10, 30, 20, 3, B); C.wheel(g, 9, 33, 4); C.wheel(g, 31, 33, 4); rrect(g, 16, 11, 8, 8, 2, B); return RG(20, 14, 2, 20, 17, 2, 20, 3); };
  X.x_roller_skate = g => shoe(g, { y: 24, shaft: 10, sx: 20, sw: 13, feat: (g, y) => { rect(g, 5, y + 6, 29, 2, MD); for (const x of [9, 29]) { C.wheel(g, x - 2, y + 10, 2.5); C.wheel(g, x + 3, y + 10, 2.5); } rect(g, 2, y + 3, 3, 3, TO); } });
  X.x_jet_ski = g => { poly(g, [[2, 25], [10, 18], [36, 19], [38, 26], [30, 30], [6, 30]], B); rect(g, 19, 14, 9, 5, A); line(g, 15, 18, 13, 11, K, 2); rect(g, 10, 10, 6, 2, K); for (let x = 4; x < 36; x += 4) gset(g, x, 33, SL); line(g, 2, 32, 38, 32, S); return RG(26, 23, 3, 26, 27, 3, 24, 10); };
  /* boats: hull + superstructure, water line */
  function boat(g, o) { const y = o.y || 26; poly(g, [[o.bow || 2, y - 4], [38, y - 4], [o.stern || 34, y + 5], [7, y + 5]], B); line(g, 3, y - 4, 37, y - 4, BL); for (let x = 2; x < 39; x += 3) gset(g, x, y + 8, S); line(g, 1, y + 7, 39, y + 7, SL);
    if (o.feat) o.feat(g, y); return RG(o.ex || 20, o.ey || y - 1, 3, o.mx || 20, o.my || y + 2, 4, 20, 6); }
  X.x_rowboat = g => boat(g, { y: 26, feat: (g, y) => { line(g, 8, y - 10, 30, y + 6, BD, 2); C.slats(g, 7, y - 4, 26, 3, 3); } });
  X.i_lifeboat = g => boat(g, { feat: (g, y) => { rrect(g, 9, y - 11, 22, 7, 3, W); for (let x = 11; x < 30; x += 4) rect(g, x, y - 9, 2, 2, S); ell(g, 34, y - 1, 2.5, 2.5, TO); ell(g, 34, y - 1, 1, 1, E); } });
  X.i_gondola = g => { poly(g, [[2, 16], [6, 26], [34, 26], [38, 14], [34, 22], [8, 22]], B); line(g, 2, 16, 2, 10, M); rect(g, 1, 10, 3, 2, M); rect(g, 15, 18, 9, 4, A); line(g, 30, 22, 36, 4, BD); line(g, 1, 29, 39, 29, SL); return RG(20, 23, 3, 20, 25, 3, 20, 14); };
  X.x_fishing_boat = g => boat(g, { feat: (g, y) => { rect(g, 22, y - 13, 10, 9, W); rect(g, 24, y - 11, 6, 3, S); line(g, 12, y - 4, 12, y - 22, MD, 2); line(g, 12, y - 20, 4, y - 6, MD); line(g, 4, y - 6, 4, y - 2, PA); } });
  X.x_yacht = g => boat(g, { bow: 1, feat: (g, y) => { poly(g, [[9, y - 4], [13, y - 10], [32, y - 10], [34, y - 4]], W); poly(g, [[15, y - 10], [18, y - 15], [28, y - 15], [29, y - 10]], W); rect(g, 15, y - 8, 15, 2, S); rect(g, 19, y - 14, 8, 2, S); } });
  X.x_houseboat = g => boat(g, { feat: (g, y) => { rect(g, 9, y - 15, 22, 11, PA); tri(g, [7, y - 15], [20, y - 21], [33, y - 15], A); rect(g, 12, y - 12, 5, 4, S); rect(g, 23, y - 12, 5, 4, S); rect(g, 18, y - 11, 4, 7, BD); } });
  X.x_inflatable_boat = g => { rrect(g, 2, 17, 36, 12, 6, B); rrect(g, 6, 19, 28, 6, 3, BD); rect(g, 33, 13, 4, 8, K); line(g, 1, 32, 39, 32, SL); dots(g, [[8, 28], [20, 28], [32, 28]], W); return RG(16, 21, 3, 16, 24, 3, 18, 12); };
  X.x_hovercraft = g => { rrect(g, 2, 24, 36, 8, 4, K); rrect(g, 5, 15, 26, 10, 3, B); for (let x = 8; x < 28; x += 5) rect(g, x, 17, 3, 3, S); ell(g, 33, 15, 5, 7, M); ell(g, 33, 15, 3, 5, MD); line(g, 30, 8, 30, 22, K); return RG(16, 19, 3, 16, 23, 3, 18, 10); };
  X.x_submarine_toy = g => { rrect(g, 3, 16, 32, 14, 7, B); rrect(g, 16, 9, 9, 8, 2, B); line(g, 20, 9, 20, 3, MD); line(g, 20, 3, 24, 3, MD); for (const x of [10, 17, 24]) { ell(g, x, 23, 2.2, 2.2, M); ell(g, x, 23, 1.3, 1.3, S); } poly(g, [[35, 23], [39, 17], [39, 29]], A);
    return RG(15, 20, 3, 15, 26, 3, 20, 2); };
  X.x_glider = g => { line(g, 1, 17, 39, 17, B, 2); rrect(g, 10, 19, 22, 5, 2, B); ell(g, 13, 20, 3, 2, S); line(g, 30, 20, 37, 14, B, 2); line(g, 33, 14, 38, 14, B); return RG(22, 20, 3, 22, 23, 2, 22, 13); };
  X.x_jet_fighter_toy = g => { poly(g, [[2, 21], [10, 18], [36, 18], [38, 22], [10, 24]], B); poly(g, [[15, 20], [26, 20], [16, 33]], BD); poly(g, [[15, 20], [26, 20], [18, 10]], BD); poly(g, [[31, 19], [37, 19], [38, 11]], B); ell(g, 10, 19, 4, 2, S); return RG(24, 21, 3, 24, 23, 2, 24, 14); };
  X.x_space_rocket_toy = g => { rrect(g, 14, 9, 12, 24, 4, B); tri(g, [14, 11], [20, 1], [26, 11], A); for (const d of [-1, 1]) poly(g, [[20 + d * 6, 24], [20 + d * 11, 34], [20 + d * 6, 32]], A); ell(g, 20, 17, 3, 3, S); ell(g, 20, 36, 3, 2, G); return RG(20, 22, 3, 20, 28, 2, 20, 0); };
  X.x_hot_air_balloon = g => { ell(g, 20, 15, 14, 14, B); paintOn(g, (x) => (Math.floor((x - 6) / 4) % 2 ? A : null), [B]); poly(g, [[10, 24], [30, 24], [24, 30], [16, 30]], B); for (const x of [16, 24]) line(g, x, 30, x, 33, PA); rect(g, 15, 33, 10, 5, BD); C.slats(g, 15, 33, 10, 5, 4, AD);
    return RG(20, 14, 4, 20, 21, 4, 20, 1); };
  X.x_cable_car = g => { line(g, 1, 4, 39, 2, K); line(g, 20, 3, 20, 10, MD, 2); rect(g, 15, 2, 10, 3, MD); rrect(g, 8, 10, 24, 22, 3, B); rect(g, 10, 13, 9, 8, S); rect(g, 21, 13, 9, 8, S); rect(g, 8, 26, 24, 2, A); return RG(20, 17, 4, 20, 24, 3, 20, 6); };
  X.x_scissor_lift = g => { rect(g, 5, 30, 30, 4, B); for (const x of [9, 31]) C.wheel(g, x, 35, 2.5); for (let i = 0; i < 3; i++) { line(g, 9, 30 - i * 7, 31, 23 - i * 7, MD, 2); line(g, 31, 30 - i * 7, 9, 23 - i * 7, MD, 2); } rect(g, 5, 7, 30, 3, B); for (let x = 5; x < 36; x += 4) rect(g, x, 3, 1, 4, M); rect(g, 5, 3, 31, 1, M);
    return RG(20, 26, 3, 20, 33, 3, 20, 2); };
  X.i_gas_pump = g => { rrect(g, 9, 6, 18, 30, 2, B); rect(g, 12, 9, 12, 7, S); for (const x of [13, 17, 21]) rect(g, x, 11, 2, 3, G); rect(g, 7, 35, 22, 3, MD); rect(g, 27, 14, 5, 5, K); line(g, 31, 19, 34, 30, K, 2); line(g, 34, 30, 29, 34, K); return RG(18, 21, 3, 18, 28, 3, 18, 2); };
  X.i_disk_brake = g => { ell(g, 20, 20, 16, 16, M); ell(g, 20, 20, 5, 5, MD); for (let i = 0; i < 5; i++) ell(g, 20 + Math.cos(i * 1.257) * 9, 20 + Math.sin(i * 1.257) * 9, 1.4, 1.4, MD); poly(g, [[25, 4], [34, 8], [37, 17], [31, 18], [29, 11]], B); return RG(20, 13, 4, 20, 28, 4, 20, 5); };
  X.i_grille = g => { rrect(g, 3, 9, 34, 22, 5, M); rrect(g, 6, 12, 28, 16, 3, K); for (let x = 9; x < 33; x += 3) rect(g, x, 12, 1, 16, MD); ell(g, 20, 20, 4, 3, GO); return RG(20, 17, 6, 20, 25, 4, 20, 5); };
  X.i_seat_belt = g => { line(g, 30, 3, 10, 30, K, 4); rect(g, 6, 28, 12, 8, M); rect(g, 9, 30, 6, 4, TO); line(g, 2, 33, 6, 33, K, 4); return RG(22, 14, 2, 22, 18, 2, 22, 8); };
  /* --- bags and boxes --- */
  const box3 = (g, x, y, w, h, d, c = B) => { rect(g, x, y, w, h, c); poly(g, [[x, y], [x + d, y - d], [x + w + d, y - d], [x + w, y]], BL); poly(g, [[x + w, y], [x + w + d, y - d], [x + w + d, y + h - d], [x + w, y + h]], BD); };
  X.x_cereal_box = g => { box3(g, 9, 6, 18, 30, 4); ell(g, 18, 25, 7, 5, PA); dots(g, [[14, 23], [17, 22], [20, 24], [22, 22]], GO); rect(g, 11, 9, 14, 5, A); return RG(18, 15, 3, 18, 19, 3, 20, 1); };
  X.x_tissue_box = g => { box3(g, 6, 18, 26, 17, 4); ell(g, 21, 16, 5, 1.5, K); poly(g, [[17, 15], [21, 4], [26, 8], [24, 15]], W); paintOn(g, (x, y) => ((x + y) % 5 === 0 ? BL : null), [B]); return RG(19, 25, 4, 19, 30, 3, 19, 13); };
  X.x_shoebox = g => { box3(g, 4, 19, 30, 16, 4); rect(g, 3, 17, 32, 4, BD); rect(g, 14, 25, 10, 5, PA); return RG(19, 26, 5, 19, 32, 3, 19, 13); };
  X.x_pizza_box = g => { poly(g, [[3, 24], [20, 16], [37, 24], [20, 32]], B); poly(g, [[3, 24], [20, 32], [20, 36], [3, 28]], BD); poly(g, [[37, 24], [20, 32], [20, 36], [37, 28]], BD); ell(g, 20, 24, 7, 3.5, TO); ell(g, 20, 24, 5, 2.5, GO); return RG(20, 22, 4, 20, 27, 3, 20, 15); };
  X.x_delivery_box = g => { box3(g, 5, 13, 26, 22, 5); rect(g, 15, 13, 6, 22, PA); line(g, 5, 13, 10, 8, PA); rect(g, 23, 26, 6, 5, W); return RG(18, 21, 4, 18, 28, 3, 18, 7); };
  X.x_gift_box = g => { box3(g, 6, 14, 24, 21, 4, B); rect(g, 16, 14, 4, 21, A); poly(g, [[6, 14], [10, 10], [34, 10], [30, 14]], BL); line(g, 18, 10, 22, 10, A); ell(g, 15, 7, 4, 3, A); ell(g, 25, 7, 4, 3, A); return RG(18, 21, 5, 18, 28, 3, 20, 2); };
  X.x_cigar_box = g => { box3(g, 4, 18, 30, 16, 3); rect(g, 13, 22, 12, 6, GO); rect(g, 4, 18, 30, 2, BD); return RG(19, 24, 6, 19, 31, 3, 19, 13); };
  X.x_matchbox = g => { box3(g, 7, 14, 24, 18, 4); rect(g, 7, 14, 4, 18, K); rect(g, 13, 17, 15, 10, PA); ell(g, 20, 22, 3, 3, TO); return RG(20, 18, 3, 20, 26, 3, 20, 8); };
  X.x_jewelry_box = g => { rect(g, 6, 22, 28, 13, B); poly(g, [[6, 22], [10, 8], [30, 8], [34, 22]], BD); rect(g, 8, 21, 24, 3, A); for (let i = 0; i < 5; i++) ell(g, 11 + i * 4.5, 20, 1.8, 1.8, i % 2 ? GO : W); ell(g, 20, 28, 2, 2, GO); return RG(20, 27, 5, 20, 32, 3, 20, 4); };
  X.x_sewing_box = g => { rect(g, 6, 18, 28, 17, B); rect(g, 6, 15, 28, 4, BD); line(g, 12, 15, 20, 7, M, 2); line(g, 28, 15, 20, 7, M, 2); ell(g, 13, 13, 3, 2, A); ell(g, 27, 13, 3, 2, S); line(g, 31, 9, 36, 3, M); return RG(20, 24, 5, 20, 30, 3, 20, 5); };
  X.x_ballot_box = g => { box3(g, 7, 15, 24, 21, 4); rect(g, 13, 11, 14, 2, K); rect(g, 15, 4, 10, 9, W); for (let y = 6; y < 11; y += 2) line(g, 17, y, 23, y, PA); tri(g, [22, 7], [23, 9], [25, 6], TO); rect(g, 12, 22, 14, 5, W); return RG(18, 21, 4, 18, 30, 3, 20, 2); };
  X.x_donation_box = g => { box3(g, 7, 13, 24, 23, 4); rect(g, 13, 10, 14, 2, K); ell(g, 19, 24, 3, 2.5, TO); ell(g, 21, 24, 3, 2.5, TO); tri(g, [16, 25], [24, 25], [20, 30], TO); ell(g, 20, 6, 3, 3, GO); return RG(19, 18, 4, 19, 31, 3, 20, 4); };
  X.x_egg_carton = g => { poly(g, [[3, 22], [37, 22], [35, 34], [5, 34]], B); for (let i = 0; i < 4; i++) for (let r = 0; r < 2; r++) ell(g, 8 + i * 8, 18 + r * 2, 3.5, 4, W); for (let i = 0; i < 5; i++) gset(g, 6 + i * 7, 33, BD); return RG(20, 26, 5, 20, 31, 3, 20, 11); };
  X.x_tupperware = g => { rrect(g, 5, 18, 30, 17, 3, SL); rect(g, 4, 14, 32, 5, B); rect(g, 8, 12, 24, 2, B); rect(g, 7, 24, 26, 10, A); paintOn(g, (x, y) => ((x + y) % 4 === 0 ? AL : null), [A]); return RG(20, 23, 5, 20, 29, 3, 20, 8); };
  X.i_packet = g => { poly(g, [[8, 6], [32, 6], [33, 35], [7, 35]], B); for (let x = 8; x < 33; x += 2) gset(g, x, 5, B); rect(g, 7, 6, 26, 3, BD); ell(g, 20, 22, 7, 5, PA); return RG(20, 17, 4, 20, 25, 3, 20, 1); };
  X.x_paper_bag = g => { poly(g, [[8, 10], [32, 10], [33, 36], [7, 36]], B); for (let x = 8; x < 33; x += 2) gset(g, x, 9, B); line(g, 9, 12, 31, 12, BD); line(g, 12, 13, 10, 35, BD); return RG(20, 20, 4, 20, 27, 3, 20, 5); };
  X.x_gift_bag = g => { poly(g, [[8, 14], [32, 14], [33, 36], [7, 36]], B); for (const x of [14, 26]) { ell(g, x, 12, 3, 5, A); ell(g, x, 12, 1.6, 3.6, E); } poly(g, [[16, 14], [20, 6], [24, 14]], W); poly(g, [[20, 14], [26, 4], [27, 12]], S); ell(g, 20, 24, 3, 3, GO); return RG(20, 20, 4, 20, 30, 3, 20, 4); };
  X.x_clutch_bag = g => { rrect(g, 4, 14, 32, 16, 3, B); poly(g, [[4, 15], [36, 15], [20, 25]], BD); ell(g, 20, 24, 2, 2, GO); return RG(20, 19, 6, 20, 28, 4, 20, 9); };
  X.x_coin_purse = g => { ell(g, 20, 24, 14, 11, B); rect(g, 8, 13, 24, 4, E); line(g, 9, 16, 31, 16, GO, 2); ell(g, 15, 13, 2.5, 2.5, GO); ell(g, 25, 13, 2.5, 2.5, GO); return RG(20, 23, 4, 20, 29, 3, 20, 9); };
  X.x_fanny_pack = g => { line(g, 1, 18, 39, 18, K, 2); rrect(g, 8, 13, 24, 15, 6, B); line(g, 10, 18, 30, 18, MD); rect(g, 29, 17, 2, 3, M); return RG(20, 22, 4, 20, 26, 3, 20, 8); };
  const duffel = (o) => (g) => { rrect(g, 3, 15, 34, 18, 8, B); for (const x of [13, 27]) { line(g, x, 16, x - 2, 7, A, 2); } line(g, 11, 7, 25, 7, A, 2); line(g, 6, 17, 34, 17, MD); if (o.feat) o.feat(g); return RG(20, 23, 5, 20, 29, 4, 20, 5); };
  X.x_duffel_bag = duffel({ feat: g => { ell(g, 6, 24, 2, 5, BD); ell(g, 34, 24, 2, 5, BD); } });
  X.x_gym_bag = duffel({ feat: g => { rect(g, 15, 25, 10, 5, W); line(g, 16, 27, 24, 27, A); } });
  X.x_diaper_bag = g => { rrect(g, 7, 13, 26, 23, 4, B); ell(g, 20, 12, 8, 6, A); ell(g, 20, 12, 6, 4, E); rect(g, 10, 26, 20, 7, BL); ell(g, 20, 29, 2, 2, PA); return RG(20, 19, 4, 20, 24, 3, 20, 6); };
  X.x_laptop_bag = g => { rrect(g, 4, 13, 32, 22, 2, B); rect(g, 4, 13, 32, 9, BD); line(g, 8, 13, 20, 4, K, 2); line(g, 32, 13, 20, 4, K, 2); rect(g, 18, 20, 4, 3, M); return RG(20, 27, 5, 20, 32, 3, 20, 6); };
  X.x_makeup_bag = g => { rrect(g, 6, 16, 28, 18, 6, B); line(g, 8, 17, 32, 17, MD); rect(g, 30, 15, 3, 5, M); paintOn(g, (x, y) => ((x + 2 * y) % 7 === 0 ? AL : null), [B]); rect(g, 12, 9, 3, 8, TO); rect(g, 20, 11, 4, 6, K); return RG(20, 23, 5, 20, 29, 3, 20, 7); };
  /* --- plants and flowers --- */
  const stemLeaf = (g, x, y0, y1) => { line(g, x, y0, x, y1, S, 2); ell(g, x - 3, (y0 + y1) / 2, 3, 1.5, S); ell(g, x + 3, (y0 + y1) / 2 + 3, 3, 1.5, S); };
  const bloom = (g, x, y, r, n, c, mid) => { for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; ell(g, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, r * 0.75, c); } ell(g, x, y, r * 0.55, r * 0.55, mid || GO); };
  X.x_aloe_vera = g => { for (let i = 0; i < 7; i++) { const a = Math.PI * (0.12 + i * 0.127); poly(g, [[20 - 2, 30], [20 + Math.cos(a) * 17, 30 - Math.sin(a) * 22], [20 + 2, 30]], S); } paintOn(g, (x, y) => ((x * 3 + y) % 7 === 0 ? SL : null), [S]); rect(g, 12, 29, 16, 8, B); rect(g, 10, 28, 20, 2, BD); return RG(20, 32, 3, 20, 35, 3, 20, 7); };
  X.x_bamboo = g => { for (const [x, h] of [[12, 3], [20, 1], [28, 6]]) { rect(g, x - 2, h, 4, 36 - h, S); for (let y = h + 6; y < 37; y += 7) rect(g, x - 2, y, 4, 1, K); ell(g, x + 4, h + 8, 3, 1.2, SL); } return RG(20, 18, 4, 20, 25, 3, 20, 2); };
  X.x_cherry_blossom = g => { line(g, 20, 37, 20, 22, BD, 3); line(g, 20, 25, 10, 16, BD, 2); line(g, 20, 24, 31, 14, BD, 2); for (const [x, y] of [[10, 13], [17, 9], [25, 8], [31, 12], [14, 19], [27, 18], [20, 14]]) { ell(g, x, y, 4, 3.5, B); dots(g, [[x, y]], W); } return RG(20, 12, 4, 20, 17, 3, 20, 3); };
  X.x_clover = g => { stemLeaf(g, 20, 22, 37); for (const [x, y] of [[14, 13], [26, 13], [20, 21]]) { ell(g, x - 2, y, 4.5, 4.5, S); ell(g, x + 2, y, 4.5, 4.5, S); } paintOn(g, (x, y) => (Math.hypot(x - 20, y - 15) < 3 ? SL : null), [S]); return RG(20, 14, 5, 20, 19, 3, 20, 7); };
  X.x_fern_frond = g => { for (let i = 0; i < 16; i++) { const y = 36 - i * 2, w = Math.min(i, 16 - i) * 1.1; line(g, 20, y, 20 - w, y - 3, S); line(g, 20, y, 20 + w, y - 3, S); } line(g, 20, 37, 20, 4, BD); return RG(20, 18, 3, 20, 23, 2, 20, 2); };
  X.x_leaf = g => { poly(g, [[4, 34], [8, 18], [22, 7], [36, 4], [32, 20], [18, 32]], S); line(g, 4, 34, 33, 6, BD); for (let i = 0; i < 4; i++) { line(g, 10 + i * 6, 28 - i * 6, 8 + i * 6, 20 - i * 5, BD); line(g, 10 + i * 6, 28 - i * 6, 18 + i * 5, 28 - i * 6, BD); } return RG(20, 18, 3, 20, 23, 2, 22, 5); };
  X.x_maple_leaf = g => { const pts = []; for (let i = 0; i < 11; i++) { const a = -Math.PI / 2 + (i - 5) * 0.55, r = i % 2 ? 7 : 15; pts.push([20 + Math.cos(a) * r, 20 + Math.sin(a) * r]); } poly(g, [[20, 26], ...pts, [20, 26]], B); line(g, 20, 26, 20, 37, BD, 2); line(g, 20, 26, 20, 7, BD); return RG(20, 17, 3, 20, 22, 3, 20, 4); };
  X.x_grass = g => { for (let i = 0; i < 12; i++) { const x = 5 + i * 2.7; tri(g, [x - 1.5, 37], [x + Math.sin(i) * 3, 8 + (i * 7) % 12], [x + 1.5, 37], i % 2 ? S : SL); } return RG(20, 26, 4, 20, 31, 3, 20, 10); };
  X.x_moss = g => { ell(g, 20, 29, 17, 8, S); for (let i = 0; i < 30; i++) ell(g, 5 + (i * 11) % 30, 24 + (i * 7) % 10, 1.6, 1.6, i % 3 ? SL : S); for (const x of [12, 26]) { line(g, x, 22, x, 17, AD); ell(g, x, 16, 1, 1, A); } rect(g, 3, 35, 34, 2, BD); return RG(20, 27, 5, 20, 32, 3, 20, 18); };
  X.x_reed = g => { for (const x of [12, 20, 28]) { line(g, x, 37, x + 1, 9, S, 2); rrect(g, x - 1, 6 + (x % 3), 4, 10, 2, BD); } for (const x of [8, 16, 24, 32]) line(g, x, 37, x - 3, 18, SL); return RG(20, 22, 3, 20, 27, 2, 20, 4); };
  X.x_ivy = g => { for (let i = 0; i < 30; i++) gset(g, 20 + Math.sin(i * 0.4) * 8, 4 + i, BD); for (let i = 0; i < 6; i++) { const x = 20 + Math.sin((i * 5 + 2) * 0.4) * 8 + (i % 2 ? 4 : -4), y = 7 + i * 5; poly(g, [[x, y - 3], [x + 3, y], [x + 2, y + 3], [x - 2, y + 3], [x - 3, y]], S); } return RG(20, 17, 4, 20, 23, 3, 20, 2); };
  X.x_vine = g => { for (let i = 0; i < 34; i++) gset(g, 4 + i, 20 + Math.sin(i * 0.35) * 8, BD), gset(g, 4 + i, 21 + Math.sin(i * 0.35) * 8, BD); for (let i = 0; i < 7; i++) ell(g, 6 + i * 5, 20 + Math.sin((i * 5 + 2) * 0.35) * 8 + (i % 2 ? 4 : -4), 2.5, 1.8, S); for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) ell(g, 24 + k * 2, 26 + i * 2, 1.3, 1.3, A);
    return RG(20, 18, 4, 20, 24, 3, 20, 8); };
  X.x_venus_flytrap = g => { stemLeaf(g, 20, 20, 37); for (const d of [-1, 1]) { poly(g, [[20, 20], [20 + d * 14, 9 - (d + 1) * 1], [20 + d * 10, 18]], S); for (let i = 0; i < 5; i++) gset(g, 20 + d * (6 + i * 2), 12 + i * 1 - (d + 1), W); } ell(g, 20, 17, 4, 3, TO); return RG(20, 12, 3, 20, 18, 3, 20, 3); };
  X.x_lavender = g => { for (const x of [13, 20, 27]) { line(g, x, 37, x + (x - 20) * 0.3, 14, S); for (let y = 4; y < 16; y += 2) { ell(g, x + (x - 20) * 0.3 - 1, y + (x === 20 ? 0 : 3), 1.5, 1.2, B); ell(g, x + (x - 20) * 0.3 + 1, y + 1 + (x === 20 ? 0 : 3), 1.5, 1.2, B); } } return RG(20, 24, 3, 20, 29, 2, 20, 2); };
  X.x_iris = g => { stemLeaf(g, 20, 20, 37); for (const d of [-1, 1]) ell(g, 20 + d * 6, 18, 5, 3, B); ell(g, 20, 9, 4, 7, B); ell(g, 14, 13, 3, 5, BL); ell(g, 26, 13, 3, 5, BL); line(g, 20, 14, 20, 20, GO); return RG(20, 10, 2, 20, 16, 2, 20, 2); };
  X.x_lily_flower = g => { stemLeaf(g, 20, 22, 37); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; poly(g, [[20, 15], [20 + Math.cos(a - 0.3) * 6, 15 + Math.sin(a - 0.3) * 6], [20 + Math.cos(a) * 14, 15 + Math.sin(a) * 13], [20 + Math.cos(a + 0.3) * 6, 15 + Math.sin(a + 0.3) * 6]], B); } for (let i = 0; i < 4; i++) gset(g, 18 + i, 11, GO); return RG(20, 15, 3, 20, 19, 2, 20, 2); };
  X.x_lotus = g => { ell(g, 20, 31, 17, 5, S); for (const [d, h] of [[-10, 8], [10, 8], [-5, 13], [5, 13], [0, 17]]) poly(g, [[20 + d - 4, 29], [20 + d, 29 - h], [20 + d + 4, 29]], B); paintOn(g, (x, y) => (y < 18 ? BL : null), [B]); return RG(20, 23, 3, 20, 27, 2, 20, 10); };
  X.x_magnolia = g => { line(g, 20, 37, 20, 22, BD, 2); for (const [d, h] of [[-7, 11], [7, 11], [-3, 16], [3, 16]]) poly(g, [[20 + d - 4, 25], [20 + d * 1.3, 25 - h], [20 + d + 4, 25]], B); ell(g, 20, 24, 8, 3, BL); ell(g, 10, 30, 4, 2, S); return RG(20, 17, 3, 20, 22, 2, 20, 6); };
  X.x_orchid_plant = g => { rect(g, 13, 29, 14, 8, PA); line(g, 18, 29, 22, 6, S, 1); line(g, 22, 6, 30, 8, S); for (const [x, y] of [[23, 9], [29, 13], [22, 18]]) { bloom(g, x, y, 2.6, 5, B, A); } ell(g, 13, 27, 6, 2, S); ell(g, 27, 27, 5, 2, S); return RG(20, 32, 3, 20, 35, 2, 22, 3); };
  X.x_peony = g => { stemLeaf(g, 20, 22, 37); ell(g, 20, 14, 12, 10, B); for (let r = 9; r > 2; r -= 3) { ell(g, 20, 14, r, r * 0.8, BL); ell(g, 20, 14, r - 1.5, (r - 1.5) * 0.8, B); } return RG(20, 12, 4, 20, 17, 3, 20, 3); };
  X.x_jasmine = g => { line(g, 20, 37, 20, 20, S, 2); for (const [x, y] of [[12, 12], [20, 8], [28, 13], [16, 20], [26, 21]]) bloom(g, x, y, 2.4, 5, W, GO); ell(g, 13, 27, 3, 1.5, S); ell(g, 27, 29, 3, 1.5, S); return RG(20, 14, 3, 20, 18, 2, 20, 3); };
  X.x_flower_bouquet = g => { poly(g, [[12, 22], [28, 22], [22, 37], [18, 37]], PA); line(g, 13, 26, 27, 26, A, 2); for (const [x, y, c] of [[13, 15, B], [20, 10, A], [27, 15, S], [17, 20, GO], [24, 20, B], [20, 15, TO]]) bloom(g, x, y, 2.6, 5, c, W); return RG(20, 29, 2, 20, 33, 2, 20, 4); };
  X.x_wreath = g => { ell(g, 20, 20, 16, 16, S); ell(g, 20, 20, 9, 9, E); paintOn(g, (x, y) => ((x * 3 + y * 5) % 7 === 0 ? SL : null), [S]); for (let i = 0; i < 8; i++) ell(g, 20 + Math.cos(i * 0.785) * 12.5, 20 + Math.sin(i * 0.785) * 12.5, 1.5, 1.5, TO); poly(g, [[16, 32], [24, 32], [27, 38], [20, 34], [13, 38]], TO); return RG(20, 6, 3, 20, 33, 2, 20, 2); };
  X.x_pine_cone = g => { for (let r = 0; r < 8; r++) for (let c = 0; c < 4 - Math.abs(r - 4) * 0.3; c++) { const w = 12 - Math.abs(r - 3) * 2.2; ell(g, 20 - w / 2 + c * w / 3, 9 + r * 3.5, 3.4, 2.4, (r + c) % 2 ? B : BD); } line(g, 20, 1, 20, 6, BD, 2); return RG(20, 18, 3, 20, 25, 3, 20, 3); };
  /* --- bottles --- */
  function bottle(g, o) { const w = o.w || 14, x0 = 20 - w / 2, top = o.top || 12, bot = o.bot || 36;
    rrect(g, x0, top, w, bot - top, o.r == null ? 3 : o.r, B); if (o.neck) rect(g, 20 - o.neck / 2, top - (o.nh || 5), o.neck, o.nh || 5, B);
    if (o.label) rect(g, x0 + 1, o.label[0], w - 2, o.label[1], PA); if (o.feat) o.feat(g, { x0, w, top, bot }); return RG(20, Math.round((top + bot) / 2) - 2, Math.max(2, Math.floor(w / 5)), 20, Math.round((top + bot) / 2) + 3, 3, 20, top - 6); }
  const sprayHead = (g, x, y) => { rect(g, x - 3, y - 4, 7, 4, A); poly(g, [[x - 3, y - 4], [x - 9, y - 4], [x - 9, y - 2], [x - 3, y - 1]], A); line(g, x - 2, y, x - 4, y + 5, A, 2); dots(g, [[x - 12, y - 5], [x - 13, y - 2], [x - 11, y - 1]], SL); };
  X.x_cleaning_spray = X.x_glass_cleaner = g => bottle(g, { w: 14, top: 14, neck: 4, nh: 4, label: [20, 8], feat: (g) => sprayHead(g, 21, 10) });
  X.x_air_freshener = g => bottle(g, { w: 12, top: 12, r: 6, label: [20, 9], feat: g => { rect(g, 16, 7, 8, 5, A); rect(g, 17, 5, 3, 2, K); dots(g, [[12, 5], [10, 3], [13, 2], [8, 6]], ST); } });
  X.x_spray_can = X.x_paint_spray_can = g => bottle(g, { w: 14, top: 11, r: 2, label: [17, 12], feat: g => { ell(g, 20, 11, 7, 2, M); rect(g, 17, 6, 6, 4, A); rect(g, 18, 4, 2, 2, K); dots(g, [[14, 3], [12, 1], [11, 5]], A); } });
  X.x_dish_soap = g => bottle(g, { w: 12, top: 11, r: 4, label: [19, 10], feat: g => { rect(g, 18, 5, 4, 6, A); rect(g, 19, 2, 2, 3, A); ell(g, 20, 24, 3, 3, SL); } });
  X.x_hand_soap = g => bottle(g, { w: 16, top: 16, r: 5, label: [22, 9], feat: g => { rect(g, 18, 9, 4, 7, A); rect(g, 12, 8, 10, 3, A); ell(g, 12, 13, 1.5, 1.5, W); } });
  X.x_conditioner = g => bottle(g, { w: 14, top: 6, bot: 31, r: 5, label: [12, 12], feat: g => { rrect(g, 12, 30, 16, 7, 2, A); } });
  X.x_medicine_bottle = X.i_pill_bottle = X.x_vitamin_bottle = g => bottle(g, { w: 16, top: 14, r: 2, label: [19, 11], feat: g => { rect(g, 11, 8, 18, 6, W); for (let x = 12; x < 29; x += 2) gset(g, x, 9, PA); redCross(g); } });
  function redCross(g) { rect(g, 19, 21, 2, 6, TO); rect(g, 17, 23, 6, 2, TO); }
  X.x_ink_bottle = g => bottle(g, { w: 18, top: 18, r: 3, neck: 8, nh: 5, label: [24, 7], feat: g => { rect(g, 15, 10, 10, 3, K); ell(g, 20, 21, 7, 1.5, K); } });
  X.x_milk_bottle = g => bottle(g, { w: 14, top: 14, r: 4, neck: 8, nh: 7, feat: g => { rect(g, 15, 6, 10, 2, A); rect(g, 13, 20, 14, 15, W); } });
  X.x_wine_glass_bottle = g => bottle(g, { w: 12, top: 16, r: 3, neck: 4, nh: 12, label: [23, 8], feat: g => { rect(g, 18, 2, 4, 3, TO); } });
  X.x_decanter = g => { ell(g, 20, 26, 13, 10, SL); rect(g, 17, 9, 6, 9, SL); ell(g, 20, 7, 3, 3, SL); ell(g, 20, 28, 11, 7, B, [SL]); return RG(20, 22, 4, 20, 30, 3, 20, 3); };
  X.i_nipple = g => { ell(g, 20, 13, 5, 7, PA); rect(g, 12, 18, 16, 5, A); rrect(g, 13, 22, 14, 15, 3, W); rect(g, 14, 27, 12, 9, B); return RG(20, 12, 2, 20, 16, 2, 20, 4); };
  X.x_sippy_cup = g => { rrect(g, 11, 15, 18, 22, 4, B); rect(g, 10, 12, 20, 4, A); poly(g, [[16, 12], [17, 6], [23, 6], [24, 12]], A); for (const d of [-1, 1]) rrect(g, 20 + d * 11 - 2, 19, 5, 8, 2, A); return RG(20, 22, 4, 20, 29, 3, 20, 4); };
  X.x_cork = g => { poly(g, [[12, 8], [28, 8], [26, 34], [14, 34]], B); ell(g, 20, 8, 8, 2.5, BL); paintOn(g, (x, y) => ((x * 7 + y * 3) % 6 === 0 ? BD : null), [B]); return RG(20, 18, 3, 20, 25, 3, 20, 4); };
  X.x_gas_can = X.x_jerry_can = g => { rrect(g, 7, 9, 26, 28, 3, B); rect(g, 11, 4, 12, 5, B); rect(g, 13, 5, 8, 2, E); rect(g, 26, 3, 5, 7, M); line(g, 9, 14, 31, 33, BD); line(g, 31, 14, 9, 33, BD); return RG(20, 21, 4, 20, 28, 3, 20, 2); };
  X.x_gas_cylinder = X.x_propane_tank = g => { rrect(g, 9, 9, 22, 28, 9, B); rect(g, 15, 4, 10, 6, M); ell(g, 20, 4, 5, 2, MD); rect(g, 9, 26, 22, 2, BD); rect(g, 11, 15, 18, 5, PA); return RG(20, 22, 4, 20, 31, 3, 20, 1); };
  /* --- meals and snacks --- */
  const plate = (g, y = 30) => { ell(g, 20, y, 17, 5, W); ell(g, 20, y - 1, 13, 3, PA); };
  X.x_fish_and_chips = g => { poly(g, [[4, 26], [9, 14], [32, 14], [36, 26]], PA); for (let i = 0; i < 6; i++) rect(g, 7 + i * 3, 9 + (i % 2) * 2, 2, 10, GO); ell(g, 24, 17, 9, 5, A); tri(g, [31, 17], [37, 12], [37, 22], A); paintOn(g, (x, y) => ((x + y) % 3 === 0 ? AD : null), [A]); line(g, 4, 26, 36, 26, BD);
    return RG(20, 21, 4, 20, 24, 3, 20, 6); };
  X.x_lasagna = g => { for (let i = 0; i < 5; i++) rect(g, 6, 15 + i * 4, 28, 3, i % 2 ? TO : GO); rect(g, 6, 13, 28, 3, PA); dots(g, [[10, 13], [17, 12], [25, 13], [31, 12]], AD); rect(g, 4, 34, 32, 3, B); return RG(20, 20, 5, 20, 26, 3, 20, 7); };
  X.x_meatball = g => { plate(g); for (const [x, y] of [[13, 24], [26, 24], [20, 19]]) { ell(g, x, y, 6, 5.5, B); paintOn(g, (xx, yy) => ((xx * 3 + yy) % 5 === 0 ? BD : null), [B]); } ell(g, 20, 27, 10, 2, TO); return RG(20, 18, 2, 20, 22, 2, 20, 11); };
  X.x_rice = g => { ell(g, 20, 28, 15, 8, B); rect(g, 4, 20, 32, 6, E); ell(g, 20, 21, 14, 8, W); for (let i = 0; i < 18; i++) gset(g, 9 + (i * 7) % 22, 15 + (i * 5) % 9, PA); ell(g, 20, 21, 14, 3, W, [B]); line(g, 30, 4, 22, 18, BD); line(g, 33, 6, 24, 18, BD); return RG(20, 26, 4, 20, 31, 3, 20, 10); };
  X.x_coleslaw = g => { ell(g, 20, 28, 15, 8, B); rect(g, 4, 20, 32, 6, E); ell(g, 20, 21, 13, 6, PA); for (let i = 0; i < 14; i++) line(g, 10 + (i * 5) % 20, 17 + (i * 3) % 7, 13 + (i * 5) % 20, 18 + (i * 3) % 7, i % 3 ? S : GO); return RG(20, 27, 4, 20, 32, 3, 20, 12); };
  X.x_scrambled_eggs = g => { plate(g); for (let i = 0; i < 9; i++) ell(g, 11 + (i * 7) % 19, 22 + (i * 3) % 6, 4, 3, GO); paintOn(g, (x, y) => ((x + y) % 5 === 0 ? W : null), [GO]); dots(g, [[14, 22], [24, 24]], S); return RG(20, 23, 4, 20, 27, 3, 20, 15); };
  X.x_panini = g => { poly(g, [[3, 22], [10, 12], [36, 15], [31, 26]], B); for (let i = 0; i < 6; i++) line(g, 8 + i * 4, 15, 14 + i * 4, 25, BD, 2); poly(g, [[3, 22], [31, 26], [31, 29], [3, 25]], GO); line(g, 4, 24, 30, 28, S); return RG(19, 18, 4, 19, 22, 3, 20, 8); };
  X.x_sandwich_roll = g => { ell(g, 20, 17, 16, 7, B); rect(g, 4, 19, 32, 4, S); for (let x = 5; x < 36; x += 3) gset(g, x, 23, S); rect(g, 5, 22, 30, 3, TO); rect(g, 5, 25, 30, 2, GO); ell(g, 20, 28, 15, 3, B); for (const x of [12, 20, 28]) line(g, x - 2, 13, x + 2, 11, BL); return RG(20, 15, 4, 20, 19, 3, 20, 7); };
  X.x_shawarma = g => { poly(g, [[12, 37], [9, 12], [31, 12], [28, 37]], W); ell(g, 20, 12, 11, 4, B); for (let i = 0; i < 6; i++) ell(g, 13 + i * 3, 10 + (i % 2), 2, 2, i % 2 ? S : TO); line(g, 10, 26, 30, 26, PA); return RG(20, 20, 4, 20, 30, 3, 20, 4); };
  X.x_soup_can = g => { rrect(g, 10, 6, 20, 30, 2, M); rect(g, 10, 11, 20, 20, TO); rect(g, 10, 20, 20, 11, W); ell(g, 20, 6, 10, 2, MD); ell(g, 20, 25, 4, 2.5, GO); return RG(20, 15, 4, 20, 27, 3, 20, 1); };
  X.x_mustard = X.x_mayonnaise = g => bottle(g, { w: 16, top: 13, r: 5, label: [20, 10], feat: g => { tri(g, [17, 13], [23, 13], [20, 3], A); rect(g, 15, 11, 10, 3, A); } });
  X.x_sugar = g => { poly(g, [[9, 10], [31, 10], [33, 36], [7, 36]], W); for (let x = 9; x < 32; x += 2) gset(g, x, 9, W); rect(g, 8, 18, 25, 10, B); for (const [x, y] of [[14, 6], [19, 4], [25, 6]]) rect(g, x, y, 3, 3, W); return RG(20, 21, 4, 20, 25, 3, 20, 3); };
  X.x_tea_bag = g => { rrect(g, 9, 12, 18, 21, 3, PA); for (let i = 0; i < 9; i++) gset(g, 12 + (i * 5) % 12, 16 + (i * 7) % 14, BD); line(g, 18, 12, 30, 4, W); rect(g, 28, 1, 8, 6, B); return RG(18, 20, 3, 18, 26, 3, 18, 7); };
  X.x_coffee_beans = g => { for (const [x, y, a] of [[13, 15, 0.3], [26, 13, -0.4], [20, 25, 0.1], [11, 28, -0.2], [29, 27, 0.5]]) { ell(g, x, y, 5, 6.5, B); line(g, x - 1, y - 5, x + 1, y + 5, BD); } return RG(20, 24, 3, 20, 29, 2, 20, 6); };
  X.x_cocoa = g => { rrect(g, 10, 12, 20, 24, 3, PA); ell(g, 20, 12, 10, 2.5, B); C.handleRing(g, 31, 22, 5, 5, PA); ell(g, 16, 10, 3, 2, W); ell(g, 22, 9, 3, 2, W); dots(g, [[18, 6], [21, 4], [17, 2]], ST); return RG(20, 21, 4, 20, 28, 3, 20, 3); };
  X.x_wine = g => { ell(g, 20, 13, 10, 9, SL); rect(g, 9, 4, 22, 8, E); ell(g, 20, 15, 8, 6, TO); rect(g, 19, 22, 2, 10, SL); ell(g, 20, 34, 8, 2.5, SL); return RG(20, 14, 4, 20, 19, 2, 20, 2); };
  X.x_caviar = g => { ell(g, 20, 26, 16, 9, M); rect(g, 4, 18, 32, 5, E); ell(g, 20, 20, 14, 5, K); for (let i = 0; i < 26; i++) ell(g, 8 + (i * 5) % 25, 17 + (i * 3) % 7, 1.3, 1.3, (i % 3) ? AD : BD); line(g, 30, 6, 23, 18, GO, 2); return RG(20, 26, 5, 20, 31, 3, 20, 10); };
  /* --- desserts --- */
  X.x_apple_pie = g => { ell(g, 20, 26, 17, 8, B); ell(g, 20, 22, 15, 6, B); for (let i = -2; i <= 2; i++) { line(g, 20 + i * 5 - 5, 17, 20 + i * 5 + 5, 27, BL, 2); } for (let i = 0; i < 12; i++) gset(g, 5 + i * 2.7, 29 + (i % 2), BD); rect(g, 3, 31, 34, 3, M); return RG(20, 22, 5, 20, 27, 3, 20, 13); };
  X.x_pie_slice = g => { poly(g, [[4, 30], [34, 18], [36, 30]], B); poly(g, [[4, 30], [36, 30], [36, 34], [4, 34]], A); rect(g, 30, 16, 7, 18, BL); line(g, 5, 29, 34, 18, BL, 2); return RG(28, 25, 3, 28, 31, 3, 26, 15); };
  X.x_eclair = g => { rrect(g, 3, 18, 34, 12, 6, B); rrect(g, 4, 15, 32, 7, 4, BD); for (let x = 8; x < 34; x += 6) line(g, x, 16, x + 3, 16, BL); line(g, 6, 27, 34, 27, PA); return RG(20, 22, 5, 20, 26, 3, 20, 9); };
  X.x_fudge = g => { for (const [x, y] of [[5, 18], [20, 14], [12, 26]]) { box3(g, x, y, 13, 10, 3); paintOn(g, (xx, yy) => ((xx * 3 + yy) % 7 === 0 ? BD : null), [B]); } return RG(26, 18, 2, 26, 22, 2, 26, 9); };
  X.x_truffle = g => { for (const [x, y] of [[12, 26], [28, 26], [20, 15]]) { ell(g, x, y, 7, 7, B); paintOn(g, (xx, yy) => ((xx * 5 + yy * 3) % 7 === 0 ? BL : null), [B]); } return RG(20, 14, 3, 20, 18, 2, 20, 7); };
  X.x_gingerbread_man = g => { ell(g, 20, 9, 6, 6, B); poly(g, [[12, 16], [28, 16], [37, 21], [35, 24], [27, 22], [30, 36], [24, 37], [20, 28], [16, 37], [10, 36], [13, 22], [5, 24], [3, 21]], B); for (const [x, y] of [[20, 19], [20, 23]]) ell(g, x, y, 1.3, 1.3, TO);
    line(g, 4, 22, 9, 21, W); line(g, 31, 21, 36, 22, W); line(g, 11, 34, 15, 33, W); line(g, 25, 33, 29, 34, W); return AN(20, 8, 2, 20, 11, 2, 20, 2, { rigid: true }); };
  X.x_jello = g => { poly(g, [[9, 9], [31, 9], [35, 33], [5, 33]], B); for (let x = 9; x < 32; x += 4) line(g, x, 9, x - (x - 20) * 0.2, 33, BL); rect(g, 3, 33, 34, 3, W); ell(g, 20, 6, 3, 3, TO); line(g, 20, 3, 22, 1, S); return RG(20, 18, 4, 20, 25, 3, 20, 2); };
  X.x_jelly = g => { rrect(g, 10, 13, 20, 23, 3, SL); rect(g, 11, 16, 18, 19, B); rect(g, 9, 9, 22, 5, A); paintOn(g, (x, y) => ((x + y) % 4 === 0 && y < 13 ? W : null), [A]); rect(g, 13, 22, 14, 7, PA); return RG(20, 19, 4, 20, 26, 3, 20, 4); };
  X.x_lollipop_swirl = g => { ell(g, 20, 14, 12, 12, B); for (let i = 0; i < 60; i++) { const a = i * 0.25, r = i * 0.19; gset(g, 20 + Math.cos(a) * r, 14 + Math.sin(a) * r, W); gset(g, 20 + Math.cos(a) * r + 0.6, 14 + Math.sin(a) * r, W); } rect(g, 19, 26, 2, 12, W); return RG(20, 12, 4, 20, 19, 3, 20, 2); };
  X.x_macaron = g => { ell(g, 20, 14, 14, 6, B); ell(g, 20, 26, 14, 6, B); rect(g, 7, 18, 26, 4, PA); for (let x = 7; x < 33; x += 2) { gset(g, x, 17, BD); gset(g, x, 22, BD); } return RG(20, 12, 4, 20, 26, 3, 20, 6); };
  X.x_marshmallow = g => { for (const [x, y] of [[12, 24], [26, 24], [19, 13]]) { rrect(g, x - 7, y - 6, 14, 12, 4, W); ell(g, x, y - 6, 7, 2, PA); } return RG(19, 13, 3, 19, 17, 2, 19, 5); };
  X.x_mint = g => { ell(g, 20, 20, 15, 15, W); for (let i = 0; i < 6; i++) poly(g, [[20, 20], [20 + Math.cos(i * 1.05) * 15, 20 + Math.sin(i * 1.05) * 15], [20 + Math.cos(i * 1.05 + 0.5) * 15, 20 + Math.sin(i * 1.05 + 0.5) * 15]], B); for (const d of [-1, 1]) tri(g, [20 + d * 15, 20], [20 + d * 20, 15], [20 + d * 20, 25], PA); return RG(20, 17, 4, 20, 25, 3, 20, 4); };
  X.x_muffin_top = g => { ell(g, 20, 17, 16, 10, B); paintOn(g, (x, y) => ((x * 5 + y * 3) % 8 === 0 ? BD : null), [B]); for (const [x, y] of [[13, 13], [22, 11], [28, 16], [17, 19]]) ell(g, x, y, 1.5, 1.5, A); poly(g, [[8, 24], [32, 24], [29, 36], [11, 36]], PA); for (let x = 10; x < 31; x += 3) line(g, x, 25, x + (20 - x) * 0.1, 35, BD); return RG(20, 15, 4, 20, 20, 3, 20, 6); };
  X.x_pudding = g => { poly(g, [[8, 12], [32, 12], [35, 32], [5, 32]], B); ell(g, 20, 12, 12, 4, AD); for (const x of [10, 18, 27]) ell(g, x, 15, 2, 4, AD); rect(g, 3, 32, 34, 3, W); return RG(20, 21, 4, 20, 27, 3, 20, 6); };
  X.x_scone = g => { ell(g, 20, 27, 15, 8, B); ell(g, 20, 20, 14, 8, B); paintOn(g, (x, y) => ((x * 3 + y * 7) % 9 === 0 ? BD : null), [B]); ell(g, 20, 14, 8, 3, W); ell(g, 20, 12, 4, 2, TO); return RG(20, 21, 4, 20, 27, 3, 20, 7); };
  X.x_tiramisu = g => { box3(g, 5, 14, 26, 21, 4, PA); for (const y of [19, 26]) rect(g, 5, y, 26, 3, B); paintOn(g, (x, y) => ((x + y) % 3 === 0 && y < 16 ? B : null), [BL]); return RG(18, 22, 4, 18, 31, 3, 18, 8); };
  /* --- clocks and gauges --- */
  const dial = (g, x, y, r, face = W) => { ell(g, x, y, r + 2, r + 2, B); ell(g, x, y, r, r, face); for (let i = 0; i < 12; i++) gset(g, x + Math.cos(i * 0.524) * (r - 1), y + Math.sin(i * 0.524) * (r - 1), K); };
  X.wall_clock = g => { dial(g, 20, 20, 13); line(g, 20, 20, 20, 11, K); line(g, 20, 20, 27, 20, K); gset(g, 20, 20, TO); return RG(20, 16, 4, 20, 26, 3, 20, 4); };
  X.x_cuckoo_clock = g => { tri(g, [4, 15], [20, 3], [36, 15], BD); rect(g, 8, 14, 24, 20, B); rect(g, 17, 6, 6, 6, K); ell(g, 20, 9, 2, 2, GO); dial(g, 20, 23, 6); for (const x of [14, 26]) { line(g, x, 34, x, 37, GO); rect(g, x - 1, 37, 3, 2, GO); } return RG(20, 21, 3, 20, 26, 2, 20, 2); };
  X.x_grandfather_clock = g => { rect(g, 12, 3, 16, 34, B); tri(g, [11, 4], [20, 0], [29, 4], BD); dial(g, 20, 11, 5); rect(g, 15, 19, 10, 14, BD); line(g, 20, 19, 20, 29, GO); ell(g, 20, 30, 2.5, 2.5, GO); return RG(20, 10, 2, 20, 13, 2, 20, 0); };
  X.x_digital_alarm = g => { rrect(g, 5, 13, 30, 19, 4, B); rect(g, 8, 16, 24, 10, K); for (const x of [10, 15, 22, 27]) { rect(g, x, 18, 3, 1, G); rect(g, x, 21, 3, 1, G); rect(g, x + 2, 18, 1, 6, G); } gset(g, 20, 19, G); gset(g, 20, 22, G); rect(g, 15, 11, 10, 2, A); return RG(20, 20, 6, 20, 29, 3, 20, 7); };
  X.x_egg_timer = X.x_sand_timer_clock = g => { rect(g, 8, 4, 24, 3, BD); rect(g, 8, 33, 24, 3, BD); poly(g, [[11, 7], [29, 7], [21, 20], [29, 33], [11, 33], [19, 20]], SL); tri(g, [14, 10], [26, 10], [20, 18], GO); poly(g, [[13, 33], [27, 33], [20, 26]], GO); line(g, 20, 20, 20, 26, GO); for (const x of [9, 30]) rect(g, x, 7, 2, 26, BD); return RG(20, 12, 3, 20, 29, 3, 20, 2); };
  X.x_kitchen_timer = g => { ell(g, 20, 22, 14, 13, B); ell(g, 20, 17, 13, 7, W); for (let i = 0; i < 9; i++) gset(g, 9 + i * 2.8, 17 - Math.sin(i * 0.39) * 4, K); tri(g, [18, 9], [22, 9], [20, 13], TO); return RG(20, 24, 4, 20, 30, 3, 20, 7); };
  X.x_stopwatch_timer = X.x_stopwatch_sport;
  X.x_pocket_watch_chain = X.x_pocket_watch;
  X.x_metronome_clock = X.x_metronome = g => { poly(g, [[13, 5], [27, 5], [33, 36], [7, 36]], B); poly(g, [[16, 10], [24, 10], [28, 31], [12, 31]], PA); line(g, 20, 30, 25, 9, K); rect(g, 22, 15, 4, 3, M); for (let y = 12; y < 30; y += 3) gset(g, 14 + (y - 12) * 0.1, y, BD); return RG(20, 22, 3, 20, 33, 3, 20, 2); };
  X.i_barometer = g => { ell(g, 20, 22, 14, 14, GO); ell(g, 20, 22, 11, 11, W); for (let i = 0; i < 9; i++) gset(g, 20 - Math.cos(i * 0.39) * 9, 22 - Math.sin(i * 0.39) * 9, K); line(g, 20, 22, 26, 15, K); ell(g, 20, 22, 1.5, 1.5, GO); rect(g, 18, 4, 4, 5, GO); return RG(20, 25, 4, 20, 30, 3, 20, 4); };
  X.i_magnetic_compass = X.x_compass;
  X.i_odometer = g => { rrect(g, 4, 12, 32, 18, 3, K); for (let i = 0; i < 6; i++) { rect(g, 7 + i * 5, 16, 4, 9, i === 5 ? TO : W); rect(g, 8 + i * 5, 18, 2, 5, K); } rect(g, 4, 10, 32, 2, M); return RG(20, 14, 6, 20, 28, 3, 20, 6); };
  X.x_sundial_garden = g => { rect(g, 15, 25, 10, 12, PA); ell(g, 20, 23, 16, 5, M); for (let i = 0; i < 9; i++) gset(g, 20 - Math.cos(i * 0.39) * 13, 23 - Math.sin(i * 0.39) * 3.5, K); tri(g, [16, 23], [24, 23], [24, 12], MD); return RG(20, 30, 3, 20, 34, 2, 20, 10); };
  /* --- instruments --- */
  X.x_bagpipes = g => { ell(g, 22, 25, 12, 9, B); paintOn(g, (x, y) => (((x >> 2) + (y >> 2)) % 2 ? BD : null), [B]); for (const [x, h] of [[17, 22], [24, 25], [31, 20]]) { rect(g, x, 25 - h, 3, h - 6, K); rect(g, x - 1, 25 - h, 5, 2, PA); } line(g, 12, 26, 3, 34, K, 2); line(g, 11, 20, 3, 13, K); return RG(22, 27, 4, 22, 31, 3, 22, 12); };
  X.x_cymbal = g => { ell(g, 20, 14, 17, 5, GO); ell(g, 20, 13, 4, 2, AD); line(g, 20, 16, 20, 36, MD, 2); line(g, 20, 30, 12, 37, MD); line(g, 20, 30, 28, 37, MD); return RG(20, 13, 6, 20, 16, 4, 20, 7); };
  X.x_didgeridoo = g => { for (let i = 0; i < 34; i++) ell(g, 4 + i, 32 - i * 0.75, 2 + i * 0.07, 2 + i * 0.07, B); paintOn(g, (x, y) => ((x + y) % 5 === 0 ? A : (x * 2 + y) % 9 === 0 ? W : null), [B]); return RG(22, 17, 2, 22, 21, 2, 22, 11); };
  X.x_electric_bass = g => { poly(g, [[8, 24], [14, 18], [22, 22], [24, 30], [18, 37], [8, 34], [4, 30]], B); line(g, 18, 24, 37, 4, BD, 3); rect(g, 33, 1, 5, 6, K); for (let i = 0; i < 4; i++) line(g, 10 + i, 30 + i * 0.3, 36, 4 + i, PA); rect(g, 11, 26, 6, 3, K); return RG(13, 29, 2, 13, 33, 2, 14, 21); };
  X.x_keytar = g => { poly(g, [[4, 22], [26, 14], [34, 16], [36, 21], [12, 30]], B); for (let i = 0; i < 9; i++) line(g, 8 + i * 2.4, 23 - i * 0.9, 9 + i * 2.4, 26 - i * 0.9, W); line(g, 30, 17, 38, 9, BD, 2); return RG(28, 19, 2, 28, 22, 2, 28, 12); };
  X.x_lute = g => { ell(g, 15, 25, 11, 10, B); ell(g, 15, 25, 3, 3, BD); line(g, 22, 18, 33, 7, BD, 3); poly(g, [[31, 8], [37, 4], [38, 8], [34, 11]], BD); line(g, 8, 32, 33, 7, PA); return RG(13, 21, 3, 13, 31, 3, 15, 14); };
  X.x_recorder = g => { rect(g, 18, 4, 5, 32, B); rect(g, 17, 2, 7, 4, B); ell(g, 20.5, 36, 3.5, 2, B); for (let y = 14; y < 32; y += 3) ell(g, 20.5, y, 1, 1, K); rect(g, 19, 7, 3, 2, K); return RG(20, 10, 1, 20, 12, 2, 20, 0); };
  X.x_harmonica_instrument = X.x_harmonica_small;
  X.x_guitar_pick = g => { poly(g, [[6, 8], [34, 8], [32, 18], [20, 36], [8, 18]], B); paintOn(g, (x, y) => ((x + y) % 6 === 0 ? BL : null), [B]); return RG(20, 15, 4, 20, 22, 3, 20, 3); };
  X.x_shaker = g => { ell(g, 20, 14, 10, 11, B); rect(g, 18, 24, 4, 13, BD); for (let i = 0; i < 5; i++) line(g, 12 + i * 4, 6, 12 + i * 4, 22, A); dots(g, [[6, 6], [33, 9], [5, 14]], K); return RG(20, 12, 3, 20, 18, 3, 20, 2); };
  X.x_singing_bowl = g => { ell(g, 20, 22, 15, 11, GO); rect(g, 4, 10, 32, 12, E); ell(g, 20, 22, 15, 4, AD); line(g, 30, 8, 38, 2, BD, 2); for (let r = 0; r < 3; r++) gset(g, 4 - r, 14 - r * 2, GO); return RG(20, 26, 4, 20, 30, 3, 20, 17); };
  X.x_triangle = g => { line(g, 20, 4, 6, 32, M, 2); line(g, 6, 32, 34, 32, M, 2); line(g, 20, 4, 31, 26, M, 2); line(g, 20, 4, 20, 1, PA); line(g, 34, 12, 26, 22, MD); return RG(20, 22, 3, 20, 27, 2, 20, 2); };
  X.x_wind_chime = g => { line(g, 20, 1, 20, 6, PA); ell(g, 20, 7, 10, 2, BD); for (let i = 0; i < 5; i++) { line(g, 12 + i * 4, 8, 12 + i * 4, 12, PA); rect(g, 11 + i * 4, 12, 2, 10 + (i % 3) * 5, M); } line(g, 20, 8, 20, 30, PA); ell(g, 20, 32, 3, 2, B); return RG(20, 17, 4, 20, 22, 2, 20, 1); };
  /* --- fire --- */
  const flame = (g, x, y, w, h) => { poly(g, [[x - w, y], [x - w * 0.6, y - h * 0.5], [x - w * 0.2, y - h * 0.3], [x, y - h], [x + w * 0.3, y - h * 0.45], [x + w * 0.7, y - h * 0.7], [x + w, y]], G); poly(g, [[x - w * 0.5, y], [x, y - h * 0.55], [x + w * 0.5, y]], W); };
  X.x_campfire = g => { flame(g, 20, 29, 11, 24); for (const [a, b] of [[[5, 36], [33, 28]], [[7, 28], [35, 36]]]) line(g, a[0], a[1], b[0], b[1], BD, 3); for (let i = 0; i < 8; i++) ell(g, 6 + i * 4, 37, 2.2, 1.6, M); return RG(20, 17, 3, 20, 23, 3, 20, 3); };
  X.x_bonfire = g => { flame(g, 20, 30, 15, 29); for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + i * 0.14); line(g, 20, 37, 20 + Math.cos(a) * 18, 37 - Math.sin(a) * 14, BD, 2); } dots(g, [[8, 6], [30, 4], [26, 9], [12, 10]], G); return RG(20, 18, 4, 20, 25, 3, 20, 1); };
  X.x_fire_pit = g => { flame(g, 20, 22, 10, 17); ell(g, 20, 28, 17, 7, M); rect(g, 3, 20, 34, 7, E); ell(g, 20, 23, 15, 4, MD); flame(g, 20, 24, 9, 15); for (let i = 0; i < 9; i++) ell(g, 5 + i * 3.8, 30 + Math.sin(i) * 1.5, 2.2, 2, PA); return RG(20, 30, 4, 20, 34, 3, 20, 7); };
  X.x_fireplace = g => { rect(g, 3, 6, 34, 31, B); paintOn(g, (x, y) => ((y % 4 === 0) || ((x + (Math.floor(y / 4) % 2) * 3) % 6 === 0) ? BD : null), [B]); rect(g, 1, 5, 38, 3, BD); rect(g, 10, 15, 20, 22, K); flame(g, 20, 34, 7, 15); line(g, 12, 35, 28, 33, AD, 2); return RG(20, 10, 5, 20, 13, 3, 20, 2); };
  X.x_wood_stove = g => { rrect(g, 7, 12, 26, 22, 3, K); rect(g, 17, 3, 6, 9, MD); rect(g, 11, 17, 18, 11, MD); rect(g, 13, 19, 14, 7, G); paintOn(g, (x, y) => ((x + y) % 3 === 0 ? W : null), [G]); for (const x of [9, 29]) rect(g, x, 34, 3, 4, K); return RG(20, 14, 5, 20, 31, 3, 20, 1); };
  X.x_torch_fire = g => { poly(g, [[16, 16], [24, 16], [22, 37], [18, 37]], BD); rect(g, 15, 15, 10, 3, M); flame(g, 20, 16, 7, 14); return RG(20, 25, 1, 20, 30, 1, 20, 1); };
  X.x_flare = g => { rrect(g, 17, 14, 6, 23, 2, TO); rect(g, 17, 20, 6, 3, W); flame(g, 20, 14, 6, 12); dots(g, [[12, 5], [28, 6], [10, 10], [31, 11], [20, 1]], G); return RG(20, 27, 1, 20, 31, 1, 20, 1); };
  X.x_firework = g => { for (let i = 0; i < 12; i++) { const a = i * 0.524; line(g, 20 + Math.cos(a) * 4, 14 + Math.sin(a) * 4, 20 + Math.cos(a) * 13, 14 + Math.sin(a) * 13, i % 3 ? A : GO); gset(g, 20 + Math.cos(a) * 14, 14 + Math.sin(a) * 14, W); } rrect(g, 17, 28, 6, 10, 1, B); tri(g, [17, 28], [20, 24], [23, 28], A); return RG(20, 31, 1, 20, 35, 1, 20, 2); };
  X.x_incense = X.x_incense_stick = g => { rect(g, 12, 32, 16, 5, B); line(g, 20, 32, 26, 10, BD); gset(g, 26, 9, G); for (let i = 0; i < 14; i++) gset(g, 26 + Math.sin(i * 0.6) * 3, 8 - i * 0.5, ST), gset(g, 27 + Math.sin(i * 0.6) * 3, 8 - i * 0.5, ST); return RG(20, 33, 3, 20, 35, 2, 20, 26); };
  X.x_match = X.i_matchstick = X.x_matchstick_fire = g => { line(g, 14, 37, 24, 13, PA, 3); ell(g, 25, 11, 3.5, 4, TO); flame(g, 26, 9, 5, 9); return RG(19, 25, 1, 18, 29, 1, 22, 3); };
  /* --- produce --- */
  X.cucumber = g => { rrect(g, 4, 15, 32, 11, 5, B); paintOn(g, (x, y) => ((x * 3 + y * 5) % 9 === 0 ? BL : null), [B]); rect(g, 35, 18, 3, 3, BD); return RG(18, 19, 4, 18, 23, 3, 18, 10); };
  X.x_mango = g => { poly(g, [[8, 22], [12, 12], [22, 7], [32, 11], [35, 22], [30, 33], [18, 35], [10, 30]], B); paintOn(g, (x, y) => (x > 24 && y < 20 ? A : null), [B]); line(g, 22, 7, 23, 3, BD, 2); ell(g, 28, 4, 4, 1.5, S); return RG(20, 18, 4, 20, 25, 3, 20, 4); };
  X.x_star_fruit = g => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 16; pts.push([20 + Math.cos(a) * r, 21 + Math.sin(a) * r]); } poly(g, pts, B); for (let i = 0; i < 5; i++) line(g, 20, 21, 20 + Math.cos(-Math.PI / 2 + i * 1.257) * 12, 21 + Math.sin(-Math.PI / 2 + i * 1.257) * 12, BL); ell(g, 20, 21, 2, 2, PA); return RG(20, 18, 3, 20, 25, 2, 20, 4); };
  X.x_ginger = X.x_ginger_root = g => { for (const [x, y, rx, ry] of [[14, 24, 9, 6], [26, 22, 7, 5], [20, 15, 4, 6], [31, 14, 3, 5], [8, 17, 3, 5]]) ell(g, x, y, rx, ry, B); paintOn(g, (x, y) => (y % 4 === 0 ? BD : null), [B]); return RG(16, 22, 3, 16, 27, 3, 20, 8); };
  X.x_kidney_beans = g => { for (const [x, y] of [[12, 15], [26, 12], [19, 26], [30, 26], [9, 29]]) { ell(g, x, y, 6, 4, B); ell(g, x, y + 2.5, 2.5, 1.2, E); gset(g, x - 2, y - 2, BL); } return RG(19, 24, 2, 19, 28, 2, 19, 8); };
  X.x_sprouts = g => { for (let i = 0; i < 7; i++) { const x = 8 + i * 4; line(g, x, 37, x + Math.sin(i) * 3, 14 + (i % 3) * 3, PA); ell(g, x + Math.sin(i) * 3 - 2, 13 + (i % 3) * 3, 2.2, 1.4, S); ell(g, x + Math.sin(i) * 3 + 2, 13 + (i % 3) * 3, 2.2, 1.4, S); } ell(g, 20, 34, 14, 4, B); return RG(20, 31, 4, 20, 35, 3, 20, 8); };
  X.x_herbs = X.x_mint_leaves = g => { line(g, 20, 37, 20, 10, S, 2); for (let i = 0; i < 4; i++) for (const d of [-1, 1]) ell(g, 20 + d * 5, 13 + i * 6, 5, 3, i % 2 ? SL : S); paintOn(g, (x, y) => (x === 20 + (x > 20 ? 5 : -5) ? BD : null), [S, SL]); return RG(20, 15, 4, 20, 20, 2, 20, 5); };
  X.x_rosemary = g => { for (const [x, t] of [[13, -0.25], [20, 0], [27, 0.25]]) { line(g, x, 37, x + t * 24, 6, BD); for (let y = 8; y < 34; y += 2) { const xx = x + t * (37 - y); gset(g, xx - 1, y, S); gset(g, xx + 1, y + 1, S); gset(g, xx - 2, y - 1, SL); gset(g, xx + 2, y, SL); } } return RG(20, 22, 3, 20, 27, 2, 20, 4); };
  /* --- phones and screens --- */
  X.dial_phone = g => { rrect(g, 7, 20, 26, 16, 4, B); ell(g, 20, 28, 6, 6, W); for (let i = 0; i < 10; i++) ell(g, 20 + Math.cos(i * 0.63) * 4.2, 28 + Math.sin(i * 0.63) * 4.2, 0.8, 0.8, K); rrect(g, 4, 10, 32, 7, 3, B); rect(g, 4, 9, 6, 9, B); rect(g, 30, 9, 6, 9, B); for (const x of [11, 29]) rect(g, x - 1, 16, 3, 4, BD);
    return RG(20, 13, 6, 20, 33, 3, 20, 5); };
  X.x_flip_phone = g => { rrect(g, 12, 3, 16, 17, 3, B); rect(g, 14, 6, 12, 10, S); rrect(g, 12, 20, 16, 17, 3, B); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) rect(g, 14 + c * 4.5, 23 + r * 3.3, 3, 2, PA); line(g, 12, 20, 28, 20, BD); return RG(20, 10, 3, 20, 14, 3, 20, 0); };
  X.x_walkie_talkie_handset = X.x_walkie_talkie;
  X.x_gps_device = g => { rrect(g, 6, 8, 28, 26, 4, K); rect(g, 9, 11, 22, 17, S); line(g, 10, 24, 18, 18, W); line(g, 18, 18, 28, 20, W); tri(g, [18, 13], [21, 19], [15, 19], TO); ell(g, 20, 31, 2, 1.5, MD); return RG(24, 15, 3, 24, 22, 2, 20, 4); };
  X.x_smart_ring = g => { ell(g, 20, 21, 14, 14, M); ell(g, 20, 21, 10, 10, E); ell(g, 20, 8, 5, 3, K); gset(g, 18, 8, G); gset(g, 22, 8, G); return RG(20, 31, 3, 20, 34, 2, 20, 3); };
  X.game_console = g => { rrect(g, 5, 13, 30, 13, 3, B); rect(g, 7, 15, 13, 3, K); ell(g, 30, 17, 1.5, 1.5, G); rrect(g, 9, 28, 22, 9, 4, BD); ell(g, 13, 32, 2, 2, K); for (const [x, y] of [[26, 30], [28, 32], [26, 34], [24, 32]]) gset(g, x, y, A); return RG(20, 19, 5, 20, 23, 3, 20, 7); };
  X.x_drone = g => { rrect(g, 13, 17, 14, 9, 3, B); for (const [x, y] of [[6, 13], [34, 13], [6, 27], [34, 27]]) { line(g, 20, 21, x, y, MD, 2); ell(g, x, y - 2, 6, 1.5, SL); rect(g, x - 1, y - 2, 2, 3, K); } ell(g, 20, 27, 2.5, 2.5, K); return RG(20, 20, 3, 20, 24, 2, 20, 12, { float: true }); };
  X.x_soundbar = g => { rrect(g, 2, 15, 36, 10, 4, K); for (let x = 5; x < 36; x += 2) for (let y = 17; y < 24; y += 2) gset(g, x, y, MD); ell(g, 20, 20, 2, 2, G); return RG(12, 19, 3, 28, 21, 3, 20, 9); };
  X.x_studio_light = g => { line(g, 20, 20, 8, 37, MD, 2); line(g, 20, 20, 32, 37, MD, 2); line(g, 20, 20, 20, 37, MD); rect(g, 19, 14, 2, 7, MD); poly(g, [[9, 3], [31, 3], [27, 15], [13, 15]], B); rect(g, 12, 5, 16, 8, G); return RG(20, 8, 4, 20, 12, 3, 20, 1); };
  X.x_video_camera = g => { rrect(g, 7, 13, 22, 15, 3, B); rect(g, 29, 15, 6, 11, MD); ell(g, 35, 20, 3, 5, K); ell(g, 35, 20, 1.5, 3, S); rect(g, 10, 8, 8, 5, K); rect(g, 3, 15, 5, 8, K); ell(g, 12, 17, 1.5, 1.5, TO); return RG(18, 19, 4, 18, 25, 3, 18, 4); };
  /* --- cups and glasses --- */
  const glass = (o) => (g) => { const t = o.t || 8, b = o.b || 35, wt = o.wt || 10, wb = o.wb || 8; poly(g, [[20 - wt, t], [20 + wt, t], [20 + wb, b], [20 - wb, b]], SL); if (o.fill) poly(g, [[20 - wt + 1 + (wt - wb) * (o.fill - t) / (b - t), o.fill], [20 + wt - 1 - (wt - wb) * (o.fill - t) / (b - t), o.fill], [20 + wb - 1, b - 1], [20 - wb + 1, b - 1]], o.fc || B); line(g, 20 - wt + 2, t + 2, 20 - wb + 2, b - 3, W); if (o.feat) o.feat(g); return RG(20, Math.round((t + b) / 2) - 1, 3, 20, Math.round((t + b) / 2) + 4, 3, 20, t - 5); };
  X.x_shot_glass = glass({ t: 16, b: 34, wt: 8, wb: 6, fill: 22 });
  X.x_juice_glass = glass({ t: 6, b: 36, wt: 9, wb: 7, fill: 11, feat: g => { ell(g, 27, 7, 4, 4, GO); ell(g, 27, 7, 2.5, 2.5, W, [GO]); line(g, 15, 2, 18, 30, A); } });
  X.x_milk_glass = glass({ t: 6, b: 36, wt: 9, wb: 8, fill: 10, fc: W });
  X.x_wine_tumbler = glass({ t: 12, b: 34, wt: 10, wb: 7, fill: 24, fc: TO });
  X.x_martini_glass = g => { tri(g, [4, 6], [36, 6], [20, 22], SL); tri(g, [8, 9], [32, 9], [20, 20], B); ell(g, 25, 11, 2, 2, S); line(g, 25, 11, 29, 4, BD); rect(g, 19, 22, 2, 12, SL); ell(g, 20, 35, 9, 2, SL); return RG(20, 12, 4, 20, 16, 3, 20, 2); };
  X.x_espresso_cup = g => { ell(g, 20, 33, 16, 3, W); poly(g, [[9, 17], [31, 17], [28, 31], [12, 31]], W); ell(g, 20, 17, 11, 2.5, BD); C.handleRing(g, 32, 23, 4, 4, W); for (const x of [16, 22]) for (let i = 0; i < 4; i++) gset(g, x + Math.sin(i), 12 - i * 2, ST); rect(g, 10, 22, 20, 5, B); return RG(20, 23, 4, 20, 28, 3, 20, 7); };
  X.x_tankard = g => { rrect(g, 7, 9, 22, 28, 2, B); rect(g, 7, 13, 22, 2, BD); rect(g, 7, 31, 22, 2, BD); C.handleRing(g, 31, 22, 6, 8, B); ell(g, 18, 8, 12, 4, W); ell(g, 10, 11, 3, 3, W); return RG(18, 20, 4, 18, 26, 3, 18, 3); };
  X.i_cocktail_shaker = g => { rrect(g, 11, 15, 18, 22, 3, M); poly(g, [[12, 15], [28, 15], [24, 7], [16, 7]], M); rrect(g, 16, 2, 8, 6, 2, M); rect(g, 11, 15, 18, 2, MD); line(g, 13, 18, 13, 34, W); return RG(20, 22, 4, 20, 29, 3, 20, 1); };
  X.x_gravy_boat = g => { ell(g, 20, 27, 14, 7, B); rect(g, 5, 19, 30, 6, E); poly(g, [[6, 21], [1, 17], [8, 26]], B); C.handleRing(g, 34, 22, 4, 5, B); ell(g, 20, 34, 10, 2, B); ell(g, 18, 21, 12, 2, AD); return RG(20, 26, 4, 20, 31, 3, 20, 15); };
  X.x_measuring_jug = g => { poly(g, [[9, 6], [29, 6], [28, 36], [10, 36]], SL); tri(g, [9, 6], [5, 4], [10, 10], SL); C.handleRing(g, 31, 18, 5, 8, SL); poly(g, [[10, 18], [28, 18], [28, 35], [10, 35]], B); for (let y = 10; y < 34; y += 4) line(g, 11, y, 15, y, K); return RG(20, 24, 4, 20, 30, 3, 20, 2); };
  X.x_sugar_bowl = g => { ell(g, 20, 27, 13, 9, W); rect(g, 6, 18, 28, 5, E); ell(g, 20, 19, 13, 3, B); ell(g, 20, 15, 3, 2, B); for (const d of [-1, 1]) C.handleRing(g, 20 + d * 14, 25, 3, 4, W); rect(g, 10, 26, 20, 3, B); return RG(20, 27, 4, 20, 32, 3, 20, 11); };
  /* --- mirrors, doors, windows --- */
  X.i_fire_screen = g => { for (const [x, w] of [[3, 10], [13, 14], [27, 10]]) { rect(g, x, 9, w, 26, MD); rect(g, x + 1, 10, w - 2, 24, K); paintOn(g, (xx, y) => ((xx + y) % 2 ? MD : null), [K]); } ell(g, 20, 9, 7, 3, MD); flame(g, 20, 33, 5, 8); return RG(20, 18, 4, 20, 25, 3, 20, 4); };
  X.x_door_knocker = g => { ell(g, 20, 13, 9, 9, GO); ell(g, 20, 13, 6, 6, AD); ell(g, 20, 27, 11, 11, GO); ell(g, 20, 27, 8, 8, E); return RG(20, 12, 3, 20, 16, 2, 20, 3); };
  X.x_garage_door = g => { rect(g, 3, 6, 34, 31, BD); rect(g, 5, 8, 30, 29, B); for (let y = 12; y < 37; y += 5) line(g, 5, y, 34, y, BD); for (let x = 8; x < 33; x += 6) rect(g, x, 9, 4, 2, S); rect(g, 18, 31, 4, 1, M); return RG(20, 18, 6, 20, 26, 4, 20, 2); };
  X.x_keyhole = g => { rrect(g, 9, 4, 22, 32, 3, GO); ell(g, 20, 15, 4, 4, K); tri(g, [17, 17], [23, 17], [20, 28], K); for (const [x, y] of [[12, 7], [28, 7], [12, 33], [28, 33]]) gset(g, x, y, AD); return RG(20, 9, 5, 20, 32, 3, 20, 2); };
  X.x_rear_view_mirror = g => { rect(g, 19, 2, 2, 10, K); rrect(g, 3, 11, 34, 14, 6, K); rrect(g, 5, 13, 30, 10, 5, SL); line(g, 8, 14, 14, 21, W); return RG(20, 17, 6, 20, 21, 4, 20, 5); };
  /* --- computers and audio --- */
  X.i_oscilloscope = g => { rrect(g, 3, 8, 34, 26, 2, B); rect(g, 6, 11, 18, 14, K); for (let x = 7; x < 23; x++) gset(g, x, 18 + Math.sin(x * 0.7) * 4, G); for (const [x, y] of [[28, 13], [33, 13], [28, 19], [33, 19]]) C.dial(g, x, y, 2); rect(g, 6, 28, 18, 3, MD); return RG(15, 17, 3, 30, 27, 3, 20, 3); };
  X.x_3d_printer = g => { rect(g, 4, 4, 32, 33, B); rect(g, 7, 7, 26, 24, K); rect(g, 9, 8, 22, 2, M); rect(g, 17, 10, 6, 4, MD); tri(g, [19, 14], [21, 14], [20, 16], G); poly(g, [[14, 29], [16, 20], [24, 20], [26, 29]], A); rect(g, 7, 32, 26, 3, MD); return RG(20, 24, 3, 20, 27, 2, 20, 0); };
  X.x_flash_drive = X.x_usb_stick = X.x_usb_key;
  X.x_floppy_disk = g => { poly(g, [[5, 5], [32, 5], [36, 9], [36, 36], [5, 36]], B); rect(g, 12, 5, 16, 11, M); rect(g, 22, 7, 4, 7, B); rect(g, 10, 21, 21, 15, W); for (let y = 25; y < 35; y += 3) line(g, 12, y, 29, y, PA); return RG(20, 27, 4, 20, 32, 3, 20, 1); };
  X.x_graphics_card = g => { rect(g, 2, 10, 36, 18, K); for (const x of [11, 28]) { ell(g, x, 19, 7, 7, MD); for (let i = 0; i < 6; i++) line(g, x, 19, x + Math.cos(i) * 6, 19 + Math.sin(i) * 6, M); ell(g, x, 19, 2, 2, B); } rect(g, 6, 28, 26, 3, GO); for (let x = 7; x < 32; x += 2) gset(g, x, 30, AD); return RG(20, 14, 2, 20, 24, 2, 20, 5); };
  X.x_ram_stick = g => { rect(g, 2, 13, 36, 13, S); for (let i = 0; i < 4; i++) rect(g, 5 + i * 8, 15, 6, 6, K); rect(g, 2, 26, 36, 3, GO); for (let x = 3; x < 38; x += 2) gset(g, x, 28, AD); rect(g, 19, 26, 2, 3, E); return RG(20, 22, 6, 20, 24, 3, 20, 8); };
  X.x_record_player = X.x_turntable = g => { rrect(g, 3, 13, 34, 22, 2, B); ell(g, 17, 22, 11, 7, K); for (let r = 3; r < 10; r += 3) ell(g, 17, 22, r, r * 0.62, MD, [K]); ell(g, 17, 22, 3, 2, A); line(g, 33, 15, 26, 25, M, 2); ell(g, 33, 15, 2, 2, MD); return RG(17, 30, 4, 28, 31, 3, 20, 8); };
  X.x_vinyl_record = g => { ell(g, 20, 20, 16, 16, K); for (let r = 6; r < 15; r += 3) { ell(g, 20, 20, r + 0.5, r + 0.5, MD); ell(g, 20, 20, r, r, K); } ell(g, 20, 20, 5, 5, B); ell(g, 20, 20, 1, 1, E); line(g, 9, 9, 14, 12, W); return RG(20, 10, 3, 20, 30, 3, 20, 3); };
  X.x_server_rack = g => { rect(g, 9, 2, 22, 35, K); for (let i = 0; i < 7; i++) { rect(g, 11, 4 + i * 4.7, 18, 4, MD); gset(g, 13, 6 + i * 4.7, i % 2 ? G : TO); gset(g, 15, 6 + i * 4.7, G); for (let x = 19; x < 28; x += 2) gset(g, x, 6 + i * 4.7, K); } return RG(20, 13, 3, 20, 20, 3, 20, 0); };
  X.x_smart_glasses = g => { line(g, 2, 17, 38, 17, K, 2); for (const x of [12, 28]) { rrect(g, x - 7, 15, 14, 9, 3, K); rect(g, x - 5, 17, 10, 5, S); } rect(g, 30, 13, 6, 3, G); return RG(20, 20, 8, 20, 28, 3, 20, 10); };
  X.x_vr_headset = g => { rrect(g, 5, 12, 30, 17, 5, B); rect(g, 8, 15, 24, 8, K); line(g, 2, 18, 5, 18, K, 2); line(g, 35, 18, 38, 18, K, 2); rect(g, 6, 9, 28, 3, BD); ell(g, 20, 27, 3, 1.5, E); return RG(20, 19, 6, 20, 26, 3, 20, 6); };
  /* --- bathroom --- */
  X.i_plunger = X.x_plunger_tool = g => { line(g, 20, 3, 20, 22, BD, 3); ell(g, 20, 29, 13, 8, B); rect(g, 6, 30, 28, 8, E); rect(g, 7, 29, 26, 2, BD); return RG(20, 25, 4, 20, 28, 3, 20, 14); };
  X.x_urinal_stall = g => { rect(g, 2, 3, 6, 34, M); rect(g, 32, 3, 6, 34, M); rrect(g, 12, 10, 16, 24, 6, W); ell(g, 20, 22, 5, 7, PA); rect(g, 18, 4, 4, 6, M); ell(g, 20, 30, 2, 1, MD); return RG(20, 15, 3, 20, 27, 3, 20, 5); };
  X.x_shower = g => { rect(g, 30, 4, 3, 33, M); line(g, 31, 5, 18, 5, M, 2); ell(g, 16, 8, 6, 2.5, M); for (let i = 0; i < 8; i++) line(g, 11 + i * 1.5, 12, 7 + i * 2.3, 32, SL); rect(g, 3, 34, 34, 3, W); return RG(20, 20, 4, 20, 25, 3, 16, 3); };
  X.x_shower_head = g => { line(g, 36, 4, 26, 12, M, 2); ell(g, 20, 17, 10, 7, M); ell(g, 20, 19, 8, 4, MD); for (let i = 0; i < 9; i++) line(g, 13 + i * 1.8, 24, 10 + i * 2.5, 37, SL); return RG(20, 15, 3, 20, 19, 3, 20, 9); };
  X.x_sponge = g => { box3(g, 5, 16, 28, 18, 4, B); rect(g, 5, 16, 28, 5, S); paintOn(g, (x, y) => ((x * 3 + y * 7) % 6 === 0 ? BD : null), [B]); return RG(19, 25, 5, 19, 30, 3, 19, 11); };
  X.x_toothbrush_holder = g => { rrect(g, 11, 17, 18, 20, 3, B); for (const [x, c] of [[15, A], [20, S], [25, TO]]) { line(g, x, 17, x + (x - 20) * 0.3, 3, c, 2); rect(g, x - 1 + (x - 20) * 0.3, 3, 3, 4, W); } return RG(20, 24, 4, 20, 31, 3, 20, 11); };
  X.x_fountain_pen_ink = X.x_ink_bottle;
  X.x_water_pump = g => { rect(g, 15, 10, 10, 26, B); rect(g, 12, 35, 16, 3, BD); line(g, 15, 15, 5, 18, B, 3); line(g, 25, 11, 36, 4, M, 2); rect(g, 16, 7, 8, 3, BD); dots(g, [[5, 22], [5, 26], [6, 30]], SL); return RG(20, 18, 2, 20, 25, 2, 20, 3); };
  X.x_well = g => { rect(g, 6, 22, 28, 15, B); paintOn(g, (x, y) => ((y % 4 === 0) || ((x + (Math.floor(y / 4) % 2) * 3) % 6 === 0) ? BD : null), [B]); for (const x of [8, 31]) rect(g, x, 7, 2, 15, BD); tri(g, [3, 9], [20, 2], [37, 9], A); line(g, 9, 12, 31, 12, BD); line(g, 20, 12, 20, 19, PA); rect(g, 17, 19, 6, 4, M);
    return RG(20, 28, 5, 20, 33, 3, 20, 3); };
  /* --- beds and pillows --- */
  X.sleeping_bag = g => { rrect(g, 3, 13, 34, 18, 8, B); ell(g, 8, 22, 6, 7, A); ell(g, 8, 22, 4, 5, PA); for (let x = 16; x < 36; x += 5) line(g, x, 14, x, 30, BD); line(g, 14, 15, 35, 15, MD); return RG(24, 21, 4, 24, 26, 3, 24, 9); };
  X.x_hammock = g => { line(g, 2, 37, 6, 8, BD, 2); line(g, 38, 37, 34, 8, BD, 2); line(g, 6, 10, 10, 18, PA); line(g, 34, 10, 30, 18, PA); for (let x = 10; x <= 30; x++) { const y = 18 + Math.sin((x - 10) / 20 * Math.PI) * 8; rect(g, x, y - 2, 1, 3, B); } paintOn(g, (x, y) => ((x + y) % 3 === 0 ? A : null), [B]); return RG(20, 23, 3, 20, 26, 2, 20, 16); };
  X.x_hot_water_bottle = g => { rrect(g, 8, 11, 24, 26, 6, B); rect(g, 16, 4, 8, 8, B); rect(g, 15, 2, 10, 3, K); for (let y = 16; y < 34; y += 3) line(g, 11, y, 29, y, BD); return RG(20, 20, 4, 20, 27, 3, 20, 3); };
  X.x_neck_pillow = g => { ell(g, 20, 21, 16, 15, B); ell(g, 20, 17, 7, 9, E); rect(g, 13, 26, 14, 12, E); paintOn(g, (x, y) => ((x + y) % 5 === 0 ? BL : null), [B]); return RG(20, 29, 3, 10, 30, 2, 20, 6); };
  X.x_yoga_mat = g => { ell(g, 30, 22, 8, 8, B); ell(g, 30, 22, 5, 5, BD); ell(g, 30, 22, 2, 2, B); rect(g, 3, 25, 27, 5, B); rect(g, 3, 25, 27, 1, BL); return RG(30, 20, 2, 30, 25, 2, 30, 13); };
  /* --- furniture --- */
  X.throne = g => { rrect(g, 9, 2, 22, 26, 4, B); for (const x of [9, 20, 31]) ell(g, x, 3, 2, 2, GO); rect(g, 12, 6, 16, 18, A); rect(g, 6, 22, 28, 6, B); rect(g, 4, 18, 5, 10, B); rect(g, 31, 18, 5, 10, B); rect(g, 7, 28, 4, 9, BD); rect(g, 29, 28, 4, 9, BD); line(g, 6, 22, 34, 22, GO); return RG(20, 12, 4, 20, 18, 3, 20, 1); };
  X.wheelchair = g => { C.wheel(g, 23, 27, 10); paintOn(g, (x, y) => (Math.hypot(x - 23, y - 27) < 7 && (x + y) % 3 ? E : null), [M]); rect(g, 13, 8, 3, 17, MD); rect(g, 13, 7, 6, 2, K); rect(g, 13, 20, 16, 3, B); rect(g, 13, 11, 3, 10, B); line(g, 13, 23, 7, 33, MD); C.wheel(g, 7, 34, 3); return RG(22, 14, 2, 22, 18, 2, 18, 4); };
  X.x_director_chair = g => { rect(g, 8, 6, 24, 8, B); rect(g, 8, 20, 24, 4, B); line(g, 8, 6, 8, 20, K, 2); line(g, 32, 6, 32, 20, K, 2); line(g, 9, 24, 31, 37, BD, 2); line(g, 31, 24, 9, 37, BD, 2); line(g, 6, 20, 6, 15, BD, 2); line(g, 34, 20, 34, 15, BD, 2); return RG(20, 9, 4, 20, 12, 3, 20, 2); };
  X.x_park_seat = g => { for (const y of [10, 15]) rect(g, 3, y, 34, 3, B); for (const y of [21, 24]) rect(g, 3, y, 34, 2, B); for (const x of [6, 32]) { rect(g, x, 9, 2, 28, K); line(g, x, 20, x + (x < 20 ? -2 : 2), 37, K, 2); } return RG(20, 12, 5, 20, 16, 3, 20, 5); };
  X.x_step_stool = g => { rect(g, 9, 9, 22, 4, B); rect(g, 6, 22, 28, 4, B); line(g, 10, 13, 6, 37, BD, 2); line(g, 30, 13, 34, 37, BD, 2); line(g, 20, 13, 20, 22, BD); return RG(20, 24, 4, 20, 11, 3, 20, 3); };
  X.x_kitchen_counter = X.x_kitchen_island = g => { rect(g, 2, 12, 36, 4, PA); rect(g, 4, 16, 32, 21, B); for (const x of [4, 15, 26]) { rect(g, x + 1, 18, 9, 17, BD); rect(g, x + 2, 19, 7, 15, B); rect(g, x + 4, 21, 3, 1, M); } ell(g, 10, 9, 4, 3, A); rect(g, 26, 6, 7, 6, M); return RG(20, 25, 6, 20, 30, 3, 20, 6); };
  X.x_shoe_rack = g => { for (const y of [12, 22, 32]) rect(g, 4, y, 32, 2, B); for (const x of [4, 34]) rect(g, x, 6, 2, 31, BD); for (const [x, y] of [[7, 8], [19, 8], [11, 18], [24, 18], [7, 28], [22, 28]]) { rrect(g, x, y, 9, 4, 1, A); rect(g, x + 6, y - 2, 3, 3, A); } return RG(20, 24, 5, 20, 26, 3, 20, 4); };
  X.x_wine_rack = g => { rect(g, 4, 4, 32, 33, B); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { ell(g, 9 + c * 7.3, 9 + r * 7.8, 3, 3, K); ell(g, 9 + c * 7.3, 9 + r * 7.8, 1.8, 1.8, (r + c) % 3 ? TO : S); } return RG(20, 16, 6, 20, 25, 3, 20, 1); };
  X.x_folding_screen = g => { for (let i = 0; i < 4; i++) { rect(g, 3 + i * 9, 5 + (i % 2) * 2, 8, 30, B); rect(g, 4 + i * 9, 7 + (i % 2) * 2, 6, 26, PA); ell(g, 7 + i * 9, 15 + (i % 2) * 2, 2, 3, A, [PA]); } return RG(20, 14, 5, 20, 22, 3, 20, 2); };
  X.x_umbrella_stand = g => { rrect(g, 11, 15, 18, 22, 3, B); for (let y = 18; y < 36; y += 4) line(g, 11, y, 28, y, BD); line(g, 15, 15, 12, 2, A, 2); line(g, 12, 2, 10, 4, A, 2); line(g, 25, 15, 27, 4, S, 2); tri(g, [24, 6], [27, 1], [30, 6], S); return RG(20, 22, 4, 20, 30, 3, 20, 9); };
  /* --- pots, pans, bowls --- */
  const bowl = (o) => (g) => { const y = o.y || 22, w = o.w || 15, h = o.h || 12; ell(g, 20, y, w, h, o.c || B); rect(g, 20 - w - 1, y - h - 1, w * 2 + 2, h + 1, E); ell(g, 20, y, w, o.rim || 3, o.inner || BD); if (o.feat) o.feat(g, y); return RG(20, y + Math.round(h * 0.45), 4, 20, y + Math.round(h * 0.75), 3, 20, y - 8); };
  X.x_dog_bowl = X.x_pet_food_bowl = bowl({ y: 22, w: 15, h: 10, c: M, inner: B, feat: (g, y) => { for (let i = 0; i < 8; i++) ell(g, 11 + i * 2.5, y - 1 + (i % 2), 1.5, 1.2, BD); } });
  X.x_cat_bowl = bowl({ y: 23, w: 13, h: 8, inner: PA, feat: (g, y) => { for (const d of [-1, 1]) tri(g, [20 + d * 9, y + 2], [20 + d * 7, y - 4], [20 + d * 4, y + 2], B); for (const [x, yy] of [[17, y], [23, y], [20, y + 1]]) gset(g, x, yy, BD); } });
  X.x_fruit_bowl = bowl({ y: 24, w: 16, h: 10, feat: (g, y) => { for (const [x, yy, c] of [[12, y - 4, TO], [20, y - 6, GO], [28, y - 4, S], [16, y - 9, A]]) ell(g, x, yy, 4, 4, c); line(g, 24, y - 12, 27, y - 3, GO, 3); } });
  X.x_mixing_bowl_metal = bowl({ y: 20, w: 16, h: 14, c: M, inner: MD, feat: (g, y) => { line(g, 26, y - 2, 34, y - 16, BD, 2); line(g, 9, y + 3, 11, y + 10, W); } });
  X.x_salad_bowl_wooden = bowl({ y: 22, w: 16, h: 11, inner: S, feat: (g, y) => { for (let i = 0; i < 7; i++) ell(g, 9 + i * 3.5, y - 2 - (i % 2) * 2, 2.5, 2, i % 3 ? S : TO); paintOn(g, (x, yy) => (yy > y + 3 && x % 4 === 0 ? BD : null), [B]); } });
  X.x_serving_bowl = bowl({ y: 21, w: 17, h: 11, feat: (g, y) => { rect(g, 12, y + 10, 16, 3, B); paintOn(g, (x, yy) => (yy === y + 5 ? A : null), [B, BD, BL]); } });
  X.x_salad_spinner = g => { rrect(g, 5, 15, 30, 21, 6, SL); ell(g, 20, 15, 15, 3, B); rect(g, 18, 6, 4, 9, B); ell(g, 20, 6, 5, 2, B); for (let i = 0; i < 7; i++) ell(g, 10 + i * 3.4, 28 + (i % 2) * 2, 2.5, 2, S); return RG(20, 21, 4, 20, 26, 3, 20, 3); };
  X.x_mortar_and_pestle = g => { ell(g, 20, 25, 13, 11, B); rect(g, 6, 14, 28, 9, E); ell(g, 20, 23, 13, 3, BD); rect(g, 13, 35, 14, 2, B); line(g, 24, 22, 33, 5, PA, 4); return RG(20, 28, 4, 20, 32, 3, 20, 17); };
  X.x_baking_tray = g => { poly(g, [[2, 22], [8, 16], [38, 16], [32, 22]], M); poly(g, [[2, 22], [32, 22], [32, 26], [2, 26]], MD); for (const [x, y] of [[11, 18], [19, 18], [27, 18], [15, 20], [24, 20]]) ell(g, x, y, 3, 1.5, B); return RG(17, 23, 4, 17, 25, 3, 20, 10); };
  X.x_muffin_tin = g => { rect(g, 2, 14, 36, 18, M); for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { ell(g, 9 + c * 11, 19 + r * 8, 4.5, 3, MD); ell(g, 9 + c * 11, 18 + r * 8, 3.5, 2, B); } return RG(20, 23, 6, 20, 30, 3, 20, 8); };
  X.x_pie_dish = g => { ell(g, 20, 24, 17, 8, B); rect(g, 2, 15, 36, 8, E); ell(g, 20, 23, 17, 4, BL); ell(g, 20, 23, 13, 2.5, BD); for (let i = 0; i < 16; i++) gset(g, 20 + Math.cos(i * 0.39) * 15.5, 23 + Math.sin(i * 0.39) * 3.6, W); return RG(20, 27, 5, 20, 30, 3, 20, 15); };
  /* --- paper --- */
  X.x_book_stand = g => { poly(g, [[6, 30], [10, 8], [30, 8], [34, 30]], B); poly(g, [[8, 26], [20, 10], [32, 26]], E); poly(g, [[8, 26], [11, 10], [20, 13], [20, 28]], PA); poly(g, [[32, 26], [29, 10], [20, 13], [20, 28]], W); rect(g, 4, 30, 32, 3, BD); line(g, 12, 34, 9, 37, BD, 2); line(g, 28, 34, 31, 37, BD, 2);
    return RG(20, 19, 5, 20, 24, 3, 20, 5); };
  X.x_flag = g => { rect(g, 6, 3, 2, 34, MD); ell(g, 7, 3, 1.5, 1.5, GO); for (let x = 8; x < 36; x++) { const off = Math.round(Math.sin(x * 0.35) * 2); rect(g, x, 6 + off, 1, 7, B); rect(g, x, 13 + off, 1, 7, A); } rect(g, 4, 36, 6, 2, MD); return RG(22, 10, 4, 22, 16, 3, 22, 3); };
  X.x_origami = X.x_paper_crane = g => { tri(g, [20, 22], [4, 8], [16, 24], B); tri(g, [20, 22], [36, 8], [24, 24], BL); poly(g, [[12, 26], [20, 18], [28, 26], [20, 30]], B); poly(g, [[14, 25], [6, 14], [8, 13], [16, 23]], BD); tri(g, [6, 14], [3, 15], [6, 16], BD); return RG(20, 24, 2, 20, 27, 2, 20, 16); };
  X.x_paper_plane = g => { tri(g, [3, 12], [37, 20], [16, 32], W); tri(g, [3, 12], [37, 20], [18, 22], PA); line(g, 18, 22, 37, 20, BD); return RG(22, 21, 3, 22, 25, 2, 22, 14); };
  X.x_paper_sheet = g => { poly(g, [[7, 3], [27, 3], [33, 9], [33, 37], [7, 37]], W); tri(g, [27, 3], [27, 9], [33, 9], PA); for (let y = 14; y < 34; y += 3) line(g, 10, y, 30, y, SL); line(g, 12, 6, 12, 36, TO); return RG(21, 18, 4, 21, 26, 3, 20, 1); };
  X.x_paper_stack = g => { for (let i = 0; i < 7; i++) rect(g, 6 + (i % 2), 10 + i * 3.6, 28, 3, i % 2 ? PA : W); rect(g, 5, 8, 29, 3, W); return RG(20, 18, 5, 20, 26, 3, 20, 4); };
  X.x_photo_album = g => { rrect(g, 5, 6, 30, 30, 2, B); rect(g, 5, 6, 4, 30, BD); rect(g, 13, 11, 18, 14, W); rect(g, 15, 13, 14, 10, S); tri(g, [16, 22], [21, 15], [26, 22], S); ell(g, 25, 15, 1.5, 1.5, GO); return RG(22, 29, 4, 22, 32, 3, 22, 2); };
  X.x_receipt_roll = g => { ell(g, 14, 15, 10, 10, W); ell(g, 14, 15, 3, 3, M); poly(g, [[14, 25], [36, 25], [36, 37], [16, 37]], W); for (let y = 28; y < 36; y += 2) line(g, 20, y, 33, y, PA); return RG(14, 13, 3, 14, 19, 2, 14, 3); };
  /* --- trees and wood --- */
  X.x_branch = g => { line(g, 3, 32, 36, 10, B, 3); line(g, 15, 24, 17, 10, B, 2); line(g, 26, 17, 33, 24, B, 2); for (const [x, y] of [[17, 8], [34, 26], [37, 8], [22, 14]]) ell(g, x, y, 3, 1.7, S); return RG(14, 25, 2, 14, 30, 2, 20, 10); };
  X.x_bush = g => { for (const [x, y, r] of [[11, 26, 8], [29, 26, 8], [20, 19, 10], [20, 28, 9]]) ell(g, x, y, r, r * 0.85, S); paintOn(g, (x, y) => ((x * 3 + y * 5) % 7 === 0 ? SL : null), [S]); return RG(20, 21, 5, 20, 28, 3, 20, 9); };
  X.x_hedge = g => { rrect(g, 2, 10, 36, 25, 4, S); paintOn(g, (x, y) => ((x * 3 + y * 5) % 6 === 0 ? SL : (x + y * 2) % 11 === 0 ? BD : null), [S]); rect(g, 2, 35, 36, 2, BD); return RG(20, 19, 6, 20, 27, 4, 20, 5); };
  X.x_pine = g => { rect(g, 18, 30, 4, 7, BD); for (let i = 0; i < 4; i++) tri(g, [20 - 6 - i * 3, 12 + i * 6], [20, 2 + i * 6], [20 + 6 + i * 3, 12 + i * 6], S); paintOn(g, (x, y) => ((x + y) % 7 === 0 ? SL : null), [S]); return RG(20, 18, 3, 20, 24, 3, 20, 1); };
  X.x_christmas_tree_decorated = g => { const r = X.x_pine(g); for (const [x, y, c] of [[16, 12, TO], [23, 15, GO], [13, 21, S], [26, 23, TO], [19, 26, GO], [10, 28, A], [29, 29, W]]) ell(g, x, y, 1.5, 1.5, c === S ? A : c); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.257; line(g, 20, 3, 20 + Math.cos(a) * 3, 3 + Math.sin(a) * 3, GO); } rect(g, 14, 33, 6, 4, A); rect(g, 23, 33, 5, 4, TO); return r; };
  X.x_coconut_tree = g => { for (let i = 0; i < 26; i++) ell(g, 22 + Math.sin(i * 0.1) * 4 - i * 0.1, 37 - i, 2.2, 1, B); for (let i = 0; i < 26; i += 3) line(g, 19 + Math.sin(i * 0.1) * 4 - i * 0.1, 37 - i, 25 + Math.sin(i * 0.1) * 4 - i * 0.1, 37 - i, BD);
    for (const [dx, dy] of [[-14, 4], [14, 4], [-10, -6], [10, -6], [0, -9]]) { line(g, 22, 11, 22 + dx, 11 + dy, S, 2); for (let k = 2; k < 10; k += 2) gset(g, 22 + dx * k / 10, 13 + dy * k / 10, S); } for (const x of [19, 23, 21]) ell(g, x, x === 21 ? 16 : 14, 2.3, 2.3, BD); return RG(22, 22, 1, 22, 26, 2, 22, 2); };
  X.x_dead_tree = g => { const br = (x, y, a, l, d) => { if (d > 3) return; const x2 = x + Math.cos(a) * l, y2 = y - Math.sin(a) * l; line(g, x, y, x2, y2, B, Math.max(1, 3 - d)); br(x2, y2, a + 0.55, l * 0.65, d + 1); br(x2, y2, a - 0.5, l * 0.6, d + 1); }; br(20, 37, Math.PI / 2, 12, 0); return RG(20, 30, 1, 20, 33, 1, 20, 4); };
  X.x_tree_stump = g => { rect(g, 8, 17, 24, 17, B); C.slats(g, 8, 17, 24, 17, 6); ell(g, 20, 17, 12, 4, PA); for (let r = 2; r < 11; r += 3) ell(g, 20, 17, r, r * 0.33, BD, [PA]); for (const [a, b] of [[8, 34], [32, 34]]) tri(g, [a - 4, b + 3], [a, b - 4], [a + 4, b], B); return RG(20, 24, 4, 20, 30, 3, 20, 10); };
  X.x_driftwood = g => { poly(g, [[2, 25], [8, 20], [26, 21], [37, 15], [35, 21], [28, 27], [7, 28]], B); for (let i = 0; i < 4; i++) line(g, 6 + i * 6, 23, 14 + i * 6, 25, BD); ell(g, 18, 24, 2, 1.5, BD); return RG(16, 23, 3, 16, 26, 2, 16, 16); };
  X.x_firewood = X.x_log_pile = g => { for (const [x, y] of [[9, 30], [20, 30], [31, 30], [14.5, 21], [25.5, 21], [20, 12]]) { ell(g, x, y, 5.5, 5, B); ell(g, x, y, 4, 3.5, PA); ell(g, x, y, 1.5, 1.3, BD); } return RG(20, 22, 4, 20, 31, 3, 20, 5); };
  /* --- lights --- */
  X.x_chandelier_light = X.x_chandelier;
  X.x_floor_light = g => { tri(g, [10, 14], [20, 2], [30, 14], B); ell(g, 20, 14, 10, 2, G); rect(g, 19, 14, 2, 21, MD); ell(g, 20, 36, 8, 2, MD); return RG(20, 9, 3, 20, 12, 2, 20, 1); };
  X.x_flashlight_torch = X.x_torch_light = g => { rrect(g, 3, 16, 22, 8, 3, B); poly(g, [[24, 15], [31, 12], [31, 28], [24, 25]], MD); rect(g, 31, 12, 2, 16, G); tri(g, [33, 13], [39, 6], [39, 34], G); rect(g, 10, 15, 4, 2, A); return RG(14, 19, 3, 14, 22, 3, 14, 11); };
  X.x_headlamp = g => { ell(g, 20, 20, 16, 9, B); ell(g, 20, 20, 13, 6, E); rrect(g, 13, 22, 14, 10, 3, K); ell(g, 20, 27, 4, 3.5, G); return RG(14, 11, 2, 26, 12, 2, 20, 6); };
  X.x_glow_stick = g => { line(g, 10, 34, 30, 6, G, 4); line(g, 11, 31, 27, 8, W); ell(g, 30, 5, 2, 2, G); dots(g, [[6, 24], [34, 14], [22, 4], [16, 36]], G); return RG(20, 18, 2, 20, 23, 2, 20, 12); };
  X.x_lantern_light = X.x_oil_lantern = g => { line(g, 13, 7, 20, 1, M); line(g, 27, 7, 20, 1, M); rect(g, 12, 7, 16, 4, MD); rrect(g, 13, 11, 14, 19, 3, SL); ell(g, 20, 21, 3, 6, G); ell(g, 20, 23, 1.5, 3, W); rect(g, 11, 30, 18, 5, MD); for (const x of [13, 26]) rect(g, x, 11, 1, 19, MD); return RG(20, 18, 4, 20, 25, 3, 20, 4); };
  X.x_paper_lantern = g => { line(g, 20, 1, 20, 6, K); rect(g, 15, 6, 10, 2, K); ell(g, 20, 20, 13, 13, B); for (let y = 10; y < 32; y += 4) ell(g, 20, y, 13 - Math.abs(y - 20) * 0.5, 0.8, BD, [B, BL]); rect(g, 15, 32, 10, 2, K); for (let x = 17; x < 24; x += 2) line(g, x, 34, x, 38, TO); paintOn(g, (x, y) => (Math.hypot(x - 20, y - 20) < 5 ? G : null), [B]); return RG(20, 16, 4, 20, 25, 3, 20, 3); };
  X.x_lava_lamp = g => { poly(g, [[16, 3], [24, 3], [29, 28], [11, 28]], SL); for (const [x, y, r] of [[19, 8, 2], [21, 15, 3.5], [17, 22, 2.5], [23, 24, 3]]) ell(g, x, y, r, r * 1.2, B); tri(g, [16, 3], [20, -1], [24, 3], M); poly(g, [[11, 28], [29, 28], [26, 37], [14, 37]], M); return RG(20, 14, 3, 20, 20, 2, 20, 1); };
  X.x_light_bar = g => { rrect(g, 2, 15, 36, 9, 3, K); for (let i = 0; i < 6; i++) rect(g, 4 + i * 6, 17, 4, 5, i % 2 ? TO : S); paintOn(g, (x, y) => (y === 17 ? W : null), [TO, S]); dots(g, [[6, 10], [20, 9], [34, 10]], G); return RG(20, 19, 6, 20, 22, 3, 20, 10); };
  X.x_neon_sign = g => { rrect(g, 3, 8, 34, 24, 3, K); for (let i = 0; i < 26; i++) { const t = i / 25; gset(g, 8 + t * 24, 14 + Math.sin(t * 9) * 3, G); gset(g, 8 + t * 24, 15 + Math.sin(t * 9) * 3, G); } line(g, 9, 25, 31, 25, A); line(g, 10, 2, 13, 8, MD); line(g, 30, 2, 27, 8, MD); return RG(20, 19, 6, 20, 27, 4, 20, 4); };
  X.x_salt_lamp = g => { poly(g, [[12, 30], [8, 18], [14, 6], [24, 3], [32, 13], [30, 30]], B); paintOn(g, (x, y) => (Math.hypot(x - 20, y - 18) < 7 ? BL : null), [B]); rect(g, 9, 30, 22, 6, BD); return RG(20, 17, 4, 20, 24, 3, 20, 3); };
  /* --- trash --- */
  X.x_pedal_bin = g => { rrect(g, 9, 11, 22, 25, 3, M); ell(g, 20, 10, 11, 3, MD); ell(g, 20, 7, 3, 2, MD); rect(g, 6, 34, 10, 3, K); line(g, 10, 15, 10, 32, W); return RG(20, 19, 4, 20, 27, 3, 20, 4); };
  X.x_trash_bag = g => { ell(g, 20, 25, 15, 12, B); poly(g, [[16, 14], [24, 14], [26, 5], [20, 9], [14, 5]], B); rect(g, 15, 12, 10, 2, BD); paintOn(g, (x, y) => ((x * 3 + y) % 9 === 0 ? BL : null), [B]); return RG(20, 23, 4, 20, 29, 3, 20, 5); };
  X.x_crumpled_paper = g => { const pts = []; for (let i = 0; i < 14; i++) { const a = i * 0.449, r = i % 2 ? 11 : 15; pts.push([20 + Math.cos(a) * r, 20 + Math.sin(a) * r]); } poly(g, pts, W); for (let i = 0; i < 7; i++) line(g, 20, 20, 20 + Math.cos(i * 0.9) * 12, 20 + Math.sin(i * 0.9) * 12, PA); return RG(20, 17, 4, 20, 25, 3, 20, 5); };
  X.x_cigarette_butt = g => { rect(g, 8, 21, 20, 6, GO); rect(g, 28, 21, 6, 6, W); poly(g, [[34, 21], [37, 22], [36, 27], [34, 27]], K); ell(g, 20, 31, 15, 2, M); return RG(17, 23, 3, 17, 25, 3, 17, 16); };
  X.x_landfill = g => { poly(g, [[2, 37], [9, 18], [20, 10], [31, 17], [38, 37]], B); for (const [x, y, w, h, c] of [[10, 22, 6, 4, A], [21, 15, 5, 5, S], [26, 25, 7, 4, M], [15, 29, 5, 6, TO], [27, 31, 4, 3, W]]) rect(g, x, y, w, h, c); line(g, 13, 13, 18, 9, MD, 2); return RG(20, 22, 4, 20, 29, 3, 20, 6); };
  /* --- appliances and grooming --- */
  X.x_clothes_dryer_rack = g => { for (const y of [10, 17, 24]) line(g, 4, y, 36, y, M); line(g, 4, 10, 10, 37, MD, 2); line(g, 36, 10, 30, 37, MD, 2); line(g, 10, 10, 4, 37, MD, 2); line(g, 30, 10, 36, 37, MD, 2); poly(g, [[7, 10], [16, 10], [15, 21], [8, 21]], B); poly(g, [[20, 17], [33, 17], [32, 28], [21, 28]], A); rect(g, 22, 10, 6, 7, S);
    return RG(12, 14, 2, 12, 18, 2, 20, 4); };
  X.x_curling_iron = X.x_hair_straightener = g => { rrect(g, 3, 17, 16, 7, 3, B); rect(g, 19, 18, 18, 5, M); rect(g, 19, 14, 17, 3, MD); ell(g, 6, 20, 1.5, 1.5, TO); line(g, 3, 21, 1, 30, K); return RG(11, 19, 3, 11, 22, 2, 11, 12); };
  X.x_electric_razor = X.x_shaver = g => { rrect(g, 12, 13, 16, 24, 6, B); rrect(g, 11, 4, 18, 10, 3, M); for (let x = 13; x < 28; x += 2) line(g, x, 5, x, 12, MD); rect(g, 18, 20, 4, 6, A); return RG(20, 28, 3, 20, 33, 2, 20, 1); };
  X.x_electric_toothbrush = g => { rrect(g, 15, 15, 10, 22, 4, B); rect(g, 18, 4, 4, 12, B); ell(g, 20, 4, 3, 3, W); for (let x = 18; x < 23; x++) line(g, x, 1, x, 3, S); ell(g, 20, 22, 2, 2, A); return RG(20, 27, 2, 20, 32, 2, 20, 1); };
  X.x_massage_gun = g => { rrect(g, 4, 9, 26, 12, 5, B); ell(g, 33, 15, 5, 5, K); rect(g, 13, 20, 8, 17, BD); rect(g, 13, 30, 8, 2, A); return RG(16, 14, 3, 16, 18, 2, 16, 4); };
  X.x_furnace = g => { rect(g, 6, 5, 28, 32, M); rect(g, 6, 5, 28, 3, MD); rect(g, 11, 21, 18, 11, K); for (let x = 13; x < 28; x += 3) { ell(g, x, 28, 1.2, 3, G); gset(g, x, 30, W); } for (let y = 10; y < 18; y += 2) line(g, 11, y, 29, y, MD); rect(g, 15, 0, 10, 5, MD); return RG(20, 12, 5, 20, 16, 3, 20, 2); };
  X.x_jukebox = g => { rrect(g, 6, 3, 28, 34, 12, B); ell(g, 20, 14, 10, 9, G); paintOn(g, (x, y) => ((x + y) % 3 === 0 ? GO : null), [G]); rect(g, 10, 22, 20, 7, S); for (let x = 12; x < 29; x += 3) rect(g, x, 23, 2, 5, W); rect(g, 10, 31, 20, 4, MD); return RG(20, 13, 4, 20, 25, 3, 20, 1); };
  X.x_slot_machine = g => { rrect(g, 7, 6, 24, 31, 3, B); rect(g, 10, 13, 18, 9, W); for (const [x, c] of [[12, TO], [18, GO], [24, TO]]) { ell(g, x + 1, 17, 2, 2, c); rect(g, x + 4, 13, 1, 9, PA); } line(g, 32, 24, 36, 10, M, 2); ell(g, 36, 9, 2, 2, TO); rect(g, 10, 7, 18, 4, GO); rect(g, 11, 28, 16, 4, K); return RG(20, 25, 4, 20, 31, 3, 20, 2); };
  X.x_water_filter_jug = g => { poly(g, [[10, 6], [28, 6], [27, 36], [11, 36]], SL); rect(g, 10, 4, 18, 4, B); rect(g, 13, 8, 12, 9, PA); rect(g, 11, 20, 16, 15, S); C.handleRing(g, 30, 20, 5, 9, B); return RG(19, 24, 3, 19, 30, 3, 19, 0); };
  /* --- other --- */
  X.x_gazebo = g => { poly(g, [[2, 15], [20, 3], [38, 15]], A); rect(g, 2, 15, 36, 3, AD); for (const x of [5, 15, 25, 34]) rect(g, x, 18, 2, 17, B); rect(g, 3, 25, 34, 2, B); rect(g, 1, 35, 38, 3, BD); return RG(20, 10, 4, 20, 13, 2, 20, 1); };
  /* X-END */
  return { C, T, D, X };
})();
