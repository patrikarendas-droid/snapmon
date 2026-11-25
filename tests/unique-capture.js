// Unique collection slots (game.js collectionKey / ownedCopy / attemptCapture): the real collection holds at most ONE
// monster per canonical object id + rarity + variant (Normal = null, Spectral, Mutated, Prismatic = 'shiny'). Level, DNA,
// stats, photo and names do not matter; only monsters currently owned count. Duplicates still spawn and can be fought
// for the normal rewards; capturing one is refused before anything is consumed, rolled or changed. Test monsters
// (Quick Monster Test Mode) are outside the rule. Deterministic: seeded RNG.
// Usage: node tests/unique-capture.js
'use strict';
const G = require('./load')();
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const seeded = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
let rngCalls = 0, base = seeded(7);
const rng = () => { rngCalls++; return base(); };
G.setRNG(rng);
const veteran = () => { const S = G.freshState(); S.stats.photos = 9; S.stats.encounters = 4; S.level = 6; S.items.trap = 99; return S; };
const make = (S, obj, rarity, variant = null, word = obj) => G.createMonster(S, { obj, rarity, variant, word, rng });
// a capture that always succeeds when allowed: monster at 1 HP, roll 0
const tryCatch = (S, m) => { G.recordSighting(S, m); const B = G.newBattle(S, m); B.enemy.hp = 1; const r = G.attemptCapture(B, S, () => 0); if (B.result === 'captured') G.finishBattle(S, B, rng); return { B, r }; };
const own = (S, m) => { const { B } = tryCatch(S, m); return B.result === 'captured'; };
const snap = x => JSON.stringify(x);

// identity key: canonical object + rarity + variant; Normal (null/absent) and Prismatic ('shiny') mapped
{
  const S = veteran();
  const k = m => G.collectionKey(m);
  ok(k({ obj: 'mouse', rarity: 'common', variant: null }) === 'mouse|common|normal', 'Normal (null) → slot "normal"');
  ok(k({ obj: 'mouse', rarity: 'common' }) === k({ obj: 'mouse', rarity: 'common', variant: null }), 'absent variant = Normal');
  ok(k({ obj: 'mouse', rarity: 'common', variant: 'shiny' }) === 'mouse|common|shiny', 'Prismatic keeps its stored id "shiny"');
  const a = make(S, 'mouse', 'common'), b = make(S, 'mouse', 'common');
  ok(a.seed !== b.seed && snap(a.dna) !== snap(b.dna) && k(a) === k(b), 'two Normal Common mice with different seeds/DNA share one slot');
  ok(k({ ...a, name: 'Other name', label: 'computer mouse', level: 40, word: 'optical mouse' }) === k(a), 'name, detection label, level and word do not change the slot');
}

// 1. first capture allowed; a second of the same slot refused regardless of level and random details
{
  const S = veteran();
  const first = make(S, 'mouse', 'common');
  ok(own(S, first) && S.monsters.length === 1, '1: the first Normal Common mouse is captured');
  const dup = make(S, 'mouse', 'common'); dup.level = 30; dup.stats.hp = 999; dup.photo = { hue: 200, sat: .1, lit: .9 };
  ok(G.ownedCopy(S, dup) === S.monsters[0], '1: a higher-level duplicate with other DNA/photo is recognised as owned');
  const { B, r } = tryCatch(S, dup);
  ok(r.owned && !r.used && B.result !== 'captured' && S.monsters.length === 1, '1: the duplicate cannot be captured');
  ok(/Normal Common/.test(r.msg) && /Defeat it for rewards, or flee/.test(r.msg) && r.msg.includes(String(dup.name).split(',')[0]), `1: the refusal names the monster, rarity and variant ("${r.msg}")`);
  const low = make(S, 'mouse', 'common'); low.level = 1;
  ok(tryCatch(S, low).r.owned, '1: a lower-level duplicate is refused too');
}

// 2. the four variants of one object + rarity are separate slots, but no exact duplicate
{
  const S = veteran();
  for (const v of [null, 'spectral', 'mutated', 'shiny']) ok(own(S, make(S, 'mouse', 'common', v)), `2: Common mouse, variant ${v || 'normal'}: captured`);
  ok(S.monsters.length === 4, '2: four variants owned side by side');
  for (const v of [null, 'spectral', 'mutated', 'shiny']) {
    const { r } = tryCatch(S, make(S, 'mouse', 'common', v));
    ok(r.owned && S.monsters.length === 4, `2: a second ${v || 'normal'} Common mouse is refused`);
  }
  ok(/Prismatic/.test(tryCatch(S, make(S, 'mouse', 'common', 'shiny')).r.msg), '2: the message calls the shiny variant "Prismatic"');
  ok(/Spectral Common/.test(tryCatch(S, make(S, 'mouse', 'common', 'spectral')).r.msg), '2: …and Spectral "Spectral"');
}

// 3. a different rarity or a different canonical object is its own slot
{
  const S = veteran();
  own(S, make(S, 'mouse', 'common'));
  for (const r of ['uncommon', 'rare', 'epic', 'legendary']) ok(own(S, make(S, 'mouse', r)), `3: a Normal ${r} mouse is still collectible`);
  ok(own(S, make(S, 'mug', 'common')), '3: a Normal Common of another object (mug) is still collectible');
  ok(S.monsters.length === 6, '3: six different slots owned');
}

// 4. releasing frees exactly that slot; encyclopedia history never blocks
{
  const S = veteran();
  own(S, make(S, 'mouse', 'rare', 'mutated')); own(S, make(S, 'mouse', 'rare'));
  const id = S.monsters[0].id;
  ok(tryCatch(S, make(S, 'mouse', 'rare', 'mutated')).r.owned, '4: before release the Mutated Rare mouse is refused');
  G.releaseMonster(S, id);
  ok(S.monsters.length === 1 && S.dex['o:mouse'] && S.dex['o:mouse'].caught >= 2, '4: released (encyclopedia keeps its history)');
  ok(own(S, make(S, 'mouse', 'rare', 'mutated')), '4: after release the same slot can be captured again');
  ok(tryCatch(S, make(S, 'mouse', 'rare')).r.owned, '4: the other slot (Normal Rare) is still owned');
  // sightings / past captures without a current monster never block
  const S2 = veteran(); const seen = make(S2, 'lamp', 'epic'); G.recordSighting(S2, seen);
  S2.dex[seen.species].caught = 3;
  ok(!G.ownedCopy(S2, make(S2, 'lamp', 'epic')), '4: an encyclopedia entry with past captures but no owned monster does not block');
}

// 5. a duplicate still spawns and its defeat gives exactly the normal rewards
{
  const mk = () => { const S = veteran(); S.coins = 100; return S; };
  const Sown = mk(), Snew = mk();
  own(Sown, make(Sown, 'mouse', 'epic', 'shiny'));
  // align: both states identical apart from the owned monster
  const m = make(Snew, 'mouse', 'epic', 'shiny');
  const result = S => { const B = G.newBattle(S, JSON.parse(JSON.stringify(m))); B.enemy.hp = 0; B.over = true; B.result = 'victory'; base = seeded(99); const before = { coins: S.coins, xp: S.xp, mats: { ...S.mats }, items: { ...S.items } }; const sum = G.finishBattle(S, B, rng); return { sum, before }; };
  const a = result(Sown), b = result(Snew);
  ok(G.ownedCopy(Sown, m) && !G.ownedCopy(Snew, m), '5: one hunter owns the Prismatic Epic mouse, the other does not');
  ok(snap(a.sum.rewards) === snap(b.sum.rewards) && snap(a.sum.drops) === snap(b.sum.drops) && snap(a.sum.levelUps) === snap(b.sum.levelUps), `5: defeating an owned slot gives the same XP, coins, materials and drops (${a.sum.rewards.map(x => x.k + ' ' + x.v).join(', ')})`);
  ok(a.sum.result === 'victory' && Sown.stats.wins === Snew.stats.wins, '5: counted as a normal win');
  // spawning is unchanged: resolvePhoto still produces a monster of an owned slot
  const S = veteran(); own(S, make(S, 'mouse', 'common'));
  G.setClock(() => Date.UTC(2026, 10, 25, 12));
  const res = G.resolvePhoto(S, 'mouse', { hue: 1, sat: .5, lit: .5, hash: '0123456789abcdef' }, { label: 'mouse', conf: .9 }, () => 0);
  ok(res.encounter && res.monster && G.ownedCopy(S, res.monster), '5: an owned slot still spawns (encounter odds unchanged)');
}

// 6. the refused capture changes NOTHING: no trap, turn, roll, statistic or battle state
{
  const S = veteran(); own(S, make(S, 'toaster', 'uncommon'));
  S.items.trap = 3; S.research.capture2 = Date.now();
  const B = G.newBattle(S, make(S, 'toaster', 'uncommon'));
  B.enemy.hp = 1; B.enhancer = 0.25;
  const sBefore = snap(S), bBefore = snap(B); rngCalls = 0; let own6 = 0;
  const r = G.attemptCapture(B, S, () => { own6++; return 0; });
  ok(r.owned && !r.used && r.ev.length === 0, '6: refused with no battle events (no trap thrown, nothing in the log)');
  ok(own6 === 0 && rngCalls === 0, '6: no random number drawn (passed or global RNG)');
  ok(snap(S) === sBefore, '6: the save is unchanged (traps 3, captures, stats)');
  ok(snap(B) === bBefore && B.turn === 1 && B.captureFails === 0 && !B.over, '6: the battle is unchanged (turn, capture fails, result)');
  for (let i = 0; i < 10; i++) G.attemptCapture(B, S);
  ok(snap(S) === sBefore && snap(B) === bBefore && rngCalls === 0, '6: ten more taps change nothing either');
  S.items.trap = 0; ok(G.attemptCapture(B, S).owned, '6: with no traps left the reason given is still "already owned"');
  // a forced result cannot bypass the rule either
  B.over = true; B.result = 'captured'; const n = S.monsters.length; const sum = G.finishBattle(S, B, rng);
  ok(S.monsters.length === n && sum.result !== 'captured' && !sum.newCapture, '6: finishBattle never adds a second copy even if a battle claims "captured"');
}

// 7. survives save/load and backup-code restore; a normal save stays unchanged
{
  const S = veteran(); own(S, make(S, 'mouse', 'legendary', 'spectral')); own(S, make(S, 'mug', 'common'));
  S.hunterName = 'Alex';
  const json = snap(S);
  G.saveState(S); const L = G.loadState();
  ok(snap(L.monsters) === snap(S.monsters), '7: monsters identical after save + load');
  ok(G.ownedCopy(L, make(L, 'mouse', 'legendary', 'spectral')) && !G.ownedCopy(L, make(L, 'mouse', 'legendary')), '7: after load: owned slot refused, its Normal sibling free');
  const R = G.importSave(G.exportSave(S));
  ok(snap(R.monsters) === snap(S.monsters) && R.hunterName === 'Alex', '7: backup code restores the same monsters and settings');
  ok(G.ownedCopy(R, make(R, 'mug', 'common')) && !G.ownedCopy(R, make(R, 'mug', 'rare')), '7: after restore: owned slot refused, other rarity free');
  ok(snap(S) === json && !/collectionKey|ownedSlot|uniq/.test(json), '7: the rule stores nothing new in the save (format unchanged)');
}

// 8. developer test mode stays isolated
{
  const S = veteran(); own(S, make(S, 'mouse', 'common'));
  G.TestRoster.clear();
  const t = G.createTestMonster(S, 'mouse', null, { label: 'mouse' }, rng);
  t.rarity = 'common'; t.variant = null;
  ok(!G.ownedCopy(S, t), '8: a test monster of an owned slot is not treated as a duplicate');
  const B = G.newBattle(S, t); B.enemy.hp = 1; const r = G.attemptCapture(B, S, () => 0);
  ok(r.used && !r.owned && B.result === 'captured', '8: a test battle can still capture it (the test collection has its own rules)');
  G.TestRoster.add({ ...t }); G.TestRoster.add({ ...t, id: t.id + 'b', rarity: 'epic' });
  ok(!G.ownedCopy(S, make(S, 'mouse', 'epic')), '8: test-collection monsters never block a real capture');
  const S2 = veteran(); S2.monsters.push({ ...make(S2, 'mouse', 'rare'), test: true, id: 'test-x' });
  ok(!G.ownedCopy(S2, make(S2, 'mouse', 'rare')), '8: even a stray test monster in a real collection does not count');
  G.TestRoster.clear();
}

if (errors.length) { console.log(`\n${errors.length} UNIQUE-CAPTURE CHECK(S) FAILED`); process.exit(1); }
console.log('\nALL UNIQUE-CAPTURE CHECKS PASSED');
