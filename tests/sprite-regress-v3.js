// Monsters created by v0.3.x (object DNA without a photo palette) must keep rendering pixel-identically.
// `node tests/sprite-regress-v3.js write <file> [srcDir]` stores a baseline using the sources in srcDir;
// `node tests/sprite-regress-v3.js check <file>` renders the stored DNA with the current code.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const [mode, file, srcDir = path.join(__dirname, '../src')] = process.argv.slice(2);
const ctx = { console, Math, JSON, Date }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js'].map(f => fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n') + ';globalThis.T={makeDNA,buildGrid,buildPalette,OBJECT_LIST}', ctx);
const { makeDNA, buildGrid, buildPalette, OBJECT_LIST } = ctx.T;
const hash = dna => { const g = buildGrid(dna), pal = buildPalette(dna); return crypto.createHash('sha1').update(Buffer.from(g.px)).update(JSON.stringify(pal)).digest('base64').slice(0, 16); };
if (mode === 'write') {
  const out = {}, rar = ['common', 'uncommon', 'rare', 'epic', 'legendary'], vars = [null, 'spectral', 'mutated', 'shiny'];
  OBJECT_LIST.filter((o, i) => i % 7 === 0 || o.vis === 'D').forEach((o, i) => {
    const m = { obj: o.id, cat: o.cat, rarity: rar[i % 5], seed: (i * 2654435761) >>> 0, variant: vars[i % 4], photo: i % 2 ? { hue: (i * 47) % 360, sat: 0.5, lit: 0.45 } : null };
    const dna = makeDNA(m); out[o.id + '|' + i] = { dna, h: hash(dna) };
  });
  fs.writeFileSync(file, JSON.stringify(out)); console.log('baseline written', Object.keys(out).length);
} else {
  const base = JSON.parse(fs.readFileSync(file, 'utf8')); let bad = 0;
  for (const k in base) if (hash(base[k].dna) !== base[k].h) { bad++; if (bad < 5) console.log('changed:', k); }
  console.log(bad ? `FAIL ${bad} v0.3 monsters render differently` : `ok: all ${Object.keys(base).length} v0.3 monsters render identically`);
  process.exit(bad ? 1 : 0);
}
