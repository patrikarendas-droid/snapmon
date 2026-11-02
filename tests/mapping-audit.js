// Recognition → identity → visual audit (2026-11): every recogniser label reaches the right object, the routes agree,
// the sea urchin is a sea urchin (identity, approved writing, round spiky body) and the starfish stays a starfish, no
// object id ever disappears, the TinyCLIP label set is unchanged, and saved monsters are never silently relabelled.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape,
  localStorage: { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); } } };
vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'curated.js', 'curated-data.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n') +
  ';globalThis.T={OBJECTS,LABEL_OBJECTS,CAT_DEFAULT_OBJECT,objectForLabel,createMonster,freshState,buildGrid,makeDNA,designOf,identityUpdate,migrate,setRNG:f=>{RNG=f}}', ctx);
const T = ctx.T, A = require('../tools/audit-mapping');
const IN = require('../tools/data/imagenet-classes.json'), CO = require('../tools/data/coco-classes.json'), VOCAB = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/vocab-labels.json'), 'utf8'));
const P02 = require('../content/curated/pilot-02-approved.json').entries;
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'], VAR = [null, 'spectral', 'mutated', 'shiny'];
const seeded = (s = 5) => T.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; });
const filled = g => g.px.filter(v => v).length;

// 1. audit: up to date, no undecided high flag, fixed cases stay fixed, routes agree
{
  const C = A.collect(), flags = A.lint(C);
  let check = ''; try { check = execFileSync('node', [path.join(ROOT, 'tools/audit-mapping.js'), '--check'], { encoding: 'utf8' }); } catch (e) { check = String(e.stdout || e.message); }
  ok(/up to date/.test(check), 'docs/review/MAPPING_AUDIT.md and content/audit/*.csv are up to date (node tools/audit-mapping.js)');
  const und = flags.filter(f => f.sev === 'high' && !f.decision);
  ok(!und.length, `every high-severity audit flag has a recorded decision${und.length ? ': ' + und.slice(0, 5).map(f => f.rule + ':' + f.key).join(', ') : ''}`);
  ok(!flags.some(f => f.rule === 'regression'), `all ${A.FIXED.length} fixed label → object cases still resolve as fixed`);
  ok(!flags.some(f => f.rule === 'route-disagreement' || f.rule === 'missing-object' || f.rule === 'curated-unreachable'), 'no route disagreement, no missing object, every curated object is reachable from a recogniser');
}
// 2. no object id disappears (saved monsters reference them); the two audit objects exist
{
  const frozen = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/registry-ids-v0.4.8.json'), 'utf8')).ids;
  const missing = frozen.filter(id => !T.OBJECTS[id]);
  const added = ['i_cardigan', 'i_plane', 'piggy_bank', 'whale', 'dolphin', 'wombat', 'binoculars'];
  ok(!missing.length && added.every(id => T.OBJECTS[id]) && Object.keys(T.OBJECTS).length === frozen.length + added.length, `all ${frozen.length} v0.4.8 object ids still exist, plus exactly ${added.join(', ')}${missing.length ? ': missing ' + missing.slice(0, 5) : ''}`);
}
// 3. every recogniser table agrees with objectForLabel; TinyCLIP labels and order are those of v0.4.8
{
  const imBad = IN.filter(c => typeof T.LABEL_OBJECTS.imagenet[c] === 'string' && T.objectForLabel(c) !== T.LABEL_OBJECTS.imagenet[c]);
  ok(!imBad.length, `ImageNet: all ${IN.filter(c => T.LABEL_OBJECTS.imagenet[c]).length} mapped classes resolve the same through objectForLabel and the generated table`);
  const vBad = VOCAB.filter(v => v.o && T.objectForLabel(v.l) !== v.o);
  ok(!vBad.length, `TinyCLIP: all ${VOCAB.filter(v => v.o).length} object labels resolve the same through objectForLabel${vBad.length ? ': ' + vBad.slice(0, 3).map(v => v.l) : ''}`);
  ok(crypto.createHash('sha256').update(JSON.stringify(VOCAB.map(v => v.l))).digest('hex') === 'e55394536e69bff6585287855398224122e57e5dbac01534003e4b2e5e409f8e', 'TinyCLIP label strings and order identical to v0.4.8 (text embeddings unchanged; only label → object assignments differ)');
  const clip = new Map(VOCAB.map(v => [v.l, v.o])), diff = [];
  for (const c of IN) { const t = T.LABEL_OBJECTS.imagenet[c], f = c.split(',')[0].trim().toLowerCase(); if (t && clip.has(f) && clip.get(f) !== t) diff.push(c); }
  for (const c of CO) { const t = T.LABEL_OBJECTS.coco[c]; if (t && clip.has(c) && clip.get(c) !== t) diff.push(c); }
  ok(JSON.stringify(diff.sort()) === JSON.stringify(['Cardigan, Cardigan Welsh corgi', 'plane, carpenter\'s plane, woodworking plane', 'pot, flowerpot', 'walking stick, walkingstick, stick insect']),
    `Hybrid production (ImageNet/COCO) and TinyCLIP agree on every shared label except the 4 deliberate class overrides (the class means something else than the bare word)${diff.length !== 4 ? ': ' + diff : ''}`);
}
// 4. every mapped recogniser label produces a complete monster (name, text, keyed moves, a drawn sprite)
{
  const labels = [...new Set([...IN.filter(c => T.LABEL_OBJECTS.imagenet[c]).map(c => T.LABEL_OBJECTS.imagenet[c]), ...CO.map(c => T.LABEL_OBJECTS.coco[c]).filter(Boolean), ...VOCAB.filter(v => v.o).map(v => v.o)])];
  const badM = [];
  labels.forEach((id, i) => { const r = RAR[i % 5], v = VAR[i % 4]; seeded(i + 1); const m = T.createMonster(T.freshState(), { obj: id, rarity: r, variant: v, word: id });
    if (!m.name || !m.lore || m.lore.length < 10 || m.abilities.length < 1 || !m.abilities.every(a => a.key && a.name) || filled(T.buildGrid(m.dna)) < 60) badM.push(id); });
  ok(!badM.length, `${labels.length} recognisable objects (rotating rarity and normal/Spectral/Mutated/Shiny): name, flavour text, keyed moves and a drawn sprite${badM.length ? ': ' + badM.slice(0, 5) : ''}`);
}
// 5. the reported bug: sea urchin vs starfish, end to end, every rarity and variant
{
  const e = P02.x_sea_urchin_shell, starGrid = (r, v) => { seeded(3); return T.buildGrid(T.createMonster(T.freshState(), { obj: 'starfish', rarity: r, variant: v }).dna).px.join(); };
  const bad5 = [];
  for (const label of ['sea urchin', 'sea urchin shell']) for (const r of RAR) for (const v of VAR) {
    const id = T.objectForLabel(label); seeded(3); const m = T.createMonster(T.freshState(), { obj: id, rarity: r, variant: v, word: label });
    const g = T.buildGrid(m.dna).px.join();
    if (id !== 'x_sea_urchin_shell' || m.species !== 'o:x_sea_urchin_shell' || m.name !== e.names[r] || m.lore !== e.lore[r] || /star/i.test(m.name + m.lore) || m.dna.shape !== 'obj' || g === starGrid(r, v) ||
      !m.abilities.every(a => !e.moves[a.key] || a.name === e.moves[a.key])) bad5.push(`${label}/${r}/${v}`);
  }
  ok(!bad5.length, `"sea urchin" and "sea urchin shell" (ImageNet + TinyCLIP) → Sea urchin shell with its approved names, texts and move names, never starfish text, an urchin sprite unlike the starfish — 5 rarities × 4 variants${bad5.length ? ': ' + bad5.slice(0, 3) : ''}`);
  ok(T.LABEL_OBJECTS.imagenet['sea urchin'] === 'x_sea_urchin_shell' && VOCAB.find(v => v.l === 'sea urchin').o === 'x_sea_urchin_shell' && VOCAB.find(v => v.l === 'sea urchin shell').o === 'x_sea_urchin_shell', 'both recognisers map "sea urchin" to the sea urchin (ImageNet table, TinyCLIP vocabulary)');
  const star = ['starfish, sea star', 'starfish', 'sea star'].map(l => T.objectForLabel(l));
  seeded(3); const sm = T.createMonster(T.freshState(), { obj: 'starfish', rarity: 'rare' });
  ok(star.every(x => x === 'starfish') && sm.dna.shape === 'fish' && sm.dna.sub === 'star' && !/urchin/i.test(sm.name + sm.lore), 'starfish / sea star stay the Starfish (star sprite, starfish name and text)');
  // the urchin body is round and spiky: a near-square silhouette with spines all round (not a horizontal fish)
  seeded(9); const ug = T.buildGrid(T.createMonster(T.freshState(), { obj: 'x_sea_urchin_shell', rarity: 'common' }).dna);
  const W = 40, pts = Array.from(ug.px).map((v, i) => v ? [i % W, Math.floor(i / W)] : null).filter(Boolean), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
  ok(w / h > 0.8 && w / h < 1.25 && w >= 24, `urchin silhouette is round (bounding box ${w}×${h})`);
}
// 5b. design rules match whole words: a weasel is not an easel, a motherboard not an oar (round 2)
{
  const want = { x_weasel: o => o.lore !== 'art' && !(o.vis && o.vis.kind === 'easel'), x_motherboard: o => o.vis && o.vis.kind === 'chip', x_chess_board: o => o.vis && o.vis.like === 'puzzle',
    x_headboard: o => o.vis && o.vis.like === 'bed', x_vinyl_record: o => o.vis && o.vis.kind === 'disc', x_windbreaker: o => o.lore !== 'electric', x_champagne_flute: o => o.vis && o.vis.like === 'glass',
    x_honeycomb: o => o.lore !== 'gadget', x_combine_harvester: o => o.lore !== 'gadget', x_gingerbread_man: o => o.lore !== 'veg', i_bobsled: o => !!o.rule, i_dogsled: o => !!o.rule };
  const badR = Object.entries(want).filter(([id, f]) => !f(T.OBJECTS[id])).map(([id]) => id);
  ok(!badR.length, `design rules match whole words only (weasel ≠ easel, motherboard ≠ oar, honeycomb ≠ comb …; sleds still sleds)${badR.length ? ': ' + badR : ''}`);
  const ids = { whale: 'whale', dolphin: 'dolphin', wombat: 'wombat', 'piggy bank': 'piggy_bank', binoculars: 'binoculars' }, badI = [];
  for (const [l, id] of Object.entries(ids)) { seeded(2); const m = T.createMonster(T.freshState(), { obj: T.objectForLabel(l), rarity: 'rare', word: l });
    if (m.obj !== id || /shark|bear|pig\b|glasses|specs/i.test(m.name + ' ' + m.lore)) badI.push(l + ' → ' + m.obj + ' "' + m.name + '"'); }
  ok(!badI.length, `whale, dolphin, wombat, piggy bank and binoculars are their own objects with their own names and texts (no Shark/Bear/Pig/Glasses text)${badI.length ? ': ' + badI.join('; ') : ''}`);
}
// 6. saved monsters: never silently relabelled; old urchins keep their stored look and may opt in
{
  seeded(4); const oldStar = { ...T.createMonster(T.freshState(), { obj: 'starfish', rarity: 'rare', word: 'sea urchin' }), id: 'm1', label: 'sea urchin' };
  seeded(4); const oldUrchin = { ...T.createMonster(T.freshState(), { obj: 'x_sea_urchin_shell', rarity: 'epic' }), id: 'm2' }; oldUrchin.dna = { ...oldUrchin.dna, shape: 'fish', sub: null };
  const S = T.freshState(); S.monsters = [JSON.parse(JSON.stringify(oldStar)), JSON.parse(JSON.stringify(oldUrchin))];
  const M = T.migrate(JSON.parse(JSON.stringify(S)));
  ok(M.monsters[0].obj === 'starfish' && M.monsters[0].species === 'o:starfish' && JSON.stringify(M.monsters[0].dna) === JSON.stringify(oldStar.dna), 'a Starfish caught from a "sea urchin" photo before this fix stays a Starfish on load (no automatic relabel; see the audit report)');
  ok(JSON.stringify(M.monsters[1].dna) === JSON.stringify(oldUrchin.dna), 'a sea urchin saved with the old fish body keeps it on load');
  const up = T.identityUpdate(M.monsters[1]);
  ok(up && up.design && up.design.shape === 'obj', 'and "Update its look" offers it the new urchin body (player choice)');
}

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL MAPPING-AUDIT CHECKS PASSED');
process.exit(bad ? 1 : 0);
