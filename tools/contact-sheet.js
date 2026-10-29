#!/usr/bin/env node
// Renders a PNG contact sheet of monster designs for visual review (no browser needed).
// Rows = objects, columns = rarities (+ extra individuals). Usage:
//   node tools/contact-sheet.js out.png forklift train tractor excavator truck ...   (default: the look-alike groups)
const fs = require('fs'), zlib = require('zlib'), vm = require('vm'), path = require('path');
const ctx = { console, Math, JSON, Date }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') +
  '\n;globalThis.T = { makeDNA, buildGrid, buildPalette, OBJECTS, objectTier, GW, GH };', ctx);
const { makeDNA, buildGrid, buildPalette, OBJECTS, objectTier, GW, GH } = ctx.T;
const [out = 'contact.png', ...ids] = process.argv.slice(2);
const list = ids.length ? ids : ['forklift', 'train', 'tractor', 'excavator', 'truck', 'office_chair', 'dining_chair', 'sofa', 'mug', 'teapot', 'glass', 'laptop', 'desktop_pc', 'tv', 'banana', 'pineapple', 'cucumber'];
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'], COLS = RAR.length + 3, S = 3, CELL = GW * S + 6;
const W = COLS * CELL, H = list.length * CELL, img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([24, 20, 40, 255], i * 4);
const hex = h => { const rg = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(h); if (rg) return [+rg[1], +rg[2], +rg[3]]; const m = /^#?([0-9a-f]{6})/i.exec(h); if (m) return [0, 2, 4].map(k => parseInt(m[1].slice(k, k + 2), 16));
  const r = /hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%/.exec(h); if (!r) return [255, 0, 255];
  const [hh, s, l] = [r[1] / 360, r[2] / 100, r[3] / 100], q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return Math.round(255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p)); };
  return [f(hh + 1 / 3), f(hh), f(hh - 1 / 3)]; };
list.forEach((id, row) => {
  const o = OBJECTS[id]; if (!o) { console.log('unknown object', id); return; }
  for (let c = 0; c < COLS; c++) {
    const rarity = RAR[Math.min(c, RAR.length - 1)];
    const dna = makeDNA({ cat: o.cat, obj: id, rarity, seed: (row * 7919 + c * 104729) >>> 0, photo: c >= RAR.length ? { hue: (c * 97) % 360, sat: 0.5, lit: 0.5 } : null, variant: null });
    const g = buildGrid(dna), pal = buildPalette(dna);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const v = g.px[y * GW + x]; if (!v) continue;
      const rgb = hex(pal[v]);
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) img.set([...rgb, 255], (((row * CELL + 3 + y * S + dy) * W) + c * CELL + 3 + x * S + dx) * 4);
    }
  }
  console.log(`${String(row + 1).padStart(2)}. ${id.padEnd(16)} ${objectTier(o)}`);
});
// minimal PNG encoder
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`wrote ${out} (${list.length} objects × ${COLS} individuals: 5 rarities + 3 photo-coloured)`);
