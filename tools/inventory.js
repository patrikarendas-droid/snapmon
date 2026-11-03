#!/usr/bin/env node
// Master inventory of every recognised object for the curated-writing pipeline (docs/CONTENT_WRITING_GUIDE.md).
// Deterministic and offline: built from the real registry (src/), the content files (content/curated/*.json), batch
// manifests (content/batches/*.json) and editor issue lists (content/review/*-issues.json). Never part of the game.
//   node tools/inventory.js            write content/inventory/inventory.jsonl, inventory.csv and docs/review/COVERAGE.md
//   node tools/inventory.js --check    exit 1 if those files are out of date (used by tests)
// Re-running gives byte-identical files; it is safe to run after every content change (resumable work).
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = { jsonl: 'content/inventory/inventory.jsonl', csv: 'content/inventory/inventory.csv', md: 'docs/review/COVERAGE.md' };
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'], VARIANTS = ['normal', 'spectral', 'mutated'];

function loadGame() {
  const ctx = { console, Math, JSON, Date }; vm.createContext(ctx);
  vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'curated.js', 'curated-data.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n') +
    ';globalThis.T={OBJECTS,OBJECT_LIST,CATEGORY,FAMILIES,CURATED,objectTier,visualSource,createMonster,freshState,monsterLore,moveKit,curatedMoveSlots,cdFor,setRNG:f=>{RNG=f}}', ctx);
  return ctx.T;
}
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const list = dir => fs.existsSync(path.join(ROOT, dir)) ? fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.json')).sort().map(f => path.join(dir, f)) : [];

function build() {
  const T = loadGame();
  const live = { enabled: T.CURATED.enabled, moves: T.CURATED.movesEnabled };
  // content files: per object, every entry with its file, batch and status
  const content = {};
  for (const f of list('content/curated')) { const d = readJSON(path.join(ROOT, f)); for (const [id, e] of Object.entries(d.entries || {})) (content[id] = content[id] || []).push({ file: f, batch: d.batch || path.basename(f, '.json'), e }); }
  const manifests = {}; for (const f of list('content/batches')) { const m = readJSON(path.join(ROOT, f)); for (const id of m.ids || []) (manifests[id] = manifests[id] || []).push(m.batch); }
  const issues = {}; for (const f of list('content/review').filter(f => /-issues\.json$/.test(f))) for (const i of readJSON(path.join(ROOT, f)).issues || []) (issues[i.id] = issues[i.id] || []).push(i);
  // compact, exact mechanics: "95% · poison 60% · cd 2", "45% ×3 · cd 3", "self atkup · cd 3", "self heal · cd 3"
  const mech = a => a && (a.self ? `self ${a.effect}` : `${Math.round(a.power * 100)}%${a.hits > 1 ? ' ×' + a.hits : ''}${a.effect ? ' · ' + a.effect + (a.effect === 'drain' ? '' : ' ' + Math.round((a.chance || 1) * 100) + '%') : ''}`) + ` · cd ${a.cd}`;
  const rows = [];
  for (const o of T.OBJECT_LIST.slice().sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const cat = T.CATEGORY[o.cat], mk = (r, variant, curated) => { T.CURATED.enabled = T.CURATED.movesEnabled = curated; let s = 1; T.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; }); const m = T.createMonster(T.freshState(), { obj: o.id, rarity: r, variant: variant === 'normal' ? null : variant }); T.CURATED.enabled = live.enabled; T.CURATED.movesEnabled = live.moves; return m; };
    const byR = Object.fromEntries(RAR.map(r => [r, mk(r, 'normal', false)])), liveR = Object.fromEntries(RAR.map(r => [r, mk(r, 'normal', true)]));
    const slots = T.curatedMoveSlots(o.id), moves = [];
    for (const [key, def] of Object.entries(slots)) {
      if (key === 'legend' || key === 'ultimate') {
        const v = {}; let name; for (const variant of VARIANTS) { const a = mk('legendary', variant, false).abilities.find(x => x.key === key); v[variant] = mech(a); if (variant === 'normal') name = a.name; }
        const liveName = liveR.legendary.abilities.find(x => x.key === key).name;
        moves.push({ key, default: name, live: liveName !== name ? liveName : null, rarities: ['legendary'], mech: new Set(Object.values(v)).size > 1 ? v : v.normal, variantsDiffer: new Set(Object.values(v)).size > 1 });
        continue;
      }
      const src = key === 'signature' ? byR.common.abilities[0] : T.moveKit(o.cat, o).find(a => 'kit.' + a.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') === key);
      const a = key === 'signature' ? src : { ...src, cd: T.cdFor(src) }; // the game's own cooldown rule (game.js cdFor)
      const liveName = key === 'signature' ? liveR.common.abilities[0].name : ((RAR.map(r => liveR[r].abilities.find(x => x.key === key)).find(Boolean)) || {}).name;
      moves.push({ key, default: def, live: liveName && liveName !== def ? liveName : null, rarities: key === 'signature' ? RAR : RAR.filter(r => byR[r].abilities.some(x => x.key === key)), mech: mech(a) });
    }
    const entries = content[o.id] || [], statusOf = layer => { const has = entries.filter(x => x.e[layer] && Object.keys(x.e[layer]).length); return has.some(x => x.e.status === 'reviewed') ? 'reviewed' : has.some(x => x.e.status === 'needs-revision') ? 'needs-revision' : has.length ? 'draft' : 'not-started'; };
    const layerKeys = layer => [...new Set(entries.flatMap(x => Object.keys(x.e[layer] || {})))].sort();
    const status = ['reviewed', 'needs-revision', 'draft'].find(st => ['lore', 'names', 'moves'].some(l => statusOf(l) === st)) || 'not-started';
    rows.push({
      id: o.id, name: o.name, category: o.cat, categoryName: cat.name, group: o.lore || null, family: byR.common.fam, theme: o.lore || o.cat,
      tier: T.objectTier(o), look: T.visualSource(o).id, aliases: o.al.filter(a => a.toLowerCase() !== o.name.toLowerCase()).slice(0, 6),
      names: Object.fromEntries(RAR.map(r => [r, byR[r].name])),
      // the PROCEDURAL text (curated text switched off), as a fallback reference; approved text lives in content/curated
      lore: (() => { T.CURATED.enabled = false; const l = Object.fromEntries(RAR.map(r => [r, T.monsterLore({ obj: o.id, rarity: r, seed: 1, name: byR[r].name, abilities: byR[r].abilities, fam: byR[r].fam })])); T.CURATED.enabled = live.enabled; return l; })(),
      moves,
      curated: { status, batches: [...new Set(entries.map(x => x.batch).concat(manifests[o.id] || []))].sort(), lore: { status: statusOf('lore'), rarities: layerKeys('lore') }, names: { status: statusOf('names'), rarities: layerKeys('names') }, moves: { status: statusOf('moves'), keys: layerKeys('moves') } },
      issues: (issues[o.id] || []).length,
    });
  }
  return { T, rows };
}

function render({ T, rows }) {
  const jsonl = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
  const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csvHead = ['id', 'name', 'category', 'group', 'family', 'theme', 'tier', 'status', 'lore', 'names', 'moves', 'batches', 'issues', 'common_name', 'legendary_name', 'signature', 'kit_moves', 'legend_effects', 'ultimate_effects'];
  const csv = [csvHead.join(',')].concat(rows.map(r => { const lg = r.moves.find(m => m.key === 'legend'), ul = r.moves.find(m => m.key === 'ultimate');
    return [r.id, r.name, r.category, r.group, r.family, r.theme, r.tier, r.curated.status, r.curated.lore.status + ':' + r.curated.lore.rarities.length, r.curated.names.status + ':' + r.curated.names.rarities.length, r.curated.moves.status + ':' + r.curated.moves.keys.length, r.curated.batches.join(' '), r.issues, r.names.common, r.names.legendary, r.moves[0].default, r.moves.filter(m => m.key.startsWith('kit.')).map(m => m.default).join(' / '), typeof lg.mech === 'string' ? lg.mech : Object.values(lg.mech).join(' | '), typeof ul.mech === 'string' ? ul.mech : Object.values(ul.mech).join(' | ')].map(q).join(','); })).join('\n') + '\n';
  // dashboard
  const n = rows.length, labels = new Set(rows.flatMap(r => [r.name.toLowerCase(), ...T.OBJECTS[r.id].al.map(a => a.toLowerCase())])).size;
  const units = { lore: n * 5, names: n * 5, moves: rows.reduce((a, r) => a + r.moves.length, 0) };
  const count = (layer, st) => rows.reduce((a, r) => a + (r.curated[layer].status === st ? (layer === 'moves' ? r.curated.moves.keys.length : r.curated[layer].rarities.length) : 0), 0);
  const objs = (layer, st) => rows.filter(r => r.curated[layer].status === st).length;
  const pct = (a, b) => (100 * a / b).toFixed(2) + '%';
  const byTheme = {}; for (const r of rows) { const t = byTheme[r.theme] = byTheme[r.theme] || { n: 0, reviewed: 0, draft: 0 }; t.n++; if (r.curated.status === 'reviewed') t.reviewed++; else if (r.curated.status !== 'not-started') t.draft++; }
  const batches = {}; for (const r of rows) for (const b of r.curated.batches) { const x = batches[b] = batches[b] || { n: 0, reviewed: 0, draft: 0, needs: 0, issues: 0, complete: 0 }; x.n++; x[r.curated.status === 'reviewed' ? 'reviewed' : r.curated.status === 'needs-revision' ? 'needs' : 'draft']++; x.issues += r.issues; if (r.curated.lore.rarities.length === 5 && r.curated.names.rarities.length === 5) x.complete++; }
  const liveBytes = fs.statSync(path.join(ROOT, 'src/curated-data.js')).size, liveN = Object.keys(T.CURATED.data).length || 1;
  const md = `# Curated writing coverage

Generated by \`node tools/inventory.js\` from the registry and \`content/\`. Do not edit by hand. Full data:
[\`content/inventory/inventory.jsonl\`](../../content/inventory/inventory.jsonl) (one object per line) and
[\`inventory.csv\`](../../content/inventory/inventory.csv).

## Objects

- **${n} object identities** in the registry.
- ${labels} distinct recognisable labels (names + aliases) map onto them; labels are not separate monsters.
- Design tiers: ${['dedicated', 'composed', 'related', 'family'].map(t => `${t} ${rows.filter(r => r.tier === t).length}`).join(' · ')}.

## Coverage per layer

| Layer | Units | Reviewed (live) | Draft | Needs revision | Not curated (generated text) | Objects reviewed / draft |
|---|---|---|---|---|---|---|
| Flavour text (object × rarity) | ${units.lore} | ${count('lore', 'reviewed')} (${pct(count('lore', 'reviewed'), units.lore)}) | ${count('lore', 'draft')} | ${count('lore', 'needs-revision')} | ${units.lore - count('lore', 'reviewed') - count('lore', 'draft') - count('lore', 'needs-revision')} | ${objs('lore', 'reviewed')} / ${objs('lore', 'draft')} |
| Monster names (object × rarity) | ${units.names} | ${count('names', 'reviewed')} (${pct(count('names', 'reviewed'), units.names)}) | ${count('names', 'draft')} | ${count('names', 'needs-revision')} | ${units.names - count('names', 'reviewed') - count('names', 'draft') - count('names', 'needs-revision')} | ${objs('names', 'reviewed')} / ${objs('names', 'draft')} |
| Move names (object × move slot) | ${units.moves} | ${count('moves', 'reviewed')} | ${count('moves', 'draft')} | ${count('moves', 'needs-revision')} | ${units.moves - count('moves', 'reviewed') - count('moves', 'draft') - count('moves', 'needs-revision')} | ${objs('moves', 'reviewed')} / ${objs('moves', 'draft')} |

Move slots per object: signature, the 4 moves of its kit (each used only by the rarities listed in the inventory),
legend move and Ultimate (Legendary only). Not every slot needs a curated name: a slot without an override keeps
its generated move name (that is the "not curated" count, not missing work).

## Batches

| Batch | Objects | Reviewed | Draft | Needs revision | 5 names + 5 lore | Editor issues |
|---|---|---|---|---|---|---|
${Object.entries(batches).sort().map(([b, x]) => `| ${b} | ${x.n} | ${x.reviewed} | ${x.draft} | ${x.needs} | ${x.complete} | ${x.issues} |`).join('\n')}

## Themes (for choosing batches)

| Theme (group or category) | Objects | Reviewed | Draft |
|---|---|---|---|
${Object.entries(byTheme).sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1)).map(([t, x]) => `| ${t} | ${x.n} | ${x.reviewed} | ${x.draft} |`).join('\n')}

## Live data size

The live data file \`src/curated-data.js\` is ${(liveBytes / 1024).toFixed(1)} KB for ${liveN} reviewed objects
(~${Math.round(liveBytes / liveN)} bytes each), bundled with the page (offline, no network at encounter time). Since v0.5.0 it
holds all ${n} objects; measured parse time: ~50 ms desktop, ~140–240 ms with 4–6× CPU throttling (one-time, at start-up).
Only entries with \`"status": "reviewed"\` are built; drafts never enter the game.
`;
  return { jsonl, csv, md };
}

const out = render(build());
const files = { [OUT.jsonl]: out.jsonl, [OUT.csv]: out.csv, [OUT.md]: out.md };
if (process.argv.includes('--check')) {
  const stale = Object.entries(files).filter(([f, txt]) => !fs.existsSync(path.join(ROOT, f)) || fs.readFileSync(path.join(ROOT, f), 'utf8') !== txt).map(([f]) => f);
  if (stale.length) { console.log('out of date (run node tools/inventory.js):', stale.join(', ')); process.exit(1); }
  console.log('ok: inventory and coverage report are up to date'); process.exit(0);
}
for (const [f, txt] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), txt); }
console.log(`wrote ${Object.keys(files).join(', ')} (${out.jsonl.split('\n').length - 1} objects)`);
