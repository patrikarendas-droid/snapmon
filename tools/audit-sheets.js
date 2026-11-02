#!/usr/bin/env node
// Builds the standard contact sheets of the recognition audit into docs/review/audit-sheets/ (real game sprites, via
// tools/audit-sheet.js). Re-run after mapping or design changes and look at them. Usage: node tools/audit-sheets.js
const { execFileSync } = require('child_process'), fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'docs/review/audit-sheets');
const ctx = { console, Math, JSON, Date }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n') + ';globalThis.X={OBJECTS,OBJECT_LIST,CATEGORY,VIS_FIXES}', ctx);
const { X } = ctx, { FIXED, collect, lint } = require('./audit-mapping');
fs.mkdirSync(OUT, { recursive: true });
const sheet = (file, title, entries) => execFileSync('node', [path.join(__dirname, 'audit-sheet.js'), path.join(OUT, file), title, ...entries], { stdio: 'inherit' });
const byName = n => X.OBJECT_LIST.find(o => o.name.toLowerCase() === n);
const catShape = o => X.CATEGORY[o.cat].shape;

sheet('01-sea-urchin-vs-starfish.png', 'Sea urchin vs starfish — before (v0.4.8) and after', [
  'starfish|BEFORE: a recognised "sea urchin" became this Starfish (name, lore, moves, sprite)',
  `x_sea_urchin_shell@${catShape(X.OBJECTS.x_sea_urchin_shell)}|BEFORE: "sea urchin shell" was drawn as a fish (also how already-saved urchins stay)`,
  'label=sea urchin|AFTER', 'label=sea urchin shell|AFTER', 'label=starfish, sea star|AFTER: genuine starfish unchanged', 'label=sea star|AFTER: unchanged']);
sheet('02-identity-fixes.png', 'Identity fixes: recognised label → object (after)', FIXED.filter(([l]) => !/^(sea urchin|starfish|sea star)/.test(l)).map(([l, , n]) => `label=${l}|${n}`));
const vis = Object.keys(X.VIS_FIXES).map(byName).filter(Boolean);
for (let i = 0, part = 1; i < vis.length; i += 20, part++) {
  sheet(`03-visual-fixes-${part}-before.png`, `Visual fixes ${part}: BEFORE (category body)`, vis.slice(i, i + 20).map(o => `${o.id}@${catShape(o)}|before`));
  sheet(`03-visual-fixes-${part}-after.png`, `Visual fixes ${part}: AFTER`, vis.slice(i, i + 20).map(o => o.id));
}
const C = collect(), flags = lint(C);
sheet('04-review-queue.png', 'Kept / review queue: ambiguous identities and approximate bodies (not changed)', [
  'label=kite|ImageNet bird "kite" = toy kite (name collision, kept)', 'label=crane|ImageNet bird/machine "crane" collide (kept)', 'label=piggy bank, penny bank|piggy bank → Pig (review)',
  'label=whale|whale → Shark body+identity (review: no whale object)', 'label=wombat|wombat → Bear (review)', 'label=binoculars, field glasses, opera glasses|binoculars → Glasses (approximation)',
  ...flags.filter(f => f.rule === 'family-body').filter((_, i) => i % 4 === 0).slice(0, 18).map(f => `${f.key}|family body`)]);
sheet('05-good-shared-bodies.png', 'Legitimate shared bodies (kept): related identities, same silhouette', [
  'label=beagle|dog breed: own identity, dog body', 'label=golden retriever|dog breed: own identity, dog body', 'label=Cardigan, Cardigan Welsh corgi|corgi: own identity, dog body',
  'label=goldfish, Carassius auratus|fish', 'label=cod|fish', 'label=energy drink|can body', 'label=soda can|can body', 'label=koala|own identity, bear body', 'label=moth|own identity, butterfly body', 'label=wolf|own identity, fox body']);
console.log('sheets in', path.relative(ROOT, OUT));
