// Curated-writing pipeline (2026-11-02): inventory, draft-only monster names, batch workflow and lint. Everything here
// is offline tooling: these checks also prove the game ignores draft content and draft monster names entirely.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
const load = (withData = true) => {
  const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape }; vm.createContext(ctx);
  vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'curated.js'].concat(withData ? ['curated-data.js'] : []).map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n') +
    ';globalThis.T={OBJECTS,OBJECT_LIST,CATEGORY,CURATED,validateCurated,curatedMoveSlots,createMonster,freshState,moveKit,cdFor,setRNG:f=>{RNG=f}}', ctx);
  return ctx.T;
};
const T = load(), W = require('../tools/curated-workflow');
const readDoc = f => ({ rel: f, doc: JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) });

// 1. live content untouched
ok(sha('content/curated/pilot-01-approved.json') === 'ced698205fb806ef2930cdfa1c4eb844ac2f95d591bf47635a4b77db226baca7', 'Pilot 01 approved file is byte-identical to v0.4.6/v0.4.7');
ok(sha('src/curated-data.js') === '85f4ee80ffa338c508958c739cd1a0baa1ec2960514f5f0976b5d0b5a18521b6' && Object.keys(T.CURATED.data).length === 10, 'live src/curated-data.js unchanged: still only the 10 Pilot 01 objects');
const liveTxt = fs.readFileSync(path.join(ROOT, 'src/curated-data.js'), 'utf8');
const runtime = fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js') && !/^curated/.test(f)).map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
const curSrc = fs.readFileSync(path.join(ROOT, 'src/curated.js'), 'utf8'), body = n => curSrc.slice(curSrc.indexOf('function ' + n), curSrc.indexOf('\n}', curSrc.indexOf('function ' + n)));
ok(!/"names"/.test(liveTxt) && !/CURATED[^\n]*names|curated\w*Name\b(?<!MoveName)/.test(runtime) && !/names/.test(body('curatedLore')) && !/names/.test(body('curatedMoveName')), 'no monster-name data in the live file; no game code or runtime lookup reads curated names');

// 2. inventory
let check = ''; try { check = execFileSync('node', [path.join(ROOT, 'tools/inventory.js'), '--check'], { encoding: 'utf8' }); } catch (e) { check = String(e.stdout || e.message); }
ok(/up to date/.test(check), 'content/inventory and docs/review/COVERAGE.md are up to date (node tools/inventory.js)');
const rows = fs.readFileSync(path.join(ROOT, 'content/inventory/inventory.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const ids = rows.map(r => r.id);
ok(rows.length === T.OBJECT_LIST.length && new Set(ids).size === ids.length && ids.every((id, i) => !i || ids[i - 1] < id), `inventory: one row per registry object (${rows.length}), unique, sorted`);
ok(rows.every(r => W.RAR.every(x => typeof r.names[x] === 'string' && typeof r.lore[x] === 'string') && ['signature', 'legend', 'ultimate'].every(k => r.moves.some(m => m.key === k))), 'every row has 5 current names, 5 procedural texts and signature/legend/ultimate slots');
const apple = rows.find(r => r.id === 'apple'), ped = rows.find(r => r.id === 'toaster');
ok(apple.curated.lore.status === 'reviewed' && apple.curated.lore.rarities.length === 5 && apple.curated.names.status === 'not-started' && ped.curated.status === 'draft' && ped.curated.names.rarities.length === 5, 'coverage per layer: Pilot 01 lore reviewed, names not started; Pilot 02 drafts counted as draft');
ok(rows.find(r => r.id === 'x_energy_drink').moves.find(m => m.key === 'ultimate').variantsDiffer === true, 'inventory records when an Ultimate effect differs by variant');

// 3. draft monster names: schema
const v = e => T.validateCurated({ schema: 1, entries: { toaster: e } }, { file: 't' });
ok(!v({ status: 'draft', names: { common: 'Crumbit', legendary: 'The Grand Toastmaster' } }).errors.length, 'names field accepted (schema 1, backward compatible)');
const nameCases = [
  ['bad rarity', { names: { mythic: 'Crumbit' } }, /names rarity "mythic"/],
  ['too long', { names: { common: 'A Very Long Monster Name Indeed' } }, /characters/],
  ['legendary too long', { names: { legendary: 'The Grand Toastmaster Of All The Kitchens Ever' } }, /characters/],
  ['lower-case start', { names: { common: 'crumbit' } }, /capital/],
  ['placeholder', { names: { common: 'TODO name' } }, /placeholder|capital/],
  ['same name twice in one object', { names: { common: 'Crumbit', rare: 'crumbit' } }, /same name as names.common/],
  ['not text', { names: { common: 7 } }, /must be text/],
  ['bad status', { status: 'approved', names: { common: 'Crumbit' } }, /status/],
];
for (const [what, e, re] of nameCases) ok(v(e).errors.some(x => re.test(x)), `names validator catches: ${what}`);
ok(v({ names: { common: 'Toaster' } }).warnings.some(w => /object's own name/.test(w)), 'names validator warns when a name is just the object label');
ok(!v({ status: 'needs-revision', names: { common: 'Crumbit' } }).errors.length, 'status "needs-revision" is accepted (and is never live)');

// 4. the game ignores names, even if an entry with names were marked reviewed and switched on
{
  const L = load(), P = load(false), mk = (TT, id, r) => { let s = 3; TT.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; }); const m = TT.createMonster(TT.freshState(), { obj: id, rarity: r }); delete m.seenAt; return m; };
  L.CURATED.data.toaster = { status: 'reviewed', names: { common: 'Crumbit', legendary: 'The Grand Toastmaster' }, lore: {}, moves: {} };
  ok(['common', 'legendary'].every(r => mk(L, 'toaster', r).name === mk(P, 'toaster', r).name), 'a reviewed entry WITH names still does not change monster names (not wired into the game)');
  const out = path.join(require('os').tmpdir(), 'snapmon-curated-build-test.js');
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'snapmon-cur-')), f = path.join(tmpDir, 'x.json');
  fs.writeFileSync(f, JSON.stringify({ schema: 1, entries: { toaster: { status: 'reviewed', names: { common: 'Crumbit' }, lore: { common: 'Burns one corner of your toast every time.' } } } }));
  execFileSync('node', [path.join(ROOT, 'tools/curated.js'), 'build', '--out', out, f]);
  const built = fs.readFileSync(out, 'utf8'); fs.unlinkSync(out); fs.rmSync(tmpDir, { recursive: true });
  ok(built.includes('Burns one corner') && !built.includes('Crumbit') && !/"names"/.test(built), 'build never copies monster names into browser data, even for reviewed entries');
}

// 5. Pilot 02: fixed manifest, all draft, complete, not live
{
  const m = W.readManifest('pilot-02'), draft = readDoc('content/curated/pilot-02-draft.json'), p01 = readDoc('content/curated/pilot-01-approved.json');
  const docs = [p01, draft];
  ok(m.ids.length === 50 && m.size === 50 && !W.checkManifest(T, m, docs).length, 'Pilot 02 manifest: exactly 50 valid, unique, not-yet-live ids');
  ok(m.ids.every(id => !p01.doc.entries[id]), 'no Pilot 01 object is in Pilot 02');
  const entries = draft.doc.entries;
  ok(JSON.stringify(Object.keys(entries)) === JSON.stringify(m.ids), 'the draft file holds exactly the manifest ids, in manifest order');
  ok(Object.values(entries).every(e => e.status === 'draft'), 'every Pilot 02 entry is status "draft" (never reviewed)');
  ok(m.ids.every(id => !T.CURATED.data[id]), 'no Pilot 02 object is in the live data');
  const pr = W.progress(T, m, docs);
  ok(pr.filter(r => r.complete).length === 50, `progress: ${pr.filter(r => r.complete).length} of 50 objects have 5 names + 5 texts`);
  ok(!T.validateCurated(draft.doc, { file: 'pilot-02', raw: fs.readFileSync(path.join(ROOT, 'content/curated/pilot-02-draft.json'), 'utf8') }).errors.length, 'Pilot 02 draft file validates');
  for (const [id, e] of Object.entries(entries)) { const slots = T.curatedMoveSlots(id); if (Object.keys(e.moves || {}).some(k => !(k in slots))) ok(false, `${id}: unknown move key`); }
  const flags = W.lint(T, docs, { batch: 'pilot-02' });
  ok(!flags.some(f => f.sev === 'high'), `lint on Pilot 02: no high-severity flags (${flags.filter(f => f.sev === 'medium').length} medium, ${flags.filter(f => f.sev === 'low').length} low)`);
  ok(JSON.stringify(flags) === JSON.stringify(W.lint(T, docs, { batch: 'pilot-02' })), 'lint is deterministic');
}

// 6. lint catches planted problems
{
  const doc = { rel: 'planted.json', doc: { schema: 1, batch: 'planted', entries: {
    toaster: { status: 'draft', names: { common: 'Crumbit' }, lore: { common: 'Ancient scrolls tell of a toaster that ruled the kingdom.', rare: 'Pops toast so high it lands in the garden next door.' }, moves: { legend: 'Fiery Inferno', ultimate: 'Scalding Doom', 'kit.power_hum': 'Healing Rest' } },
    kettle: { status: 'draft', names: { common: 'Crumbit' }, lore: { common: 'Pops toast so high it lands in the garden next door.' } },
  } } };
  const fl = W.lint(T, [doc]), has = (id, rule) => fl.some(f => f.id === id && f.rule === rule);
  ok(has('kettle', 'duplicate-text') || has('toaster', 'duplicate-text'), 'lint: duplicate text across objects');
  ok(has('toaster', 'duplicate-name') && has('kettle', 'duplicate-name'), 'lint: duplicate monster name');
  ok(has('toaster', 'generic-filler'), 'lint: generic myth filler');
  ok(has('toaster', 'move-effect'), 'lint: move name promising an effect the move does not have');
  ok(has('toaster', 'ultimate-variants'), 'lint: Ultimate name tied to one effect although variants differ');
}

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CURATED-PIPELINE CHECKS PASSED');
process.exit(bad ? 1 : 0);
