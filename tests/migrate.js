// Save compatibility: real saves produced by v0.1 and v0.2 code must load in the current version without losing
// progress, and captured monsters must keep their exact appearance.
const fs = require('fs'), path = require('path');
const G = require('./load')();
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
for (const f of ['save-v1.json', 'save-v2.json']) {
  const old = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'));
  const s = G.migrate(JSON.parse(JSON.stringify(old)));
  ok(s.v === 3, `${f}: migrated to save format 3`);
  ok(s.level === old.level && s.coins === old.coins && s.rp === old.rp && JSON.stringify(s.weapons) === JSON.stringify(old.weapons), `${f}: hunter level, coins, research points and weapons kept`);
  ok(s.monsters.length === old.monsters.length, `${f}: all ${old.monsters.length} captured monsters kept`);
  ok(s.monsters.every((m, i) => JSON.stringify(m.dna) === JSON.stringify(old.monsters[i].dna)), `${f}: monster appearance (DNA) unchanged`);
  ok(s.monsters.every(m => m.obj && G.OBJECTS[m.obj] && m.species === 'o:' + m.obj), `${f}: every monster linked to a registry object`);
  ok(Object.values(s.dex).every(d => d.obj && G.OBJECTS[d.obj]), `${f}: encyclopedia regrouped by object (${Object.keys(old.dex).length} old entries → ${Object.keys(s.dex).length})`);
  const seenOld = Object.values(old.dex).reduce((a, d) => a + d.seen, 0), seenNew = Object.values(s.dex).reduce((a, d) => a + d.seen, 0);
  ok(seenNew >= seenOld, `${f}: encounter counts preserved (${seenOld} → ${seenNew})`);
  ok(s.monsters[0].nick === old.monsters[0].nick, `${f}: nicknames kept`);
  // the migrated save keeps working: hunt + capture with the new code
  const r = G.resolvePhoto(s, 'forklift', { hue: 40, sat: .6, lit: .5, hash: 'abcdef0123456789' }, { label: 'forklift', conf: 0.9 }, () => 0.01);
  ok(r.encounter && r.monster.obj === 'forklift' && r.monster.species === 'o:forklift', `${f}: new forklift monster after migration`);
}
console.log(bad ? `${bad} problem(s)` : 'ok: saves from v0.1 and v0.2 migrate cleanly');
process.exit(bad ? 1 : 0);
