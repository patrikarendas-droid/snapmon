// v3 sprite engine checks: every registry design renders, similar objects have distinguishable silhouettes,
// individuals of one object vary but keep the object's silhouette, and rendering stays fast.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, JSON, Date }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + '\n;globalThis.T = { OBJECT_LIST, OBJECTS, makeDNA, buildGrid, objectTier, objectCounts, hashStr, CATEGORY };', ctx);
const { OBJECT_LIST, OBJECTS, makeDNA, buildGrid, objectTier, objectCounts, hashStr } = ctx.T;
let bad = 0; const fail = m => { bad++; console.log('FAIL', m); };
const mask = (id, seed = 1, rarity = 'common') => { const o = OBJECTS[id]; const d = makeDNA({ obj: id, cat: o.cat, rarity, seed: hashStr(id + seed), photo: null }); const g = buildGrid(d); return { m: Array.from(g.px, v => v ? 1 : 0), px: Array.from(g.px), d }; };
// structural agreement: share of occupied pixels that hold the same palette role (outline, body, window, metal…)
const struct = (a, b) => { let same = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] || b[k]) { u++; if (a[k] === b[k]) same++; } } return same / u; };
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] || b[k]) u++; if (a[k] && b[k]) i++; } return i / u; };
// 1) all objects render, all tiers counted
let t0 = Date.now(), n = 0;
for (const o of OBJECT_LIST) for (const r of ['common', 'legendary']) { try { mask(o.id, 3, r); n++; } catch (e) { fail(`${o.id} ${r}: ${e.message}`); } }
const ms = (Date.now() - t0) / n;
console.log(`rendered ${n} sprites, ${ms.toFixed(2)} ms each; tiers ${JSON.stringify(objectCounts())}`);
if (ms > 5) fail('sprite rendering slower than 5 ms');
// 2) similar objects must not share a silhouette
const groups = [['forklift', 'train', 'tractor', 'excavator', 'truck', 'bulldozer', 'crane', 'bus'], ['office_chair', 'dining_chair', 'sofa', 'armchair', 'stool'], ['mug', 'teapot', 'glass', 'kettle'],
  ['laptop', 'desktop_pc', 'tv', 'monitor'], ['banana', 'pineapple', 'cucumber'], ['microwave', 'oven', 'washing_machine', 'fridge'], ['guitar', 'violin', 'harp']];
for (const grp of groups) for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) {
  const A = mask(grp[i]), B = mask(grp[j]), v = struct(A.px, B.px);
  if (v > 0.7) fail(`${grp[i]} vs ${grp[j]} look too similar (structure ${v.toFixed(2)}, outline IoU ${iou(A.m, B.m).toFixed(2)})`);
}
console.log('similar objects structurally distinct');
// 3) variation within one object: different DNA, recognisable silhouette, legendary keeps the shape
for (const id of ['forklift', 'office_chair', 'teapot', 'pineapple', 'excavator', 'microwave']) {
  const a = mask(id, 1), b = mask(id, 2), L = mask(id, 7, 'legendary');
  if (JSON.stringify(a.d) === JSON.stringify(b.d)) fail(`${id}: two individuals have identical DNA`);
  const same = iou(a.m, b.m), leg = iou(a.m, L.m);
  if (same < 0.6) fail(`${id}: individuals lose the silhouette (IoU ${same.toFixed(2)})`);
  if (leg < 0.55) fail(`${id}: legendary hides the silhouette (IoU ${leg.toFixed(2)})`);
}
console.log('within-object variation keeps silhouettes');
// 4) forklift and train are different objects with different designs
if (objectTier(OBJECTS.forklift) !== 'dedicated' || objectTier(OBJECTS.train) !== 'dedicated') fail('forklift/train should have dedicated designs');
console.log(bad ? `${bad} problem(s)` : 'ok: v3 sprite checks passed');
process.exit(bad ? 1 : 0);
