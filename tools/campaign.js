#!/usr/bin/env node
// Full curated-writing campaign (all registry objects). Offline. Resumable from files: content/campaign/.
//   node tools/campaign.js init                  freeze the campaign manifest + content/batches/w*.json (never overwrites)
//   node tools/campaign.js next [batch]           print the next unwritten object ids (first incomplete batch by default)
//   node tools/campaign.js brief <batch> [from] [n]   compact writer brief for objects of a batch (facts + move slots)
//   node tools/campaign.js ingest <batch> <file>  convert a compact draft file (format below) into content/curated/<batch>-draft.json
//   node tools/campaign.js status                 reconcile every registry id; write content/campaign/STATUS.md (+ status.json)
//   node tools/campaign.js immutable              check that approved files are byte-identical to the campaign baseline
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
const APPROVED = ['content/curated/pilot-01-approved.json', 'content/curated/pilot-02-approved.json'];

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
  for (const f of fs.readdirSync(CUR).filter(f => f.endsWith('.json'))) { if (exceptBatch && f === exceptBatch + '-draft.json') continue; const d = readJSON(path.join(CUR, f));
    for (const [id, e] of Object.entries(d.entries || {})) for (const v of Object.values(e.names || {})) names.set(v.toLowerCase(), id + ' (' + f + ')'); }
  const pp = path.join(CAMP, 'pilot-01-names-proposal.json'); if (fs.existsSync(pp)) for (const [id, ns] of Object.entries(readJSON(pp).names)) for (const v of Object.values(ns)) names.set(v.toLowerCase(), id + ' (pilot-01 names proposal)');
  return names; }

function ingest(batch, file) {
  const G = game(), ids = new Set(readJSON(path.join(BAT, batch + '.json')).ids), blocks = parseCompact(fs.readFileSync(file, 'utf8')), errs = [];
  const out = path.join(CUR, batch + '-draft.json'), doc = fs.existsSync(out) ? readJSON(out) : { schema: 1, batch, entries: {} };
  const taken = allNames(batch); for (const [id, e] of Object.entries(doc.entries)) if (!blocks[id]) for (const v of Object.values(e.names || {})) taken.set(v.toLowerCase(), id + ' (this batch)');
  for (const [id, e] of Object.entries(blocks)) {
    if (!ids.has(id)) { errs.push(`${id}: not in batch ${batch}`); continue; }
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
  const G = game(), out = path.join(CUR, batch + '-draft.json'), doc = readJSON(out), p = readJSON(file), errs = [];
  const taken = allNames(batch); for (const [id, e] of Object.entries(doc.entries)) for (const v of Object.values(e.names || {})) taken.set(v.toLowerCase(), id + ' (this batch)');
  let n = 0;
  for (const [id, fields] of Object.entries(p)) { const e = doc.entries[id]; if (!e) { errs.push(`${id}: not in ${batch} draft`); continue; }
    for (const [k, v] of Object.entries(fields)) { const [grp, key] = k.split('.');
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
  const mf = readJSON(path.join(CAMP, 'manifest.json')), rows = inventory(), owners = new Map(), G = game();
  for (const f of fs.readdirSync(CUR).filter(f => f.endsWith('.json'))) for (const [id, e] of Object.entries(readJSON(path.join(CUR, f)).entries || {})) { if (!owners.has(id)) owners.set(id, []); owners.get(id).push({ f, e }); }
  const prop = fs.existsSync(path.join(CAMP, 'pilot-01-names-proposal.json')) ? readJSON(path.join(CAMP, 'pilot-01-names-proposal.json')).names : {};
  const full = e => RAR.every(r => e.names && e.names[r]) && RAR.every(r => e.lore && e.lore[r]);
  const lines = [], b = [];
  let approvedFull = 0, p01 = 0, draftFull = 0, missing = [], multi = [], moves = 0, newNames = 0, newLore = 0;
  for (const r of rows) { const o = owners.get(r.id) || []; if (o.length > 1) multi.push(r.id);
    const e = o[0] && o[0].e;
    if (!e) { missing.push(r.id); continue; }
    if (e.status === 'reviewed') { if (full(e)) approvedFull++; else if (prop[r.id] && RAR.every(x => prop[r.id][x])) { p01++; newNames += 5; } else missing.push(r.id + ' (names)'); continue; }
    if (full(e)) { draftFull++; newNames += 5; newLore += 5; moves += Object.keys(e.moves || {}).length; } else missing.push(r.id + ' (incomplete)');
  }
  for (const nb of mf.partition.newContent) { const f = path.join(CUR, nb.batch + '-draft.json'), d = fs.existsSync(f) ? readJSON(f).entries : {}, n = Object.values(d).filter(full).length;
    const rv = fs.existsSync(path.join(ROOT, 'content/review', nb.batch + '-issues.json')) ? 'editor pass logged' : '';
    b.push(`| ${nb.batch} | ${nb.size} | ${n} | ${n === nb.size ? 'written' : n ? 'in progress' : '—'} | ${rv} |`); }
  const imm = APPROVED.map(f => [f, sha(path.join(ROOT, f)) === mf.baseline[f]]);
  const s = { objects: rows.length, approvedComplete: approvedFull, pilot01NamesProposed: p01, draftComplete: draftFull, missing: missing.length, multipleOwners: multi, newNamesReady: newNames, newLoreReady: newLore, moveOverridesReady: moves, immutable: Object.fromEntries(imm) };
  lines.push('# Curated-writing campaign status', '', 'Generated by `node tools/campaign.js status` (do not edit). Everything new is **draft** until the developer approves it.', '',
    `- Registry objects: **${s.objects}** — approved complete ${s.approvedComplete}, Pilot 01 (approved lore/moves) with names proposed ${s.pilot01NamesProposed}/10, **draft complete ${s.draftComplete}** of ${mf.counts.new}, still missing ${s.missing}`,
    `- Ready (draft): ${s.newNamesReady} of ${mf.counts.newNames} new names, ${s.newLoreReady} of ${mf.counts.newLore} new lore lines, ${s.moveOverridesReady} move display overrides`,
    `- Objects with more than one content owner: ${multi.length ? multi.join(', ') : 'none'}`,
    `- Approved files byte-identical to the campaign baseline: ${imm.map(([f, ok]) => f.split('/').pop() + ' ' + (ok ? 'yes' : '**NO**')).join(', ')}`, '',
    '| Batch | Objects | Written | State | Editor |', '|---|---|---|---|---|', ...b, '');
  if (write) { fs.writeFileSync(path.join(CAMP, 'STATUS.md'), lines.join('\n') + '\n'); fs.writeFileSync(path.join(CAMP, 'status.json'), JSON.stringify(s, null, 1) + '\n'); }
  console.log(lines.slice(4, 8).join('\n'));
  return s;
}
function next(batch) { const mf = readJSON(path.join(CAMP, 'manifest.json'));
  for (const nb of mf.partition.newContent) { if (batch && nb.batch !== batch) continue; const f = path.join(CUR, nb.batch + '-draft.json'), d = fs.existsSync(f) ? readJSON(f).entries : {};
    const ids = readJSON(path.join(BAT, nb.batch + '.json')).ids, todo = ids.filter(id => !d[id]); if (todo.length) { console.log(`${nb.batch}: ${ids.length - todo.length}/${ids.length} written; next index ${ids.indexOf(todo[0])}: ${todo.slice(0, 25).join(' ')}`); return; } }
  console.log('no unwritten objects' + (batch ? ' in ' + batch : '')); }
function immutable() { const mf = readJSON(path.join(CAMP, 'manifest.json')); let ok = true; for (const f of APPROVED) { const same = sha(path.join(ROOT, f)) === mf.baseline[f]; ok = ok && same; console.log((same ? 'ok   ' : 'FAIL ') + f); } process.exit(ok ? 0 : 1); }

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'init') init(); else if (cmd === 'brief') brief(...a); else if (cmd === 'ingest') ingest(...a); else if (cmd === 'status') status(); else if (cmd === 'patch') patch(...a); else if (cmd === 'next') next(a[0]); else if (cmd === 'immutable') immutable();
else console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 15).join('\n'));
module.exports = { parseCompact, status };
