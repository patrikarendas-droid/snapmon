// Photo-derived colour extraction (src/color.js) on synthetic scenes with shading, glints, noise and busy backgrounds.
// Checks the extracted colour VALUES, then that the rendered monster actually uses them.
const ColorX = require('../src/color.js');
const load = require('./load.js');
const G = load();
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };

/* ---------- tiny deterministic painter ---------- */
function scene(w, h, seed = 1) {
  const px = new Uint8ClampedArray(w * h * 4);
  let s = seed >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const set = (x, y, [r, g, b]) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; };
  const shade = ([r, g, b], f) => [r * f, g * f, b * f];
  const noise = (c, a = 8) => c.map(v => v + (rnd() - 0.5) * a);
  const api = {
    px, w, h, rnd,
    fill(fn) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, noise(fn(x / w, y / h))); return api; },
    // shaded ellipse with a specular glint: light from the top left
    blob(cx, cy, rx, ry, col, glint = true) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x / w - cx) / rx, dy = (y / h - cy) / ry, d = dx * dx + dy * dy; if (d > 1) continue;
        let c = shade(col, 1.15 - 0.45 * ((dx + dy) / 2 + 0.5));
        if (glint && Math.hypot(dx + 0.45, dy + 0.45) < 0.16) c = [250, 250, 248];
        set(x, y, noise(c));
      }
      return api;
    },
    rect(x0, y0, x1, y1, col, grad = 0.25) {
      for (let y = Math.round(y0 * h); y < y1 * h; y++) for (let x = Math.round(x0 * w); x < x1 * w; x++) set(x, y, noise(shade(col, 1 + grad / 2 - grad * ((y / h - y0) / (y1 - y0)))));
      return api;
    },
  };
  return api;
}
const hueOf = p => p.primary[0], dist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const W = 128, H = 128;
const run = (sc, box) => ColorX.extractPalette(sc.px, sc.w, sc.h, box);
const show = (name, p) => console.log(`     ${name}: primary hsl(${p.primary}) ${p.swatches.primary} · secondary ${p.secondary ? 'hsl(' + p.secondary + ')' : '-'} · ${p.conf} (${p.method}, object pixels ${p.fgShare}, ${p.ms} ms)`);

// 1) red mug on a white background
let sc = scene(W, H, 1).fill(() => [238, 236, 230]).blob(0.48, 0.52, 0.2, 0.24, [200, 30, 35]).rect(0.66, 0.42, 0.74, 0.62, [185, 28, 32]);
let p = run(sc, [0.24, 0.24, 0.54, 0.54]); show('red mug / white', p);
ok(dist(hueOf(p), 358) < 15 && p.primary[1] > 50 && p.conf === 'confident', 'red object on white background -> red primary, confident');

// 2) blue mug on a brown table in front of a beige wall (the box contains both)
sc = scene(W, H, 2).fill((x, y) => y < 0.55 ? [214, 200, 172] : [120, 78, 44]).blob(0.5, 0.55, 0.17, 0.22, [35, 80, 205]);
p = run(sc, [0.28, 0.28, 0.44, 0.52]); show('blue mug / brown table', p);
ok(dist(hueOf(p), 222) < 18 && p.primary[1] > 45, 'blue object on brown table -> blue, not brown');

// 3) yellow forklift in a grey warehouse: yellow body, black tyres, grey mast
sc = scene(W, H, 3).fill((x, y) => y < 0.6 ? [128, 130, 132] : [92, 94, 96])
  .rect(0.3, 0.38, 0.72, 0.72, [235, 190, 20]).rect(0.24, 0.12, 0.29, 0.8, [70, 72, 76], 0.1)
  .blob(0.38, 0.78, 0.07, 0.07, [22, 22, 24], false).blob(0.64, 0.78, 0.07, 0.07, [22, 22, 24], false);
p = run(sc, [0.2, 0.1, 0.56, 0.78]); show('yellow forklift / grey', p);
ok(dist(hueOf(p), 48) < 15 && p.primary[1] > 60, 'yellow machinery in a grey environment -> yellow primary');

// 4) the same apple shape in red and in green, on a wooden table
const apple = col => scene(W, H, 4).fill((x, y) => [150 + 20 * Math.sin(y * 40), 104, 64]).blob(0.5, 0.5, 0.22, 0.22, col);
const pr = run(apple([190, 25, 30]), [0.26, 0.26, 0.48, 0.48]), pg = run(apple([95, 175, 40]), [0.26, 0.26, 0.48, 0.48]);
show('red apple', pr); show('green apple', pg);
ok(dist(hueOf(pr), 358) < 15 && dist(hueOf(pg), 98) < 18, 'red and green versions of the same object get their own colours');

// 5) black office chair on a light floor
sc = scene(W, H, 5).fill(() => [205, 200, 192]).rect(0.35, 0.15, 0.65, 0.55, [28, 28, 32]).rect(0.3, 0.55, 0.7, 0.65, [34, 34, 38]).rect(0.48, 0.65, 0.52, 0.85, [60, 60, 64]);
p = run(sc, [0.28, 0.12, 0.44, 0.76]); show('black chair', p);
ok(p.primary[2] < 25, 'dark object -> dark primary (lightness ' + p.primary[2] + ')');

// 6) metallic kettle: grey gradient with strong highlights, on a dark worktop
sc = scene(W, H, 6).fill(() => [40, 34, 30]);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x / W - 0.5) / 0.22, dy = (y / H - 0.5) / 0.26; if (dx * dx + dy * dy <= 1) { const v = 120 + 110 * Math.max(0, Math.cos(dx * 2.2)) ; const i = (y * W + x) * 4; sc.px[i] = v; sc.px[i + 1] = v + 4; sc.px[i + 2] = v + 10; } }
p = run(sc, [0.26, 0.22, 0.48, 0.56]); show('metal kettle', p);
ok(p.primary[1] < 25 && p.primary[2] > 40, 'metallic object -> colourless mid/light grey, not the dark worktop');

// 7) multicoloured: red and blue striped umbrella
sc = scene(W, H, 7).fill(() => [150, 200, 235]);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = x / W - 0.5, dy = y / H - 0.5; if (Math.hypot(dx, dy) < 0.28) { const red = Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4)) % 2 === 0; const i = (y * W + x) * 4; const c = red ? [205, 30, 40] : [40, 60, 190]; sc.px[i] = c[0]; sc.px[i + 1] = c[1]; sc.px[i + 2] = c[2]; } }
p = run(sc, [0.2, 0.2, 0.6, 0.6]); show('red/blue umbrella', p);
const hues = [hueOf(p), p.secondary && p.secondary[0]];
ok(p.secondary && hues.some(h => dist(h, 357) < 15) && hues.some(h => dist(h, 233) < 18), 'multicoloured object -> both colours as primary and secondary');

// 8) small purple umbrella in a busy scene (many coloured patches), tight detector box
sc = scene(W, H, 8).fill((x, y) => [[60, 140, 60], [200, 120, 40], [90, 90, 170], [180, 180, 60]][(Math.floor(x * 6) + 2 * Math.floor(y * 6)) % 4]).blob(0.7, 0.3, 0.06, 0.07, [140, 40, 170]);
p = run(sc, [0.635, 0.22, 0.13, 0.16]); show('small purple umbrella', p);
ok(dist(hueOf(p), 287) < 20, 'small object in a complex scene -> its own purple');

// 9) two detected objects: the colour follows the one the player picked
sc = scene(W, H, 9).fill(() => [225, 222, 215]).blob(0.28, 0.5, 0.14, 0.18, [30, 70, 200]).blob(0.72, 0.5, 0.14, 0.14, [200, 30, 30]);
const pl = run(sc, [0.12, 0.3, 0.32, 0.4]), pRight = run(sc, [0.56, 0.34, 0.32, 0.32]);
ok(dist(hueOf(pl), 224) < 18 && dist(hueOf(pRight), 0) < 15, 'multiple objects -> the selected box decides the colour (blue left, red right)');

// 10) no box: centred object, still not the background; marked as a fallback
sc = scene(W, H, 10).fill(() => [120, 78, 44]).blob(0.5, 0.5, 0.25, 0.28, [40, 160, 60]);
p = run(sc, null); show('no box', p);
ok(dist(hueOf(p), 128) < 18 && p.conf === 'fallback', 'no detector box -> centre + background suppression, flagged as fallback');

// 11) object the same colour as its background: no false confidence
sc = scene(W, H, 11).fill(() => [200, 40, 40]).blob(0.5, 0.5, 0.2, 0.2, [205, 45, 45]);
p = run(sc, [0.28, 0.28, 0.44, 0.44]);
ok(p.conf === 'fallback', 'object indistinguishable from background -> fallback, not confident');

// 12) speed on a realistic input size
const big = scene(160, 120, 12).fill((x, y) => [100 + 80 * x, 90, 80 + 60 * y]).blob(0.5, 0.5, 0.2, 0.25, [30, 180, 200]);
const t0 = Date.now(); for (let i = 0; i < 20; i++) run(big, [0.28, 0.24, 0.44, 0.52]); const ms = (Date.now() - t0) / 20;
console.log(`     extraction time: ${ms.toFixed(1)} ms per photo (Node, 160x120 input)`);
ok(ms < 40, 'colour extraction is cheap (' + ms.toFixed(1) + ' ms)');

/* ---------- rendered monsters use the colours ---------- */
const lumaHue = rgbStr => { const [r, g, b] = rgbStr.match(/\d+/g).map(Number); return ColorX.rgb2hsl(r, g, b); };
const mk = (obj, pal, seed = 7, rarity = 'rare') => G.makeDNA({ obj, cat: G.OBJECTS[obj].cat, rarity, seed, photo: { hue: pal.primary[0], sat: pal.primary[1] / 100, lit: pal.primary[2] / 100, pal } });
const bodyOf = dna => lumaHue(G.buildPalette(dna)[2]);
const yellow = run(scene(W, H, 3).fill(() => [128, 130, 132]).rect(0.3, 0.38, 0.72, 0.72, [235, 190, 20]), [0.25, 0.3, 0.52, 0.48]);
const green = run(scene(W, H, 3).fill(() => [128, 130, 132]).rect(0.3, 0.38, 0.72, 0.72, [40, 170, 60]), [0.25, 0.3, 0.52, 0.48]);
const dy = mk('forklift', yellow), dg = mk('forklift', green);
ok(dist(bodyOf(dy)[0], 48) < 15 && dist(bodyOf(dg)[0], 130) < 18, `forklift monster body follows the photo: yellow ${bodyOf(dy)} vs green ${bodyOf(dg)}`);
const pd = G.buildPalette(dy), gy = G.buildGrid(dy);
const used = new Set(gy.px); const OUT = 1, PUPIL = 9;
ok(used.has(OUT) && used.has(PUPIL) && pd[OUT] !== pd[2], 'outline and eyes keep their own colours (readable on any body colour)');
const blackChair = run(scene(W, H, 5).fill(() => [205, 200, 192]).rect(0.35, 0.15, 0.65, 0.65, [28, 28, 32]), [0.3, 0.1, 0.4, 0.6]);
const dc = mk('office_chair', blackChair), pc = G.buildPalette(dc);
const Lbody = bodyOf(dc)[2], Lout = lumaHue(pc[OUT])[2];
ok(Lbody < 35 && Lbody - Lout >= 8, `dark chair stays dark (body L${Lbody}) but its outline is still darker (L${Lout})`);
const umb = run(sc = scene(W, H, 7).fill(() => [150, 200, 235]).blob(0.5, 0.5, 0.25, 0.25, [140, 40, 170]), [0.22, 0.22, 0.56, 0.56]);
ok(dist(bodyOf(mk('umbrella', umb))[0], 287) < 20, 'purple umbrella -> purple umbrella monster');
// determinism and persistence: the same saved DNA renders identically after a save round-trip
const dna = mk('mug', pr), json = JSON.parse(JSON.stringify(dna));
ok(JSON.stringify(G.buildGrid(json).px) === JSON.stringify(G.buildGrid(dna).px) && G.buildPalette(json)[2] === G.buildPalette(dna)[2], 'palette is stored in the DNA and renders identically after save/reload');
// a fallback palette only leans towards the photo instead of copying it
const fb = run(scene(W, H, 10).fill(() => [120, 78, 44]).blob(0.5, 0.5, 0.25, 0.28, [40, 160, 60]), null);
const dfb = mk('banana', fb), base = G.makeDNA({ obj: 'banana', cat: G.OBJECTS.banana.cat, rarity: 'rare', seed: 7 });
const hb = bodyOf(dfb)[0], h0 = bodyOf(base)[0];
ok(dist(hb, h0) > 3 && dist(hb, h0) < dist(128, h0), `fallback palette only leans the banana towards green (${h0} -> ${hb})`);
// legacy monsters (no palette) are untouched: covered by tests/sprite-regress.js
console.log(bad ? `${bad} problem(s)` : 'ok: photo colours are extracted from the object and used by the monster');
process.exit(bad ? 1 : 0);
