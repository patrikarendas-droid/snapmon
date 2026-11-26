// Developer God Mode (2026-11-26), engine level: HP protection ONLY, in every real battle (camera hunts and custom
// encounters). On = DEV_TOOLS build + unlocked Developer & testing + S.settings.devGodMode === true, decided once per
// battle by newBattle. The hunter's HP never goes down (enemy hits, poison, burn), and no lower HP is saved at the end;
// everything else is exactly as normal: the same random numbers, enemy moves and statuses, energy costs, item and trap
// use, capture chances, the owned-slot rule and rewards. Release builds ignore it even with a forced flag. Replaces the
// retired test-battle God Mode (infinite items, free specials, guaranteed captures). Usage: node tests/god-mode.js
'use strict';
const load = require('./load');
const T = load(), R = load({ devTools: false });
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
let seed = 1; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
T.setRNG(rng); R.setRNG(rng);
const snap = x => JSON.stringify(x);
const hunter = (TT = T, god = true) => { const S = TT.freshState(); S.level = 3; S.hp = 50; S.items = { trap: 4, potion: 2, strength: 1, antidote: 1, enhancer: 1, smoke: 1 }; S.settings.devUnlocked = true; if (god) S.settings.devGodMode = true; return S; };
const mon = (TT, S, obj = 'apple', rarity = 'legendary') => TT.createMonster(S, { obj, rarity, rng });
// strip what God Mode is allowed to change from a list of events: the damage taken by the hunter
const neutral = evs => JSON.stringify(evs, (k, v) => (k === 'god' || k === 'blocked' ? undefined : v)).replace(/"dmg":\d+/g, '"dmg":_');

// 1. who can turn it on
{
  ok(!T.godModeOn(T.freshState()), 'off in a new save (default off)');
  const old = T.migrate({ ...T.freshState(), settings: { devUnlocked: true, godMode: true, quickTest: true, instantCapture: false } });
  ok(!T.godModeOn(old) && !T.newBattle(old, mon(T, old)).god, 'the retired test-battle switch (settings.godMode = true in an old save) does NOT turn on the new God Mode');
  const L = hunter(); L.settings.devUnlocked = false; ok(!T.godModeOn(L) && !T.newBattle(L, mon(T, L)).god, 'locked developer section: off even with the switch set');
  const S = hunter(R), B = R.newBattle(S, mon(R, S)); B.enemy.atk *= 30;
  ok(!R.godModeOn(S) && !B.god, 'release build (DEV_TOOLS false): never on, even with devUnlocked + devGodMode set');
  B.god = true; let lost = false; for (let i = 0; i < 40 && !B.over; i++) { const h = B.hero.hp; R.enemyTurn(B); if (B.hero.hp < h) lost = true; }
  ok(!R.godOn(B) && lost, 'release build: a forced battle flag is ignored by the engine and damage is taken normally');
}

// 2. HP never decreases: ×20 hits, poison and burn, many turns; the enemy still acts and applies statuses
{
  const S = hunter(), m = mon(T, S), B = T.newBattle(S, m); B.enemy.atk *= 20;
  ok(B.god && T.godOn(B), 'unlocked + switch on: this real battle has God Mode');
  const start = B.hero.hp; let drops = 0, blocked = 0, dots = 0, hits = 0, statuses = new Set(), acts = new Set();
  for (let t = 0; t < 150 && !B.over; t++) {
    let h = B.hero.hp; const st = T.heroTurnStart(B);
    for (const e of st.ev) if (e.t === 'dot' && e.who === 'hero') { dots++; if (e.god && e.dmg === 0 && e.blocked > 0) blocked++; }
    if (B.hero.hp < h) drops++;
    if (t % 4 === 0) { B.hero.status.poison = { t: 3 }; B.hero.status.burn = { t: 3 }; } // keep damaging statuses on the hunter
    h = B.hero.hp; const ev = T.enemyTurn(B);
    for (const e of ev) { if (e.t === 'hit' && e.who === 'hero') { hits++; if (e.god && e.dmg === 0 && e.blocked > 0) blocked++; } if (e.t === 'status' && e.who === 'hero') statuses.add(e.s); if (e.t === 'act') acts.add(e.name); }
    if (B.hero.hp < h) drops++;
  }
  ok(drops === 0 && B.hero.hp >= start && !B.over, `150 turns of ×20 hits + poison + burn: HP never dropped (${start} → ${B.hero.hp}), no defeat`);
  ok(hits > 60 && dots > 60 && blocked === hits + dots, `every enemy hit (${hits}) and damage tick (${dots}) is rolled and reported as blocked`);
  ok(acts.size >= 2 && m.abilities.some(a => acts.has(a.name)), `the enemy still acts with its own moves (${[...acts].join(', ')})`);
  ok(statuses.size >= 1, `statuses still land on the hunter (${[...statuses].join(', ')})`);
}

// 3. identical battle except the hunter's HP: same random numbers, events, enemy behaviour (God Mode on vs off)
{
  const run = god => { seed = 4242; const S = hunter(T, god); S.hp = 999; const m = mon(T, S, 'padlock', 'epic'); const B = T.newBattle(S, m); B.hero.hp = B.hero.maxHp = 5000; const out = []; // both hunters survive, so the streams are comparable
    for (let t = 0; t < 12 && !B.over; t++) { out.push(T.heroTurnStart(B).ev); if (B.over) break; out.push(T.heroStrike(B, S, t % 4 === 3)); if (!B.over) out.push(T.enemyTurn(B)); }
    return { ev: neutral(out), energy: B.hero.energy, enemy: B.enemy.hp, hp: B.hero.hp, seed }; };
  const a = run(true), b = run(false);
  ok(a.ev === b.ev && a.enemy === b.enemy && a.energy === b.energy && a.seed === b.seed, 'on vs off: identical events, enemy HP, energy and random-number use (only the hunter\'s damage differs)');
  ok(a.hp > b.hp, `…and only the hunter keeps their HP (${a.hp} vs ${b.hp})`);
}

// 4. no free specials, items, traps or captures
{
  const S = hunter(), B = T.newBattle(S, mon(T, S)); const W = T.WEAPONS[B.weapon];
  B.hero.energy = 100; T.heroStrike(B, S, true); ok(B.hero.energy === 100 - W.special.cost, `a special costs its normal ${W.special.cost} energy`);
  const p0 = S.items.potion; B.hero.hp = 1; T.useItem(B, S, 'potion'); ok(S.items.potion === p0 - 1, 'a potion is used up');
  S.items.strength = 0; ok(!T.useItem(B, S, 'strength').ok, 'an item you do not have cannot be used');
  const t0 = S.items.trap, ch = T.captureChance(S, B); T.attemptCapture(B, S, () => 0.9999);
  ok(S.items.trap === t0 - 1 && ch < 1 && B.result !== 'captured', `a Snap Trap is used and the normal capture chance applies (${Math.round(ch * 100)}%, a high roll fails)`);
  S.items.trap = 0; const r = T.attemptCapture(B, S, () => 0); ok(!r.used && B.result !== 'captured', 'with no Snap Traps there is no capture attempt');
  const cmp = god => { seed = 7; const S = hunter(T, god); S.items.trap = 6; const B = T.newBattle(S, mon(T, S, 'sock', 'rare')); const res = []; for (let i = 0; i < 6 && !B.over; i++) res.push(T.attemptCapture(B, S, rng).used + ':' + B.result); return snap([res, S.items]); };
  ok(cmp(true) === cmp(false), 'capture attempts and trap use are identical with God Mode on and off');
  const O = hunter(); O.items.trap = 3; const owned = mon(T, O, 'mug', 'rare'); O.monsters.push({ ...owned, id: 'm1' });
  const OB = T.newBattle(O, mon(T, O, 'mug', 'rare')); const orr = T.attemptCapture(OB, O, () => 0);
  ok(OB.god && orr.owned && !orr.used && O.items.trap === 3, 'the one-per-slot rule still refuses an owned slot (no trap used)');
}

// 5. the end of the battle never saves less HP, rewards are normal, max HP and monster stats untouched
{
  const S = hunter(), maxHp = T.hunterStats(S).maxHp, m = mon(T, S, 'book', 'rare'), stats = snap(m.stats);
  const B = T.newBattle(S, m); B.enemy.atk *= 20; for (let i = 0; i < 10; i++) { T.enemyTurn(B); T.heroTurnStart(B); }
  B.hero.hp = 1; // even if something lowered it
  T.attemptFlee(B, S, () => 0); T.finishBattle(S, B, rng);
  ok(B.result === 'fled' && S.hp === 50, `fled after 10 strong enemy turns: HP saved ${S.hp} (never lower than the 50 at the start)`);
  ok(T.hunterStats(S).maxHp === maxHp && snap(m.stats) === stats, 'maximum HP and the monster\'s stats are unchanged');
  const win = god => { seed = 31; const S = hunter(T, god); S.hp = 999; const m = mon(T, S, 'book', 'epic'); const B = T.newBattle(S, m); B.enemy.hp = 1; T.heroStrike(B, S, false, () => 0.5); const sum = T.finishBattle(S, B, rng); return snap([sum.result, sum.rewards, S.xp, S.coins, S.mats, S.items]); };
  ok(win(true) === win(false), 'victory rewards (XP, coins, materials, drops) are exactly the same with God Mode on');
}

// 6. switched off again: normal damage resumes in the next battle
{
  const S = hunter(); ok(T.newBattle(S, mon(T, S)).god, 'on');
  S.settings.devGodMode = false; const B = T.newBattle(S, mon(T, S)); B.enemy.atk *= 20;
  let lost = false; for (let i = 0; i < 30 && !B.over; i++) { const h = B.hero.hp; T.enemyTurn(B); if (B.hero.hp < h) lost = true; }
  ok(!B.god && !T.godOn(B) && lost, 'off: the next battle takes damage normally');
}

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL GOD MODE CHECKS PASSED');
process.exit(bad ? 1 : 0);
