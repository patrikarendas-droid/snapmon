// Curated-writing pipeline (2026-11-02): inventory, monster names, batch workflow and lint. The tooling is offline;
// these checks also prove the game ignores draft content and draft names entirely, and (since the Pilot 02
// integration) that only REVIEWED names reach the game. Save refresh of existing monsters: tests/curated-refresh.js.
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
// v0.5.0: Pilot 01 gained its 50 approved names (content/campaign/PILOT01_NAMES_INTEGRATION.md); with the names removed
// it is exactly the v0.4.6 approved content, so lore, moves and status are untouched
{ const p01 = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/curated/pilot-01-approved.json'), 'utf8')), es = Object.values(p01.entries);
  ok(sha('content/curated/pilot-01-approved.json') === 'a8186977dd2e33b52de51942116f824f40c58962a289370d2a07b4f4007010e1', 'Pilot 01 approved file is the v0.5.0 version (names added)');
  ok(es.length === 10 && es.every(e => e.names && Object.keys(e.names).length === 5), 'Pilot 01: 10 objects with 5 approved names each');
  es.forEach(e => delete e.names);
  ok(crypto.createHash('sha256').update(JSON.stringify(p01)).digest('hex') === 'cbe9034e0db5b588458fd2ad7b047906d48db9b6d076834f4095931621e0c46a', 'Pilot 01 without the names is exactly the v0.4.6 approved content (lore, moves, status)'); }
ok(sha('content/curated/pilot-02-approved.json').startsWith('592b6ddfb9c7'), 'Pilot 02 approved file is byte-identical to v0.4.8');
{
  const live = T.CURATED.data, ids = Object.keys(live), withNames = ids.filter(id => live[id].names);
  ok(ids.length === T.OBJECT_LIST.length && ids.length === 2308 && ids.every(id => live[id].status === 'reviewed' && T.OBJECTS[id]), `live src/curated-data.js: ${ids.length} reviewed objects (every registry object, v0.5.0)`);
  ok(withNames.length === ids.length && withNames.every(id => Object.keys(live[id].names).length === 5), `live names: ${withNames.length} objects with 5 names each`);
  // every campaign batch file is live exactly as written (source JSON in content/curated/ is the editable truth)
  const camp = fs.readdirSync(path.join(ROOT, 'content/curated')).filter(f => /^w\d\d-.*\.json$/.test(f)); let n = 0, diff = [];
  for (const f of camp) for (const [id, e] of Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'content/curated', f), 'utf8')).entries)) { n++;
    const l = live[id]; if (e.status !== 'reviewed' || !l || JSON.stringify(l.names) !== JSON.stringify(e.names) || JSON.stringify(l.lore) !== JSON.stringify(e.lore) || JSON.stringify(l.moves || {}) !== JSON.stringify(e.moves || {})) diff.push(id); }
  ok(camp.length === 22 && n === 2248 && !diff.length, `22 campaign batch files, ${n} entries, all reviewed and live with exactly their source names, lore and move names${diff.length ? ': ' + diff.slice(0, 3) : ''}`);
  const curSrc = fs.readFileSync(path.join(ROOT, 'src/curated.js'), 'utf8'), body = n => curSrc.slice(curSrc.indexOf('function ' + n), curSrc.indexOf('\n}', curSrc.indexOf('function ' + n)));
  ok(/status === 'reviewed'/.test(body('curatedMonsterName')) && /namesEnabled/.test(body('curatedMonsterName')), 'the runtime name lookup reads only reviewed entries, behind its own switch (CURATED.namesEnabled)');
}

// 1b. live entries are guarded: campaign patch refuses them without --approved-edit (and changes nothing)
{ const tmp = path.join(require('os').tmpdir(), 'snapmon-guard-' + process.pid + '.json'), f = path.join(ROOT, 'content/curated/w01-mammals-1.json'), before = fs.readFileSync(f, 'utf8');
  const id = Object.keys(JSON.parse(before).entries)[0]; fs.writeFileSync(tmp, JSON.stringify({ [id]: { 'lore.common': 'A guard test line that must never be written to the live file.' } }));
  let out = ''; try { out = execFileSync('node', [path.join(ROOT, 'tools/campaign.js'), 'patch', 'w01-mammals-1', tmp], { encoding: 'utf8' }); } catch (e) { out = String(e.stdout || e.message); }
  fs.unlinkSync(tmp);
  ok(/is live \(reviewed\)/.test(out) && /nothing written/.test(out) && fs.readFileSync(f, 'utf8') === before, 'live (reviewed) entries cannot be patched without --approved-edit; the file is untouched'); }

// 2. inventory
let check = ''; try { check = execFileSync('node', [path.join(ROOT, 'tools/inventory.js'), '--check'], { encoding: 'utf8' }); } catch (e) { check = String(e.stdout || e.message); }
ok(/up to date/.test(check), 'content/inventory and docs/review/COVERAGE.md are up to date (node tools/inventory.js)');
const rows = fs.readFileSync(path.join(ROOT, 'content/inventory/inventory.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const ids = rows.map(r => r.id);
ok(rows.length === T.OBJECT_LIST.length && new Set(ids).size === ids.length && ids.every((id, i) => !i || ids[i - 1] < id), `inventory: one row per registry object (${rows.length}), unique, sorted`);
ok(rows.every(r => W.RAR.every(x => typeof r.names[x] === 'string' && typeof r.lore[x] === 'string') && ['signature', 'legend', 'ultimate'].every(k => r.moves.some(m => m.key === k))), 'every row has 5 current names, 5 procedural texts and signature/legend/ultimate slots');
const apple = rows.find(r => r.id === 'apple'), ped = rows.find(r => r.id === 'toaster');
ok(apple.curated.lore.status === 'reviewed' && apple.curated.lore.rarities.length === 5 && apple.curated.names.status === 'reviewed' && ped.curated.status === 'reviewed' && ped.curated.names.status === 'reviewed' && ped.curated.names.rarities.length === 5 && rows.every(r => r.curated.lore.status === 'reviewed' && r.curated.names.status === 'reviewed'), 'coverage per layer: every object has reviewed lore and names (Pilot 01 names since v0.5.0)');
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

// 4. names reach the game only from reviewed entries, only while switched on, and the build copies only reviewed names
{
  const L = load(), P = load(false), mk = (TT, id, r) => { let s = 3; TT.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; }); const m = TT.createMonster(TT.freshState(), { obj: id, rarity: r }); delete m.seenAt; return m; };
  L.CURATED.data.toaster = { status: 'draft', names: { common: 'Crumbit', legendary: 'The Grand Toastmaster' }, lore: {}, moves: {} };
  ok(['common', 'legendary'].every(r => mk(L, 'toaster', r).name === mk(P, 'toaster', r).name), 'a DRAFT entry with names never changes monster names');
  L.CURATED.data.toaster = { status: 'reviewed', names: { common: 'Crumbit', legendary: 'The Grand Toastmaster' }, lore: {}, moves: {} };
  ok(mk(L, 'toaster', 'common').name === 'Crumbit' && mk(L, 'toaster', 'legendary').name === 'The Grand Toastmaster' && mk(L, 'toaster', 'rare').name === mk(P, 'toaster', 'rare').name, 'a reviewed entry with names names the monster for those rarities; a missing rarity keeps the generated name');
  L.CURATED.namesEnabled = false;
  ok(mk(L, 'toaster', 'common').name === mk(P, 'toaster', 'common').name, 'names switched off (CURATED.namesEnabled = false): generated names again');
  const out = path.join(require('os').tmpdir(), 'snapmon-curated-build-test.js');
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'snapmon-cur-')), f = path.join(tmpDir, 'x.json');
  fs.writeFileSync(f, JSON.stringify({ schema: 1, entries: { toaster: { status: 'reviewed', names: { common: 'Crumbit' }, lore: { common: 'Burns one corner of your toast every time.' } }, kettle: { status: 'draft', names: { common: 'Steamlet' }, lore: { common: 'Sings for no reason at all.' } } } }));
  execFileSync('node', [path.join(ROOT, 'tools/curated.js'), 'build', '--out', out, f]);
  const built = fs.readFileSync(out, 'utf8'); fs.unlinkSync(out); fs.rmSync(tmpDir, { recursive: true });
  ok(built.includes('Burns one corner') && built.includes('Crumbit') && !built.includes('Steamlet') && !built.includes('Sings for no reason') && !/namesEnabled = true/.test(built) && /CURATED\.revision = '[0-9a-f]{12}'/.test(built), 'build copies reviewed names only (never drafts), switches nothing on without --enable, and writes a content revision');
}

// 5. Pilot 02: fixed manifest, approved (reviewed) and live, complete
{
  const m = W.readManifest('pilot-02'), draft = readDoc('content/curated/pilot-02-approved.json'), p01 = readDoc('content/curated/pilot-01-approved.json');
  const docs = [p01, draft];
  ok(m.ids.length === 50 && m.size === 50 && !W.checkManifest(T, m, docs).length, 'Pilot 02 manifest: exactly 50 valid, unique ids, not live from any other batch');
  ok(m.ids.every(id => !p01.doc.entries[id]), 'no Pilot 01 object is in Pilot 02');
  const entries = draft.doc.entries;
  ok(JSON.stringify(Object.keys(entries)) === JSON.stringify(m.ids), 'the approved file holds exactly the manifest ids, in manifest order');
  ok(Object.values(entries).every(e => e.status === 'reviewed'), 'every Pilot 02 entry is status "reviewed" (developer approval, 2026-11-02)');
  ok(m.ids.every(id => JSON.stringify(T.CURATED.data[id].names) === JSON.stringify(entries[id].names) && JSON.stringify(T.CURATED.data[id].lore) === JSON.stringify(entries[id].lore)), 'every Pilot 02 object is live with exactly its approved names and lore');
  const pr = W.progress(T, m, docs);
  ok(pr.filter(r => r.complete).length === 50, `progress: ${pr.filter(r => r.complete).length} of 50 objects have 5 names + 5 texts`);
  ok(!T.validateCurated(draft.doc, { file: 'pilot-02', raw: fs.readFileSync(path.join(ROOT, 'content/curated/pilot-02-approved.json'), 'utf8') }).errors.length, 'Pilot 02 approved file validates');
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
