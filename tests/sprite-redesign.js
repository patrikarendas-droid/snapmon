// v0.6.0 sprite redesign (the 672 objects the owner flagged "Sprite needs fix" in the catalogue's Sprite review).
//  1. Every listed object has its own design (dedicated tier, design revision 2) that renders in every rarity × variant,
//     stays inside the 40×40 grid and differs from the previous design.
//  2. Monsters saved BEFORE the redesign (v0.5.5 DNA, recorded in the fixture with the v0.5.5 code) render
//     pixel-identically: the old design is kept (visPrev) for them.
//  3. Every object that was NOT redesigned renders exactly as in v0.5.5, including objects that borrow (LIKE) a
//     redesigned object's design.
//  4. "Update its look" offers the new body to a saved monster; undo restores the old one. Stats and moves never change.
//   node tests/sprite-redesign.js                      check
//   node tests/sprite-redesign.js write <v0.5.5 src>   record the v0.5.5 fixture (run once, with the OLD sources)
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const FIX = path.join(__dirname, 'fixtures/sprite-redesign-v055.json');
const FILES = ['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js'];
const load = dir => { const ctx = { console, Math, JSON, Date }; vm.createContext(ctx);
  vm.runInContext(FILES.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + ';globalThis.T={makeDNA,buildGrid,buildPalette,OBJECTS,OBJECT_LIST,objectTier,designOf,visualSource,REDESIGN:typeof REDESIGN!=="undefined"?REDESIGN:null}', ctx); return ctx.T; };
const dnaHash = dna => crypto.createHash('sha1').update(JSON.stringify(dna)).digest('base64').slice(0, 16);
const hash = (T, dna) => crypto.createHash('sha1').update(Buffer.from(T.buildGrid(dna).px)).update(JSON.stringify(T.buildPalette(dna))).digest('base64').slice(0, 16);
const seedOf = (id, r) => { let h = 2166136261; for (const c of id + r) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const RAR = ['common', 'legendary'];
if (process.argv[2] === 'write') {
  const T = load(process.argv[3]), redo = new Set(load(path.join(__dirname, '../src')).REDESIGN ? Object.keys(load(path.join(__dirname, '../src')).REDESIGN) : []);
  const out = { note: 'v0.5.5 renders of every object, recorded with the v0.5.5 sources: full DNA for the redesigned objects (a saved monster), DNA hash otherwise', objects: {} };
  for (const o of T.OBJECT_LIST) for (const r of RAR) { const dna = T.makeDNA({ cat: o.cat, obj: o.id, rarity: r, seed: seedOf(o.id, r), photo: null, variant: r === 'legendary' ? 'spectral' : null });
    (out.objects[o.id] = out.objects[o.id] || {})[r] = redo.has(o.id) ? { dna, h: hash(T, dna) } : { dh: dnaHash(dna), h: hash(T, dna) }; }
  fs.writeFileSync(FIX, JSON.stringify(out)); console.log('wrote', FIX, Object.keys(out.objects).length, 'objects'); process.exit(0);
}
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const T = load(path.join(__dirname, '../src')), want = JSON.parse(fs.readFileSync(FIX, 'utf8')).objects;
const ids = Object.keys(T.REDESIGN || {}), red = new Set(ids);
ok(ids.length === 672 && ids.every(id => T.OBJECTS[id] && T.OBJECTS[id].visRev === 2 && T.objectTier(T.OBJECTS[id]) === 'dedicated'), `${ids.length} objects redesigned, each with its own (dedicated) design`);
// 1. new designs render everywhere and differ from the old body
{ const errs = [], same = [], edge = [];
  for (const id of ids) { const o = T.OBJECTS[id];
    for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary']) for (const v of [null, 'spectral', 'mutated', 'shiny']) {
      try { const dna = T.makeDNA({ cat: o.cat, obj: id, rarity: r, seed: seedOf(id, r + v), photo: null, variant: v }); const g = T.buildGrid(dna);
        if (dna.shape !== 'obj2') errs.push(id + ' shape ' + dna.shape);
        const filled = g.px.reduce((n, c) => n + (c ? 1 : 0), 0); if (filled < 60) edge.push(id + ' ' + r + ' ' + v + ' (' + filled + ' px)');
      } catch (e) { errs.push(id + ': ' + e.message); } }
    const nd = T.makeDNA({ cat: o.cat, obj: id, rarity: 'common', seed: 1, photo: null, variant: null }), od = { ...nd, shape: want[id].common.dna.shape, sub: want[id].common.dna.sub };
    if (hash(T, nd) === hash(T, od)) same.push(id); }
  ok(!errs.length, `every redesigned object renders in 5 rarities × 4 variants with the new body (${ids.length * 20} sprites)${errs.length ? ': ' + errs.slice(0, 5) : ''}`);
  ok(!edge.length, `no new sprite is empty or nearly empty${edge.length ? ': ' + edge.slice(0, 5) : ''}`);
  ok(!same.length, `every new design differs from the object's previous body${same.length ? ': ' + same.slice(0, 5) : ''}`); }
// 2. + 3. saved monsters and every other object render exactly as in v0.5.5
{ const changedSaved = [], changedOther = []; let nSaved = 0, nOther = 0;
  for (const [id, byR] of Object.entries(want)) for (const r of RAR) { const { dna, dh, h } = byR[r];
    if (red.has(id)) { nSaved++; if (hash(T, dna) !== h) changedSaved.push(id + '/' + r); continue; }
    nOther++; const o = T.OBJECTS[id], nd = T.makeDNA({ cat: o.cat, obj: id, rarity: r, seed: seedOf(id, r), photo: null, variant: r === 'legendary' ? 'spectral' : null });
    if (dnaHash(nd) !== dh) changedOther.push(id + '/' + r + ' (DNA)'); else if (hash(T, nd) !== h) changedOther.push(id + '/' + r + ' (pixels)'); }
  ok(!changedSaved.length, `${nSaved} monsters saved with the v0.5.5 design of a redesigned object render pixel-identically${changedSaved.length ? ': ' + changedSaved.slice(0, 5) : ''}`);
  ok(!changedOther.length, `${nOther} monsters of the ${Object.keys(want).length - ids.length} objects NOT redesigned: same DNA and same pixels as v0.5.5${changedOther.length ? ': ' + changedOther.slice(0, 5) : ''}`);
  const borrowers = T.OBJECT_LIST.filter(o => !red.has(o.id) && o.vis && o.vis.like && red.has(o.vis.like)).map(o => o.id);
  ok(borrowers.length >= 1 && borrowers.every(id => !changedOther.some(x => x.startsWith(id + '/'))), `${borrowers.length} objects that borrow a redesigned object's design keep the old borrowed look (${borrowers.slice(0, 4).join(', ')}…)`); }
// 4. "Update its look" on a saved monster (game code)
{ const G = require('./load')(); const id = 'x_catfish', S = G.freshState(); S.level = 8;
  const m = G.createMonster(S, { obj: id, rarity: 'rare' }); const statsBefore = JSON.stringify([m.stats, m.abilities.map(a => [a.key, a.power, a.effect, a.chance])]);
  m.dna.shape = want[id].common.dna.shape; m.dna.sub = want[id].common.dna.sub || null; // as saved by v0.5.5
  const ch = G.identityUpdate(m); ok(ch && ch.design && ch.design.shape === 'obj2', `a catfish caught in v0.5.5 (body "${want[id].common.dna.shape}") is offered the new design via "Update its look"`);
  G.applyIdentityUpdate(S, m); const after = m.dna.shape; G.undoIdentityUpdate(m);
  ok(after === 'obj2' && m.dna.shape === want[id].common.dna.shape && JSON.stringify([m.stats, m.abilities.map(a => [a.key, a.power, a.effect, a.chance])]) === statsBefore, 'update applies the new body, undo restores the old one; stats and moves never change'); }
console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL SPRITE-REDESIGN CHECKS PASSED'); process.exit(bad ? 1 : 0);
