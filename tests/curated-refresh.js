// Pilot 02 integration (2026-11-02): existing monsters take the latest REVIEWED writing (monster names, flavour text,
// move names) once per content revision, on load and on backup restore. Nothing else on a monster or in the save
// changes; the refresh is idempotent, uses no random numbers, backs the untouched save up once, and older game versions
// (curated content off) still read the refreshed save. v0.5.0: every object has reviewed writing, including names for
// Pilot 01. To keep testing the path for objects WITHOUT reviewed content (e.g. objects added later), the test withholds
// the entries of a few objects (WITHHELD) from the live data.
const fs = require('fs'), vm = require('vm'), path = require('path');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const SRC = f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
const WITHHELD = ['mug', 'shoe', 'cutlery_fork', 'x_paperclip'];
const load = (withData = true, store = {}) => {
  const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape,
    localStorage: { _d: store, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); } } };
  vm.createContext(ctx);
  vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'curated.js'].concat(withData ? ['curated-data.js'] : []).map(SRC).join('\n') +
    ';globalThis.T={OBJECTS,CURATED,SAVE_KEY,createMonster,freshState,recordSighting,loadState,saveState,exportSave,importSave,migrate,TestRoster,curatedRefresh,curatedApply,curatedDexName,speciesLore,newBattle,enemyTurn,heroStrike,setRNG:f=>{RNG=f}}', ctx);
  if (withData && ctx.T.CURATED.data) for (const id of WITHHELD) delete ctx.T.CURATED.data[id];
  return ctx.T;
};
const LIVE = load(), PLAIN = load(false), REV = LIVE.CURATED.revision;
const P02 = require('../content/curated/pilot-02-approved.json').entries, P01 = require('../content/curated/pilot-01-approved.json').entries;
const LIVEDATA = LIVE.CURATED.data;
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'], VARIANTS = [null, 'spectral', 'mutated', 'shiny'];
const seeded = (TT, s = 42) => TT.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; });
const make = (TT, obj, rarity, variant = null, s = 42) => { seeded(TT, s); const m = TT.createMonster(TT.freshState(), { obj, rarity, variant, word: obj }); m.seenAt = 1; return m; };
const noText = m => JSON.stringify({ ...m, name: 0, lore: 0, abilities: m.abilities.map(a => ({ ...a, name: 0 })) });
const clone = o => JSON.parse(JSON.stringify(o));
// a v0.4.7 save: monsters as the PREVIOUS build generated them (curated content off for Pilot 02 = generated names, text)
const oldSave = () => {
  const S = PLAIN.freshState(); S.coins = 1234; S.level = 9; S.equipped = 'sword'; let i = 0;
  for (const obj of ['toaster', 'dog', 'x_garden_gnome', 'apple', 'mug']) for (const r of RAR) for (const v of VARIANTS) {
    const m = make(PLAIN, obj, r, v, 100 + i); m.id = 'm' + (++i); m.level = 3 + (i % 20); if (i % 7 === 0) m.nick = 'Sir Nick ' + i; S.monsters.push(m); PLAIN.recordSighting(S, m);
  }
  return S;
};

// 1. the game data is switched on with a revision
ok(LIVE.CURATED.enabled && LIVE.CURATED.namesEnabled && /^[0-9a-f]{12}$/.test(REV || ''), `curated content on, monster names on, content revision ${REV}`);

// 2. new monsters: Pilot 02 names for every rarity and variant, Pilot 01 generated names, others untouched
{
  let p02 = [], p01 = [], other = [];
  for (const r of RAR) for (const v of VARIANTS) {
    for (const id of Object.keys(P02)) { const a = make(LIVE, id, r, v), b = make(PLAIN, id, r, v); if (a.name !== P02[id].names[r] || noText(a) !== noText(b) || a.lore !== P02[id].lore[r]) p02.push(`${id}/${r}/${v}`); }
    for (const id of Object.keys(P01)) { const a = make(LIVE, id, r, v), b = make(PLAIN, id, r, v); if (a.name !== P01[id].names[r] || noText(a) !== noText(b) || a.lore !== P01[id].lore[r]) p01.push(`${id}/${r}/${v}`); }
    for (const id of ['mug', 'shoe', 'cutlery_fork', 'x_paperclip'].filter(x => LIVE.OBJECTS[x])) { if (JSON.stringify(make(LIVE, id, r, v)) !== JSON.stringify(make(PLAIN, id, r, v))) other.push(`${id}/${r}/${v}`); }
  }
  ok(!p02.length, `new Pilot 02 monsters (50 objects × 5 rarities × normal/Spectral/Mutated/Shiny): the approved name and text, identical stats, keys, numbers, DNA${p02.length ? ': ' + p02.slice(0, 3) : ''}`);
  ok(!p01.length, `new Pilot 01 monsters: the approved names (added in v0.5.0), approved text, identical stats${p01.length ? ': ' + p01.slice(0, 3) : ''}`);
  // campaign objects (2,248, live since v0.5.0): a sample across batches, every rarity and variant
  const camp = Object.keys(LIVEDATA).filter(id => !P01[id] && !P02[id]).filter((id, i) => i % 97 === 0); let cb = [];
  for (const r of RAR) for (const v of VARIANTS) for (const id of camp) { const a = make(LIVE, id, r, v), b = make(PLAIN, id, r, v); if (a.name !== LIVEDATA[id].names[r] || a.lore !== LIVEDATA[id].lore[r] || noText(a) !== noText(b)) cb.push(`${id}/${r}/${v}`); }
  ok(camp.length > 20 && !cb.length, `new campaign monsters (${camp.length} sample objects × 5 rarities × 4 variants): approved name and text, identical stats, keys, numbers, DNA${cb.length ? ': ' + cb.slice(0, 3) : ''}`);
  ok(!other.length, `objects without reviewed content (withheld: ${WITHHELD.join(', ')}): byte-identical to the game without curated content${other.length ? ': ' + other.slice(0, 3) : ''}`);
  const long = Object.keys(LIVEDATA).map(id => LIVEDATA[id].names.legendary).sort((a, b) => b.length - a.length)[0];
  ok(long.length <= 40, `longest Legendary name: "${long}" (${long.length} characters, limit 40)`);
}

// 3. loading an old save: refresh once, backup once, nothing else changes
{
  const store = {}, G = load(true, store), before = oldSave(), raw = JSON.stringify(before); store[G.SAVE_KEY] = raw;
  let calls = 0; G.setRNG(() => { calls++; return 0.5; });
  const S = G.loadState();
  ok(calls === 0, 'loading and refreshing a save uses no random numbers');
  ok(store[G.SAVE_KEY + '.backup.precurated'] === raw, 'the untouched save is backed up before the first refresh (snapmon.save.v1.backup.precurated)');
  ok(S.curatedRev === REV, `the save remembers the content revision it was refreshed to (${S.curatedRev})`);
  const bad1 = [], bad2 = [], bad3 = [];
  S.monsters.forEach((m, i) => {
    const o = before.monsters[i], e = LIVEDATA[m.obj];
    if (noText(m) !== noText(o)) bad1.push(m.id);                                   // id, level, stats, rarity, variant, dna, seed, keys, numbers, nick…
    if (!e) { if (JSON.stringify(m) !== JSON.stringify(o)) bad2.push(m.id); return; } // no reviewed content: untouched
    const wantName = e.names ? e.names[m.rarity] : o.name;                            // v0.5.0: every live entry has names
    const wantMoves = o.abilities.map(a => (e.moves && e.moves[a.key]) || a.name);
    if (m.name !== wantName || m.lore !== e.lore[m.rarity] || JSON.stringify(m.abilities.map(a => a.name)) !== JSON.stringify(wantMoves)) bad3.push(`${m.id} ${m.obj}/${m.rarity}/${m.variant}`);
  });
  ok(!bad1.length, `${S.monsters.length} saved monsters: id, level, stats, rarity, variant, colours/DNA, seed, ability keys and numbers, nicknames identical${bad1.length ? ': ' + bad1.slice(0, 3) : ''}`);
  ok(!bad3.length, `saved curated monsters (Pilot 01, Pilot 02 and campaign; normal, Spectral, Mutated, Shiny) take the approved name, text and move names${bad3.length ? ': ' + bad3.slice(0, 3) : ''}`);
  ok(!bad2.length, 'saved monsters of objects without reviewed content are byte-identical');
  ok(S.monsters.filter(m => m.nick).every(m => m.nick === before.monsters.find(o => o.id === m.id).nick) && S.monsters.some(m => m.nick), 'player nicknames are kept');
  const rest = s => JSON.stringify({ ...s, monsters: 0, curatedRev: 0 });
  const diff = Object.keys({ ...S, ...before }).filter(k => k !== 'monsters' && k !== 'curatedRev' && JSON.stringify(S[k]) !== JSON.stringify(before[k]));
  ok(rest(S) === rest(before), `everything else in the save is identical (coins, level, items, equipment, research, encyclopedia, stats)${diff.length ? ': differs in ' + diff.map(k => k + ' ' + JSON.stringify(before[k]).slice(0, 80) + ' -> ' + JSON.stringify(S[k]).slice(0, 80)).join('; ') : ''}`);
  // repeat loads: nothing more happens
  G.saveState(S); const saved = store[G.SAVE_KEY];
  const S2 = G.loadState(); ok(JSON.stringify(S2) === JSON.stringify(S), 'loading again changes nothing (idempotent)');
  ok(G.curatedRefresh(S2) === 0, 'the same revision is never processed twice (curatedRefresh returns 0)');
  store[G.SAVE_KEY + '.backup.precurated'] = 'KEEP'; S2.curatedRev = 'older0000000'; store[G.SAVE_KEY] = JSON.stringify(S2);
  const S3 = G.loadState();
  ok(store[G.SAVE_KEY + '.backup.precurated'] === 'KEEP' && Object.keys(store).filter(k => /backup/.test(k)).length === 1, 'a later content revision refreshes again but never overwrites or multiplies the backup');
  ok(JSON.stringify(S3.monsters) === JSON.stringify(S.monsters) && S3.curatedRev === REV, 'refreshing already-refreshed monsters gives the same result');
  store[G.SAVE_KEY] = saved;

  // 4. rollback: an older build (curated content off) reads the refreshed save as plain text, losing nothing
  const oldGame = load(false, { [G.SAVE_KEY]: saved }), R = oldGame.loadState();
  ok(R.monsters.length === S.monsters.length && JSON.stringify(R.monsters) === JSON.stringify(S.monsters), 'rollback: a build without curated content loads the refreshed save unchanged (names and text are plain stored strings)');
  ok(!oldGame.CURATED.revision && oldGame.curatedRefresh(R) === 0, 'rollback: without curated data nothing is refreshed or switched');
  oldGame.saveState(R); const back = load(true, { [G.SAVE_KEY]: JSON.stringify(R) }).loadState();
  ok(JSON.stringify(back.monsters) === JSON.stringify(S.monsters), 'roll forward again: same monsters');

  // 5. encyclopedia shows the curated identity for the top rarity seen; other species keep the first-seen name
  const d = S.dex['o:toaster'], dm = S.dex['o:mug'], da = S.dex['o:apple'];
  ok(G.curatedDexName(d, 'legendary') === P02.toaster.names.legendary && G.curatedDexName(d, 'common') === P02.toaster.names.common, `encyclopedia: toaster shows "${G.curatedDexName(d, 'legendary')}" (Legendary)`);
  ok(G.curatedDexName(dm, 'rare') === dm.monsterName, 'encyclopedia: objects without curated names keep the name first seen (mug, withheld)');
  ok(G.curatedDexName(da, 'rare') === P01.apple.names.rare, `encyclopedia: Pilot 01 apple shows its approved name "${G.curatedDexName(da, 'rare')}" (v0.5.0)`);
  ok(G.speciesLore(d, 'epic') === P02.toaster.lore.epic, 'encyclopedia: curated flavour text for the rarity');
  ok(JSON.stringify(S.dex) === JSON.stringify(before.dex), 'encyclopedia records themselves are not rewritten (discovery, counts, rarities kept)');
}

// 6. restoring a backup file refreshes too; nothing else changes
{
  const before = oldSave(), back = LIVE.importSave(PLAIN.exportSave(before));
  ok(back.curatedRev === REV && back.monsters.every((m, i) => noText(m) === noText(before.monsters[i])) && back.monsters.find(m => m.obj === 'dog' && m.rarity === 'epic').name === P02.dog.names.epic, 'restoring an older backup file: refreshed text, everything else identical');
}

// 7. no curated content at all: loading changes nothing and writes no backup
{
  const store = {}, G = load(false, store), before = oldSave(); store[G.SAVE_KEY] = JSON.stringify(before);
  const S = G.loadState();
  ok(JSON.stringify(S.monsters) === JSON.stringify(before.monsters) && !('curatedRev' in S) && !Object.keys(store).some(k => /backup/.test(k)), 'without curated data: monsters untouched, no revision stamp, no backup');
}

// 8. missing or broken content falls back per field
{
  const G = load(); const m = make(PLAIN, 'toaster', 'rare'); const keep = clone(m);
  G.CURATED.data = { toaster: { status: 'reviewed', names: { rare: 'TODO' }, lore: {}, moves: {} } };
  G.curatedApply(m); ok(m.name === keep.name && m.lore === keep.lore, 'a placeholder name and missing text leave the stored values');
  G.CURATED.data = { toaster: { status: 'draft', names: { rare: 'Charcoal Charlie' }, lore: { rare: 'A draft text that is long enough.' } } };
  ok(!G.curatedApply(m) && m.name === keep.name, 'draft entries never touch saved monsters');
  G.CURATED.data = { toaster: { status: 'reviewed', names: { rare: 'Charcoal Charlie' } } };
  G.CURATED.namesEnabled = false; G.curatedApply(m); ok(m.name === keep.name, 'names switched off: saved names untouched');
  ok(!G.curatedApply({ name: 'x' }) && !G.curatedApply(null), 'monsters without an object (or nothing) are ignored');
}

// 9. Quick Monster Test Mode roster shows the latest writing too
{
  const store = {}, G = load(true, store), m = make(PLAIN, 'kettle', 'epic', 'mutated'); m.id = 't1';
  store['snapmon.testroster.v1'] = JSON.stringify([{ ...m, test: true }]);
  const l = G.TestRoster.list(); ok(l[0].name === P02.kettle.names.epic && noText({ ...l[0], test: 0 }) === noText({ ...m, test: 0 }), `test roster: kettle shows "${l[0].name}", everything else identical`);
}

// 10. battles with a refreshed monster are identical to the old one (names never drive rules)
{
  const play = (TT, m) => { let s = 9; TT.setRNG(() => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }); const S = TT.freshState(); S.level = 8; const B = TT.newBattle(S, clone(m)), ev = [];
    for (let t = 0; t < 30 && !B.over; t++) { ev.push(TT.heroStrike(B, S, t % 3 === 0)); if (!B.over) ev.push(TT.enemyTurn(B)); } return JSON.stringify(ev, (k, v) => (k === 'name' ? undefined : k === 'msg' && typeof v === 'string' ? v.replace(/[^0-9.]/g, '') : v)); };
  const o = make(PLAIN, 'toilet', 'legendary', 'spectral'), r = clone(o); LIVE.curatedApply(r);
  ok(r.name !== o.name && play(LIVE, r) === play(PLAIN, o), `a refreshed Spectral Legendary toilet ("${r.name}") fights exactly like before`);
}

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CURATED-REFRESH CHECKS PASSED');
process.exit(bad ? 1 : 0);
