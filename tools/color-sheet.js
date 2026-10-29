#!/usr/bin/env node
// Visual review of photo-derived colours: each row is one object, each column a photographed colour. The photo is a
// synthetic scene (coloured object on a contrasting, textured background) run through the real extractor
// (src/color.js) and the real sprite engine. Usage: node tools/color-sheet.js out.png
const fs = require('fs'), zlib = require('zlib'), vm = require('vm'), path = require('path');
const ColorX = require('../src/color.js');
const ctx = { console, Math, JSON, Date }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + ';globalThis.T={makeDNA,buildGrid,buildPalette,OBJECTS,GW,GH}', ctx);
const { makeDNA, buildGrid, buildPalette, OBJECTS, GW, GH } = ctx.T;
const out = process.argv[2] || 'colors.png';
const OBJS = ['mug', 'forklift', 'apple', 'umbrella', 'office_chair', 'car', 'sneaker', 'teapot'];
const COLS = [['red', [200, 30, 35]], ['blue', [35, 80, 205]], ['yellow', [235, 190, 20]], ['green', [50, 160, 60]], ['purple', [130, 45, 170]], ['black', [28, 28, 32]], ['white', [236, 236, 230]], ['steel', [160, 165, 172]]];
const BGS = [[120, 78, 44], [128, 130, 132], [214, 200, 172], [60, 90, 60]];
function photo(col, bg, seed) {
  const W = 128, H = 128, px = new Uint8ClampedArray(W * H * 4); let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x / W - 0.5) / 0.22, dy = (y / H - 0.5) / 0.26, inObj = dx * dx + dy * dy <= 1, i = (y * W + x) * 4;
    const base = inObj ? col.map(v => v * (1.12 - 0.3 * ((dx + dy) / 2 + 0.5))) : bg.map(v => v * (0.9 + 0.2 * Math.sin(x * 0.3 + y * 0.1)));
    for (let k = 0; k < 3; k++) px[i + k] = base[k] + (rnd() - 0.5) * 10; px[i + 3] = 255;
  }
  return ColorX.extractPalette(px, W, H, [0.24, 0.2, 0.52, 0.6]);
}
const S = 3, CELL = GW * S + 6, Wd = (COLS.length + 1) * CELL, Ht = OBJS.length * CELL, img = Buffer.alloc(Wd * Ht * 4);
for (let i = 0; i < Wd * Ht; i++) img.set([24, 20, 40, 255], i * 4);
const rgb = str => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(str); return m ? [+m[1], +m[2], +m[3]] : [255, 0, 255]; };
const paint = (dna, row, col) => {
  const g = buildGrid(dna), pal = buildPalette(dna);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const v = g.px[y * GW + x]; if (!v) continue; const c = /^#/.test(pal[v]) ? [1, 3, 5].map(k => parseInt(pal[v].slice(k, k + 2), 16)) : rgb(pal[v]);
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) img.set([...c, 255], ((row * CELL + 3 + y * S + a) * Wd + col * CELL + 3 + x * S + b) * 4); }
};
OBJS.forEach((id, row) => {
  const o = OBJECTS[id];
  paint(makeDNA({ obj: id, cat: o.cat, rarity: 'uncommon', seed: 99 + row, photo: null }), row, 0); // column 0: no photo palette
  COLS.forEach(([name, c], k) => {
    const pal = photo(c, BGS[(row + k) % BGS.length], 7 + row * 31 + k);
    paint(makeDNA({ obj: id, cat: o.cat, rarity: ['common', 'uncommon', 'rare', 'epic'][(row + k) % 4], seed: 1000 + row * 17 + k, photo: { hue: pal.primary[0], sat: pal.primary[1] / 100, lit: pal.primary[2] / 100, pal } }), row, k + 1);
  });
});
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((Wd * 4 + 1) * Ht); for (let y = 0; y < Ht; y++) img.copy(raw, y * (Wd * 4 + 1) + 1, y * Wd * 4, (y + 1) * Wd * 4);
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(Wd, 0); ihdr.writeUInt32BE(Ht, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`wrote ${out}: rows ${OBJS.join(', ')}; columns: default, ${COLS.map(c => c[0]).join(', ')}`);
