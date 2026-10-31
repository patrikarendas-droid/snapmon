// Stable ability keys: every ability has a unique internal key, battles track cooldowns by key, and renaming moves
// (what curated move names will do) can never change how a battle plays. Older saves gain keys on load.
const fs = require('fs'), vm = require('vm'), path = require('path');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'curated.js', 'curated-data.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') +
  ';globalThis.T={OBJECTS,FAMILIES,createMonster,freshState,migrate,exportSave,importSave,newBattle,heroTurnStart,heroStrike,enemyTurn,hunterStats,assignAbilityKeys,cooldownKey,curatedMoveSlots,identityUpdate,applyIdentityUpdate,undoIdentityUpdate,setRNG:f=>{RNG=f}}', ctx);
const T = ctx.T, RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const clone = x => JSON.parse(JSON.stringify(x));

// 1. every possible monster: unique keys, the expected slots, curated move slots line up
let dupKeys = [], slotBad = [], shared = [], n = 0;
for (const id of Object.keys(T.OBJECTS)) for (const r of RAR) for (const v of [null, 'spectral', 'mutated']) {
  const m = T.createMonster(T.freshState(), { obj: id, rarity: r, variant: v }); n++;
  const keys = m.abilities.map(a => a.key);
  if (new Set(keys).size !== keys.length || keys.some(k => !k)) dupKeys.push(`${id}/${r}/${v}: ${keys}`);
  const slots = T.curatedMoveSlots(id);
  if (keys[0] !== 'signature' || keys.some(k => !(k in slots)) || (r === 'legendary') !== keys.includes('ultimate') || (r === 'legendary') !== keys.includes('legend')) slotBad.push(`${id}/${r}/${v}: ${keys}`);
  if (m.abilities.some(a => a.cdWith)) shared.push(`${id}/${r}/${v}`);
}
ok(!dupKeys.length, `all ${n} possible monsters: every ability has its own key${dupKeys.length ? ': ' + dupKeys.slice(0, 3).join(' | ') : ''}`);
ok(!slotBad.length, `keys are signature / kit.<move> / legend / ultimate and match the curated move slots${slotBad.length ? ': ' + slotBad.slice(0, 3).join(' | ') : ''}`);
ok(shared.length === 4 && shared.every(s => /^(bee|x_pin_cushion)\//.test(s)), `same-name moves keep their shared cooldown via cdWith in exactly the 4 known cases: ${shared.join(', ')}`);

// 2. renaming moves never changes a battle (event stream identical apart from the names)
const battle = (m, seed0) => {
  let s = seed0; T.setRNG(() => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; });
  const S = T.freshState(); S.level = 7; S.hp = T.hunterStats(S).maxHp; const B = T.newBattle(S, m), out = [];
  for (let t = 0; t < 40 && !B.over; t++) { out.push(T.heroTurnStart(B).ev); if (B.over) break; out.push(T.heroStrike(B, S, false)); if (!B.over) out.push(T.enemyTurn(B)); }
  return out;
};
const pos = (ev, m) => JSON.parse(JSON.stringify(ev, (k, v) => (k === 'msg' ? undefined : k === 'name' && typeof v === 'string' && v !== 'Attack' ? m.abilities.findIndex(a => a.name === v) : v)));
let renameBad = [];
for (const id of ['x_energy_drink', 'padlock', 'apple', 'book', 'microwave', 'bee', 'x_pin_cushion', 'forklift', 'sock', 'rubber_duck']) for (const r of ['rare', 'epic', 'legendary']) for (const seed of [1, 2, 3]) {
  const m = T.createMonster(T.freshState(), { obj: id, rarity: r }); m.stats.hp *= 4; // longer fights: more cooldown decisions
  const a = battle(clone(m), seed);
  const renamed = clone(m); renamed.abilities.forEach((x, i) => { x.name = 'Renamed ' + i; });
  const same = clone(m); same.abilities.forEach(x => { x.name = 'Attack'; }); // worst case: every move gets one name, even "Attack"
  const strip = (evs, mm) => JSON.stringify(evs.map(e => pos(e, mm)).map(e => JSON.parse(JSON.stringify(e, (k, v) => (k === 'name' ? undefined : v)))));
  if (strip(a, m) !== strip(battle(renamed, seed), renamed) || strip(a, m) !== strip(battle(same, seed), same)) renameBad.push(`${id}/${r}/${seed}`);
}
ok(!renameBad.length, `renaming moves (to new names, or all to one name, even "Attack") never changes a battle: 90 fights${renameBad.length ? ' — differs: ' + renameBad.join(', ') : ''}`);
{
  const m = T.createMonster(T.freshState(), { obj: 'apple', rarity: 'legendary' }); m.abilities.forEach(x => { x.name = 'Attack'; });
  let s = 5; T.setRNG(() => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; });
  const S = T.freshState(); S.level = 7; const B = T.newBattle(S, m); let flags = [];
  for (let t = 0; t < 30; t++) { const ev = T.enemyTurn(B).find(e => e.t === 'act'); if (ev) flags.push(ev.ability); if (B.over) break; }
  ok(flags.includes(true), 'a move NAMED "Attack" is still announced as a special move (the basic attack is identified internally)');
}

// 3. older saves: keys added on load, nothing else changes; idempotent; survive backup
{
  const old = T.createMonster(T.freshState(), { obj: 'padlock', rarity: 'legendary' });
  const v044 = clone(old); v044.abilities = [{ name: 'Jingle Jab', power: 0.45, hits: 3, cd: 3 }, { name: 'Laser Zap', power: 1.05, effect: 'burn', chance: 0.3, cd: 2 }, { name: 'Overclock', power: 0, effect: 'atkup', self: true, cd: 3 }, { name: 'Cataclysm of Mechanicia', power: 2.1, effect: 'stun', chance: 0.6, ultimate: true, cd: 4 }];
  const v045 = clone(old); v045.abilities.forEach(a => { delete a.key; delete a.cdWith; });
  const S = T.freshState(); S.monsters = [{ ...v044, id: 'm1' }, { ...v045, id: 'm2' }];
  const before = clone(S.monsters), M = T.migrate(clone(S));
  ok(JSON.stringify(M.monsters[0].abilities.map(a => a.key)) === JSON.stringify(['signature', 'fam.laser_zap', 'fam.overclock', 'ultimate']), `a v0.4.4 legendary gets keys ${M.monsters[0].abilities.map(a => a.key)}`);
  ok(JSON.stringify(M.monsters[1].abilities.map(a => a.key)) === JSON.stringify(old.abilities.map(a => a.key)), 'a v0.4.5 monster gets exactly the keys a new one has');
  const keyless = mm => mm.map(m => ({ ...m, abilities: m.abilities.map(({ key, cdWith, ...a }) => a) }));
  ok(JSON.stringify(keyless(M.monsters)) === JSON.stringify(before), 'loading changes nothing else on saved monsters (names, numbers, text)');
  ok(JSON.stringify(T.migrate(clone(M)).monsters) === JSON.stringify(M.monsters), 'loading twice gives the same keys (idempotent)');
  const back = T.importSave(T.exportSave(M));
  ok(JSON.stringify(back.monsters) === JSON.stringify(M.monsters), 'keys survive backup export/import');
  const fights = mm => JSON.stringify(battle(clone(mm), 9).map(e => pos(e, mm)));
  ok(fights(v045) === fights(M.monsters[1]), 'a keyless monster (test collection, very old save) fights exactly like its keyed version');
}

// 4. identity update / undo still find the signature by key and leave keys alone
{
  const m = T.createMonster(T.freshState(), { obj: 'x_light_switch', rarity: 'rare' });
  const old = clone(m); old.dna.shape = 'tool'; old.dna.sub = null; old.abilities[0].name = 'Nail Gun';
  const S = T.freshState(); S.monsters = [old]; const keys = old.abilities.map(a => a.key).join();
  T.applyIdentityUpdate(S, old);
  ok(old.abilities[0].name === 'Lights Out' && old.abilities.map(a => a.key).join() === keys, 'identity update renames the signature, keys unchanged');
  T.undoIdentityUpdate(old); ok(old.abilities[0].name === 'Nail Gun' && old.abilities.map(a => a.key).join() === keys, 'undo restores the name, keys unchanged');
}

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL ABILITY-KEY CHECKS PASSED');
process.exit(bad ? 1 : 0);
