// Unit tests for the experimental lens decision logic (ClipLens.judge / ClipLens.fuse): rejection, margins,
// calibration and the hybrid fusion rules. No model needed: the label table and scores are synthetic.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, JSON, Map, window: {}, location: { href: 'http://x/' } }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lens-clip.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + '\n;globalThis.T = { ClipLens, OBJECTS };', ctx);
const { ClipLens, OBJECTS } = ctx.T;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const labels = [{ l: 'forklift', o: 'forklift' }, { l: 'fork lift truck', o: 'forklift' }, { l: 'train', o: 'train' }, { l: 'tractor', o: 'tractor' }, { l: 'truck', o: 'truck' },
  { l: 'office chair', o: 'office_chair' }, { l: 'sofa', o: 'sofa' }, { l: 'mug', o: 'mug' }, { l: 'teapot', o: 'teapot' }, { l: 'a wall', o: null }, { l: 'grass', o: null }];
const idx = l => labels.findIndex(x => x.l === l);
const top = pairs => pairs.map(([l, p]) => ({ i: idx(l), p, cos: 0.3 }));
const setMeta = calib => { ClipLens.status.meta = { labels, calib }; };
setMeta(null);

let j = ClipLens.judge(top([['forklift', 0.4], ['fork lift truck', 0.2], ['train', 0.1], ['truck', 0.05]]));
ok(j.best.obj === 'forklift' && Math.abs(j.best.p - 0.6) < 1e-9 && j.accepted, 'synonym labels aggregate per object (forklift 0.6) and are accepted');
j = ClipLens.judge(top([['forklift', 0.4], ['train', 0.36], ['tractor', 0.1]]));
ok(!j.accepted && j.why === 'ambiguous', 'close scores are rejected as ambiguous (no forced guess between forklift and train)');
j = ClipLens.judge(top([['a wall', 0.5], ['grass', 0.2], ['mug', 0.1]]));
ok(!j.accepted && j.best.obj === null, 'background concepts win -> rejected (unknown object)');
j = ClipLens.judge(top([['mug', 0.2], ['teapot', 0.05]]));
ok(!j.accepted && j.why === 'low score', 'low score is rejected');
ok(j.calibrated === null, 'no calibration table -> no invented probability');

setMeta({ accept: { p: 0.3, margin: 0.1 }, reliability: [{ lo: 0, hi: 0.5, n: 40, acc: 0.42 }, { lo: 0.5, hi: 0.8, n: 30, acc: 0.81 }, { lo: 0.8, hi: 1.01, n: 3, acc: 1 }] });
j = ClipLens.judge(top([['mug', 0.6], ['teapot', 0.1]]));
ok(j.accepted && j.calibrated === 0.81, 'calibrated confidence read from the benchmark reliability table');
j = ClipLens.judge(top([['mug', 0.9], ['teapot', 0.05]]));
ok(j.calibrated === null, 'bins with too few benchmark samples give no calibrated value');

// fusion
const prod = (cands, boxes = []) => ({ candidates: cands, boxes });
const region = (best, accepted, calibrated, box = null) => ({ box, cls: 'whole photo', best: { obj: best, label: best, p: 0.6 }, accepted, calibrated, ranked: [], margin: 0.3 });
let f = ClipLens.fuse(prod([{ label: 'trailer truck', obj: 'truck', cat: 'car', conf: 0.5, box: null }]), { regions: [region('forklift', true, null)] });
ok(f[0].obj === 'forklift' && f[0].rule === 2, 'rule 2: production says truck, CLIP accepts forklift in the same category -> forklift');
f = ClipLens.fuse(prod([{ label: 'mug', obj: 'mug', cat: 'mug', conf: 0.7, box: null }]), { regions: [region('mug', true, 0.81)] });
ok(f[0].obj === 'mug' && f[0].rule === 1 && f[0].conf === 0.81, 'rule 1: both agree -> kept with the higher confidence');
f = ClipLens.fuse(prod([]), { regions: [region('sofa', true, 0.85)] });
ok(f[0] && f[0].obj === 'sofa' && f[0].rule === 3, 'rule 3: production found nothing, CLIP well-calibrated -> CLIP result');
setMeta(null);
f = ClipLens.fuse(prod([]), { regions: [region('sofa', true, null)] });
ok(f.length === 0, 'uncalibrated CLIP alone never creates a result (stays unknown)');
setMeta({ accept: { p: 0.35, margin: 0.15 }, heldOut: { accepted: 29, precision: 0.76 } });
f = ClipLens.fuse(prod([{ label: 'van', obj: 'van', cat: 'car', conf: 0.6, box: null }]), { regions: [region('sofa', true, null)] });
ok(f[0].obj === 'sofa' && f[0].rule === 3, 'rule 3 via held-out precision: a trusted CLIP answer overrides a disagreeing production answer');
setMeta({ accept: { p: 0.35, margin: 0.15 }, heldOut: { accepted: 4, precision: 1 } });
f = ClipLens.fuse(prod([{ label: 'van', obj: 'van', cat: 'car', conf: 0.6, box: null }]), { regions: [region('sofa', true, null)] });
ok(f[0].obj === 'van', 'held-out precision from too few photos is not trusted');
setMeta(null);
setMeta(null);
f = ClipLens.fuse(prod([{ label: 'banana', obj: 'banana', cat: 'banana', conf: 0.6, box: null }]), { regions: [region('train', true, 0.5)] });
ok(f[0].obj === 'banana' && f[0].rule === 4, 'rule 4: weak CLIP disagreement in another category -> production kept');
f = ClipLens.fuse(prod([{ label: 'cup', obj: 'mug', cat: 'mug', conf: 0.6, box: [0.1, 0.1, 0.3, 0.3] }, { label: 'chair', obj: 'dining_chair', cat: 'chair', conf: 0.55, box: [0.5, 0.4, 0.4, 0.5] }]),
  { regions: [region('mug', false, null), region('teapot', true, null, [0.1, 0.1, 0.3, 0.3]), region('office_chair', true, null, [0.5, 0.4, 0.4, 0.5])] });
ok(f.some(c => c.obj === 'teapot') && f.some(c => c.obj === 'office_chair'), 'per-box refinement: mug→teapot and dining chair→office chair stay separate choices');
f = ClipLens.fuse(prod([{ label: 'bowl', obj: 'bowl', cat: 'pot', conf: 0.733, box: null }, { label: 'ashcan', obj: 'trash_can', cat: 'trash', conf: 0.296, box: null }]), { regions: [region('ice_cream', false, null)] });
ok(f.map(c => c.obj).join() === 'bowl,trash_can', "fusion keeps production's runner-up (trash can) as a choice");
// hybrid decision, rule 5 (replays cases from the first phone field test)
const L = { MIN_CONF: 0.25, AUTO_CONF: 0.55, CLEAR_MARGIN: 0.7, MAX_CHOICES: 4 };
const whole = (obj, p, accepted = false) => ({ regions: [{ box: null, cls: 'whole photo', best: { obj, label: obj, p }, accepted, calibrated: null, ranked: [], margin: 0.1 }] });
setMeta({ accept: { p: 0.35, margin: 0.15 }, heldOut: { accepted: 28, precision: 0.75 } });
let h = ClipLens.hybridDecision({ reason: 'confident', candidates: [{ label: 'coffeepot', obj: 'teapot', cat: 'mug', conf: 0.99, box: null }] }, whole('kettle', 0.267), L);
ok(h.decision === 'choose' && h.reason === 'disagree' && h.candidates.map(c => c.obj).join() === 'teapot,kettle', 'rule 5: production says coffeepot, CLIP says kettle -> the player chooses between them');
h = ClipLens.hybridDecision({ reason: 'confident', candidates: [{ label: 'forklift', obj: 'forklift', cat: 'car', conf: 0.975, box: null }] }, whole('forklift', 0.444, true), L);
ok(h.decision === 'auto' && h.candidates[0].obj === 'forklift', 'both lenses agree on the forklift -> identified automatically');
h = ClipLens.hybridDecision({ reason: 'confident', candidates: [{ label: 'suitcase', obj: 'suitcase', cat: 'bag', conf: 0.971, box: null }] }, whole('toolbox', 0.064), L);
ok(h.decision === 'auto' && h.candidates[0].obj === 'suitcase', 'rule 5 ignores a CLIP guess with too little support (0.064)');
h = ClipLens.hybridDecision({ reason: 'person', candidates: [] }, whole(null, 0.22), L);
ok(h.decision === 'unknown' && h.reason === 'person', 'a hand (background concept) stays unknown');
h = ClipLens.hybridDecision({ reason: 'confident', candidates: ['mug', 'glass', 'bowl', 'vase'].map((o, i) => ({ label: o, obj: o, cat: OBJECTS[o].cat, conf: [0.9, 0.3, 0.28, 0.26][i], box: null })) }, whole('teapot', 0.2), L);
ok(h.candidates.length === 4 && h.candidates[3].obj === 'teapot' && h.reason === 'disagree', 'rule 5 keeps the list at four choices, replacing the weakest');
setMeta(null);
console.log(bad ? `${bad} problem(s)` : 'ok: experimental lens decision rules behave as documented');
process.exit(bad ? 1 : 0);
