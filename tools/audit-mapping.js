#!/usr/bin/env node
// Recognition → object identity → visual honesty audit (2026-11). Deterministic, offline, reusable for every future
// mapping change. It lists every recogniser label route (ImageNet classes, COCO classes, the TinyCLIP vocabulary, and
// the registry alias index that objectForLabel uses), resolves each to its object, design and curated status, and runs
// triage lint for SEMANTIC/SHAPE mismatches. Lint is a triage tool, not an oracle: every high/medium flag needs a
// recorded decision below (kept + reason, or review), and tests/mapping-audit.js fails on undecided high flags.
//   node tools/audit-mapping.js            write content/audit/*.csv + docs/review/MAPPING_AUDIT.md
//   node tools/audit-mapping.js --check    exit 1 if the written files are out of date
// Contact sheets of real sprites for flagged groups: tools/audit-sheet.js (see the report).
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');

/* ---------- decisions for flags that are deliberately kept (reviewed with code + rendered sprites) ---------- */
const KEEP = {
  // ImageNet name collisions: the classifier returns the same text for two classes, so the class cannot be told apart
  'animal-to-object:kite': 'ImageNet class 21 is the bird "kite"; ImageNet has no toy-kite class, so photos of toy kites also come back as "kite". Kept as the toy Kite (far more likely to be photographed).',
  'animal-to-object:crane': 'ImageNet classes 134 (bird) and 517 (machine) are both named "crane"; the table is keyed by name, so they cannot be separated. Kept as the Mobile crane.',
  // homonyms: one word, two things; the common household meaning wins
  'sibling-shadow:bat': 'homonym: "bat" → Baseball bat (object hunt); Bat animal keeps "bat animal".',
  'sibling-shadow:crane': 'homonym (see animal-to-object:crane).',
  'sibling-shadow:kiwi': 'homonym: "kiwi" → Kiwi fruit; Kiwi bird keeps "kiwi bird".',
  'sibling-shadow:monitor': 'homonym: "monitor" → computer Monitor; Monitor lizard keeps "monitor lizard".',
  'sibling-shadow:toy robot': '"toy robot" → Toy robot is right; Toy robot dog keeps its own label.',
  // superclass: the label is a kind of the object it reaches (a gecko IS a lizard); shared body, honest generic name
  'sibling-shadow:alligator': 'superclass: Lizard is the generic reptile body; Alligator lizard is a different animal (its own label).',
  'sibling-shadow:chameleon': 'superclass: a chameleon is a lizard (generic Lizard identity, same body).',
  'sibling-shadow:gecko': 'superclass: a gecko is a lizard.',
  'sibling-shadow:kitten': 'superclass: a kitten is a cat.',
  'sibling-shadow:puppy': 'superclass: a puppy is a dog.',
  'sibling-shadow:moose': 'superclass: deer family, Deer body.',
  'sibling-shadow:reindeer': 'superclass: deer family, Deer body.',
  'sibling-shadow:polar bear': 'superclass: a polar bear is a bear (Polar bear cub keeps its own label).',
  // alias collisions (first registration wins) judged acceptable
  'alias-collision:washer': 'ambiguous word; the washing machine is the likelier photo. Hardware Washer keeps no label of its own (see unreachable-name).',
  'alias-collision:pot': '"pot" → Cooking pot; ImageNet "pot, flowerpot" is overridden to Potted plant (CLASS_OVERRIDES).',
  'alias-collision:hot pot': 'a hot pot is served in a pot: Cooking pot body is honest.',
  'alias-collision:mouse': 'ambiguous word; computer Mouse wins (ImageNet "mouse, computer mouse"); the animal keeps "mouse (animal)" on Hamster.',
  // v0.5.0: every object has curated writing, so objects without a label of their own are now "curated-unreachable".
  // Recognition is unchanged on purpose (out of scope); the writing is ready for when a label is given to them.
  'curated-unreachable:x_mouse': 'animal Mouse: "mouse" → computer Mouse (see alias-collision:mouse); the animal is reached via "mouse (animal)" on Hamster. Writing kept for a future own label.',
  'curated-unreachable:x_washer': 'hardware Washer: "washer" → Washing machine (see alias-collision:washer). Writing kept for a future own label.',
  'alias-collision:drum': 'resolved: "drum" now → Drum; the oil-drum sense was removed from Drink can.',
  'alias-collision:dice': 'resolved: "dice" now → Dice; removed from Jigsaw puzzle.',
  // approximate bodies kept on purpose: right identity, a body that is close enough (no template worth inventing)
  'family-body:x_seal': 'marine mammal on the four-legged mammal body: the identity, name and text are right; no flipper body exists. Acceptable approximation.',
  'family-body:x_sea_lion': 'as x_seal.', 'family-body:x_walrus': 'as x_seal.', 'family-body:x_manatee': 'as x_seal.', 'family-body:x_dugong': 'as x_seal.',
  'family-body:x_stingray': 'a ray on the fish body: related sea creature, recognisable as a fish-like animal.',
  'family-body:x_mobile_toy': 'a hanging baby mobile on the plush-toy body: a toy, nothing closer exists.',
  'family-body:x_mouthguard': 'small sports item on the round ball body; rarely photographed, no closer template.',
  'kind-mismatch:honeycomb': 'identity is right (Honeycomb, filed with bugs: the bees\' comb). Its design rule matched "comb" (a hair comb) — fixed by whole-word rule matching; now a cell-dotted slab.',
  'unreachable-name:x_washer': 'see alias-collision:washer. Needs a distinct label (e.g. "metal washer") in a future vocabulary change.',
  'unreachable-name:x_mouse': 'see alias-collision:mouse.',
};
// confirmed fixes of this audit: regression expectations (label → object) checked by tests/mapping-audit.js
const FIXED = [
  ['sea urchin', 'x_sea_urchin_shell', 'was Starfish (alias on Starfish + ImageNet range fish:star)'],
  ['sea urchin shell', 'x_sea_urchin_shell', 'unchanged identity, now drawn as a round spiky urchin (was a fish)'],
  ['starfish, sea star', 'starfish', 'genuine starfish unchanged'], ['sea star', 'starfish', 'genuine starfish unchanged'],
  ['drum, membranophone, tympan', 'drum', 'was Drink can ("drum" alias for an oil drum)'], ['drum', 'drum', 'was Drink can'],
  ['dice', 'x_dice', 'was Jigsaw puzzle'], ['shopping cart', 'x_shopping_trolley', 'was Wheelbarrow (curated Shopping trolley exists)'],
  ['pot, flowerpot', 'potted_plant', 'was Cooking pot'], ['Cardigan, Cardigan Welsh corgi', 'i_cardigan', 'was T-shirt ("cardigan")'],
  ["plane, carpenter's plane, woodworking plane", 'i_plane', 'was Airplane'],
  ['koala', 'x_koala_bear', 'was Bear'], ['koala, koala bear, kangaroo bear, native bear, Phascolarctos cinereus', 'x_koala_bear', 'was Bear'],
  ['gorilla', 'x_gorilla_ape', 'was Monkey'], ['orangutan', 'x_orangutan_ape', 'was Monkey'], ['guinea pig', 'x_guinea_pig_pet', 'was Hamster'],
  ['llama', 'x_llama_animal', 'was Camel'], ['alpaca', 'x_alpaca_animal', 'was Camel'], ['wolf', 'x_wolf_pup', 'was Fox'],
  ['timber wolf, grey wolf, gray wolf, Canis lupus', 'x_wolf_pup', 'was Fox'], ['moth', 'x_moth_insect', 'was Butterfly'],
  ['scorpion', 'x_scorpion_arachnid', 'was Spider'], ['slug', 'x_slug_creature', 'was Snail'], ['centipede', 'x_centipede_insect', 'was Caterpillar'],
  ['toad', 'x_toad_creature', 'was Frog'],
  ['walking stick, walkingstick, stick insect', 'x_stick_insect', 'was the Walking stick (a cane) for the ImageNet insect class'],
  ['piggy bank', 'piggy_bank', 'was Pig (new Piggy bank object, pig-shaped body)'], ['piggy bank, penny bank', 'piggy_bank', 'was Pig'],
  ['whale', 'whale', 'was Shark (new Whale object, shark body)'], ['dolphin', 'dolphin', 'was Shark (new Dolphin object, shark body)'],
  ['killer whale', 'x_orca', 'was Shark'], ['killer whale, killer, orca, grampus, sea wolf, Orcinus orca', 'x_orca', 'was Shark'],
  ['wombat', 'wombat', 'was Bear (new Wombat object, bear body)'], ['binoculars', 'binoculars', 'was Glasses (new Binoculars object, scope design)'],
  ['binoculars, field glasses, opera glasses', 'binoculars', 'was Glasses'], ['tongs', 'x_tongs', 'was Pliers'], ['trowel', 'x_trowel', 'was Shovel'],
  ['gerbil', 'x_gerbil', 'was Hamster'],
];

/* ---------- load the game registry and recogniser tables ---------- */
function load() {
  const ctx = { console, Math, JSON, Date }; vm.createContext(ctx);
  vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'curated.js', 'curated-data.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n') +
    ';globalThis.X={OBJECTS,OBJECT_LIST,ALIAS_INDEX,LABEL_OBJECTS,CATEGORY,objectForLabel,objectTier,visualSource,designOf,CURATED,VIS_FIXES,EXTRA_ALIASES}', ctx);
  const src = fs.readFileSync(path.join(ROOT, 'tools/gen-labels.js'), 'utf8');
  const G = new Function(src.slice(src.indexOf('const RANGES'), src.indexOf('const COCO_MAP')).replace(/const CLASS_OVERRIDES[\s\S]*?\n};\n/, '') + src.slice(src.indexOf('const CLASS_OVERRIDES'), src.indexOf('// excluded in v2')) + ';return {RANGES,RULES,CLASS_OVERRIDES}')();
  return { X: ctx.X, G, imagenet: require(path.join(ROOT, 'tools/data/imagenet-classes.json')), coco: require(path.join(ROOT, 'tools/data/coco-classes.json')),
    vocab: JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/vocab-labels.json'), 'utf8')) };
}
const LIVING = new Set(['animal', 'bird', 'fish', 'bug', 'reptile']);
// shape-congruent words for categories whose default body is ONE specific thing (family tier only)
const BODY_WORDS = {
  fish: /fish|shark|\bray\b|eel|tuna|salmon|trout|\bcod\b|carp|guppy|betta|orca|narwhal|whale|seahorse|aquarium|bowl|pike|minnow|sardine|herring|mackerel/,
  instrument: /guitar|violin|cello|bass|banjo|mandolin|lute|sitar|ukulele|harp|music box/,
  toy: /teddy|bear|doll|plush|puppet|marionette|dummy|figure|soldier|stuffed/,
  cloth: /shirt|top\b|tunic|vest|jacket|coat|sweater|jumper|hoodie|cardigan|fleece|parka|robe|gown|dress|pajamas|nightgown|onesie|overalls|dungarees|jumpsuit|uniform|costume|poncho|cape|cloak|sari|kilt|swimsuit|wetsuit|bikini|leggings|tights|stockings|underwear|trunks|turtleneck|windbreaker/,
  phone: /phone|pager|remote|ipod|player|radio|tracker|fob|charger|power bank|walkie|case|device|gps|handset|earpiece/,
  ball: /ball|puck|shuttlecock|shot put/,
  faucet: /tap|faucet|shower|bidet|fountain|pump|hose|sprinkler/,
  car: /\bcar\b|minicar|truck|van\b|bus\b|cab\b|jeep|limo|coupe|roadster|\brod\b|hearse|kart|buggy|wagon|tractor|harvester|thresher|vehicle|mobile home|hovercraft|rickshaw|tuk|segway|atv|quad|scooter|caravan|trailer/,
  book: /book|magazine|comic|manga|album|dictionary|encyclopedia|bible|atlas|journal|diary|newspaper|brochure|flyer|leaflet|pamphlet|card|paper|menu|bookend|origami|letter/,
  bug: /fly|mosquito|gnat|moth|wasp|hornet|termite|flea|tick|louse|aphid|cicada|insect|mantis|earwig|silverfish|beetle|bug|weevil|cockroach|\bant\b|bee\b/,
  reptile: /lizard|gecko|dragon|salamander|newt|axolotl|chameleon|croc|alligator|dino|rex|triceratops|iguana|komodo/,
  animal: /^(?!.*\b(seal|sea lion|walrus|manatee|dugong|bat animal)\b)/, // a four-legged body fits most mammals
  chair: /chair|stool|seat|bench|pew|ottoman|pouffe|footrest|chaise|daybed/,
};

function collect() {
  const { X, G, imagenet, coco, vocab } = load();
  const O = X.OBJECTS, aliasRoute = label => { // objectForLabel WITHOUT the generated table (the alias index alone)
    const parts = String(label).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    for (const p of parts) if (X.ALIAS_INDEX.has(p)) return X.ALIAS_INDEX.get(p);
    for (const p of parts) { const q = p.replace(/s$/, ''); if (X.ALIAS_INDEX.has(q)) return X.ALIAS_INDEX.get(q); }
    return null;
  };
  const intended = (cls, i) => { const first = cls.split(',')[0].trim(); const r = G.RANGES.find(([a, b]) => i >= a && i <= b); if (r && i < 398) return [r[2], r[3]]; const rule = G.RULES.find(([re]) => re.test(first.toLowerCase())); return rule ? [rule[1], rule[2] || null] : ['other', null]; };
  const template = o => { if (!o) return ''; const v = o.vis; if (!v) return 'family:' + (X.CATEGORY[o.cat].shape || 'blob'); if (v === 'D') return 'dedicated:' + o.id; if (v.legacy) return 'legacy:' + v.legacy + (v.sub ? '_' + v.sub : ''); if (v.like) return 'like:' + v.like + ' → ' + template(O[v.like]); if (v.t) return (o.neutral ? 'neutral:' : 'composed:') + v.t + (v.shape ? '/' + v.shape : v.kind ? '/' + v.kind : v.head ? '/' + v.head : ''); return '?'; };
  const curated = id => { const e = X.CURATED && X.CURATED.data && X.CURATED.data[id]; return e && e.status === 'reviewed' ? (e.names ? 'reviewed+names' : 'reviewed') : ''; };
  // every route
  const routes = [];
  imagenet.forEach((cls, i) => { const t = X.LABEL_OBJECTS.imagenet[cls], [cat, sub] = intended(cls, i); routes.push({ source: 'imagenet', idx: i, label: cls, object: t === 0 ? null : t, excluded: t === 0, alias: aliasRoute(cls), intended: cat + (sub ? ':' + sub : ''), override: Object.prototype.hasOwnProperty.call(G.CLASS_OVERRIDES, cls) }); });
  for (const c of coco) { const t = X.LABEL_OBJECTS.coco[c]; routes.push({ source: 'coco', label: c, object: t === 0 ? null : t, excluded: t === 0, alias: aliasRoute(c) }); }
  for (const v of vocab) routes.push({ source: 'clip', label: v.l, object: v.o, excluded: !v.o, alias: v.o ? aliasRoute(v.l) : null });
  for (const [l, id] of X.ALIAS_INDEX) routes.push({ source: 'alias', label: l, object: id, alias: id });
  // per object
  const reach = {}; for (const r of routes) if (r.object && r.source !== 'alias') (reach[r.object] = reach[r.object] || new Set()).add(r.source);
  const objects = X.OBJECT_LIST.map(o => { const vs = X.visualSource(o); return { id: o.id, name: o.name, cat: o.cat, tier: X.objectTier(o), visual: vs !== o ? vs.id : '', template: template(o), aliases: [o.name.toLowerCase(), ...o.al].filter((x, i, a) => a.indexOf(x) === i), sources: [...(reach[o.id] || [])].sort(), curated: curated(o.id), visFix: !!o.visFix }; });
  return { X, routes, objects, template, curated };
}

function lint(C) {
  const { X, routes, objects } = C, O = X.OBJECTS, flags = [], add = (rule, sev, key, detail) => flags.push({ rule, sev, key, detail, decision: KEEP[rule + ':' + key] || '' });
  // 1. routes must agree: generated table vs the alias index (unless a recorded class override), CLIP vocab vs alias index
  for (const r of routes) {
    if (r.excluded || r.source === 'alias') continue;
    if (r.alias && r.object !== r.alias && !r.override) add('route-disagreement', 'high', r.source + ':' + r.label, `${r.source} table → ${r.object}, alias index → ${r.alias}`);
    if (!O[r.object]) add('missing-object', 'high', r.source + ':' + r.label, `→ ${r.object} does not exist`);
  }
  // 2. ImageNet animal classes (index < 398) must reach a living thing
  for (const r of routes) if (r.source === 'imagenet' && !r.excluded && r.idx < 398 && O[r.object] && !LIVING.has(O[r.object].cat)) add('animal-to-object', 'high', r.label.split(',')[0].trim().toLowerCase(), `ImageNet animal class #${r.idx} "${r.label}" (${r.intended}) → ${r.object} (${O[r.object].name}, ${O[r.object].cat})`);
  // 3. ImageNet object classes whose intended category differs in kind (object ↔ living)
  for (const r of routes) if (r.source === 'imagenet' && !r.excluded && r.idx >= 398 && O[r.object]) { const ic = r.intended.split(':')[0]; if (ic !== 'other' && LIVING.has(ic) !== LIVING.has(O[r.object].cat)) add('kind-mismatch', 'medium', r.label.split(',')[0].trim().toLowerCase(), `"${r.label}" (${r.intended}) → ${r.object} (${O[r.object].name}, ${O[r.object].cat})`); }
  // 4. alias strings declared by several objects (first registration wins)
  const decl = new Map(); for (const o of X.OBJECT_LIST) for (const a of [o.name, ...o.al]) { const k = String(a).toLowerCase().trim(); if (!decl.has(k)) decl.set(k, []); if (!decl.get(k).includes(o.id)) decl.get(k).push(o.id); }
  for (const [k, ids] of decl) if (ids.length > 1) add('alias-collision', 'medium', k, `"${k}" declared by ${ids.join(', ')} → ${X.ALIAS_INDEX.get(k)} wins`);
  // 5. an object's own name resolves elsewhere
  for (const o of X.OBJECT_LIST) { const to = X.objectForLabel(o.name); if (to !== o.id) add('unreachable-name', 'medium', o.id, `"${o.name}" → ${to} (${to && O[to] ? O[to].name : 'nothing'})`); }
  // 6. a label taken by a sibling while the label's own species object exists ("<label> animal/insect/…")
  const Q = /^(.+) (animal|creature|insect|arachnid|bear|ape|pet|lizard|cat|dog|bird|fish|shell|pup|cub)$/;
  for (const o of X.OBJECT_LIST) { const m = Q.exec(o.name.toLowerCase()); if (!m) continue; const to = X.objectForLabel(m[1]); if (to && to !== o.id) add('sibling-shadow', 'high', m[1], `"${m[1]}" → ${to} (${O[to].name}) although ${o.id} (${o.name}) exists`); }
  // 7. family-tier objects drawn with a category body that is one specific thing, name not congruent with it
  for (const o of X.OBJECT_LIST) { if (X.objectTier(o) !== 'family' || o.neutral) continue; const re = BODY_WORDS[o.cat]; if (re && !re.test(o.name.toLowerCase())) add('family-body', 'medium', o.id, `${o.name}: drawn with the ${o.cat} category body (${X.CATEGORY[o.cat].shape})`); }
  // 8. curated objects must be reachable and own their name
  for (const o of objects) if (o.curated && !o.sources.length) add('curated-unreachable', 'high', o.id, `${o.name} has reviewed writing but no recogniser label reaches it`);
  // fixed expectations must hold
  for (const [label, want, note] of FIXED) { const got = X.objectForLabel(label); if (got !== want) add('regression', 'high', label, `expected ${want} (${note}), got ${got}`); }
  flags.sort((a, b) => ['high', 'medium', 'low'].indexOf(a.sev) - ['high', 'medium', 'low'].indexOf(b.sev) || a.rule.localeCompare(b.rule) || a.key.localeCompare(b.key));
  return flags;
}

// family-body flags are triage for the review queue: decided as a group in the report rather than one by one
const REVIEW_GROUPS = {
  'family-body': 'Not wrong identities: honest names and texts, drawn with the category body. Listed for design work (review queue); none is a different species/object identity.',
  'kind-mismatch': 'Object classes reaching a living-thing object or the reverse; each reviewed below.',
};

const csv = rows => rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n') + '\n';
function render(C, flags) {
  const { routes, objects, X } = C, O = X.OBJECTS, byObj = Object.fromEntries(objects.map(o => [o.id, o]));
  const fkey = new Map(); for (const f of flags) { const k = f.key; fkey.set(k, (fkey.get(k) || []).concat(f.rule)); }
  const labelRows = [['source', 'label', 'object', 'display', 'other_aliases', 'sources_reaching_object', 'visual_source', 'tier', 'template', 'curated', 'flags']];
  for (const r of routes) { const o = r.object && byObj[r.object]; const fl = (fkey.get(r.label.split(',')[0].trim().toLowerCase()) || []).concat(fkey.get(r.source + ':' + r.label) || []);
    labelRows.push([r.source + (r.idx != null ? '#' + r.idx : ''), r.label, r.excluded ? '(excluded: never a monster)' : r.object, o ? o.name : '', o ? o.aliases.filter(a => a !== r.label.toLowerCase()).slice(0, 8).join('; ') : '', o ? o.sources.join(' ') : '', o ? o.visual : '', o ? o.tier : '', o ? o.template : '', o ? o.curated : '', [...new Set(fl)].join(' ')]); }
  const objRows = [['id', 'name', 'category', 'tier', 'visual_source', 'template', 'aliases', 'recognised_by', 'curated', 'audit_visual_fix', 'flags']];
  for (const o of objects) objRows.push([o.id, o.name, o.cat, o.tier, o.visual, o.template, o.aliases.join('; '), o.sources.join(' ') || '(none)', o.curated, o.visFix ? 'yes' : '', [...new Set(fkey.get(o.id) || [])].join(' ')]);
  const count = s => routes.filter(r => r.source === s).length, ex = s => routes.filter(r => r.source === s && r.excluded).length;
  const tiers = {}; for (const o of objects) tiers[o.tier] = (tiers[o.tier] || 0) + 1;
  const reachable = objects.filter(o => o.sources.length).length, sev = s => flags.filter(f => f.sev === s), undecided = flags.filter(f => f.sev === 'high' && !f.decision);
  const byRule = {}; for (const f of flags) (byRule[f.rule] = byRule[f.rule] || []).push(f);
  const md = [];
  md.push('# Recognition → identity → visual audit', '', 'Generated by `node tools/audit-mapping.js` (do not edit by hand; decisions live in that file). Data: `content/audit/mapping-labels.csv` (every label route) and `content/audit/mapping-objects.csv` (every object). Contact sheets of real game sprites: `docs/review/audit-sheets/`.', '');
  md.push('## Coverage', '', '| | count |', '|---|---|',
    `| Registry objects | ${objects.length} (dedicated ${tiers.dedicated}, composed ${tiers.composed}, related ${tiers.related}, family ${tiers.family}) |`,
    `| Alias index (labels objectForLabel knows) | ${count('alias')} |`,
    `| ImageNet classes (MobileNet) | ${count('imagenet')} (${ex('imagenet')} excluded: people, places, weapons) |`,
    `| COCO classes (COCO-SSD) | ${count('coco')} (${ex('coco')} excluded) |`,
    `| TinyCLIP vocabulary labels | ${count('clip')} (${ex('clip')} background concepts) |`,
    `| Objects reachable from a recogniser | ${reachable} (the rest exist for saves and as design sources) |`,
    `| Route agreement (table vs alias index, CLIP vs alias index) | ${flags.filter(f => f.rule === 'route-disagreement').length} disagreements |`, '');
  md.push('## Fixed by this audit (regression-tested)', '', '| Label | Now | Before |', '|---|---|---|', ...FIXED.map(([l, w, n]) => `| ${l} | ${w} (${O[w] ? O[w].name : '?'}) | ${n} |`), '');
  md.push('Visual-only fixes (VIS_FIXES in `src/objects.js`: body only; names, texts, family and moves unchanged): ' + Object.entries(X.VIS_FIXES).map(([n, v]) => `${n} → ${v.like ? O[v.like].name : v.t + (v.shape ? ' ' + v.shape : '')}`).join('; ') + '.', '');
  md.push('## Flags', '', `${flags.length} flags: ${sev('high').length} high, ${sev('medium').length} medium, ${sev('low').length} low; **${undecided.length} high flags without a decision** (tests fail if > 0).`, '');
  for (const [rule, fs_] of Object.entries(byRule)) {
    md.push(`### ${rule} (${fs_.length}, ${fs_[0].sev})`, ''); if (REVIEW_GROUPS[rule]) md.push(REVIEW_GROUPS[rule], '');
    md.push('| Key | Detail | Decision |', '|---|---|---|', ...fs_.map(f => `| ${f.key} | ${f.detail.replace(/\|/g, '/')} | ${f.decision || (f.sev === 'high' ? '**UNDECIDED**' : 'review')} |`), '');
  }
  const prev = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/audit/deferred-2026-11.json'), 'utf8')).flags, now = new Map(flags.map(f => [f.rule + ':' + f.key, f]));
  const kept = prev.filter(f => now.has(f.rule + ':' + f.key)), fixedN = prev.length - kept.length;
  md.push('## The 88 flags deferred in the first pass', '', `${fixedN} fixed, ${kept.length} kept (each with its reason). Source list: \`content/audit/deferred-2026-11.json\`.`, '', '| Flag | Was | Now |', '|---|---|---|',
    ...prev.map(f => { const n = now.get(f.rule + ':' + f.key); const o = O[f.key] || null; return `| ${f.rule}: ${f.key} | ${f.detail.replace(/\|/g, '/')} | ${n ? 'kept — ' + (n.decision || 'review') : 'fixed' + (o && o.vis ? ' — ' + (o.vis.like ? 'drawn like ' + O[o.vis.like].name : o.vis.t + (o.vis.shape ? ' ' + o.vis.shape : o.vis.kind ? ' ' + o.vis.kind : o.vis.head ? ' ' + o.vis.head : '')) : X.objectForLabel(f.key) && X.objectForLabel(f.key) !== f.key ? ' — now → ' + X.objectForLabel(f.key) : '')}`; }), '');
  md.push('## How to use', '', '1. After changing aliases, VOCAB_EXTRA, design rules or `tools/gen-labels.js`: `node tools/gen-labels.js && node tools/gen-vocab.js && node tools/audit-mapping.js`.', '2. Read new flags; fix real errors in the SOURCE tables, or record a decision in `KEEP` (tools/audit-mapping.js) with the reason.', '3. Render suspicious groups: `node tools/audit-sheet.js out.png "title" id label=<label> …` and look at them.', '4. `node tests/mapping-audit.js` must pass (no undecided high flags, fixed cases stay fixed, no object id disappears).', '');
  return { md: md.join('\n'), labels: csv(labelRows), objects: csv(objRows) };
}

if (require.main === module) {
  const C = collect(), flags = lint(C), out = render(C, flags);
  const files = { 'docs/review/MAPPING_AUDIT.md': out.md, 'content/audit/mapping-labels.csv': out.labels, 'content/audit/mapping-objects.csv': out.objects };
  if (process.argv.includes('--check')) { const stale = Object.entries(files).filter(([f, t]) => !fs.existsSync(path.join(ROOT, f)) || fs.readFileSync(path.join(ROOT, f), 'utf8') !== t).map(([f]) => f); console.log(stale.length ? 'out of date: ' + stale.join(', ') + ' (run node tools/audit-mapping.js)' : 'ok: mapping audit is up to date'); process.exit(stale.length ? 1 : 0); }
  fs.mkdirSync(path.join(ROOT, 'content/audit'), { recursive: true });
  for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, f), t);
  const sev = s => flags.filter(f => f.sev === s).length;
  console.log(`audit: ${C.routes.length} routes, ${C.objects.length} objects; flags ${sev('high')} high (${flags.filter(f => f.sev === 'high' && !f.decision).length} undecided), ${sev('medium')} medium → docs/review/MAPPING_AUDIT.md`);
}
module.exports = { collect, lint, FIXED, KEEP };
