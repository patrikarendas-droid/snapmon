// Combat log (src/combatlog.js) against the REAL battle engine: hundreds of fixed-seed battles with every weapon,
// items, charms, captures, flight and monster moves. The log must report exactly what the engine did:
//   • its HP replay equals the engine's HP after every single engine call (0 desyncs), and the per-call changes it
//     shows add up to the engine's real HP change (capped heals, overkill and God Mode included)
//   • one hit row per hit event (multi-hit attacks numbered), one dodge row per miss, one row per status / tick / expiry,
//     in the engine's order; capture, flee, item, stun-skip, victory/defeat/captured/fled/escaped rows
//   • damage element only where the rules have one (the hunter's weapon); monster moves show none; no water/bleed
//   • the player's hunter name everywhere (no "Hunter"/"You" once a name is set); every name and message escaped
// Usage: node tests/combat-log.js
'use strict';
const G = require('./load')();
const { CombatLog: CL } = G;
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
let seed = 99; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
G.setRNG(rng);
const WEAP = Object.keys(G.WEAPONS);
const seen = {}; const saw = k => { seen[k] = (seen[k] || 0) + 1; };
let calls = 0, desync = 0, countBad = [], elemBad = [], nameBad = [], sumBad = [];
const OBJS = ['mug', 'apple', 'dog', 'toilet', 'forklift', 'sneaker', 'lamp', 'clock', 'mouse', 'cactus', 'umbrella', 'bee'];
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function call(B, S, fn, before) {
  const hp0 = { hero: B.hero.hp, enemy: B.enemy.hp }, n0 = B.log.entries.length;
  const ev = fn(); calls++;
  CL.ingest(B, ev, before);
  if (B.log.desyncs) { desync += B.log.desyncs; B.log.desyncs = 0; }
  const rows = B.log.entries.slice(n0);
  // counts: hits, misses, statuses, ticks, expiries
  const c = k => ev.filter(e => e.t === k).length, r = k => rows.filter(e => e.kind === k).length;
  for (const [ek, rk] of [['hit', 'hit'], ['miss', 'miss'], ['status', 'status'], ['dot', 'dot'], ['expire', 'expire'], ['capture', 'capture'], ['end', 'end'], ['heal', 'heal']])
    if (c(ek) !== r(rk)) countBad.push(`${ek}: ${c(ek)} events vs ${r(rk)} rows`);
  // the shown changes add up to the engine's real HP change in this call
  for (const who of ['hero', 'enemy']) {
    const shown = rows.filter(e => e.who === who && typeof e.amount === 'number').reduce((a, e) => a + e.amount, 0);
    if (hp0[who] + shown !== B[who].hp) sumBad.push(`${who}: ${hp0[who]} + ${shown} ≠ ${B[who].hp}`);
  }
  // elements
  for (const e of rows.filter(x => x.kind === 'hit')) {
    if (e.by === 'hero' && e.el !== G.WEAPONS[B.weapon].el) elemBad.push('hero hit without its weapon element');
    if (e.by === 'enemy' && e.el) elemBad.push('monster move shown with an element: ' + e.el);
  }
  for (const e of ev) { saw('ev:' + e.t); if (e.t === 'hit' && e.crit) saw('crit'); if (e.t === 'status') saw('status:' + e.s); if (e.t === 'dot') saw('dot:' + e.s); if (e.t === 'text' && e.stun) saw('stunskip'); if (e.t === 'end') saw('end:' + e.result); if (e.t === 'capture') saw('capture:' + e.ok); }
  if (ev.filter(e => e.t === 'hit' || e.t === 'miss').length > 1) saw('multihit');
  if (rows.some(e => e.kind === 'heal' && e.parts.some(p => p.t && /capped/.test(p.t)))) saw('cappedheal');
  if (rows.some(e => e.kind === 'heal' && e.parts.some(p => p.t && /drains/.test(p.t)))) saw('drain');
  if (rows.some(e => e.kind === 'heal' && e.parts.some(p => p.t && /Vampire Fang/.test(p.t)))) saw('fang');
  if (rows.some(e => e.kind === 'hit' && e.parts.some(p => p.t && /hit for/.test(p.t)))) saw('overkill');
  return ev;
}

for (let g = 0; g < 420; g++) {
  const S = G.freshState();
  S.hunterName = g % 7 ? 'Alex' : 'Zoë "Q" O\'Neil'; // a name with quotes and an apostrophe too
  S.level = 1 + g % 12; S.weapons = { sword: 2, pistol: 1, dagger: 1, wand: 1, hammer: 1 }; S.equipped = WEAP[g % WEAP.length];
  S.items = { potion: 4, greater: 1, strength: 1, defense: 1, antidote: 2, enhancer: 1, trap: 4, smoke: g % 9 === 0 ? 1 : 0 };
  S.charmSlots = g % 3 === 0 ? ['fang', 'battery'] : ['slipper', 'lenscap']; S.research = g % 2 ? { capture2: 1, medic: 1, analysis: 1 } : {};
  S.hp = G.hunterStats(S).maxHp - (g % 5) * 7;
  if (g % 25 === 1) { S.settings.devUnlocked = true; S.settings.devGodMode = true; } // developer God Mode (HP protection) in a real battle
  const m = G.createMonster(S, { obj: OBJS[g % OBJS.length], rarity: RAR[(g * 3) % 5], word: 'x' });
  if (g % 13 === 0) m.name = 'Evil <img src=x onerror=alert(1)>, Lord of "Quotes"';
  const B = G.newBattle(S, m);
  CL.create(B, { god: !!B.god });
  for (let turn = 0; turn < 60 && !B.over; turn++) {
    if (turn > 0 || !B.enemyFirst) {
      const a = rng(), before = { heroEnergy: B.hero.energy };
      if (a < 0.1 && S.items.trap) call(B, S, () => G.attemptCapture(B, S, rng).ev, before);
      else if (a < 0.2) { const id = ['potion', 'strength', 'defense', 'antidote', 'enhancer', 'greater', 'smoke'][turn % 7]; call(B, S, () => { const r = G.useItem(B, S, id); if (r.ok) saw('item'); return r.ok ? r.ev : []; }, before); }
      else if (a < 0.24) call(B, S, () => G.attemptFlee(B, S, rng), before);
      else call(B, S, () => G.heroStrike(B, S, B.hero.energy >= G.WEAPONS[B.weapon].special.cost && a > 0.7, rng), before);
      if (B.over) break;
    }
    for (let k = 0; k < 6 && !B.over; k++) {
      call(B, S, () => G.enemyTurn(B, rng));
      if (B.over) break;
      let st; call(B, S, () => { st = G.heroTurnStart(B); return st.ev; });
      if (!st.skip) break;
    }
    CL.nextTurn(B);
  }
  // names and escaping
  // the Smoke Bomb's own engine line ("Poof! You vanish…") is the one existing second-person message; it is allowed
  const html = CL.html(B.log), txt = B.log.entries.map(e => CL.text(B.log, e)).join('\n');
  if (!txt.includes(S.hunterName) || /\bHunter\b(?! Sword)|\bYou\b/.test(txt.replace(S.hunterName, '').replace(/Poof! You vanish in a cloud of smoke\./g, ''))) nameBad.push(`battle ${g}: hunter name not used consistently`);
  if (/<img|<b>|"Q"/.test(html) || (m.name.includes('<img') && !html.includes('&lt;img'))) nameBad.push(`battle ${g}: unescaped markup`);
  // no invented element/status: every coloured effect is one the rules have (a move may still be NAMED e.g. "Water Store Siphon")
  for (const e of B.log.entries) for (const p of e.parts) if (p.fx && (!CL.FX[p.fx] || /water|bleed/i.test(p.fx + ' ' + (p.label || '')))) nameBad.push(`battle ${g}: invented effect ${p.fx}`);
  if (B.log.entries.some(e => e.kind === 'hit' && e.by === 'enemy' && /water/i.test(e.move || '') && e.el)) nameBad.push(`battle ${g}: water-named move shown with an element`);
  if (B.log.entries.some(e => e.kind === 'hit' && e.by === 'enemy' && /water/i.test(e.move || ''))) saw('waterNamedMoveNoElement');
  if (B.log.entries.length > CL.MAX) nameBad.push('log over its cap');
  saw('result:' + B.result);
}

ok(desync === 0, `HP replay equals the engine after every one of ${calls} engine calls (${desync} desyncs)`);
ok(!sumBad.length, `per-call HP changes shown add up to the engine's real HP change${sumBad.length ? ': ' + sumBad.slice(0, 3).join('; ') : ''}`);
ok(!countBad.length, `one row per hit / dodge / heal / status / tick / expiry / capture / end event, in order${countBad.length ? ': ' + countBad.slice(0, 3).join('; ') : ''}`);
ok(!elemBad.length, `hunter hits carry the weapon's element, monster moves carry none${elemBad.length ? ': ' + elemBad.slice(0, 3).join('; ') : ''}`);
ok(!nameBad.length, `the hunter name is used everywhere, names/messages are escaped, no invented element (a move named "Water…" shows none), cap respected${nameBad.length ? ': ' + nameBad.slice(0, 3).join('; ') : ''}`);
const need = ['crit', 'ev:miss', 'multihit', 'status:poison', 'status:burn', 'status:stun', 'status:defdown', 'status:atkup', 'status:defup', 'status:immune', 'dot:poison', 'dot:burn', 'ev:expire', 'stunskip',
  'cappedheal', 'drain', 'fang', 'waterNamedMoveNoElement', 'item', 'capture:true', 'capture:false', 'end:victory', 'end:defeat', 'end:captured', 'end:fled', 'overkill'];
const missing = need.filter(k => !seen[k]);
ok(!missing.length, `covered: ${need.map(k => k + '×' + (seen[k] || 0)).join(', ')}${missing.length ? ' — MISSING ' + missing.join(', ') : ''}`);

// a hand-checked example: the exact row for a hunter's shock hit and a poison tick, with colour + icon after the amount
{
  const S = G.freshState(); S.hunterName = 'Alex'; S.weapons.hammer = 1; S.equipped = 'hammer';
  const m = G.createMonster(S, { obj: 'mouse', rarity: 'common', word: 'mouse' });
  const B = G.newBattle(S, m); B.enemy.hp = B.enemy.maxHp = 999; CL.create(B);
  B.enemy.status.poison = { t: 2 };
  let ev = G.heroStrike(B, S, false, () => 0.01); CL.ingest(B, ev, { heroEnergy: 0 });
  const hit = B.log.entries.find(e => e.kind === 'hit'), row = CL.entryHTML(B.log, hit);
  ok(/−\d+ HP<svg[^>]*>.*<\/svg> Shock/.test(row) && row.includes(CL.FX.shock.color), `shock hit row: amount, then the bolt icon, then "Shock", all in the Shock colour (${CL.text(B.log, hit).trim()})`);
  ev = G.enemyTurn(B, () => 0.99); CL.ingest(B, ev);
  const dot = B.log.entries.find(e => e.kind === 'dot'), drow = CL.entryHTML(B.log, dot);
  ok(dot && /suffers/.test(CL.text(B.log, dot)) && drow.includes(CL.FX.poison.color) && /Poison/.test(drow), `poison tick row: "${CL.text(B.log, dot).trim()}" in the Poison colour`);
}

console.log(errors.length ? `\n${errors.length} FAILED` : `\ncombat log: all checks passed (${calls} engine calls)`);
process.exit(errors.length ? 1 : 0);
