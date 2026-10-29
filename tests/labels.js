// Checks the recogniser label -> object mapping in src/labels.js (v3: every label resolves to a registry object).
const load = require('./load.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const api = load();
const ctx = { console, Math, JSON }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + '\n;globalThis.T = { LABEL_OBJECTS, OBJECTS, objectTier, CATEGORY };', ctx);
const { LABEL_OBJECTS, OBJECTS, objectTier, CATEGORY } = ctx.T;
let bad = 0; const fail = m => { bad++; console.log('FAIL', m); };
const tiers = {};
for (const src of ['imagenet', 'coco']) for (const [label, id] of Object.entries(LABEL_OBJECTS[src])) {
  if (id === 0) continue;
  const o = OBJECTS[id];
  if (!o) { fail(`${src} "${label}" -> unknown object ${id}`); continue; }
  if (!CATEGORY[o.cat]) fail(`${src} "${label}" -> object ${id} has unknown category ${o.cat}`);
  tiers[objectTier(o)] = (tiers[objectTier(o)] || 0) + 1;
  try { api.buildGrid(api.makeDNA({ cat: o.cat, obj: id, rarity: 'common', seed: 'labels:' + id, photo: null })); } catch (e) { fail(`${id} does not render: ${e.message}`); }
}
// specific identities must survive (the forklift problem)
const expect = { imagenet: { 'forklift': 'forklift', 'tractor': 'tractor', 'steam locomotive': 'steam_locomotive', 'electric locomotive': 'train', 'streetcar, tram, tramcar, trolley, trolley car': 'tram',
    'coffee mug': 'mug', 'teapot': 'teapot', 'banana': 'banana', 'pineapple, ananas': 'pineapple', 'cucumber, cuke': 'cucumber', 'laptop, laptop computer': 'laptop', 'desktop computer': 'desktop_pc',
    'folding chair': 'folding_chair', 'studio couch, day bed': 'sofa', 'golden retriever': 'i_golden_retriever', 'groom, bridegroom': 0, 'assault rifle, assault gun': 0, 'seashore, coast, seacoast, sea-coast': 0 },
  coco: { banana: 'banana', cup: 'mug', person: 0, 'potted plant': 'potted_plant', 'cell phone': 'phone', couch: 'sofa', train: 'train', truck: 'truck', laptop: 'laptop', tv: 'tv' } };
for (const src in expect) for (const [label, want] of Object.entries(expect[src])) {
  const got = LABEL_OBJECTS[src][label];
  if (got === undefined) fail(`${src} label missing: ${label}`); else if (got !== want) fail(`${src} "${label}" -> ${got}, expected ${want}`);
}
if (LABEL_OBJECTS.imagenet['forklift'] === LABEL_OBJECTS.imagenet['electric locomotive']) fail('forklift and train collapse to one object');
console.log(`ImageNet labels: ${Object.keys(LABEL_OBJECTS.imagenet).length}, COCO labels: ${Object.keys(LABEL_OBJECTS.coco).length}; tiers of mapped labels: ${JSON.stringify(tiers)}`);
console.log(bad ? `${bad} problem(s)` : 'ok: every label maps to a real object that renders');
process.exit(bad ? 1 : 0);
