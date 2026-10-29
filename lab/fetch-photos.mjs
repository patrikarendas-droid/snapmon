// Downloads a labelled benchmark set from Wikimedia Commons categories (CI only; images are not committed or shipped).
// truth = registry object id; ok = other acceptable answers; '__unknown' = must be rejected (no monster).
// Usage: node lab/fetch-photos.mjs <out-dir> [perClass=4]
import fs from 'fs'; import path from 'path';
const out = process.argv[2] || 'lab/data/photos', PER = +(process.argv[3] || 4);
const UA = 'SnapMonBenchmark/0.3 (https://github.com/patrikarendas-droid/snapmon; evaluation only)';
const SET = [
  // vehicles & machinery (confusable group)
  ['forklift', ['Forklifts', 'Forklift trucks']], ['train', ['Electric locomotives', 'Diesel locomotives']], ['steam_locomotive', ['Steam locomotives']], ['tractor', ['Tractors']],
  ['excavator', ['Excavators', 'Hydraulic excavators']], ['bulldozer', ['Bulldozers']], ['truck', ['Trucks', 'Box trucks']], ['bus', ['Buses']], ['crane', ['Mobile cranes']],
  ['bicycle', ['Bicycles']], ['motorcycle', ['Motorcycles']], ['car', ['Sedans', 'Automobiles']], ['fire_truck', ['Fire engines']], ['tram', ['Trams']],
  ['dump_truck', ['Dump trucks']], ['cement_mixer', ['Concrete mixer trucks']], ['garbage_truck', ['Garbage trucks']], ['airplane', ['Airliners']], ['helicopter', ['Helicopters']],
  // furniture (confusable group)
  ['office_chair', ['Office chairs', 'Swivel chairs']], ['dining_chair', ['Chairs', 'Wooden chairs']], ['sofa', ['Sofas', 'Couches']], ['armchair', ['Armchairs']],
  ['rocking_chair', ['Rocking chairs']], ['stool', ['Stools', 'Bar stools']], ['bench', ['Benches']], ['desk', ['Desks']], ['bookshelf', ['Bookcases', 'Bookshelves']], ['bed', ['Beds']], ['wardrobe', ['Wardrobes']],
  // kitchen & appliances
  ['mug', ['Mugs', 'Coffee mugs']], ['teapot', ['Teapots']], ['glass', ['Drinking glasses', 'Tumblers (glasses)']], ['kettle', ['Electric kettles', 'Kettles']], ['microwave', ['Microwave ovens']],
  ['toaster', ['Toasters']], ['washing_machine', ['Washing machines']], ['fridge', ['Refrigerators']], ['blender', ['Blenders']], ['frying_pan', ['Frying pans']], ['bottle', ['Plastic bottles', 'Bottles']],
  ['vacuum', ['Vacuum cleaners']], ['fan', ['Electric fans']], ['iron', ['Clothes irons']],
  // electronics
  ['laptop', ['Laptops']], ['desktop_pc', ['Desktop computers']], ['tv', ['Televisions', 'Television sets']], ['monitor', ['Computer monitors']], ['phone', ['Smartphones']],
  ['keyboard', ['Computer keyboards']], ['headphones', ['Headphones']], ['game_controller', ['Game controllers', 'Gamepads']], ['camera', ['Digital cameras']],
  // food & plants
  ['banana', ['Bananas']], ['pineapple', ['Pineapples']], ['cucumber', ['Cucumbers']], ['apple', ['Apples']], ['orange', ['Oranges (fruit)']], ['strawberry', ['Strawberries']],
  ['broccoli', ['Broccoli']], ['pizza', ['Pizzas']], ['burger', ['Hamburgers']], ['donut', ['Doughnuts']], ['cactus', ['Cacti in pots', 'Cactaceae in cultivation']], ['potted_plant', ['Potted plants', 'Houseplants']], ['sunflower', ['Helianthus annuus (flowers)', 'Sunflowers']],
  // household, tools, toys, music, animals
  ['umbrella', ['Umbrellas']], ['toilet', ['Toilets', 'Flush toilets']], ['scissors', ['Scissors']], ['hammer', ['Hammers']], ['backpack', ['Backpacks']], ['suitcase', ['Suitcases']],
  ['teddy', ['Teddy bears']], ['guitar', ['Acoustic guitars', 'Guitars']], ['violin', ['Violins']], ['piano', ['Grand pianos', 'Upright pianos']], ['clock', ['Alarm clocks']], ['lamp', ['Table lamps', 'Lamps']],
  ['sneaker', ['Sneakers', 'Athletic shoes']], ['dog', ['Dogs']], ['cat', ['Cats']], ['duck', ['Ducks']], ['ladder', ['Ladders']], ['traffic_cone', ['Traffic cones']], ['wheelbarrow', ['Wheelbarrows']],
];
const OOV = [ // must be rejected: scenery, surfaces, people and objects outside the vocabulary
  'Clouds', 'Brick walls', 'Carpets', 'Lawns', 'Sky', 'Beaches', 'Mountains', 'Asphalt', 'Portrait photographs of women', 'Portrait photographs of men',
  'Theremins', 'Astrolabes', 'Sextants', 'Armillary spheres', 'Orreries', 'Sphygmomanometers',
];
async function api(params) {
  const u = 'https://commons.wikimedia.org/w/api.php?format=json&origin=*&' + new URLSearchParams(params);
  for (let a = 0; a < 3; a++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (r.ok) return r.json(); } catch (e) {} await new Promise(r => setTimeout(r, 1500)); }
  return {};
}
const BAD = /logo|icon|diagram|map|drawing|svg|plan|scheme|sketch|chart|stamp|coat of arms|patent|advert|poster|text|label/i;
async function filesFor(cats, n) {
  const got = [];
  for (const c of cats) {
    const j = await api({ action: 'query', generator: 'categorymembers', gcmtitle: 'Category:' + c, gcmtype: 'file', gcmlimit: 60, prop: 'imageinfo', iiprop: 'url|mime|size', iiurlwidth: 640 });
    const pages = Object.values((j.query && j.query.pages) || {}).filter(p => p.imageinfo && /jpeg/.test(p.imageinfo[0].mime) && p.imageinfo[0].width >= 400 && !BAD.test(p.title));
    pages.sort((a, b) => (hash(a.title) - hash(b.title)));
    for (const p of pages) { if (got.length >= n) break; got.push({ title: p.title, url: p.imageinfo[0].thumburl || p.imageinfo[0].url }); }
    if (got.length >= n) break;
  }
  return got;
}
function hash(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
fs.mkdirSync(out, { recursive: true });
const labels = [];
async function grab(list, truth, group) {
  for (const [i, f] of list.entries()) {
    const file = `${truth}__${i}.jpg`;
    try {
      const r = await fetch(f.url, { headers: { 'User-Agent': UA } }); if (!r.ok) continue;
      fs.writeFileSync(path.join(out, file), Buffer.from(await r.arrayBuffer()));
      labels.push({ file, truth, group, source: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(f.title.replace(/ /g, '_')) });
    } catch (e) {}
  }
}
for (const [truth, cats] of SET) await grab(await filesFor(cats, PER), truth, 'object');
for (const c of OOV) await grab(await filesFor([c], 2), '__unknown', 'oov:' + c);
fs.writeFileSync(path.join(out, 'labels.json'), JSON.stringify(labels, null, 1));
const counts = labels.reduce((m, l) => (m[l.group === 'object' ? 'object' : 'oov']++, m), { object: 0, oov: 0 });
console.log(`benchmark photos: ${counts.object} object photos across ${new Set(labels.filter(l => l.group === 'object').map(l => l.truth)).size} objects, ${counts.oov} out-of-vocabulary photos`);
const missing = SET.filter(([t]) => !labels.some(l => l.truth === t)).map(([t]) => t);
if (missing.length) console.log('no photos found for:', missing.join(', '));
