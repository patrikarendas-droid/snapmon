// Gameplay-only regression baseline: everything that decides how the game PLAYS, with every display text removed
// (monster names, move names, lore, labels, messages). It must stay identical when only wording changes, e.g. curated
// lore/move names or stable ability keys. Recorded 2026-10-31 on v0.4.5 + Phase 1 (before ability keys).
// Covers: (1) rule tables (rarities, families, move numbers, categories' signature numbers, weapons, items, charms,
// MECH, status durations, test-mode odds); (2) every object × rarity × variant: level, family, stats, each move's
// power/hits/effect/chance/self/cooldown/ultimate/legend flags, DNA and the rendered sprite + palette; (3) recognition
// label → object mapping for the vocabulary, ImageNet and COCO labels; (4) encounter odds over many fixed-seed photos;
// (5) fixed-seed battles over a wide sample of objects (cooldown behaviour: which move is used on which turn, by its
// position, damage, statuses, captures, rewards). Display names never enter the hash.
// If gameplay is changed ON PURPOSE, run with "record" and say so in the commit and the journal.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const FIX = path.join(__dirname, 'fixtures/gameplay-baseline.json');
const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape, localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } } };
vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') +
  ';globalThis.T={RARITIES,FAMILIES,MOVE_ARCH,MOVE_KITS,CATEGORIES,WEAPONS,ITEMS,CHARMS,MECH,STATUS_TURNS,TEST_RARITY_WEIGHTS,OBJECTS,objectForLabel,createMonster,freshState,makeDNA,buildGrid,buildPalette,resolvePhoto,newBattle,heroTurnStart,heroStrike,enemyTurn,attemptCapture,captureChance,attemptFlee,useItem,finishBattle,hunterStats,setRNG:f=>{RNG=f}}', ctx);
const T = ctx.T;
const parts = {}, H = () => crypto.createHash('sha256'), dig = h => h.digest('hex');
const mech = a => [a.power, a.hits || 0, a.effect || '', a.chance || 0, !!a.self, a.cd, !!a.ultimate, !!a.legend];
let seed; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// 1. rule tables (numbers only)
{
  const h = H();
  h.update(JSON.stringify(T.RARITIES)); h.update(JSON.stringify(T.MECH)); h.update(JSON.stringify(T.STATUS_TURNS)); h.update(JSON.stringify(T.TEST_RARITY_WEIGHTS));
  h.update(JSON.stringify(Object.entries(T.FAMILIES).map(([k, f]) => [k, f.hp, f.atk, f.def, f.spd, f.weak, f.resist, f.mat, f.abilities.map(a => mech({ ...a, cd: 0 }))])));
  h.update(JSON.stringify(T.MOVE_ARCH)); h.update(JSON.stringify(Object.entries(T.MOVE_KITS).map(([k, v]) => [k, v.split(',').map(x => x.split(':')[1].trim())])));
  h.update(JSON.stringify(T.CATEGORIES.map(c => [c.id, c.fam, mech({ ...c.sig, cd: 0 })])));
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (['name', 'desc', 'icon', 'text', 'flavor'].includes(k) ? undefined : v)));
  h.update(JSON.stringify(strip(T.WEAPONS))); h.update(JSON.stringify(strip(T.ITEMS))); h.update(JSON.stringify(strip(T.CHARMS)));
  parts.rules = dig(h);
}
// 2. every object × rarity × variant: generated gameplay data and artwork
{
  const h = H(), hs = H(); let n = 0;
  T.setRNG(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; });
  for (const id of Object.keys(T.OBJECTS).sort()) for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary']) for (const variant of [null, 'spectral', 'mutated', 'shiny']) {
    seed = n++ * 2654435761 >>> 0;
    const S = T.freshState(); S.level = 1 + n % 12;
    const m = T.createMonster(S, { obj: id, rarity: r, variant, photo: n % 2 ? { hue: (n * 37) % 360, sat: 0.6, lit: 0.5 } : null });
    h.update(JSON.stringify([id, r, variant, m.level, m.fam, m.stats, m.abilities.map(mech), m.dna, m.species]));
    if (variant === null || variant === 'shiny') { const g = T.buildGrid(m.dna); hs.update(g.px.join(',')); hs.update(JSON.stringify(T.buildPalette(m.dna))); }
  }
  parts.monsters = dig(h); parts.sprites = dig(hs); parts.monsterCount = n;
}
// 3. recognition label → object mapping
{
  const h = H(), vocab = JSON.parse(fs.readFileSync(path.join(__dirname, '../lab/vocab-labels.json'), 'utf8'));
  const im = JSON.parse(fs.readFileSync(path.join(__dirname, '../tools/data/imagenet-classes.json'), 'utf8')), coco = JSON.parse(fs.readFileSync(path.join(__dirname, '../tools/data/coco-classes.json'), 'utf8'));
  const labels = [...vocab.map(x => x.l), ...(Array.isArray(im) ? im : Object.values(im)), ...(Array.isArray(coco) ? coco : Object.values(coco))].map(String);
  for (const l of labels) h.update(l + '→' + T.objectForLabel(l) + '\n');
  h.update(JSON.stringify(vocab)); parts.recognition = dig(h); parts.labels = labels.length;
}
// 4. encounter odds: fixed-seed photos of many objects
{
  const h = H(); seed = 777; T.setRNG(rng); const ids = Object.keys(T.OBJECTS).sort();
  for (let g = 0; g < 60; g++) {
    const S = T.freshState(); S.level = 1 + g % 12; S.research = g % 3 ? { lens1: 1, capture1: 1, sensor: 1, lens2: 1, legend: 1 } : {};
    for (let k = 0; k < 40; k++) {
      const id = ids[(g * 131 + k * 17) % ids.length];
      const r = T.resolvePhoto(S, id, { hue: k * 9 % 360, sat: .5, lit: .5, hash: (seed >>> 0).toString(16).padStart(16, '0') }, { label: 'x', conf: .5 + (k % 5) / 10 }, rng);
      h.update(JSON.stringify(r.encounter ? [id, r.monster.rarity, r.monster.level, r.monster.variant, r.monster.fam, r.monster.stats, r.monster.abilities.map(mech)] : [id, 'none', r.reason || '']));
    }
  }
  parts.encounters = dig(h);
}
// 5. fixed-seed battles over a wide sample of objects (move use reported by position, never by name)
{
  const h = H(); seed = 4242; T.setRNG(rng); const ids = Object.keys(T.OBJECTS).sort();
  const sample = ids.filter((_, i) => i % 9 === 0).concat(['bee', 'x_pin_cushion', 'x_energy_drink', 'padlock', 'cutlery_spoon', 'apple', 'forklift']);
  const clean = (ev, m) => JSON.parse(JSON.stringify(ev, (k, v) => (k === 'msg' ? undefined : k === 'name' && typeof v === 'string' ? (v === 'Attack' || v === 'Flee' ? v : m.abilities.findIndex(a => a.name === v)) : v)));
  let battles = 0;
  for (const id of sample) for (const r of ['common', 'rare', 'epic', 'legendary']) {
    const S = T.freshState(); S.level = 6; S.hp = T.hunterStats(S).maxHp; S.items = { potion: 3, greater: 1, strength: 1, defense: 1, antidote: 2, enhancer: 1, trap: 4, smoke: 1 };
    const m = T.createMonster(S, { obj: id, rarity: r }); const B = T.newBattle(S, m); battles++;
    for (let t = 0; t < 30 && !B.over; t++) {
      const st = T.heroTurnStart(B); h.update(JSON.stringify(clean(st.ev, m)));
      if (B.over) break;
      if (!st.skip) {
        const a = rng();
        if (a < 0.12 && S.items.trap) { h.update(JSON.stringify(clean(T.attemptCapture(B, S, rng).ev, m))); h.update(T.captureChance(S, B).toFixed(6)); }
        else if (a < 0.17) h.update(JSON.stringify(clean(T.useItem(B, S, ['strength', 'defense', 'antidote', 'potion'][t % 4]).ev, m)));
        else h.update(JSON.stringify(clean(T.heroStrike(B, S, B.hero.energy >= 60, rng), m)));
      }
      if (!B.over) h.update(JSON.stringify(clean(T.enemyTurn(B, rng), m)));
      h.update(JSON.stringify(B.enemy.status) + B.enemy.hp + '/' + B.hero.hp);
    }
    const sum = T.finishBattle(S, B, rng); h.update(JSON.stringify([sum.result, sum.rewards, sum.drops, S.coins, S.hp, S.xp, S.level]));
  }
  parts.battles = dig(h); parts.battleCount = battles;
}
if (process.argv[2] === 'record') { fs.writeFileSync(FIX, JSON.stringify(parts, null, 1)); console.log('recorded', JSON.stringify(parts)); process.exit(0); }
const want = JSON.parse(fs.readFileSync(FIX, 'utf8')), diff = Object.keys(want).filter(k => want[k] !== parts[k]);
if (!diff.length) { console.log(`ok: gameplay unchanged — rules, ${parts.monsterCount} monsters (stats, moves, DNA, sprites), ${parts.labels} recognition labels, encounter odds, ${parts.battleCount} battles`); process.exit(0); }
console.log('FAIL: gameplay changed in: ' + diff.join(', ')); process.exit(1);
