/* SNAPMON — procedural pixel-art monster sprites.
   A monster's look is fully described by its stored `dna` object, so captured monsters never change appearance.
   Rendering: shape builder draws into a 40x40 palette-index grid -> limbs/accessories -> auto shading -> outline. */
'use strict';

/* ---------- seeded randomness ---------- */
function hashStr(str) {
  let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}
function mulberry(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
}

/* ---------- palette indices ---------- */
const P = {
  EMPTY: 0, OUT: 1, BODY: 2, BODY_D: 3, BODY_L: 4, ACC: 5, ACC_D: 6, ACC_L: 7, WHITE: 8, PUPIL: 9, MOUTH: 10, TOOTH: 11,
  PATTERN: 12, GLOW: 13, METAL: 14, METAL_D: 15, SEC: 16, SEC_L: 17, STEAM: 18, PAPER: 19, TONGUE: 20, GOLD: 21, TOXIC: 22,
};
const SHADE = { [P.BODY]: [P.BODY_D, P.BODY_L], [P.ACC]: [P.ACC_D, P.ACC_L], [P.METAL]: [P.METAL_D, P.METAL], [P.SEC]: [P.SEC, P.SEC_L] };
const NO_OUTLINE = new Set([P.GLOW, P.STEAM]);
const GW = 40, GH = 40;

function makeGrid() { return { w: GW, h: GH, px: new Uint8Array(GW * GH) }; }
function gset(g, x, y, c) { x |= 0; y |= 0; if (x >= 1 && y >= 1 && x < g.w - 1 && y < g.h - 1) g.px[y * g.w + x] = c; }
function gget(g, x, y) { x |= 0; y |= 0; return (x < 0 || y < 0 || x >= g.w || y >= g.h) ? 0 : g.px[y * g.w + x]; }
function rect(g, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) gset(g, x + i, y + j, c); }
function ell(g, cx, cy, rx, ry, c, onlyOn) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (onlyOn == null || onlyOn.includes(gget(g, x, y)))) gset(g, x, y, c);
    }
}
function rrect(g, x, y, w, h, r, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cx = i < r ? r - i - 0.5 : i >= w - r ? i - (w - r) + 0.5 : 0;
    const cy = j < r ? r - j - 0.5 : j >= h - r ? j - (h - r) + 0.5 : 0;
    if (cx * cx + cy * cy <= r * r + 0.5) gset(g, x + i, y + j, c);
  }
}
function poly(g, pts, c) {
  const ys = pts.map(p => p[1]);
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) gset(g, x, y, c);
  }
}
function line(g, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    rect(g, x - (t > 1 ? 1 : 0), y - (t > 1 ? 1 : 0), t, t, c);
  }
}
function paintOn(g, fn, targets) { // apply fn(x,y)->color|null only on pixels currently in targets
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (targets.includes(g.px[y * g.w + x])) { const c = fn(x, y); if (c != null) g.px[y * g.w + x] = c; }
  }
}

/* ---------- object shapes: return anchors for face/limbs/accessories ---------- */
// eyes: {x,y,span}  mouth:{x,y,w}  arms:[{x,y,d}] legs:{y,xs} top:{x,y}  flags: noLegs, float
const SHAPES = {
  blob(g, R) {
    const rx = R.int(10, 13), ry = R.int(9, 12);
    ell(g, 20, 34 - ry, rx, ry, P.BODY);
    return { eyes: { x: 20, y: 30 - ry, span: 4 }, mouth: { x: 20, y: 34 - ry + 3, w: 8 }, arms: [{ x: 20 - rx, y: 33 - ry, d: -1 }, { x: 20 + rx, y: 33 - ry, d: 1 }], legs: { y: 33, xs: [15, 25] }, top: { x: 20, y: 34 - 2 * ry } };
  },
  tall(g, R) {
    const w = R.int(14, 18);
    rrect(g, 20 - w / 2, 7, w, 27, 5, P.BODY);
    return { eyes: { x: 20, y: 14, span: 4 }, mouth: { x: 20, y: 21, w: 7 }, arms: [{ x: 20 - w / 2, y: 20, d: -1 }, { x: 20 + w / 2, y: 20, d: 1 }], legs: { y: 33, xs: [16, 24] }, top: { x: 20, y: 7 } };
  },
  toilet(g) {
    rrect(g, 11, 4, 18, 11, 2, P.BODY);           // tank
    rect(g, 26, 7, 4, 2, P.METAL);                // flush lever
    rect(g, 14, 15, 12, 4, P.BODY);
    ell(g, 20, 21, 12, 5, P.BODY);                // bowl rim
    ell(g, 20, 21, 9, 3, P.SEC);                  // water
    poly(g, [[11, 23], [29, 23], [25, 34], [15, 34]], P.BODY);
    rect(g, 13, 33, 14, 2, P.BODY);
    return { eyes: { x: 20, y: 9, span: 5 }, mouth: { x: 20, y: 21, w: 12, inBowl: true }, arms: [{ x: 11, y: 24, d: -1 }, { x: 29, y: 24, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 4 } };
  },
  mug(g, R) {
    ell(g, 30, 21, 6, 7, P.BODY); ell(g, 30, 21, 3, 4, P.EMPTY);
    rrect(g, 9, 11, 20, 22, 3, P.BODY);
    ell(g, 19, 12, 9, 2, P.SEC);
    for (let i = 0; i < 3; i++) { const x = 13 + i * 6 + R.int(-1, 1); for (let s = 0; s < 4; s++) gset(g, x + (s % 2), 8 - s, P.STEAM); }
    return { eyes: { x: 19, y: 18, span: 5 }, mouth: { x: 19, y: 25, w: 9 }, arms: [{ x: 9, y: 22, d: -1 }], legs: { y: 33, xs: [14, 24] }, top: { x: 19, y: 10 } };
  },
  shoe(g) {
    rect(g, 5, 30, 30, 4, P.METAL);
    ell(g, 13, 27, 9, 6, P.BODY);
    rrect(g, 13, 16, 18, 15, 4, P.BODY);
    ell(g, 26, 16, 6, 2, P.MOUTH);
    for (let i = 0; i < 4; i++) line(g, 15 + i * 3, 19 + i, 18 + i * 3, 18 + i, P.ACC);
    return { eyes: { x: 10, y: 25, span: 3 }, mouth: { x: 10, y: 29, w: 7 }, arms: [{ x: 31, y: 22, d: 1 }], legs: null, noLegs: true, top: { x: 24, y: 15 } };
  },
  plant(g, R) {
    for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.1 + 0.8 * i / 5); ell(g, 20 + Math.cos(a) * 9, 15 + Math.sin(a) * 7, 4, 6, P.BODY); }
    ell(g, 20, 16, 10, 8, P.BODY);
    rect(g, 12, 24, 16, 3, P.ACC);
    poly(g, [[13, 27], [27, 27], [25, 36], [15, 36]], P.ACC);
    return { eyes: { x: 20, y: 15, span: 4 }, mouth: { x: 20, y: 20, w: 7 }, arms: [{ x: 12, y: 28, d: -1 }, { x: 28, y: 28, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 5 } };
  },
  laptop(g) {
    rrect(g, 9, 6, 22, 22, 2, P.METAL);
    rect(g, 11, 8, 18, 17, P.SEC);
    poly(g, [[7, 28], [33, 28], [36, 34], [4, 34]], P.METAL);
    for (let x = 9; x < 31; x += 3) { gset(g, x, 30, P.METAL_D); gset(g, x + 1, 32, P.METAL_D); }
    return { eyes: { x: 20, y: 13, span: 4 }, mouth: { x: 20, y: 20, w: 8 }, arms: [{ x: 6, y: 30, d: -1 }, { x: 34, y: 30, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 6 }, screen: true };
  },
  banana(g) {
    ell(g, 20, 18, 16, 14, P.BODY); ell(g, 20, 10, 15, 13, P.EMPTY);
    rect(g, 34, 15, 2, 4, P.ACC_D); rect(g, 4, 16, 2, 3, P.ACC_D);
    return { eyes: { x: 20, y: 25, span: 4 }, mouth: { x: 20, y: 28, w: 6 }, arms: [{ x: 8, y: 22, d: -1 }, { x: 32, y: 22, d: 1 }], legs: { y: 31, xs: [16, 24] }, top: { x: 20, y: 22 } };
  },
  sofa(g) {
    rrect(g, 6, 9, 28, 14, 3, P.BODY);
    rect(g, 7, 21, 26, 9, P.BODY);
    rrect(g, 2, 15, 7, 16, 3, P.ACC); rrect(g, 31, 15, 7, 16, 3, P.ACC);
    line(g, 20, 10, 20, 21, P.BODY_D);
    rect(g, 5, 31, 3, 3, P.METAL_D); rect(g, 32, 31, 3, 3, P.METAL_D);
    return { eyes: { x: 20, y: 15, span: 6 }, mouth: { x: 20, y: 24, w: 16 }, arms: [{ x: 3, y: 18, d: -1 }, { x: 37, y: 18, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 9 } };
  },
  phone(g) {
    rrect(g, 12, 3, 16, 31, 3, P.BODY);
    rect(g, 14, 7, 12, 22, P.SEC);
    rect(g, 18, 4, 4, 1, P.METAL); ell(g, 20, 31, 1.5, 1.5, P.METAL);
    return { eyes: { x: 20, y: 13, span: 3 }, mouth: { x: 20, y: 21, w: 6 }, arms: [{ x: 12, y: 18, d: -1 }, { x: 28, y: 18, d: 1 }], legs: { y: 34, xs: [16, 24] }, top: { x: 20, y: 3 }, screen: true };
  },
  bottle(g) {
    rect(g, 16, 2, 8, 3, P.ACC);
    rect(g, 17, 5, 6, 5, P.BODY);
    ell(g, 20, 13, 8, 5, P.BODY);
    rrect(g, 11, 12, 18, 23, 4, P.BODY);
    rect(g, 12, 26, 16, 7, P.SEC);
    rect(g, 11, 17, 18, 8, P.ACC);
    return { eyes: { x: 20, y: 20, span: 4 }, mouth: { x: 20, y: 29, w: 7 }, arms: [{ x: 11, y: 22, d: -1 }, { x: 29, y: 22, d: 1 }], legs: { y: 34, xs: [16, 24] }, top: { x: 20, y: 2 } };
  },
  book(g) {
    rrect(g, 10, 5, 21, 29, 1, P.BODY);
    rect(g, 28, 7, 3, 25, P.PAPER);
    rect(g, 9, 5, 3, 29, P.BODY_D);
    rect(g, 15, 9, 10, 2, P.GOLD); rect(g, 15, 29, 10, 2, P.GOLD);
    rect(g, 30, 17, 3, 5, P.GOLD);
    return { eyes: { x: 20, y: 15, span: 4 }, mouth: { x: 20, y: 23, w: 9 }, arms: [{ x: 9, y: 19, d: -1 }, { x: 32, y: 19, d: 1 }], legs: { y: 34, xs: [15, 25] }, top: { x: 20, y: 5 } };
  },
  lamp(g) {
    rect(g, 18, 19, 4, 13, P.METAL);
    ell(g, 20, 33, 9, 2.5, P.METAL);
    ell(g, 20, 19, 5, 2, P.GLOW);
    poly(g, [[12, 4], [28, 4], [33, 19], [7, 19]], P.BODY);
    return { eyes: { x: 20, y: 10, span: 5 }, mouth: { x: 20, y: 15, w: 8 }, arms: [{ x: 18, y: 25, d: -1 }, { x: 22, y: 25, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 4 } };
  },
  chair(g) {
    rrect(g, 11, 3, 18, 15, 2, P.BODY);
    rect(g, 9, 18, 22, 4, P.BODY);
    rect(g, 10, 22, 2, 13, P.BODY_D); rect(g, 28, 22, 2, 13, P.BODY_D);
    rect(g, 14, 22, 2, 10, P.BODY_D); rect(g, 24, 22, 2, 10, P.BODY_D);
    return { eyes: { x: 20, y: 8, span: 4 }, mouth: { x: 20, y: 13, w: 8 }, arms: [{ x: 11, y: 10, d: -1 }, { x: 29, y: 10, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 3 } };
  },
  car(g) {
    poly(g, [[11, 19], [15, 9], [27, 9], [32, 19]], P.BODY);
    rrect(g, 3, 18, 34, 10, 3, P.BODY);
    poly(g, [[14, 18], [17, 11], [25, 11], [29, 18]], P.SEC);
    line(g, 21, 11, 21, 18, P.BODY);
    ell(g, 10, 29, 4, 4, P.METAL_D); ell(g, 30, 29, 4, 4, P.METAL_D);
    ell(g, 10, 29, 1.5, 1.5, P.METAL); ell(g, 30, 29, 1.5, 1.5, P.METAL);
    rect(g, 3, 21, 3, 2, P.GLOW); rect(g, 34, 21, 3, 2, P.GLOW);
    return { eyes: { x: 21, y: 15, span: 4 }, mouth: { x: 20, y: 23, w: 12 }, arms: [{ x: 4, y: 22, d: -1 }, { x: 36, y: 22, d: 1 }], legs: null, noLegs: true, top: { x: 21, y: 9 } };
  },
  beast(g, R) {
    ell(g, 31, 21, 3, 7, P.BODY);
    ell(g, 20, 25, 11, 8, P.BODY);
    ell(g, 20, 14, 9, 7, P.BODY);
    poly(g, [[12, 11], [13, 3], [18, 9]], P.BODY); poly(g, [[22, 9], [27, 3], [28, 11]], P.BODY);
    poly(g, [[14, 9], [14, 5], [16, 8]], P.ACC); poly(g, [[24, 8], [26, 5], [26, 9]], P.ACC);
    ell(g, 20, 17, 4, 2.5, P.ACC_L);
    return { eyes: { x: 20, y: 13, span: 4 }, mouth: { x: 20, y: 18, w: 6 }, arms: [{ x: 10, y: 24, d: -1 }, { x: 30, y: 24, d: 1 }], legs: { y: 32, xs: [13, 18, 22, 27] }, top: { x: 20, y: 7 } };
  },
  tree(g, R) {
    rect(g, 15, 18, 10, 17, P.ACC);
    for (let i = 0; i < 4; i++) line(g, 16 + i * 2, 20 + (i % 2) * 3, 16 + i * 2, 24 + (i % 2) * 5, P.ACC_D);
    for (let i = 0; i < 7; i++) ell(g, 20 + R.int(-10, 10), 10 + R.int(-5, 4), R.int(5, 7), R.int(4, 6), P.BODY);
    ell(g, 20, 11, 11, 7, P.BODY);
    return { eyes: { x: 20, y: 24, span: 3 }, mouth: { x: 20, y: 29, w: 7 }, arms: [{ x: 15, y: 21, d: -1 }, { x: 25, y: 21, d: 1 }], legs: { y: 35, xs: [14, 26], roots: true }, top: { x: 20, y: 3 } };
  },
  burger(g) {
    ell(g, 20, 14, 14, 9, P.ACC); rect(g, 5, 15, 31, 9, P.EMPTY);
    for (let x = 6; x < 35; x++) rect(g, x, 15, 1, 2 + (x % 3 === 0 ? 1 : 0), P.SEC);
    rect(g, 6, 17, 28, 6, P.BODY);
    for (let x = 8; x < 33; x += 6) poly(g, [[x, 22], [x + 4, 22], [x + 2, 25]], P.GOLD);
    rrect(g, 7, 23, 26, 8, 3, P.ACC);
    for (let i = 0; i < 6; i++) gset(g, 11 + i * 3, 8 + (i % 2), P.PAPER);
    return { eyes: { x: 20, y: 10, span: 5 }, mouth: { x: 20, y: 19, w: 14 }, arms: [{ x: 6, y: 20, d: -1 }, { x: 34, y: 20, d: 1 }], legs: { y: 31, xs: [14, 26] }, top: { x: 20, y: 5 } };
  },
  fruit(g) {
    ell(g, 20, 22, 12, 12, P.BODY);
    rect(g, 19, 7, 2, 5, P.METAL_D);
    ell(g, 24, 8, 4, 2, P.SEC);
    return { eyes: { x: 20, y: 20, span: 4 }, mouth: { x: 20, y: 26, w: 7 }, arms: [{ x: 8, y: 23, d: -1 }, { x: 32, y: 23, d: 1 }], legs: { y: 33, xs: [16, 24] }, top: { x: 20, y: 10 } };
  },
  cloth(g) {
    poly(g, [[13, 8], [27, 8], [35, 15], [31, 19], [28, 16], [28, 30], [12, 30], [12, 16], [9, 19], [5, 15]], P.BODY);
    for (let x = 12; x < 28; x++) rect(g, x, 30, 1, 2 + ((x >> 1) % 2) * 2, P.BODY);
    ell(g, 20, 8, 4, 2, P.BODY_D);
    rect(g, 12, 22, 16, 2, P.ACC);
    return { eyes: { x: 20, y: 15, span: 4 }, mouth: { x: 20, y: 19, w: 6 }, arms: [], legs: null, noLegs: true, float: true, top: { x: 20, y: 7 } };
  },
  tool(g) {
    line(g, 25, 14, 33, 4, P.METAL, 3); ell(g, 34, 3, 3, 3, P.METAL); rect(g, 34, 2, 2, 2, P.EMPTY);
    rect(g, 13, 10, 14, 3, P.METAL_D); rect(g, 13, 10, 2, 7, P.METAL_D); rect(g, 25, 10, 2, 7, P.METAL_D);
    rrect(g, 5, 16, 30, 17, 2, P.BODY);
    rect(g, 5, 16, 30, 4, P.BODY_D);
    rect(g, 11, 20, 3, 3, P.METAL); rect(g, 26, 20, 3, 3, P.METAL);
    return { eyes: { x: 20, y: 23, span: 5 }, mouth: { x: 20, y: 28, w: 12 }, arms: [{ x: 5, y: 24, d: -1 }, { x: 35, y: 24, d: 1 }], legs: { y: 33, xs: [11, 29] }, top: { x: 20, y: 10 } };
  },
  toy(g) {
    ell(g, 12, 6, 3.5, 3.5, P.BODY); ell(g, 28, 6, 3.5, 3.5, P.BODY);
    ell(g, 12, 6, 1.5, 1.5, P.ACC); ell(g, 28, 6, 1.5, 1.5, P.ACC);
    ell(g, 20, 26, 10, 8, P.BODY);
    ell(g, 20, 12, 10, 8, P.BODY);
    ell(g, 20, 27, 5, 5, P.ACC_L);
    ell(g, 20, 15, 4, 3, P.ACC_L);
    line(g, 20, 21, 20, 32, P.BODY_D);
    return { eyes: { x: 20, y: 11, span: 4, forceStyle: 'button' }, mouth: { x: 20, y: 16, w: 5 }, arms: [{ x: 10, y: 24, d: -1 }, { x: 30, y: 24, d: 1 }], legs: { y: 33, xs: [15, 25] }, top: { x: 20, y: 4 } };
  },
  bin(g) {
    poly(g, [[9, 11], [31, 11], [29, 35], [11, 35]], P.BODY);
    for (let x = 13; x < 29; x += 4) line(g, x, 14, x + (x < 20 ? 0 : 0), 33, P.BODY_D);
    poly(g, [[6, 8], [32, 4], [33, 7], [7, 11]], P.BODY_L);
    rect(g, 17, 3, 6, 2, P.METAL);
    gset(g, 12, 10, P.SEC); gset(g, 13, 9, P.SEC); gset(g, 26, 9, P.PAPER); gset(g, 27, 8, P.PAPER);
    return { eyes: { x: 20, y: 17, span: 4 }, mouth: { x: 20, y: 25, w: 9 }, arms: [{ x: 10, y: 20, d: -1 }, { x: 30, y: 20, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 4 } };
  },
  mirror(g) {
    rect(g, 18, 31, 4, 3, P.ACC); ell(g, 20, 35, 7, 1.5, P.ACC);
    ell(g, 20, 17, 12, 15, P.ACC);
    ell(g, 20, 17, 9, 12, P.SEC);
    line(g, 14, 10, 17, 7, P.SEC_L); line(g, 14, 13, 19, 8, P.SEC_L);
    return { eyes: { x: 20, y: 15, span: 4 }, mouth: { x: 20, y: 22, w: 7 }, arms: [{ x: 8, y: 18, d: -1 }, { x: 32, y: 18, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 2 } };
  },
  fridge(g) {
    rrect(g, 9, 2, 22, 33, 2, P.BODY);
    line(g, 10, 13, 30, 13, P.BODY_D);
    rect(g, 26, 6, 2, 5, P.METAL); rect(g, 26, 16, 2, 8, P.METAL);
    for (let x = 11; x < 29; x += 3) gset(g, x, 3, P.WHITE);
    rect(g, 11, 34, 3, 2, P.METAL_D); rect(g, 26, 34, 3, 2, P.METAL_D);
    return { eyes: { x: 18, y: 19, span: 4 }, mouth: { x: 18, y: 27, w: 9 }, arms: [{ x: 9, y: 20, d: -1 }, { x: 31, y: 20, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 2 } };
  },
  candle(g) {
    ell(g, 20, 34, 10, 2.5, P.METAL);
    rect(g, 14, 13, 12, 21, P.BODY);
    rect(g, 14, 16, 2, 5, P.BODY_L); rect(g, 24, 15, 2, 8, P.BODY_L);
    line(g, 20, 13, 20, 10, P.METAL_D);
    ell(g, 20, 7, 3, 5, P.GLOW); ell(g, 20, 8, 1.5, 2.5, P.WHITE);
    return { eyes: { x: 20, y: 19, span: 3 }, mouth: { x: 20, y: 25, w: 6 }, arms: [{ x: 14, y: 22, d: -1 }, { x: 26, y: 22, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 2 } };
  },
  clock(g) {
    ell(g, 11, 7, 4, 3, P.METAL); ell(g, 29, 7, 4, 3, P.METAL); rect(g, 18, 4, 4, 3, P.METAL_D);
    ell(g, 20, 20, 13, 13, P.ACC);
    ell(g, 20, 20, 10, 10, P.PAPER);
    for (let a = 0; a < 12; a++) gset(g, 20 + Math.cos(a / 6 * Math.PI) * 9, 20 + Math.sin(a / 6 * Math.PI) * 9, P.METAL_D);
    return { eyes: { x: 20, y: 18, span: 4 }, mouth: { x: 20, y: 25, w: 7 }, arms: [{ x: 7, y: 21, d: -1 }, { x: 33, y: 21, d: 1 }], legs: { y: 33, xs: [14, 26] }, top: { x: 20, y: 6 } };
  },
  key(g) {
    rect(g, 24, 17, 13, 5, P.BODY);
    rect(g, 33, 22, 2, 5, P.BODY); rect(g, 29, 22, 2, 4, P.BODY);
    ell(g, 14, 19, 11, 11, P.BODY);
    ell(g, 14, 11, 2, 2, P.EMPTY);
    return { eyes: { x: 14, y: 18, span: 4 }, mouth: { x: 14, y: 24, w: 7 }, arms: [{ x: 4, y: 20, d: -1 }], legs: null, noLegs: true, float: true, top: { x: 14, y: 8 } };
  },
  bag(g) {
    line(g, 14, 9, 14, 5, P.ACC_D, 2); line(g, 26, 9, 26, 5, P.ACC_D, 2); rect(g, 14, 4, 13, 2, P.ACC_D);
    rrect(g, 9, 8, 22, 26, 6, P.BODY);
    rrect(g, 12, 20, 16, 11, 3, P.ACC);
    rect(g, 7, 14, 3, 15, P.BODY_D);
    return { eyes: { x: 20, y: 14, span: 4 }, mouth: { x: 20, y: 22, w: 12 }, arms: [{ x: 8, y: 18, d: -1 }, { x: 31, y: 18, d: 1 }], legs: { y: 34, xs: [14, 26] }, top: { x: 20, y: 5 } };
  },
  pillow(g) {
    rrect(g, 4, 12, 32, 18, 7, P.BODY);
    poly(g, [[4, 12], [8, 12], [5, 15]], P.BODY); poly(g, [[36, 12], [32, 12], [35, 15]], P.BODY);
    poly(g, [[4, 30], [8, 30], [5, 27]], P.BODY); poly(g, [[36, 30], [32, 30], [35, 27]], P.BODY);
    for (let x = 8; x < 33; x += 2) gset(g, x, 14, P.BODY_D);
    return { eyes: { x: 20, y: 18, span: 6, forceStyle: 'sleepy' }, mouth: { x: 20, y: 24, w: 8 }, arms: [{ x: 4, y: 21, d: -1 }, { x: 36, y: 21, d: 1 }], legs: { y: 30, xs: [12, 28] }, top: { x: 20, y: 12 } };
  },
  faucet(g) {
    ell(g, 14, 8, 3.5, 2, P.ACC); ell(g, 26, 8, 3.5, 2, P.ACC);
    rect(g, 18, 8, 4, 4, P.BODY);
    rrect(g, 6, 11, 24, 6, 2, P.BODY);
    rect(g, 6, 11, 5, 11, P.BODY);
    ell(g, 8, 25, 1.5, 2, P.SEC); ell(g, 8, 30, 1, 1.5, P.SEC);
    rrect(g, 14, 16, 14, 18, 2, P.BODY);
    ell(g, 21, 34, 10, 2, P.METAL);
    return { eyes: { x: 21, y: 22, span: 3 }, mouth: { x: 21, y: 28, w: 7 }, arms: [{ x: 28, y: 24, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 7 } };
  },
  tv(g) {
    line(g, 18, 8, 11, 1, P.METAL_D); line(g, 22, 8, 30, 1, P.METAL_D);
    ell(g, 11, 2, 1.5, 1.5, P.ACC); ell(g, 30, 2, 1.5, 1.5, P.ACC);
    rrect(g, 4, 8, 32, 23, 3, P.BODY);
    rrect(g, 7, 11, 21, 17, 3, P.SEC);
    ell(g, 32, 15, 1.5, 1.5, P.METAL); ell(g, 32, 20, 1.5, 1.5, P.METAL);
    rect(g, 8, 31, 3, 3, P.METAL_D); rect(g, 29, 31, 3, 3, P.METAL_D);
    return { eyes: { x: 17, y: 17, span: 4 }, mouth: { x: 17, y: 23, w: 8 }, arms: [{ x: 4, y: 19, d: -1 }, { x: 36, y: 19, d: 1 }], legs: null, noLegs: true, top: { x: 20, y: 8 }, screen: true };
  },
};
const GENERIC_SHAPES = ['blob', 'tall'];

/* ---------- features ---------- */
function drawEyes(g, a, style, count, R, glow) {
  const { x, y, span } = a;
  const W = glow ? P.GLOW : P.WHITE;
  const pos = count === 1 ? [[x, y]] : count === 3 ? [[x - span, y], [x + span, y], [x, y - 3]] : [[x - span, y], [x + span, y]];
  if (style === 'cyclops') { ell(g, x, y, 4, 4, W); rect(g, x - 2, y - 1, 3, 3, P.PUPIL); gset(g, x - 2, y - 2, P.WHITE); return; }
  if (style === 'many') {
    const n = 4 + R.int(0, 2);
    for (let i = 0; i < n; i++) { const ex = x + R.int(-span - 3, span + 3), ey = y + R.int(-3, 2); rect(g, ex, ey, 2, 2, W); gset(g, ex, ey + 1, P.PUPIL); }
    return;
  }
  for (const [ex, ey] of pos) {
    switch (style) {
      case 'dot': rect(g, ex - 1, ey - 1, 2, 2, glow ? P.GLOW : P.PUPIL); break;
      case 'button': ell(g, ex, ey, 2, 2, P.PUPIL); gset(g, ex - 1, ey - 1, P.WHITE); break;
      case 'sleepy': rect(g, ex - 2, ey, 4, 2, W); rect(g, ex - 1, ey + 1, 2, 1, P.PUPIL); line(g, ex - 2, ey - 1, ex + 1, ey - 1, P.OUT); break;
      case 'angry':
        ell(g, ex, ey, 2.2, 2.2, W); rect(g, ex - 1, ey, 2, 2, P.PUPIL);
        if (ex < x) line(g, ex - 2, ey - 3, ex + 2, ey - 1, P.OUT); else line(g, ex - 2, ey - 1, ex + 2, ey - 3, P.OUT);
        break;
      case 'googly': { ell(g, ex, ey, 3, 3, W); const ox = R.int(-1, 1), oy = R.int(-1, 1); rect(g, ex - 1 + ox, ey - 1 + oy, 2, 2, P.PUPIL); break; }
      case 'slit': ell(g, ex, ey, 2.2, 2.5, glow ? P.GLOW : P.GOLD); rect(g, ex, ey - 2, 1, 4, P.PUPIL); break;
      default: ell(g, ex, ey, 2.2, 2.2, W); rect(g, ex - 2, ey, 2, 2, P.PUPIL); gset(g, ex, ey - 1, P.WHITE);
    }
  }
}
function drawMouth(g, m, style) {
  const { x, y } = m; const w = Math.max(4, m.w | 0); const x0 = Math.round(x - w / 2);
  switch (style) {
    case 'o': ell(g, x, y + 1, 1.6, 2, P.MOUTH); break;
    case 'smile': for (let i = 0; i < w; i++) { const t = (i / (w - 1)) * 2 - 1; gset(g, x0 + i, y + Math.round((1 - t * t) * 2), P.MOUTH); } break;
    case 'zigzag': for (let i = 0; i < w; i++) gset(g, x0 + i, y + (i % 2), P.MOUTH); break;
    case 'fangs': line(g, x0, y, x0 + w - 1, y, P.MOUTH); gset(g, x0 + 1, y + 1, P.TOOTH); gset(g, x0 + 1, y + 2, P.TOOTH); gset(g, x0 + w - 2, y + 1, P.TOOTH); gset(g, x0 + w - 2, y + 2, P.TOOTH); break;
    case 'tongue': rect(g, x0 + 1, y, w - 2, 3, P.MOUTH); rect(g, x0 + Math.floor(w / 2) - 1, y + 2, 3, 3, P.TONGUE); break;
    case 'chomp':
      rect(g, x0, y, w, 4, P.MOUTH);
      for (let i = 0; i < w; i += 2) { gset(g, x0 + i, y, P.TOOTH); gset(g, x0 + i + 1, y + 3, P.TOOTH); }
      break;
    default: // grin
      rect(g, x0, y, w, 3, P.MOUTH);
      for (let i = 0; i < w; i += 2) gset(g, x0 + i, y, P.TOOTH);
  }
}
function drawArm(g, a, style, R, c = P.BODY) {
  const d = a.d, x = a.x, y = a.y;
  switch (style) {
    case 'noodle': line(g, x, y, x + d * 5, y - 4, c, 2); ell(g, x + d * 6, y - 5, 1.8, 1.8, c); break;
    case 'claw': line(g, x, y, x + d * 4, y + 1, c, 2); gset(g, x + d * 6, y - 1, P.TOOTH); gset(g, x + d * 6, y + 2, P.TOOTH); gset(g, x + d * 7, y, P.TOOTH); break;
    case 'tentacle': for (let i = 0; i < 9; i++) rect(g, x + d * i, y + Math.round(Math.sin(i * 0.9) * 2), 2, 2, c); break;
    case 'none': break;
    default: ell(g, x + d * 2, y + 1, 2.5, 2, c);
  }
}
function drawLegs(g, L, style, c = P.BODY) {
  if (!L) return;
  for (const lx of L.xs) {
    switch (style) {
      case 'tall': rect(g, lx - 1, L.y - 1, 2, 5, c); rect(g, lx - 2, L.y + 3, 4, 2, c); break;
      case 'spider': line(g, lx, L.y - 1, lx + (lx < 20 ? -3 : 3), L.y + 1, c); line(g, lx + (lx < 20 ? -3 : 3), L.y + 1, lx + (lx < 20 ? -4 : 4), L.y + 4, c); break;
      case 'tentacles': for (let i = 0; i < 5; i++) gset(g, lx + Math.round(Math.sin(i * 1.2)), L.y + i, c); break;
      case 'roots': line(g, lx, L.y - 2, lx + (lx < 20 ? -4 : 4), L.y + 1, P.ACC, 2); break;
      default: rect(g, lx - 2, L.y - 1, 4, 3, c);
    }
  }
}
function drawTop(g, t, style, R) {
  const { x, y } = t;
  switch (style) {
    case 'antennae': line(g, x - 3, y, x - 5, y - 5, P.OUT); line(g, x + 3, y, x + 5, y - 5, P.OUT); ell(g, x - 5, y - 6, 1.5, 1.5, P.ACC); ell(g, x + 5, y - 6, 1.5, 1.5, P.ACC); break;
    case 'horns': poly(g, [[x - 7, y + 2], [x - 3, y + 2], [x - 7, y - 5]], P.PAPER); poly(g, [[x + 3, y + 2], [x + 7, y + 2], [x + 7, y - 5]], P.PAPER); break;
    case 'tuft': for (let i = -2; i <= 2; i++) line(g, x + i, y + 1, x + i * 2, y - 3 - (i === 0 ? 2 : 0), P.ACC); break;
    case 'crown':
      rect(g, x - 5, y - 3, 11, 3, P.GOLD);
      for (let i = 0; i < 3; i++) poly(g, [[x - 5 + i * 4, y - 3], [x - 2 + i * 4, y - 3], [x - 3.5 + i * 4 + 0.5, y - 7]], P.GOLD);
      gset(g, x, y - 2, P.TONGUE); break;
    case 'halo': ell(g, x, y - 5, 6, 2, P.GLOW); ell(g, x, y - 5, 4, 1, P.EMPTY); break;
    case 'mohawk': for (let i = -4; i <= 4; i += 2) poly(g, [[x + i - 1, y + 1], [x + i + 1, y + 1], [x + i, y - 4]], P.ACC); break;
  }
}
function addSpikes(g) {
  for (let x = 3; x < GW - 3; x += 4) {
    let y = 0; while (y < GH && ![P.BODY, P.ACC].includes(gget(g, x, y))) y++;
    if (y > 3 && y < GH - 4) { gset(g, x, y - 1, P.ACC); gset(g, x, y - 2, P.ACC); gset(g, x + 1, y - 1, P.ACC); }
  }
}
function drawWings(g, cx, cy) {
  poly(g, [[cx - 4, cy], [cx - 18, cy - 10], [cx - 16, cy + 1], [cx - 19, cy + 6], [cx - 8, cy + 6]], P.ACC_D);
  poly(g, [[cx + 4, cy], [cx + 18, cy - 10], [cx + 16, cy + 1], [cx + 19, cy + 6], [cx + 8, cy + 6]], P.ACC_D);
}
function addPattern(g, pattern, R) {
  if (pattern === 'spots') {
    const pts = []; for (let i = 0; i < 9; i++) pts.push([R.int(4, 35), R.int(4, 35), R.chance(0.5) ? 1.6 : 1]);
    for (const [px, py, r] of pts) ell(g, px, py, r, r, P.PATTERN, [P.BODY]);
  } else if (pattern === 'stripes') {
    paintOn(g, (x, y) => (y % 5 === 0 || y % 5 === 1) ? P.PATTERN : null, [P.BODY]);
  } else if (pattern === 'belly') {
    let minY = GH, maxY = 0; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (g.px[y * GW + x] === P.BODY) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    ell(g, 20, maxY - (maxY - minY) * 0.25, 7, (maxY - minY) * 0.28, P.ACC_L, [P.BODY]);
  } else if (pattern === 'checker') {
    paintOn(g, (x, y) => (((x >> 1) + (y >> 1)) % 2 === 0) ? P.PATTERN : null, [P.BODY]);
  }
}
function addDrips(g, R) {
  for (let i = 0; i < 6; i++) {
    const x = R.int(6, 33); let y = GH - 1;
    while (y > 0 && ![P.BODY, P.ACC].includes(gget(g, x, y))) y--;
    if (y > 5) { const len = R.int(1, 3); for (let k = 1; k <= len; k++) gset(g, x, y + k, P.TOXIC); }
  }
}
function addGhostTail(g) {
  let maxY = 0, minX = GW, maxX = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (g.px[y * GW + x]) { maxY = Math.max(maxY, y); }
  for (let x = 0; x < GW; x++) if (g.px[(maxY - 1) * GW + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  for (let x = minX; x <= maxX; x++) { const len = 1 + ((x >> 1) % 2) * 2; for (let k = 0; k < len; k++) gset(g, x, maxY + k, P.BODY); }
}

/* ---------- shading & outline ---------- */
function shadeAndOutline(g) {
  const src = g.px.slice();
  const at = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? 0 : src[y * GW + x];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const c = src[y * GW + x]; const s = SHADE[c]; if (!s) continue;
    const up = at(x, y - 1), dn = at(x, y + 1), dn2 = at(x, y + 2), rt = at(x + 1, y), lt = at(x - 1, y);
    if (up !== c && up !== s[1] && (up === 0 || !SHADE[up])) g.px[y * GW + x] = s[1];
    else if (dn === 0 || rt === 0 || (dn2 === 0 && (x + y) % 2 === 0)) g.px[y * GW + x] = s[0];
    else if (lt === 0 && c !== P.METAL) g.px[y * GW + x] = s[1];
  }
  const s2 = g.px.slice();
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (s2[y * GW + x] !== 0) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = (x + dx < 0 || y + dy < 0 || x + dx >= GW || y + dy >= GH) ? 0 : s2[(y + dy) * GW + x + dx]; return v && !NO_OUTLINE.has(v) && v !== P.OUT; });
    if (n) g.px[y * GW + x] = P.OUT;
  }
}

/* ---------- colours ---------- */
function hsl(h, s, l, a = 1) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const k = n => (n + h / 30) % 12, f = n => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const r = Math.round(f(0) * 255), gg = Math.round(f(8) * 255), b = Math.round(f(4) * 255);
  return a < 1 ? `rgba(${r},${gg},${b},${a})` : `rgb(${r},${gg},${b})`;
}
const SEC_COLOR = {
  toilet: [195, 75, 62], mug: [25, 55, 26], laptop: [195, 85, 58], phone: [205, 85, 55], bottle: [195, 75, 58], burger: [100, 65, 45],
  fruit: [110, 60, 40], mirror: [195, 45, 80], tv: [170, 55, 52], car: [195, 55, 78], faucet: [200, 85, 62], bin: [52, 85, 55],
};
function buildPalette(dna) {
  const { h, s, l, ah, as, al } = dna.col;
  let pal = {
    [P.OUT]: hsl(h, 45, 11), [P.BODY]: hsl(h, s, l), [P.BODY_D]: hsl(h + 8, s + 6, l - 16), [P.BODY_L]: hsl(h - 6, s - 4, l + 14),
    [P.ACC]: hsl(ah, as, al), [P.ACC_D]: hsl(ah + 8, as + 5, al - 16), [P.ACC_L]: hsl(ah, as - 10, Math.min(92, al + 22)),
    [P.WHITE]: '#f7f3e8', [P.PUPIL]: '#141019', [P.MOUTH]: '#3b0d1f', [P.TOOTH]: '#fffbef', [P.PATTERN]: hsl(h + 30, s + 10, l - 10),
    [P.GLOW]: dna.glow || '#fff27a', [P.METAL]: hsl(h, 8, 72), [P.METAL_D]: hsl(h, 10, 40), [P.STEAM]: 'rgba(255,255,255,0.45)',
    [P.PAPER]: '#efe4c6', [P.TONGUE]: '#ff6f9a', [P.GOLD]: '#ffc93a', [P.TOXIC]: '#b6ff3b',
  };
  const sc = dna.sec || [h + 180, 60, 55];
  pal[P.SEC] = hsl(sc[0], sc[1], sc[2]); pal[P.SEC_L] = hsl(sc[0], sc[1] - 10, Math.min(94, sc[2] + 20));
  if (dna.variant === 'spectral') {
    for (const k of [P.BODY, P.BODY_D, P.BODY_L, P.ACC, P.ACC_D, P.ACC_L, P.METAL, P.METAL_D, P.SEC, P.SEC_L, P.PATTERN]) {
      const base = { [P.BODY]: 82, [P.BODY_D]: 66, [P.BODY_L]: 92, [P.ACC]: 70, [P.ACC_D]: 56, [P.ACC_L]: 88, [P.METAL]: 80, [P.METAL_D]: 60, [P.SEC]: 74, [P.SEC_L]: 90, [P.PATTERN]: 72 }[k];
      pal[k] = hsl(k === P.ACC || k === P.ACC_D || k === P.ACC_L ? 275 : 190, 60, base, 0.82);
    }
    pal[P.OUT] = hsl(250, 50, 25, 0.9);
  }
  return pal;
}

/* ---------- DNA ---------- */
// Species traits come from hash(cat+rarity) so a species keeps its silhouette; individual traits come from the seed.
function makeDNA(m) {
  const cat = CATEGORY[m.cat];
  const tier = RARITY[m.rarity].tier;
  const SR = mulberry(hashStr('species:' + m.cat + ':' + m.rarity + ':' + (m.word || '')));
  const R = mulberry(m.seed);
  const shape = cat.shape || GENERIC_SHAPES[hashStr(m.word || 'x') % GENERIC_SHAPES.length];

  const eyePool = [['round', 'dot', 'sleepy'], ['round', 'googly', 'angry'], ['angry', 'googly', 'cyclops', 'slit'], ['angry', 'slit', 'many', 'cyclops'], ['slit', 'angry', 'cyclops']][tier];
  const mouthPool = [['smile', 'o', 'grin'], ['grin', 'tongue', 'smile', 'zigzag'], ['fangs', 'grin', 'zigzag', 'tongue'], ['chomp', 'fangs', 'tongue'], ['chomp', 'fangs']][tier];
  const topPool = [['none'], ['none', 'antennae', 'tuft'], ['horns', 'antennae', 'mohawk', 'tuft'], ['horns', 'mohawk', 'antennae'], ['crown']][tier];
  const armPool = [['stub', 'none'], ['stub', 'noodle'], ['noodle', 'claw', 'stub'], ['claw', 'tentacle'], ['claw', 'tentacle']][tier];
  const legPool = [['stub'], ['stub', 'tall'], ['tall', 'stub', 'spider'], ['spider', 'tall', 'tentacles'], ['tall', 'spider']][tier];

  let h, s = cat.sat + R.int(-8, 8), l = cat.lit + R.int(-6, 6);
  const ph = m.photo;
  if (cat.hue < 0) h = ph && ph.sat > 0.18 ? ph.hue + R.int(-10, 10) : R.int(0, 359);
  else h = cat.hue + R.int(-12, 12);
  if (ph && ph.sat > 0.18 && cat.hue >= 0) h = h + ((((ph.hue - h) % 360) + 540) % 360 - 180) * 0.25; // drift toward the photo's colour
  let ah = cat.acc >= 0 ? cat.acc + R.int(-15, 15) : h + 150, as = 60 + R.int(-10, 15), al = 50 + R.int(-8, 8);
  if (ph && ph.sat > 0.25) ah = ph.hue + 20;
  if (m.variant === 'shiny') { h += 150; ah += 150; s = Math.min(95, s + 25); }
  if (m.variant === 'mutated') { ah = 85; as = 90; al = 52; }
  if (tier >= 4) { as = 85; al = 55; }

  const eyeStyle = SR.pick(eyePool);
  const dna = {
    v: 1, shape, shapeSeed: SR.int(1, 1e9),
    eyes: m.variant === 'mutated' ? 'many' : eyeStyle,
    eyeCount: eyeStyle === 'cyclops' ? 1 : (tier >= 3 && SR.chance(0.3) ? 3 : 2),
    mouth: SR.pick(mouthPool), top: SR.pick(topPool),
    arms: m.variant === 'mutated' ? 'tentacle' : R.pick(armPool), legs: SR.pick(legPool),
    pattern: tier >= 2 || R.chance(0.35) ? R.pick(['spots', 'stripes', 'belly', 'none']) : 'none',
    spikes: tier >= 2 && SR.chance(0.5), wings: tier >= 3 && SR.chance(0.6),
    drips: m.variant === 'mutated', variant: m.variant || null, tier, featSeed: R.int(1, 1e9),
    col: { h: Math.round(h), s, l, ah: Math.round(ah), as, al }, sec: SEC_COLOR[shape] || null,
    glow: tier >= 4 ? '#ffe45c' : m.variant === 'spectral' ? '#9ff7ff' : m.variant === 'mutated' ? '#c6ff4a' : null,
    glowEyes: tier >= 4 || m.variant === 'spectral',
  };
  if (m.variant === 'spectral' && tier >= 4) dna.top = 'halo';
  return dna;
}

function buildGrid(dna) {
  const builder = SHAPES[dna.shape] || SHAPES.blob;
  const probe = makeGrid();
  const A = builder(probe, mulberry(dna.shapeSeed), dna);
  const R = mulberry(dna.featSeed);
  const g = makeGrid();
  // back layer: wings, limbs
  if (dna.wings) drawWings(g, 20, (A.eyes.y + A.mouth.y) / 2);
  for (const arm of A.arms || []) drawArm(g, arm, dna.arms, R);
  const ghost = dna.variant === 'spectral' || A.float;
  if (!A.noLegs && !ghost) drawLegs(g, A.legs, A.legs && A.legs.roots ? 'roots' : dna.legs);
  // body
  builder(g, mulberry(dna.shapeSeed), dna);
  if (dna.pattern !== 'none') addPattern(g, dna.pattern, mulberry(dna.featSeed + 7));
  if (dna.spikes) addSpikes(g);
  if (dna.top && dna.top !== 'none') drawTop(g, A.top, dna.top, R);
  if (dna.variant === 'spectral' && !A.float) addGhostTail(g);
  // face
  const eyeStyle = A.eyes.forceStyle && dna.eyes !== 'many' ? A.eyes.forceStyle : dna.eyes;
  drawEyes(g, A.eyes, eyeStyle, dna.eyeCount, mulberry(dna.featSeed + 3), dna.glowEyes);
  drawMouth(g, A.mouth, dna.mouth);
  if (dna.variant === 'mutated') { drawEyes(g, { x: A.mouth.x + 7, y: A.mouth.y - 2, span: 2 }, 'dot', 1, R, false); }
  shadeAndOutline(g);
  if (dna.drips) addDrips(g, mulberry(dna.featSeed + 11));
  return g;
}

const _spriteCache = new Map();
function spriteKey(dna) { return JSON.stringify(dna); }
function renderSprite(canvas, dna, scale = 5) {
  const g = buildGrid(dna), pal = buildPalette(dna);
  canvas.width = GW * scale; canvas.height = GH * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const c = g.px[y * GW + x]; if (!c) continue;
    ctx.fillStyle = pal[c]; ctx.fillRect(x * scale, y * scale, scale, scale);
  }
  if (dna.glowEyes || dna.tier >= 4 || dna.glow) { // soft bloom over glowing pixels
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = pal[P.GLOW]; ctx.shadowBlur = scale * 3; ctx.globalAlpha = 0.55;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (g.px[y * GW + x] === P.GLOW) { ctx.fillStyle = pal[P.GLOW]; ctx.fillRect(x * scale, y * scale, scale, scale); }
    ctx.restore();
  }
  return canvas;
}
function spriteURL(dna, scale = 4) {
  const key = scale + spriteKey(dna);
  if (_spriteCache.has(key)) return _spriteCache.get(key);
  const url = renderSprite(document.createElement('canvas'), dna, scale).toDataURL();
  if (_spriteCache.size > 300) _spriteCache.clear();
  _spriteCache.set(key, url);
  return url;
}

/* ---------- hunter sprite (hand-drawn ASCII pixel art) ---------- */
const HUNTER_ART = [
  '.......oooooo.......',
  '......ohhhhhho......',
  '......ohhhhhho......',
  '.....oHHHHHHHHo.....',
  '...oohhhhhhhhhhoo...',
  '....ooossssssooo....',
  '......osssesseo.....',
  '......ossssssso.....',
  '.......oSSSSSo......',
  '......owwwwwwwo.....',
  '.....occwwwwccco....',
  '....occckkkkkccco...',
  '....occkKKkkkcclo...',
  '....occkkkkkccssoo..',
  '....occccccccclsso..',
  '....oCcccccccccloo..',
  '....oCcccccccccco...',
  '....oCcccocccccco...',
  '.....oCcco.oCcco....',
  '.....oppppo.opppo...',
  '.....oppppo.opppo...',
  '.....opppo..oppo....',
  '....obbbbo..obbbo...',
  '....obbbbbo.obbbbo..',
  '....oooooo..oooooo..',
];
const HUNTER_COLORS = { o: '#140f1f', h: '#3a2d63', H: '#7cf5d3', s: '#f2c59f', S: '#d49b78', e: '#140f1f', w: '#e2575e', c: '#8c4c2c', C: '#5f311c', l: '#ad6a42', k: '#2a2a35', K: '#7cf5d3', p: '#2c2946', b: '#1d1828' };
const WEAPON_ART = {
  sword:  { art: ['.......oo', '......owo', '.....owro', '....owwo.', '...owro..', '.o.owo...', '.ogoo....', '..ogo....', '.obo.....', 'obo......'], grip: [1, 8], colors: { w: '#d6d1c2', r: '#a8714a', g: '#c79a3a', b: '#5a3a22' } },
  pistol: { art: ['.oooooooo.', 'oKKgggggoo', 'oggggggggo', 'oggooooooo', 'obbo......', 'obbo......', '.oo.......'], grip: [1, 4], colors: { g: '#cfd8e3', K: '#7cf5d3', b: '#40364f' } },
  dagger: { art: ['......oo', '.....ogo', '....ogo.', '...ogo..', '.oogo...', '.obbo...', 'obo.....', 'oo......'], grip: [1, 6], colors: { g: '#8dff6a', b: '#3d2a4a' } },
  wand:   { art: ['....oo..', '...oSSo.', '...oSSo.', '....oo..', '...obo..', '..obo...', '.obo....', 'obo.....'], grip: [1, 6], colors: { S: '#d6a2ff', b: '#6b3f2a' } },
  hammer: { art: ['..oooooo.', '.oYYYYYYo', '.oYYYYYYo', '..oooboo.', '....obo..', '...obo...', '..obo....', '.obo.....', 'obo......'], grip: [1, 7], colors: { Y: '#ffd84a', b: '#6b4a2a' } },
};
function drawArt(ctx, rows, colors, ox, oy, s) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ' ') return;
    ctx.fillStyle = colors[ch] || HUNTER_COLORS[ch] || '#140f1f'; ctx.fillRect((ox + x) * s, (oy + y) * s, s, s);
  }));
}
function renderHunter(canvas, weaponId, scale = 5) {
  canvas.width = 30 * scale; canvas.height = 26 * scale;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArt(ctx, HUNTER_ART, HUNTER_COLORS, 2, 1, scale);
  const w = WEAPON_ART[weaponId] || WEAPON_ART.sword;
  drawArt(ctx, w.art, w.colors, 17 - w.grip[0], 15 - w.grip[1], scale);
  return canvas;
}
function weaponIconURL(weaponId, scale = 4) {
  const w = WEAPON_ART[weaponId]; const c = document.createElement('canvas');
  c.width = 11 * scale; c.height = 11 * scale;
  const ctx = c.getContext('2d'); drawArt(ctx, w.art, w.colors, 1, 1, scale);
  return c.toDataURL();
}
