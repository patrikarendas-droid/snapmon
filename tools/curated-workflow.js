// Curated-writing batch workflow (used by tools/curated.js): manifests, writer packs, progress, lint and review sheets.
// Offline and deterministic. The linter is a FLAGGER for a human editor, not a judge: it never edits content and
// never changes a status. See docs/CONTENT_WRITING_GUIDE.md and docs/SNAPMON_WRITING_BIBLE.md.
'use strict';
const fs = require('fs'), path = require('path');
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const ROOT = path.join(__dirname, '..');
const asList = v => (v == null ? [] : typeof v === 'string' ? [v] : Array.isArray(v) ? v : []);
const words = t => String(t).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const STOP = new Set('a an the and or but of to in on at for with by from it its it\'s is are was were be been has have had that this as into than then so if not no every all you your they them their he she his her one up out just can'.split(' '));
const content = t => words(t).filter(w => !STOP.has(w) && w.length > 2);
const jacc = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };

/* ---------- move facts (exact mechanics per stable key, incl. legendary variants) ---------- */
function moveFacts(T, id) {
  const o = T.OBJECTS[id], slots = T.curatedMoveSlots(id), out = {};
  const mk = (r, v) => { let s = 1; T.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; }); return T.createMonster(T.freshState(), { obj: id, rarity: r, variant: v }); };
  const byR = Object.fromEntries(RAR.map(r => [r, mk(r, null)]));
  for (const [key, def] of Object.entries(slots)) {
    if (key === 'legend' || key === 'ultimate') {
      const variants = Object.fromEntries([['normal', null], ['spectral', 'spectral'], ['mutated', 'mutated']].map(([n, v]) => [n, mk('legendary', v).abilities.find(a => a.key === key)]));
      out[key] = { key, default: variants.normal.name, rarities: ['legendary'], variants, a: variants.normal, differ: new Set(Object.values(variants).map(mechText)).size > 1 };
    } else {
      const a = key === 'signature' ? byR.common.abilities[0] : (() => { const k = T.moveKit(o.cat, o).find(x => 'kit.' + x.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') === key); return { ...k, cd: T.cdFor(k) }; })();
      out[key] = { key, default: def, rarities: key === 'signature' ? RAR.slice() : RAR.filter(r => byR[r].abilities.some(x => x.key === key)), a };
    }
  }
  return { slots: out, names: Object.fromEntries(RAR.map(r => [r, byR[r].name])) };
}
const mechText = a => a ? (a.self ? `self ${a.effect}` : `${Math.round(a.power * 100)}%${(a.hits || 1) > 1 ? ' ×' + a.hits : ''}${a.effect ? ' · ' + a.effect + (a.effect === 'drain' ? '' : ' ' + Math.round((a.chance || 1) * 100) + '%') : ''}`) + ` · cd ${a.cd}` : '';

/* ---------- entries from all content files ---------- */
function entriesOf(docs) {
  const out = [];
  for (const { rel, doc } of docs) for (const [id, e] of Object.entries((doc && doc.entries) || {})) out.push({ id, file: rel, batch: doc.batch || path.basename(rel, '.json'), status: e.status || 'draft', e });
  return out;
}

/* ---------- lint ---------- */
const WARN_PATTERNS = [
  { rule: 'opens-with-can', re: /^Can\b/, label: 'starts with "Can"', share: 0.15 },
  { rule: 'entire', re: /\bentire\b/i, label: '"entire …"', share: 0.10 },
  { rule: 'banned-fired', re: /\b(banned|fired)\b/i, label: '"banned / fired"', share: 0.06 },
  { rule: 'furious', re: /\b(furious|outraged|filed a complaint)\b/i, label: '"furious / complaint"', share: 0.06 },
  { rule: 'experts', re: /\b(scientists|astronomers|experts|professors)\b/i, label: '"scientists / experts"', share: 0.05 },
  { rule: 'number-three', re: /\bthree\b/i, label: 'the number three', share: 0.06 },
  { rule: 'cosmic', re: /\b(sun|moon|stars?|universe|galaxy|planet|earth|solar system|cosmos|space)\b/i, label: 'cosmic scale', share: 0.12 },
];
const FILLER = /\b(ancient|prophec|kingdom|the gods|scroll|nobody knows|no one knows|legends say|only in whispers|hunters whisper|since the dawn|eldritch|doom)\w*/i; // literal whispering is fine
const BRANDS = /\b(coca[- ]?cola|pepsi|red bull|monster energy|lego|nintendo|pok[eé]mon|disney|marvel|mcdonald'?s|starbucks|nike|adidas|iphone|ikea|google|amazon|netflix|tiktok|youtube|minecraft|barbie|harry potter|star wars)\b/i;
const GORE = /\b(blood|gore|guts|corpse|dead body|murder|kill(ed|s)?|torture|decapitat\w*|severed)\b/i;
const MEME = /\b(rizz|skibidi|sus|yeet|no cap|ohio|sigma|gyatt|bussin|stonks)\b/i;
const LEX = { // whole words only (no "nap" in "Snap", no "frost" in "Defrost")
  burn: /\b(fire\w*|flam\w*|burn\w*|scald\w*|sizzl\w*|toasty|toasted|roast\w*|blaz\w*|ember\w*|scorch\w*|sear\w*|boil\w*|lava|inferno)\b/i,
  poison: /\b(poison\w*|venom\w*|toxic\w*|rot|rott\w*|stink\w*|mould\w*|mold\w*|rust\w*|blight\w*|plague\w*|fumes?|stench|sour\w*)\b/i,
  heal: /\b(heal\w*|rest|refill\w*|patch\w*|mend\w*|rewind\w*|recharg\w*|nap|repair\w*|restor\w*|reboot\w*|second wind)\b/i,
  attack: /\b(smash\w*|slam\w*|strike\w*|punch\w*|crush\w*|bash\w*|bite\w*|chomp\w*|whack\w*|kick\w*|headbutt\w*|wallop\w*|clobber\w*)\b/i,
  multi: /(\b(\w+) \2\b|\b(barrage|flurry|storm|rain|volley|spray|frenzy|combo|rapid|triple|thousand|swarm|hail|machine|salvo|onslaught|scatter|shower|blitz|clatter)\b|s\b)/i,
  grand: /\b(cosmic|apocalyps\w*|\w*ocalypse|ultimate|universe|planet\w*|world|armageddon|doom|eternal)\b/i,
  single: /\b(stun\w*|freez\w*|frost\w*|ice|icy|shock\w*)\b/i,
};
function lint(T, docs, opts = {}) {
  const flags = [], F = (sev, id, field, rule, msg, batch) => flags.push({ sev, id, field, rule, msg, batch });
  const all = entriesOf(docs);
  const texts = [], names = [];
  for (const x of all) {
    for (const r of RAR) asList(x.e.lore && x.e.lore[r]).forEach((t, i) => texts.push({ ...x, r, t, field: `lore.${r}${i ? '#' + (i + 1) : ''}`, cw: content(t) }));
    for (const r of RAR) if (x.e.names && typeof x.e.names[r] === 'string') names.push({ ...x, r, n: x.e.names[r] });
  }
  const scope = x => !opts.batch || x.batch === opts.batch; // report on one batch, compare against everything
  // 1-3: duplicates and repeated premises
  const norm = t => words(t).join(' ');
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j]; if (!scope(a) && !scope(b)) continue;
    const tgt = scope(b) ? b : a, other = tgt === b ? a : b;
    if (norm(a.t) === norm(b.t)) { F('high', tgt.id, tgt.field, 'duplicate-text', `same text as ${other.id} ${other.field}`, tgt.batch); continue; }
    const sim = jacc(a.cw, b.cw);
    if (a.id === b.id && sim >= 0.34) F('medium', tgt.id, tgt.field, 'same-premise', `shares much of its wording with ${other.field} (${Math.round(sim * 100)}% overlap): two rarities may repeat one premise`, tgt.batch);
    else if (a.id !== b.id && sim >= 0.5 && a.cw.length >= 5) F('medium', tgt.id, tgt.field, 'near-duplicate', `very similar to ${other.id} ${other.field} (${Math.round(sim * 100)}% overlap)`, tgt.batch);
  }
  // 4: content rules per text
  for (const x of texts) {
    if (!scope(x)) continue;
    if (BRANDS.test(x.t)) F('high', x.id, x.field, 'brand', `brand or franchise name: "${x.t.match(BRANDS)[0]}"`, x.batch);
    if (GORE.test(x.t)) F('high', x.id, x.field, 'gore', `violent word: "${x.t.match(GORE)[0]}"`, x.batch);
    if (MEME.test(x.t)) F('medium', x.id, x.field, 'meme', `meme slang: "${x.t.match(MEME)[0]}"`, x.batch);
    if (FILLER.test(x.t)) F('medium', x.id, x.field, 'generic-filler', `generic myth/mystery filler: "${x.t.match(FILLER)[0]}"`, x.batch);
    if (x.t.length > 180) F('low', x.id, x.field, 'long', `${x.t.length} characters: long for a phone (aim ≤ 160)`, x.batch);
    if ((x.t.match(/[.!?](\s|$)/g) || []).length > 2) F('low', x.id, x.field, 'sentences', 'more than two sentences', x.batch);
    if (x.r !== 'legendary' && WARN_PATTERNS.find(p => p.rule === 'cosmic').re.test(x.t)) F('low', x.id, x.field, 'cosmic-early', 'cosmic scale below Legendary', x.batch);
  }
  // 5: pattern clusters per batch (share of that batch's texts), and repeated openings
  const batches = [...new Set(texts.filter(scope).map(x => x.batch))];
  for (const b of batches) {
    const bt = texts.filter(x => x.batch === b), legend = bt.filter(x => x.r === 'legendary');
    for (const p of WARN_PATTERNS) {
      const pool = p.rule === 'cosmic' ? legend : bt, hits = pool.filter(x => p.re.test(x.t));
      const limit = p.rule === 'cosmic' ? Math.max(2, Math.floor(pool.length / 3)) : Math.max(2, Math.ceil(pool.length * p.share));
      if (hits.length > limit) for (const x of hits) F('low', x.id, x.field, 'cluster:' + p.rule, `${p.label}: ${hits.length} of ${pool.length} ${p.rule === 'cosmic' ? 'legendary ' : ''}texts in ${b} (watch above ${limit})`, b);
    }
    const open = {}; for (const x of bt) { const k = words(x.t).slice(0, 2).join(' '); (open[k] = open[k] || []).push(x); }
    for (const [k, xs] of Object.entries(open)) if (xs.length > Math.max(2, Math.ceil(bt.length * 0.04))) for (const x of xs) F('low', x.id, x.field, 'opening', `opens with "${k}…" like ${xs.length - 1} other texts in ${b}`, b);
  }
  // 6: monster names
  const byName = {}; for (const x of names) (byName[x.n.toLowerCase()] = byName[x.n.toLowerCase()] || []).push(x);
  for (const xs of Object.values(byName)) if (xs.length > 1) for (const x of xs.filter(scope)) F('high', x.id, `names.${x.r}`, 'duplicate-name', `"${x.n}" is also used by ${xs.filter(y => y !== x).map(y => y.id + ' ' + y.r).join(', ')}`, x.batch);
  const endings = {}; for (const x of names) { const w = x.n.split(/[\s,-]+/).filter(Boolean), last = w[w.length - 1].toLowerCase(), suf = last.length > 5 ? last.slice(-4) : last; (endings[suf] = endings[suf] || []).push(x); }
  for (const [suf, xs] of Object.entries(endings)) if (xs.length >= 4) for (const x of xs.filter(scope)) F('low', x.id, `names.${x.r}`, 'name-ending', `ending "…${suf}" appears in ${xs.length} curated names`, x.batch);
  const HYPE = /\b(lord|king|queen|supreme|cosmic|mega|ultra|ultimate|omega|overlord|emperor|titan)\b|zilla\b/i;
  const hype = names.filter(x => HYPE.test(x.n)); if (hype.length > Math.max(3, names.length * 0.06)) for (const x of hype.filter(scope)) F('low', x.id, `names.${x.r}`, 'name-hype', `stock power word "${x.n.match(HYPE)[0]}" (${hype.length} names use one)`, x.batch);
  for (const x of names.filter(scope)) {
    if (/\b(common|uncommon|rare|epic|legendary)\b/i.test(x.n)) F('medium', x.id, `names.${x.r}`, 'rarity-word', 'contains a rarity word', x.batch);
    if (BRANDS.test(x.n)) F('high', x.id, `names.${x.r}`, 'brand', 'brand or franchise name', x.batch);
    if (x.r !== 'legendary' && x.n.includes(',')) F('low', x.id, `names.${x.r}`, 'epithet-early', 'an epithet ("Name, the …") below Legendary', x.batch);
  }
  // 7: move names against their real mechanics
  const factsCache = {};
  for (const x of all.filter(scope)) {
    if (!x.e.moves) continue;
    const facts = factsCache[x.id] = factsCache[x.id] || moveFacts(T, x.id);
    const own = Object.entries(x.e.moves);
    for (const [key, name] of own) {
      const f = facts.slots[key]; if (!f || typeof name !== 'string') continue;
      const a = f.a, eff = a.effect, field = `moves.${key}`;
      if (name === f.default) F('low', x.id, field, 'move-unchanged', 'same as the default name (no override needed)', x.batch);
      if (a.self && LEX.attack.test(name) && !LEX.heal.test(name)) F('medium', x.id, field, 'move-self', `"${name}" sounds like an attack but the move is self ${eff}`, x.batch);
      if (eff === 'heal' && !a.self) {}
      if (LEX.burn.test(name) && eff !== 'burn' && !f.differ) F('medium', x.id, field, 'move-effect', `"${name}" suggests burning but the move ${mechText(a)}`, x.batch);
      if (LEX.poison.test(name) && eff !== 'poison' && !f.differ) F('medium', x.id, field, 'move-effect', `"${name}" suggests poison but the move ${mechText(a)}`, x.batch);
      if (LEX.heal.test(name) && eff !== 'heal' && !(a.self)) F('medium', x.id, field, 'move-effect', `"${name}" suggests healing but the move ${mechText(a)}`, x.batch);
      if ((a.hits || 1) >= 3 && !LEX.multi.test(name)) F('low', x.id, field, 'move-multihit', `the move hits ${a.hits} times; the name could suggest several hits`, x.batch);
      if (f.differ && (LEX.burn.test(name) || LEX.poison.test(name) || LEX.single.test(name))) F('medium', x.id, field, 'ultimate-variants', `effect differs by variant (${Object.entries(f.variants).map(([v, b]) => v + ': ' + b.effect).join(', ')}), but "${name}" names one effect`, x.batch);
      if (key.startsWith('kit.') && !f.rarities.some(r => r === 'epic' || r === 'legendary') && LEX.grand.test(name)) F('low', x.id, field, 'move-grand', `used only by ${f.rarities.join('/') || 'no'} monsters but sounds legendary`, x.batch);
    }
  }
  const order = { high: 0, medium: 1, low: 2 };
  flags.sort((a, b) => order[a.sev] - order[b.sev] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || (a.field < b.field ? -1 : 1));
  return flags;
}

/* ---------- manifests, packs, progress ---------- */
function readManifest(batch) {
  const f = path.join(ROOT, 'content/batches', batch + '.json');
  if (!fs.existsSync(f)) throw new Error(`no manifest content/batches/${batch}.json`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function checkManifest(T, m, docs) {
  const errors = [], ids = m.ids || [];
  if (!m.batch) errors.push('manifest needs "batch"');
  if (new Set(ids).size !== ids.length) errors.push('duplicate ids in the manifest');
  for (const id of ids) if (!T.OBJECTS[id]) errors.push(`unknown object id ${id}`);
  const reviewed = new Set(entriesOf(docs).filter(x => x.status === 'reviewed').map(x => x.id));
  for (const id of ids) if (reviewed.has(id)) errors.push(`${id} already has reviewed (live) content`);
  if (m.size != null && ids.length !== m.size) errors.push(`manifest says size ${m.size} but lists ${ids.length} ids`);
  return errors;
}
function progress(T, m, docs) {
  const mine = entriesOf(docs).filter(x => x.batch === m.batch);
  return m.ids.map(id => {
    const e = (mine.find(x => x.id === id) || {}).e || {}, slots = T.curatedMoveSlots(id);
    const lore = RAR.filter(r => asList(e.lore && e.lore[r]).length).length, names = RAR.filter(r => e.names && e.names[r]).length, moves = Object.keys(e.moves || {}).filter(k => k in slots).length;
    return { id, status: e.status || (lore || names || moves ? 'draft' : 'not-started'), lore, names, moves, complete: lore === 5 && names === 5 };
  });
}
function examplesFor(T, id, approved) {
  const o = T.OBJECTS[id], pick = Object.keys(approved).sort((a, b) => hash(id + a) - hash(id + b));
  const near = Object.keys(approved).filter(k => T.OBJECTS[k].cat === o.cat || (o.lore && T.OBJECTS[k].lore === o.lore));
  return [...new Set([...near, 'apple', ...pick])].slice(0, 2);
}
function writePack(T, m, docs, outDir) {
  const approved = {}; for (const x of entriesOf(docs)) if (x.status === 'reviewed') approved[x.id] = x.e;
  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  for (const id of m.ids) {
    const o = T.OBJECTS[id], f = moveFacts(T, id), fam = T.createMonster(T.freshState(), { obj: id, rarity: 'common' }).fam;
    const ex = examplesFor(T, id, approved);
    const lines = [
      `# Writer pack · ${id}`, '',
      `**${o.name}** · category ${T.CATEGORY[o.cat].name} · group ${o.lore || '–'} · family ${fam} · design ${T.objectTier(o)} (looks like: ${T.visualSource(o).name})`,
      `Also recognised as: ${o.al.filter(a => a.toLowerCase() !== o.name.toLowerCase()).slice(0, 6).join(', ') || '–'}`, '',
      '## Current generated monster names (to replace)', ...RAR.map(r => `- ${r}: ${f.names[r]}`), '',
      '## Move slots (names only; numbers never change)',
      ...Object.values(f.slots).map(s => s.variants
        ? `- \`${s.key}\` (Legendary only) · default "${s.default}" · ${s.differ ? 'VARIES BY VARIANT → name must be effect-neutral: ' + Object.entries(s.variants).map(([v, a]) => v + ' ' + mechText(a)).join(' / ') : mechText(s.a)}`
        : `- \`${s.key}\` · default "${s.default}" · ${mechText(s.a)} · used by: ${s.rarities.join(', ') || 'no rarity of this object'}`), '',
      '## Approved examples (Pilot 01, exact)', ...ex.flatMap(k => [`**${k}**`, ...RAR.map(r => `- ${r}: ${asList(approved[k] && approved[k].lore && approved[k].lore[r])[0] || ''}`)]), '',
      '## Deliver (JSON, status stays "draft")',
      '```json', JSON.stringify({ [id]: { status: 'draft', names: Object.fromEntries(RAR.map(r => [r, '…'])), lore: Object.fromEntries(RAR.map(r => [r, '…'])), moves: { signature: '…' }, notes: 'optional rationale for reviewers' } }, null, 2), '```', '',
    ];
    const file = path.join(outDir, id + '.md'); fs.writeFileSync(file, lines.join('\n')); files.push(file);
  }
  fs.writeFileSync(path.join(outDir, 'README.md'), `# Writer packs · ${m.batch}

One file per object with its exact facts, move mechanics and two approved Pilot 01 examples. Generated by
\`node tools/curated.js pack ${m.batch}\` from the registry; regenerate any time (deterministic).

How to write (any Claude session, also from a phone):
1. Read [docs/SNAPMON_WRITING_BIBLE.md](../../../docs/SNAPMON_WRITING_BIBLE.md) once.
2. For each object pack: write 5 monster names, 5 flavour texts (a different premise per rarity), and names only for
   move slots where a new name is a real improvement and fits the listed mechanics.
3. Put the entries into \`content/curated/${m.batch}-draft.json\` with \`"status": "draft"\`. Never "reviewed".
4. Run \`node tools/curated.js validate\`, \`node tools/curated.js lint --batch ${m.batch}\` and
   \`node tools/curated.js progress ${m.batch}\`. Fix errors; read the flags.
5. An editor pass (a separate session) writes \`content/review/${m.batch}-issues.json\`; the human editor decides.

Objects (${m.ids.length}): ${m.ids.map(id => `[${id}](${id}.md)`).join(' · ')}
`);
  return files;
}

/* ---------- review sheet (Markdown, phone-friendly) ---------- */
function reviewSheet(T, docs, batch, flags, issues) {
  const mine = entriesOf(docs).filter(x => x.batch === batch);
  const ids = mine.map(x => x.id).sort();
  const sample = ids.slice().sort((a, b) => hash(batch + a) - hash(batch + b)).slice(0, Math.min(8, ids.length)).sort();
  const sev = s => flags.filter(f => f.sev === s).length;
  const byId = {}; for (const f of flags) (byId[f.id] = byId[f.id] || []).push(f);
  const iss = {}; for (const i of issues) (iss[i.id] = iss[i.id] || []).push(i);
  const rules = {}; for (const f of flags) rules[f.rule] = (rules[f.rule] || 0) + 1;
  const out = [`# Review sheet · ${batch}`, '',
    `Generated by \`node tools/curated.js review ${batch}\`. All entries are **draft**: nothing here is in the game.`,
    `To change one field, edit it in \`content/curated/${batch}-draft.json\`, then re-run \`validate\`, \`lint\` and \`review\`.`, '',
    `**${ids.length} objects** · lint flags: ${sev('high')} high · ${sev('medium')} medium · ${sev('low')} low · editor issues: ${issues.length}`, '',
    '## Flags by rule', ...Object.entries(rules).sort((a, b) => b[1] - a[1]).map(([r, n]) => `- ${r}: ${n}`), '',
    `## Fixed sample to read first (${sample.length})`, sample.map(id => `[${id}](#${id.replace(/_/g, '_')})`).join(' · '), ''];
  for (const x of mine.sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const o = T.OBJECTS[x.id], facts = moveFacts(T, x.id), e = x.e;
    out.push(`---`, `### ${x.id}`, `**${o.name}** · ${T.CATEGORY[o.cat].name}${o.lore ? ' · ' + o.lore : ''} · ${e.status || 'draft'}`, '');
    for (const r of RAR) {
      out.push(`**${r[0].toUpperCase() + r.slice(1)}** · *${(e.names && e.names[r]) || '(no name)'}* (now: ${facts.names[r]})`);
      out.push(`> ${asList(e.lore && e.lore[r])[0] || '(no text)'}`, '');
    }
    const mv = Object.entries(e.moves || {});
    if (mv.length) { out.push('Moves:'); for (const [k, n] of mv) { const s = facts.slots[k]; out.push(`- \`${k}\` ${s ? s.default : '?'} → **${n}** · ${s ? (s.differ ? Object.entries(s.variants).map(([v, a]) => v + ' ' + mechText(a)).join(' / ') : mechText(s.a)) : ''}${s && !s.variants ? ' · used by ' + (s.rarities.join('/') || '–') : ''}`); } out.push(''); }
    const fl = byId[x.id] || [], is = iss[x.id] || [];
    if (fl.length || is.length) { out.push('Flags:'); for (const f of fl) out.push(`- ${f.sev.toUpperCase()} \`${f.field}\` ${f.msg}`); for (const i of is) out.push(`- EDITOR ${i.severity} \`${i.field}\` ${i.note}${i.suggestion ? ' — suggestion: ' + i.suggestion : ''}`); out.push(''); }
    if (e.notes) out.push(`*Notes:* ${e.notes}`, '');
  }
  return out.join('\n') + '\n';
}

module.exports = { RAR, moveFacts, mechText, entriesOf, lint, readManifest, checkManifest, progress, writePack, reviewSheet };
