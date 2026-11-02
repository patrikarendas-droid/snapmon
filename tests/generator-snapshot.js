// Freezes the LIVE monster generator: for every registry object × rarity × 2 seeds it hashes the generated monster
// (name, family, level, stats, abilities with all numbers, DNA, stored lore), the encyclopedia text (speciesLore, which
// is computed at display time, not stored) and a backup export of a save holding sample monsters. Recorded before the
// Phase 1 curated-content foundation; it must stay identical until curated content is explicitly activated.
// If you change the generator ON PURPOSE, run with "record" and say so in the commit and the journal.
// Stable ability keys (`key`, `cdWith`) were added afterwards as a deliberate, additive internal field: they are left
// out of this hash (checked separately below), so the recorded value still proves every text, name, number and the
// rest of the save is exactly as before.
// v0.4.6 (Pilot 01 activation): text changed ON PURPOSE for the 10 Pilot 01 objects only. The original recording is
// kept as `withoutCurated` and must still match with curated text switched off (proving nothing else changed); `sha256`
// is the live output with curated text on, re-recorded for v0.4.6.
// Pilot 02 integration (2026-11-02): re-recorded ON PURPOSE: 50 more objects get approved lore, move names and
// monster names. `withoutCurated` is unchanged and still matches with curated content off.
// Recognition audit (2026-11): re-recorded with "record-visual" (35 objects get an honest design, 2 objects added);
// `textFrozen` proves names, stats, moves and texts of every v0.4.8 object are unchanged, curated on and off.
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const FIX = path.join(__dirname, 'fixtures/generator-snapshot.json');
const G = require('./load')();
const { OBJECTS, createMonster, freshState, speciesLore, exportSave, setRNG, CURATED } = G;
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const noKeys = m => ({ ...m, abilities: m.abilities.map(({ key, cdWith, ...a }) => a) });
function snapshot(curatedOn) {
  const live = [CURATED.enabled, CURATED.movesEnabled]; CURATED.enabled = CURATED.movesEnabled = curatedOn;
  let seed = 4242; setRNG(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
  const h = crypto.createHash('sha256'), lines = { monsters: 0, species: 0 };
  const ids = Object.keys(OBJECTS).sort(), sample = [];
  for (const id of ids) for (const r of RAR) for (const k of [0, 1]) {
    const S = freshState(); S.level = 1 + (k * 5) % 12;
    const m = createMonster(S, { obj: id, rarity: r, word: OBJECTS[id].name, photo: k ? { hue: 30, sat: 0.6, lit: 0.5, pal: { conf: 'confident', primary: [30, 60, 50] } } : null });
    delete m.seenAt; // wall-clock time
    if (!m.abilities.every(a => typeof a.key === 'string' && a.key)) { console.log('FAIL: ability without a stable key', id, r); process.exit(1); }
    h.update(JSON.stringify(noKeys(m))); lines.monsters++;
    if (k === 0 && r === 'rare' && sample.length < 40 && ids.indexOf(id) % 50 === 0) sample.push(m);
  }
  for (const id of ids) for (const r of RAR) { h.update(speciesLore({ key: 'o:' + id, obj: id, cat: OBJECTS[id].cat, fam: null, monsterName: OBJECTS[id].name }, r)); lines.species++; }
  const S = freshState(); S.monsters = sample.map((m, i) => ({ ...noKeys(m), id: 'm' + i, caughtAt: 1 })); S.created = 1; S.lastTick = 1; S.savedAt = 1;
  const exp = exportSave(S); h.update(exp);
  [CURATED.enabled, CURATED.movesEnabled] = live;
  return { ...lines, exportChars: exp.length, sha256: h.digest('hex') };
}
// recognition audit (2026-11): the TEXT of every v0.4.8 object (names, family, level, stats, moves, stored lore,
// encyclopedia text) without artwork, seeded per object from the frozen id list. Visual-only design fixes and objects
// added later leave it unchanged; it must match for curated content on AND off.
function textFrozen(curatedOn) {
  const live = [CURATED.enabled, CURATED.movesEnabled]; CURATED.enabled = CURATED.movesEnabled = curatedOn;
  const frozen = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/registry-ids-v0.4.8.json'), 'utf8')).ids, h = crypto.createHash('sha256');
  frozen.forEach((id, i) => { for (const [j, r] of RAR.entries()) {
    let seed = (i * 5 + j) * 7919 + 1; setRNG(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
    const S = freshState(); S.level = 1 + (i + j) % 12; const m = createMonster(S, { obj: id, rarity: r, word: OBJECTS[id].name });
    delete m.seenAt; delete m.dna; h.update(JSON.stringify(noKeys(m)));
    h.update(speciesLore({ key: 'o:' + id, obj: id, cat: OBJECTS[id].cat, fam: null, monsterName: OBJECTS[id].name }, r));
  } });
  [CURATED.enabled, CURATED.movesEnabled] = live; return h.digest('hex');
}
const on = snapshot(true), off = snapshot(false), textOn = textFrozen(true), textOff = textFrozen(false);
const want = JSON.parse(fs.readFileSync(FIX, 'utf8'));
if (process.argv[2] === 'record') {
  // keeps the original (pre-curated) recording; records only the live, curated-on output
  const out = { ...on, withoutCurated: want.withoutCurated || { monsters: want.monsters, species: want.species, exportChars: want.exportChars, sha256: want.sha256 }, textFrozen: want.textFrozen || { on: textOn, off: textOff } }; // textFrozen is recorded once and never overwritten
  if (out.withoutCurated.sha256 !== off.sha256) { console.log('FAIL: refusing to record — with curated text off the output no longer matches the original recording'); process.exit(1); }
  fs.writeFileSync(FIX, JSON.stringify(out, null, 1)); console.log('recorded', JSON.stringify(out)); process.exit(0);
}
// "record-text": the text/mechanics of specific v0.4.8 objects changed ON PURPOSE (say which in the commit and journal).
// Recognition audit round 2 (2026-11): 15 objects whose design rule matched inside another word (weasel → easel,
// motherboard/chess board/cardboard/headboard/sideboard unit/ironing board/synth keyboard → oar, windbreaker → breaker,
// vinyl record → cord, champagne flute → lute, honeycomb/combine harvester → comb, gingerbread man → ginger, string
// lights → ring light) now take their correct rule or category: their lore group, moves and flavour text change.
if (process.argv[2] === 'record-text') { const out = { ...on, withoutCurated: off, textFrozen: { on: textOn, off: textOff } }; fs.writeFileSync(FIX, JSON.stringify(out, null, 1)); console.log('recorded (text)', JSON.stringify(out.textFrozen)); process.exit(0); }
// "record-visual": artwork/objects changed on purpose (recognition audit). Allowed only while the frozen TEXT of every
// v0.4.8 object is unchanged (checked above); then the whole-output hashes, including withoutCurated, are re-recorded.
if (process.argv[2] === 'record-visual') {
  if (!(want.textFrozen && want.textFrozen.on === textOn && want.textFrozen.off === textOff)) { console.log('FAIL: refusing — the text of v0.4.8 objects changed'); process.exit(1); }
  const out = { ...on, withoutCurated: off, textFrozen: want.textFrozen }; fs.writeFileSync(FIX, JSON.stringify(out, null, 1)); console.log('recorded (visual)', JSON.stringify(out)); process.exit(0);
}
const okOff = want.withoutCurated && want.withoutCurated.sha256 === off.sha256, okOn = want.sha256 === on.sha256, okText = want.textFrozen && want.textFrozen.on === textOn && want.textFrozen.off === textOff;
if (!okText) { console.log(`FAIL: the text of the v0.4.8 objects changed (names, stats, moves, lore, encyclopedia; artwork excluded): on ${textOn}, off ${textOff}`); process.exit(1); }
if (okOff && okOn) { console.log(`ok: live text unchanged (${on.monsters} monsters, ${on.species} encyclopedia texts, backup export); with curated text off it still matches the pre-curated recording`); process.exit(0); }
console.log('FAIL:', okOn ? '' : `live output changed ${on.sha256} vs ${want.sha256};`, okOff ? '' : `curated-off output no longer matches the pre-curated recording ${off.sha256}`); process.exit(1);
