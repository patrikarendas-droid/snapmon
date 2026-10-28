#!/usr/bin/env node
// Generates src/labels.js: maps every ImageNet class (MobileNet) and COCO class (COCO-SSD) to a SNAPMON
// monster category + visual sub-type. `null` = recognised, but not something a monster can hide in
// (people, places, landscapes, weapons). Anything not matched by a rule becomes an "other" oddity that
// keeps the real label as its name. Run: node tools/gen-labels.js [--report]
const fs = require('fs'), path = require('path');
const IMAGENET = require('./data/imagenet-classes.json');
const COCO = require('./data/coco-classes.json');

// Animals are grouped by their (well-known) ImageNet index ranges.
const RANGES = [
  [0, 1, 'fish', 'fish'], [2, 4, 'fish', 'shark'], [5, 6, 'fish', 'fish'],
  [7, 23, 'bird', 'perch'], [24, 24, 'bird', 'owl'],
  [25, 29, 'reptile', 'lizard'], [30, 32, 'reptile', 'frog'], [33, 37, 'reptile', 'turtle'], [38, 51, 'reptile', 'lizard'], [52, 68, 'reptile', 'snake'],
  [69, 69, 'bug', 'beetle'], [70, 78, 'bug', 'spider'], [79, 79, 'bug', 'beetle'],
  [80, 96, 'bird', 'perch'], [97, 100, 'bird', 'water'],
  [101, 101, 'animal', 'hoofed'], [102, 103, 'animal', 'bear'], [104, 104, 'animal', 'rabbit'], [105, 106, 'animal', 'bear'],
  [107, 109, 'fish', 'jelly'], [110, 117, 'bug', 'snail'], [118, 125, 'bug', 'crab'], [126, 126, 'bug', 'beetle'],
  [127, 144, 'bird', 'water'], [145, 145, 'bird', 'water'], [146, 146, 'bird', 'water'],
  [147, 150, 'fish', 'shark'],
  [151, 276, 'animal', 'dog'], [277, 285, 'animal', 'cat'], [286, 293, 'animal', 'cat'], [294, 297, 'animal', 'bear'], [298, 299, 'animal', 'cat'],
  [300, 318, 'bug', 'beetle'], [319, 326, 'bug', 'butterfly'],
  [327, 328, 'fish', 'star'], [329, 329, 'bug', 'snail'],
  [330, 332, 'animal', 'rabbit'], [333, 334, 'animal', 'bear'], [335, 335, 'animal', 'cat'], [336, 338, 'animal', 'bear'],
  [339, 355, 'animal', 'hoofed'], [356, 362, 'animal', 'cat'], [363, 363, 'animal', 'bear'], [364, 384, 'animal', 'monkey'],
  [385, 386, 'animal', 'hoofed'], [387, 387, 'animal', 'cat'], [388, 388, 'animal', 'bear'], [389, 397, 'fish', 'fish'],
];

// Ordered rules for everything from index 398 on. First match wins. Patterns match the first name of the class.
const RULES = [
  // not monster hosts: places, scenery, people, weapons, huge structures
  [/^(aircraft carrier|airliner|airship|altar|apiary|assault rifle|bakery|barbershop|barn|bell cote|boathouse|bookshop|breakwater|butcher shop|cannon|carousel|castle|chainlink fence|church|cinema|cliff dwelling|confectionery|container ship|dam|dock|dome|drilling platform|fireboat|fountain|greenhouse|grocery store|guillotine|library|liner|lumbermill|maze|megalith|missile|monastery|mosque|obelisk|palace|patio|picket fence|pier|planetarium|prison|projectile|radio telescope|restaurant|revolver|rifle|shoe shop|solar dish|space shuttle|stage|steel arch bridge|stone wall|stupa|submarine|suspension bridge|tank|thatch|tile roof|tobacco shop|toyshop|totem pole|triumphal arch|viaduct|warplane|water tower|worm fence|yurt|web site|ballplayer|groom|scuba diver|alp|bubble|cliff|coral reef|geyser|lakeside|promontory|sandbar|seashore|valley|volcano|wreck|bannister|balance beam|horizontal bar|parallel bars|maypole|scoreboard|pirate|military uniform|holster|scabbard|bulletproof vest|pickelhaube|gasmask|neck brace|half track|mobile home|boathouse|harvester|thresher|crane|gondola|dogsled|bobsled|schooner|yawl|catamaran|trimaran|speedboat|canoe|lifeboat|paddlewheel|drilling platform|steam locomotive|electric locomotive|bullet train|freight car|passenger car|streetcar|trolleybus|snowplow|forklift|cash machine|vault|prayer rug|honeycomb|hay|stretcher)$/, null],
  // bathroom
  [/^(toilet seat|toilet tissue|plunger)$/, 'toilet'],
  [/^(washbasin|bathtub|tub|bucket|shower curtain|soap dispenser|swab)$/, 'faucet'],
  // drinks & containers
  [/^(teapot|coffeepot|pitcher|water jug|whiskey jug)$/, 'mug', 'teapot'],
  [/^(beer glass|goblet|red wine|cocktail shaker|measuring cup|eggnog)$/, 'mug', 'glass'],
  [/^(coffee mug|cup|espresso|thimble)$/, 'mug', 'mug'],
  [/^(vase)$/, 'bottle', 'vase'],
  [/^(milk can|barrel|rain barrel|ashcan)$/, 'bottle', 'can'],
  [/^(beer bottle|wine bottle|water bottle|pop bottle|pill bottle|bottlecap|lotion|sunscreen|perfume|hair spray|beaker|saltshaker|nipple)$/, 'bottle', 'bottle'],
  // kitchen
  [/^(frying pan|wok|spatula)$/, 'pot', 'pan'],
  [/^(mixing bowl|soup bowl|plate|tray|petri dish|consomme|guacamole|mashed potato|carbonara|hot pot|strainer)$/, 'pot', 'bowl'],
  [/^(dutch oven|caldron|crock pot|potpie)$/, 'pot', 'pot'],
  [/^(refrigerator|microwave|stove|toaster|dishwasher|washer|vacuum|iron|electric fan|space heater|radiator|waffle iron|espresso maker|rotisserie|hand blower|vending machine|photocopier|sewing machine|printer)$/, 'fridge'],
  // food
  [/^(pizza)$/, 'food', 'pizza'], [/^(hotdog)$/, 'food', 'hotdog'],
  [/^(french loaf|bagel|pretzel|dough)$/, 'food', 'bread'],
  [/^(cheeseburger|burrito|meat loaf)$/, 'food', 'burger'],
  [/^(ice cream|ice lolly)$/, 'cake', 'icecream'], [/^(trifle|chocolate sauce)$/, 'cake', 'cake'],
  [/^(banana)$/, 'banana'],
  [/^(strawberry)$/, 'fruit', 'strawberry'], [/^(pineapple|jackfruit|artichoke)$/, 'fruit', 'pineapple'],
  [/^(orange|acorn squash|butternut squash|jack-o'-lantern)$/, 'fruit', 'orange'],
  [/^(lemon|spaghetti squash|zucchini|cucumber|corn|ear)$/, 'fruit', 'lemon'],
  [/^(head cabbage|broccoli|cauliflower|cardoon)$/, 'fruit', 'veg'],
  [/^(granny smith|fig|custard apple|pomegranate|bell pepper|hip)$/, 'fruit', 'apple'],
  [/^(acorn|buckeye)$/, 'tree'],
  [/^(spider web)$/, 'bug', 'spider'],
  // plants
  [/^(daisy|yellow lady's slipper|rapeseed)$/, 'plant', 'flower'],
  [/^(mushroom|agaric|gyromitra|stinkhorn|earthstar|hen-of-the-woods|bolete|coral fungus)$/, 'plant', 'mushroom'],
  [/^(pot)$/, 'plant', 'potted'],
  // electronics
  [/^(laptop|notebook|desktop computer|computer keyboard|typewriter keyboard|hand-held computer|space bar|hard disc|modem|oscilloscope|abacus|slide rule)$/, 'laptop'],
  [/^(television|monitor|screen|entertainment center|home theater|scoreboard)$/, 'tv', 'tv'],
  [/^(loudspeaker|radio|cd player|tape player|cassette player|cassette|microphone|stethoscope)$/, 'tv', 'speaker'],
  [/^(reflex camera|polaroid camera|projector|binoculars|loupe|lens cap)$/, 'tv', 'camera'],
  [/^(cellular telephone|dial telephone|pay-phone|ipod|remote control|mouse|joystick|switch)$/, 'phone'],
  // furniture & home
  [/^(studio couch)$/, 'sofa'],
  [/^(desk|dining table|pool table)$/, 'chair', 'table'],
  [/^(bookcase|china cabinet|wardrobe|chest|medicine chest|chiffonier|safe|plate rack)$/, 'chair', 'cabinet'],
  [/^(folding chair|rocking chair|barber chair|throne|park bench)$/, 'chair', 'chair'],
  [/^(pillow|quilt|four-poster|crib|cradle|bassinet|sleeping bag|mosquito net)$/, 'pillow'],
  [/^(window screen|window shade|shoji|sliding door|car mirror|fire screen)$/, 'mirror'],
  [/^(table lamp|lampshade|spotlight|torch|beacon|traffic light)$/, 'lamp'],
  [/^(candle|lighter|matchstick)$/, 'candle'],
  [/^(analog clock|digital clock|wall clock|stopwatch|digital watch|hourglass|sundial|barometer|odometer|magnetic compass|scale|parking meter)$/, 'clock'],
  [/^(plastic bag|garbage truck)$/, 'trash'],
  [/^(umbrella|parachute)$/, 'umbrella'],
  // bags & boxes
  [/^(backpack|purse|mailbag|wallet|shopping basket|hamper|carton|crate|packet|pencil box|punching bag|mailbox|birdhouse|piggy bank)$/, 'bag'],
  // reading
  [/^(book jacket|comic book|menu|envelope|binder|crossword puzzle|street sign)$/, 'book'],
  // clothes
  [/^(sombrero|cowboy hat|bonnet|bathing cap|shower cap|crash helmet|football helmet|mortarboard|bearskin|ski mask)$/, 'cloth', 'hat'],
  [/^(sock|christmas stocking|mitten|knee pad)$/, 'cloth', 'sock'],
  [/^(cardigan|jersey|sweatshirt|trench coat|lab coat|fur coat|suit|apron|bib|pajama|jean|kimono|abaya|gown|cloak|poncho|sarong|stole|velvet|wool|dishrag|handkerchief|bath towel|paper towel|theater curtain|bow tie|windsor tie|bolo tie|feather boa|vestment|academic gown|miniskirt|hoopskirt|overskirt|brassiere|bikini|maillot|swimming trunks|diaper|doormat|chain mail|cuirass|breastplate|bow)$/, 'cloth', 'shirt'],
  [/^(running shoe|loafer|clog|sandal)$/, 'shoe', 'sneaker'], [/^(cowboy boot)$/, 'shoe', 'boot'],
  // music
  [/^(acoustic guitar|electric guitar|banjo|violin|cello|harp)$/, 'instrument', 'guitar'],
  [/^(drum|steel drum|gong|chime|maraca|drumstick)$/, 'instrument', 'drum'],
  [/^(grand piano|upright|organ|accordion|marimba)$/, 'instrument', 'piano'],
  [/^(sax|french horn|trombone|cornet|flute|oboe|bassoon|ocarina|panpipe|harmonica|whistle)$/, 'instrument', 'horn'],
  // sport & play
  [/^(soccer ball|volleyball)$/, 'ball', 'soccer'], [/^(basketball)$/, 'ball', 'basket'], [/^(tennis ball)$/, 'ball', 'tennis'],
  [/^(baseball|golf ball|rugby ball|croquet ball|ping-pong ball|puck)$/, 'ball', 'plain'],
  [/^(teddy|jigsaw puzzle|balloon|pinwheel|yo-yo|mask|wig)$/, 'toy'],
  // vehicles
  [/^(mountain bike|bicycle-built-for-two|tricycle|unicycle|moped|motor scooter)$/, 'car', 'bike'],
  [/^(school bus|minibus|recreational vehicle|fire engine|trailer truck|moving van|ambulance|police van|tow truck|tractor)$/, 'car', 'bus'],
  [/^(sports car|convertible|cab|beach wagon|jeep|limousine|minivan|model t|racer|pickup|go-kart|golfcart|snowmobile|car wheel|disk brake|grille|seat belt|gas pump|lawn mower|shopping cart|barrow|jinrikisha|horse cart|oxcart|plow)$/, 'car', 'car'],
  // tools & small items
  [/^(hammer|screwdriver|power drill|chain saw|hatchet|cleaver|letter opener|can opener|corkscrew|carpenter's kit|plane|file|rule|shovel|broom|wooden spoon|ladle|paintbrush|pencil sharpener|pick|tripod|reel|racket|dumbbell|barbell|ski|paddle|crutch|syringe|mousetrap|oil filter|chain|hook|coil|knot|spindle|potter's wheel|shield|pole|flagpole|swing|turnstile|nail|screw)$/, 'tool'],
  [/^(ballpoint|fountain pen|quill|lipstick|rubber eraser|safety pin|padlock|combination lock|buckle|hair slide|necklace|band aid|face powder|sunglass|sunglasses|snorkel|oxygen mask|muzzle)$/, 'keys'],
];

const COCO_MAP = {
  person: null, bicycle: ['car', 'bike'], car: ['car', 'car'], motorcycle: ['car', 'bike'], airplane: null, bus: ['car', 'bus'], train: ['car', 'bus'],
  truck: ['car', 'bus'], boat: null, 'traffic light': ['lamp'], 'fire hydrant': ['faucet'], 'stop sign': ['book'], 'parking meter': ['clock'],
  bench: ['chair', 'chair'], bird: ['bird', 'perch'], cat: ['animal', 'cat'], dog: ['animal', 'dog'], horse: ['animal', 'hoofed'], sheep: ['animal', 'hoofed'],
  cow: ['animal', 'hoofed'], elephant: ['animal', 'hoofed'], bear: ['animal', 'bear'], zebra: ['animal', 'hoofed'], giraffe: ['animal', 'hoofed'],
  backpack: ['bag'], umbrella: ['umbrella'], handbag: ['bag'], tie: ['cloth', 'shirt'], suitcase: ['bag'], frisbee: ['ball', 'plain'], skis: ['tool'],
  snowboard: ['tool'], 'sports ball': ['ball', 'plain'], kite: ['toy'], 'baseball bat': ['tool'], 'baseball glove': ['cloth', 'sock'], skateboard: ['car', 'car'],
  surfboard: ['tool'], 'tennis racket': ['tool'], bottle: ['bottle', 'bottle'], 'wine glass': ['mug', 'glass'], cup: ['mug', 'mug'], fork: ['tool'],
  knife: ['tool'], spoon: ['tool'], bowl: ['pot', 'bowl'], banana: ['banana'], apple: ['fruit', 'apple'], sandwich: ['food', 'burger'],
  orange: ['fruit', 'orange'], broccoli: ['fruit', 'veg'], carrot: ['fruit', 'lemon'], 'hot dog': ['food', 'hotdog'], pizza: ['food', 'pizza'],
  donut: ['cake', 'donut'], cake: ['cake', 'cake'], chair: ['chair', 'chair'], couch: ['sofa'], 'potted plant': ['plant', 'potted'], bed: ['pillow'],
  'dining table': ['chair', 'table'], toilet: ['toilet'], tv: ['tv', 'tv'], laptop: ['laptop'], mouse: ['phone'], remote: ['phone'],
  keyboard: ['laptop'], 'cell phone': ['phone'], microwave: ['fridge'], oven: ['fridge'], toaster: ['fridge'], sink: ['faucet'],
  refrigerator: ['fridge'], book: ['book'], clock: ['clock'], vase: ['bottle', 'vase'], scissors: ['tool'], 'teddy bear': ['toy'],
  'hair drier': ['fridge'], toothbrush: ['keys'],
};

const imagenet = {}, report = { mapped: 0, other: [], excluded: 0 };
IMAGENET.forEach((cls, i) => {
  const first = cls.split(',')[0].trim();
  let v;
  const r = RANGES.find(([a, b]) => i >= a && i <= b);
  if (r && i < 398) v = r[3] ? [r[2], r[3]] : [r[2]];
  else {
    const rule = RULES.find(([re]) => re.test(first.toLowerCase()));
    if (rule) v = rule[1] === null ? null : rule[2] ? [rule[1], rule[2]] : [rule[1]];
    else v = ['other'];
  }
  imagenet[cls] = v;
  if (v === null) report.excluded++; else if (v[0] === 'other') report.other.push(first); else report.mapped++;
});
for (const c of COCO) if (!(c in COCO_MAP)) throw new Error('COCO class without mapping: ' + c);

const enc = v => v === null ? 0 : v.join(':');
const out = `/* SNAPMON — generated by tools/gen-labels.js. Do not edit by hand.
   Maps recogniser class names to "category:subtype". 0 = recognised but not a monster host (people, places, weapons). */
'use strict';
const LABEL_MAP = {
  imagenet: ${JSON.stringify(Object.fromEntries(Object.entries(imagenet).map(([k, v]) => [k, enc(v)])))},
  coco: ${JSON.stringify(Object.fromEntries(Object.entries(COCO_MAP).map(([k, v]) => [k, enc(v)])))},
};
`;
fs.writeFileSync(path.join(__dirname, '../src/labels.js'), out);
console.log(`ImageNet: ${report.mapped} mapped to object monsters, ${report.other.length} oddities, ${report.excluded} excluded. COCO: ${COCO.length} mapped.`);
if (process.argv.includes('--report')) console.log('oddities:', report.other.join(' | '));
