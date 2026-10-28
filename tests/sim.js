const G = require('./load')();
const hex = () => [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
// 1) encounter distribution
let S = G.freshState(); const counts = { none: 0 }; let maxDry = 0, dry = 0;
for (let i = 0; i < 20000; i++) {
  const cat = G.CATEGORIES[i % 30].id;
  const r = G.resolvePhoto(S, cat, { hue: 0, sat: 0, lit: .5, hash: hex() });
  if (r.encounter) { counts[r.monster.rarity] = (counts[r.monster.rarity] || 0) + 1; dry = 0; } else { counts.none++; dry++; maxDry = Math.max(maxDry, dry); }
}
console.log('encounters /20000', counts, 'max dry streak', maxDry);
// duplicate photo
S = G.freshState(); S.stats.photos = 5; S.stats.encounters = 1; let dupHits = 0;
for (let i = 0; i < 2000; i++) { const r = G.resolvePhoto(S, 'mug', { hue: 0, sat: 0, lit: .5, hash: 'ffffffffffffffff' }); if (r.encounter) dupHits++; }
console.log('same-photo spam encounter rate', dupHits / 2000);
// 2) battle sim: simple AI
function fight(level, rarity, weapon = 'sword') {
  const S = G.freshState(); S.level = level; S.weapons[weapon] = Math.min(5, Math.floor(level / 2)); S.equipped = weapon; S.hp = G.hunterStats(S).maxHp; S.items.potion = 3;
  S.stats.photos = 3; S.stats.encounters = 1;
  let m; for (;;) { const r = G.resolvePhoto(S, G.CATEGORIES[Math.floor(Math.random()*29)].id, { hash: hex() }); if (r.encounter && r.monster.rarity === rarity) { m = r.monster; break; } }
  const B = G.newBattle(S, m); let turns = 0;
  if (B.enemyFirst) G.enemyTurn(B);
  while (!B.over && turns < 60) {
    turns++;
    const st = G.heroTurnStart(B); if (B.over) break;
    if (!st.skip) {
      if (B.hero.hp < B.hero.maxHp * 0.35 && S.items.potion > 0) G.useItem(B, S, 'potion');
      else G.heroStrike(B, S, B.hero.energy >= G.WEAPONS[weapon].special.cost);
    }
    if (!B.over) G.enemyTurn(B);
  }
  return { win: B.result === 'victory', turns, potions: 3 - S.items.potion };
}
for (const lv of [1, 3, 6, 10]) for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary']) {
  let w = 0, t = 0, p = 0; const N = 300;
  for (let i = 0; i < N; i++) { const f = fight(lv, r, ['sword','pistol','dagger','wand','hammer'][i%5]); w += f.win; t += f.turns; p += f.potions; }
  console.log(`L${lv} ${r.padEnd(9)} win ${(w / N * 100).toFixed(0)}%  turns ${(t / N).toFixed(1)}  potions ${(p / N).toFixed(1)}`);
}
// 3) save roundtrip
S = G.freshState(); S.coins = 777; const code = G.exportSave(S); const back = G.importSave(code); console.log('roundtrip coins', back.coins);
console.log('match', G.matchCategory('my red coffee mug'), G.matchCategory('Running shoes'), G.matchCategory('umbrella'), G.matchCategory('teddy bear'));
