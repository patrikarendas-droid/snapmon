// Freezes the LIVE monster generator: for every registry object × rarity × 2 seeds it hashes the generated monster
// (name, family, level, stats, abilities with all numbers, DNA, stored lore), the encyclopedia text (speciesLore, which
// is computed at display time, not stored) and a backup export of a save holding sample monsters. Recorded before the
// Phase 1 curated-content foundation; it must stay identical until curated content is explicitly activated.
// If you change the generator ON PURPOSE, run with "record" and say so in the commit and the journal.
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const FIX = path.join(__dirname, 'fixtures/generator-snapshot.json');
const G = require('./load')();
const { OBJECTS, createMonster, freshState, speciesLore, exportSave, setRNG } = G;
let seed = 4242; setRNG(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const h = crypto.createHash('sha256'), lines = { monsters: 0, species: 0 };
const ids = Object.keys(OBJECTS).sort(), sample = [];
for (const id of ids) for (const r of RAR) for (const k of [0, 1]) {
  const S = freshState(); S.level = 1 + (k * 5) % 12;
  const m = createMonster(S, { obj: id, rarity: r, word: OBJECTS[id].name, photo: k ? { hue: 30, sat: 0.6, lit: 0.5, pal: { conf: 'confident', primary: [30, 60, 50] } } : null });
  delete m.seenAt; // wall-clock time
  h.update(JSON.stringify(m)); lines.monsters++;
  if (k === 0 && r === 'rare' && sample.length < 40 && ids.indexOf(id) % 50 === 0) sample.push(m);
}
for (const id of ids) for (const r of RAR) { h.update(speciesLore({ key: 'o:' + id, obj: id, cat: OBJECTS[id].cat, fam: null, monsterName: OBJECTS[id].name }, r)); lines.species++; }
const S = freshState(); S.monsters = sample.map((m, i) => ({ ...m, id: 'm' + i, caughtAt: 1 })); S.created = 1; S.lastTick = 1; S.savedAt = 1;
const exp = exportSave(S); h.update(exp);
const digest = h.digest('hex'), out = { ...lines, exportChars: exp.length, sha256: digest };
if (process.argv[2] === 'record') { fs.writeFileSync(FIX, JSON.stringify(out, null, 1)); console.log('recorded', JSON.stringify(out)); process.exit(0); }
const want = JSON.parse(fs.readFileSync(FIX, 'utf8'));
if (want.sha256 === digest) { console.log(`ok: live generator unchanged (${lines.monsters} monsters, ${lines.species} encyclopedia texts, backup export)`); process.exit(0); }
console.log('FAIL: live generator output changed', JSON.stringify(out), 'vs recorded', JSON.stringify(want)); process.exit(1);
