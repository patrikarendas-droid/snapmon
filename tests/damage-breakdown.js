// Combat-log damage breakdown (build 21): hit events carry `lost` (HP actually taken), `neutral` (the same hit at ×1
// effectiveness) and `noCrit` (the same hit without its critical). Verified INDEPENDENTLY by replaying every hunter
// strike from a cloned battle with the very same random numbers:
//   • against a target whose family is neutral to the weapon → its damage must equal `neutral`
//   • with the critical roll forced to fail (crit chance 0; the roll is still drawn) → its damage must equal `noCrit`
// plus: `lost` equals the real HP change (overkill included), multi-hit per hit, God Mode blocked ≠ resisted,
// poison/burn ticks unchanged, and the combat-log text shows the exact amounts (and no invented nonzero amount).
// Usage: node tests/damage-breakdown.js
'use strict';
const G = require('./load')();
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const ELS = ['slash', 'ballistic', 'arcane', 'shock', 'toxic'];
const seq = seed => { let s = seed >>> 0 || 1; const f = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; f.state = () => s; f.set = v => { s = v; }; return f; };
const neutralFam = el => G.FAMILY_IDS.find(f => G.effMult(f, el) === 1);
const clone = B => { const c = JSON.parse(JSON.stringify({ ...B, m: null, log: null })); c.m = B.m; return c; };
const W = ['sword', 'pistol', 'dagger', 'wand', 'hammer'];
let hits = 0, resisted = 0, weak = 0, crits = 0, overkill = 0, multi = 0, zeroDiff = 0;
const bad = [];
const logTexts = [];
for (let g = 0; g < 400; g++) {
  const S = G.freshState(); S.level = 3 + g % 9; S.weapons = Object.fromEntries(W.map(w => [w, g % 4])); S.equipped = W[g % 5];
  S.charmSlots = g % 2 ? ['sock', null] : [null, null]; S.charms = { sock: true };
  const ids = Object.keys(G.OBJECTS), id = ids[(g * 37) % ids.length];
  const r = ['common', 'rare', 'epic', 'legendary'][g % 4], v = [null, 'spectral', 'mutated', 'shiny'][g % 4];
  const rng = seq(1000 + g);
  const m = G.createMonster(S, { obj: id, rarity: r, variant: v, word: G.OBJECTS[id].name, photo: null, first: false, rng });
  if (g % 7 === 0) m.stats.hp = 3; // overkill cases
  const B = G.newBattle(S, m); G.CombatLog.create(B, { god: false });
  for (let t = 0; t < 30 && !B.over; t++) {
    const st = G.heroTurnStart(B); G.CombatLog.ingest(B, st.ev);
    if (B.over) break;
    if (!st.skip) {
      const special = B.hero.energy >= 60 && t % 2 === 0, before = clone(B), hp0 = B.enemy.hp, s0 = rng.state();
      const ev = G.heroStrike(B, S, special, rng), s1 = rng.state(); G.CombatLog.ingest(B, ev);
      const hs = ev.filter(e => e.t === 'hit');
      if (hs.length > 1) multi++;
      // reconcile lost with the real HP change
      const sumLost = hs.reduce((a, e) => a + e.lost, 0);
      if (sumLost !== hp0 - B.enemy.hp) bad.push(`battle ${g}: lost ${sumLost} ≠ HP change ${hp0 - B.enemy.hp}`);
      for (const e of hs) { hits++; if (e.lost < e.dmg) overkill++; if (e.lost !== Math.min(e.dmg, e.lost + 0) || e.lost > e.dmg) bad.push(`battle ${g}: lost > dmg`); }
      // replay 1: the same strike against a target that is neutral to this weapon, same random numbers
      const el = G.WEAPONS[B.weapon].el;
      if (hs.some(e => e.eff !== 1)) {
        const N = clone(before); N.enemy.fam = neutralFam(el); rng.set(s0);
        const evN = G.heroStrike(N, JSON.parse(JSON.stringify(S)), special, rng).filter(e => e.t === 'hit');
        hs.forEach((e, i) => { if (!evN[i]) return; if (e.eff > 1) weak++; else resisted++;
          if (evN[i].dmg !== e.neutral) bad.push(`battle ${g} hit ${i}: neutral ${e.neutral} ≠ replay ${evN[i].dmg}`);
          if (e.neutral === e.dmg) zeroDiff++; });
      } else if (hs.some(e => e.neutral != null)) bad.push(`battle ${g}: neutral reported on a neutral hit`);
      // replay 2: the same strike with the critical roll failing (chance 0; the roll is still drawn)
      if (hs.some(e => e.crit)) {
        const C = clone(before); C.hero.crit = 0; rng.set(s0);
        const evC = G.heroStrike(C, JSON.parse(JSON.stringify(S)), special, rng).filter(e => e.t === 'hit');
        hs.forEach((e, i) => { if (!e.crit || !evC[i]) return; crits++; if (evC[i].dmg !== e.noCrit) bad.push(`battle ${g} hit ${i}: noCrit ${e.noCrit} ≠ replay ${evC[i].dmg}`); });
      }
      rng.set(s1); // the replays moved the generator: continue from where the real strike left off
    }
    if (!B.over) { const ev = G.enemyTurn(B, rng); G.CombatLog.ingest(B, ev); for (const e of ev.filter(x => x.t === 'hit')) if (e.who === 'hero' && e.lost == null) bad.push('enemy hit without lost'); }
  }
  for (const x of (B.log ? B.log.entries : [])) if (x.kind === 'hit') logTexts.push(G.CombatLog.text(B.log, x));
}
ok(!bad.length, `${hits} hunter hits (${multi} multi-hit strikes): lost = real HP change; neutral and noCrit match independent replays with the same random numbers${bad.length ? ' — ' + bad.slice(0, 4).join(' | ') : ''}`);
ok(resisted > 50 && weak > 50 && crits > 20 && overkill > 5, `covered: ${resisted} resisted, ${weak} super-effective, ${crits} critical, ${overkill} overkill hits; ${zeroDiff} effectiveness hits with no whole-HP difference`);

// combat-log text: exact amounts, reconciled
{
  const res = logTexts.filter(x => /resisted −\d+ HP \(\d+ → \d+\)/.test(x)), wk = logTexts.filter(x => /super effective \+\d+ HP \(\d+ → \d+\)/.test(x));
  const recon = [...res, ...wk].every(x => { const m = x.match(/([−+])(\d+) HP \((\d+) → (\d+)\)/); const d = +m[2], a = +m[3], b = +m[4]; return m[1] === '−' ? a - b === d : b - a === d; });
  ok(res.length > 20 && wk.length > 20 && recon, `log lines show the exact amount and reconcile, e.g. "${(res[0] || '').replace(/\s+/g, ' ').slice(0, 90)}"`);
  ok(!logTexts.some(x => /resisted −0|effective \+0/.test(x)), 'no "−0"/"+0" amount is ever printed (a zero difference says "no HP difference after rounding")');
  ok(logTexts.some(x => /hit for \d+, only \d+ HP left to take/.test(x)), 'overkill: calculated damage and HP actually lost are both shown');
}

// a resisted hit whose whole-HP difference is zero (both round to the minimum of 1): no invented amount
{
  const S = G.freshState(); S.level = 1; S.equipped = 'pistol'; S.weapons = { pistol: 0 };
  const m = G.createMonster(S, { obj: 'mug', rarity: 'common', word: 'mug', photo: null, first: false, rng: seq(5) });
  const B = G.newBattle(S, m); B.enemy.fam = G.FAMILY_IDS.find(f => G.effMult(f, 'ballistic') < 1); B.enemy.def = 1e6; B.hero.crit = 0; B.enemy.spd = 0;
  G.CombatLog.create(B, { god: false });
  const ev = G.heroStrike(B, S, false, seq(9)); G.CombatLog.ingest(B, ev);
  const h = ev.find(e => e.t === 'hit'), line = G.CombatLog.text(B.log, B.log.entries.find(x => x.kind === 'hit'));
  ok(h && h.eff < 1 && h.dmg === 1 && h.neutral === 1 && /resisted \(no HP difference after rounding\)/.test(line), `minimum-damage resisted hit: "${line.trim()}"`);
}

// God Mode: enemy hits are blocked (not "resisted"), with the blocked amount; poison/burn ticks keep working
{
  const S = G.freshState(); S.level = 5; S.settings.devUnlocked = true; S.settings.devGodMode = true;
  const rng = seq(77); G.setRNG(rng);
  const m = G.createMonster(S, { obj: 'teddy', rarity: 'epic', variant: 'mutated', word: 'teddy', photo: null, first: false, rng });
  const B = G.newBattle(S, m); G.CombatLog.create(B, { god: G.godOn(B) });
  const lines = [];
  for (let t = 0; t < 25 && !B.over; t++) { const st = G.heroTurnStart(B); G.CombatLog.ingest(B, st.ev); if (B.over) break; if (!st.skip) G.CombatLog.ingest(B, G.heroStrike(B, S, false, rng)); if (!B.over) { const ev = G.enemyTurn(B, rng); G.CombatLog.ingest(B, ev); } }
  for (const x of B.log.entries) if (x.who === 'hero' && (x.kind === 'hit' || x.kind === 'dot')) lines.push(G.CombatLog.text(B.log, x));
  ok(G.godOn(B) && lines.length > 3 && lines.every(l => !/resisted/.test(l)) && lines.some(l => /blocked by God Mode/.test(l)), `God Mode: ${lines.length} enemy hits/ticks on the hunter say "blocked by God Mode", never "resisted"`);
}

console.log(errors.length ? `\n${errors.length} FAILED` : '\nALL DAMAGE-BREAKDOWN CHECKS PASSED');
process.exit(errors.length ? 1 : 0);
