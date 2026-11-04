/* SnapMon developer catalogue — UI, owner-scoped local store, cloud sync.
   Uses the REAL game code loaded before this file (data.js, sprites.js, parts.js, objects.js, labels.js, lore.js,
   game.js, curated.js, curated-data.js): createMonster + renderSprite with an isolated temporary state and a
   deterministic seed. It never calls saveState/loadState, never touches the game's storage keys (snapmon.save.*,
   snapmon.testroster.*), never loads the camera or recognition models, and never edits curated writing: every edit is
   a review PROPOSAL stored under its own keys (snapmon-catalogue.v1.*) and, when signed in, in Firestore at
   catalogue/{uid}/reviews/{objectId}. */
'use strict';
(function () {
  const RM = window.ReviewModel, RAR = RM.RARITIES, VARS = RM.VARIANTS;
  const NS = 'snapmon-catalogue.v1.';                       // never a game key
  const $ = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = { get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch (e) { UI.toast('Could not save on this device (storage full or blocked)'); return false; } },
    del(k) { try { localStorage.removeItem(NS + k); } catch (e) { /* ignore */ } } };
  const device = ls.get('device') || (() => { const d = 'dev-' + Math.random().toString(36).slice(2, 10); ls.set('device', d); return d; })();
  const VLABEL = { normal: 'Normal', spectral: 'Spectral', mutated: 'Mutated', shiny: 'Prismatic' };
  const SLABEL = { todo: 'Not reviewed', ok: 'Looks good', fix: 'Needs fix' };
  const STATE_LABEL = { todo: 'Unreviewed', partial: 'In progress', ok: 'Approved', fix: 'Needs fix' };

  /* ---------- the real game data ---------- */
  const IDS = OBJECT_LIST.map(o => o.id).sort((a, b) => (OBJECTS[a].name.toLowerCase() < OBJECTS[b].name.toLowerCase() ? -1 : OBJECTS[a].name.toLowerCase() > OBJECTS[b].name.toLowerCase() ? 1 : a < b ? -1 : 1));
  const SOURCE = {}; for (const [f, ids] of Object.entries(window.CATALOGUE_SOURCES || {})) for (const id of ids) SOURCE[id] = f;
  const CATS = [...new Set(IDS.map(id => OBJECTS[id].cat))].sort();
  const hash = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const mulberry = a => () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const cache = new Map();
  // one deterministic sample monster per object × rarity × variant (neutral palette, no photo), isolated fresh state
  function sample(id, rarity, v) {
    const k = id + '|' + rarity + '|' + v; if (cache.has(k)) return cache.get(k);
    const rng = mulberry(hash(k)), keep = RNG; RNG = rng;
    let m; try { const S = freshState(); S.level = 10; m = createMonster(S, { obj: id, rarity, variant: v === 'normal' ? null : v, word: OBJECTS[id].name, rng }); } finally { RNG = keep; }
    if (cache.size > 1500) cache.delete(cache.keys().next().value);
    cache.set(k, m); return m;
  }
  const slotsCache = new Map();
  // the object's move slots (stable ability keys) and which rarities use each — from the real generated monsters
  function moveSlots(id) {
    if (slotsCache.has(id)) return slotsCache.get(id);
    const slots = {};
    for (const r of RAR) for (const v of VARS) for (const a of sample(id, r, v).abilities) { const s = slots[a.key] = slots[a.key] || { key: a.key, rarities: new Set(), names: new Set() }; s.rarities.add(r); s.names.add(a.name); }
    const out = Object.values(slots).sort((a, b) => order(a.key) - order(b.key) || (a.key < b.key ? -1 : 1)).map(s => ({ key: s.key, rarities: RAR.filter(r => s.rarities.has(r)), names: [...s.names] }));
    slotsCache.set(id, out); return out;
  }
  const order = k => k === 'signature' ? 0 : k.startsWith('kit.') ? 1 : k === 'legend' ? 2 : 3;
  const required = id => [...RAR.map(r => 'names.' + r), ...RAR.map(r => 'lore.' + r), ...moveSlots(id).map(s => 'moves.' + s.key), 'visual'];
  const curated = id => (CURATED && CURATED.data && CURATED.data[id]) || {};
  function liveValue(id, path) {
    const [g, ...rest] = path.split('.'), k = rest.join('.'), e = curated(id);
    if (g === 'names') return (e.names && e.names[k]) || sample(id, k, 'normal').name;
    if (g === 'lore') return (e.lore && e.lore[k]) || sample(id, k, 'normal').lore;
    if (g === 'moves') { if (e.moves && e.moves[k]) return e.moves[k]; const s = moveSlots(id).find(x => x.key === k); return s ? s.names[0] : ''; }
    return '';
  }

  /* ---------- owner-scoped local store: drafts + pending cloud queue ---------- */
  // store.objects[id] = { base: fields last ACKNOWLEDGED by the server (null in local-only mode), rev, local: fields,
  //                       dirty: local differs from base and is queued for sync, conflicts: { path: {mine, theirs, source} } }
  const Store = {
    ns: 'local', data: { objects: {} }, saveTimer: null,
    open(ns) { this.ns = ns; this.data = ls.get('store.' + ns, { objects: {} }); restoreDraft(ns); },
    obj(id) { return this.data.objects[id] || (this.data.objects[id] = { base: null, rev: 0, local: {}, dirty: false, conflicts: {} }); },
    fields(id) { const o = this.data.objects[id]; return (o && o.local) || {}; },
    persist(now) { clearTimeout(this.saveTimer); const go = () => ls.set('store.' + this.ns, this.data); if (now) go(); else this.saveTimer = setTimeout(go, 250); },
    pending() { return Object.entries(this.data.objects).filter(([, o]) => o.dirty).map(([id]) => id); },
    conflictCount() { return Object.values(this.data.objects).reduce((n, o) => n + Object.keys(o.conflicts || {}).length, 0); },
    reviewedIds() { return Object.keys(this.data.objects).filter(id => Object.keys(this.data.objects[id].local || {}).length); },
  };

  /* ---------- sync engine (backend-agnostic; Firebase in cloud.js, a mock in the tests) ---------- */
  const Sync = {
    backend: null, uid: null, email: '', ready: false, unsub: null, timer: null, busy: false, state: 'local', msg: '', last: 0, backoff: 0, cloudError: '',
    status() {
      const p = Store.pending().length;
      if (!this.uid) return { k: 'local', t: this.cloudError ? 'Local only — NOT synced (' + this.cloudError + ')' : 'Local only — NOT synced' };
      if (this.state === 'error') return { k: 'error', t: this.msg };
      if (!this.ready) return { k: 'syncing', t: 'Loading cloud reviews…' };
      if (this.state === 'syncing') return { k: 'syncing', t: `Syncing ${p}…` };
      if (this.state === 'offline' && p) return { k: 'offline', t: `Offline / pending · ${p} not uploaded` };
      if (p) return { k: 'pending', t: `Saved locally · ${p} pending` };
      return { k: 'synced', t: 'Synced' + (this.last ? ' ' + new Date(this.last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '') };
    },
    async start(user) {
      this.stop(); this.uid = user.uid; this.email = user.email; this.ready = false; this.state = 'syncing'; this.msg = '';
      Store.open(user.uid); UI.refresh();
      // remote FIRST: pending local edits are only merged after the first snapshot arrived (never upload over the cloud)
      this.unsub = this.backend.subscribe(user.uid, ch => this.onRemote(ch), e => this.fail(e));
    },
    stop() { if (this.unsub) try { this.unsub(); } catch (e) { /* ignore */ } this.unsub = null; this.uid = null; this.ready = false; this.state = 'local'; clearTimeout(this.timer); },
    onRemote(changes) {
      for (const { id, data } of changes) {
        if (!OBJECTS[id]) continue;
        const o = Store.obj(id), fields = RM.fromRemote(data);
        // A device with unsynced edits keeps BOTH its edits and its merge base (the last version it acknowledged): the
        // sync transaction reads the newest server version itself and three-way merges against that base. Moving the
        // base forward here would hide the other device's change and let a stale edit overwrite it.
        if (o.dirty) continue;
        o.base = fields; o.local = fields; o.rev = data ? data.rev || 0 : 0;
      }
      const first = !this.ready; this.ready = true; if (this.state !== 'error') this.state = 'idle';
      Store.persist(true); UI.refresh(); if (first) this.schedule(0);
    },
    schedule(ms = 2000) { clearTimeout(this.timer); if (this.uid) this.timer = setTimeout(() => this.syncAll(), ms); UI.status(); },
    async syncAll() {
      if (!this.uid || !this.ready || this.busy) return;
      const ids = Store.pending(); if (!ids.length) { this.state = 'idle'; UI.status(); return; }
      this.busy = true; this.state = 'syncing'; UI.status();
      try {
        for (const id of ids) await this.syncOne(id);
        this.state = 'idle'; this.last = Date.now(); this.backoff = 0;
      } catch (e) { this.fail(e); } finally { this.busy = false; Store.persist(true); UI.refresh(); }
      if (Store.pending().length && this.state === 'idle') this.schedule(500);
    },
    async syncOne(id) {
      const o = Store.obj(id), start = o.local, base = o.base || {};
      let merged = null;
      const res = await this.backend.commit(this.uid, id, server => {
        const m = RM.merge(base, start, RM.fromRemote(server));
        merged = m;
        const same = server && JSON.stringify(RM.toRemote(id, m.fields, 0, '', 0).fields) === JSON.stringify(RM.toRemote(id, RM.fromRemote(server), 0, '', 0).fields);
        return { doc: same ? null : RM.toRemote(id, m.fields, ((server && server.rev) || 0) + 1, device, Date.now()), conflicts: m.conflicts, rev: same ? server.rev : ((server && server.rev) || 0) + 1 };
      });
      // acknowledged by the server: rebase keystrokes typed while the commit was in flight onto the merged result
      const now = o.local, rebased = { ...merged.fields };
      for (const p of new Set([...Object.keys(now), ...Object.keys(start)])) if (!RM.same(now[p], start[p])) { if (now[p]) rebased[p] = now[p]; else delete rebased[p]; }
      o.base = merged.fields; o.rev = res.rev; o.local = rebased;
      for (const [p, c] of Object.entries(merged.conflicts)) o.conflicts[p] = { ...c, source: 'device' };
      o.dirty = Object.keys({ ...rebased, ...merged.fields }).some(p => !RM.same(rebased[p], merged.fields[p]));
    },
    fail(e) {
      const code = (e && (e.code || e.name)) || '', msg = (e && e.message) || String(e);
      if (/permission-denied|PERMISSION_DENIED/i.test(code + msg)) { this.state = 'error'; this.msg = 'Access denied by Firestore. Check the published Firestore Rules (catalogue/{userId}/**, owner UID) and Authentication → Authorized domains. Your edits stay on this device.'; }
      else if (/unauthenticated/i.test(code)) { this.state = 'error'; this.msg = 'Signed out by Firebase. Sign in again; pending edits are kept on this device.'; }
      else { this.state = 'offline'; this.msg = msg; this.backoff = Math.min(60000, (this.backoff || 2500) * 2); this.schedule(this.backoff); }
      UI.status();
    },
  };
  window.addEventListener('online', () => { if (Sync.state === 'offline') Sync.state = 'idle'; Sync.schedule(300); });

  /* ---------- review edits ---------- */
  const undo = [];
  function edit(id, path, patch, { record = true } = {}) {
    const o = Store.obj(id), prev = o.local[path] ? { ...o.local[path] } : null;
    o.local = RM.setField(o.local, path, patch, device, Date.now());
    if (record) undo.push({ id, path, prev }); if (undo.length > 200) undo.shift();
    markDirty(id); Store.persist(); Sync.schedule();
  }
  function markDirty(id) { const o = Store.obj(id), b = o.base || {}; o.dirty = Object.keys({ ...o.local, ...b }).some(p => !RM.same(o.local[p], b[p])); }
  function undoLast() {
    const u = undo.pop(); if (!u) return UI.toast('Nothing to undo');
    const o = Store.obj(u.id); o.local = { ...o.local }; if (u.prev) o.local[u.path] = u.prev; else delete o.local[u.path];
    markDirty(u.id); Store.persist(); Sync.schedule(); UI.select(u.id, null, null, true); UI.toast('Undone: ' + u.path);
  }
  function approveAll(id) {
    const o = Store.obj(id), before = o.local, req = required(id);
    o.local = RM.approveAll(o.local, req, device, Date.now());
    for (const p of req) if (!RM.same(before[p], o.local[p])) undo.push({ id, path: p, prev: before[p] || null });
    const fix = Object.entries(o.local).filter(([, f]) => f.status === 'fix').length;
    markDirty(id); Store.persist(); Sync.schedule(); UI.refresh();
    UI.toast(fix ? `Marked the rest as good; ${fix} "Needs fix" item(s) kept` : 'Everything marked as good');
  }
  function resolve(id, path, keep) {
    const o = Store.obj(id), c = o.conflicts[path]; if (!c) return;
    if (keep === 'mine') edit(id, path, c.mine ? { status: c.mine.status, note: c.mine.note, proposal: c.mine.proposal } : { status: 'todo', note: '', proposal: '' });
    delete o.conflicts[path]; Store.persist(); UI.select(id, null, null, true);
  }

  /* ---------- export / import ---------- */
  function exportData() {
    const docs = {}; for (const id of Store.reviewedIds()) docs[id] = Store.fields(id);
    const exp = RM.buildExport(docs, { sourceOf: id => SOURCE[id] || null, required, liveValue, nameOf: id => OBJECTS[id].name, now: Date.now(), game: GAME_VERSION, revision: CURATED.revision, total: IDS.length });
    const conflicts = {}; for (const [id, o] of Object.entries(Store.data.objects)) if (Object.keys(o.conflicts || {}).length) conflicts[id] = o.conflicts;
    if (Object.keys(conflicts).length) exp.unresolvedConflicts = conflicts;
    exp.syncedAccount = Sync.uid ? 'signed in (cloud)' : 'local only (not synced)';
    return exp;
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function doExport() { const e = exportData(), stamp = e.exportedAt.slice(0, 16).replace(/[:T]/g, '-'); download(`snapmon-catalogue-${stamp}.json`, JSON.stringify(e, null, 2), 'application/json'); UI.toast(`Exported ${e.counts.objects} reviewed objects`); }
  function doSummary() { const e = exportData(); download(`snapmon-catalogue-summary-${e.exportedAt.slice(0, 10)}.txt`, RM.summaryText(e), 'text/plain'); }
  function applyEntries(entries, source) {
    const current = {}; for (const id of Object.keys(entries)) current[id] = Store.fields(id);
    const plan = RM.planImport(entries, current);
    for (const it of plan.items) {
      const o = Store.obj(it.id);
      if (it.kind === 'add') { o.local = { ...o.local, [it.path]: { ...it.incoming } }; markDirty(it.id); }
      else if (it.kind === 'conflict') o.conflicts[it.path] = { mine: it.incoming, theirs: it.current, source };
    }
    Store.persist(true); Sync.schedule(500); UI.refresh(); return plan;
  }
  function doImport(text) {
    const r = RM.parseImport(text, id => !!OBJECTS[id]);
    if (!Object.keys(r.entries).length) return UI.dialog('Import', `<p>${r.errors.length ? 'Nothing imported:' : 'The file has no reviews.'}</p><ul>${r.errors.slice(0, 8).map(e => `<li>${esc(e)}</li>`).join('')}</ul>`);
    const current = {}; for (const id of Object.keys(r.entries)) current[id] = Store.fields(id);
    const plan = RM.planImport(r.entries, current);
    UI.dialog('Import reviews', `<p>${Object.keys(r.entries).length} objects in the file: <b>${plan.add}</b> new review field(s) will be added, ${plan.same} are already identical,
      <b>${plan.conflicts}</b> differ from what you have here and become conflicts for you to choose (nothing is overwritten).</p>
      ${r.errors.length ? `<p class="warn">${r.errors.length} entries skipped: ${esc(r.errors.slice(0, 3).join('; '))}</p>` : ''}
      <p class="small">Imported reviews are saved on this device first${Sync.uid ? ' and then synced to the cloud' : ' (local only: NOT synced)'}.</p>`,
      [['Import', () => { const p = applyEntries(r.entries, 'import'); UI.toast(`Imported: ${p.add} added, ${p.conflicts} conflicts`); }]]);
  }

  /* ---------- AI writing review batches (names + flavour only; docs/CATALOGUE.md) ---------- */
  // Export is read-only: it never changes a review, advances a cursor or writes Firestore.
  function batchDialog() {
    const sel = UI.sel, opts = UI._batch = UI._batch || { size: 50, scope: 'all', from: 'start', open: true };
    const pick = () => {
      const ordered = opts.scope === 'list' ? UI.filtered() : IDS;
      return RM.selectWritingBatch(ordered, id => Store.fields(id), { size: +opts.size, startId: opts.from === 'selected' ? sel : null, onlyOpen: opts.open });
    };
    const render = () => {
      const ids = pick(), first = ids[0], last = ids[ids.length - 1];
      UI.dialog('Export AI writing batch', `<p class="small">A JSON file with the <b>live monster names and flavour texts</b> (all five rarities) and your existing reviews of them, plus instructions for the AI. No sprites, moves, stats or account data. Exporting changes nothing.</p>
        <div class="stack">
          <label>Batch size <select id="bsz">${[25, 50, 100].map(n => `<option ${+opts.size === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>Objects from <select id="bsc"><option value="all" ${opts.scope === 'all' ? 'selected' : ''}>the whole catalogue (A–Z)</option><option value="list" ${opts.scope === 'list' ? 'selected' : ''}>the current list (search / filters)</option></select></label>
          <label>Start at <select id="bfr"><option value="start" ${opts.from === 'start' ? 'selected' : ''}>the beginning</option><option value="selected" ${opts.from === 'selected' ? 'selected' : ''} ${sel ? '' : 'disabled'}>the selected object${sel ? ' (' + esc(OBJECTS[sel].name) + ')' : ''}</option></select></label>
          <label class="row1"><input id="bop" type="checkbox" ${opts.open ? 'checked' : ''}> Only objects whose names and flavour texts are not all reviewed yet</label>
        </div>
        <p><b>${ids.length}</b> object(s)${ids.length ? `: ${esc(OBJECTS[first].name)} … ${esc(OBJECTS[last].name)}` : ''}</p>
        <p class="small muted" style="max-height:7em;overflow:auto">${ids.map(esc).join(', ')}</p>`,
        ids.length ? [[`Download batch (${ids.length})`, () => downloadBatch(ids)]] : []);
      for (const [k, el] of [['size', '#bsz'], ['scope', '#bsc'], ['from', '#bfr']]) $(el).onchange = () => { opts[k] = $(el).value; render(); };
      $('#bop').onchange = () => { opts.open = $('#bop').checked; render(); };
    };
    render();
  }
  function downloadBatch(ids) {
    const b = RM.buildWritingBatch(ids, { limits: CURATED_LIMITS, fieldsOf: id => Store.fields(id), nameOf: id => OBJECTS[id].name, categoryOf: id => (CATEGORY[OBJECTS[id].cat] && CATEGORY[OBJECTS[id].cat].name) || OBJECTS[id].cat,
      sourceOf: id => SOURCE[id] || null, liveValue, game: GAME_VERSION, revision: CURATED.revision, now: Date.now() });
    download(`snapmon-ai-writing-batch-${b.exportedAt.slice(0, 10)}-${ids[0]}-${ids.length}.json`, JSON.stringify(b, null, 2), 'application/json');
    UI.toast(`Downloaded ${ids.length} objects. Give this file to the AI; import its answer with "Import AI writing reviews".`);
  }
  // hard rules of the game's validator (src/curated.js) for a proposed name or flavour text; null = fine
  function checkProposal(id, path, t) {
    const [g, r] = path.split('.'), L = CURATED_LIMITS;
    if (g === 'names') {
      const max = r === 'legendary' ? L.legendNameMax : L.nameMax;
      if (t !== t.trim() || /\s{2,}/.test(t)) return 'name has extra spaces';
      if (t.length < L.nameMin || t.length > max) return `name is ${t.length} characters (${L.nameMin}-${max})`;
      if (!/^[A-Z][A-Za-z0-9 '\-,.!&]*$/.test(t) || CURATED_PLACEHOLDER.test(t)) return 'name must start with a capital letter and use letters, digits, spaces and \' - , . ! & only';
    } else {
      if (t.trim().length < L.loreMin || t.length > L.loreMax) return `text is ${t.length} characters (${L.loreMin}-${L.loreMax})`;
      if (CURATED_PLACEHOLDER.test(t)) return 'text contains a placeholder';
    }
    return null;
  }
  function nameWarnings(entries) { // names already used elsewhere in the game (would fail the later patch step)
    const used = new Map(); for (const [oid, e] of Object.entries(CURATED.data)) for (const [r, n] of Object.entries(e.names || {})) used.set(n.toLowerCase(), oid + ' ' + r);
    const out = [];
    for (const [id, fl] of Object.entries(entries)) for (const [p, f] of Object.entries(fl)) if (p.startsWith('names.') && f.proposal) { const u = used.get(f.proposal.toLowerCase()); if (u && u !== id + ' ' + p.slice(6)) out.push(`${id} ${p}: "${f.proposal}" is already used by ${u}`); }
    return out;
  }
  function doAIImport(text) {
    const r = RM.parseAIImport(text, id => !!OBJECTS[id], checkProposal), n = Object.keys(r.entries).length;
    const errs = [...r.errors, ...r.skipped];
    if (!n) return UI.dialog('Import AI writing reviews', `<p>Nothing to import.</p>${errs.length ? `<ul>${errs.slice(0, 8).map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}${r.dropped ? `<p class="small">${r.dropped} non-writing field(s) were ignored.</p>` : ''}`);
    const current = {}; for (const id of Object.keys(r.entries)) current[id] = Store.fields(id);
    const plan = RM.planImport(r.entries, current), warn = nameWarnings(r.entries);
    const byStatus = s => plan.items.filter(i => i.kind === 'add' && i.incoming.status === s).length;
    UI.dialog('Import AI writing reviews', `<p class="small">Review <b>suggestions</b> for names and flavour texts only. They are saved as your review proposals${Sync.uid ? ' and synced' : ' (local only: NOT synced)'}; the game is never changed.</p>
      <p>${n} object(s): <b>${plan.add}</b> field(s) will be added (${byStatus('fix')} needs fix, ${byStatus('ok')} looks good), ${plan.same} already identical,
      <b>${plan.conflicts}</b> differ from your existing reviews and become conflicts for you to choose (nothing is overwritten).</p>
      ${r.dropped ? `<p class="small">${r.dropped} non-writing field(s) (moves, sprites, mapping …) were ignored.</p>` : ''}
      ${errs.length ? `<p class="warn small">${errs.length} skipped: ${esc(errs.slice(0, 4).join('; '))}${errs.length > 4 ? ' …' : ''}</p>` : ''}
      ${warn.length ? `<p class="warn small">Name warnings (kept, but the name is already used in the game): ${esc(warn.slice(0, 4).join('; '))}${warn.length > 4 ? ' …' : ''}</p>` : ''}`,
      [['Import', () => { const p = applyEntries(r.entries, 'ai-import'); UI.toast(`AI reviews imported: ${p.add} added, ${p.conflicts} conflicts`); }]]);
  }

  /* ---------- UI ---------- */
  const prefs = ls.get('prefs', { q: '', cat: '', st: 'all', id: null, rarity: 'common', variant: 'normal' });
  const savePrefs = () => ls.set('prefs', prefs);
  const UI = {
    page: 40, shown: 40, sel: null, rarity: prefs.rarity || 'common', variant: prefs.variant || 'normal', io: null,
    init() {
      $('#q').value = prefs.q || ''; $('#st').value = prefs.st || 'all';
      $('#cat').innerHTML = '<option value="">All categories</option>' + CATS.map(c => `<option value="${esc(c)}">${esc((CATEGORY[c] && CATEGORY[c].name) || c)}</option>`).join(''); $('#cat').value = prefs.cat || '';
      let t; $('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { prefs.q = $('#q').value; savePrefs(); this.shown = this.page; this.list(); }, 180); });
      $('#cat').onchange = () => { prefs.cat = $('#cat').value; savePrefs(); this.shown = this.page; this.list(); };
      $('#st').onchange = () => { prefs.st = $('#st').value; savePrefs(); this.shown = this.page; this.list(); };
      this.io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { this.thumbs(e.target); this.io.unobserve(e.target); } }, { rootMargin: '300px' });
      document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) this.act(b.dataset.a, b.dataset, b); });
      $('#list').addEventListener('click', e => { const r = e.target.closest('.row[data-id]'); if (r) this.select(r.dataset.id); });
      window.addEventListener('keydown', e => { if (e.target.closest('input,textarea,select')) return; if (e.key === 'j') this.step(1); if (e.key === 'k') this.step(-1); if (e.key === 'Escape') this.close(); });
      $('#file').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(doImport); e.target.value = ''; };
      $('#aifile').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(doAIImport); e.target.value = ''; };
      $('#count').textContent = IDS.length;
      this.list();
      if (prefs.id && OBJECTS[prefs.id] && window.innerWidth >= 980) this.select(prefs.id, prefs.rarity, prefs.variant);
      this.status();
    },
    stateOf(id) { const f = Store.fields(id); return Object.keys(f).length ? RM.objectState(f, required(id)) : 'todo'; },
    filtered() {
      const q = (prefs.q || '').trim().toLowerCase(), cat = prefs.cat, st = prefs.st;
      return IDS.filter(id => {
        const o = OBJECTS[id];
        if (cat && o.cat !== cat) return false;
        if (q && !(id.includes(q) || o.name.toLowerCase().includes(q) || (o.al || []).some(a => a.toLowerCase().includes(q)) || Object.values(curated(id).names || {}).some(n => n.toLowerCase().includes(q)))) return false;
        if (st !== 'all') { const s = this.stateOf(id); if (st === 'todo' ? s !== 'todo' : st === 'open' ? s === 'ok' : s !== st) return false; }
        return true;
      }).sort((a, b) => { if (!q) return 0; const r = id => { const n = OBJECTS[id].name.toLowerCase(); return id === q || n === q ? 0 : n.startsWith(q) ? 1 : 2; }; return r(a) - r(b); });
    },
    list() {
      const ids = this.filtered(), slice = ids.slice(0, this.shown);
      $('#list').innerHTML = slice.map(id => {
        const o = OBJECTS[id], s = this.stateOf(id), c = Object.keys((Store.data.objects[id] || {}).conflicts || {}).length;
        return `<div class="row ${this.sel === id ? 'on' : ''}" data-id="${esc(id)}" role="button" tabindex="0"><div class="rt"><b>${esc(o.name)}</b> <span class="badge s-${s}">${STATE_LABEL[s]}</span>${c ? ' <span class="badge s-fix">conflict</span>' : ''}<br><small>${esc(id)} · ${esc(o.cat)}</small></div><div class="th" data-id="${esc(id)}"></div></div>`;
      }).join('') + (ids.length > this.shown ? `<button class="btn block" data-a="more">Show more (${ids.length - this.shown} left)</button>` : '') + (!ids.length ? '<p class="muted pad">No objects match.</p>' : '');
      $('#found').textContent = `${ids.length} shown`;
      for (const el of $('#list').querySelectorAll('.th')) this.io.observe(el);
      this.progress();
    },
    thumbs(el) { const id = el.dataset.id; for (const r of RAR) { const cv = document.createElement('canvas'); renderSprite(cv, sample(id, r, 'normal').dna, 1); cv.title = r; cv.className = 'mini'; el.append(cv); } },
    progress() {
      let ok = 0, fix = 0, part = 0; for (const id of Store.reviewedIds()) { const s = this.stateOf(id); if (s === 'ok') ok++; else if (s === 'fix') fix++; else if (s === 'partial') part++; }
      $('#prog').innerHTML = `<b>${ok}</b> approved · <b>${fix}</b> need fix · ${part} in progress · ${IDS.length - ok - fix - part} unreviewed`;
    },
    status() {
      const s = Sync.status(), el = $('#sync'); el.className = 'sync k-' + s.k; el.textContent = s.t;
      $('#acct').innerHTML = Sync.uid ? `<span class="small">${esc(Sync.email)}</span> <button class="btn sm" data-a="signout">Sign out</button>` : (UI.cloudReady ? '<button class="btn sm primary" data-a="signin">Sign in</button>' : '<span class="small muted">cloud unavailable</span>');
      $('#localwarn').hidden = !!Sync.uid;
      const c = Store.conflictCount(); $('#conf').hidden = !c; $('#conf').textContent = `${c} conflict(s) to resolve`;
      this.localMergeOffer();
    },
    localMergeOffer() {
      const el = $('#localmerge'); if (!Sync.uid || !Sync.ready) { el.hidden = true; return; }
      const loc = ls.get('store.local', { objects: {} }), n = Object.values(loc.objects).filter(o => Object.keys(o.local || {}).length).length;
      el.hidden = !n; el.innerHTML = n ? `${n} object(s) were reviewed in local-only mode on this device. <button class="btn sm" data-a="mergelocal">Merge into my cloud reviews</button>` : '';
    },
    refresh() { this.list(); if (this.sel) this.select(this.sel, null, null, true); this.status(); },
    act(a, d) {
      if (a === 'more') { this.shown += this.page; this.list(); }
      else if (a === 'rar') { this.select(this.sel, d.r, null, true); }
      else if (a === 'var') { this.select(this.sel, null, d.v, true); }
      else if (a === 'close') this.close();
      else if (a === 'prev') this.step(-1); else if (a === 'next') this.step(1); else if (a === 'nextopen') this.nextOpen();
      else if (a === 'st') edit(d.id, d.p, { status: d.s }) || this.select(d.id, null, null, true);
      else if (a === 'good') approveAll(d.id);
      else if (a === 'undo') undoLast();
      else if (a === 'keep') resolve(d.id, d.p, d.k);
      else if (a === 'export') doExport(); else if (a === 'summary') doSummary(); else if (a === 'import') $('#file').click();
      else if (a === 'aibatch') batchDialog(); else if (a === 'aiimport') $('#aifile').click();
      else if (a === 'signin') this.signin(); else if (a === 'signout') this.signout();
      else if (a === 'mergelocal') { const loc = ls.get('store.local', { objects: {} }), ent = {}; for (const [id, o] of Object.entries(loc.objects)) if (OBJECTS[id] && Object.keys(o.local || {}).length) ent[id] = o.local; const p = applyEntries(ent, 'local-only'); ls.del('store.local'); this.toast(`Merged: ${p.add} added, ${p.conflicts} conflicts`); this.status(); }
      else if (a === 'clearlocal') { if (Store.pending().length) return this.toast('Not cleared: there are unsynced changes'); ls.del('store.' + Store.ns); Store.open(Store.ns); this.refresh(); this.toast('This browser\'s copy was cleared (cloud reviews are untouched)'); }
      else if (a === 'dlgclose') $('#dlg').close();
    },
    step(dir) { const ids = this.filtered(); if (!ids.length) return; const i = ids.indexOf(this.sel); this.select(ids[(i + dir + ids.length) % ids.length]); },
    nextOpen() { const ids = IDS, i = Math.max(0, ids.indexOf(this.sel)); for (let k = 1; k <= ids.length; k++) { const id = ids[(i + k) % ids.length], s = this.stateOf(id); if (s === 'todo' || s === 'partial') return this.select(id); } this.toast('Everything is reviewed'); },
    close() { $('#detail').classList.remove('open'); document.body.classList.remove('dopen'); },
    select(id, rarity, variant, keepScroll) {
      if (!id || !OBJECTS[id]) return;
      if (rarity) this.rarity = rarity; if (variant) this.variant = variant;
      const changed = this.sel !== id; this.sel = id; Object.assign(prefs, { id, rarity: this.rarity, variant: this.variant }); savePrefs();
      const o = OBJECTS[id], e = curated(id), f = Store.fields(id), obj = Store.obj(id), r = this.rarity, v = this.variant, m = sample(id, r, v), src = visualSource(o);
      const st = this.stateOf(id), slots = moveSlots(id);
      const html = `
        <div class="dhead"><button class="btn sm" data-a="close" aria-label="Back to list">← List</button>
          <div class="nav"><button class="btn sm" data-a="prev" aria-label="Previous">‹ Prev</button><button class="btn sm" data-a="next" aria-label="Next">Next ›</button><button class="btn sm" data-a="nextopen">Next unreviewed</button></div></div>
        <h2>${esc(o.name)} <span class="badge s-${st}">${STATE_LABEL[st]}</span></h2>
        <p class="small muted">id <code>${esc(id)}</code> · category ${esc((CATEGORY[o.cat] && CATEGORY[o.cat].name) || o.cat)} · design: ${esc(objectTier(o))}${src !== o ? ' (drawn like ' + esc(src.name) + ')' : ''} · body ${esc(m.dna.shape)}${m.dna.sub ? ':' + esc(m.dna.sub) : ''}<br>
          labels: ${esc((o.al || []).slice(0, 8).join(', ') || '—')} · source <code>${esc(SOURCE[id] || '—')}</code></p>
        <div class="actions"><button class="btn primary" data-a="good" data-id="${esc(id)}">Everything looks good</button> <button class="btn" data-a="undo">Undo</button>
          <span class="small muted">Marks every not-yet-reviewed field of this object as good; "Needs fix" items and notes are kept.</span></div>
        <div class="seg" role="group" aria-label="Variant">${VARS.map(x => `<button class="btn sm ${x === v ? 'on' : ''}" data-a="var" data-v="${x}">${VLABEL[x]}</button>`).join('')}</div>
        <div class="rars">${RAR.map(x => `<button class="rcell ${x === r ? 'on' : ''}" data-a="rar" data-r="${x}" style="--rc:${RARITY[x].color}"><canvas data-k="${esc(id)}|${x}|${v}"></canvas><span>${RARITY[x].name}</span></button>`).join('')}</div>
        <p class="small muted">Sample: ${RARITY[r].name} · ${VLABEL[v]} · fixed seed, neutral colours (no photo). Real captures differ in colour and details (photo colours and individual seeds).</p>
        <section class="mon" style="--rc:${RARITY[r].color}">
          <div class="big"><canvas data-k="${esc(id)}|${r}|${v}" data-s="5"></canvas></div>
          <div><div class="rname">${esc(m.name)}</div><div class="small muted">${RARITY[r].name}${v !== 'normal' ? ' · ' + VLABEL[v] : ''} · ${esc((FAMILIES[m.fam] || {}).name || m.fam)} · sample Lv ${m.level} · HP ${m.stats.hp} ATK ${m.stats.atk} DEF ${m.stats.def} SPD ${m.stats.spd}</div>
            <p class="lore">${esc(m.lore)}</p></div>
        </section>
        <h3>Moves of this ${RARITY[r].name}${v !== 'normal' ? ' ' + VLABEL[v] : ''}</h3>
        <table class="moves"><thead><tr><th>Move</th><th>Slot (field)</th><th>Effect</th><th>CD</th></tr></thead><tbody>
          ${m.abilities.map(a => `<tr><td><b>${esc(a.name)}</b>${(e.moves || {})[a.key] ? '' : ' <span class="tag">generated name</span>'}${a.legend ? ' <span class="tag">legend</span>' : ''}${a.ultimate ? ' <span class="tag">Ultimate</span>' : ''}</td><td><code>moves.${esc(a.key)}</code></td><td>${esc(effectText(a))}</td><td>${a.cd || 0}</td></tr>`).join('')}
        </tbody></table>
        <h3>Review — ${RARITY[r].name}</h3>
        ${field(id, 'names.' + r, 'Monster name (' + RARITY[r].name + ')', f, obj)}
        ${field(id, 'lore.' + r, 'Flavour text (' + RARITY[r].name + ')', f, obj)}
        ${field(id, 'visual.' + r + '.' + v, 'Sprite: ' + RARITY[r].name + ' · ' + VLABEL[v] + ' (optional)', f, obj, true)}
        <h3>Review — whole object</h3>
        ${field(id, 'visual', 'Sprite / design (object)', f, obj, true)}
        ${slots.map(s => field(id, 'moves.' + s.key, 'Move name · ' + s.key + ' (' + s.rarities.map(x => RARITY[x].name).join(', ') + ')', f, obj)).join('')}
        ${field(id, 'mapping', 'Recogniser mapping (optional)', f, obj, true)}
        <p class="small muted">Edits here are PROPOSALS for later, approved source patches (content/curated). They never change the game.</p>`;
      const d = $('#detail'); const sc = d.scrollTop; d.innerHTML = html; d.classList.add('open'); document.body.classList.add('dopen'); if (keepScroll) d.scrollTop = sc; else d.scrollTop = 0;
      for (const cv of d.querySelectorAll('canvas[data-k]')) { const [i, rr, vv] = cv.dataset.k.split('|'); renderSprite(cv, sample(i, rr, vv).dna, +(cv.dataset.s || 2)); }
      for (const el of d.querySelectorAll('[data-in]')) el.addEventListener('input', () => inputEdit(el));
      if (changed) for (const row of $('#list').querySelectorAll('.row')) row.classList.toggle('on', row.dataset.id === id);
    },
    async signin() {
      this.dialog('Sign in (owner)', `<form id="sf" class="stack"><label>Email<input id="em" type="email" autocomplete="username" required></label>
        <label>Password<input id="pw" type="password" autocomplete="current-password" required></label>
        <label class="row1"><input id="rem" type="checkbox"> Keep me signed in on this device (leave off on a shared or work PC)</label>
        <p id="serr" class="warn" role="alert"></p><button class="btn primary" type="submit">Sign in</button></form>`);
      $('#sf').onsubmit = async ev => {
        ev.preventDefault(); $('#serr').textContent = 'Signing in…';
        try { await Sync.backend.signIn($('#em').value.trim(), $('#pw').value, $('#rem').checked); $('#pw').value = ''; $('#dlg').close(); }
        catch (e) { $('#serr').textContent = authMessage(e); }
      };
    },
    async signout() {
      const p = Store.pending().length;
      this.dialog('Sign out', `<p>${p ? `<b>${p} object(s) are not uploaded yet.</b> They stay saved on this device and are synced the next time you sign in here.` : 'Everything is synced. Your cloud reviews are not affected by signing out.'}</p>
        ${p ? '' : '<p class="small">On a shared or work PC you can also remove this browser\'s copy of the reviews (the cloud copy stays).</p>'}`,
        [['Sign out', async () => { await Sync.backend.signOut(); }], ...(p ? [] : [['Sign out and clear this browser', async () => { const ns = Store.ns; await Sync.backend.signOut(); ls.del('store.' + ns); }]])]);
    },
    dialog(title, body, buttons = []) {
      const d = $('#dlg'); d.innerHTML = `<h3>${esc(title)}</h3><div>${body}</div><div class="dbtn">${buttons.map((b, i) => `<button class="btn ${i ? '' : 'primary'}" data-i="${i}">${esc(b[0])}</button>`).join('')}<button class="btn" data-a="dlgclose">Close</button></div>`;
      d.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => { d.close(); await buttons[+b.dataset.i][1](); });
      if (!d.open) d.showModal();
    },
    toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('show'), 2600); },
  };
  function effectText(a) {
    const bits = [];
    if (a.power) bits.push(Math.round(a.power * 100) + '% power' + (a.hits > 1 ? ' ×' + a.hits : ''));
    if (a.effect) bits.push((a.self ? 'self ' : '') + a.effect + (a.chance ? ' ' + Math.round(a.chance * 100) + '%' : ''));
    if (a.heal) bits.push('heal ' + Math.round(a.heal * 100) + '%');
    return bits.join(' · ') || '—';
  }
  function field(id, path, label, fields, obj, reviewOnly) {
    const f = fields[path] || { status: 'todo', note: '', proposal: '' }, live = reviewOnly ? null : liveValue(id, path), c = (obj.conflicts || {})[path];
    const inp = (k, ph, v, big) => big ? `<textarea data-in data-id="${esc(id)}" data-p="${esc(path)}" data-k="${k}" placeholder="${ph}" rows="2">${esc(v)}</textarea>` : `<input data-in data-id="${esc(id)}" data-p="${esc(path)}" data-k="${k}" placeholder="${ph}" value="${esc(v)}">`;
    return `<div class="field st-${f.status}" data-path="${esc(path)}"><div class="fl"><b>${esc(label)}</b> <code class="small">${esc(path)}</code></div>
      ${live != null ? `<div class="live"><span class="small muted">Live:</span> ${esc(live)}</div>` : ''}
      <div class="seg">${RM.STATUSES.map(s => `<button class="btn sm ${f.status === s ? 'on s-' + s : ''}" data-a="st" data-id="${esc(id)}" data-p="${esc(path)}" data-s="${s}">${SLABEL[s]}</button>`).join('')}</div>
      ${inp('note', 'Note: what is wrong or what you want (optional)', f.note, true)}
      ${live != null ? inp('proposal', 'Proposed replacement text (optional)', f.proposal, path.startsWith('lore.')) : ''}
      ${c ? `<div class="conflict"><b>Conflict${c.source === 'ai-import' ? ' with an AI writing review' : c.source === 'import' ? ' with an imported review' : c.source === 'local-only' ? ' with a local-only review' : ' with another device'}:</b>
        <div>A (${c.source === 'device' ? 'this device, not uploaded' : c.source}): ${fmt(c.mine)}</div><div>B (current${c.source === 'device' ? ' in the cloud' : ''}): ${fmt(c.theirs)}</div>
        <button class="btn sm" data-a="keep" data-id="${esc(id)}" data-p="${esc(path)}" data-k="mine">Keep A</button> <button class="btn sm" data-a="keep" data-id="${esc(id)}" data-p="${esc(path)}" data-k="theirs">Keep B</button></div>` : ''}
    </div>`;
  }
  const fmt = f => f ? `${SLABEL[f.status]}${f.note ? ' — “' + esc(f.note) + '”' : ''}${f.proposal ? ' → “' + esc(f.proposal) + '”' : ''}` : '(nothing)';
  const inputTimers = {};
  function inputEdit(el) {
    const { id, p, k } = el.dataset, key = id + '|' + p + '|' + k;
    ls.set('draft', { ns: Store.ns, id, p, k, v: el.value }); // keystrokes survive a crash or reload before the debounce
    clearTimeout(inputTimers[key]);
    inputTimers[key] = setTimeout(() => { const cur = Store.fields(id)[p] || {}; edit(id, p, { [k]: el.value, status: cur.status || 'todo' }); ls.del('draft'); UI.list(); UI.status(); }, 600);
  }
  function restoreDraft(ns) { const d = ls.get('draft', null); if (d && d.ns === ns && OBJECTS[d.id] && RM.isPath(d.p)) { ls.del('draft'); edit(d.id, d.p, { [d.k]: d.v }, { record: false }); } }
  function authMessage(e) {
    const c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return 'Email or password is not correct.';
    if (/too-many-requests/.test(c)) return 'Too many attempts. Wait a few minutes and try again.';
    if (/network-request-failed/.test(c)) return 'No connection to Firebase (network or firewall). You can keep reviewing locally (not synced).';
    if (/unauthorized-domain|operation-not-allowed/.test(c)) return 'Firebase refused this site: check Authentication → Settings → Authorized domains (patrikarendas-droid.github.io) and that Email/Password sign-in is enabled.';
    return 'Sign-in failed: ' + ((e && e.message) || c || 'unknown error');
  }
  window.addEventListener('beforeunload', () => { Store.persist(true); });

  /* ---------- boot: UI first (local), then the cloud via a guarded dynamic import ---------- */
  UI.cloudReady = false;
  Store.open('local'); UI.init();
  async function loadBackend() {
    if (window.__CATALOGUE_TEST_BACKEND) return window.__CATALOGUE_TEST_BACKEND; // tests only (mock Firebase)
    const t = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));
    return (await Promise.race([import('./cloud.js'), t])).backend;
  }
  loadBackend().then(b => {
    Sync.backend = b; UI.cloudReady = true; UI.status();
    b.onAuth(async user => {
      if (user && user.uid !== b.ownerUid) { await b.signOut(); Sync.stop(); Store.open('local'); UI.refresh(); return UI.dialog('Not allowed', '<p>This account is not the catalogue owner. Only the owner\'s account can use cloud review sync.</p>'); }
      if (user) await Sync.start(user); else { Sync.stop(); Store.open('local'); UI.refresh(); }
    });
  }).catch(e => { Sync.cloudError = 'Firebase could not be loaded: network or firewall'; UI.status(); console.warn('catalogue: cloud unavailable', e); });
  window.__catalogue = { Store, Sync, UI, sample, moveSlots, required, liveValue, exportData, applyEntries, device, IDS, checkProposal }; // for tests and debugging
})();
