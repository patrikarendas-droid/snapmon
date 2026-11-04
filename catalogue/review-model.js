/* SnapMon developer catalogue — review data model (pure; no DOM, no Firebase, no game state).
   Loaded by catalogue/index.html as a classic script (window.ReviewModel) and by tests/catalogue-model.js (require).

   A review document holds the owner's review of ONE object, keyed by the stable game object id. Fields are keyed by
   the SAME paths as the curated source files (content/curated/<file>.json), so a proposal maps 1:1 to a later patch:
     names.<rarity> · lore.<rarity> · moves.<ability key>   (signature, legend, ultimate, kit.<slot>)
   plus review-only paths that never map to text:
     visual · visual.<rarity>.<variant> · mapping
   A field is { status: 'todo' | 'ok' | 'fix', note, proposal, t (ms), d (device id) }.
   Nothing here ever writes game saves, curated data or sprites: proposals are suggestions only. */
(function (root) {
  'use strict';
  const SCHEMA = 1, EXPORT_SCHEMA = 'snapmon-catalogue-export/1';
  const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const VARIANTS = ['normal', 'spectral', 'mutated', 'shiny']; // stable keys; 'normal' = no variant (null in the engine)
  const STATUSES = ['todo', 'ok', 'fix'];
  const LIMITS = { note: 2000, proposal: 600 };

  const isTextPath = p => /^(names|lore)\.(common|uncommon|rare|epic|legendary)$/.test(p) || /^moves\.(signature|legend|ultimate|kit\.[a-z0-9_]+)$/.test(p);
  const isReviewPath = p => p === 'visual' || p === 'mapping' || /^visual\.(common|uncommon|rare|epic|legendary)\.(normal|spectral|mutated|shiny)$/.test(p);
  const isPath = p => typeof p === 'string' && (isTextPath(p) || isReviewPath(p));
  // Firestore map keys: '.' is replaced by ':' (paths never contain ':'), so field paths never need FieldPath escaping
  const encKey = p => p.replace(/\./g, ':'), decKey = k => k.replace(/:/g, '.');

  function clean(f) {
    const status = STATUSES.includes(f && f.status) ? f.status : 'todo';
    const note = String((f && f.note) || '').slice(0, LIMITS.note), proposal = String((f && f.proposal) || '').slice(0, LIMITS.proposal);
    const out = { status, note, proposal };
    if (f && typeof f.t === 'number') out.t = f.t;
    if (f && f.d) out.d = String(f.d).slice(0, 40);
    return out;
  }
  const isEmpty = f => !f || (f.status === 'todo' && !f.note && !f.proposal);
  // two field values are "the same review" when status, note and proposal match (timestamps/devices ignored)
  const same = (a, b) => (isEmpty(a) && isEmpty(b)) || (!!a && !!b && a.status === b.status && (a.note || '') === (b.note || '') && (a.proposal || '') === (b.proposal || ''));

  function setField(fields, path, patch, device, now) {
    if (!isPath(path)) throw new Error('bad field path ' + path);
    const prev = fields[path] || { status: 'todo', note: '', proposal: '' };
    const next = clean({ ...prev, ...patch, t: now, d: device });
    const out = { ...fields };
    if (isEmpty(next)) delete out[path]; else out[path] = next;
    return out;
  }

  // object-wide state for progress: 'fix' if any field needs a fix, 'ok' when every required field is ok,
  // 'partial' when some are reviewed, 'todo' when nothing is
  function objectState(fields, required) {
    const vals = Object.values(fields || {});
    if (vals.some(f => f.status === 'fix')) return 'fix';
    const done = required.filter(p => fields && fields[p] && fields[p].status === 'ok').length;
    if (required.length && done === required.length) return 'ok';
    return done || vals.some(f => !isEmpty(f)) ? 'partial' : 'todo';
  }
  // "Everything looks good": required fields still 'todo' become 'ok' (notes kept). A field flagged 'fix' is NEVER
  // changed, and no note or proposal is ever erased.
  function approveAll(fields, required, device, now) {
    let out = { ...fields };
    for (const p of required) { const f = out[p]; if (!f || f.status === 'todo') out = setField(out, p, { status: 'ok' }, device, now); }
    return out;
  }

  // Three-way merge of one document. base = fields last acknowledged by the server on this device, local = this
  // device's current fields, server = what the server holds now. Independent field changes merge; when the SAME field
  // changed differently on both sides, the server value is kept in the document and the local value is returned as a
  // conflict, so nothing is lost and the owner chooses explicitly.
  function merge(base, local, server) {
    base = base || {}; local = local || {}; server = server || {};
    const fields = {}, conflicts = {};
    for (const p of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(server)])) {
      const b = base[p], l = local[p], s = server[p], lc = !same(l, b), sc = !same(s, b);
      let v;
      if (!lc) v = s; else if (!sc || same(l, s)) v = l; else { v = s; conflicts[p] = { mine: l ? clean(l) : null, theirs: s ? clean(s) : null }; }
      if (!isEmpty(v)) fields[p] = clean(v);
    }
    return { fields, conflicts };
  }

  // remote document <-> fields
  function toRemote(objectId, fields, rev, device, now) {
    const f = {}; for (const [p, v] of Object.entries(fields)) if (isPath(p) && !isEmpty(v)) f[encKey(p)] = clean(v);
    return { schema: SCHEMA, objectId, rev, updatedAt: now, device: String(device || '').slice(0, 40), fields: f };
  }
  function fromRemote(data) {
    const fields = {}; if (!data || !data.fields) return fields;
    for (const [k, v] of Object.entries(data.fields)) { const p = decKey(k); if (isPath(p) && !isEmpty(v)) fields[p] = clean(v); }
    return fields;
  }

  // Export: everything the owner reviewed, human-readable, with the live value of each text field and, ready for the
  // later approved patch step, proposals grouped per source file in `node tools/campaign.js patch` format.
  function buildExport(docs, ctx) {
    const objects = {}, patches = {}, counts = { objects: 0, ok: 0, fix: 0, partial: 0, fields: 0, proposals: 0, notes: 0 };
    for (const id of Object.keys(docs).sort()) {
      const fields = docs[id]; if (!fields || !Object.keys(fields).length) continue;
      const src = ctx.sourceOf(id), state = objectState(fields, ctx.required(id));
      const out = {};
      for (const p of Object.keys(fields).sort()) {
        const f = fields[p]; counts.fields++; if (f.note) counts.notes++;
        out[p] = { ...clean(f), ...(isTextPath(p) ? { live: ctx.liveValue(id, p) } : {}) };
        if (f.proposal && isTextPath(p)) { counts.proposals++; const b = src ? src.replace(/^content\/curated\//, '').replace(/\.json$/, '') : '(unknown)'; ((patches[b] = patches[b] || {})[id] = patches[b][id] || {})[p] = f.proposal; }
      }
      objects[id] = { name: ctx.nameOf(id), source: src, state, fields: out };
      counts.objects++; if (state === 'ok') counts.ok++; else if (state === 'fix') counts.fix++; else counts.partial++;
    }
    return { schema: EXPORT_SCHEMA, exportedAt: new Date(ctx.now).toISOString(), game: ctx.game, contentRevision: ctx.revision, totalObjects: ctx.total, counts, objects,
      patches, note: 'Proposals only. Apply after explicit approval: node tools/campaign.js patch <batch> <file> --approved-edit (docs/CATALOGUE.md).' };
  }
  function summaryText(exp) {
    const c = exp.counts, lines = [`SnapMon catalogue review — exported ${exp.exportedAt} (game ${exp.game}, content ${exp.contentRevision})`,
      `${c.objects} objects with reviews of ${exp.totalObjects}: ${c.ok} approved, ${c.fix} need a fix, ${c.partial} in progress; ${c.proposals} proposed texts, ${c.notes} notes`, ''];
    for (const [id, o] of Object.entries(exp.objects)) if (o.state === 'fix') {
      lines.push(`${id} (${o.name}):`);
      for (const [p, f] of Object.entries(o.fields)) if (f.status === 'fix') lines.push(`  ${p}: ${f.note || '(no note)'}${f.proposal ? ' → "' + f.proposal + '"' : ''}`);
    }
    return lines.join('\n') + '\n';
  }

  // Import: validates schema, object ids and field paths; returns { ok, errors, entries: {id: fields} } — nothing is
  // applied here. planImport compares with current local fields: new fields are added as local edits, identical ones
  // are skipped, and a DIFFERENT existing review becomes an explicit conflict (both kept) — never a silent overwrite.
  function parseImport(text, isObject) {
    const errors = []; let data;
    try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, errors: ['not valid JSON: ' + e.message], entries: {} }; }
    if (!data || data.schema !== EXPORT_SCHEMA || typeof data.objects !== 'object') return { ok: false, errors: ['not a SnapMon catalogue export (schema ' + EXPORT_SCHEMA + ')'], entries: {} };
    const entries = {};
    for (const [id, o] of Object.entries(data.objects)) {
      if (!isObject(id)) { errors.push(`unknown object id ${id}`); continue; }
      for (const [p, f] of Object.entries((o && o.fields) || {})) {
        if (!isPath(p)) { errors.push(`${id}: unknown field ${p}`); continue; }
        if (!STATUSES.includes(f.status)) { errors.push(`${id}.${p}: bad status`); continue; }
        if (!isEmpty(f)) (entries[id] = entries[id] || {})[p] = clean(f);
      }
    }
    return { ok: !errors.length, errors, entries };
  }
  function planImport(entries, current) {
    const plan = { add: 0, same: 0, conflicts: 0, objects: 0, items: [] };
    for (const [id, fields] of Object.entries(entries)) {
      let touched = false;
      for (const [p, f] of Object.entries(fields)) {
        const cur = (current[id] || {})[p];
        const kind = isEmpty(cur) ? 'add' : same(cur, f) ? 'same' : 'conflict';
        plan[kind === 'add' ? 'add' : kind === 'same' ? 'same' : 'conflicts']++; if (kind !== 'same') touched = true;
        plan.items.push({ id, path: p, kind, incoming: f, current: cur || null });
      }
      if (touched) plan.objects++;
    }
    return plan;
  }

  const api = { SCHEMA, EXPORT_SCHEMA, RARITIES, VARIANTS, STATUSES, LIMITS, isPath, isTextPath, isReviewPath, encKey, decKey, clean, isEmpty, same,
    setField, objectState, approveAll, merge, toRemote, fromRemote, buildExport, summaryText, parseImport, planImport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ReviewModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
