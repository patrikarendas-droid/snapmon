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

  /* ---------- AI writing review batches (names + flavour text only) ----------
     The owner exports a batch, gives it to an outside AI chat by hand, and imports the AI's answer. The answer must be a
     normal catalogue import (EXPORT_SCHEMA) limited to the ten WRITING_PATHS; everything else is ignored on import. */
  const BATCH_SCHEMA = 'snapmon-ai-writing-batch/1';
  const WRITING_PATHS = [...RARITIES.map(r => 'names.' + r), ...RARITIES.map(r => 'lore.' + r)];
  const isWritingPath = p => WRITING_PATHS.includes(p);
  // an object's writing is "complete" when all ten name/lore fields carry an owner decision (ok or fix)
  const writingDone = fields => WRITING_PATHS.every(p => fields && fields[p] && (fields[p].status === 'ok' || fields[p].status === 'fix'));
  // deterministic selection: walk `ordered` (catalogue order or the current filtered list), optionally from `startId`,
  // and take the first `size` objects (only those whose writing is not complete, unless onlyOpen is false). Pure: no state.
  function selectWritingBatch(ordered, fieldsOf, { size = 50, startId = null, onlyOpen = true } = {}) {
    let i = startId ? ordered.indexOf(startId) : 0; if (i < 0) i = 0;
    const out = [];
    for (; i < ordered.length && out.length < size; i++) if (!onlyOpen || !writingDone(fieldsOf(ordered[i]))) out.push(ordered[i]);
    return out;
  }
  function batchInstructions(L) {
    return {
      task: 'Review the monster NAMES and FLAVOUR texts only, across all five rarities, for every object in "objects". Keep strong existing writing. Correct weak, generic, repetitive, nonsensical, non-object-specific or overlong text. Common and Uncommon may be small everyday tricks; Rare should be noticeably powerful and unusual; Epic should create dramatic, consequential and often funny chaos; Legendary should be extraordinary, mythic, consequential and object-specific, without repetitive world-ending cliches. Family-friendly. Do not touch sprites, recognition mapping, moves, damage, stats or mechanics (they are not in this file and must not be in your answer).',
      ownerReviews: 'An object\'s "review" holds the owner\'s earlier decisions for these fields. Respect them: if a field has status "fix", the owner already wants it changed: keep "fix", take the note seriously and propose a replacement; never mark it "ok". Do not repeat a field unchanged if you agree with the owner\'s existing review (omit it).',
      rules: {
        names: `3-${L.nameMax} characters (Legendary: 3-${L.legendNameMax}); start with a capital letter; only letters, digits, spaces and ' - , . ! & ; no spaces at the start/end and no double spaces; no placeholders (TODO, [..], {..}, <..>, "..."); the five names of one object must all differ; must not just repeat the object's own name; names should be unique across the whole game (the importer warns about names already in use).`,
        lore: `${L.loreMin}-${L.loreMax} characters; one or two sentences about THIS real object; no placeholders (TODO, [..], {..}, <..>, a trailing "..."); plain text.`,
      },
      answer: 'Return ONE downloadable JSON file (no prose, no code, no markdown) in exactly the shape of "responseFormat": schema "snapmon-catalogue-export/1"; "objects" keyed by the exact object id; per object "fields" keyed by names.<rarity> or lore.<rarity> (rarity = common, uncommon, rare, epic, legendary). Each field: {"status": "ok" | "fix", "note": "short reason", "proposal": "replacement text (for fix; empty for ok)"}. "ok" = reviewed and good. "fix" = needs correction; give a proposal whenever possible. OMIT any field you leave unchanged and any object without changes. Never mark everything ok by default: examine each field individually.',
      allowedFields: WRITING_PATHS,
    };
  }
  function buildWritingBatch(ids, ctx) {
    const L = ctx.limits;
    const objects = ids.map(id => {
      const f = ctx.fieldsOf(id) || {}, review = {};
      for (const p of WRITING_PATHS) if (f[p] && !isEmpty(f[p])) { const { status, note, proposal } = clean(f[p]); review[p] = { status, note, proposal }; }
      return { id, name: ctx.nameOf(id), category: ctx.categoryOf(id), source: ctx.sourceOf(id),
        live: { names: Object.fromEntries(RARITIES.map(r => [r, ctx.liveValue(id, 'names.' + r)])), lore: Object.fromEntries(RARITIES.map(r => [r, ctx.liveValue(id, 'lore.' + r)])) },
        ...(Object.keys(review).length ? { review } : {}) };
    });
    return { schema: BATCH_SCHEMA, purpose: 'SnapMon monster writing review batch (names + flavour text). Suggestions only: nothing here changes the game.',
      game: ctx.game, contentRevision: ctx.revision, exportedAt: new Date(ctx.now).toISOString(), count: objects.length,
      instructions: batchInstructions(L),
      responseFormat: { schema: EXPORT_SCHEMA, objects: { '<exact object id from this file>': { fields: { 'lore.legendary': { status: 'fix', note: 'Too mundane for a Legendary', proposal: '<replacement text>' }, 'names.rare': { status: 'ok', note: 'Fits the Rare text', proposal: '' } } } } },
      objects };
  }
  // AI answer → import entries limited to the ten writing fields; non-writing fields are dropped (counted), and a
  // proposal that breaks a hard rule is skipped with a reason (checkProposal returns an error string or null).
  function parseAIImport(text, isObject, checkProposal) {
    let data; try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, errors: ['not valid JSON: ' + e.message], entries: {}, dropped: 0 }; }
    if (data && data.schema === BATCH_SCHEMA) return { ok: false, errors: ['this is the batch you exported, not the AI\'s answer (schema ' + EXPORT_SCHEMA + ')'], entries: {}, dropped: 0 };
    let dropped = 0; const trimmed = data && typeof data.objects === 'object' ? {} : null;
    if (trimmed) for (const [id, o] of Object.entries(data.objects)) { const fl = {}; for (const [p, f] of Object.entries((o && o.fields) || {})) { if (isWritingPath(p)) fl[p] = { status: f && f.status, note: (f && f.note) || '', proposal: (f && f.proposal) || '' }; else dropped++; } trimmed[id] = { fields: fl }; }
    const r = parseImport(trimmed ? { ...data, objects: trimmed } : data, isObject); r.dropped = dropped; r.skipped = [];
    for (const [id, fl] of Object.entries(r.entries)) for (const [p, f] of Object.entries(fl)) {
      const err = f.proposal && checkProposal ? checkProposal(id, p, f.proposal) : null;
      if (err) { r.skipped.push(`${id} ${p}: ${err}`); delete fl[p]; }
      if (!Object.keys(fl).length) delete r.entries[id];
    }
    return r;
  }

  const api = { SCHEMA, EXPORT_SCHEMA, RARITIES, VARIANTS, STATUSES, LIMITS, isPath, isTextPath, isReviewPath, encKey, decKey, clean, isEmpty, same,
    setField, objectState, approveAll, merge, toRemote, fromRemote, buildExport, summaryText, parseImport, planImport,
    BATCH_SCHEMA, WRITING_PATHS, isWritingPath, writingDone, selectWritingBatch, buildWritingBatch, parseAIImport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ReviewModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
