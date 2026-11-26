// Families vs variants (2026-11-26). Spectral, Mutated and Prismatic are VARIANTS, never families.
//   • every registry object has a real family (one of FAMILY_IDS); every rarity × variant of it shows that same family
//     (exhaustive: all objects × 5 rarities × 4 variants), incl. the owner's Prismatic Common baby bottle (Household)
//   • the combat nature (stored m.fam: stats, weaknesses, family moves, material) is EXACTLY as before: compared with
//     monsters made by the build-18 game code (git 45dbff1) for every object × rarity × variant
//   • old saves: monsters/encyclopedia entries stored with fam 'spectral'/'mutated' (variant or native), object-less
//     legacy monsters, an older family of an object (a Mechanical spoon), a bare category id — all show a real family
//     after load + backup code; the stored fam, stats and moves are untouched; nothing is written to the save
//   • a build-18 save (made by the build-18 code) loads with identical monsters and real families
//   • battle type interactions use the unchanged nature; the family filter list holds only real families
//   • new statistics/quests count real families; older 'spectral'/'mutated' statistic keys are kept
// Usage: node tests/family-variant.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const G = require('./load')();
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'], VAR = [null, 'spectral', 'mutated', 'shiny'];
const NOT_FAMILIES = ['spectral', 'mutated', 'shiny', 'prismatic', 'normal'];
const seeded = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
const snap = x => JSON.stringify(x);

// 1. the taxonomy
ok(snap(G.FAMILY_IDS) === snap(['organic', 'mechanical', 'elemental', 'household', 'food', 'botanical']), 'real families: Organic, Mechanical, Elemental, Household, Food, Botanical');
ok(G.FAMILY_IDS.every(f => G.FAMILIES[f]) && !G.FAMILY_IDS.some(f => NOT_FAMILIES.includes(f)), 'no variant (Spectral, Mutated, Prismatic) is a family');
ok(snap(G.NATIVE_FAMILIES.slice(0, 6)) === snap(G.FAMILY_IDS), 'object-less "other" monsters (hash % 6 of NATIVE_FAMILIES) only ever get real families');
ok(Object.values(G.CATEGORY_FAMILY).every(f => G.FAMILY_IDS.includes(f)), 'every replacement family is a real family');
const naturedCats = G.CATEGORIES.filter(c => c.fam && !G.FAMILY_IDS.includes(c.fam)).map(c => c.id).sort();
ok(snap(naturedCats) === snap(Object.keys(G.CATEGORY_FAMILY).sort()), `the categories with a Spectral/Mutated nature (${naturedCats.join(', ')}) each have a real family`);

// 2. every registry object: one real family, identical for every rarity and variant
const ids = Object.keys(G.OBJECTS);
const bad = [], perFam = {};
for (const id of ids) { const f = G.objectFamily(id); perFam[f] = (perFam[f] || 0) + 1; if (!G.FAMILY_IDS.includes(f)) bad.push(id + '=' + f); }
ok(ids.length >= 2308 && !bad.length, `all ${ids.length} registry objects have a real family (${Object.entries(perFam).map(([f, n]) => f + ' ' + n).join(', ')})${bad.length ? ' — bad: ' + bad.slice(0, 5) : ''}`);
const S0 = G.freshState(), mismatch = [];
let made = 0;
G.setRNG(seeded(3));
const sample = {};
for (const id of ids) for (const r of RAR) for (const v of VAR) {
  const m = G.createMonster(S0, { obj: id, cat: G.OBJECTS[id].cat, rarity: r, variant: v, word: G.OBJECTS[id].name, photo: null, first: false, rng: seeded(made + 1) });
  made++;
  const f = G.familyOf(m);
  if (f !== G.objectFamily(id) || NOT_FAMILIES.includes(f)) mismatch.push(`${id}/${r}/${v}: ${f}`);
  if (v === 'spectral' && m.fam !== 'spectral' || v === 'mutated' && m.fam !== 'mutated') mismatch.push(`${id}/${r}/${v}: nature ${m.fam}`);
  sample[id + '|' + r + '|' + v] = m;
}
ok(made === ids.length * 20 && !mismatch.length, `${made} monsters (every object × 5 rarities × 4 variants) show their object's family; Spectral/Mutated stay combat natures only${mismatch.length ? ' — ' + mismatch.slice(0, 5) : ''}`);
{
  const bb = sample['x_baby_bottle|common|shiny'];
  ok(bb && bb.variant === 'shiny' && G.familyOf(bb) === 'household' && G.variantLabel(bb.variant) === 'Prismatic', `owner's screenshot: Prismatic Common baby bottle → family Household, variant Prismatic (combat nature ${bb.fam}, as in build 18)`);
  const all = VAR.flatMap(v => RAR.map(r => G.familyOf(sample[`x_baby_bottle|${r}|${v}`])));
  ok(all.every(f => f === 'household'), 'baby bottle: all 20 rarity × variant forms are Household');
  ok(G.familyOf(sample['cutlery_spoon|rare|spectral']) === 'household' && sample['cutlery_spoon|rare|spectral'].fam === 'spectral', 'a Spectral spoon is a Household monster that fights with the Spectral table');
  ok(G.familyOf(sample['book|epic|null']) === 'household' && sample['book|epic|null'].fam === 'spectral', 'a Normal book: family Household, combat nature unchanged (Spectral table)');
  ok(G.familyOf(sample['beetle|common|mutated']) === 'organic' && G.familyOf(sample['clock|common|null']) === 'mechanical' && G.familyOf(sample['shirt|common|null']) === 'organic', 'bugs are Organic, clocks Mechanical, clothing Organic');
}

// 3. combat natures, stats, moves and DNA are EXACTLY those of build 18 (same generator input → same monster)
const REF = '45dbff1';
const hasRef = (() => { try { execSync(`git cat-file -e ${REF}^{commit}`, { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
ok(hasRef, `build 18 code (${REF}) is in the git history (CI: fetch-depth 0)`);
let OLD = null;
if (hasRef) {
  const FILES = ['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'combatlog.js', 'curated.js', 'curated-data.js'];
  const store = {};
  const ctx = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, escape, unescape, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  vm.createContext(ctx);
  const src = FILES.map(f => execSync(`git show ${REF}:src/${f}`, { maxBuffer: 64 << 20 }).toString()).join('\n');
  vm.runInContext(src + ';globalThis.__api={createMonster,freshState,saveState,exportSave,recordSighting,newBattle,setRNG:f=>{RNG=f}}', ctx);
  OLD = { api: ctx.__api, store };
  const So = OLD.api.freshState(), diff = [];
  let n = 0;
  for (const id of ids) for (const r of RAR) for (const v of VAR) {
    const a = OLD.api.createMonster(So, { obj: id, cat: G.OBJECTS[id].cat, rarity: r, variant: v, word: G.OBJECTS[id].name, photo: null, first: false, rng: seeded(n + 1) });
    const b = sample[id + '|' + r + '|' + v]; n++;
    const strip = m => snap({ ...m, caughtAt: 0, seenAt: 0 });
    if (strip(a) !== strip(b)) diff.push(`${id}/${r}/${v}`);
  }
  ok(n === made && !diff.length, `all ${n} generated monsters are identical to build 18 (combat nature, stats, moves, DNA, names)${diff.length ? ' — differ: ' + diff.slice(0, 5) : ''}`);
}

// 4. type interactions: the battle uses the stored nature, unchanged
{
  const S = G.freshState(); S.level = 5;
  for (const key of ['book|common|null', 'cutlery_spoon|rare|spectral', 'teddy|rare|mutated', 'mug|common|shiny', 'x_baby_bottle|common|shiny']) {
    const m = sample[key], B = G.newBattle(S, m);
    ok(B.enemy.fam === m.fam && ['slash', 'ballistic', 'arcane', 'shock', 'toxic'].every(el => G.effMult(B.enemy.fam, el) === G.effMult(m.fam, el)), `${key}: battle weaknesses/resistances use its unchanged nature (${m.fam}), family shown ${G.familyOf(m)}`);
  }
}

// 5. old saves: stored 'spectral'/'mutated' families, object-less monsters, older object families, bare category ids
{
  const S = G.freshState();
  const mk = (o) => ({ id: 'm' + (S.monsters.length + 1), name: 'Old', level: 3, xp: 0, rarity: 'common', variant: null, seed: 7, stats: { hp: 30, atk: 9, def: 8, spd: 7 }, abilities: [{ name: 'Gnash', power: 1.25 }], dna: sample['mug|common|null'].dna, caughtAt: 1, ...o });
  const cases = [
    [mk({ obj: 'x_baby_bottle', cat: 'toy', fam: 'mutated', variant: 'shiny' }), 'household', 'build-18 Prismatic baby bottle (stored fam "mutated")'],
    [mk({ obj: 'cutlery_spoon', cat: 'tool', fam: 'spectral', variant: 'spectral' }), 'household', 'Spectral spoon (stored fam "spectral")'],
    [mk({ obj: 'cutlery_spoon', cat: 'tool', fam: 'mechanical' }), 'household', 'pre-v0.4.5 Mechanical spoon (older family of its object)'],
    [mk({ obj: 'teddy', cat: 'toy', fam: 'mutated', variant: 'mutated' }), 'household', 'Mutated teddy'],
    [mk({ obj: 'book', cat: 'book', fam: 'spectral' }), 'household', 'Normal book (native Spectral nature)'],
    [mk({ obj: 'toy', cat: 'toy', fam: 'mutated' }), 'household', 'bare category id "toy" stored as object'],
    [mk({ obj: null, cat: 'bug', fam: 'mutated' }), 'organic', 'object-less legacy bug'],
    [mk({ obj: null, cat: 'mug', fam: 'spectral', variant: 'spectral' }), 'food', 'object-less legacy Spectral mug'],
    [mk({ obj: null, cat: 'other', word: 'gizmo', fam: 'elemental' }), 'elemental', 'object-less "other" monster keeps its stored real family'],
    [mk({ obj: null, cat: 'other', word: 'gizmo', fam: 'mutated', variant: 'mutated' }), G.FAMILY_IDS, 'object-less "other" Mutated monster gets a real family'],
    [mk({ obj: 'no_longer_exists', cat: 'clock', fam: 'spectral' }), 'mechanical', 'unknown object id falls back to its category'],
  ];
  for (const [m] of cases) S.monsters.push(m);
  S.dex['o:x_baby_bottle'] = { key: 'o:x_baby_bottle', obj: 'x_baby_bottle', name: 'Baby bottle', cat: 'toy', fam: 'mutated', seen: 2, caught: 1, rarities: { common: true }, variants: { shiny: true }, dna: sample['mug|common|null'].dna };
  S.dex['o:cutlery_spoon'] = { key: 'o:cutlery_spoon', obj: 'cutlery_spoon', name: 'Spoon', cat: 'tool', fam: 'spectral', seen: 1, caught: 0, rarities: { rare: true }, variants: { spectral: true }, dna: sample['mug|common|null'].dna };
  S.stats.famSeen = { spectral: 2, mutated: 1, food: 1 };
  const before = snap(S.monsters);
  G.saveState(S); const L = G.loadState(), R = G.importSave(G.exportSave(S));
  for (const X of [L, R]) {
    const tag = X === L ? 'after save + load' : 'after backup code';
    cases.forEach(([m, want, what], i) => { const got = G.familyOf(X.monsters[i]); ok(Array.isArray(want) ? want.includes(got) : got === want, `${tag}: ${what} → ${got}`); });
    // move display names are refreshed to the curated writing by design (tests/curated-refresh.js): compare the numbers
    const mech = m => [m.fam, m.stats, m.abilities.map(a => snap({ ...a, name: 0, key: 0 })), m.variant, m.rarity, m.obj, m.level, m.seed];
    ok(snap(X.monsters.map(mech)) === snap(S.monsters.map(mech)), `${tag}: stored natures, stats, move numbers, variants unchanged`);
    ok(G.familyOf(X.dex['o:x_baby_bottle']) === 'household' && G.familyOf(X.dex['o:cutlery_spoon']) === 'household', `${tag}: encyclopedia entries stored with "mutated"/"spectral" show Household`);
    ok(X.stats.famSeen.spectral === 2 && X.stats.famSeen.mutated === 1, `${tag}: older statistic keys kept (no progress taken away)`);
  }
  ok(snap(S.monsters) === before && !/familyOf|realFam|"family"/.test(snap(S)), 'familyOf is derived: nothing is written to the save (format unchanged)');
  ok(snap(L.monsters.map(G.collectionKey)) === snap(S.monsters.map(G.collectionKey)), 'unique-capture slots unchanged by the family fix');
}

// 6. a save written by the build-18 code loads in the current code with real families and identical monsters
if (OLD) {
  const So = OLD.api.freshState(); So.level = 4; let n = 0;
  for (const [id, r, v] of [['x_baby_bottle', 'common', 'shiny'], ['book', 'rare', null], ['cutlery_spoon', 'epic', 'spectral'], ['teddy', 'common', 'mutated'], ['beetle', 'legendary', 'mutated'], ['mug', 'uncommon', 'spectral']]) {
    const m = OLD.api.createMonster(So, { obj: id, cat: G.OBJECTS[id].cat, rarity: r, variant: v, word: G.OBJECTS[id].name, photo: null, first: false, rng: seeded(++n) });
    m.id = 'b18_' + n; OLD.api.recordSighting(So, m); So.monsters.push(m);
  }
  OLD.api.saveState(So);
  const code = OLD.api.exportSave(So);
  const R = G.importSave(code);
  ok(R && snap(R.monsters.map(m => [m.fam, m.stats, m.abilities, m.dna, m.variant])) === snap(So.monsters.map(m => [m.fam, m.stats, m.abilities, m.dna, m.variant])), 'build-18 backup code: monsters (natures, stats, moves, look, variants) identical in the current code');
  const fams = R.monsters.map(G.familyOf);
  ok(snap(fams) === snap(['household', 'household', 'household', 'household', 'organic', 'food']), `build-18 monsters show real families: ${fams.join(', ')}`);
  ok(Object.values(R.dex).every(d => G.FAMILY_IDS.includes(G.familyOf(d))), 'build-18 encyclopedia entries all show real families');
}

// 7. statistics and family quests count real families from now on
{
  const S = G.freshState(); S.level = 6; S.items.trap = 9;
  G.recordSighting(S, sample['teddy|common|mutated']); G.recordSighting(S, sample['book|rare|spectral']); G.recordSighting(S, sample['beetle|common|null']);
  ok(snap(S.stats.famSeen) === snap({ household: 2, organic: 1 }), `sightings are counted by real family (${snap(S.stats.famSeen)})`);
  const m = sample['x_baby_bottle|common|shiny'], B = G.newBattle(S, m); B.enemy.hp = 1; G.attemptCapture(B, S, () => 0);
  if (B.result === 'captured') G.finishBattle(S, B, seeded(1));
  ok(B.result === 'captured' && S.stats.capByFam.household === 1 && !S.stats.capByFam.mutated, 'a captured Prismatic baby bottle counts for "Household Pest Control", not as Mutated');
}

console.log(errors.length ? `\n${errors.length} FAILED` : '\nALL FAMILY/VARIANT CHECKS PASSED');
process.exit(errors.length ? 1 : 0);
