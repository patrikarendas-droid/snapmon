// Curated writing: the validator catches bad content, the lookup falls back to the procedural text for anything missing,
// draft or malformed, and curated text never touches the random streams. Since v0.4.6 the game loads the reviewed
// Pilot 01 entries (src/curated-data.js): section 5 checks that ONLY those 10 objects' lore and move names change.
// tests/gameplay-baseline.js separately proves gameplay is unchanged.
const fs = require('fs'), vm = require('vm'), path = require('path');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const load = (withCurated = true, withData = false) => {
  const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape }; vm.createContext(ctx);
  const files = ['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js'].concat(withCurated ? ['curated.js'] : [], withData ? ['curated-data.js'] : []);
  vm.runInContext(files.map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') +
    `;globalThis.T={OBJECTS,OBJECT_LIST,monsterLore,speciesLore,createMonster,freshState,exportSave,importSave,setRNG:f=>{RNG=f},${withCurated ? 'CURATED,validateCurated,curatedLore,curatedMoveName,curatedMoveSlots' : ''}}`, ctx);
  return ctx.T;
};
const T = load(), PLAIN = load(false), LIVE = load(true, true); // T: curated.js alone (defaults), LIVE: as the game loads it
const seedRng = T => { let s = 99; T.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; }); };
const make = (T, id, r) => { seedRng(T); const m = T.createMonster(T.freshState(), { obj: id, rarity: r, word: id }); delete m.seenAt; return m; };

// 1. without the generated data file, curated.js alone is off and changes nothing
ok(T.CURATED.enabled === false && T.CURATED.movesEnabled === false && Object.keys(T.CURATED.data).length === 0, 'curated.js alone: text and move names off, no data (only src/curated-data.js switches them on)');
const ids = ['x_energy_drink', 'x_light_switch', 'x_security_camera', 'cutlery_spoon', 'pen', 'padlock', 'mug', 'apple'];
const same = ids.every(id => ['common', 'rare', 'legendary'].every(r => JSON.stringify(make(T, id, r)) === JSON.stringify(make(PLAIN, id, r))));
ok(same, 'with curated.js loaded but off, monsters (names, moves, stats, DNA, lore) are identical to the game without it');
const LIVE_SNAPSHOT = { enabled: LIVE.CURATED.enabled, movesEnabled: LIVE.CURATED.movesEnabled, data: JSON.parse(JSON.stringify(LIVE.CURATED.data)) };

// 2. validator
const v = (doc, raw) => T.validateCurated(doc, { file: 't', raw: raw || JSON.stringify(doc) });
const entry = (e, id = 'x_energy_drink') => ({ schema: 1, entries: { [id]: e } });
const good = { status: 'reviewed', lore: { common: 'Rattles in your bag all day, then sprays the ceiling when opened.', legendary: ['It kept the first sunrise awake.', 'Night itself waits for it to blink.'] }, moves: { signature: 'Caffeine Spike', 'kit.fizz_burst': 'Shake and Pop' } };
ok(!v(entry(good)).errors.length, 'a correct entry validates');
const ex = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/curated-example.json'), 'utf8'));
ok(!T.validateCurated(ex, { file: 'example' }).errors.length && ex.entries.x_energy_drink.status === 'draft', 'the documented example validates (and is a draft)');
const dir = path.join(__dirname, '../content/curated'), contentFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
ok(contentFiles.every(f => { const raw = fs.readFileSync(path.join(dir, f), 'utf8'); return !T.validateCurated(JSON.parse(raw), { file: f, raw }).errors.length; }), `content/curated: ${contentFiles.length} file(s), all valid (an empty folder is fine)`);
const cases = [
  ['unknown object id', entry(good, 'energy_drink'), /not an object id/],
  ['alias or display name instead of the id', entry(good, 'light_switch'), /did you mean "x_light_switch"/],
  ['wrong schema version', { schema: 2, entries: {} }, /"schema" must be 1/],
  ['entries missing', { schema: 1 }, /"entries" must be an object/],
  ['unknown field (typo)', entry({ lores: {} }), /unknown field "lores"/],
  ['bad rarity', entry({ lore: { mythic: 'Some text that is long enough.' } }), /rarity "mythic"/],
  ['wrong type', entry({ lore: { common: 42 } }), /must be (a )?text/],
  ['blank text', entry({ lore: { common: '   ' } }), /too short|start\/end/],
  ['too long', entry({ lore: { common: 'x'.repeat(230) + '.' } }), /max 220/],
  ['template token', entry({ lore: { common: 'The {obj} rattles in your bag all day.' } }), /placeholder/],
  ['leftover TODO', entry({ lore: { common: 'TODO write something good here.' } }), /placeholder/],
  ['repeated variant', entry({ lore: { rare: ['Same sentence twice here.', 'Same sentence twice here.'] } }), /appears twice/],
  ['bad status', entry({ status: 'live', lore: { common: 'A perfectly fine sentence here.' } }), /"status" must be/],
  ['unknown move key', entry({ moves: { 'kit.laser_zap': 'Zap' } }), /unknown move key "kit.laser_zap"/],
  ['move name too long', entry({ moves: { signature: 'An Extremely Long Move Name Indeed' } }), /3–28 characters/],
  ['move names collide (shared cooldown)', entry({ moves: { signature: 'Big Gulp' } }), /move names must differ/],
];
for (const [what, doc, re] of cases) { const r = v(doc); ok(r.errors.some(e => re.test(e)), `validator catches: ${what}${r.errors.some(e => re.test(e)) ? '' : ' — got ' + JSON.stringify(r.errors)}`); }
const dupRaw = '{"schema":1,"entries":{"pen":{"lore":{"common":"Writes your name wrong on purpose."}},"pen":{"lore":{"rare":"A second entry for the same pen."}}}}';
ok(v(JSON.parse(dupRaw), dupRaw).errors.some(e => /duplicate key "pen"/.test(e)), 'validator catches: duplicate key inside one file');
const seen = new Map(); T.validateCurated(entry(good), { file: 'a.json', seen }); ok(T.validateCurated(entry(good), { file: 'b.json', seen }).errors.some(e => /also defined in a.json/.test(e)), 'validator catches: the same object in two files');
ok(v(entry({ lore: { common: 'Mentions a toolbox for no reason at all.' } })).warnings.some(w => /toolbox/.test(w)), 'validator warns: toolbox mentioned for a non-toolbox');

// 3. fallback behaviour once switched on (test-only)
T.CURATED.enabled = true;
T.CURATED.data = {
  x_energy_drink: { status: 'reviewed', lore: { common: ['Variant one, long enough.', 'Variant two, long enough.'], rare: 'Curated rare text for the drink.' }, moves: { signature: 'Caffeine Spike' } },
  pen: { status: 'draft', lore: { common: 'A draft line that must not appear.' } },
  padlock: { status: 'reviewed', lore: { common: 42, rare: ['', '{obj} placeholder text here'], epic: 'Valid epic text for the padlock.' } },
  mug: 'garbage', apple: null,
};
const base = id => ({ obj: id, seed: 7 });
const lo = (id, r, s = 7) => T.monsterLore({ obj: id, rarity: r, seed: s }), plain = (id, r, s = 7) => PLAIN.monsterLore({ obj: id, rarity: r, seed: s });
ok(lo('x_energy_drink', 'rare') === 'Curated rare text for the drink.', 'switched on: a reviewed entry provides the text for its rarity');
ok(lo('x_energy_drink', 'common', 0) === 'Variant one, long enough.' && lo('x_energy_drink', 'common', 1) === 'Variant two, long enough.', 'variants are chosen by the monster seed (deterministic)');
ok(lo('x_energy_drink', 'epic') === plain('x_energy_drink', 'epic'), 'a missing rarity falls back to the current generator');
ok(lo('pen', 'common') === plain('pen', 'common'), 'draft entries are never used');
ok(lo('padlock', 'common') === plain('padlock', 'common') && lo('padlock', 'rare') === plain('padlock', 'rare') && lo('padlock', 'epic') === 'Valid epic text for the padlock.', 'malformed fields (number, blank, placeholder) fall back; valid ones still work');
ok(lo('mug', 'common') === plain('mug', 'common') && lo('apple', 'rare') === plain('apple', 'rare') && lo('x_light_switch', 'rare') === plain('x_light_switch', 'rare'), 'garbage, null and absent entries fall back');
const a = make(T, 'x_energy_drink', 'rare'), b = make(PLAIN, 'x_energy_drink', 'rare');
ok(a.lore === 'Curated rare text for the drink.' && JSON.stringify({ ...a, lore: 0 }) === JSON.stringify({ ...b, lore: 0 }), 'curated text changes ONLY the lore: name, moves, stats, DNA and seed are identical');
ok(a.abilities[0].name === b.abilities[0].name && T.curatedMoveName('x_energy_drink', 'signature') === null, 'move names stay unchanged (move overrides are not wired in and are separately switched off)');
// stored lore is never rewritten: an existing monster keeps its text through backup/load even with curated text on
const S = T.freshState(); S.monsters = [{ ...b, id: 'm1' }]; const back = T.importSave(T.exportSave(S));
ok(back.monsters[0].lore === b.lore, 'existing monsters keep their stored text (backup/load) even when curated text is on');
T.CURATED.data = { x_energy_drink: { status: 'reviewed', lore: { common: 'x'.repeat(400) } } };
ok(lo('x_energy_drink', 'common') === plain('x_energy_drink', 'common'), 'over-long text in data that skipped validation still falls back');
T.CURATED.enabled = false;
ok(lo('x_energy_drink', 'rare') === plain('x_energy_drink', 'rare'), 'switched off again: back to the procedural text');

// 5. activation (v0.4.6, Pilot 01): exactly the reviewed content, loaded by the game, changing only text
{
  const docs = contentFiles.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))), want = {};
  for (const d of docs) for (const [id, e] of Object.entries(d.entries)) if (e.status === 'reviewed') want[id] = { status: 'reviewed', lore: e.lore || {}, moves: e.moves || {} };
  ok(LIVE_SNAPSHOT.enabled && LIVE_SNAPSHOT.movesEnabled, 'the game switches curated text and move names on (src/curated-data.js)');
  ok(JSON.stringify(LIVE_SNAPSHOT.data) === JSON.stringify(Object.fromEntries(Object.keys(want).sort().map(k => [k, want[k]]))), `src/curated-data.js matches content/curated exactly (${Object.keys(want).length} reviewed entries; rebuild with: node tools/curated.js build --out src/curated-data.js --enable)`);
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'), at = f => html.indexOf(`<script src="src/${f}"></script>`);
  ok(at('game.js') > 0 && at('curated.js') > at('game.js') && at('curated-data.js') > at('curated.js') && at('ui.js') > at('curated-data.js'), 'index.html loads curated.js then curated-data.js after game.js and before the UI');
  const dist = fs.readFileSync(path.join(__dirname, '../dist/snapmon.html'), 'utf8');
  ok(dist.includes('CURATED.enabled = true;') && dist.includes(LIVE_SNAPSHOT.data.apple.lore.legendary), 'the single-file build contains the activated Pilot 01 data (rebuild with node tools/build.js)');
  const pilot = new Set(Object.keys(want)), noText = m => JSON.stringify({ ...m, lore: 0, abilities: m.abilities.map(a => ({ ...a, name: 0 })) });
  let other = [], pilotBad = [], n = 0;
  for (const id of Object.keys(LIVE.OBJECTS)) for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary']) for (const variant of [null, 'spectral', 'mutated']) {
    const mk = TT => { seedRng(TT); const m = TT.createMonster(TT.freshState(), { obj: id, rarity: r, variant, word: id }); delete m.seenAt; return m; };
    const a = mk(LIVE), b = mk(PLAIN); n++;
    if (!pilot.has(id)) { if (JSON.stringify(a) !== JSON.stringify(b)) other.push(`${id}/${r}/${variant}`); continue; }
    const e = want[id], names = a.abilities.map(x => e.moves[x.key] || b.abilities.find(y => y.key === x.key).name);
    if (noText(a) !== noText(b) || a.lore !== e.lore[r] || JSON.stringify(a.abilities.map(x => x.name)) !== JSON.stringify(names)) pilotBad.push(`${id}/${r}/${variant}`);
  }
  ok(!other.length, `${n} monsters: every non-Pilot object is byte-identical to the game without curated content${other.length ? ': ' + other.slice(0, 3).join(', ') : ''}`);
  ok(!pilotBad.length, `Pilot 01 monsters: the approved lore for their rarity and the approved move names by key; everything else (stats, keys, numbers, DNA, name) identical${pilotBad.length ? ': ' + pilotBad.slice(0, 3).join(', ') : ''}`);
  const sp = (TT, id, r) => TT.speciesLore({ key: 'o:' + id, obj: id, cat: TT.OBJECTS[id].cat, fam: null, monsterName: TT.OBJECTS[id].name }, r);
  ok([...pilot].every(id => ['common', 'uncommon', 'rare', 'epic', 'legendary'].every(r => sp(LIVE, id, r) === want[id].lore[r])) && ['mug', 'cutlery_spoon', 'x_power_socket'].every(id => sp(LIVE, id, 'rare') === sp(PLAIN, id, 'rare')), 'encyclopedia: Pilot 01 species show the approved text (also for species already discovered); others unchanged');
  const old = make(PLAIN, 'apple', 'legendary'), S = LIVE.freshState(); S.monsters = [{ ...old, id: 'm1' }];
  const back = LIVE.importSave(LIVE.exportSave(S)).monsters[0];
  ok(back.lore === old.lore && JSON.stringify(back.abilities.map(a => a.name)) === JSON.stringify(old.abilities.map(a => a.name)), 'existing monsters keep their stored text and move names after the update (backup/load)');
  const de = make(LIVE, 'x_energy_drink', 'legendary'), ls = make(LIVE, 'x_light_switch', 'legendary');
  ok(de.abilities[0].name === 'Wake-Up Call' && de.abilities.find(a => a.key === 'legend').name === 'Caffeine Crash' && ls.abilities[0].name === 'Lights Out' && ls.abilities.find(a => a.key === 'ultimate').name === 'The Big Switch', `examples: ${de.abilities.map(a => a.name).join(', ')} | ${ls.abilities.map(a => a.name).join(', ')}`);
}

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CURATED CHECKS PASSED');
process.exit(bad ? 1 : 0);
