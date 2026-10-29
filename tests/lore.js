// Rarity-specific flavour text (src/lore.js): deterministic, stored on the monster, different per rarity, never
// leaves a placeholder unfilled, and old saves get lore without any other change.
const G = require('./load')();
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const ids = Object.keys(G.OBJECTS);
// 1) every object × rarity (several seeds, with and without a photo colour) yields clean text
let problems = [], n = 0;
for (const id of ids) for (const r of RAR) for (const seed of [1, 77, 4242]) {
  const pal = seed === 77 ? { conf: 'confident', primary: [seed % 360, 60, 50] } : null;
  const t = G.monsterLore({ obj: id, rarity: r, seed, photo: pal ? { pal } : null, fam: 'food', name: 'X, the Eternal Feast' }); n++;
  if (!t || /[{}]|undefined|\bnull\b|\bNaN\b|\s{2}|\b[Aa] [aeiouAEIOU]/.test(t) || t.length > 260) problems.push(id + '/' + r + ': ' + t);
}
ok(!problems.length, `${n} texts for ${ids.length} objects × 5 rarities have no unfilled or broken parts${problems.length ? ': ' + problems.slice(0, 3).join(' | ') : ''}`);
// 2) deterministic and rarity-specific
const m = r => G.monsterLore({ obj: 'apple', rarity: r, seed: 99, fam: 'food' });
ok(m('legendary') === m('legendary'), 'the same monster always gets the same text');
let differs = 0; for (const id of ids.slice(0, 300)) if (G.monsterLore({ obj: id, rarity: 'common', seed: 5 }) !== G.monsterLore({ obj: id, rarity: 'legendary', seed: 5 })) differs++;
ok(differs === 300, `Legendary text differs from Common text for the same object (${differs}/300)`);
const distinct = new Set(Array.from({ length: 40 }, (_, i) => G.monsterLore({ obj: 'mug', rarity: 'rare', seed: i * 7919 })));
ok(distinct.size >= 6, `monsters of the same object and rarity get varied text (${distinct.size} variants in 40)`);
// 3) the object is reflected (name, signature move or category kit)
const t = G.monsterLore({ obj: 'forklift', rarity: 'epic', seed: 3, abilities: [{ name: 'Pallet Hoist' }] });
console.log('   forklift epic:', t);
// 4) stored at creation; encounter rolls unchanged (lore uses no random numbers)
let seed = 1; G.setRNG(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
const S = G.freshState(); S.stats.photos = 3; S.stats.encounters = 1; let made = null;
for (let i = 0; i < 5000 && !made; i++) { const r = G.resolvePhoto(S, 'apple', { hue: 0, sat: .8, lit: .5, hash: i.toString(16).padStart(16, '0') }, { label: 'apple' }); if (r.encounter && r.monster.rarity === 'legendary') made = r.monster; }
if (made) { ok(typeof made.lore === 'string' && made.lore === G.loreOf(made), 'a new monster stores its flavour text'); console.log('   legendary apple:', made.name, '—', made.lore); }
// 5) old save: monsters without lore get it on load, everything else unchanged; it survives export/import
const old = G.freshState(); old.monsters = [{ id: 'm1', obj: 'apple', cat: 'fruit', rarity: 'legendary', seed: 123, fam: 'food', name: 'Appelomega, the Eternal Feast', dna: { x: 1 }, stats: { hp: 1 } }];
const ctxStore = {}; const saved = JSON.stringify(old);
const loaded = (() => { const s = G.migrate(JSON.parse(saved)); for (const mm of s.monsters) if (!mm.lore) mm.lore = G.monsterLore(mm); return s; })();
ok(loaded.monsters[0].lore && JSON.stringify(loaded.monsters[0].dna) === '{"x":1}', 'monsters from older saves receive lore without other changes');
const round = G.importSave(G.exportSave(loaded));
ok(round.monsters[0].lore === loaded.monsters[0].lore, 'lore survives backup export and import');
console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL LORE CHECKS PASSED');
process.exit(bad ? 1 : 0);
