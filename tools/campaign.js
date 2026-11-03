#!/usr/bin/env node
// Full curated-writing campaign (all registry objects). Offline. Resumable from files: content/campaign/.
//   node tools/campaign.js init                  freeze the campaign manifest + content/batches/w*.json (never overwrites)
//   node tools/campaign.js next [batch]           print the next unwritten object ids (first incomplete batch by default)
//   node tools/campaign.js brief <batch> [from] [n]   compact writer brief for objects of a batch (facts + move slots)
//   node tools/campaign.js ingest <batch> <file>  convert a compact draft file (format below) into content/curated/<batch>-draft.json
//   node tools/campaign.js status                 reconcile every registry id; write content/campaign/STATUS.md (+ status.json)
//   node tools/campaign.js immutable              check that every live (approved) file is byte-identical to the recorded baseline
//   node tools/campaign.js rebaseline "<reason>"  after a deliberate, developer-approved edit: record the new hashes + reason
//   ingest/patch refuse to change entries with status "reviewed" (live) unless --approved-edit is given.
//   node tools/campaign.js patch <batch> <json>   merge editor-pass fixes {id: {"lore.rare": …}} into the batch draft
// Compact draft format (one block per object, lines in any order):
//   @<object id>
//   N: common | uncommon | rare | epic | legendary          (five monster names)
//   1: … 2: … 3: … 4: … 5: …                                 (lore common … legendary)
//   M: signature=Name; kit.slug=Name; legend=Name; ultimate=Name   (move display names, stable keys only)
//   K: kit.slug, …                                           (optional: used default names kept on purpose)
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), CAMP = path.join(ROOT, 'content/campaign'), CUR = path.join(ROOT, 'content/curated'), BAT = path.join(ROOT, 'content/batches');
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const inventory = () => fs.readFileSync(path.join(ROOT, 'content/inventory/inventory.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
let T = null; const game = () => { if (T) return T; const ctx = { console, Math, JSON, Date }; vm.createContext(ctx);
  vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'curated.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n') + ';globalThis.T={OBJECTS,curatedMoveSlots,validateCurated,CURATED_LIMITS}', ctx); return (T = ctx.T); };
// every live content file is protected (v0.5.0: the 22 campaign batches were released and joined Pilot 01/02)
const APPROVED = fs.readdirSync(CUR).filter(f => f.endsWith('.json') && !f.endsWith('-draft.json')).sort().map(f => 'content/curated/' + f);
// a batch's content file: content/curated/<batch>.json once released, <batch>-draft.json while still being written
const batchFile = batch => fs.existsSync(path.join(CUR, batch + '.json')) ? path.join(CUR, batch + '.json') : path.join(CUR, batch + '-draft.json');
const APPROVED_EDIT = process.argv.includes('--approved-edit');

// thematic partition of the not-yet-written objects (sorted by look, then name, so neighbours can be told apart)
const PLAN = [
  ['w01-mammals-1', ['animal'], 0], ['w02-mammals-2', ['animal'], 1], ['w03-birds-and-sea-life', ['bird', 'fish']], ['w04-bugs-and-reptiles', ['bug', 'reptile']],
  ['w05-vehicles-1', ['car', 'street'], 0], ['w06-vehicles-2', ['car', 'street'], 1], ['w07-clothing-and-shoes', ['cloth', 'shoe']], ['w08-bags-jewellery-and-carry', ['bag', 'jewel', 'cosmetic', 'keys', 'umbrella']],
  ['w09-gadgets-and-computers', ['gadget', 'computer', 'laptop', 'phone']], ['w10-screens-sound-and-light', ['media', 'tv', 'camera', 'arcade', 'electric', 'alarm', 'light', 'lamp']],
  ['w11-office-books-and-art', ['office', 'book', 'art', 'craft']], ['w12-house-odds-and-ends', ['science', 'medical', 'clock', 'candle', 'mirror', 'door', 'toilet', 'trash']],
  ['w13-tools-and-sport', ['tool', 'hardware', 'gym', 'sport']], ['w14-garden-and-plants', ['outdoor', 'plant']], ['w15-trees-fruit-and-veg', ['tree', 'leafy', 'fruit', 'veg']],
  ['w16-toys-and-games', ['toy', 'toyish', 'ball']], ['w17-furniture-and-bedding', ['chair', 'furniture', 'pillow', 'sofa']], ['w18-music-and-instruments', ['music', 'instrument', 'banana']],
  ['w19-kitchen-and-cookware', ['kitchen', 'pot', 'appliance']], ['w20-fridges-taps-and-tableware', ['fridge', 'faucet', 'mug', 'bowl']],
  ['w21-sweets-bakery-and-snacks', ['cake', 'bakery', 'snack', 'breakfast', 'dairy', 'dumpling']], ['w22-drinks-pantry-and-meals', ['condiment', 'pantry', 'drink', 'bottle', 'meat', 'seafood', 'nut']],
];

function init() {
  const mf = path.join(CAMP, 'manifest.json');
  if (fs.existsSync(mf)) { console.log('campaign manifest exists (frozen):', path.relative(ROOT, mf)); return; }
  const rows = inventory(), approved = APPROVED.map(f => readJSON(path.join(ROOT, f)));
  const p01 = Object.keys(approved[0].entries).sort(), p02 = Object.keys(approved[1].entries).sort(), done = new Set([...p01, ...p02]);
  const fresh = rows.filter(r => !done.has(r.id)), batches = [], used = new Set();
  for (const [b, themes, part] of PLAN) {
    let list = fresh.filter(r => themes.includes(r.theme)).sort((a, c) => (a.look || '').localeCompare(c.look || '') || a.name.localeCompare(c.name) || a.id.localeCompare(c.id));
    if (part !== undefined) { const h = Math.ceil(list.length / 2); list = part === 0 ? list.slice(0, h) : list.slice(h); }
    for (const r of list) { if (used.has(r.id)) throw new Error('duplicate ' + r.id); used.add(r.id); }
    batches.push({ batch: b, themes, ids: list.map(r => r.id) });
  }
  const missing = fresh.filter(r => !used.has(r.id)); if (missing.length) throw new Error('unassigned: ' + missing.map(r => r.id).join(', '));
  const manifest = { created: new Date().toISOString().slice(0, 10), registry: rows.length, baseline: Object.fromEntries(APPROVED.map(f => [f, sha(path.join(ROOT, f))])),
    partition: { approvedComplete: { owner: 'content/curated/pilot-02-approved.json', ids: p02 }, approvedNamesMissing: { owner: 'content/curated/pilot-01-approved.json', namesProposal: 'content/campaign/pilot-01-names-proposal.json', ids: p01 }, newContent: batches.map(b => ({ batch: b.batch, size: b.ids.length })) },
    counts: { objects: rows.length, approvedComplete: p02.length, approvedNamesMissing: p01.length, new: fresh.length, newNames: fresh.length * 5 + p01.length * 5, newLore: fresh.length * 5 } };
  fs.mkdirSync(CAMP, { recursive: true }); fs.mkdirSync(BAT, { recursive: true });
  for (const b of batches) { const f = path.join(BAT, b.batch + '.json'); if (fs.existsSync(f)) throw new Error('batch exists (frozen): ' + f);
    fs.writeFileSync(f, JSON.stringify({ batch: b.batch, size: b.ids.length, created: manifest.created, rule: `Full writing campaign: every not-yet-written registry object with theme ${b.themes.join(', ')}${PLAN.find(p => p[0] === b.batch)[2] !== undefined ? ' (half ' + (PLAN.find(p => p[0] === b.batch)[2] + 1) + ' of 2, by look then name)' : ''}, sorted by look then name. Fixed list.`, ids: b.ids }, null, 1)); }
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 1));
  console.log(`campaign: ${rows.length} objects = ${p02.length} approved + ${p01.length} approved (names missing) + ${fresh.length} new in ${batches.length} batches`);
}

const slotLine = m => { const mech = typeof m.mech === 'string' ? m.mech : (m.variantsDiffer ? 'VARIES: ' : '') + Object.entries(m.mech).map(([k, v]) => k + ' ' + v).join(' / '); return `${m.key}="${m.default}" [${mech}] ${m.rarities.length === 5 ? 'all' : m.rarities.map(r => r[0].toUpperCase()).join('')}`; };
function brief(batch, from = 0, n = 25) {
  const ids = readJSON(path.join(BAT, batch + '.json')).ids.slice(+from, +from + +n), rows = new Map(inventory().map(r => [r.id, r]));
  for (const id of ids) { const r = rows.get(id);
    console.log(`@${id} · ${r.name} · ${r.categoryName}${r.group ? ' · ' + r.group : ''} · looks like ${r.look}${r.aliases.length ? ' · aka ' + r.aliases.slice(0, 6).join(', ') : ''}`);
    console.log('  ' + r.moves.filter(m => m.rarities.length).map(slotLine).join(' | ')); }
}

function parseCompact(text) {
  const out = {}; let cur = null;
  for (const raw of text.split('\n')) { const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    if (line.startsWith('@')) { cur = line.slice(1).trim(); if (out[cur]) throw new Error('duplicate block ' + cur); out[cur] = { status: 'draft', names: {}, lore: {}, moves: {} }; continue; }
    if (!cur) throw new Error('line before first @id: ' + line);
    const m = /^([N12345MK]):\s*(.*)$/.exec(line); if (!m) throw new Error(`${cur}: unreadable line: ${line}`);
    const [, k, v] = m, e = out[cur];
    if (k === 'N') { const parts = v.split('|').map(s => s.trim()); if (parts.length !== 5) throw new Error(`${cur}: N needs 5 names`); RAR.forEach((r, i) => { e.names[r] = parts[i]; }); }
    else if (k === 'M') { for (const p of v.split(';').map(s => s.trim()).filter(Boolean)) { const [key, ...nm] = p.split('='); e.moves[key.trim()] = nm.join('=').trim(); } }
    else if (k === 'K') e.keep = v.split(',').map(s => s.trim()).filter(Boolean);
    else e.lore[RAR[+k - 1]] = v;
  }
  return out;
}
function allNames(exceptBatch) { const names = new Map();
  for (const f of fs.readdirSync(CUR).filter(f => f.endsWith('.json'))) { if (exceptBatch && path.join(CUR, f) === batchFile(exceptBatch)) continue; const d = readJSON(path.join(CUR, f));
    for (const [id, e] of Object.entries(d.entries || {})) for (const v of Object.values(e.names || {})) names.set(v.toLowerCase(), id + ' (' + f + ')'); }
  const pp = path.join(CAMP, 'pilot-01-names-proposal.json'); if (fs.existsSync(pp)) for (const [id, ns] of Object.entries(readJSON(pp).names)) for (const v of Object.values(ns)) names.set(v.toLowerCase(), id + ' (pilot-01 names proposal)');
  return names; }

function ingest(batch, file) {
  const G = game(), ids = new Set(readJSON(path.join(BAT, batch + '.json')).ids), blocks = parseCompact(fs.readFileSync(file, 'utf8')), errs = [];
  const out = batchFile(batch), doc = fs.existsSync(out) ? readJSON(out) : { schema: 1, batch, entries: {} };
  const taken = allNames(batch); for (const [id, e] of Object.entries(doc.entries)) if (!blocks[id]) for (const v of Object.values(e.names || {})) taken.set(v.toLowerCase(), id + ' (this batch)');
  for (const [id, e] of Object.entries(blocks)) {
    if (!ids.has(id)) { errs.push(`${id}: not in batch ${batch}`); continue; }
    if (doc.entries[id] && doc.entries[id].status === 'reviewed') { errs.push(`${id}: is live (reviewed); ingest never regenerates live writing — edit single fields with patch --approved-edit`); continue; }
    if (RAR.some(r => !e.names[r]) || RAR.some(r => !e.lore[r])) errs.push(`${id}: needs 5 names and 5 lore lines`);
    for (const [r, t] of Object.entries(e.lore)) if (/→|\?\?|TODO|\bhmm\b/i.test(t) || !/[.!?'"]$/.test(t)) errs.push(`${id}: lore.${r} looks unfinished: ${t.slice(-60)}`);
    const slots = G.curatedMoveSlots(id); for (const k of Object.keys(e.moves)) if (!(k in slots)) errs.push(`${id}: unknown move key ${k}`);
    if (e.keep) for (const k of e.keep) if (!(k in slots)) errs.push(`${id}: unknown kept key ${k}`);
    const mv = Object.values(e.moves).map(s => s.toLowerCase()); if (new Set(mv).size !== mv.length) errs.push(`${id}: duplicate move names`);
    for (const v of Object.values(e.names)) { const k = v.toLowerCase(); if (taken.has(k) && !taken.get(k).startsWith(id + ' ')) errs.push(`${id}: name "${v}" already used by ${taken.get(k)}`); }
    for (const v of Object.values(e.names)) taken.set(v.toLowerCase(), id + ' (this batch)');
    const keep = e.keep; delete e.keep; const entry = { status: 'draft', names: e.names, lore: e.lore, moves: e.moves }; if (keep && keep.length) entry.notes = 'kept default move names: ' + keep.join(', ');
    doc.entries[id] = entry;
  }
  const r = G.validateCurated(doc, { file: path.relative(ROOT, out) }); errs.push(...r.errors);
  if (errs.length) { console.log(errs.join('\n')); console.log(`\n${errs.length} problem(s): nothing written`); process.exit(1); }
  const order = readJSON(path.join(BAT, batch + '.json')).ids; doc.entries = Object.fromEntries(order.filter(id => doc.entries[id]).map(id => [id, doc.entries[id]]));
  fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  console.log(`${path.relative(ROOT, out)}: +${Object.keys(blocks).length} objects → ${Object.keys(doc.entries).length}/${ids.size}; ${r.warnings.length} warning(s)${r.warnings.length ? '\n' + r.warnings.join('\n') : ''}`);
}

// patch: merge reviewed fixes into a batch draft. File = JSON {"<id>": {"lore.rare": "…", "names.legendary": "…", "moves.ultimate": "…"}}.
// Patches live in content/campaign/patches/ and are applied after the chunk files (re-ingesting a chunk = re-apply its patches).
function patch(batch, file) {
  const G = game(), out = batchFile(batch), doc = readJSON(out), p = readJSON(file), errs = [];
  const taken = allNames(batch); for (const [id, e] of Object.entries(doc.entries)) for (const v of Object.values(e.names || {})) taken.set(v.toLowerCase(), id + ' (this batch)');
  let n = 0;
  for (const [id, fields] of Object.entries(p)) { const e = doc.entries[id]; if (!e) { errs.push(`${id}: not in ${batch}`); continue; }
    if (e.status === 'reviewed' && !APPROVED_EDIT) { errs.push(`${id}: is live (reviewed); add --approved-edit for a deliberate, developer-approved correction`); continue; }
    for (const [k, v] of Object.entries(fields)) { const grp = k.slice(0, k.indexOf('.')), key = k.slice(k.indexOf('.') + 1);
      if (!['lore', 'names', 'moves'].includes(grp) || (grp !== 'moves' && !RAR.includes(key)) || (grp === 'moves' && !(key in G.curatedMoveSlots(id)))) { errs.push(`${id}: bad field ${k}`); continue; }
      if (grp === 'names') { const t = taken.get(v.toLowerCase()); if (t && !t.startsWith(id + ' ')) errs.push(`${id}: name "${v}" already used by ${t}`); taken.set(v.toLowerCase(), id + ' (this batch)'); }
      if (grp === 'lore' && (/→/.test(v) || !/[.!?'"]$/.test(v))) errs.push(`${id}: ${k} looks unfinished`);
      e[grp] = e[grp] || {}; e[grp][key] = v; n++; } }
  const r = G.validateCurated(doc, { file: path.relative(ROOT, out) }); errs.push(...r.errors);
  for (const [id, e] of Object.entries(doc.entries)) { const mv = Object.values(e.moves || {}).map(x => x.toLowerCase()); if (new Set(mv).size !== mv.length) errs.push(`${id}: duplicate move names`);
    const nm = Object.values(e.names).map(x => x.toLowerCase()); if (new Set(nm).size !== nm.length) errs.push(`${id}: duplicate names within object`); }
  if (errs.length) { console.log(errs.join('\n')); console.log(`\n${errs.length} problem(s): nothing written`); process.exit(1); }
  fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n'); console.log(`${path.relative(ROOT, out)}: ${n} field(s) patched from ${path.relative(ROOT, file)}`);
}
function status(write = true) {
  // Counts come straight from the source fields in content/curated/*.json. "Previously approved" = the 60 Pilot 01/02
  // objects (pilot-*-approved.json); "campaign" = the 2,248 objects of the 22 batches. Live = status "reviewed".
  const mf = readJSON(path.join(CAMP, 'manifest.json')), rows = inventory(), owners = new Map();
  for (const f of fs.readdirSync(CUR).filter(f => f.endsWith('.json'))) for (const [id, e] of Object.entries(readJSON(path.join(CUR, f)).entries || {})) { if (!owners.has(id)) owners.set(id, []); owners.get(id).push({ f, e }); }
  const full = e => RAR.every(r => e.names && e.names[r]) && RAR.every(r => e.lore && e.lore[r]);
  const mv = e => Object.keys(e.moves || {}).length, pilot = f => /^pilot-0\d-approved\.json$/.test(f);
  const c = { prevLive: 0, prevComplete: 0, campLive: 0, campDraft: 0, campComplete: 0, campNames: 0, campLore: 0, campMoves: 0, prevMoves: 0, p01Names: 0 };
  const missing = [], multi = [];
  for (const r of rows) { const o = owners.get(r.id) || []; if (o.length > 1) multi.push(r.id); if (!o[0]) { missing.push(r.id); continue; }
    const { f, e } = o[0], live = e.status === 'reviewed';
    if (pilot(f)) { c.prevLive += live; c.prevComplete += full(e); c.prevMoves += mv(e); if (f.startsWith('pilot-01')) c.p01Names += RAR.filter(x => e.names && e.names[x]).length; }
    else { c.campLive += live; c.campDraft += !live; c.campComplete += full(e); c.campMoves += mv(e);
      c.campNames += RAR.filter(x => e.names && e.names[x]).length; c.campLore += RAR.filter(x => e.lore && e.lore[x]).length; }
    if (!full(e)) missing.push(r.id + ' (incomplete)'); }
  const b = [];
  for (const nb of mf.partition.newContent) { const f = batchFile(nb.batch), d = fs.existsSync(f) ? readJSON(f).entries : {}, es = Object.values(d);
    const n = es.filter(full).length, live = es.filter(e => e.status === 'reviewed').length;
    const rv = fs.existsSync(path.join(ROOT, 'content/review', nb.batch + '-issues.json')) ? 'editor pass applied' : '';
    b.push(`| ${nb.batch} | ${nb.size} | ${n} | ${live === nb.size ? 'live' : live ? `${live} live, ${nb.size - live} draft` : n === nb.size ? 'written (draft)' : n ? 'in progress' : '—'} | ${rv} |`); }
  const imm = APPROVED.map(f => [f, sha(path.join(ROOT, f)) === (mf.baseline || {})[f]]);
  const s = { objects: rows.length, previouslyApproved: { objects: c.prevComplete, live: c.prevLive, moveOverrides: c.prevMoves, pilot01NamesAdded: c.p01Names },
    campaign: { objects: mf.counts.new, complete: c.campComplete, live: c.campLive, draft: c.campDraft, names: c.campNames, lore: c.campLore, moveOverrides: c.campMoves },
    liveTotal: c.prevLive + c.campLive, moveOverridesTotal: c.prevMoves + c.campMoves, missing: missing.length, multipleOwners: multi, immutable: Object.fromEntries(imm) };
  const lines = ['# Curated-writing status', '', 'Generated by `node tools/campaign.js status` (do not edit). Counts are read from the source fields in `content/curated/*.json`; live = `"status": "reviewed"`.', '',
    `- Registry objects: **${s.objects}**; live curated writing: **${s.liveTotal}**; missing or incomplete: ${s.missing}; objects with more than one content owner: ${multi.length ? multi.join(', ') : 'none'}`,
    `- Previously approved (Pilot 01 + Pilot 02, \`pilot-0*-approved.json\`): ${s.previouslyApproved.objects} complete, ${s.previouslyApproved.live} live, ${s.previouslyApproved.moveOverrides} move display overrides; Pilot 01 names added ${s.previouslyApproved.pilot01NamesAdded}/50 (v0.5.0)`,
    `- Campaign batches w01–w22 (newly written): ${s.campaign.complete}/${s.campaign.objects} complete, **${s.campaign.live} live**, ${s.campaign.draft} draft; ${s.campaign.names} names, ${s.campaign.lore} lore lines, ${s.campaign.moveOverrides} move display overrides`,
    `- Move display overrides, all live content: ${s.moveOverridesTotal} (${s.previouslyApproved.moveOverrides} previously approved + ${s.campaign.moveOverrides} campaign)`,
    `- Live files byte-identical to the recorded baseline (\`node tools/campaign.js immutable\`): ${imm.every(([, ok]) => ok) ? `all ${imm.length} yes` : imm.filter(([, ok]) => !ok).map(([f]) => f.split('/').pop() + ' **NO**').join(', ')}`, '',
    '| Batch | Objects | Complete | State | Editor |', '|---|---|---|---|---|', ...b, ''];
  if (write) { fs.writeFileSync(path.join(CAMP, 'STATUS.md'), lines.join('\n') + '\n'); fs.writeFileSync(path.join(CAMP, 'status.json'), JSON.stringify(s, null, 1) + '\n'); }
  console.log(lines.slice(4, 9).join('\n'));
  return s;
}
function next(batch) { const mf = readJSON(path.join(CAMP, 'manifest.json'));
  for (const nb of mf.partition.newContent) { if (batch && nb.batch !== batch) continue; const f = batchFile(nb.batch), d = fs.existsSync(f) ? readJSON(f).entries : {};
    const ids = readJSON(path.join(BAT, nb.batch + '.json')).ids, todo = ids.filter(id => !d[id]); if (todo.length) { console.log(`${nb.batch}: ${ids.length - todo.length}/${ids.length} written; next index ${ids.indexOf(todo[0])}: ${todo.slice(0, 25).join(' ')}`); return; } }
  console.log('no unwritten objects' + (batch ? ' in ' + batch : '')); }
function immutable() { const mf = readJSON(path.join(CAMP, 'manifest.json')); let ok = true;
  for (const f of APPROVED) { const same = sha(path.join(ROOT, f)) === (mf.baseline || {})[f]; ok = ok && same; console.log((same ? 'ok   ' : 'FAIL ') + f); }
  if (!ok) console.log('A live file changed. If the edit was deliberate and approved: node tools/campaign.js rebaseline "<reason>"');
  process.exit(ok ? 0 : 1); }
// rebaseline: record the current hashes of every live file, with the reason, after a deliberate approved edit
function rebaseline(reason) { if (!reason || reason.startsWith('--')) { console.log('usage: node tools/campaign.js rebaseline "<reason>"'); process.exit(1); }
  const mf = readJSON(path.join(CAMP, 'manifest.json')), changed = APPROVED.filter(f => sha(path.join(ROOT, f)) !== (mf.baseline || {})[f]);
  mf.baseline = Object.fromEntries(APPROVED.map(f => [f, sha(path.join(ROOT, f))]));
  (mf.baselineLog = mf.baselineLog || []).push({ date: new Date().toISOString().slice(0, 10), reason, changed });
  fs.writeFileSync(path.join(CAMP, 'manifest.json'), JSON.stringify(mf, null, 1) + '\n');
  console.log(`baseline recorded for ${APPROVED.length} live files; changed: ${changed.length ? changed.join(', ') : 'none'}`); }

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'init') init(); else if (cmd === 'brief') brief(...a); else if (cmd === 'ingest') ingest(...a); else if (cmd === 'status') status(); else if (cmd === 'patch') patch(...a); else if (cmd === 'next') next(a[0]); else if (cmd === 'immutable') immutable(); else if (cmd === 'rebaseline') rebaseline(a[0]);
else console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 15).join('\n'));
module.exports = { parseCompact, status };
