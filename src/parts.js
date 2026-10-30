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
      if (sh === 'pear') { ell(g, 20, 27, 10 * s, 8 * s, B); ell(g, 20, 16, 6 * s, 7 * s, B); cy = 24; ry = 10; }
      else if (sh === 'carrot') { poly(g, [[12, 12], [28, 12], [21, 37], [19, 37]], B); for (let y = 16; y < 32; y += 4) line(g, 15 + (y - 12) * 0.2, y, 18, y, BD); cy = 18; ry = 6; rx = 8; }
      else if (sh === 'curved') { ell(g, 20, 22, 14, 8, B); ell(g, 22, 15, 12, 6, E); cy = 25; ry = 5; }
      else if (sh === 'heart') { ell(g, 20, 17, 13, 9, B); poly(g, [[7, 18], [33, 18], [20, 36]], B); cy = 20; ry = 8; }
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
  return { C, T, D };
})();
