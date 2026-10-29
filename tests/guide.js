// The in-game Guide states practical durations for status effects. This test plays real battle turns with the game's
// own functions and checks each claim, so the guide cannot silently drift from the rules.
const G = require('./load')();
const vm = require('vm'), fs = require('fs'), path = require('path');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
G.setRNG(() => 0.99); // no misses, crits or random effects; enemies only use plain attacks
const T = G.STATUS_TURNS;
function battle() {
  const S = G.freshState(); S.level = 5; S.hp = 999; S.items = { strength: 1, defense: 1, antidote: 1 };
  const m = { name: 'Dummy', fam: 'household', rarity: 'common', level: 5, stats: { hp: 5000, atk: 10, def: 10, spd: 1 }, abilities: [] };
  const B = G.newBattle(S, m); B.hero.hp = B.hero.maxHp = 5000; return { S, B };
}
const heroAttack = B => G.heroStrike(B, { charmSlots: [], research: {} }, false, () => 0.5);
// 1) poison: damage at the start of the monster's next T.poison turns
{ const { B } = battle(); B.enemy.status.poison = { t: T.poison }; let ticks = 0;
  for (let i = 0; i < 6; i++) { const ev = G.enemyTurn(B, () => 0.99); ticks += ev.filter(e => e.t === 'dot').length; }
  ok(ticks === T.poison, `poison deals damage on ${ticks} turns (guide: ${T.poison})`); }
// 2) strength potion: boosts the next T.atkup - 1 attacks
{ const { S, B } = battle(); G.useItem(B, S, 'strength'); G.enemyTurn(B, () => 0.99); let boosted = 0;
  for (let i = 0; i < 6; i++) { G.heroTurnStart(B); if (B.hero.status.atkup) boosted++; heroAttack(B); G.enemyTurn(B, () => 0.99); }
  ok(boosted === T.atkup - 1, `Strength Potion boosts ${boosted} attacks (guide: ${T.atkup - 1})`); }
// 3) defense potion: protects against the opponent's next T.defup attacks
{ const { S, B } = battle(); G.useItem(B, S, 'defense'); let covered = 0;
  for (let i = 0; i < 6; i++) { if (B.hero.status.defup) covered++; G.enemyTurn(B, () => 0.99); G.heroTurnStart(B); heroAttack(B); }
  ok(covered === T.defup, `Defense Potion protects against ${covered} attacks (guide: ${T.defup})`); }
// 4) DEF down on a monster: the hunter's next T.defdown - 1 attacks hit the lowered defence
{ const { B } = battle(); B.enemy.status.defdown = { t: T.defdown }; let hits = 0; G.enemyTurn(B, () => 0.99);
  for (let i = 0; i < 6; i++) { G.heroTurnStart(B); if (B.enemy.status.defdown) hits++; heroAttack(B); G.enemyTurn(B, () => 0.99); }
  ok(hits === T.defdown - 1, `DEF↓ lasts for ${hits} attacks against it (guide: ${T.defdown - 1})`); }
// 5) antidote immunity: blocks new effects during the monster's next T.immune turns
{ const { S, B } = battle(); G.useItem(B, S, 'antidote'); let shielded = 0;
  for (let i = 0; i < 6; i++) { if (B.hero.status.immune) shielded++; G.enemyTurn(B, () => 0.99); G.heroTurnStart(B); heroAttack(B); }
  ok(shielded === T.immune, `Antidote immunity covers ${shielded} monster turns (guide: ${T.immune})`); }
// 6) burn: damage on T.burn turns, weaker attacks for T.burn - 1 of them
{ const { B } = battle(); B.enemy.status.burn = { t: T.burn }; let ticks = 0, weak = 0;
  for (let i = 0; i < 6; i++) { const ev = G.enemyTurn(B, () => 0.99); ticks += ev.filter(e => e.t === 'dot').length; if (B.enemy.status.burn && ev.some(e => e.t === 'hit')) weak++; G.heroTurnStart(B); }
  ok(ticks === T.burn && weak === T.burn - 1, `burn: ${ticks} damage turns, ${weak} weakened attacks (guide: ${T.burn}, ${T.burn - 1})`); }
// 7) stun: exactly one lost turn
{ const { B } = battle(); B.enemy.status.stun = { t: T.stun }; let lost = 0;
  for (let i = 0; i < 4; i++) { const ev = G.enemyTurn(B, () => 0.99); if (!ev.some(e => e.t === 'act')) lost++; }
  ok(lost === T.stun, `stun skips ${lost} turn(s) (guide: ${T.stun})`); }
// 8) the guide renders without errors and uses the real numbers
const ctx = { console, Math, Date, JSON };
vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'guide.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + ';globalThis.X={Guide,MECH,STATUS_NAME:typeof STATUS_NAME!=="undefined"}', ctx);
const html = ctx.X.Guide.html('status');
ok(ctx.X.Guide.sections.length >= 10 && html.includes('7% of max HP') && html.includes('×1.5') && html.includes('46%'), `guide renders ${ctx.X.Guide.sections.length} sections with the real values (${html.length} chars)`);
console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL GUIDE CHECKS PASSED');
process.exit(bad ? 1 : 0);
