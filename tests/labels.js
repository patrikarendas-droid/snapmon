// Checks the recogniser label -> monster mapping in src/labels.js.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, JSON }; vm.createContext(ctx);
vm.runInContext(['data.js', 'labels.js', 'sprites.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + '\n;globalThis.T = { LABEL_MAP, CATEGORY, SHAPES };', ctx);
const { LABEL_MAP, CATEGORY, SHAPES } = ctx.T;
let bad = 0; const fail = m => { bad++; console.log('FAIL', m); };
const DEFAULT_SUB = { mug: 'mug', bottle: 'bottle', chair: 'chair', tv: 'tv', shoe: 'sneaker', cloth: 'shirt', plant: 'potted', fruit: 'apple', car: 'car', food: 'burger', animal: 'cat', bird: 'perch', fish: 'fish', bug: 'beetle', reptile: 'lizard', instrument: 'guitar', ball: 'plain', pot: 'pot', cake: 'cake' };
const stats = { imagenet: {}, coco: {} };
for (const src of ['imagenet', 'coco']) for (const [label, code] of Object.entries(LABEL_MAP[src])) {
  if (code === 0) { stats[src].excluded = (stats[src].excluded || 0) + 1; continue; }
  const [cat, sub] = code.split(':');
  if (!CATEGORY[cat]) fail(`${src} "${label}" -> unknown category ${cat}`);
  const shape = CATEGORY[cat] && CATEGORY[cat].shape;
  if (sub && sub !== DEFAULT_SUB[cat] && !SHAPES[shape + '_' + sub]) fail(`${src} "${label}" -> sub-type ${cat}:${sub} has no sprite`);
  stats[src][cat] = (stats[src][cat] || 0) + 1;
}
const expect = { imagenet: { 'banana': 'banana', 'folding chair': 'chair:chair', 'toilet seat': 'toilet', 'coffee mug': 'mug:mug', 'strawberry': 'fruit:strawberry', 'golden retriever': 'animal:dog', 'tabby, tabby cat': 'animal:cat', 'laptop, laptop computer': 'laptop', 'studio couch, day bed': 'sofa', 'pot, flowerpot': 'plant:potted', 'umbrella': 'umbrella', 'acoustic guitar': 'instrument:guitar', 'soccer ball': 'ball:soccer', 'pizza, pizza pie': 'food:pizza', 'goldfish, Carassius auratus': 'fish:fish', 'ladybug, ladybeetle, lady beetle, ladybird, ladybird beetle': 'bug:beetle', 'school bus': 'car:bus', 'groom, bridegroom': 0, 'seashore, coast, seacoast, sea-coast': 0 },
  coco: { banana: 'banana', chair: 'chair:chair', toilet: 'toilet', cup: 'mug:mug', person: 0, 'potted plant': 'plant:potted', 'cell phone': 'phone', couch: 'sofa' } };
for (const src in expect) for (const [label, want] of Object.entries(expect[src])) {
  const got = LABEL_MAP[src][label];
  if (got === undefined) fail(`${src} label missing: ${label}`); else if (got !== want) fail(`${src} "${label}" -> ${got}, expected ${want}`);
}
const n = Object.keys(LABEL_MAP.imagenet).length;
console.log(`ImageNet labels: ${n}, COCO labels: ${Object.keys(LABEL_MAP.coco).length}`);
console.log('ImageNet per category:', JSON.stringify(stats.imagenet));
console.log(bad ? `${bad} problem(s)` : 'ok: every label maps to a real category and a drawable sprite');
process.exit(bad ? 1 : 0);
