// Curated writing foundation (Phase 1): the validator catches bad content, and the lookup falls back to the procedural
// text for anything missing, draft or malformed. Curated text is OFF by default and never touches the random streams.
// tests/generator-snapshot.js separately proves the live generator is byte-for-byte unchanged.
const fs = require('fs'), vm = require('vm'), path = require('path');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const load = (withCurated = true) => {
  const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape }; vm.createContext(ctx);
  const files = ['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js'].concat(withCurated ? ['curated.js'] : []);
  vm.runInContext(files.map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') +
    `;globalThis.T={OBJECTS,OBJECT_LIST,monsterLore,speciesLore,createMonster,freshState,exportSave,importSave,setRNG:f=>{RNG=f},${withCurated ? 'CURATED,validateCurated,curatedLore,curatedMoveName,curatedMoveSlots' : ''}}`, ctx);
  return ctx.T;
};
const T = load(), PLAIN = load(false);
const seedRng = T => { let s = 99; T.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; }); };
const make = (T, id, r) => { seedRng(T); const m = T.createMonster(T.freshState(), { obj: id, rarity: r, word: id }); delete m.seenAt; return m; };

// 1. inactive by default: loading curated.js changes nothing
ok(T.CURATED.enabled === false && T.CURATED.movesEnabled === false && Object.keys(T.CURATED.data).length === 0, 'curated text and move names are off by default, with no data');
ok(!/curated/.test(fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')) && !/curated/.test(fs.readFileSync(path.join(__dirname, '../tools/build.js'), 'utf8')), 'the game page and the single-file builds do not load curated.js');
const ids = ['x_energy_drink', 'x_light_switch', 'x_security_camera', 'cutlery_spoon', 'pen', 'padlock', 'mug', 'apple'];
const same = ids.every(id => ['common', 'rare', 'legendary'].every(r => JSON.stringify(make(T, id, r)) === JSON.stringify(make(PLAIN, id, r))));
ok(same, 'with curated.js loaded but off, monsters (names, moves, stats, DNA, lore) are identical to the game without it');

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

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CURATED-FOUNDATION CHECKS PASSED');
process.exit(bad ? 1 : 0);
