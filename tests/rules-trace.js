// Guards encounter odds, rarity rolls and battle maths against accidental change: a fixed-seed run of 300 hunts
// (encounters, rarities, levels, battles with attacks, specials, items, traps and fleeing) must produce exactly the
// recorded trace. v0.4.2 moved the rule numbers into MECH; this trace was recorded after checking that the result is
// identical to v0.4.1 (41,667 steps compared). If you change the rules on purpose, run with "record" and say so.
// v0.4.5 re-recorded on purpose: monsters' extra moves now come from per-object move kits and Legendaries get unique
// moves, so battles play out differently. Replaying this trace with the v0.4.4 move/name/family functions patched in
// reproduced the old fixture exactly (35,875 steps): odds, rarities, levels, stats and battle maths are unchanged.
const G = require('./load')(), crypto = require('crypto'), fs = require('fs'), path = require('path');
const FIX = path.join(__dirname, 'fixtures/rules-trace.json');
let seed = 12345; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
G.setRNG(rng); const out = [];
for (let g = 0; g < 300; g++) {
  const S = G.freshState(); S.level = 1 + g % 12; S.research = g % 3 ? { lens1: 1, capture1: 1, sensor: 1, capture2: 1, medic: 1 } : {}; S.charmSlots = g % 2 ? ['fang', 'lenscap'] : ['slipper', 'battery'];
  S.items = { potion: 3, greater: 1, strength: 1, defense: 1, antidote: 2, enhancer: 1, trap: 5, smoke: 1 }; S.hp = G.hunterStats(S).maxHp; S.weapons = { sword: 2, pistol: 1, dagger: 1, wand: 1, hammer: 1 }; S.equipped = ['sword', 'pistol', 'dagger', 'wand', 'hammer'][g % 5];
  for (let k = 0; k < 15; k++) {
    const r = G.resolvePhoto(S, ['mug', 'apple', 'dog', 'toilet', 'forklift'][k % 5], { hue: 10, sat: .5, lit: .5, hash: (seed >>> 0).toString(16).padStart(16, '0') }, { label: 'x', conf: .8 }, rng);
    out.push(r.encounter ? [r.monster.rarity, r.monster.level, r.monster.variant, r.monster.stats] : 'none');
    if (!r.encounter) continue;
    const B = G.newBattle(S, r.monster);
    for (let t = 0; t < 40 && !B.over; t++) {
      const st = G.heroTurnStart(B); out.push(st.ev);
      if (B.over) break;
      if (!st.skip) {
        const a = rng();
        if (a < 0.15 && S.items.trap) out.push(G.attemptCapture(B, S, rng).ev, G.captureChance(S, B).toFixed(6));
        else if (a < 0.2) out.push(G.useItem(B, S, ['strength', 'defense', 'antidote', 'potion', 'enhancer'][t % 5]).ev);
        else if (a < 0.22) out.push(G.attemptFlee(B, S, rng));
        else out.push(G.heroStrike(B, S, B.hero.energy >= 60, rng));
      }
      if (!B.over) out.push(G.enemyTurn(B, rng));
    }
    const sum = G.finishBattle(S, B, rng); out.push([sum.result, sum.rewards, sum.drops, S.coins, S.hp, S.xp, S.level]);
  }
}
const hash = crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex');
if (process.argv[2] === 'record') { fs.writeFileSync(FIX, JSON.stringify({ steps: out.length, sha256: hash }, null, 1)); console.log('recorded', out.length, hash); process.exit(0); }
const want = JSON.parse(fs.readFileSync(FIX, 'utf8'));
if (want.sha256 === hash && want.steps === out.length) { console.log(`ok: game rules unchanged (${out.length} fixed-seed steps)`); process.exit(0); }
console.log(`FAIL: game rules changed (${out.length} steps, ${hash} vs recorded ${want.sha256})`); process.exit(1);
