// Developer God Mode (test battles only): the engine part. It can only be switched on for a Quick Monster Test Mode
// monster in a build with DEV_TOOLS; in such a battle the hunter survives anything, specials need no energy, traps and
// items are unlimited and not used up, and a capture attempt always succeeds — while the monster fights exactly as
// normal. With it off (or in any normal battle) nothing changes (also guarded by tests/gameplay-baseline.js).
const fs = require('fs'), vm = require('vm'), path = require('path');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const load = (devTools = true) => {
  const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape, localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } } };
  vm.createContext(ctx);
  let src = ['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'curated.js', 'curated-data.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
  if (!devTools) { if (!/const DEV_TOOLS = true;/.test(src)) throw new Error('DEV_TOOLS line not found'); src = src.replace('const DEV_TOOLS = true;', 'const DEV_TOOLS = false;'); }
  vm.runInContext(src + ';globalThis.T={createMonster,createTestMonster,freshState,newBattle,enableGodMode,godOn,heroTurnStart,heroStrike,enemyTurn,attemptCapture,attemptFlee,useItem,captureChance,hunterStats,WEAPONS,BATTLE_ITEMS:typeof BATTLE_ITEMS!=="undefined"?BATTLE_ITEMS:["potion","greater","strength","defense","antidote","enhancer","smoke"],setRNG:f=>{RNG=f}}', ctx);
  return ctx.T;
};
const T = load();
let seed = 1; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
T.setRNG(rng);
const state = () => { const S = T.freshState(); S.level = 1; S.hp = 5; S.items = {}; return S; }; // weak hunter, empty bag
const testMon = (S, obj, rarity) => { const m = T.createMonster(S, { obj, rarity }); m.test = true; return m; };

// 1. it can only be switched on for a test monster, in a developer build
{
  const S = state(), real = T.createMonster(S, { obj: 'apple', rarity: 'legendary' }), B = T.newBattle(S, real);
  ok(T.enableGodMode(B) === false && !B.god && !T.godOn(B), 'cannot be enabled for a normal (non-test) monster');
  B.god = true; ok(!T.godOn(B), 'even a forced flag on a normal battle is ignored by the engine');
  const P = load(false), S2 = P.freshState(), m2 = P.createMonster(S2, { obj: 'apple', rarity: 'legendary' }); m2.test = true;
  const B2 = P.newBattle(S2, m2);
  ok(P.enableGodMode(B2) === false && !P.godOn(B2) && (B2.god = true) && !P.godOn(B2), 'a build with DEV_TOOLS=false can never activate it, even with a test monster and a forced flag');
}
// 2. a normal battle with a forced flag plays exactly like one without it (the engine ignores it)
{
  const run = force => { seed = 77; const S = state(); S.hp = 60; S.items = { trap: 2, potion: 1 }; const m = T.createMonster(S, { obj: 'padlock', rarity: 'epic' }); const B = T.newBattle(S, m); if (force) B.god = true; const out = [];
    for (let t = 0; t < 25 && !B.over; t++) { out.push(T.heroTurnStart(B).ev); if (B.over) break; out.push(t % 7 === 3 ? T.attemptCapture(B, S).ev : T.heroStrike(B, S, t % 5 === 4)); if (!B.over) out.push(T.enemyTurn(B)); }
    return JSON.stringify([out, B.result, B.hero.hp, S.items]); };
  ok(run(false) === run(true), 'normal battle: identical events, result, HP and items with or without a forced God flag');
}
// 3. God Mode test battles
const godBattle = (obj, rarity) => { const S = state(), m = testMon(S, obj, rarity), B = T.newBattle(S, m); ok(T.enableGodMode(B), `God Mode on for a test ${rarity} ${obj}`); return { S, m, B }; };
{
  const { S, B, m } = godBattle('apple', 'legendary'); B.enemy.atk *= 20; // a monster that would kill a level-1 hunter at once
  let minHp = Infinity, hits = 0, statuses = 0, names = new Set(), heals = 0, defeat = false;
  for (let t = 0; t < 120; t++) {
    const st = T.heroTurnStart(B); heals += st.ev.filter(e => e.t === 'heal' && e.god).length; if (B.over) { defeat = B.result === 'defeat'; break; }
    const ev = T.enemyTurn(B); for (const e of ev) { if (e.t === 'hit' && e.who === 'hero') hits++; if (e.t === 'status' && e.who === 'hero') statuses++; if (e.t === 'act') names.add(e.name); }
    minHp = Math.min(minHp, B.hero.hp); if (B.over) { defeat = B.result === 'defeat'; break; }
  }
  ok(!defeat && !B.over && minHp >= 1, `the hunter survives 120 turns of ×20-strength hits and damaging statuses (lowest HP ${minHp}, ${hits} hits, ${statuses} statuses on the hunter)`);
  ok(hits > 50 && heals > 10, 'enemy hits still land and are shown; HP is restored at the start of each of your turns');
  const curated = m.abilities.map(a => a.name);
  ok(curated.every(n => names.has(n)) && curated.includes('Apple-ocalypse'), `the monster still uses all its own moves, with their (Pilot 01) names: ${[...names].join(', ')}`);
  ok(JSON.stringify(S.items) === '{}', 'nothing was taken from the (empty) bag');
}
{
  const { S, B } = godBattle('forklift', 'epic'); B.hero.energy = 0;
  const ev = T.heroStrike(B, S, true);
  ok(ev.some(e => e.t === 'act' && e.special) && ev.some(e => e.t === 'hit' || e.t === 'miss') && B.hero.energy === 0, `special attack at 0 energy works and costs nothing (${T.WEAPONS[B.weapon].special.name})`);
  T.heroStrike(B, S, false); ok(B.hero.energy > 0, 'basic attacks still charge energy as usual');
}
{
  let caught = 0; const objs = ['apple', 'padlock', 'x_light_switch', 'book', 'sock', 'microwave', 'rubber_duck', 'forklift', 'x_energy_drink', 'x_security_camera'];
  for (const o of objs) { const { S, B } = godBattle(o, 'legendary'); const r = T.attemptCapture(B, S); if (r.used && B.over && B.result === 'captured' && !S.items.trap) caught++; }
  ok(caught === objs.length, `a capture attempt with 0 Snap Traps succeeds every time, even against Legendaries (${caught}/${objs.length}), and uses no trap`);
}
{
  const { S, B } = godBattle('book', 'rare'); const used = [];
  B.hero.hp = 3; // potions only work when hurt
  for (const id of ['potion', 'greater', 'strength', 'defense', 'antidote', 'enhancer']) { if (id === 'greater') B.hero.hp = 3; const r = T.useItem(B, S, id); if (r.ok && r.ev[0].t === 'act') used.push(id); }
  ok(used.length === 6 && Object.values(S.items).every(n => !n), `items work with an empty bag and are not used up: ${used.join(', ')}`);
  ok(B.hero.status.atkup && B.hero.status.defup && B.hero.status.immune && B.enhancer > 0, 'item effects still apply (ATK↑, DEF↑, immunity, capture amplifier)');
  const sm = T.useItem(B, S, 'smoke'); ok(sm.ok && B.over && B.result === 'fled', 'Smoke Bomb still ends the fight normally');
}
{
  const { S, B } = godBattle('sock', 'common'); let fled = false; for (let i = 0; i < 40 && !B.over; i++) { T.attemptFlee(B, S); fled = B.result === 'fled'; }
  ok(fled, 'fleeing still works');
  const g = godBattle('mug', 'common'); for (let i = 0; i < 60 && !g.B.over; i++) T.heroStrike(g.B, g.S, i % 3 === 0);
  ok(g.B.over && g.B.result === 'victory', 'the monster can still be defeated: the enemy is not invincible');
}
// 4. a test battle with God Mode OFF behaves exactly like before (no trap: no capture, energy needed, can lose)
{
  const S = state(), m = testMon(S, 'apple', 'legendary'), B = T.newBattle(S, m); B.hero.energy = 0;
  const cap = T.attemptCapture(B, S), it = T.useItem(B, S, 'strength'); T.heroStrike(B, S, true);
  ok(!cap.used && !it.ok && B.hero.energy === 0 && !T.godOn(B), 'test battle, God Mode off: empty bag blocks traps/items, specials still cost energy');
  const run = test => { seed = 5; const S = state(); S.hp = 40; S.items = { trap: 3 }; const mm = T.createMonster(S, { obj: 'book', rarity: 'epic' }); if (test) mm.test = true; const BB = T.newBattle(S, mm), out = [];
    for (let t = 0; t < 30 && !BB.over; t++) { out.push(T.heroTurnStart(BB).ev); if (BB.over) break; out.push(t % 6 === 2 ? T.attemptCapture(BB, S).ev : T.heroStrike(BB, S, false)); if (!BB.over) out.push(T.enemyTurn(BB)); }
    return JSON.stringify([out, BB.result, S.items]); };
  ok(run(true) === run(false), 'test battle with God Mode off plays exactly like a normal battle (same events, result, items)');
}

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL GOD MODE CHECKS PASSED');
process.exit(bad ? 1 : 0);
