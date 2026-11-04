// Developer catalogue: review model (merge, approval, export/import) and isolation from the game. Fast, no browser.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RM = require('../catalogue/review-model.js'), ROOT = path.join(__dirname, '..');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const F = (status, note = '', proposal = '') => ({ status, note, proposal });

// field paths = the curated source keys
ok(['names.common', 'lore.legendary', 'moves.signature', 'moves.legend', 'moves.ultimate', 'moves.kit.cold_storage', 'visual', 'visual.rare.spectral', 'mapping'].every(RM.isPath)
  && !['names.mythic', 'lore', 'moves.kit.Bad Key', 'visual.rare', 'stats.hp', 'x'].some(RM.isPath), 'field paths are exactly the curated source keys (names/lore per rarity, moves per stable slot) plus visual/mapping');
ok(RM.decKey(RM.encKey('moves.kit.cold_storage')) === 'moves.kit.cold_storage' && !RM.encKey('lore.rare').includes('.'), 'Firestore map keys never contain dots (no field-path escaping)');

// three-way merge
{ const base = { 'names.rare': F('ok') }, local = { 'names.rare': F('ok'), 'lore.rare': F('fix', 'too mundane') }, server = { 'names.rare': F('ok'), 'moves.legend': F('fix', 'clumsy') };
  const m = RM.merge(base, local, server);
  ok(m.fields['lore.rare'].note === 'too mundane' && m.fields['moves.legend'].note === 'clumsy' && !Object.keys(m.conflicts).length, 'independent edits on two devices merge'); }
{ const base = { 'names.rare': F('todo', 'x') }, m = RM.merge(base, { 'names.rare': F('fix', 'phone') }, { 'names.rare': F('fix', 'desktop') });
  ok(m.fields['names.rare'].note === 'desktop' && m.conflicts['names.rare'].mine.note === 'phone' && m.conflicts['names.rare'].theirs.note === 'desktop', 'same field changed differently: server value kept, local value returned as an explicit conflict (both preserved)'); }
{ const m = RM.merge({ 'names.rare': F('ok') }, { 'names.rare': F('fix', 'same') }, { 'names.rare': F('fix', 'same') });
  ok(!Object.keys(m.conflicts).length && m.fields['names.rare'].note === 'same', 'the same change on both sides is not a conflict'); }
{ // stale base regression (found by the emulator test): a device that keeps its ORIGINAL base must not overwrite
  const base = { 'names.common': F('fix', 'old') }, A = { 'names.common': F('fix', 'A version') }, B = { 'names.common': F('fix', 'B version'), 'lore.common': F('ok') };
  const afterA = RM.merge(base, A, base).fields, mB = RM.merge(base, B, afterA);
  ok(mB.fields['names.common'].note === 'A version' && mB.fields['lore.common'].status === 'ok' && mB.conflicts['names.common'].mine.note === 'B version', 'offline edits on two devices: second device gets a conflict, never a silent overwrite'); }
{ const m = RM.merge({ 'lore.rare': F('fix', 'n') }, {}, { 'lore.rare': F('fix', 'n') });
  ok(!m.fields['lore.rare'] && !Object.keys(m.conflicts).length, 'a field cleared locally (undo) is removed on sync'); }

// approval never erases a fix or a note
{ const req = ['names.common', 'lore.common', 'visual'], f = { 'lore.common': F('fix', 'needs punchline'), 'names.common': F('todo', 'keep me') };
  const a = RM.approveAll(f, req, 'dev', 1);
  ok(a['lore.common'].status === 'fix' && a['lore.common'].note === 'needs punchline' && a['names.common'].status === 'ok' && a['names.common'].note === 'keep me' && a.visual.status === 'ok', '"Everything looks good" keeps Needs fix and notes, approves the rest');
  ok(RM.objectState(a, req) === 'fix' && RM.objectState(RM.approveAll({}, req, 'd', 1), req) === 'ok' && RM.objectState({ 'names.common': F('ok') }, req) === 'partial' && RM.objectState({}, req) === 'todo', 'object states: Needs fix > Approved > In progress > Unreviewed'); }

// export / import
{ const docs = { toaster: { 'names.common': F('fix', 'meh', 'Crumbster'), 'visual': F('ok') } };
  const exp = RM.buildExport(docs, { sourceOf: () => 'content/curated/pilot-02-approved.json', required: () => ['names.common', 'visual'], liveValue: () => 'Crumbit', nameOf: () => 'Toaster', now: 0, game: '0.5.1', revision: 'abc', total: 2308 });
  ok(exp.schema === RM.EXPORT_SCHEMA && exp.objects.toaster.fields['names.common'].live === 'Crumbit' && exp.patches['pilot-02-approved'].toaster['names.common'] === 'Crumbster' && exp.counts.fix === 1, 'export: ids, field paths, live values, patch-ready proposals per source file');
  const r = RM.parseImport(JSON.stringify(exp), id => id === 'toaster');
  ok(r.ok && r.entries.toaster['names.common'].proposal === 'Crumbster', 'import parses an export');
  const bad1 = RM.parseImport('{"schema":"other"}', () => true), bad2 = RM.parseImport(JSON.stringify({ ...exp, objects: { nope: exp.objects.toaster } }), id => id === 'toaster');
  ok(!bad1.ok && !Object.keys(bad2.entries).length && /unknown object/.test(bad2.errors[0]), 'import rejects foreign files and unknown object ids');
  const plan = RM.planImport(r.entries, { toaster: { 'names.common': F('fix', 'different') } });
  ok(plan.conflicts === 1 && plan.add === 1 && plan.same === 0, 'import plan: new fields added, a different existing review becomes a conflict (never overwritten)');
  ok(RM.planImport(r.entries, r.entries).same === 2, 'importing identical data changes nothing'); }

// generated source map is current; the catalogue never touches the game
{ let c = ''; try { c = execFileSync('node', [path.join(ROOT, 'tools/catalogue-sources.js'), '--check'], { encoding: 'utf8' }); } catch (e) { c = String(e.stdout); }
  ok(/up to date/.test(c), 'catalogue/sources.js is up to date (id → content/curated source file)');
  const code = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); // comments describe what is NOT used
  const src = ['app.js', 'cloud.js', 'review-model.js', 'index.html'].map(f => code(fs.readFileSync(path.join(ROOT, 'catalogue', f), 'utf8'))).join('\n');
  ok(!/saveState\(|loadState\(|SAVE_KEY|snapmon\.save|testroster|importSave|exportSave|curatedRefresh/.test(src), 'catalogue code never calls game save/load/refresh functions or game storage keys');
  ok(!/ui\.js|engine\.js|lens|clip-worker|models\/|getUserMedia/.test(src), 'catalogue loads no camera, recognition or model code');
  ok(/firebasejs\/13\.2\.0\/firebase-app\.js/.test(src) && /firebasejs\/13\.2\.0\/firebase-auth\.js/.test(src) && /firebasejs\/13\.2\.0\/firebase-firestore\.js/.test(src) && !/firebasejs\/(?!13\.2\.0)/.test(src), 'Firebase SDK pinned to 13.2.0 (app, auth, firestore)');
  ok(!/enableIndexedDbPersistence|persistentLocalCache|admin|serviceAccount|password\s*[:=]\s*['"]/i.test(src), 'no persistent Firestore cache, no admin SDK or service account, no stored password');
  const rules = fs.readFileSync(path.join(ROOT, 'catalogue/firestore.rules'), 'utf8');
  ok(/match \/catalogue\/\{userId\}\/\{document=\*\*\}/.test(rules) && /request\.auth\.uid == userId/.test(rules) && !/allow read, write: if true/.test(rules), 'reference rules are owner-only'); }

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CATALOGUE MODEL CHECKS PASSED'); process.exit(bad ? 1 : 0);
