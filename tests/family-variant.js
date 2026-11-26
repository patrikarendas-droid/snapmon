// Combat model 2 (2026-11-26): families decide combat; Spectral, Mutated and Prismatic are VARIANTS layered on top.
//   1. taxonomy: exactly six families; no variant is a family; every category and object has a real family
//   2. every registry object × 5 rarities × 4 variants (46,160 monsters): the stored family = the object's family =
//      the shown family; it drives the battle's weaknesses; the monster carries the current combat-model stamp
//   3. the variant layer, checked against the Normal form of the same monster: exact stat modifiers, the same
//      family weaknesses/resistances, the same moves plus exactly the variant move (none for Prismatic)
//   4. nothing unintended changed: every Normal and Prismatic monster of the objects OUTSIDE the eight re-familied
//      categories is identical to build 19 (git 17bb241): family, stats, moves, DNA
//   5. rewards: family material from the family, the variant bonus on top and reported separately; release
//   6. saves: monsters made by build 19 (stored 'spectral'/'mutated' families, old stats) are rebuilt on load and on
//      backup-code import to exactly the current model (same object, rarity, variant, level, seed), keeping look,
//      name, flavour text, level, XP, id, nickname; idempotent; encyclopedia and statistics hold only real families;
//      no mixed old/new monsters after any load path
// Usage: node tests/family-variant.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const G = require('./load')();
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'], VAR = [null, 'spectral', 'mutated', 'shiny'];
const EIGHT = { book: 'household', cloth: 'organic', mirror: 'household', clock: 'mechanical', instrument: 'household', toy: 'household', trash: 'household', bug: 'organic' };
const ELS = ['slash', 'ballistic', 'arcane', 'shock', 'toxic'];
const seeded = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
const snap = x => JSON.stringify(x);
const mech = a => [a.power, a.hits || 0, a.effect || '', a.chance || 0, !!a.self, a.cd, !!a.ultimate, !!a.legend, !!a.variant];
const mk = (A, id, r, v, n) => A.createMonster(A.freshState(), { obj: id, cat: A.OBJECTS[id].cat, rarity: r, variant: v, word: A.OBJECTS[id].name, photo: null, first: false, rng: seeded(n) });

// 1. taxonomy
ok(snap(Object.keys(G.FAMILIES)) === snap(G.FAMILY_IDS) && G.FAMILY_IDS.length === 6, `exactly six families: ${G.FAMILY_IDS.join(', ')}`);
ok(!G.FAMILIES.spectral && !G.FAMILIES.mutated && !G.FAMILIES.shiny && snap(Object.keys(G.VARIANTS)) === snap(['spectral', 'mutated', 'shiny']), 'Spectral, Mutated and Prismatic are variants only (no family tables of their own)');
ok(G.CATEGORIES.every(c => c.id === 'other' ? !c.fam : G.FAMILY_IDS.includes(c.fam)), 'every category has a real family');
ok(Object.entries(EIGHT).every(([c, f]) => G.CATEGORIES.find(x => x.id === c).fam === f), 'books, mirrors, instruments, toys, trash → Household; clocks → Mechanical; clothing, bugs → Organic');

// 2. every object × rarity × variant
const ids = Object.keys(G.OBJECTS), bad = [], perFam = {};
const sample = {};
let n = 0;
for (const id of ids) {
  const fam = G.objectFamily(id); perFam[fam] = (perFam[fam] || 0) + 1;
  for (const r of RAR) for (const v of VAR) {
    const m = mk(G, id, r, v, ++n); sample[`${id}|${r}|${v}`] = m;
    const B = G.newBattle(G.freshState(), m);
    if (m.fam !== fam || G.familyOf(m) !== fam || !G.FAMILY_IDS.includes(fam) || B.enemy.fam !== fam || m.cv !== G.COMBAT_MODEL) bad.push(`${id}/${r}/${v}: ${m.fam}/${G.familyOf(m)}/${B.enemy.fam}`);
  }
}
ok(n === ids.length * 20 && !bad.length, `${n} monsters (all ${ids.length} objects × 5 rarities × 4 variants): stored family = object family = shown family = battle family, model ${G.COMBAT_MODEL}${bad.length ? ' — ' + bad.slice(0, 4) : ''}`);
ok(Object.keys(perFam).every(f => G.FAMILY_IDS.includes(f)), `families of the registry: ${Object.entries(perFam).map(([f, k]) => f + ' ' + k).join(', ')}`);
{
  const bb = sample['x_baby_bottle|common|shiny'];
  ok(bb.fam === 'household' && G.familyOf(bb) === 'household' && ELS.every(e => G.effMult('household', e) === G.effMult(bb.fam, e)), "owner's case: the Prismatic Common baby bottle IS a Household monster (stats and weaknesses)");
  const eightBad = ids.filter(id => EIGHT[G.OBJECTS[id].cat] && !G.OBJECTS[id].fam && sample[`${id}|rare|null`].fam !== EIGHT[G.OBJECTS[id].cat]);
  ok(!eightBad.length, `all objects of the eight categories fight with their category's real family (${ids.filter(id => EIGHT[G.OBJECTS[id].cat]).length} objects)`);
}

// 3. the variant layer on top of the Normal form (same object, rarity, level, seed)
{
  const statBad = [], weakBad = [], moveBad = [];
  let k = 0;
  for (const id of ids) for (const r of RAR) {
    k++;
    const base = mk(G, id, r, null, 900000 + k);
    for (const v of ['spectral', 'mutated', 'shiny']) {
      const m = mk(G, id, r, v, 900000 + k), vs = G.VARIANTS[v].stats;
      const want = Object.fromEntries(Object.entries(base.stats).map(([s, x]) => [s, vs[s] !== 1 ? Math.round(x * vs[s]) : x]));
      if (m.level !== base.level || snap(m.stats) !== snap(want)) statBad.push(`${id}/${r}/${v}`);
      if (m.fam !== base.fam) weakBad.push(`${id}/${r}/${v}`);
      const extra = m.abilities.filter(a => a.variant), rest = m.abilities.filter(a => !a.variant);
      const vm = G.VARIANTS[v].move;
      if (snap(rest.map(mech)) !== snap(base.abilities.map(mech)) || extra.length !== (vm ? 1 : 0) || (vm && (extra[0].power !== vm.power || extra[0].effect !== vm.effect || extra[0].key !== 'variant'))) moveBad.push(`${id}/${r}/${v}`);
    }
  }
  ok(!statBad.length, `variant stats = the Normal form × the variant's modifiers (Spectral HP −8% ATK +5% SPD +15%; Mutated HP +8% ATK +12% DEF −5%; Prismatic +8% all)${statBad.length ? ' — ' + statBad.slice(0, 4) : ''}`);
  ok(!weakBad.length, 'every variant keeps its family, so its weaknesses and resistances are exactly the Normal form\'s');
  ok(!moveBad.length, `variant moves = the Normal form's moves + exactly one variant move (Spectral: Soul Siphon, Mutated: Acid Spew, Prismatic: none)${moveBad.length ? ' — ' + moveBad.slice(0, 4) : ''}`);
  const leg = sample['x_baby_bottle|legendary|spectral'].abilities.map(a => a.key);
  ok(leg.indexOf('variant') < leg.indexOf('legend') && leg.indexOf('legend') < leg.indexOf('ultimate'), `the variant move sits before a Legendary's legend move and Ultimate (${leg.join(', ')})`);
}

// 4. vs build 19: nothing unintended changed
const REF = '17bb241';
const hasRef = (() => { try { execSync(`git cat-file -e ${REF}^{commit}`, { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
ok(hasRef, `build 19 code (${REF}) is in the git history (CI: fetch-depth 0)`);
let OLD = null;
if (hasRef) {
  const FILES = ['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'combatlog.js', 'curated.js', 'curated-data.js'];
  const store = {};
  const ctx = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, escape, unescape, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  vm.createContext(ctx);
  vm.runInContext(FILES.map(f => execSync(`git show ${REF}:src/${f}`, { maxBuffer: 64 << 20 }).toString()).join('\n') + ';globalThis.__api={OBJECTS,createMonster,freshState,saveState,exportSave,recordSighting,newBattle,finishBattle,SAVE_KEY,setRNG:f=>{RNG=f}}', ctx);
  OLD = { api: ctx.__api, store };
  const diff = []; let cmp = 0, k = 0;
  for (const id of ids) for (const r of RAR) for (const v of [null, 'shiny']) {
    k++;
    if (EIGHT[G.OBJECTS[id].cat] && !G.OBJECTS[id].fam) continue; // re-familied on purpose
    const a = mk(OLD.api, id, r, v, 700000 + k), b = mk(G, id, r, v, 700000 + k); cmp++;
    if (snap([a.fam, a.level, a.stats, a.abilities.map(mech), a.dna, a.name]) !== snap([b.fam, b.level, b.stats, b.abilities.map(mech), b.dna, b.name])) diff.push(`${id}/${r}/${v}`);
  }
  ok(cmp > 19000 && !diff.length, `${cmp} Normal and Prismatic monsters of every other object are identical to build 19 (family, level, stats, move numbers, look, name)${diff.length ? ' — differ: ' + diff.slice(0, 5) : ''}`);
}

// 5. rewards: family material + separate variant bonus
{
  const fight = (m, caught, seed) => {
    const S = G.freshState(); S.level = 6; const before = { ...S.mats, coins: S.coins };
    G.recordSighting(S, m); const B = G.newBattle(S, m); B.over = true; B.result = caught ? 'captured' : 'victory';
    const sum = G.finishBattle(S, B, seeded(seed));
    return { sum, got: Object.fromEntries(['scrap', 'goo', 'ecto', 'prism', 'coins'].map(x => [x, (x === 'coins' ? S.coins : S.mats[x] || 0) - (before[x] || 0)])) };
  };
  const matOf = { household: 'scrap', mechanical: 'scrap', organic: 'goo', food: 'goo', botanical: 'goo', elemental: 'ecto' };
  ok(G.FAMILY_IDS.every(f => G.FAMILIES[f].mat === matOf[f]), 'family materials: Household/Mechanical → Scrap, Organic/Food/Botanical → Goo, Elemental → Ectoplasm');
  for (const [key, v, extra] of [['book|rare|spectral', 'spectral', { ecto: 2 }], ['teddy|rare|mutated', 'mutated', { goo: 3 }], ['x_baby_bottle|common|shiny', 'shiny', { prism: 1 }]]) {
    const m = sample[key], base = sample[key.replace(/\|[a-z]+$/, '|null')];
    const a = fight(m, false, 5), b = fight({ ...base, variant: null }, false, 5);
    const famMat = G.FAMILIES[m.fam].mat;
    const okBonus = Object.entries(extra).every(([x, n]) => a.got[x] - b.got[x] === n) && snap(a.sum.variantBonus) === snap(extra);
    ok(okBonus && a.got[famMat] >= b.got[famMat], `${key}: family material ${famMat} as for its Normal form, plus the ${G.variantLabel(v)} bonus ${snap(extra)} reported separately`);
  }
  const sh = fight(mk(G, 'mug', 'rare', 'shiny', 77), false, 9), no = fight(mk(G, 'mug', 'rare', null, 77), false, 9);
  const coins = x => (x.sum.rewards.find(r => r.k === 'coins') || {}).v;
  ok(coins(sh) === coins(no) * 2, `Prismatic: double battle coins (${coins(no)} → ${coins(sh)})`);
  const S = G.freshState(); const m = { ...sample['book|epic|spectral'], id: 'r1' }; S.monsters.push(m);
  const rel = G.releaseMonster(S, 'r1');
  ok(rel && rel.scrap > 0 && !rel.ecto, 'releasing a Spectral book returns its family material (Scrap), not Ectoplasm');
}

// 6. saves: build-19 monsters are rebuilt to the current model, nothing else changes
if (OLD) {
  const A = OLD.api; A.setRNG(seeded(31));
  const So = A.freshState(); So.level = 7; So.coins = 4321; So.items.trap = 13; So.research = { spectral: 1, mutagen: 1, chroma: 1 };
  const kinds = [['x_baby_bottle', 'common', 'shiny'], ['book', 'rare', null], ['cutlery_spoon', 'epic', 'spectral'], ['teddy', 'common', 'mutated'], ['beetle', 'legendary', 'mutated'], ['mug', 'uncommon', 'spectral'], ['mug', 'rare', null], ['clock', 'legendary', 'spectral']];
  kinds.forEach(([id, r, v], i) => { const m = A.createMonster(So, { obj: id, cat: G.OBJECTS[id].cat, rarity: r, variant: v, word: G.OBJECTS[id].name }); m.id = 'old' + i; m.xp = 3 * i; m.caughtAt = 1e12 + i; A.recordSighting(So, m); So.monsters.push(m); });
  So.monsters[1].nick = 'Old nickname'; So.companion = 'old2';
  So.stats.famSeen = { spectral: 3, mutated: 2, food: 1 }; So.stats.capByFam = { mutated: 1, household: 1 };
  const oldMons = JSON.parse(snap(So.monsters));
  ok(oldMons.some(m => m.fam === 'spectral') && oldMons.some(m => m.fam === 'mutated'), 'build-19 save holds monsters with stored "spectral"/"mutated" families');
  const check = (X, tag) => {
    const wrong = [];
    X.monsters.forEach((m, i) => {
      const o = oldMons[i], fam = G.objectFamily(o.obj), fresh = mk(G, o.obj, o.rarity, o.variant || null, 1);
      const stats = G.monsterStats(o.rarity, fam, o.level, o.seed, o.variant || null);
      if (m.fam !== fam || m.cv !== G.COMBAT_MODEL || snap(m.stats) !== snap(stats) || snap(m.abilities.map(mech)) !== snap(fresh.abilities.map(mech)) || snap(m.abilities.map(a => a.key)) !== snap(fresh.abilities.map(a => a.key))) wrong.push(`${o.obj}: combat`);
      if (snap(m.dna) !== snap(o.dna) || m.level !== o.level || m.xp !== o.xp || m.id !== o.id || m.seed !== o.seed || m.variant !== o.variant || m.rarity !== o.rarity || m.lore !== o.lore || m.caughtAt !== o.caughtAt || m.nick !== o.nick) wrong.push(`${o.obj}: kept fields`);
    });
    ok(X.monsters.length === oldMons.length && !wrong.length, `${tag}: all ${oldMons.length} build-19 monsters rebuilt to model ${G.COMBAT_MODEL} (family, stats, moves) with look, level, XP, id, name/flavour, nickname kept${wrong.length ? ' — ' + wrong.slice(0, 4) : ''}`);
    ok(X.monsters.every(m => m.cv === G.COMBAT_MODEL && G.FAMILY_IDS.includes(m.fam)), `${tag}: no old-model monster left (no mix)`);
    ok(Object.values(X.dex).every(d => G.FAMILY_IDS.includes(d.fam)) && Object.keys(X.stats.famSeen).every(k => G.FAMILY_IDS.includes(k)) && Object.keys(X.stats.capByFam).every(k => G.FAMILY_IDS.includes(k)), `${tag}: encyclopedia and statistics hold only real families (legacy "spectral"/"mutated" keys dropped)`);
    ok(X.coins === 4321 && X.items.trap === 13 && X.level === 7 && X.companion === 'old2' && X.research.chroma === 1, `${tag}: hunter, coins, items, research and buddy kept`);
  };
  const L = G.migrate(JSON.parse(snap(So)));
  check(L, 'load (migrate)');
  const again = G.migrate(JSON.parse(snap(L)));
  ok(snap(again.monsters) === snap(L.monsters), 'the rebuild is idempotent: loading the rebuilt save again changes nothing');
  check(G.importSave(A.exportSave(So)), 'build-19 backup code import');
  A.saveState(So); G.setRNG(Math.random);
  // loadState in the current code with the build-19 save in storage
  const store = {}; const ctx2 = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, escape, unescape, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  vm.createContext(ctx2);
  vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'combatlog.js', 'curated.js', 'curated-data.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + ';globalThis.__api={loadState,SAVE_KEY}', ctx2);
  Object.assign(store, OLD.store);
  check(ctx2.__api.loadState(), 'app start with the build-19 save in storage');
}

console.log(errors.length ? `\n${errors.length} FAILED` : '\nALL FAMILY/VARIANT (COMBAT MODEL 2) CHECKS PASSED');
process.exit(errors.length ? 1 : 0);
