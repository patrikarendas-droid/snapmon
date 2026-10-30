// Object identity must carry through the whole pipeline: recogniser label -> registry object -> design -> name ->
// signature move -> flavour text -> saved monster. Reproduces the v0.4.2 "Switchette"/"Cameradrake" bug (a light switch
// and a security camera drawn as toolboxes, with toolbox lore) and guards against similar wrong mappings.
// Automated checks cannot prove that a sprite LOOKS like its object: tools/contact-sheet.js renders them for review.
const G = require('./load')();
const fs = require('fs'), vm = require('vm'), path = require('path');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') +
  ';globalThis.T={LORE_OBJECT,OBJECTS,OBJECT_LIST,objectForLabel,objectTier,visualSource,designOf,makeDNA,buildGrid,CATEGORY,LORE_KITS,LORE_GROUP_KITS,loreKitFor,monsterLore,createMonster,freshState,identityUpdate,applyIdentityUpdate,undoIdentityUpdate,exportSave,importSave,DESIGN_RULES,CAT_FALLBACK_VIS,setRNG:f=>{RNG=f}}', ctx);
const T = ctx.T;
let seed = 7; T.setRNG(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
const grid = dna => T.buildGrid(dna).px.join('');
const toolboxGrid = grid(T.makeDNA({ obj: 'toolbox', cat: 'tool', rarity: 'common', seed: 1 }));

// the two reported cases, end to end
for (const [label, id, tpl, lore, sig, word] of [['light switch', 'x_light_switch', 'wallplate', 'electric', 'Lights Out', 'Switch'], ['security camera', 'x_security_camera', 'cctv', 'camera', 'Surveillance Glare', 'Camera']]) {
  const o = T.OBJECTS[T.objectForLabel(label)];
  ok(o && o.id === id, `"${label}" resolves to ${id}`);
  ok(T.visualSource(o).vis.t === tpl && T.objectTier(o) === 'composed', `${label}: drawn with the ${tpl} design (not the category's toolbox)`);
  const S = T.freshState(); S.level = 6;
  const monsters = ['common', 'rare', 'legendary'].map((r, i) => T.createMonster(S, { obj: id, rarity: r, word: label, photo: { hue: 0, sat: 0, lit: 0.8 } }));
  ok(monsters.every(m => m.dna.shape === 'obj' && grid(m.dna) !== toolboxGrid), `${label}: new monsters get the object's body`);
  ok(monsters.every(m => m.name.includes(word)), `${label}: names refer to the object (${monsters.map(m => m.name).join(', ')})`);
  const toolSig = T.CATEGORY.tool.sig;
  ok(monsters.every(m => m.abilities[0].name === sig && m.abilities[0].power === toolSig.power && m.abilities[0].hits === toolSig.hits), `${label}: signature move "${sig}" (same numbers as before: combat balance unchanged)`);
  ok(T.loreKitFor(o, o.cat) === T.LORE_GROUP_KITS[lore], `${label}: flavour text comes from the ${lore} kit`);
  const toolPhrases = Object.values(T.LORE_KITS.tool).flat().map(s => s.toLowerCase());
  const texts = []; for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary']) for (let s = 1; s < 40; s++) texts.push(T.monsterLore({ obj: id, rarity: r, seed: s * 7919 }));
  ok(texts.every(t => !toolPhrases.some(ph => t.toLowerCase().includes(ph)) && !/nail gun|toolbox/i.test(t)), `${label}: none of ${texts.length} flavour texts uses toolbox phrases`);
  console.log(`   e.g. ${monsters[0].name}: ${monsters[0].lore}\n        ${monsters[2].name}: ${monsters[2].lore}`);
}

// every flavour text names the object or uses one of its own details
let hookless = [];
for (const o of T.OBJECT_LIST) for (const r of ['common', 'rare', 'legendary']) {
  const t = T.monsterLore({ obj: o.id, rarity: r, seed: 99 }).toLowerCase(), kit = T.loreKitFor(o, o.cat), nm = o.name.split(' / ')[0].toLowerCase();
  const sig = ((o.sig && o.sig.name) || o.sigName || T.CATEGORY[o.cat].sig.name).toLowerCase(), own = Object.values(T.LORE_OBJECT[o.id] || {}).map(x => x.toLowerCase());
  const hook = t.includes(nm) || t.includes(sig) || own.includes(t) || Object.values(kit).flat().some(ph => t.includes(ph.toLowerCase()));
  if (!hook) hookless.push(o.id + '/' + r);
}
ok(!hookless.length, `every flavour text (${T.OBJECT_LIST.length * 3}) names its object, its move, or one of its own details${hookless.length ? ': ' + hookless.slice(0, 4).join(', ') : ''}`);

// audit: a category template that is ONE specific object is only used by objects of that kind
const SPECIFIC = { tool: /tool ?box|tool kit|toolbag/, keys: /key/, fridge: /fridge|refrigerator|freezer|cooler|ice maker/, laptop: /laptop|notebook computer|chromebook|netbook/, tv: /\btv\b|television/ };
let wrong = [];
for (const o of T.OBJECT_LIST) {
  const d = T.designOf(o);
  for (const [cat, re] of Object.entries(SPECIFIC)) if (d.shape === T.CATEGORY[cat].shape && !d.sub && !re.test(o.name.toLowerCase()) && o.cat === cat && !(o.vis && o.vis.legacy)) wrong.push(o.name);
}
ok(!wrong.length, `no object borrows the toolbox, key, fridge, laptop or TV body unless it is one (${wrong.slice(0, 6).join(', ') || 'none'})`);
const camNames = T.OBJECT_LIST.filter(o => /camera|webcam|dashcam|cctv|camcorder/.test(o.name.toLowerCase()) && !/bag/.test(o.name.toLowerCase()));
ok(camNames.every(o => { const v = T.visualSource(o); return v.id === 'camera' || (v.vis && v.vis.t === 'cctv') || v.id === 'monitor'; }), `every camera (${camNames.length}) gets a camera design`);
const elec = T.OBJECT_LIST.filter(o => /switch|socket|outlet|thermostat|doorbell|intercom|smoke detector|fire alarm/.test(o.name.toLowerCase()) && o.id.startsWith('x_'));
ok(elec.every(o => T.visualSource(o).vis && T.visualSource(o).vis.t === 'wallplate'), `every wall fitting (${elec.length}) gets the wall-plate design`);
ok(T.DESIGN_RULES.every(([, vis]) => !vis.like || T.OBJECTS[vis.like]), 'every "drawn like" rule points at a real design');
const counts = { dedicated: 0, composed: 0, related: 0, family: 0 }; for (const o of T.OBJECT_LIST) counts[T.objectTier(o)]++;
console.log('   design coverage:', JSON.stringify(counts));

// existing saves: a monster made with the old toolbox body keeps it until the player chooses to update it
const old = { obj: 'x_light_switch', cat: 'tool', rarity: 'rare', seed: 4242, level: 5, fam: 'mechanical', name: 'Switchgoyle', abilities: [{ name: 'Nail Gun', power: 0.45, hits: 3, cd: 3 }], species: 'o:x_light_switch', id: 'm1',
  lore: 'You have probably met one already: it vanishes the moment you need it and reappears after.' };
old.dna = T.makeDNA({ ...old }); old.dna.shape = 'tool'; old.dna.sub = null; // exactly how v0.4.2 stored it
const oldGrid = grid(old.dna);
ok(oldGrid === grid({ ...old.dna, obj: 'x_light_switch' }) && T.buildGrid(old.dna).px.length > 0, 'a saved v0.4.2 monster still renders with the body it was found with');
const ch = T.identityUpdate(old);
ok(ch && ch.design.shape === 'obj' && ch.sig === 'Lights Out' && ch.lore && !/vanishes the moment/.test(ch.lore), 'an update is offered: new body, move name and object-specific text');
const S2 = T.freshState(); S2.monsters = [old]; S2.dex[old.species] = { key: old.species, obj: old.obj, dna: { ...old.dna } };
const before = JSON.stringify({ col: old.dna.col, eyes: old.dna.eyes, stats: old.stats, level: old.level, power: old.abilities[0].power });
T.applyIdentityUpdate(S2, old);
ok(old.dna.shape === 'obj' && grid(old.dna) !== oldGrid && JSON.stringify({ col: old.dna.col, eyes: old.dna.eyes, stats: old.stats, level: old.level, power: old.abilities[0].power }) === before && S2.dex[old.species].dna.shape === 'obj', 'updating changes only body, text and move name; colours, eyes, stats and level stay');
const round = T.importSave(T.exportSave(S2));
ok(round.monsters[0].dna.shape === 'obj' && round.monsters[0].lore === old.lore && round.monsters[0].abilities[0].name === 'Lights Out', 'the updated look and text survive backup export/import');
T.undoIdentityUpdate(old);
ok(old.dna.shape === 'tool' && grid(old.dna) === oldGrid && /vanishes the moment/.test(old.lore), 'the update can be undone exactly');
ok(T.identityUpdate({ ...T.createMonster(T.freshState(), { obj: 'x_light_switch', rarity: 'common' }) }) === null, 'new monsters need no update');

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL IDENTITY CHECKS PASSED');
process.exit(bad ? 1 : 0);
