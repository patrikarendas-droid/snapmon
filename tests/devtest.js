// Developer tools (2026-11-26), engine level: Custom encounter (devSpawnEncounter) and Give items (devGrantItem) act on
// the REAL save and refuse on their own in a release configuration (DEV_TOOLS = false, as tools/android/build-web.js
// packages it) or while the hidden Developer & testing section is locked. Spawned monsters are ordinary monsters: no
// test flag, normal sighting / battle / capture / rewards / collection / save. Replaces the retired Quick Monster Test
// Mode checks. God Mode: tests/god-mode.js. UI: tests/e2e-devtools.js. Usage: node tests/devtest.js
'use strict';
const load = require('./load');
const G = load(), R = load({ devTools: false });
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
let seed = 11; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
G.setRNG(rng);
const snap = x => JSON.stringify(x);
const dev = (T = G) => { const S = T.freshState(); S.stats.photos = 12; S.stats.encounters = 5; S.level = 7; S.settings.devUnlocked = true; return S; };

// 1. release configuration and locked tools: every action refuses and changes nothing
{
  ok(G.DEV_TOOLS === true && R.DEV_TOOLS === false, 'the test loads both configurations (debug: DEV_TOOLS true, release: false)');
  const S = dev(R), before = snap(S);
  const sp = R.devSpawnEncounter(S, 'mug', 'legendary', 'prismatic'), gr = R.devGrantItem(S, 'trap', 50);
  ok(!R.devToolsOn(S) && !sp.ok && !sp.monster && !gr.ok && snap(S) === before, 'release build: spawn and grant are refused even with devUnlocked set; the save is unchanged');
  const L = dev(); L.settings.devUnlocked = false; const lb = snap(L);
  ok(!G.devSpawnEncounter(L, 'mug', 'rare', 'normal').ok && !G.devGrantItem(L, 'trap', 5).ok && snap(L) === lb, 'debug build with the developer section still locked: refused, nothing changed');
  for (const v of [1, 'true', 'yes', {}]) { const X = dev(); X.settings.devUnlocked = v; if (G.devSpawnEncounter(X, 'mug', 'rare', 'normal').ok) ok(false, `devUnlocked=${JSON.stringify(v)} must not unlock`); }
  ok(true, 'only devUnlocked === true unlocks (1, "true", "yes", {} do not)');
}

// 2. validation: canonical object ids, five rarities, four variants (Normal = null, Prismatic = 'shiny')
{
  const S = dev();
  for (const bad of ['', ' mug', 'Mug', 'nope', '__proto__', 'constructor', 'toString', 'hasOwnProperty', null, undefined, 42, {}, ['mug']])
    if (G.devSpawnEncounter(S, bad, 'common', 'normal').ok) ok(false, `object ${JSON.stringify(bad)} must be refused`);
  ok(true, 'invalid object ids are refused (empty, padded, wrong case, unknown, prototype names, non-strings)');
  const cat = Object.keys(G.OBJECTS).length && ['kitchen', 'clothing', 'electronics', 'animal'].find(c => !G.OBJECTS[c]);
  ok(!cat || !G.devSpawnEncounter(S, cat, 'common', 'normal').ok, `a category id that is not a registry object ("${cat}") is not silently mapped to some object`);
  const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const got = RAR.map(r => G.devSpawnEncounter(S, 'x_light_switch', r, 'normal')).map(x => x.ok && x.monster.rarity);
  ok(snap(got) === snap(RAR), 'all five rarities spawn exactly as chosen');
  ok(['Common', 'mythic', '', null, 'shiny'].every(r => !G.devSpawnEncounter(S, 'mug', r, 'normal').ok), 'unknown rarities are refused');
  const V = { normal: null, spectral: 'spectral', mutated: 'mutated', prismatic: 'shiny' };
  const vs = Object.keys(V).map(v => { const x = G.devSpawnEncounter(S, 'mug', 'rare', v); return x.ok && x.monster.variant; });
  ok(snap(vs) === snap(Object.values(V)), 'variants: Normal → null (the normal stored value), Spectral, Mutated, Prismatic → "shiny"');
  ok(['shiny', 'Prismatic', '', null, 'gold'].every(v => !G.devSpawnEncounter(S, 'mug', 'rare', v).ok), 'unknown variant choices are refused');
  const p = G.devSpawnEncounter(S, 'mug', 'epic', 'prismatic').monster, n = G.devSpawnEncounter(S, 'mug', 'epic', 'normal').monster;
  ok(G.collectionKey(p) === 'mug|epic|shiny' && G.collectionKey(n) === 'mug|epic|normal', 'collection slots: mug|epic|shiny and mug|epic|normal');
  let n2 = 0; for (const id of Object.keys(G.OBJECTS)) { const x = G.devSpawnEncounter(S, id, 'legendary', 'spectral'); if (x.ok && x.monster.obj === id && x.monster.dna && G.buildGrid(x.monster.dna).px.length) n2++; }
  ok(n2 === Object.keys(G.OBJECTS).length, `every one of the ${n2} registry objects spawns as itself and renders a sprite`);
}

// 3. a spawned monster is an ordinary monster from the normal generator, with no photo and no test flag
{
  const S = dev(), before = snap(S);
  const r = G.devSpawnEncounter(S, 'x_security_camera', 'legendary', 'mutated', rng), m = r.monster;
  const cur = (G.CURATED.data.x_security_camera || {}).names || {};
  ok(r.ok && !('test' in m) && m.id === null && !/^test-/.test(String(m.id)) && m.obj === 'x_security_camera' && m.species === 'o:x_security_camera', 'not a test monster: no test flag, no test id, normal species key');
  ok(m.name === cur.legendary && typeof m.lore === 'string' && m.lore.length > 10 && m.abilities.every(a => a.key), `normal generator: curated name "${m.name}", lore, keyed moves`);
  ok(m.photo === null && m.dna && m.label === G.OBJECTS.x_security_camera.name, 'no photo: the generator\'s neutral colouring; label = the object name');
  ok(snap(S) === before, 'spawning alone changes nothing in the save (no lock, pity, photo count or roll state)');
}

// 4. the real flow: sighting → battle → capture with a real trap → collection → save/load and backup code
{
  const S = dev(); S.items.trap = 3; const xp0 = S.xp, cap0 = S.stats.captures;
  const m = G.devSpawnEncounter(S, 'apple', 'rare', 'spectral', rng).monster;
  const seen = G.recordSighting(S, m);
  ok(seen.isNew && S.dex['o:apple'] && S.dex['o:apple'].variants.spectral && S.stats.encounters === 6, 'recorded like a normal sighting (encyclopedia entry, variant, counters, research points)');
  const B = G.newBattle(S, m); B.enemy.hp = 1;
  const ch = G.captureChance(S, B), c = G.attemptCapture(B, S, () => 0);
  ok(c.used && !c.owned && S.items.trap === 2 && B.result === 'captured' && ch < 1, `ordinary capture: one Snap Trap used, normal chance (${Math.round(ch * 100)}%)`);
  const sum = G.finishBattle(S, B, rng);
  ok(S.monsters.length === 1 && /^m\d+$/.test(S.monsters[0].id) && !S.monsters[0].test && S.stats.captures === cap0 + 1 && S.xp + 0 !== xp0 - 1 && sum.rewards.some(x => x.k === 'xp'), 'captured into the real collection with a normal id, capture counted, XP rewarded');
  G.saveState(S); const L = G.loadState();
  ok(L.monsters.length === 1 && L.monsters[0].obj === 'apple' && L.monsters[0].variant === 'spectral' && !L.monsters[0].test, 'it persists across a reload, not marked as a test monster');
  const I = G.importSave(G.exportSave(S)); ok(I.monsters.length === 1 && I.monsters[0].id === S.monsters[0].id, 'and is in the backup code');
}

// 5. victory: the normal rewards (same code as any battle) — compare with an identical monster made by createMonster
{
  const fight = spawn => {
    seed = 99; const S = dev(); const m = spawn ? G.devSpawnEncounter(S, 'book', 'epic', 'normal', rng).monster : G.createMonster(S, { obj: 'book', cat: G.OBJECTS.book.cat, rarity: 'epic', variant: null, word: G.OBJECTS.book.name, photo: null, first: false, rng });
    G.recordSighting(S, m); const B = G.newBattle(S, m); B.enemy.hp = 1; G.heroStrike(B, S, false, () => 0.5); const sum = G.finishBattle(S, B, rng);
    return snap([sum.result, sum.rewards, S.xp, S.coins, S.mats, S.items, S.level]);
  };
  const a = fight(true), b = fight(false);
  ok(a === b && JSON.parse(a)[0] === 'victory' && JSON.parse(a)[1].length >= 3, 'a defeated custom encounter gives exactly the normal XP, coins and materials');
}

// 6. repeatable, no camera / recognition / cooldown manipulation, normal hunting unchanged
{
  const S = dev(); S.enc.disturbed = { mug: Date.now() + 3e6 }; S.enc.quiet = { book: Date.now() + 1e6 }; const enc0 = snap(S.enc), st0 = snap({ ...S.stats, encounters: 0, famSeen: 0, epicSeen: 0, legendSeen: 0, shinySeen: 0 });
  let n = 0; for (let i = 0; i < 25; i++) { const x = G.devSpawnEncounter(S, i % 2 ? 'mug' : 'book', 'legendary', 'prismatic'); if (x.ok) { n++; G.recordSighting(S, x.monster); } }
  ok(n === 25, 'the same (locked) objects can be spawned again and again');
  ok(snap(S.enc) === enc0, 'object locks, pity and recent-object state are untouched (not reset, not extended)');
  ok(snap({ ...S.stats, encounters: 0, famSeen: 0, epicSeen: 0, legendSeen: 0, shinySeen: 0 }) === st0, 'photo/scan statistics are untouched (only the sighting counters move)');
  const hunt = T => { T.setRNG(() => 0.3); T.setClock(() => 1.7e12); const H = T.freshState(); H.stats.photos = 4; H.stats.encounters = 2; const out = []; for (const o of ['mug', 'book', 'mug']) out.push(JSON.stringify(T.resolvePhoto(H, o, { hue: 1, sat: .5, lit: .5, hash: 'abcdabcdabcdabcd' }, { label: o }), (k, v) => k === 'seenAt' ? 0 : v)); return out.join('|') + snap(H.enc.quiet) + snap(Object.keys(H.enc.disturbed)); };
  ok(hunt(G) === hunt(R), 'a normal camera hunt behaves identically in the debug and the release configuration');
  G.setRNG(rng);
}

// 7. Give items: real bag, stacking, persistence, validation, limits
{
  const S = dev(); const t0 = S.items.trap, s0 = S.mats.scrap;
  ok(G.devGrantItem(S, 'trap', 10).ok && S.items.trap === t0 + 10 && G.devGrantItem(S, 'trap', '5').ok && S.items.trap === t0 + 15, `Snap Traps: ${t0} + 10 + "5" = ${S.items.trap} (stacks, numeric strings accepted)`);
  ok(G.devGrantItem(S, 'scrap', 7).ok && S.mats.scrap === s0 + 7 && !('scrap' in S.items), 'materials go to the material store');
  const grantable = G.devGrantable().map(g => g.id);
  ok(snap(grantable) === snap(['potion', 'greater', 'strength', 'defense', 'antidote', 'enhancer', 'trap', 'smoke', 'scrap', 'goo', 'ecto', 'prism']), `grantable: every bag item and crafting material (${grantable.length}), nothing invented`);
  ok(grantable.every(id => G.devGrantItem(S, id, 1).ok), 'every listed id can be granted');
  const b0 = snap(S);
  const badQ = [0, -1, 1.5, NaN, Infinity, 1000, 1e9, '0', '-3', '1.5', '1e3', '12abc', '', ' ', '1000', null, undefined, true, {}, [5], '0x10'];
  ok(badQ.every(q => !G.devGrantItem(S, 'trap', q).ok) && snap(S) === b0, 'bad quantities are refused (0, negative, fractions, NaN/Infinity, over 999, exponents, text, empty, non-numbers)');
  const badK = ['coins', 'xp', 'rp', 'sword', 'fang', '__proto__', 'constructor', 'Trap', '', null, 7];
  ok(badK.every(k => !G.devGrantItem(S, k, 1).ok) && snap(S) === b0, 'unknown keys are refused (coins, XP, research points, weapons, charms, prototype names, wrong case)');
  S.items.trap = G.DEV_GRANT_TOTAL - 9;
  ok(!G.devGrantItem(S, 'trap', 10).ok && S.items.trap === G.DEV_GRANT_TOTAL - 9 && G.devGrantItem(S, 'trap', 9).ok && S.items.trap === G.DEV_GRANT_TOTAL, `the total may not pass ${G.DEV_GRANT_TOTAL} (no overflow)`);
  S.items.potion = 'junk'; ok(G.devGrantItem(S, 'potion', 2).ok && S.items.potion === 2, 'a corrupt stored count is treated as 0');
  G.saveState(S); const L = G.loadState(); ok(L.items.trap === G.DEV_GRANT_TOTAL && L.mats.scrap === S.mats.scrap, 'grants persist across a reload');
  const prices = snap(Object.values(G.ITEMS).map(i => [i.price, i.craft]));
  ok(prices === snap(Object.values(load().ITEMS).map(i => [i.price, i.craft])), 'prices and crafting costs are unchanged');
}

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL DEVELOPER-TOOL CHECKS PASSED');
process.exit(bad ? 1 : 0);
