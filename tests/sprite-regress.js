// Guards save compatibility: monsters created by earlier versions must render pixel-identically.
// `node tests/sprite-regress.js write <file>` stores a baseline; `node tests/sprite-regress.js check <file>` compares.
const fs = require('fs'), crypto = require('crypto');
const h = px => crypto.createHash('sha1').update(Buffer.from(px)).digest('base64').slice(0, 16);
const G = require('./load')();
const [mode, file] = process.argv.slice(2);
const cats = ['toilet','mug','shoe','plant','laptop','banana','sofa','phone','bottle','book','lamp','chair','car','animal','tree','food','fruit','cloth','tool','toy','trash','mirror','fridge','candle','clock','keys','bag','pillow','faucet','tv','other'];
const rar = ['common','uncommon','rare','epic','legendary'], vars = [null, null, 'spectral', 'mutated', 'shiny'];
const out = {};
let n = 0;
for (const c of cats) for (const r of rar) for (let i = 0; i < 5; i++) {
  const m = { cat: c, rarity: r, seed: (n * 2654435761) >>> 0, word: c === 'other' ? 'thing' + (i % 3) : null, variant: vars[i % 5], photo: i % 2 ? { hue: (i * 47) % 360, sat: 0.4, lit: 0.5 } : null };
  const dna = G.makeDNA(m);
  const g = G.buildGrid(dna);
  out[`${c}|${r}|${i}`] = { dna, px: h(g.px) };
  n++;
}
if (mode === 'write') { fs.writeFileSync(file, JSON.stringify(out)); console.log('baseline written', n); }
else {
  const base = JSON.parse(fs.readFileSync(file, 'utf8')); let bad = 0;
  for (const k in base) {
    const g = G.buildGrid(base[k].dna); // render the OLD stored dna with the NEW code
    if (h(g.px) !== base[k].px) { bad++; if (bad < 5) console.log('changed:', k); }
  }
  console.log(bad ? `FAIL ${bad} stored monsters render differently` : `ok: all ${Object.keys(base).length} stored monsters render identically`);
  process.exit(bad ? 1 : 0);
}
