/* SNAPMON — object registry: recognised object → specific identity → visual design → monster.
   Visual tiers (reported honestly in-game and in docs):
     'dedicated' – a bespoke builder for this exact object (PARTS.D or an original v1/v2 sprite)
     'composed'  – a parametric template (PARTS.T) configured with object-specific parameters
     'related'   – its own identity and name, drawn with the design of its closest relative (a dog breed uses the dog design)
     'family'    – no specific design yet: the closest category template, coloured from the photo
   Every object also belongs to a CATEGORY (data.js) which supplies monster family, stats and base abilities.
   `al` aliases are matched against recogniser labels (ImageNet, COCO and the CLIP vocabulary). */
'use strict';

const OBJECTS = {};
const OBJECT_LIST = [];
const ALIAS_INDEX = new Map(); // label → object id (first registration wins); updated as objects are added
function OBJ(id, name, cat, vis, o = {}) {
  if (!CATEGORY[cat]) throw new Error('unknown category for ' + id);
  const def = { id, name, cat, vis: vis || null, h: o.h == null ? -1 : o.h, s: o.s, l: o.l, al: o.al || [], nm: o.nm || null, sig: o.sig || null, vocab: o.vocab !== false };
  OBJECTS[id] = def; OBJECT_LIST.push(def);
  for (const a of [name, ...def.al]) { const k = String(a).toLowerCase().trim(); if (k && !ALIAS_INDEX.has(k)) ALIAS_INDEX.set(k, id); }
  return def;
}
const V = (t, p = {}) => ({ t, ...p });          // composed template
const L = (shape, sub) => ({ legacy: shape, sub }); // original hand-built sprite (dedicated tier)

/* ===== vehicles & machinery ===== */
OBJ('forklift', 'Forklift', 'car', 'D', { h: 45, al: ['forklift', 'fork lift truck', 'lift truck'], nm: 'Lifty', sig: { name: 'Pallet Hoist', power: 1.2, effect: 'stun', chance: 0.3 } });
OBJ('excavator', 'Excavator', 'car', 'D', { h: 42, al: ['excavator', 'digger', 'backhoe', 'steam shovel'], nm: 'Diggo', sig: { name: 'Bucket Scoop', power: 1.4 } });
OBJ('bulldozer', 'Bulldozer', 'car', 'D', { h: 45, al: ['bulldozer', 'dozer'], nm: 'Dozer', sig: { name: 'Plough Through', power: 1.5, effect: 'defdown', chance: 0.4 } });
OBJ('tractor', 'Tractor', 'car', 'D', { h: 115, al: ['tractor', 'farm tractor'], nm: 'Tracto', sig: { name: 'Harvest Charge', power: 1.35 } });
OBJ('crane', 'Mobile crane', 'car', 'D', { h: 45, al: ['crane', 'crane truck', 'mobile crane', 'construction crane'], nm: 'Hoist', sig: { name: 'Wrecking Swing', power: 1.5 } });
OBJ('steam_locomotive', 'Steam locomotive', 'car', 'D', { h: 0, s: 15, l: 22, al: ['steam locomotive', 'steam engine'], nm: 'Choo', sig: { name: 'Boiler Blast', power: 1.1, effect: 'burn', chance: 0.5 } });
OBJ('train', 'Train', 'car', 'D', { h: 210, al: ['train', 'electric locomotive', 'diesel locomotive', 'locomotive', 'passenger car', 'bullet train', 'freight car', 'high-speed train', 'subway train'], nm: 'Rail', sig: { name: 'Express Ram', power: 1.5 } });
OBJ('tram', 'Tram', 'car', 'D', { h: 0, al: ['streetcar', 'tram', 'trolleybus', 'trolley'], nm: 'Trolly' });
OBJ('car', 'Car', 'car', L('car'), { al: ['car', 'sedan', 'beach wagon', 'station wagon', 'hatchback', 'automobile'], nm: 'Vroom' });
OBJ('sports_car', 'Sports car', 'car', V('vehicle', { sedan: true, low: true, len: 34, h: 9, spoiler: true }), { h: 0, al: ['sports car', 'racer', 'race car', 'convertible', 'supercar'], nm: 'Zoom' });
OBJ('police_car', 'Police car', 'car', V('vehicle', { sedan: true, lightbar: true, h: 13 }), { h: 220, s: 20, l: 30, al: ['police car', 'police van', 'squad car'], nm: 'Siren' });
OBJ('taxi', 'Taxi', 'car', V('vehicle', { sedan: true, taxi: true, h: 13 }), { h: 50, al: ['cab', 'taxi', 'taxicab'], nm: 'Cabby' });
OBJ('jeep', 'Jeep / SUV', 'car', V('vehicle', { cabW: 22, len: 30, h: 14, cargo: 'none', wr: 4.5 }), { al: ['jeep', 'suv', 'off-road vehicle', 'land rover'], nm: 'Offroad' });
OBJ('pickup', 'Pickup truck', 'car', V('vehicle', { cabW: 14, cargo: 'flat', h: 14 }), { al: ['pickup', 'pickup truck'], nm: 'Pickup' });
OBJ('van', 'Van', 'car', V('vehicle', { cargo: 'box', cabW: 10, h: 16 }), { al: ['minivan', 'van', 'moving van', 'delivery van', 'minibus'], nm: 'Vanny' });
OBJ('bus', 'Bus', 'car', V('vehicle', { cargo: 'bus', len: 36, h: 19, wheels: 2 }), { al: ['bus', 'coach', 'double-decker bus', 'city bus'], nm: 'Busby' });
OBJ('school_bus', 'School bus', 'car', V('vehicle', { cargo: 'bus', len: 36, h: 18, stripe: true }), { h: 45, al: ['school bus'], nm: 'Yellowbus' });
OBJ('truck', 'Truck', 'car', V('vehicle', { cargo: 'box', cabW: 11, h: 17, wheels: 3 }), { al: ['truck', 'trailer truck', 'lorry', 'semi truck', 'box truck'], nm: 'Haul' });
OBJ('fire_truck', 'Fire truck', 'car', V('vehicle', { cargo: 'box', cabW: 11, h: 15, ladder: true, wheels: 3, stripe: true }), { h: 0, al: ['fire engine', 'fire truck', 'firetruck'], nm: 'Blaze', sig: { name: 'Hose Torrent', power: 1.2, effect: 'defdown', chance: 0.4 } });
OBJ('ambulance', 'Ambulance', 'car', V('vehicle', { cargo: 'box', cabW: 11, h: 16, cross: true, stripe: true }), { h: 0, s: 5, l: 92, al: ['ambulance'], nm: 'Medic' });
OBJ('garbage_truck', 'Garbage truck', 'car', V('vehicle', { cargo: 'hopper', cabW: 11, h: 17, wheels: 3 }), { h: 110, al: ['garbage truck', 'dustcart', 'refuse truck'], nm: 'Trashy' });
OBJ('dump_truck', 'Dump truck', 'car', V('vehicle', { cargo: 'dump', cabW: 11, h: 15, wheels: 3, wr: 4 }), { h: 40, al: ['dump truck', 'tipper truck'], nm: 'Dumpo' });
OBJ('cement_mixer', 'Cement mixer', 'car', V('vehicle', { cargo: 'mixer', cabW: 11, h: 16, wheels: 3 }), { h: 30, al: ['cement mixer', 'concrete mixer truck', 'mixer truck'], nm: 'Churn' });
OBJ('tanker', 'Tanker truck', 'car', V('vehicle', { cargo: 'tank', cabW: 11, h: 15, wheels: 3 }), { al: ['tank truck', 'tanker truck', 'fuel truck'], nm: 'Tanko' });
OBJ('tow_truck', 'Tow truck', 'car', V('vehicle', { cargo: 'flat', hook: true, cabW: 12, h: 15 }), { al: ['tow truck', 'wrecker'], nm: 'Towbie' });
OBJ('ice_cream_truck', 'Ice cream van', 'car', V('vehicle', { cargo: 'box', cabW: 10, h: 15, cone: true }), { h: 200, s: 50, l: 80, al: ['ice cream truck', 'ice cream van'], nm: 'Sundae' });
OBJ('rv', 'Camper van', 'car', V('vehicle', { cargo: 'box', cabW: 9, len: 36, h: 18, stripe: true }), { s: 10, l: 88, al: ['recreational vehicle', 'camper', 'motorhome', 'caravan', 'camper van'], nm: 'Roamer' });
OBJ('go_kart', 'Go-kart', 'car', V('vehicle', { cabLow: true, cabW: 14, len: 26, h: 8, low: true, wr: 3 }), { al: ['go-kart', 'golfcart', 'golf cart', 'dune buggy'], nm: 'Kart' });
OBJ('lawn_mower', 'Lawn mower', 'tool', V('vehicle', { cabLow: true, cabW: 16, len: 24, h: 8, wr: 3, stack: true }), { h: 0, al: ['lawn mower', 'lawnmower', 'ride-on mower'], nm: 'Mowzer' });
OBJ('snowmobile', 'Snowmobile', 'car', V('vehicle', { cabLow: true, cabW: 12, len: 30, h: 9, tracks: true }), { al: ['snowmobile', 'snowplow'], nm: 'Frostride' });
OBJ('bicycle', 'Bicycle', 'car', L('car', 'bike'), { al: ['bicycle', 'mountain bike', 'bicycle-built-for-two', 'bike', 'road bike', 'tricycle', 'unicycle'], nm: 'Pedal' });
OBJ('motorcycle', 'Motorcycle', 'car', 'D', { h: 0, al: ['motorcycle', 'motorbike', 'moped', 'dirt bike'], nm: 'Throttle', sig: { name: 'Wheelie Smash', power: 1.4 } });
OBJ('scooter', 'Kick scooter', 'car', 'D', { al: ['scooter', 'kick scooter', 'motor scooter', 'e-scooter'], nm: 'Scoot' });
OBJ('airplane', 'Airplane', 'car', 'D', { h: 210, s: 10, l: 88, al: ['airliner', 'airplane', 'aeroplane', 'jet', 'plane', 'toy airplane', 'airship'], nm: 'Wingo' });
OBJ('helicopter', 'Helicopter', 'car', 'D', { al: ['helicopter', 'chopper'], nm: 'Rotor' });
OBJ('sailboat', 'Sailboat', 'car', 'D', { al: ['sailboat', 'schooner', 'yawl', 'catamaran', 'trimaran', 'boat', 'canoe', 'kayak', 'speedboat'], nm: 'Sailor' });
OBJ('skateboard', 'Skateboard', 'ball', 'D', { al: ['skateboard'], nm: 'Grind' });

/* ===== furniture ===== */
OBJ('office_chair', 'Office chair', 'chair', 'D', { h: 220, s: 10, l: 25, al: ['office chair', 'desk chair', 'swivel chair', 'computer chair', 'gaming chair'], nm: 'Swivel', sig: { name: 'Spin Cycle', power: 0.5, hits: 3 } });
OBJ('dining_chair', 'Dining chair', 'chair', L('chair'), { al: ['chair', 'dining chair', 'wooden chair', 'kitchen chair'], nm: 'Perch' });
OBJ('folding_chair', 'Folding chair', 'chair', V('seat', { back: 'low', slats: true, w: 14 }), { al: ['folding chair', 'deck chair', 'camping chair'], nm: 'Flip' });
OBJ('armchair', 'Armchair', 'sofa', V('seat', { back: 'round', arms: true, cushion: true, w: 20, tufts: true }), { al: ['armchair', 'recliner', 'wingback chair', 'easy chair'], nm: 'Lounger' });
OBJ('rocking_chair', 'Rocking chair', 'chair', V('seat', { back: 'tall', base: 'rocker', slats: true }), { h: 28, al: ['rocking chair', 'rocker'], nm: 'Rocky' });
OBJ('stool', 'Stool', 'chair', V('seat', { back: 'none', base: 'stool', w: 14, seatY: 15 }), { al: ['stool', 'bar stool', 'footstool'], nm: 'Stoolie' });
OBJ('barber_chair', 'Barber chair', 'chair', V('seat', { back: 'tall', base: 'pedestal', arms: true, cushion: true }), { h: 0, al: ['barber chair', 'dentist chair'], nm: 'Snipper' });
OBJ('throne', 'Throne', 'chair', V('seat', { back: 'tall', arms: true, cushion: true, w: 20 }), { h: 45, s: 70, l: 50, al: ['throne'], nm: 'Regal' });
OBJ('bench', 'Bench', 'chair', V('seat', { back: 'low', slats: true, w: 32 }), { h: 28, al: ['bench', 'park bench'], nm: 'Benchy' });
OBJ('wheelchair', 'Wheelchair', 'chair', V('seat', { back: 'low', base: 'legs', wheelchair: true, w: 16 }), { al: ['wheelchair'], nm: 'Roll' });
OBJ('high_chair', 'High chair', 'chair', V('seat', { back: 'tall', base: 'stool', w: 12, seatY: 18, arms: true }), { al: ['high chair', 'highchair'], nm: 'Highbaby' });
OBJ('sofa', 'Sofa', 'sofa', L('sofa'), { al: ['sofa', 'couch', 'studio couch', 'settee', 'loveseat', 'futon', 'day bed'], nm: 'Couch' });
OBJ('bean_bag', 'Bean bag', 'pillow', V('produce', { shape: 'oval' }), { al: ['bean bag', 'beanbag chair'], nm: 'Squish' });
OBJ('dining_table', 'Dining table', 'chair', L('chair', 'table'), { al: ['dining table', 'table', 'kitchen table'], nm: 'Tabla' });
OBJ('desk', 'Desk', 'chair', V('table', { w: 32, drawer: true, items: true }), { h: 28, al: ['desk', 'writing desk', 'office desk', 'computer desk'], nm: 'Desky' });
OBJ('coffee_table', 'Coffee table', 'chair', V('table', { w: 32, ty: 22, thick: 3 }), { h: 28, al: ['coffee table', 'side table', 'end table'], nm: 'Lowtop' });
OBJ('picnic_table', 'Picnic table', 'chair', V('table', { legs: 'trestle', w: 34 }), { h: 28, al: ['picnic table'], nm: 'Picnik' });
OBJ('pool_table', 'Pool table', 'chair', V('table', { w: 36, thick: 4, felt: true }), { h: 125, al: ['pool table', 'billiard table', 'snooker table'], nm: 'Cue' });
OBJ('ping_pong_table', 'Ping-pong table', 'ball', V('table', { w: 36, net: true }), { h: 210, al: ['ping-pong table', 'table tennis table'], nm: 'Pingo' });
OBJ('wardrobe', 'Wardrobe', 'chair', V('storage', { w: 26, h: 32, doors: 2, top: true }), { h: 28, al: ['wardrobe', 'closet', 'armoire'], nm: 'Narnia' });
OBJ('bookshelf', 'Bookshelf', 'book', V('storage', { w: 24, h: 32, shelves: 4 }), { h: 28, al: ['bookcase', 'bookshelf', 'shelf', 'shelving'], nm: 'Shelfy' });
OBJ('dresser', 'Chest of drawers', 'chair', V('storage', { w: 26, h: 22, drawers: 3, top: true, feet: true }), { h: 28, al: ['chest of drawers', 'dresser', 'chiffonier', 'drawers'], nm: 'Drawr' });
OBJ('nightstand', 'Nightstand', 'chair', V('storage', { w: 16, h: 16, drawers: 2, feet: true }), { h: 28, al: ['nightstand', 'bedside table'], nm: 'Nighty' });
OBJ('cabinet', 'Cabinet', 'chair', V('storage', { w: 24, h: 26, doors: 2, top: true }), { al: ['cabinet', 'cupboard', 'china cabinet', 'medicine chest', 'sideboard'], nm: 'Cabby' });
OBJ('filing_cabinet', 'Filing cabinet', 'chair', V('storage', { w: 16, h: 30, drawers: 4 }), { h: 210, s: 8, l: 60, al: ['filing cabinet', 'file cabinet'], nm: 'Filer' });
OBJ('locker', 'Locker', 'chair', V('storage', { w: 14, h: 32, doors: 1, vents: true }), { h: 210, s: 30, al: ['locker'], nm: 'Lockr' });
OBJ('safe', 'Safe', 'chair', V('storage', { w: 22, h: 22, dial: true, feet: true }), { h: 220, s: 10, l: 30, al: ['safe', 'vault door'], nm: 'Vaulty' });
OBJ('treasure_chest', 'Chest', 'bag', V('storage', { w: 28, h: 18, lid: true }), { h: 28, al: ['chest', 'treasure chest', 'trunk', 'toy box'], nm: 'Lootle' });
OBJ('crate', 'Crate', 'bag', V('storage', { w: 26, h: 22, shelves: 0 }), { h: 30, al: ['crate', 'wooden box', 'pallet'], nm: 'Cratey' });
OBJ('bed', 'Bed', 'pillow', V('bed', {}), { al: ['bed', 'double bed', 'quilt', 'mattress', 'duvet'], nm: 'Snooze' });
OBJ('four_poster', 'Four-poster bed', 'pillow', V('bed', { posts: true, canopy: true }), { al: ['four-poster', 'canopy bed'], nm: 'Canopy' });
OBJ('bunk_bed', 'Bunk bed', 'pillow', V('bed', { bunk: true }), { al: ['bunk bed', 'bunkbed'], nm: 'Bunkie' });
OBJ('crib', 'Crib', 'pillow', V('table', { w: 30, ty: 22, bars: true }), { al: ['crib', 'cradle', 'bassinet', 'cot'], nm: 'Lullabye' });
OBJ('pillow', 'Pillow', 'pillow', L('pillow'), { al: ['pillow', 'cushion', 'throw pillow'], nm: 'Fluff' });
OBJ('sleeping_bag', 'Sleeping bag', 'pillow', V('produce', { shape: 'long', ridges: true }), { al: ['sleeping bag'], nm: 'Cocoon' });

/* ===== kitchen & appliances ===== */
OBJ('fridge', 'Refrigerator', 'fridge', L('fridge'), { al: ['refrigerator', 'fridge', 'freezer', 'icebox'], nm: 'Frosty' });
OBJ('microwave', 'Microwave', 'fridge', V('appliance', { w: 30, h: 18, door: 'glass', panel: 'screen' }), { h: 220, s: 6, l: 80, al: ['microwave', 'microwave oven'], nm: 'Zapper', sig: { name: 'Radiation Spin', power: 1.0, effect: 'burn', chance: 0.6 } });
OBJ('oven', 'Oven', 'fridge', V('appliance', { w: 26, h: 26, door: 'front', window: true, panel: 'dial', burners: true }), { h: 220, s: 6, l: 80, al: ['oven', 'stove', 'cooker', 'range', 'gas stove'], nm: 'Baker' });
OBJ('washing_machine', 'Washing machine', 'fridge', V('appliance', { w: 26, h: 28, door: 'round', panel: 'dial' }), { h: 220, s: 4, l: 92, al: ['washer', 'washing machine', 'laundry machine', 'dryer', 'tumble dryer'], nm: 'Spinny', sig: { name: 'Spin Cycle', power: 0.45, hits: 3 } });
OBJ('dishwasher', 'Dishwasher', 'fridge', V('appliance', { w: 24, h: 26, door: 'front', panel: 'buttons' }), { h: 220, s: 6, l: 80, al: ['dishwasher'], nm: 'Scrubba' });
OBJ('toaster', 'Toaster', 'fridge', V('appliance', { w: 22, h: 14, topSlots: true, toast: true, lever: true }), { h: 220, s: 8, l: 75, al: ['toaster'], nm: 'Toasty', sig: { name: 'Pop-Up Burn', power: 1.0, effect: 'burn', chance: 0.55 } });
OBJ('air_conditioner', 'Air conditioner', 'fridge', V('appliance', { w: 32, h: 12, vents: true, feet: false }), { h: 200, s: 6, l: 90, al: ['air conditioner', 'ac unit', 'heat pump'], nm: 'Chillz' });
OBJ('radiator', 'Radiator', 'fridge', V('appliance', { w: 30, h: 18, fins: true }), { h: 0, s: 0, l: 90, al: ['radiator', 'space heater', 'heater'], nm: 'Warmth' });
OBJ('vending_machine', 'Vending machine', 'fridge', V('appliance', { w: 24, h: 32, door: 'glass', panel: 'buttons', spoutBox: true }), { h: 0, al: ['vending machine', 'soda machine'], nm: 'Vendo' });
OBJ('water_cooler', 'Water dispenser', 'fridge', V('vessel', { prof: [[18, 7], [3, 3], [10, 6]], rigid: true }), { h: 200, al: ['water cooler', 'water dispenser'], nm: 'Glug' });
OBJ('printer', 'Printer', 'laptop', V('appliance', { w: 30, h: 14, panel: 'buttons', topSlots: true }), { h: 220, s: 5, l: 85, al: ['printer', 'photocopier', 'copier', 'scanner'], nm: 'Inky' });
OBJ('kettle', 'Kettle', 'mug', 'D', { al: ['kettle', 'electric kettle'], nm: 'Boily' });
OBJ('teapot', 'Teapot', 'mug', L('mug', 'teapot'), { al: ['teapot', 'coffeepot', 'tea kettle'], nm: 'Spouty' });
OBJ('blender', 'Blender', 'fridge', 'D', { al: ['blender', 'food processor', 'smoothie maker', 'mixer'], nm: 'Whirl', sig: { name: 'Puree', power: 0.45, hits: 3 } });
OBJ('coffee_machine', 'Coffee machine', 'fridge', 'D', { h: 0, s: 5, l: 25, al: ['espresso maker', 'coffee machine', 'coffee maker'], nm: 'Barista' });
OBJ('rice_cooker', 'Rice cooker', 'pot', V('vessel', { prof: [[14, 11], [3, 10]], lid: true, rigid: true }), { h: 0, s: 0, l: 92, al: ['rice cooker', 'crock pot', 'slow cooker', 'pressure cooker'], nm: 'Ricey' });
OBJ('waffle_iron', 'Waffle iron', 'fridge', V('appliance', { w: 24, h: 10, panel: 'none' }), { al: ['waffle iron', 'sandwich maker'], nm: 'Gridz' });
OBJ('vacuum', 'Vacuum cleaner', 'fridge', 'D', { h: 0, al: ['vacuum', 'vacuum cleaner', 'hoover'], nm: 'Suckle', sig: { name: 'Big Suck', power: 0.9, effect: 'drain' } });
OBJ('fan', 'Electric fan', 'fridge', 'D', { h: 200, s: 10, l: 85, al: ['electric fan', 'fan', 'desk fan', 'ceiling fan'], nm: 'Breezy', sig: { name: 'Gale Force', power: 0.8, effect: 'stun', chance: 0.35 } });
OBJ('hair_dryer', 'Hair dryer', 'fridge', 'D', { al: ['hand blower', 'hair dryer', 'hair drier', 'blow dryer'], nm: 'Blowy' });
OBJ('iron', 'Clothes iron', 'fridge', 'D', { al: ['iron', 'clothes iron', 'steam iron'], nm: 'Pressy' });
OBJ('sewing_machine', 'Sewing machine', 'tool', 'D', { al: ['sewing machine'], nm: 'Stitch' });
OBJ('pot', 'Cooking pot', 'pot', L('pot'), { al: ['dutch oven', 'caldron', 'cauldron', 'pot', 'saucepan', 'stockpot', 'hot pot'], nm: 'Simmer' });
OBJ('frying_pan', 'Frying pan', 'pot', L('pot', 'pan'), { al: ['frying pan', 'skillet', 'wok', 'pan'], nm: 'Skillet' });
OBJ('bowl', 'Bowl', 'pot', L('pot', 'bowl'), { al: ['bowl', 'mixing bowl', 'soup bowl', 'cereal bowl'], nm: 'Bowly' });
OBJ('plate', 'Plate', 'pot', V('produce', { shape: 'long' }), { s: 0, l: 95, al: ['plate', 'dish', 'tray', 'saucer', 'platter'], nm: 'Platey' });
OBJ('mug', 'Coffee mug', 'mug', L('mug'), { al: ['coffee mug', 'mug', 'cup', 'teacup', 'tea cup'], nm: 'Mug' });
OBJ('glass', 'Drinking glass', 'mug', L('mug', 'glass'), { al: ['glass', 'drinking glass', 'beer glass', 'wine glass', 'goblet', 'tumbler', 'red wine', 'cocktail', 'measuring cup', 'eggnog'], nm: 'Glassy' });
OBJ('coffee_cup', 'Takeaway coffee', 'mug', 'D', { h: 30, s: 30, l: 80, al: ['paper cup', 'coffee cup', 'takeaway cup', 'disposable cup', 'espresso'], nm: 'Latte' });
OBJ('bottle', 'Bottle', 'bottle', L('bottle'), { al: ['bottle', 'water bottle', 'pop bottle', 'plastic bottle', 'soda bottle'], nm: 'Fizz' });
OBJ('wine_bottle', 'Wine bottle', 'bottle', V('vessel', { prof: [[18, 6], [3, 5], [8, 2]], label: true, cap: 2 }), { h: 130, s: 40, l: 22, al: ['wine bottle', 'beer bottle', 'champagne bottle'], nm: 'Vino' });
OBJ('jar', 'Jar', 'bottle', V('vessel', { prof: [[18, 8], [2, 6]], label: true, cap: 7 }), { al: ['jar', 'mason jar', 'jam jar'], nm: 'Jarvis' });
OBJ('can', 'Drink can', 'bottle', L('bottle', 'can'), { al: ['can', 'soda can', 'tin can', 'milk can', 'barrel', 'rain barrel'], nm: 'Canny' });
OBJ('vase', 'Vase', 'bottle', L('bottle', 'vase'), { al: ['vase', 'urn', 'amphora'], nm: 'Vasey' });
OBJ('pitcher', 'Jug', 'mug', V('vessel', { prof: [[16, 8], [6, 6]], handle: true, spout: 4 }), { al: ['pitcher', 'water jug', 'whiskey jug', 'jug', 'milk jug'], nm: 'Juggs' });
OBJ('thermos', 'Thermos', 'bottle', V('vessel', { prof: [[24, 6], [4, 5]], cap: 5 }), { h: 220, s: 10, l: 55, al: ['thermos', 'flask', 'vacuum flask', 'travel mug'], nm: 'Thermy' });
OBJ('spray_bottle', 'Spray bottle', 'bottle', V('vessel', { prof: [[16, 7], [4, 3]], nozzle: true }), { al: ['spray bottle', 'hair spray', 'perfume', 'deodorant', 'soap dispenser', 'lotion', 'sunscreen'], nm: 'Spritz' });
OBJ('milk_carton', 'Milk carton', 'food', V('vessel', { prof: [[22, 7]], gable: true }), { s: 5, l: 95, al: ['carton', 'milk carton', 'juice carton', 'juice box'], nm: 'Moo' });
OBJ('salt_shaker', 'Salt shaker', 'bottle', V('vessel', { prof: [[14, 5], [4, 4]], cap: 4 }), { s: 0, l: 95, al: ['saltshaker', 'salt shaker', 'pepper shaker', 'pepper mill'], nm: 'Salty' });
OBJ('bucket', 'Bucket', 'faucet', V('vessel', { prof: [[14, 9], [2, 10]], handle: true, rim: true }), { al: ['bucket', 'pail'], nm: 'Pail' });
OBJ('watering_can', 'Watering can', 'faucet', 'D', { h: 120, al: ['watering can'], nm: 'Sprinkle' });
OBJ('cutlery_spoon', 'Spoon', 'tool', V('handtool', { head: 'spoon', metalHandle: true }), { s: 0, l: 80, al: ['spoon', 'wooden spoon', 'teaspoon', 'ladle'], nm: 'Spoony' });
OBJ('cutlery_fork', 'Fork', 'tool', V('handtool', { head: 'fork', metalHandle: true }), { s: 0, l: 80, al: ['fork'], nm: 'Forky' });
OBJ('knife', 'Knife', 'tool', V('handtool', { head: 'knife' }), { al: ['knife', 'cleaver', 'letter opener', 'kitchen knife', 'butter knife'], nm: 'Stabby' });
OBJ('spatula', 'Spatula', 'tool', V('handtool', { head: 'spatula' }), { al: ['spatula', 'turner'], nm: 'Flippo' });
OBJ('whisk', 'Whisk', 'tool', V('handtool', { head: 'whisk' }), { al: ['whisk', 'eggbeater'], nm: 'Whisky' });
OBJ('toilet', 'Toilet', 'toilet', L('toilet'), { al: ['toilet', 'toilet seat', 'loo', 'commode', 'urinal'], nm: 'Flush' });
OBJ('toilet_paper', 'Toilet paper', 'toilet', V('vessel', { prof: [[16, 8]], rim: true }), { s: 0, l: 95, al: ['toilet tissue', 'toilet paper', 'toilet roll', 'paper towel'], nm: 'Rolly' });
OBJ('sink', 'Sink / tap', 'faucet', L('faucet'), { al: ['sink', 'washbasin', 'faucet', 'tap', 'kitchen sink'], nm: 'Drip' });
OBJ('bathtub', 'Bathtub', 'faucet', V('table', { w: 34, ty: 17, thick: 10, apron: false }), { s: 5, l: 95, al: ['bathtub', 'tub', 'bath'], nm: 'Soaky' });

/* ===== electronics & office ===== */
OBJ('laptop', 'Laptop', 'laptop', L('laptop'), { al: ['laptop', 'notebook', 'notebook computer', 'macbook'], nm: 'Lappy' });
OBJ('desktop_pc', 'Desktop computer', 'laptop', V('device', { w: 22, h: 15, screen: 'full', stand: 'base', tower: true }), { h: 220, s: 6, l: 30, al: ['desktop computer', 'computer', 'pc', 'imac'], nm: 'Towerz' });
OBJ('monitor', 'Monitor', 'tv', V('device', { w: 28, h: 18, screen: 'full', stand: 'base' }), { h: 220, s: 6, l: 20, al: ['monitor', 'computer monitor', 'display', 'screen'], nm: 'Pixel' });
OBJ('tv', 'Television', 'tv', L('tv'), { al: ['television', 'tv', 'tv set', 'crt television'], nm: 'Telly' });
OBJ('flat_tv', 'Flat-screen TV', 'tv', V('device', { w: 34, h: 20, screen: 'full', stand: 'legs' }), { h: 220, s: 6, l: 15, al: ['flat-screen tv', 'smart tv', 'flat screen television', 'home theater', 'entertainment center'], nm: 'Flatty' });
OBJ('phone', 'Smartphone', 'phone', L('phone'), { al: ['cellular telephone', 'smartphone', 'phone', 'mobile phone', 'cell phone', 'iphone'], nm: 'Swipe' });
OBJ('tablet', 'Tablet', 'phone', V('device', { w: 22, h: 28, screen: 'full', y0: 4 }), { h: 220, s: 6, l: 20, al: ['tablet', 'ipad', 'e-reader', 'kindle', 'hand-held computer'], nm: 'Slate' });
OBJ('dial_phone', 'Telephone', 'phone', V('device', { w: 24, h: 14, buttons: true, round: true }), { h: 0, al: ['dial telephone', 'telephone', 'landline phone', 'pay-phone', 'rotary phone'], nm: 'Ringo' });
OBJ('keyboard', 'Keyboard', 'laptop', V('device', { w: 34, h: 9, keys: true, y0: 20 }), { h: 220, s: 5, l: 25, al: ['computer keyboard', 'keyboard', 'typewriter keyboard', 'space bar'], nm: 'Clacky' });
OBJ('mouse', 'Computer mouse', 'phone', V('produce', { shape: 'tall', ridges: false }), { h: 220, s: 5, l: 25, al: ['mouse', 'computer mouse'], nm: 'Clicky' });
OBJ('remote', 'Remote control', 'phone', V('device', { w: 10, h: 28, buttons: true, y0: 5 }), { h: 220, s: 5, l: 20, al: ['remote control', 'remote', 'tv remote'], nm: 'Zappy' });
OBJ('calculator', 'Calculator', 'laptop', V('device', { w: 20, h: 28, screen: 'small', keys: true, y0: 5 }), { h: 220, s: 5, l: 30, al: ['calculator', 'abacus', 'slide rule'], nm: 'Mathy' });
OBJ('game_console', 'Game console', 'tv', V('device', { w: 30, h: 10, light: true, y0: 22 }), { h: 220, s: 5, l: 15, al: ['game console', 'playstation', 'xbox', 'console'], nm: 'Consol' });
OBJ('handheld_console', 'Handheld console', 'toy', V('device', { w: 30, h: 16, screen: 'small', dpad: true }), { al: ['handheld console', 'nintendo switch', 'game boy', 'handheld game console'], nm: 'Gamey' });
OBJ('game_controller', 'Game controller', 'toy', 'D', { h: 220, s: 5, l: 25, al: ['joystick', 'game controller', 'gamepad', 'controller'], nm: 'Pad' });
OBJ('headphones', 'Headphones', 'keys', 'D', { h: 220, s: 5, l: 20, al: ['headphones', 'headset', 'earphones', 'earbuds'], nm: 'Boomz' });
OBJ('speaker', 'Speaker', 'tv', L('tv', 'speaker'), { al: ['loudspeaker', 'speaker', 'subwoofer', 'smart speaker', 'bluetooth speaker'], nm: 'Boomer' });
OBJ('radio', 'Radio', 'tv', V('device', { w: 30, h: 18, speaker: true, antennas: 1, buttons: true }), { h: 28, al: ['radio', 'cassette player', 'tape player', 'cd player', 'boombox', 'stereo'], nm: 'Staticy' });
OBJ('camera', 'Camera', 'tv', L('tv', 'camera'), { al: ['reflex camera', 'camera', 'polaroid camera', 'digital camera', 'webcam', 'camcorder'], nm: 'Flashy' });
OBJ('projector', 'Projector', 'tv', V('device', { w: 26, h: 12, lens: true, y0: 18 }), { s: 5, l: 85, al: ['projector'], nm: 'Beamer' });
OBJ('router', 'Wi-Fi router', 'laptop', V('device', { w: 28, h: 8, antennas: 3, light: true, y0: 24 }), { s: 5, l: 20, al: ['modem', 'router', 'wifi router'], nm: 'Wifey' });
OBJ('microphone', 'Microphone', 'instrument', 'D', { al: ['microphone', 'mic'], nm: 'Mikey' });
OBJ('typewriter', 'Typewriter', 'laptop', 'D', { h: 120, s: 20, l: 30, al: ['typewriter'], nm: 'Typo' });
OBJ('smartwatch', 'Watch', 'clock', 'D', { al: ['digital watch', 'wristwatch', 'watch', 'smartwatch'], nm: 'Ticky' });
OBJ('clock', 'Alarm clock', 'clock', L('clock'), { al: ['analog clock', 'alarm clock', 'clock', 'digital clock'], nm: 'Tock' });
OBJ('wall_clock', 'Wall clock', 'clock', null, { s: 5, l: 92, al: ['wall clock'], nm: 'Pendu' });
OBJ('hourglass', 'Hourglass', 'clock', V('vessel', { prof: [[8, 8], [4, 2], [8, 8]], rim: true }), { h: 45, al: ['hourglass', 'sand timer', 'sundial'], nm: 'Sandy' });
OBJ('lamp', 'Table lamp', 'lamp', L('lamp'), { al: ['table lamp', 'lamp', 'lampshade', 'desk lamp', 'floor lamp', 'reading lamp'], nm: 'Lumen' });
OBJ('lightbulb', 'Light bulb', 'lamp', 'D', { h: 50, s: 90, l: 70, al: ['light bulb', 'lightbulb', 'bulb', 'spotlight'], nm: 'Bulby' });
OBJ('lantern', 'Lantern', 'lamp', 'D', { al: ['lantern', 'torch', 'flashlight', 'oil lamp'], nm: 'Glowy' });
OBJ('candle', 'Candle', 'candle', L('candle'), { al: ['candle', 'tea light'], nm: 'Wick' });
OBJ('book', 'Book', 'book', L('book'), { al: ['book jacket', 'book', 'comic book', 'notebook paper', 'novel', 'textbook', 'binder', 'menu'], nm: 'Tome' });
OBJ('envelope', 'Envelope', 'book', V('storage', { w: 30, h: 18 }), { s: 10, l: 92, al: ['envelope', 'letter', 'postcard'], nm: 'Letta' });
OBJ('newspaper', 'Newspaper', 'book', V('storage', { w: 26, h: 30, shelves: 0 }), { s: 0, l: 88, al: ['newspaper', 'magazine', 'crossword puzzle'], nm: 'Newsie' });
OBJ('pen', 'Pen', 'keys', V('handtool', { head: 'pen' }), { al: ['ballpoint', 'pen', 'fountain pen', 'quill', 'marker', 'pencil', 'crayon'], nm: 'Scribbl' });
OBJ('stapler', 'Stapler', 'tool', V('device', { w: 30, h: 8, y0: 22 }), { h: 0, al: ['stapler', 'hole punch'], nm: 'Staply' });
OBJ('scissors', 'Scissors', 'tool', V('handtool', { head: 'scissors' }), { al: ['scissors', 'shears'], nm: 'Snippy', sig: { name: 'Snip Snip', power: 0.5, hits: 3 } });
OBJ('tape_measure', 'Tape measure', 'tool', V('handtool', { head: 'tape' }), { h: 50, al: ['tape measure', 'measuring tape', 'rule', 'ruler', 'duct tape', 'tape'], nm: 'Measur' });
OBJ('mailbox', 'Mailbox', 'bag', 'D', { h: 210, al: ['mailbox', 'letter box', 'postbox'], nm: 'Posty' });

/* ===== tools & outdoor ===== */
OBJ('toolbox', 'Toolbox', 'tool', L('tool'), { al: ['toolbox', "carpenter's kit", 'tool kit', 'tool box'], nm: 'Wrench' });
OBJ('hammer', 'Hammer', 'tool', V('handtool', { head: 'hammer' }), { al: ['hammer', 'mallet', 'sledgehammer'], nm: 'Bonk', sig: { name: 'Nail Driver', power: 1.4, effect: 'stun', chance: 0.25 } });
OBJ('axe', 'Axe', 'tool', V('handtool', { head: 'axe' }), { al: ['hatchet', 'axe', 'ax'], nm: 'Chopper' });
OBJ('wrench', 'Wrench', 'tool', V('handtool', { head: 'wrench' }), { al: ['wrench', 'spanner', 'monkey wrench'], nm: 'Twisty' });
OBJ('screwdriver', 'Screwdriver', 'tool', V('handtool', { head: 'screwdriver' }), { al: ['screwdriver'], nm: 'Screwy' });
OBJ('saw', 'Saw', 'tool', V('handtool', { head: 'saw' }), { al: ['saw', 'handsaw', 'hacksaw', 'chain saw', 'chainsaw'], nm: 'Teethy' });
OBJ('power_drill', 'Power drill', 'tool', V('handtool', { head: 'drill' }), { h: 50, al: ['power drill', 'drill', 'electric drill'], nm: 'Drilly', sig: { name: 'Bore Through', power: 1.2, effect: 'defdown', chance: 0.5 } });
OBJ('pliers', 'Pliers', 'tool', V('handtool', { head: 'pliers' }), { al: ['pliers', 'wire cutters'], nm: 'Pinchy' });
OBJ('shovel', 'Shovel', 'tool', V('handtool', { head: 'shovel', len: 24 }), { al: ['shovel', 'spade'], nm: 'Scoopy' });
OBJ('rake', 'Rake', 'tool', V('handtool', { head: 'rake', len: 24 }), { al: ['rake', 'pitchfork'], nm: 'Raky' });
OBJ('broom', 'Broom', 'tool', V('handtool', { head: 'broom' }), { al: ['broom', 'besom'], nm: 'Sweepy' });
OBJ('mop', 'Mop', 'tool', V('handtool', { head: 'mop' }), { al: ['mop', 'swab'], nm: 'Moppy' });
OBJ('paintbrush', 'Paintbrush', 'tool', V('handtool', { head: 'brush' }), { al: ['paintbrush', 'paint brush', 'brush', 'hairbrush', 'toothbrush'], nm: 'Brushy' });
OBJ('ladder', 'Ladder', 'tool', 'D', { h: 28, al: ['ladder', 'stepladder'], nm: 'Climby' });
OBJ('wheelbarrow', 'Wheelbarrow', 'tool', 'D', { h: 0, al: ['barrow', 'wheelbarrow', 'handcart'], nm: 'Barrow' });
OBJ('traffic_cone', 'Traffic cone', 'tool', 'D', { h: 22, s: 95, l: 52, al: ['traffic cone', 'cone', 'pylon'], nm: 'Coney' });
OBJ('fire_hydrant', 'Fire hydrant', 'faucet', 'D', { h: 0, al: ['fire hydrant', 'hydrant'], nm: 'Hydra' });
OBJ('trash_can', 'Trash can', 'trash', L('bin'), { al: ['ashcan', 'trash can', 'garbage can', 'bin', 'dustbin', 'wastebasket', 'recycling bin'], nm: 'Binny' });
OBJ('plastic_bag', 'Plastic bag', 'trash', V('produce', { shape: 'tall', top: 'sprout' }), { s: 5, l: 92, al: ['plastic bag', 'shopping bag', 'garbage bag'], nm: 'Baggy' });
OBJ('umbrella', 'Umbrella', 'umbrella', L('umbrella'), { al: ['umbrella', 'parasol', 'parachute'], nm: 'Brolly' });

/* ===== bags, clothes, accessories ===== */
OBJ('backpack', 'Backpack', 'bag', L('bag'), { al: ['backpack', 'rucksack', 'school bag'], nm: 'Packy' });
OBJ('suitcase', 'Suitcase', 'bag', 'D', { al: ['suitcase', 'luggage', 'briefcase', 'trolley bag'], nm: 'Travly' });
OBJ('handbag', 'Handbag', 'bag', 'D', { al: ['purse', 'handbag', 'tote bag', 'mailbag', 'clutch'], nm: 'Pursey' });
OBJ('wallet', 'Wallet', 'bag', V('storage', { w: 26, h: 18, top: true }), { h: 25, al: ['wallet', 'billfold', 'pencil box', 'pencil case'], nm: 'Walley' });
OBJ('basket', 'Basket', 'bag', V('vessel', { prof: [[14, 11], [2, 12]], handle: false, rim: true }), { h: 32, al: ['shopping basket', 'basket', 'hamper', 'laundry basket', 'picnic basket'], nm: 'Weavy' });
OBJ('box', 'Cardboard box', 'bag', V('storage', { w: 28, h: 22, lid: false, top: true }), { h: 32, s: 40, l: 55, al: ['box', 'cardboard box', 'package', 'parcel'], nm: 'Boxie' });
OBJ('shirt', 'T-shirt', 'cloth', L('cloth', 'shirt'), { al: ['jersey', 't-shirt', 'shirt', 'sweatshirt', 'polo shirt', 'blouse', 'cardigan', 'sweater', 'hoodie'], nm: 'Tee' });
OBJ('jacket', 'Jacket', 'cloth', L('cloth', 'shirt'), { al: ['jacket', 'coat', 'trench coat', 'lab coat', 'fur coat', 'suit', 'blazer', 'raincoat'], nm: 'Jackit', vocab: true });
OBJ('dress', 'Dress', 'cloth', V('produce', { shape: 'pear' }), { al: ['dress', 'gown', 'kimono', 'abaya', 'skirt', 'miniskirt', 'overskirt', 'hoopskirt'], nm: 'Frilly' });
OBJ('jeans', 'Jeans', 'cloth', 'D', { h: 220, s: 45, l: 40, al: ['jean', 'jeans', 'pants', 'trousers', 'shorts'], nm: 'Denim' });
OBJ('hat', 'Hat', 'cloth', L('cloth', 'hat'), { al: ['sombrero', 'cowboy hat', 'hat', 'cap', 'baseball cap', 'beanie', 'bonnet', 'top hat'], nm: 'Brimmy' });
OBJ('helmet', 'Helmet', 'cloth', V('produce', { shape: 'oval', top: 'none' }), { al: ['crash helmet', 'football helmet', 'helmet', 'bike helmet', 'hard hat'], nm: 'Helmo' });
OBJ('sock', 'Sock', 'cloth', L('cloth', 'sock'), { al: ['sock', 'christmas stocking', 'mitten', 'glove', 'knee pad'], nm: 'Socky' });
OBJ('scarf', 'Scarf / towel', 'cloth', V('produce', { shape: 'long', stripes: true }), { al: ['stole', 'scarf', 'bath towel', 'towel', 'dishrag', 'handkerchief', 'feather boa', 'blanket'], nm: 'Snuggle' });
OBJ('tie', 'Tie', 'cloth', V('produce', { shape: 'carrot' }), { al: ['windsor tie', 'tie', 'necktie', 'bow tie', 'bolo tie'], nm: 'Knotty' });
OBJ('sneaker', 'Sneaker', 'shoe', L('shoe', 'sneaker'), { al: ['running shoe', 'sneaker', 'shoe', 'trainer', 'loafer', 'clog', 'sandal', 'slipper', 'high heels', 'flip-flop'], nm: 'Sneak' });
OBJ('boot', 'Boot', 'shoe', L('shoe', 'boot'), { al: ['cowboy boot', 'boot', 'rain boot', 'hiking boot', 'wellington boot'], nm: 'Stompy' });
OBJ('glasses', 'Glasses', 'keys', 'D', { al: ['sunglasses', 'sunglass', 'glasses', 'spectacles', 'goggles', 'loupe'], nm: 'Specs' });
OBJ('key', 'Key', 'keys', L('key'), { al: ['key', 'keys', 'keychain', 'car key'], nm: 'Jingle' });
OBJ('padlock', 'Padlock', 'keys', 'D', { h: 45, al: ['padlock', 'combination lock', 'lock'], nm: 'Locksy' });

/* ===== food & drink ===== */
OBJ('banana', 'Banana', 'banana', L('banana'), { al: ['banana', 'bananas', 'plantain'], nm: 'Nana' });
OBJ('apple', 'Apple', 'fruit', L('fruit', 'apple'), { h: 0, al: ['granny smith', 'apple', 'red apple', 'green apple', 'custard apple'], nm: 'Appel' });
OBJ('orange', 'Orange', 'fruit', L('fruit', 'orange'), { h: 30, al: ['orange', 'tangerine', 'mandarin', 'clementine', 'grapefruit'], nm: 'Citro' });
OBJ('lemon', 'Lemon', 'fruit', L('fruit', 'lemon'), { h: 55, al: ['lemon', 'lime'], nm: 'Sourpuss' });
OBJ('strawberry', 'Strawberry', 'fruit', L('fruit', 'strawberry'), { h: 355, al: ['strawberry', 'raspberry'], nm: 'Berri' });
OBJ('pineapple', 'Pineapple', 'fruit', L('fruit', 'pineapple'), { h: 45, al: ['pineapple', 'ananas', 'jackfruit'], nm: 'Pina', sig: { name: 'Spiky Crown', power: 1.0, effect: 'poison', chance: 0.4 } });
OBJ('pear', 'Pear', 'fruit', V('produce', { shape: 'pear', top: 'stem' }), { h: 75, al: ['pear'], nm: 'Pearl' });
OBJ('cherries', 'Cherries', 'fruit', V('produce', { shape: 'pair' }), { h: 350, al: ['cherry', 'cherries'], nm: 'Twinny' });
OBJ('grapes', 'Grapes', 'fruit', V('produce', { shape: 'cluster' }), { h: 285, al: ['grape', 'grapes', 'bunch of grapes'], nm: 'Grapeling' });
OBJ('watermelon', 'Watermelon', 'fruit', 'D', { h: 355, al: ['watermelon', 'melon slice'], nm: 'Melony' });
OBJ('melon', 'Melon', 'fruit', V('produce', { shape: 'oval', ridges: true, top: 'stem' }), { h: 80, al: ['melon', 'cantaloupe', 'honeydew'], nm: 'Cantelo' });
OBJ('coconut', 'Coconut', 'fruit', V('produce', { shape: 'round', top: 'none', dimples: true }), { h: 25, s: 40, l: 30, al: ['coconut'], nm: 'Cocoa' });
OBJ('peach', 'Peach', 'fruit', V('produce', { shape: 'round', top: 'stem' }), { h: 20, al: ['peach', 'apricot', 'nectarine', 'plum', 'fig', 'pomegranate'], nm: 'Peachy' });
OBJ('avocado', 'Avocado', 'fruit', V('produce', { shape: 'pear', flesh: false }), { h: 100, s: 40, l: 30, al: ['avocado'], nm: 'Avo' });
OBJ('tomato', 'Tomato', 'fruit', V('produce', { shape: 'oval', top: 'cap' }), { h: 5, al: ['tomato', 'cherry tomato'], nm: 'Tomatoe' });
OBJ('carrot', 'Carrot', 'fruit', V('produce', { shape: 'carrot', top: 'leafy' }), { h: 25, al: ['carrot', 'carrots'], nm: 'Carrot' });
OBJ('eggplant', 'Eggplant', 'fruit', V('produce', { shape: 'tall', top: 'cap' }), { h: 280, s: 50, l: 30, al: ['eggplant', 'aubergine'], nm: 'Auber' });
OBJ('pepper', 'Bell pepper', 'fruit', V('produce', { shape: 'tall', top: 'stem', ridges: true }), { h: 5, al: ['bell pepper', 'pepper', 'capsicum', 'chili pepper'], nm: 'Peppy' });
OBJ('cucumber', 'Cucumber', 'fruit', V('produce', { shape: 'long', dimples: true }), { h: 110, al: ['cucumber', 'zucchini', 'courgette', 'pickle', 'spaghetti squash'], nm: 'Cuke' });
OBJ('corn', 'Corn', 'fruit', V('produce', { shape: 'carrot', top: 'leafy', seeds: true }), { h: 50, al: ['corn', 'ear', 'corn cob', 'maize'], nm: 'Kernel' });
OBJ('broccoli', 'Broccoli', 'fruit', L('fruit', 'veg'), { h: 110, al: ['broccoli', 'cauliflower', 'head cabbage', 'cabbage', 'lettuce', 'cardoon', 'artichoke'], nm: 'Brocco' });
OBJ('potato', 'Potato', 'fruit', V('produce', { shape: 'oval', dimples: true }), { h: 35, s: 40, l: 55, al: ['potato', 'sweet potato', 'mashed potato'], nm: 'Spud' });
OBJ('onion', 'Onion', 'fruit', V('produce', { shape: 'round', top: 'sprout', ridges: true }), { h: 30, al: ['onion', 'garlic', 'shallot'], nm: 'Weepy' });
OBJ('pumpkin', 'Pumpkin', 'fruit', V('produce', { shape: 'oval', top: 'stem', ridges: true }), { h: 28, al: ['pumpkin', "jack-o'-lantern", 'butternut squash', 'acorn squash', 'squash'], nm: 'Gourdo' });
OBJ('mushroom', 'Mushroom', 'plant', L('plant', 'mushroom'), { h: 0, al: ['mushroom', 'agaric', 'bolete', 'toadstool', 'gyromitra', 'stinkhorn', 'earthstar', 'hen-of-the-woods', 'coral fungus'], nm: 'Shroom' });
OBJ('egg', 'Egg', 'food', 'D', { h: 35, s: 30, l: 90, al: ['egg', 'eggs', 'boiled egg'], nm: 'Eggy' });
OBJ('fried_egg', 'Fried egg', 'food', 'D', { al: ['fried egg', 'sunny side up'], nm: 'Yolky' });
OBJ('burger', 'Burger', 'food', L('burger'), { al: ['cheeseburger', 'hamburger', 'burger', 'sandwich', 'sub', 'meat loaf'], nm: 'Patty' });
OBJ('pizza', 'Pizza', 'food', L('burger', 'pizza'), { al: ['pizza', 'pizza pie', 'pizza slice'], nm: 'Crusty' });
OBJ('hotdog', 'Hot dog', 'food', L('burger', 'hotdog'), { al: ['hotdog', 'hot dog', 'sausage'], nm: 'Weenie' });
OBJ('bread', 'Bread', 'food', L('burger', 'bread'), { al: ['french loaf', 'bread', 'baguette', 'loaf', 'bagel', 'pretzel', 'dough', 'bun'], nm: 'Loafy' });
OBJ('croissant', 'Croissant', 'food', 'D', { h: 35, al: ['croissant'], nm: 'Flaky' });
OBJ('taco', 'Taco', 'food', 'D', { h: 42, al: ['taco', 'burrito', 'wrap', 'quesadilla'], nm: 'Taco' });
OBJ('sushi', 'Sushi', 'food', 'D', { h: 10, al: ['sushi', 'maki', 'nigiri'], nm: 'Rolly' });
OBJ('fries', 'French fries', 'food', 'D', { h: 0, al: ['french fries', 'fries', 'chips'], nm: 'Frizzle' });
OBJ('popcorn', 'Popcorn', 'food', 'D', { h: 0, al: ['popcorn'], nm: 'Poppy' });
OBJ('noodles', 'Noodle bowl', 'pot', L('pot', 'bowl'), { al: ['carbonara', 'ramen', 'noodles', 'spaghetti', 'pasta', 'consomme', 'soup', 'hot pot', 'guacamole', 'salad'], nm: 'Slurp' });
OBJ('cake', 'Cake', 'cake', L('cake'), { al: ['cake', 'birthday cake', 'trifle', 'chocolate sauce', 'cheesecake'], nm: 'Gateau' });
OBJ('donut', 'Donut', 'cake', L('cake', 'donut'), { al: ['donut', 'doughnut'], nm: 'Holey' });
OBJ('ice_cream', 'Ice cream', 'cake', L('cake', 'icecream'), { al: ['ice cream', 'ice lolly', 'popsicle', 'ice cream cone', 'gelato'], nm: 'Scoop' });
OBJ('cupcake', 'Cupcake', 'cake', 'D', { h: 330, al: ['cupcake', 'muffin'], nm: 'Frosty' });
OBJ('cookie', 'Cookie', 'cake', V('produce', { shape: 'round', seeds: 'dark' }), { h: 32, s: 50, l: 55, al: ['cookie', 'biscuit', 'cracker', 'pancake', 'waffle'], nm: 'Crumbs' });
OBJ('chocolate', 'Chocolate bar', 'cake', V('storage', { w: 18, h: 28, drawers: 4 }), { h: 20, s: 45, l: 25, al: ['chocolate', 'chocolate bar', 'candy bar'], nm: 'Choco' });
OBJ('candy', 'Candy', 'cake', V('produce', { shape: 'small', stripes: true }), { h: 330, al: ['candy', 'lollipop', 'sweets', 'gummy bear'], nm: 'Sweety' });

/* ===== plants ===== */
OBJ('potted_plant', 'Potted plant', 'plant', L('plant'), { al: ['pot', 'flowerpot', 'potted plant', 'houseplant', 'plant', 'fern'], nm: 'Fern' });
OBJ('flower', 'Flower', 'plant', L('plant', 'flower'), { al: ['daisy', 'flower', 'yellow lady\'s slipper', 'orchid', 'rapeseed', 'lily', 'bouquet'], nm: 'Petal' });
OBJ('sunflower', 'Sunflower', 'plant', 'D', { h: 45, al: ['sunflower'], nm: 'Solar' });
OBJ('rose', 'Rose', 'plant', 'D', { h: 350, al: ['rose'], nm: 'Thorny' });
OBJ('tulip', 'Tulip', 'plant', 'D', { h: 340, al: ['tulip'], nm: 'Tulipa' });
OBJ('cactus', 'Cactus', 'plant', 'D', { h: 115, al: ['cactus', 'succulent', 'aloe'], nm: 'Prickles', sig: { name: 'Needle Volley', power: 0.45, hits: 3 } });
OBJ('tree', 'Tree', 'tree', L('tree'), { al: ['tree', 'oak', 'pine tree', 'bonsai', 'christmas tree', 'acorn', 'buckeye', 'log'], nm: 'Bark' });
OBJ('palm_tree', 'Palm tree', 'tree', 'D', { h: 115, al: ['palm tree', 'palm'], nm: 'Palmy' });

/* ===== animals ===== */
OBJ('dog', 'Dog', 'animal', L('beast', 'dog'), { al: ['dog', 'puppy'], nm: 'Woof' });
OBJ('cat', 'Cat', 'animal', L('beast'), { al: ['cat', 'kitten', 'tabby', 'tiger cat', 'persian cat', 'siamese cat', 'egyptian cat'], nm: 'Whisk' });
OBJ('rabbit', 'Rabbit', 'animal', L('beast', 'rabbit'), { al: ['rabbit', 'bunny', 'hare', 'wood rabbit', 'angora'], nm: 'Hop' });
OBJ('bear', 'Bear', 'animal', L('beast', 'bear'), { al: ['bear', 'brown bear', 'american black bear', 'ice bear', 'polar bear', 'sloth bear'], nm: 'Grizz' });
OBJ('panda', 'Panda', 'animal', L('beast', 'bear'), { s: 0, l: 92, al: ['giant panda', 'panda'], nm: 'Bamboo' });
OBJ('monkey', 'Monkey', 'animal', L('beast', 'monkey'), { al: ['monkey', 'chimpanzee', 'baboon', 'macaque'], nm: 'Chimp' });
OBJ('hamster', 'Hamster', 'animal', V('quadruped', { body: 'round', ears: 'round', snout: 'flat', tail: 'none' }), { h: 30, al: ['hamster', 'mouse (animal)'], nm: 'Nibbles' });
OBJ('horse', 'Horse', 'animal', V('quadruped', { legs: 'long', neck: 4, ears: 'pointy', snout: 'long', tail: 'tuft', mane: true }), { h: 25, al: ['horse', 'sorrel', 'pony', 'foal'], nm: 'Gallop' });
OBJ('zebra', 'Zebra', 'animal', V('quadruped', { legs: 'long', neck: 3, ears: 'pointy', snout: 'long', tail: 'tuft', pattern: 'stripes' }), { s: 0, l: 95, al: ['zebra'], nm: 'Stripes' });
OBJ('cow', 'Cow', 'animal', V('quadruped', { body: 'long', ears: 'floppy', snout: 'flat', horns: 'small', tail: 'tuft', pattern: 'patches' }), { s: 0, l: 95, al: ['ox', 'cow', 'cattle', 'bull', 'water buffalo', 'bison'], nm: 'Moo' });
OBJ('pig', 'Pig', 'animal', V('quadruped', { body: 'round', ears: 'pointy', snout: 'flat', tail: 'curly' }), { h: 345, s: 60, l: 78, al: ['hog', 'pig', 'piglet', 'wild boar', 'warthog'], nm: 'Oinky' });
OBJ('sheep', 'Sheep', 'animal', V('quadruped', { body: 'round', ears: 'floppy', snout: 'short', mane: true, tail: 'fluffy' }), { s: 0, l: 95, al: ['ram', 'sheep', 'lamb', 'bighorn'], nm: 'Woolly' });
OBJ('goat', 'Goat', 'animal', V('quadruped', { ears: 'floppy', snout: 'long', horns: 'curl', tail: 'thin' }), { h: 30, s: 15, l: 80, al: ['goat', 'ibex'], nm: 'Baa' });
OBJ('deer', 'Deer', 'animal', V('quadruped', { legs: 'long', neck: 3, ears: 'pointy', snout: 'long', horns: 'antler', tail: 'fluffy' }), { h: 28, al: ['deer', 'reindeer', 'moose', 'elk', 'impala', 'gazelle', 'hartebeest'], nm: 'Antler' });
OBJ('camel', 'Camel', 'animal', V('quadruped', { legs: 'long', neck: 5, snout: 'long', hump: true, tail: 'tuft' }), { h: 35, s: 45, l: 60, al: ['arabian camel', 'camel'], nm: 'Humpy' });
OBJ('lion', 'Lion', 'animal', V('quadruped', { ears: 'round', snout: 'short', mane: true, tail: 'tuft' }), { h: 38, al: ['lion'], nm: 'Roary' });
OBJ('tiger', 'Tiger', 'animal', V('quadruped', { ears: 'round', snout: 'short', tail: 'thin', pattern: 'stripes', body: 'long' }), { h: 28, al: ['tiger', 'jaguar', 'leopard', 'cheetah', 'snow leopard', 'cougar', 'lynx'], nm: 'Prowl' });
OBJ('fox', 'Fox', 'animal', V('quadruped', { ears: 'pointy', snout: 'long', tail: 'fluffy', pattern: 'belly' }), { h: 20, al: ['red fox', 'fox', 'kit fox', 'arctic fox', 'grey fox', 'coyote'], nm: 'Foxy' });
OBJ('squirrel', 'Squirrel', 'animal', V('quadruped', { ears: 'pointy', snout: 'short', tail: 'fluffy', body: 'round' }), { h: 22, al: ['fox squirrel', 'squirrel', 'chipmunk', 'marmot', 'beaver'], nm: 'Nutty' });
OBJ('hippo', 'Hippo', 'animal', V('quadruped', { body: 'round', ears: 'round', snout: 'flat' }), { h: 280, s: 15, l: 55, al: ['hippopotamus', 'hippo', 'rhinoceros'], nm: 'Hippo' });
OBJ('elephant', 'Elephant', 'animal', 'D', { h: 220, s: 6, l: 60, al: ['indian elephant', 'african elephant', 'elephant', 'tusker'], nm: 'Trunky', sig: { name: 'Trunk Slam', power: 1.45 } });
OBJ('giraffe', 'Giraffe', 'animal', 'D', { h: 40, al: ['giraffe'], nm: 'Tallneck' });
OBJ('bird', 'Bird', 'bird', L('bird'), { al: ['bird', 'sparrow', 'robin', 'finch', 'pigeon', 'jay', 'magpie', 'goldfinch', 'house finch', 'chickadee'], nm: 'Tweet' });
OBJ('owl', 'Owl', 'bird', L('bird', 'owl'), { h: 28, al: ['owl', 'great grey owl'], nm: 'Hoot' });
OBJ('duck', 'Duck', 'bird', L('bird', 'water'), { al: ['duck', 'drake', 'goose', 'swan', 'black swan', 'red-breasted merganser', 'mallard'], nm: 'Quack' });
OBJ('penguin', 'Penguin', 'bird', 'D', { al: ['king penguin', 'penguin'], nm: 'Waddle' });
OBJ('chicken', 'Chicken', 'bird', L('bird'), { h: 5, s: 10, l: 92, al: ['hen', 'cock', 'chicken', 'rooster'], nm: 'Clucky' });
OBJ('fish', 'Fish', 'fish', L('fish'), { al: ['fish', 'goldfish', 'tench', 'koi', 'clownfish', 'anemone fish', 'puffer', 'lionfish'], nm: 'Gill' });
OBJ('shark', 'Shark', 'fish', L('fish', 'shark'), { h: 210, s: 15, l: 55, al: ['great white shark', 'tiger shark', 'hammerhead', 'shark'], nm: 'Chomp' });
OBJ('jellyfish', 'Jellyfish', 'fish', L('fish', 'jelly'), { h: 300, al: ['jellyfish', 'jelly fish', 'sea anemone'], nm: 'Wobble' });
OBJ('starfish', 'Starfish', 'fish', L('fish', 'star'), { h: 15, al: ['starfish', 'sea star'], nm: 'Stella' });
OBJ('octopus', 'Octopus', 'fish', 'D', { h: 345, al: ['octopus', 'squid'], nm: 'Inky' });
OBJ('beetle', 'Beetle', 'bug', L('bug'), { al: ['beetle', 'ground beetle', 'dung beetle', 'rhinoceros beetle', 'weevil', 'cockroach', 'cricket', 'grasshopper', 'ant'], nm: 'Skitter' });
OBJ('ladybug', 'Ladybug', 'bug', 'D', { h: 0, al: ['ladybug', 'ladybird'], nm: 'Dotty' });
OBJ('bee', 'Bee', 'bug', 'D', { h: 48, al: ['bee', 'bumblebee', 'wasp', 'honeybee'], nm: 'Buzz', sig: { name: 'Sting', power: 0.9, effect: 'poison', chance: 0.65 } });
OBJ('butterfly', 'Butterfly', 'bug', L('bug', 'butterfly'), { al: ['butterfly', 'monarch', 'admiral', 'cabbage butterfly'], nm: 'Flutter' });
OBJ('dragonfly', 'Dragonfly', 'bug', 'D', { h: 190, al: ['dragonfly', 'damselfly'], nm: 'Darter' });
OBJ('spider', 'Spider', 'bug', L('bug', 'spider'), { al: ['spider', 'tarantula', 'black widow', 'garden spider', 'spider web'], nm: 'Webby' });
OBJ('snail', 'Snail', 'bug', L('bug', 'snail'), { al: ['snail', 'conch', 'seashell'], nm: 'Slimy' });
OBJ('crab', 'Crab', 'bug', L('bug', 'crab'), { h: 8, al: ['crab', 'lobster', 'crayfish', 'dungeness crab', 'rock crab', 'king crab', 'shrimp'], nm: 'Pinch' });
OBJ('caterpillar', 'Caterpillar', 'bug', 'D', { h: 100, al: ['caterpillar', 'worm'], nm: 'Crawly' });
OBJ('lizard', 'Lizard', 'reptile', L('reptile'), { al: ['lizard', 'gecko', 'iguana', 'chameleon', 'crocodile', 'alligator', 'komodo dragon'], nm: 'Scaly' });
OBJ('frog', 'Frog', 'reptile', L('reptile', 'frog'), { al: ['frog', 'bullfrog', 'tree frog'], nm: 'Croak' });
OBJ('turtle', 'Turtle', 'reptile', L('reptile', 'turtle'), { al: ['turtle', 'tortoise', 'box turtle', 'terrapin', 'loggerhead'], nm: 'Shelly' });
OBJ('snake', 'Snake', 'reptile', L('reptile', 'snake'), { al: ['snake', 'python', 'cobra', 'boa constrictor', 'viper'], nm: 'Hiss' });

/* ===== toys, sport, music ===== */
OBJ('teddy', 'Teddy bear', 'toy', L('toy'), { al: ['teddy', 'teddy bear', 'stuffed animal', 'plush toy', 'doll'], nm: 'Teddy' });
OBJ('robot_toy', 'Toy robot', 'toy', 'D', { h: 210, s: 10, l: 70, al: ['robot', 'toy robot', 'action figure'], nm: 'Bleep' });
OBJ('rubber_duck', 'Rubber duck', 'toy', 'D', { h: 52, al: ['rubber duck', 'rubber duckie', 'bath toy'], nm: 'Squeak' });
OBJ('kite', 'Kite', 'toy', 'D', { al: ['kite'], nm: 'Soary' });
OBJ('balloon', 'Balloon', 'toy', V('produce', { shape: 'tall', top: 'none' }), { h: 0, al: ['balloon', 'balloons'], nm: 'Floaty' });
OBJ('puzzle', 'Jigsaw puzzle', 'toy', V('storage', { w: 24, h: 20, drawers: 2 }), { al: ['jigsaw puzzle', 'puzzle', 'rubik\'s cube', 'board game', 'playing cards'], nm: 'Piecey' });
OBJ('ball', 'Ball', 'ball', L('ball'), { al: ['ball', 'sports ball', 'baseball', 'golf ball', 'rugby ball', 'croquet ball', 'ping-pong ball', 'puck', 'beach ball', 'frisbee'], nm: 'Bounce' });
OBJ('soccer_ball', 'Football', 'ball', L('ball', 'soccer'), { al: ['soccer ball', 'football', 'volleyball'], nm: 'Kicky' });
OBJ('basketball', 'Basketball', 'ball', L('ball', 'basket'), { h: 25, al: ['basketball'], nm: 'Hoopy' });
OBJ('tennis_ball', 'Tennis ball', 'ball', L('ball', 'tennis'), { h: 70, al: ['tennis ball'], nm: 'Fuzzy' });
OBJ('racket', 'Tennis racket', 'ball', V('handtool', { head: 'racket' }), { al: ['racket', 'tennis racket', 'badminton racket'], nm: 'Swingy' });
OBJ('baseball_bat', 'Baseball bat', 'ball', V('handtool', { head: 'bat' }), { h: 30, al: ['baseball bat', 'bat', 'cricket bat', 'hockey stick'], nm: 'Slugger' });
OBJ('dumbbell', 'Dumbbell', 'tool', 'D', { h: 220, s: 5, l: 20, al: ['dumbbell', 'barbell', 'kettlebell', 'weights'], nm: 'Pumpy' });
OBJ('trophy', 'Trophy', 'keys', 'D', { h: 45, al: ['trophy', 'cup trophy', 'medal'], nm: 'Champ' });
OBJ('guitar', 'Guitar', 'instrument', L('instrument'), { al: ['acoustic guitar', 'electric guitar', 'guitar', 'banjo', 'ukulele', 'cello', 'bass guitar'], nm: 'Strum' });
OBJ('violin', 'Violin', 'instrument', 'D', { h: 22, al: ['violin', 'fiddle', 'viola'], nm: 'Fiddle' });
OBJ('drum', 'Drum', 'instrument', L('instrument', 'drum'), { al: ['drum', 'snare drum', 'drum kit', 'steel drum', 'gong', 'tambourine', 'maraca', 'drumstick'], nm: 'Bongo' });
OBJ('piano', 'Piano', 'instrument', L('instrument', 'piano'), { al: ['grand piano', 'upright', 'piano', 'organ', 'synthesizer', 'electric piano'], nm: 'Keysy' });
OBJ('trumpet', 'Trumpet', 'instrument', L('instrument', 'horn'), { h: 45, al: ['cornet', 'trumpet', 'french horn', 'trombone', 'sax', 'saxophone', 'tuba', 'flute', 'oboe', 'bassoon', 'clarinet', 'harmonica', 'whistle', 'ocarina', 'panpipe'], nm: 'Toot' });
OBJ('harp', 'Harp', 'instrument', 'D', { h: 40, al: ['harp', 'lyre'], nm: 'Lyra' });
OBJ('accordion', 'Accordion', 'instrument', 'D', { h: 0, al: ['accordion', 'concertina'], nm: 'Squeezy' });
OBJ('xylophone', 'Xylophone', 'instrument', 'D', { al: ['xylophone', 'marimba', 'glockenspiel', 'chime'], nm: 'Plinky' });
OBJ('mirror', 'Mirror', 'mirror', L('mirror'), { al: ['mirror', 'hand mirror', 'vanity mirror'], nm: 'Visage' });
OBJ('window', 'Window', 'mirror', V('storage', { w: 24, h: 28, glass: true, doors: 2 }), { al: ['window', 'window screen', 'window shade', 'shoji', 'sliding door', 'door'], nm: 'Panes' });

/* ===== vocabulary-only objects (recognisable by the experimental lens; drawn with the family template) =====
   Format: category: label, label, ...  Each label becomes an object with the 'family' visual tier. */
const VOCAB_EXTRA = {
  tool: 'stapler remover, hole puncher, glue gun, glue stick, soldering iron, multimeter, level tool, chisel, file tool, sandpaper, crowbar, hacksaw blade, utility knife, box cutter, vise, clamp, nail, screw, bolt, nut, washer, hinge, padlock key, extension cord, power strip, flashlight battery, battery, charger, usb cable, cable, rope, chain, bungee cord, garden hose, sprinkler, hedge trimmer, leaf blower, pressure washer, pickaxe, sledge, trowel, paint roller, paint can, caulk gun, tape gun, measuring cup tool, funnel, rolling pin, cheese grater, peeler, can opener, corkscrew, bottle opener, nutcracker, garlic press, potato masher, colander, sieve, strainer, cutting board, chopsticks, tongs, oven mitt, apron, toothpick, safety pin, sewing needle, thimble, pin cushion, knitting needles, yarn, crochet hook, fishing rod, fishing reel, tent, sleeping mat, compass, binocular strap, hiking pole, ice axe, snow shovel, sled, ski, snowboard, surfboard, paddle, oar, life jacket, crutch, cane, walking stick, syringe, stethoscope, thermometer, bandage, first aid kit, pill box, inhaler, hearing aid, magnifying glass, telescope, microscope, test tube, beaker, petri dish, lab flask, globe, map, easel, canvas, palette, paint tube, chalk, chalkboard, whiteboard, eraser, sharpener, ruler tool, protractor, set square, paper clip, binder clip, rubber band, push pin, thumbtack, sticky note, notepad, clipboard, folder, file folder, ring binder, calendar, planner, stamp, ink pad, envelope opener, label maker, shredder, laminator, projector screen, laser pointer, megaphone, walkie talkie, metal detector, smoke detector, fire extinguisher, fire alarm, doorbell, intercom, security camera, light switch, power socket, plug, fuse box, thermostat, ceiling light, chandelier, wall lamp, street lamp, traffic light, parking meter, stop sign, road sign, bollard, manhole, drain cover, gutter, downpipe, shed, fence, gate, garden gnome, birdhouse, bird feeder, flower pot saucer, planter, compost bin, wheelie bin, recycling crate',
  fridge: 'freezer chest, mini fridge, wine cooler, ice maker, water heater, boiler, furnace, dehumidifier, humidifier, air purifier, ceiling fan unit, tower fan, space heater fan, electric heater, oil heater, gas heater, stove top, induction hob, range hood, extractor fan, deep fryer, air fryer, pressure cooker unit, slow cooker unit, bread maker, juicer, food processor unit, hand mixer, stand mixer, popcorn maker, sandwich toaster, grill, barbecue, electric grill, hot plate, kettle grill, smoker, pizza oven, bread toaster oven, dish rack, steam cleaner, carpet cleaner, robot vacuum, floor polisher, clothes dryer rack, ironing board, sewing table, steamer, water filter jug, soda maker, ice cream maker, yogurt maker, egg cooker, milk frother, coffee grinder, spice grinder, scale, kitchen scale, bathroom scale, hair straightener, curling iron, electric razor, shaver, electric toothbrush, massage gun, foot spa, heating pad, electric blanket, sewing machine table, treadmill, exercise bike, rowing machine, elliptical, vending kiosk, arcade machine, jukebox, slot machine, atm machine, ticket machine, photo booth',
  laptop: 'chromebook, netbook, workstation, server, server rack, hard drive, external hard drive, usb stick, flash drive, sd card, memory card, graphics card, motherboard, cpu, ram stick, cd, dvd, floppy disk, cassette tape, vinyl record, record player, turntable, mixing desk, drum machine, synth keyboard, mouse pad, webcam unit, docking station, usb hub, scanner bed, label printer, 3d printer, plotter, e-ink tablet, drawing tablet, stylus, vr headset, smart glasses, drone controller',
  phone: 'pager, flip phone, cordless phone, walkie-talkie handset, satellite phone, phone case, power bank, wireless charger, earpiece, bluetooth earpiece, smart ring, fitness tracker, gps device, car key fob, tv remote unit, garage remote, universal remote, mp3 player, ipod nano, portable radio',
  tv: 'drone, action camera, dashcam, security monitor, baby monitor, set-top box, streaming stick, soundbar, amplifier, receiver, equalizer, tape deck, cd changer, megaphone horn, karaoke machine, projector lamp, film camera, instant camera, camera lens, tripod head, light stand, ring light, studio light, reflector, slide projector, overhead projector, cinema camera, video camera, binoculars stand',
  car: 'limousine, hearse, convertible car, coupe, hatchback car, station wagon car, minicar, smart car, electric car, hybrid car, roadster, muscle car, hot rod, vintage car, classic car, rally car, formula one car, stock car, monster truck, quad bike, atv, buggy, sidecar, rickshaw, tuk tuk, segway, hoverboard, electric skateboard, roller skate, inline skate, pram, stroller, baby carriage, shopping trolley, luggage cart, hand truck, dolly, pallet jack, scissor lift, cherry picker, road roller, steamroller, asphalt paver, grader, backhoe loader, skid steer, wheel loader, dump trailer, flatbed trailer, horse trailer, boat trailer, tractor trailer, semi trailer, car carrier, logging truck, street sweeper, snow plough truck, salt spreader, combine harvester, hay baler, seed drill, plough, cultivator, quad tractor, monorail, cable car, gondola lift, funicular, chairlift, escalator, elevator, rowboat, dinghy, inflatable boat, jet ski, yacht, ferry, tugboat, fishing boat, houseboat, barge, hovercraft, submarine toy, hot air balloon, glider, seaplane, biplane, jet fighter toy, space rocket toy, satellite model, toy car, toy truck, toy train, model train, rc car',
  chair: 'swivel stool, kneeling chair, saddle chair, ottoman, pouffe, footrest, chaise longue, daybed frame, rocking horse, bench seat, church pew, park seat, deckchair, hammock chair, egg chair, papasan chair, director chair, folding stool, step stool, drafting chair, piano bench, vanity stool, bar table, bistro table, console table, card table, nesting tables, drafting table, workbench, sawhorse, kitchen island, kitchen counter, sideboard unit, hutch, credenza, bureau, secretary desk, standing desk, sit-stand desk, shoe rack, coat rack, hat stand, umbrella stand, magazine rack, wine rack, spice rack, towel rail, ladder shelf, cube shelf, room divider, folding screen, headboard, bed frame, futon frame, sofa bed frame',
  pillow: 'mattress topper, duvet cover, bedspread, comforter, throw blanket, electric blanket cover, hot water bottle, pet bed, dog bed, cat bed, hammock, air mattress, camping mattress, yoga mat, exercise mat, cushion cover, neck pillow, body pillow, eye mask, sleep mask',
  bag: 'duffel bag, gym bag, messenger bag, laptop bag, camera bag, fanny pack, bum bag, belt bag, clutch bag, coin purse, makeup bag, toiletry bag, lunch box, lunch bag, cool box, cooler, ice chest, tool bag, diaper bag, grocery bag, paper bag, gift bag, gift box, shoebox, storage box, plastic container, tupperware, bento box, jewelry box, music box, tackle box, first-aid box, sewing box, keepsake box, cigar box, tin box, cash box, ballot box, donation box, letterbox flap, parcel box, delivery box, pizza box, egg carton, cereal box, tissue box, matchbox',
  cloth: 'vest, tank top, crop top, tunic, poncho, cape, cloak, robe, bathrobe, pajamas, nightgown, onesie, overalls, dungarees, jumpsuit, leggings, tights, stockings, socks pair, underwear, swimsuit, bikini, swim trunks, wetsuit, raincoat jacket, puffer jacket, parka, windbreaker, fleece, cardigan sweater, turtleneck, uniform, apron dress, sari, kilt, beret, fedora, bowler hat, sun hat, bucket hat, visor, headband, hair tie, bandana, earmuffs, balaclava, gloves pair, mittens pair, belt, suspenders, bow, ribbon, lanyard, badge, brooch, cufflinks, wig hair, costume, mask costume, crown, tiara',
  shoe: 'high heel, stiletto, pump shoe, ballet flat, moccasin, espadrille, wedge shoe, platform shoe, oxford shoe, brogue, derby shoe, chelsea boot, ankle boot, knee-high boot, snow boot, ski boot, football boot, cleats, spikes shoe, climbing shoe, hiking shoe, slipper shoe, flip flop, croc, clog shoe, mule, sandal pair, roller shoe, ice skate, shoe tree, shoe horn, shoelace',
  keys: 'ring, wedding ring, earring, necklace, bracelet, anklet, pendant, locket, charm bracelet, cufflink, tie clip, hair clip, hairpin, comb, hair brush, makeup brush, lipstick, mascara, eyeliner, nail polish, nail clippers, tweezers, razor, perfume bottle, cologne, compact mirror, lip balm, coin, coins, banknote, credit card, id card, ticket, receipt, keyring, key fob, usb key, sim card, lighter, matches, zippo, cigarette, vape, pipe, harmonica small, whistle small, dice, marble, button, bead, sequin, thimble small, pocket watch, stopwatch, compass small, magnifier, monocle, contact lens case, glasses case',
  food: 'sandwich roll, panini, wrap sandwich, kebab, falafel, shawarma, gyro, burrito bowl, nachos, quesadilla plate, enchilada, tamale, empanada, samosa, spring roll, dumpling, dim sum, bao bun, ramen bowl, pho, curry, rice bowl, fried rice, paella, risotto, lasagna, ravioli, gnocchi, mac and cheese, pizza slice box, calzone, garlic bread, toast, french toast, pancake stack, waffle plate, crepe, omelette, scrambled eggs, bacon, sausage roll, meatball, steak, chicken wing, drumstick chicken, fried chicken, nugget, fish and chips, fish fillet, shrimp plate, lobster dish, oyster, mussel, caviar, cheese, cheese wedge, butter, yogurt, cereal, oatmeal, granola, porridge, soup can, beans, tofu, salad bowl, coleslaw, hummus, dip, salsa, ketchup, mustard, mayonnaise, ketchup bottle, hot sauce, soy sauce, honey, jam, peanut butter, nutella, maple syrup, olive oil, vinegar, salt, sugar, flour, rice, pasta box, noodles packet, spices, tea bag, coffee beans, coffee bag, cocoa, juice, smoothie, milkshake, lemonade, soda, cola, energy drink, beer, wine, cocktail glass drink, water glass, tea, hot chocolate, bubble tea',
  cake: 'brownie, cheesecake slice, tart, pie slice, apple pie, muffin top, scone, macaron, eclair, cream puff, churro, pastry, danish, cinnamon roll, donut box, birthday candle, cake pop, pudding, jelly, jello, custard, mousse, tiramisu, gelato cup, frozen yogurt, sundae, milkshake glass, cotton candy, candy cane, lollipop swirl, gummy, jelly beans, marshmallow, chocolate box, truffle, fudge, toffee, caramel, licorice, chewing gum, mint, candy floss, gingerbread man, sugar cookie, fortune cookie, wafer, biscuit tin',
  fruit: 'mango, papaya, kiwi, passion fruit, dragon fruit, lychee, persimmon, guava, star fruit, durian, blueberry, blackberry, cranberry, gooseberry, currant, date, raisin, prune, apricot fruit, nectarine fruit, plum fruit, olive, fig fruit, quince, pomelo, kumquat, yuzu, radish, beet, turnip, parsnip, celery, asparagus, leek, spring onion, spinach, kale, chard, brussels sprout, bok choy, green bean, pea pod, okra, chili, jalapeno, ginger, ginger root, horseradish, yam, cassava, taro, peanut, walnut, almond, cashew, pistachio, hazelnut, chestnut, pecan, sunflower seeds, pumpkin seeds, sesame, lentils, chickpeas, kidney beans, soybean, edamame, sprouts, herbs, basil, mint leaves, parsley, rosemary, thyme, dill',
  plant: 'bonsai tree plant, orchid plant, peace lily, snake plant, spider plant, monstera, pothos, ficus, rubber plant, money tree, jade plant, aloe vera, venus flytrap, air plant, moss, lichen, ivy, vine, bamboo, reed, grass, clover, dandelion, daffodil, lily flower, lotus, water lily, carnation, peony, hydrangea, lavender, marigold, chrysanthemum, poppy, iris, violet, pansy, petunia, geranium, begonia, hibiscus, jasmine, magnolia, cherry blossom, wildflower, thistle, fern frond, leaf, maple leaf, pine cone, acorn cap, seed pod, flower bouquet, wreath, garland',
  tree: 'oak tree, maple tree, birch tree, willow tree, pine, spruce, fir tree, cedar, cypress, redwood, baobab, olive tree, apple tree, cherry tree, lemon tree, orange tree, banana tree, coconut tree, christmas tree decorated, dead tree, tree stump, log pile, firewood, branch, twig, driftwood, bush, shrub, hedge, topiary, bamboo grove',
  animal: 'puppy dog, kitten cat, ferret, weasel, otter, badger, skunk, raccoon, possum, opossum, hedgehog, porcupine, mole, bat animal, sloth, armadillo, anteater, kangaroo, wallaby, koala bear, platypus, mongoose, meerkat, lemur, gibbon, chimp, gorilla ape, orangutan ape, rhino, buffalo, yak, donkey, mule, llama animal, alpaca animal, reindeer animal, moose animal, antelope, wildebeest, hyena, jackal, dingo, wolf pup, polar bear cub, seal, sea lion, walrus, manatee, dugong, mouse, rat, gerbil, chinchilla, guinea pig pet',
  bird: 'parrot, macaw, cockatoo, budgie, parakeet, canary, crow, raven, blackbird, starling, swallow, hummingbird, woodpecker, kingfisher, toucan, flamingo, pelican, heron, stork, crane bird, seagull, albatross, puffin, peacock, turkey, quail, pheasant, ostrich, emu, eagle, hawk, falcon, vulture, kiwi bird, dodo, chick, duckling, gosling',
  fish: 'goldfish bowl, aquarium, angelfish, guppy, betta fish, tuna, salmon, trout, cod, carp, catfish, eel, swordfish, stingray, manta ray, pufferfish, seahorse, sea turtle, whale shark, orca, narwhal, sea urchin shell, coral, clam, scallop, sea sponge, anemone, nautilus, krill, prawn',
  bug: 'fly, housefly, mosquito, gnat, moth insect, wasp nest, hornet, termite, flea, tick, louse, aphid, cicada, firefly, stick insect, praying mantis, earwig, silverfish, centipede insect, millipede, woodlouse, scorpion arachnid, earthworm, leech, slug creature, tadpole, beetle larva, cocoon, chrysalis, ant hill, beehive, honeycomb, spider egg',
  reptile: 'gecko lizard, bearded dragon, monitor lizard, salamander, newt, axolotl, chameleon lizard, crocodile toy, alligator toy, dinosaur, t-rex, triceratops, dinosaur toy, toad creature, rattlesnake, garter snake, sea snake',
  toy: 'doll house, barbie doll, baby doll, puppet, marionette, ventriloquist dummy, rocking toy, spinning top, yo-yo, slinky, fidget spinner, rubik cube, building blocks, lego brick, lego figure, toy soldier, toy dinosaur, toy gun, water gun, nerf gun, bubble wand, play dough, crayon box, coloring book, sticker, toy kitchen, tea set toy, toy drum, toy piano, xylophone toy, rattle, teether, pacifier, baby bottle, mobile toy, kaleidoscope, magic 8 ball, chess piece, chess board, checkers, domino, playing card, poker chip, game token, trading card, pinata, party hat, party horn, confetti, snow globe, music box toy, wind-up toy, jack in the box, toy robot dog, rc helicopter, toy boat, sand bucket, beach spade, pool float, swim ring',
  ball: 'cricket ball, bowling ball, bowling pin, softball, handball, dodgeball, medicine ball, exercise ball, stress ball, bouncy ball, ball pit ball, shuttlecock, hockey puck, golf club, golf tee, cricket stumps, croquet mallet, polo mallet, lacrosse stick, hurling stick, boxing glove, punching bag, kick pad, jump rope, skipping rope, hula hoop, frisbee disc, boomerang, javelin, discus, shot put, hurdle, starting block, basketball hoop, football goal, tennis net, volleyball net, scoreboard sign, stopwatch sport, whistle sport, medal ribbon, sports bottle, sweatband, shin guard, mouthguard, swim goggles, swim cap, flippers, snorkel mask, ski goggles, ski pole, bicycle helmet, knee pads, elbow pads',
  instrument: 'electric bass, double bass, mandolin, sitar, lute, harmonica instrument, recorder, piccolo, bagpipes, didgeridoo, kazoo, bugle, euphonium, sousaphone, timpani, bongo drums, conga, djembe, cajon, cymbal, hi-hat, cowbell, triangle, castanets, shaker, rain stick, metronome, music stand, sheet music, guitar pick, guitar amp, amplifier speaker, tuning fork, theremin, keytar, melodica, harmonium, music box instrument, wind chime, bell, handbell, church bell, singing bowl',
  bottle: 'bottle cap, cork, wine glass bottle, beer can, spray can, aerosol, paint spray can, gas can, jerry can, oil can, propane tank, gas cylinder, fire extinguisher bottle, vitamin bottle, medicine bottle, shampoo bottle, conditioner, body wash, hand soap, dish soap, detergent bottle, bleach, cleaning spray, glass cleaner, air freshener, candle jar, honey jar, pickle jar, cookie jar, spice jar, sauce bottle, oil bottle, vinegar bottle, syrup bottle, milk bottle, baby food jar, sippy cup, drinking bottle, sports bottle cap, hip flask, decanter, carafe, kombucha bottle, ink bottle, nail polish bottle, essential oil bottle, test tube rack',
  mug: 'espresso cup, tea cup and saucer, travel cup, beer stein, tankard, shot glass, champagne flute, martini glass, wine tumbler, juice glass, milk glass, measuring jug, gravy boat, creamer, sugar bowl, egg cup, soup mug, camping mug, enamel mug, bone china cup, tea set',
  pot: 'saucepan lid, stock pot, casserole dish, baking dish, roasting tin, baking tray, muffin tin, cake tin, pie dish, ramekin, mixing bowl metal, salad bowl wooden, serving bowl, fruit bowl, sugar bowl dish, butter dish, cheese board, serving tray, lazy susan, chafing dish, fondue pot, tagine, paella pan, griddle, crepe pan, steamer basket, colander bowl, mortar and pestle, pestle, salad spinner, dog bowl, cat bowl, pet food bowl',
  faucet: 'shower head, shower, bath tap, garden tap, water fountain, drinking fountain, bidet, plunger tool, toilet brush, soap dish, toothbrush holder, towel rack, bath mat, shower curtain, rubber duckie bath, sponge, loofah, bath bomb, water pump, hose reel, sprinkler head, rain gauge, water tank, rain barrel tank, well, birdbath, fountain pen ink',
  clock: 'grandfather clock, cuckoo clock, kitchen timer, egg timer, metronome clock, sand timer clock, sundial garden, pocket watch chain, stopwatch timer, chess clock, clock radio, digital alarm',
  lamp: 'lava lamp, salt lamp, night light, fairy lights, string lights, neon sign, led strip, torch light, headlamp, flashlight torch, candle holder, candelabra, chandelier light, pendant light, desk light, reading light, floor light, lantern light, oil lantern, paper lantern, glow stick, light bar',
  candle: 'tea light candle, birthday candles, scented candle, pillar candle, incense, incense stick, match, matchstick fire, campfire, bonfire, fireplace, wood stove, fire pit, torch fire, flare, sparkler, firework',
  mirror: 'full-length mirror, bathroom mirror, rear-view mirror, makeup mirror, wall mirror, compact mirror case, picture frame, photo frame, painting, poster, canvas print, wall art, tapestry, stained glass, window pane, skylight, glass door, french door, garage door, front door, doormat, door knocker, doorknob, door handle, keyhole, curtain, blinds, shutter',
  book: 'comic, magazine stack, notebook pad, diary, journal, sketchbook, photo album, scrapbook, atlas, dictionary, encyclopedia, cookbook, bible, manga, picture book, pop-up book, bookmark, book stand, bookend, newspaper stack, brochure, flyer, leaflet, pamphlet, booklet, menu card, greeting card, birthday card, postcard stack, letter paper, paper sheet, paper stack, origami, paper plane, paper crane, cardboard, sign board, placard, banner, flag, calendar page, receipt roll',
  trash: 'trash bag, bin bag, dumpster, skip, litter, rubbish heap, crumpled paper, soda can litter, cigarette butt, compost, recycling box, pedal bin, waste paper basket, sanitary bin, sharps bin, landfill',
  toilet: 'potty, toilet seat cover, portable toilet, porta potty, urinal stall, bidet seat, toilet roll holder, toilet cistern, toilet tank',
  umbrella: 'golf umbrella, beach umbrella, patio umbrella, cocktail umbrella, sunshade, awning, canopy tent, gazebo, parasol stand',
  banana: 'banana bunch, banana peel, banana split, plantain chips',
};

/* ---------- v0.4.3: designs for vocabulary objects ----------
   Before v0.4.3 every vocabulary-only object was drawn with its category's single template, so a light switch or a
   security camera (filed under "tool") became a toolbox with toolbox lore. These rules give each object the closest
   honest design: a composed template with object parameters (V), or the design of a close relative (LIKE). Each rule
   also names a lore group (lore.js) and a name for the signature move; the move keeps its category's numbers, so combat
   balance is unchanged. First matching rule wins. Objects no rule covers get their category's neutral template
   (CAT_FALLBACK_VIS) instead of a specific object's look. Tests (tests/identity.js) check the important cases. */
const LIKE = id => ({ like: id });
const DESIGN_RULES = [
  // electrical fittings
  [/light switch|dimmer/, V('wallplate', { kind: 'rocker' }), 'electric', 'Lights Out', [45, 6, 88]],
  [/power socket|wall socket|outlet/, V('wallplate', { kind: 'socket', wide: true }), 'electric', 'Power Surge', [45, 6, 88]],
  [/thermostat/, V('wallplate', { kind: 'dial' }), 'electric', 'Heatwave Dial', [45, 6, 88]],
  [/fuse box|breaker/, V('wallplate', { kind: 'box', wide: true }), 'electric', 'Blown Fuse', [210, 8, 70]],
  [/doorbell/, V('wallplate', { kind: 'bell' }), 'alarm', 'Ding-Dong Dash', [45, 6, 88]],
  [/intercom/, V('wallplate', { kind: 'grille' }), 'alarm', 'Buzz Me In', [210, 8, 70]],
  [/keypad|alarm panel/, V('wallplate', { kind: 'keypad' }), 'alarm', 'Wrong Code'],
  [/smoke detector|fire alarm|carbon monoxide/, V('wallplate', { kind: 'disc' }), 'alarm', 'Shrill Chirp', [45, 6, 88]],
  [/^plug$|^plug /, V('part', { kind: 'plug' }), 'electric', 'Unplugged'],
  [/extension cord|power strip/, V('part', { kind: 'strip' }), 'electric', 'Overload'],
  [/power bank|battery|batteries/, V('part', { kind: 'battery' }), 'electric', 'Low Battery'],
  [/wireless charger/, V('part', { kind: 'disc' }), 'electric', 'Trickle Charge'],
  [/charger/, V('part', { kind: 'plug' }), 'electric', 'Fast Charge'],
  [/usb cable|cable|cord$/, V('part', { kind: 'coil' }), 'hardware', 'Tangle'],
  [/band aid/, V('part', { kind: 'bandage' }), 'medical', 'Patch Up'],
  [/hard disc/, V('part', { kind: 'chip' }), 'computer', 'Bit Flip'],
  [/^coil$|^knot$|^reel$|spindle/, V('part', { kind: 'coil' }), 'hardware', 'Tangle'],
  [/manhole cover|^shield$/, V('part', { kind: 'disc' }), 'street'],
  [/mountain tent/, V('part', { kind: 'tent' }), 'outdoor', 'Pitch Camp'],
  [/flagpole|^pole$|turnstile|pedestal/, V('pole', { kind: 'post' }), 'street'],
  [/^pick$/, V('handtool', { head: 'pickaxe' }), 'tool'],
  [/hair slide|buckle/, V('part', { kind: 'clip' }), 'jewel'],
  [/pencil sharpener|rubber eraser|face powder|mousetrap|oil filter/, V('part', { kind: 'block' }), 'gadget'],
  [/oscilloscope/, LIKE('monitor'), 'science'],
  [/oxygen mask|snorkel|muzzle/, LIKE('glasses'), 'gadget'],
  // cameras
  [/security camera|cctv/, V('cctv', { kind: 'bullet' }), 'camera', 'Surveillance Glare', [210, 6, 84]],
  [/dome camera/, V('cctv', { kind: 'dome' }), 'camera', 'Surveillance Glare', [210, 6, 84]],
  [/webcam|baby monitor/, V('cctv', { kind: 'webcam' }), 'camera', 'Zoom Call'],
  [/dashcam|action camera/, V('cctv', { kind: 'box' }), 'camera', 'Record Mode'],
  [/camera lens|film camera|instant camera|cinema camera|video camera|camcorder/, LIKE('camera'), 'camera', 'Flash Burst'],
  [/drone controller/, LIKE('game_controller'), 'gadget'],
  [/drone|rc helicopter/, LIKE('helicopter'), 'gadget', 'Rotor Wash'],
  [/security monitor/, LIKE('monitor'), 'camera'],
  // street furniture
  [/street lamp|lamp post|lamppost/, V('pole', { kind: 'lamp' }), 'street', 'Flicker', [210, 12, 32]],
  [/traffic light/, V('pole', { kind: 'lights' }), 'street', 'Red Light', [150, 20, 24]],
  [/parking meter/, V('pole', { kind: 'meter' }), 'street', 'Time Expired', [210, 10, 60]],
  [/stop sign/, V('pole', { kind: 'sign8' }), 'street', 'Full Stop', [0, 78, 46]],
  [/road sign|sign board|scoreboard|placard/, V('pole', { kind: 'signrect' }), 'street', 'Detour'],
  [/bollard/, V('pole', { kind: 'bollard' }), 'street', 'Roadblock', [48, 85, 55]],
  [/coat rack|hat stand/, V('pole', { kind: 'post' }), 'furniture'],
  [/ceiling light|pendant light|wall lamp|chandelier|ring light|studio light|light stand|desk light|reading light|floor light/, LIKE('lamp'), 'light'],
  // boards and art
  [/whiteboard/, V('board', { kind: 'white' }), 'office', 'Marker Squeak'],
  [/chalkboard/, V('board', { kind: 'chalk' }), 'office', 'Nails on Chalk'],
  [/easel/, V('board', { kind: 'easel' }), 'art'],
  [/projector screen/, V('board', { kind: 'screen' }), 'office'],
  [/notice board|cork board|bulletin/, V('board', { kind: 'cork' }), 'office'],
  [/canvas|painting|poster|wall art|picture frame|photo frame|tapestry|stained glass/, V('board', { kind: 'canvas' }), 'art', 'Brushstroke'],
  // office
  [/stapler remover|hole puncher|label maker|tape gun/, LIKE('stapler'), 'office', 'Paper Jam'],
  [/glue gun|caulk gun|nerf gun|water gun|toy gun/, LIKE('power_drill'), 'gadget'],
  [/shredder|laminator/, V('appliance', { w: 24, h: 14, topSlots: true, feet: false }), 'office', 'Paper Jam'],
  [/clipboard|notepad|sticky note|folder|ring binder|planner|calendar|diary|journal|notebook/, LIKE('book'), 'office'],
  [/paper clip|binder clip|safety pin|push pin|thumbtack|hairpin|hair clip|tie clip/, V('part', { kind: 'clip' }), 'office', 'Pinch'],
  [/rubber band|hair tie|hula hoop/, V('part', { kind: 'ring' }), 'office'],
  [/eraser|sharpener|ink pad|^stamp$|pill box|hinge|zippo|lighter|glasses case|contact lens case|sandpaper/, V('part', { kind: 'block' }), 'gadget'],
  [/ruler|protractor|set square|level tool/, V('handtool', { head: 'ruler' }), 'office', 'Measure Twice'],
  [/chalk$|paint tube|glue stick|laser pointer|toothpick|soldering iron|stylus|cigarette|vape|incense stick/, V('handtool', { head: 'pen' }), 'office'],
  [/envelope opener|utility knife|box cutter|peeler/, V('handtool', { head: 'knife' }), 'tool'],
  [/metal detector/, V('handtool', { head: 'detector' }), 'outdoor', 'Treasure Ping'],
  [/megaphone/, LIKE('trumpet'), 'alarm', 'Megaphone Blast'],
  [/walkie|pager|cordless phone|satellite phone|flip phone/, LIKE('phone'), 'gadget'],
  [/multimeter|calculator|gps device|fitness tracker/, LIKE('calculator'), 'gadget'],
  [/globe/, V('part', { kind: 'globe' }), 'science'],
  [/^map$|atlas/, LIKE('newspaper'), 'office'],
  [/compass|pocket watch|stopwatch|kitchen timer|egg timer/, LIKE('clock'), 'gadget'],
  // medical and science
  [/syringe/, V('handtool', { head: 'syringe' }), 'medical', 'Booster Shot'],
  [/stethoscope/, V('part', { kind: 'stetho' }), 'medical', 'Heartbeat Check', [220, 10, 25]],
  [/thermometer|rain gauge/, V('handtool', { head: 'thermo' }), 'medical', 'Fever Spike'],
  [/bandage|plaster/, V('part', { kind: 'bandage' }), 'medical', 'Patch Up'],
  [/first aid|first-aid/, V('part', { kind: 'kit' }), 'medical', 'Emergency Kit', [0, 70, 50]],
  [/inhaler/, V('vessel', { prof: [[10, 5], [7, 3]], nozzle: true, rigid: true }), 'medical'],
  [/hearing aid|earpiece/, LIKE('headphones'), 'gadget'],
  [/crutch|cane|walking stick|hiking pole|ski pole/, V('handtool', { head: 'cane' }), 'outdoor'],
  [/microscope|telescope|binocular|tripod/, V('part', { kind: 'scope' }), 'science', 'Close Look'],
  [/test tube/, V('vessel', { prof: [[22, 3], [2, 4]], rigid: true }), 'science', 'Bubbling Brew'],
  [/beaker|lab flask|petri dish/, V('vessel', { prof: [[12, 9], [8, 5], [4, 4]], liquid: true, rigid: true }), 'science', 'Bubbling Brew'],
  [/magnifying glass|magnifier|monocle/, V('handtool', { head: 'magnifier' }), 'science', 'Close Look'],
  // hardware
  [/^nail$|screw|bolt/, V('part', { kind: 'screw' }), 'hardware', 'Drill Down'],
  [/^nut$|washer/, V('part', { kind: 'nut' }), 'hardware', 'Lock Tight'],
  [/chain/, V('part', { kind: 'chain' }), 'hardware', 'Chain Whip'],
  [/rope|bungee|yarn|garden hose|hose reel|jump rope|skipping rope|string lights|fairy lights|led strip/, V('part', { kind: 'coil' }), 'hardware', 'Tangle'],
  [/vise|clamp/, V('part', { kind: 'clamp' }), 'hardware', 'Vice Grip'],
  [/padlock key|key fob|keyring|usb key|car key/, LIKE('key'), 'gadget'],
  // hand tools (stay with the tool lore)
  [/chisel|file tool/, V('handtool', { head: 'chisel' }), 'tool'],
  [/crowbar/, V('handtool', { head: 'crowbar' }), 'tool'],
  [/hacksaw/, V('handtool', { head: 'saw' }), 'tool'],
  [/pickaxe|ice axe/, V('handtool', { head: 'pickaxe' }), 'tool'],
  [/sledge/, V('handtool', { head: 'hammer' }), 'tool'],
  [/trowel|beach spade/, V('handtool', { head: 'trowel' }), 'tool'],
  [/snow shovel/, V('handtool', { head: 'shovel' }), 'tool'],
  [/paint roller/, V('handtool', { head: 'roller' }), 'tool'],
  [/hedge trimmer|leaf blower|pressure washer/, LIKE('power_drill'), 'tool'],
  [/paint can|oil can/, LIKE('can'), 'tool'],
  // kitchen
  [/rolling pin/, V('handtool', { head: 'rollingpin' }), 'kitchen', 'Flatten'],
  [/cheese grater|grater/, V('part', { kind: 'grater' }), 'kitchen', 'Shred'],
  [/tongs|chopsticks/, V('handtool', { head: 'tongs' }), 'kitchen'],
  [/can opener|corkscrew|bottle opener|nutcracker|garlic press|nail clippers|tweezers/, V('handtool', { head: 'pliers' }), 'kitchen'],
  [/potato masher|spatula/, V('handtool', { head: 'spatula' }), 'kitchen'],
  [/colander|sieve|strainer/, LIKE('bowl'), 'kitchen'],
  [/funnel/, V('vessel', { prof: [[6, 2], [8, 8]], rigid: true }), 'kitchen'],
  [/measuring cup/, V('vessel', { prof: [[12, 7]], handle: true, liquid: true }), 'kitchen'],
  [/cutting board|cheese board|serving tray|mouse pad|doormat|bath mat|yoga mat|exercise mat/, V('part', { kind: 'card' }), 'kitchen'],
  [/oven mitt|boxing glove/, LIKE('sock'), 'kitchen'],
  [/apron|life jacket/, LIKE('jacket'), 'outdoor'],
  [/hair straightener|curling iron|electric razor|shaver|massage gun/, LIKE('hair_dryer'), 'gadget'],
  [/toothbrush|hair brush|makeup brush|comb/, V('handtool', { head: 'brush' }), 'gadget'],
  [/razor/, V('handtool', { head: 'knife' }), 'gadget'],
  // craft
  [/sewing needle|knitting needles|crochet hook/, V('handtool', { head: 'needle' }), 'craft', 'Stitch Up'],
  [/pin cushion/, V('produce', { shape: 'round', top: 'stem' }), 'craft', 'Pin Prick'],
  [/thimble/, V('vessel', { prof: [[8, 5]], rigid: true }), 'craft'],
  // outdoor and sport
  [/fishing rod|fishing reel/, V('handtool', { head: 'rod' }), 'outdoor', 'Reel In'],
  [/tent|gazebo|canopy tent/, V('part', { kind: 'tent' }), 'outdoor', 'Pitch Camp'],
  [/sleeping mat|camping mattress|air mattress/, LIKE('sleeping_bag'), 'outdoor'],
  [/sled|ski$|snowboard|surfboard|hoverboard|electric skateboard/, LIKE('skateboard'), 'outdoor', 'Wipeout'],
  [/paddle|oar/, V('handtool', { head: 'paddle' }), 'outdoor', 'Paddle Slap'],
  [/sprinkler|watering/, LIKE('watering_can'), 'outdoor'],
  [/fence|gate$|garden gate|hurdle|tennis net|volleyball net|football goal|cricket stumps/, V('part', { kind: 'fence' }), 'outdoor'],
  [/garden gnome|party hat/, V('produce', { shape: 'tall', top: 'cap' }), 'outdoor'],
  [/birdhouse|bird feeder|letterbox/, LIKE('mailbox'), 'outdoor'],
  [/planter|flower pot/, LIKE('potted_plant'), 'outdoor'],
  [/compost bin|wheelie bin|pedal bin|waste paper basket|sanitary bin|sharps bin/, LIKE('trash_can'), 'outdoor'],
  [/recycling crate|recycling box/, LIKE('crate'), 'outdoor'],
  [/manhole|drain cover|frisbee|discus|hockey puck|spinning top|yo-yo/, V('part', { kind: 'disc' }), 'street'],
  [/golf club|croquet mallet|polo mallet|lacrosse|hurling stick/, V('handtool', { head: 'club' }), 'sport', null, [210, 8, 70]],
  [/javelin|golf tee/, V('handtool', { head: 'pen' }), 'sport'],
  [/swim goggles|ski goggles|smart glasses|vr headset/, LIKE('glasses'), 'gadget'],
  [/bicycle helmet|swim cap/, LIKE('helmet'), 'sport'],
  [/bowling pin/, V('vessel', { prof: [[10, 6], [6, 3], [6, 4]], rigid: true }), 'sport'],
  [/punching bag|kick pad/, V('vessel', { prof: [[24, 7]], cap: 3, rigid: true }), 'sport'],
  [/whistle sport|whistle small/, LIKE('trumpet'), 'sport'],
  [/medal ribbon|medal/, LIKE('trophy'), 'sport'],
  // appliances, machines and electronics in the wrong body
  [/treadmill|rowing machine|elliptical/, V('part', { kind: 'treadmill' }), 'gym', 'Cardio Grind'],
  [/exercise bike/, LIKE('bicycle'), 'gym', 'Cardio Grind'],
  [/arcade machine|jukebox|slot machine|atm machine|ticket machine|photo booth|vending kiosk/, LIKE('vending_machine'), 'arcade'],
  [/kitchen scale|bathroom scale|^scale$/, V('part', { kind: 'scale' }), 'kitchen', 'Weigh In'],
  [/grill|barbecue|smoker|hot plate|stove top|induction hob/, V('appliance', { w: 28, h: 14, burners: true, flame: true, panel: 'dial' }), 'kitchen'],
  [/robot vacuum/, V('part', { kind: 'disc' }), 'gadget'],
  [/carpet cleaner|steam cleaner|floor polisher/, LIKE('vacuum'), 'gadget'],
  [/ceiling fan|tower fan|space heater fan|extractor fan/, LIKE('fan'), 'gadget'],
  [/server|workstation/, LIKE('desktop_pc'), 'computer'],
  [/chromebook|netbook/, LIKE('laptop'), 'computer'],
  [/^cd$|^dvd$|vinyl record|cd changer/, V('part', { kind: 'disc' }), 'media', 'Skipping Track'],
  [/cassette|tape deck|floppy disk/, V('part', { kind: 'cassette' }), 'media', 'Rewind'],
  [/hard drive|usb stick|flash drive|sd card|memory card|graphics card|motherboard|^cpu$|ram stick|sim card/, V('part', { kind: 'chip' }), 'computer', 'Bit Flip'],
  [/record player|turntable|mixing desk|drum machine|synth keyboard|keytar|harmonium/, LIKE('keyboard'), 'media'],
  [/drawing tablet|e-ink tablet/, LIKE('tablet'), 'computer'],
  [/3d printer|plotter|label printer|scanner/, LIKE('printer'), 'computer'],
  [/docking station|usb hub|set-top box|streaming stick|amplifier|receiver|equalizer/, V('device', { w: 26, h: 9, buttons: true, light: true }), 'computer'],
  [/soundbar|guitar amp|amplifier speaker|karaoke/, LIKE('speaker'), 'media'],
  [/projector/, LIKE('projector'), 'media'],
  [/reflector/, V('part', { kind: 'disc' }), 'media'],
  [/remote/, LIKE('remote'), 'gadget'],
  [/mp3 player|ipod/, LIKE('phone'), 'media'],
  [/portable radio|clock radio/, LIKE('radio'), 'media'],
  [/smart ring|wedding ring|^ring$|earring|bracelet|anklet|cufflink/, V('part', { kind: 'ring' }), 'jewel', 'Dazzle'],
  [/necklace|pendant|locket|charm bracelet|brooch/, V('part', { kind: 'ring' }), 'jewel', 'Dazzle'],
  [/^coin|coins|poker chip|game token|button$|^bead/, V('part', { kind: 'coin' }), 'jewel', 'Small Change'],
  [/banknote|credit card|id card|ticket|receipt|playing card|trading card|greeting card|birthday card|postcard/, V('part', { kind: 'card' }), 'office'],
  [/lipstick|mascara|eyeliner|lip balm|nail polish/, V('vessel', { prof: [[18, 5], [10, 4]], cap: 3, rigid: true }), 'cosmetic', 'Makeover'],
  [/perfume|cologne|essential oil/, LIKE('spray_bottle'), 'cosmetic', 'Makeover'],
  [/dice|rubik|lego brick|building blocks|domino|chess board|checkers/, LIKE('puzzle'), 'toyish'],
  [/marble|stress ball|bouncy ball|magic 8 ball|snow globe/, LIKE('ball'), 'toyish'],
  [/door knocker|doorknob|door handle|keyhole/, V('part', { kind: 'knob' }), 'door', 'Knock Knock'],
  [/door|curtain|blinds|shutter|window pane|skylight/, LIKE('window'), 'door'],
  [/cymbal|hi-hat|triangle|cowbell|^bell$|handbell|church bell|singing bowl|wind chime/, V('part', { kind: 'bell' }), 'music', 'Clang'],
  [/bongo|conga|djembe|cajon|timpani|toy drum/, LIKE('drum'), 'music'],
  [/bugle|euphonium|sousaphone|recorder|piccolo|kazoo|harmonica|melodica|bagpipes|didgeridoo/, LIKE('trumpet'), 'music'],
  [/electric bass|double bass|mandolin|sitar|lute/, LIKE('guitar'), 'music'],
  [/metronome/, LIKE('clock'), 'music'],
  [/music stand|sheet music/, LIKE('book'), 'music'],
  [/theremin|toy piano|xylophone toy/, LIKE('piano'), 'music'],
  [/freezer|mini fridge|wine cooler|ice maker/, LIKE('fridge'), 'appliance'],
  [/air fryer|deep fryer|pressure cooker|slow cooker|egg cooker|yogurt maker|steamer$/, LIKE('rice_cooker'), 'appliance'],
  [/juicer|food processor|hand mixer|stand mixer|ice cream maker/, LIKE('blender'), 'appliance'],
  [/pizza oven|toaster oven|bread maker/, LIKE('oven'), 'appliance'],
  [/sandwich toaster|popcorn maker/, LIKE('toaster'), 'appliance'],
  [/coffee grinder|spice grinder|milk frother|soda maker|water filter jug/, LIKE('coffee_machine'), 'appliance'],
  [/water heater|boiler|furnace|electric heater|oil heater|gas heater|heating pad|electric blanket/, LIKE('radiator'), 'appliance'],
  [/fire extinguisher/, V('vessel', { prof: [[22, 6], [4, 3]], nozzle: true, label: true, rigid: true }), 'alarm', 'Foam Blast'],
  // vehicles that are not cars
  [/rowboat|dinghy|inflatable boat|yacht|ferry|tugboat|fishing boat|houseboat|barge|toy boat|submarine/, LIKE('sailboat'), null],
  [/glider|seaplane|biplane|jet fighter|space rocket/, LIKE('airplane'), null],
  [/hot air balloon/, LIKE('balloon'), null],
  [/monorail|funicular|toy train|model train/, LIKE('train'), null],
  [/gondola lift|chairlift/, LIKE('tram'), null],
  [/pram|stroller|baby carriage|shopping trolley|luggage cart|hand truck|dolly|pallet jack/, LIKE('wheelbarrow'), null],
  [/roller skate|inline skate|segway/, LIKE('skateboard'), null],
  [/quad bike|atv|buggy|quad tractor/, LIKE('go_kart'), null],
  [/sidecar/, LIKE('motorcycle'), null],
  [/rickshaw|tuk tuk/, LIKE('scooter'), null],
  [/scissor lift|cherry picker|crane/, LIKE('crane'), null],
  [/road roller|steamroller|asphalt paver|grader|skid steer|wheel loader/, LIKE('bulldozer'), null],
  [/backhoe/, LIKE('excavator'), null],
  [/hay baler|seed drill|plough|cultivator/, LIKE('tractor'), null],
  [/trailer|car carrier|logging truck|street sweeper|snow plough|salt spreader|monster truck|toy truck/, LIKE('truck'), null],
  [/escalator/, LIKE('ladder'), null],
  [/elevator/, V('storage', { w: 22, h: 30, doors: 2 }), 'door'],
  [/bar table|bistro table|console table|card table|nesting tables|drafting table|workbench|sawhorse|kitchen island|kitchen counter|standing desk|sit-stand desk|secretary desk/, LIKE('desk'), 'furniture'],
  [/sideboard|hutch|credenza|bureau/, LIKE('dresser'), 'furniture'],
  [/shoe rack|magazine rack|wine rack|spice rack|ladder shelf|cube shelf|room divider|folding screen/, LIKE('bookshelf'), 'furniture'],
  [/bed frame|headboard|daybed|futon frame|sofa bed/, LIKE('bed'), 'furniture'],
];
/* v0.4.5: food and drink. Before, every unlisted meal, drink and vegetable borrowed its category's single template, so
   an energy drink became a burger with takeaway-box lore and a grease attack. These rules (checked before DESIGN_RULES,
   only for food, dessert, fruit/veg and bottle objects) give drinks drink bodies, and meats, seafood, bowls, dumplings,
   breads, sauces, pantry goods, vegetables, greens and nuts their own designs, lore groups and move kits. */
const FOOD_CATS = new Set(['food', 'cake', 'fruit', 'bottle']);
const FOOD_RULES = [
  // drinks
  [/\benergy drink\b/, LIKE('can'), 'drink', 'Energy Spike', [140, 70, 45]],
  [/\b(soda|cola|beer can)\b/, LIKE('can'), 'drink', 'Fizz Blast', [0, 70, 45]],
  [/bubble tea/, V('vessel', { prof: [[18, 7], [3, 8]], straw: true, liquid: true, pearls: true }), 'drink', 'Tapioca Barrage', [30, 40, 72]],
  [/^tea$|hot chocolate/, LIKE('mug'), 'drink', 'Scalding Sip'],
  [/smoothie|milkshake/, V('vessel', { prof: [[18, 6], [3, 7]], straw: true, liquid: true, foam: true }), 'drink', 'Straw Slurp', [330, 55, 72]],
  [/lemonade|^juice$/, V('vessel', { prof: [[20, 6]], straw: true, liquid: true }), 'drink', 'Citrus Splash', [50, 85, 62]],
  [/^beer$/, V('vessel', { prof: [[18, 7]], handle: true, liquid: true, foam: true }), 'drink', 'Froth Over', [40, 80, 52]],
  [/^wine$|cocktail/, LIKE('glass'), 'drink', 'Toast of Doom', [345, 60, 35]],
  [/water glass/, LIKE('glass'), 'drink', 'Splash Down', [200, 40, 80]],
  // pantry and sauces
  [/tea bag|coffee beans|coffee bag|^cocoa$|^flour$|^sugar$|^rice$/, V('meal', { kind: 'sack' }), 'pantry', 'Spill Out', [35, 35, 75]],
  [/pasta box|noodles packet/, V('meal', { kind: 'box' }), 'pantry', 'Shelf Drop'],
  [/^salt$|^spices$/, LIKE('salt_shaker'), 'pantry', 'Seasoning Storm'],
  [/olive oil|vinegar|maple syrup|soy sauce/, V('vessel', { prof: [[16, 6], [4, 4], [5, 2]], label: true, cap: 2 }), 'condiment', 'Slick Pour', [45, 70, 40]],
  [/ketchup|mustard|mayonnaise|hot sauce/, V('vessel', { prof: [[16, 7], [4, 5]], label: true, tip: true }), 'condiment', 'Squeeze Shot', [2, 75, 45]],
  [/^honey$|^jam$|peanut butter|nutella|^salsa$|^hummus$|^dip$|caviar/, LIKE('jar'), 'condiment', 'Sticky Trap'],
  // dairy
  [/cheese wedge|^cheese$/, V('meal', { kind: 'wedge' }), 'dairy', 'Holey Smack', [48, 85, 62]],
  [/^butter$/, V('meal', { kind: 'block' }), 'dairy', 'Slippery Spread', [50, 80, 75]],
  [/^yogurt$/, V('vessel', { prof: [[15, 9]], rim: true, label: true }), 'dairy', 'Creamy Swirl', [0, 0, 94]],
  [/^tofu$/, V('meal', { kind: 'block' }), 'veg', 'Wobble Block', [45, 25, 88]],
  // bowls
  [/ramen|^pho$|noodle/, V('meal', { kind: 'bowl', fill: 'noodles' }), 'bowl', 'Noodle Lasso'],
  [/curry|rice bowl|fried rice|paella|risotto|burrito bowl/, V('meal', { kind: 'bowl', fill: 'rice' }), 'bowl', 'Steaming Spoonful'],
  [/soup can/, LIKE('can'), 'bowl', 'Tin Soup Splash'],
  [/cereal|oatmeal|granola|porridge|mac and cheese|^beans$|coleslaw/, V('meal', { kind: 'bowl', fill: 'cereal' }), 'bowl', 'Soggy Splash'],
  [/salad bowl/, V('meal', { kind: 'bowl', fill: 'salad' }), 'leafy', 'Crunchy Toss'],
  [/lasagna/, V('meal', { kind: 'slab' }), 'bowl', 'Layer Crush', [38, 70, 60]],
  // meat
  [/bacon/, V('meal', { kind: 'bacon' }), 'meat', 'Crispy Strip', [8, 55, 55]],
  [/steak/, V('meal', { kind: 'steak' }), 'meat', 'Searing Slab', [5, 55, 38]],
  [/chicken wing|drumstick chicken|fried chicken/, V('meal', { kind: 'drumstick' }), 'meat', 'Drumstick Drum', [30, 70, 50]],
  [/meatball|nugget/, V('meal', { kind: 'balls' }), 'meat', 'Meatball Barrage', [20, 50, 40]],
  [/kebab/, V('meal', { kind: 'skewer' }), 'meat', 'Skewer Spin', [20, 55, 42]],
  [/sausage roll/, V('meal', { kind: 'roll' }), 'bakery', 'Flaky Wrap', [35, 65, 60]],
  // seafood
  [/fish and chips|fish fillet/, V('meal', { kind: 'fillet' }), 'seafood', 'Battered Slap', [35, 65, 60]],
  [/shrimp|prawn/, V('meal', { kind: 'shrimp' }), 'seafood', 'Tail Flick', [12, 75, 62]],
  [/lobster/, LIKE('crab'), 'seafood', 'Claw Crush', [5, 70, 48]],
  [/oyster|mussel/, V('meal', { kind: 'shell' }), 'seafood', 'Clam Up', [220, 15, 40]],
  // dumplings and wraps
  [/dumpling|dim sum|empanada|ravioli|gnocchi|calzone/, V('meal', { kind: 'dumpling' }), 'dumpling', 'Pleated Punch', [40, 45, 82]],
  [/samosa/, V('meal', { kind: 'samosa' }), 'dumpling', 'Triple Corner', [38, 70, 55]],
  [/bao bun/, V('meal', { kind: 'bun' }), 'dumpling', 'Pillow Punch', [40, 25, 92]],
  [/spring roll|enchilada|tamale/, V('meal', { kind: 'roll' }), 'dumpling', 'Rolling Crunch', [38, 70, 55]],
  [/falafel/, V('meal', { kind: 'balls' }), 'snack', 'Chickpea Volley', [35, 60, 40]],
  [/shawarma|gyro|burrito|quesadilla|wrap sandwich/, LIKE('taco'), 'snack', 'Wrap Attack'],
  [/nachos/, V('meal', { kind: 'nachos' }), 'snack', 'Chip Shower', [45, 80, 55]],
  [/pizza slice box/, LIKE('pizza'), 'snack', 'Cheese Pull'],
  // bread and breakfast
  [/sandwich roll|panini/, LIKE('burger'), 'bakery', 'Pressed Crunch'],
  [/french toast|garlic bread|^toast$/, V('meal', { kind: 'toast' }), 'bakery', 'Toasty Smack', [35, 60, 62]],
  [/pancake|waffle plate|crepe/, V('meal', { kind: 'stack' }), 'breakfast', 'Syrup Flood', [35, 60, 65]],
  [/omelette|scrambled eggs/, LIKE('fried_egg'), 'breakfast', 'Egg-splosion'],
  // vegetables, greens, nuts and seeds
  [/radish|beet|turnip/, V('produce', { shape: 'round', top: 'leafy' }), 'veg', 'Root Bash', [340, 60, 45]],
  [/parsnip|horseradish/, V('produce', { shape: 'carrot', top: 'leafy' }), 'veg', 'Root Bash', [45, 40, 80]],
  [/celery|asparagus|leek|spring onion/, V('produce', { shape: 'stalk' }), 'veg', 'Stalk Whip', [100, 50, 55]],
  [/spinach|kale|chard|bok choy|^herbs$|basil|mint leaves|parsley|rosemary|thyme|dill|sprouts/, V('produce', { shape: 'leaf' }), 'leafy', 'Leaf Lash', [115, 55, 40]],
  [/brussels sprout/, V('produce', { shape: 'small', ridges: true }), 'veg', 'Sprout Spit', [95, 50, 45]],
  [/green bean|pea pod|okra|edamame/, V('produce', { shape: 'pod' }), 'veg', 'Pea Shooter', [100, 55, 45]],
  [/chili|jalapeno/, V('produce', { shape: 'chili' }), 'veg', 'Fire Breath', [2, 80, 48]],
  [/ginger|^yam$|cassava|taro/, V('produce', { shape: 'oval', dimples: true }), 'veg', 'Knobbly Knock', [35, 45, 60]],
  [/peanut|walnut|almond|cashew|pistachio|hazelnut|chestnut|pecan/, V('produce', { shape: 'nut' }), 'nut', 'Nutcracker', [30, 45, 45]],
  [/seeds|sesame|lentils|chickpeas|kidney beans|soybean/, V('meal', { kind: 'bowl', fill: 'beans' }), 'pantry', 'Seed Scatter', [35, 45, 45]],
  [/blueberry|blackberry|cranberry|gooseberry|currant/, V('produce', { shape: 'cluster' }), null, 'Berry Burst', [250, 50, 35]],
  [/^hip$/, V('produce', { shape: 'small', top: 'stem' }), null, 'Thorny Burst', [8, 75, 45]],
  [/^date$|raisin|prune|olive/, V('produce', { shape: 'small' }), null, 'Pit Spit', [20, 40, 30]],
  [/mango|papaya|guava/, V('produce', { shape: 'pear' }), null, 'Tropical Burst', [40, 85, 55]],
  [/^kiwi$/, V('produce', { shape: 'oval', dimples: true }), null, 'Fuzzy Burst', [30, 40, 35]],
  [/dragon fruit/, V('produce', { shape: 'oval', top: 'crown' }), null, 'Dragon Bloom', [330, 70, 55]],
  [/star fruit/, V('produce', { shape: 'oval', ridges: true }), null, 'Star Burst', [55, 80, 55]],
  [/durian/, V('produce', { shape: 'round', dimples: true, top: 'stem' }), null, 'Stink Bomb', [70, 45, 45]],
  [/passion fruit|lychee|persimmon|quince|apricot|nectarine|plum|fig|pomelo|kumquat|yuzu/, V('produce', { shape: 'round', top: 'stem' }), null, 'Juicy Burst'],
  // sweets and desserts that are not cakes
  [/lollipop|gummy|jelly beans|toffee|caramel|licorice|chewing gum|^mint$|cake pop|truffle/, LIKE('candy'), null, 'Sugar Spike'],
  [/cotton candy|candy floss|marshmallow/, V('produce', { shape: 'round', top: 'none' }), null, 'Fluff Puff', [320, 55, 85]],
  [/sugar cookie|fortune cookie|wafer|macaron/, LIKE('cookie'), null, 'Crumble Toss'],
  [/brownie|fudge/, LIKE('chocolate'), null, 'Fudge Slam'],
  [/pudding|jelly|jello|custard|mousse/, V('meal', { kind: 'bun' }), null, 'Wobble Wave', [350, 60, 60]],
  [/gelato cup|frozen yogurt|sundae/, LIKE('ice_cream'), null, 'Brain Freeze Blast'],
  [/churro/, V('meal', { kind: 'roll' }), 'bakery', 'Sugar Twist'],
  [/cinnamon roll|danish|scone|pastry|eclair|cream puff/, V('meal', { kind: 'bun' }), 'bakery', 'Glaze Glob', [35, 60, 65]],
  [/donut box|chocolate box|biscuit tin/, V('meal', { kind: 'box' }), null, 'Lid Pop'],
  [/birthday candle/, LIKE('candle'), null, 'Wish Flame'],
  // drink and food bottles
  [/kombucha|milk bottle|drinking bottle|sports bottle|hip flask|decanter|carafe|sippy cup/, LIKE('bottle'), 'drink', 'Glug Glug'],
  [/sauce bottle|oil bottle|syrup bottle/, V('vessel', { prof: [[16, 6], [4, 4], [5, 2]], label: true, cap: 2 }), 'condiment', 'Slick Pour'],
  [/honey jar|pickle jar|spice jar|baby food jar|cookie jar/, LIKE('jar'), 'condiment', 'Sticky Trap'],
];
// v0.4.5: a group can change the monster family where the category's family does not fit the object (a spoon or a pen
// is not a Mechanical monster just because its category is "tool" or "keys")
const GROUP_FAM = { kitchen: 'household', office: 'household', craft: 'household', gym: 'household', sport: 'household', leafy: 'botanical' };
// named objects whose category does not describe them: [group, signature-move name]
const NAMED_GROUPS = {
  cutlery_spoon: ['kitchen', 'Stir Crazy'], cutlery_fork: ['kitchen', 'Prong Poke'], knife: ['kitchen', 'Chop Chop'], spatula: ['kitchen', 'Flip Out'], whisk: ['kitchen', 'Whisk Away'],
  sewing_machine: ['craft', 'Stitch Storm'], pen: ['office', 'Ink Blot'], stapler: ['office', 'Staple Storm'], scissors: ['office'], headphones: ['media', 'Bass Boost'],
  dumbbell: ['gym', 'Heavy Rep'], trophy: ['sport', 'Victory Lap'], traffic_cone: ['street', 'Detour'],
  hotdog: ['meat', 'Relish Rush'], sushi: ['seafood', 'Wasabi Wallop'], egg: ['breakfast', 'Crack Attack'], fried_egg: ['breakfast', 'Yolk Burst'], milk_carton: ['drink', 'Milk Splash'],
  broccoli: ['veg', 'Floret Blast'], carrot: ['veg', 'Carrot Jab'], potato: ['veg', 'Spud Slam'], onion: ['veg', 'Tear Gas'], pumpkin: ['veg', 'Gourd Bash'], cucumber: ['veg', 'Cool Cucumber'],
  corn: ['veg', 'Kernel Pop'], eggplant: ['veg', 'Purple Bruise'], pepper: ['veg', 'Pepper Spray'],
  noodles: ['bowl', 'Noodle Lasso'], bread: ['bakery', 'Loaf Launch'], croissant: ['bakery', 'Flaky Fold'], fries: ['snack', 'Salt Storm'], popcorn: ['snack', 'Pop Pop Pop'], taco: ['snack', 'Taco Tuesday'],
};
for (const [id, [group, sig]] of Object.entries(NAMED_GROUPS)) { const o = OBJECTS[id]; if (!o) continue; o.lore = group; if (sig && !o.sig) o.sigName = sig; if (GROUP_FAM[group]) o.fam = GROUP_FAM[group]; }
// categories whose own template is ONE specific object (a toolbox, a key, a fridge…): objects that no rule covers get
// a neutral template of the right kind instead of looking like that specific object
const CAT_FALLBACK_VIS = {
  tool: V('part', { kind: 'block' }), keys: V('part', { kind: 'block' }), fridge: V('appliance', { panel: 'buttons' }),
  laptop: V('device', { w: 22, h: 12, light: true, buttons: true }), tv: V('device', { w: 24, h: 12, buttons: true, light: true }),
};
// a rule matches whole words only (plural s/es allowed), so a weasel is not an easel, a motherboard not an oar, a
// windbreaker not a circuit breaker. Names whose word-internal match is genuinely right stay listed here.
const RULE_SUBWORD_OK = new Set(['bobsled', 'dogsled', 'paddlewheel', 'horseradish', 'corkscrew']);
function wholeWordMatch(re, label) {
  if (RULE_SUBWORD_OK.has(label)) return true;
  const g = new RegExp(re.source, 'g'); let m;
  while ((m = g.exec(label))) { if (!m[0]) { g.lastIndex++; continue; }
    const a = m.index, b = a + m[0].length, before = a ? label[a - 1] : ' ', rest = label.slice(b);
    if (!/[a-z]/.test(before) && (!/^[a-z]/.test(rest) || /^(s|es)\b/.test(rest))) return true; }
  return false;
}
function applyDesignRules(o) {
  if (o.vis) return;
  const label = o.name.toLowerCase();
  for (const [re, vis, lore, sig, col] of FOOD_CATS.has(o.cat) ? [...FOOD_RULES, ...DESIGN_RULES] : DESIGN_RULES) {
    if (!re.test(label)) continue;
    if (!wholeWordMatch(re, label)) continue; // recognition audit 2026-11: "easel" must not match a weasel, "oar" a motherboard
    if (vis.like && !OBJECTS[vis.like]) break; // safety: never point at a missing design
    o.vis = vis; o.lore = lore || null; if (sig) o.sigName = sig; o.rule = String(re);
    if (GROUP_FAM[lore]) o.fam = GROUP_FAM[lore];
    if (col) [o.h, o.s, o.l] = col; // the object's usual colour when the photo gives none (light switches are white)
    return;
  }
  const fix = typeof VIS_FIXES !== 'undefined' && VIS_FIXES[label];
  if (fix && (!fix.like || OBJECTS[fix.like])) { o.vis = fix; o.visFix = true; return; } // visual only (see VIS_FIXES)
  if (CAT_FALLBACK_VIS[o.cat]) { o.vis = CAT_FALLBACK_VIS[o.cat]; o.neutral = true; }
}

/* ---------- recognition → identity → visual audit (2026-11, docs/review/MAPPING_AUDIT.md) ----------
   EXTRA_ALIASES: recogniser labels that belong to a vocabulary object but used to be claimed by a different object
   (first registration wins): a photographed sea urchin became a Starfish, a shopping cart a Wheelbarrow.
   VIS_FIXES: objects with no design of their own were drawn with their category's single template (a sea urchin as a
   fish, a tuning fork as a guitar, a hat as a T-shirt). Each fix borrows the closest existing design (LIKE) or a
   composed shape. Applied by exact object name, only where no design rule matched, and it sets the visual ONLY:
   never the lore group, family or moves (gameplay unchanged; saved monsters keep the look stored in their DNA and can
   opt in through "Update its look"). */
const EXTRA_ALIASES = {
  x_sea_urchin_shell: ['sea urchin'], x_shopping_trolley: ['shopping cart'],
  // a sibling species claimed by a related object although its own identity exists (a moth was a Butterfly, a koala a
  // Bear, a wolf a Fox): the label now names its own species, drawn with the same body as before (VIS_FIXES)
  x_koala_bear: ['koala'], x_gorilla_ape: ['gorilla'], x_orangutan_ape: ['orangutan'], x_guinea_pig_pet: ['guinea pig'],
  x_llama_animal: ['llama'], x_alpaca_animal: ['alpaca'], x_wolf_pup: ['wolf', 'timber wolf'], x_moth_insect: ['moth'],
  x_scorpion_arachnid: ['scorpion'], x_slug_creature: ['slug'], x_centipede_insect: ['centipede'], x_toad_creature: ['toad'],
  x_tongs: ['tongs'], x_trowel: ['trowel'], x_gerbil: ['gerbil'], x_orca: ['killer whale'],
};
const VIS_FIXES = {
  'sea urchin shell': V('produce', { shape: 'spiky' }), 'sea turtle': LIKE('turtle'),
  krill: LIKE('crab'), prawn: LIKE('crab'), nautilus: LIKE('snail'), anemone: LIKE('jellyfish'),
  'rubber duckie bath': LIKE('rubber_duck'), 'fountain pen ink': LIKE('bottle'), 'sports bottle': LIKE('bottle'),
  rattlesnake: LIKE('snake'), 'garter snake': LIKE('snake'), 'sea snake': LIKE('snake'), 'toad creature': LIKE('frog'),
  'slug creature': LIKE('snail'), earthworm: LIKE('caterpillar'), leech: LIKE('caterpillar'), millipede: LIKE('caterpillar'),
  'centipede insect': LIKE('caterpillar'), 'scorpion arachnid': LIKE('spider'),
  beret: LIKE('hat'), fedora: LIKE('hat'), 'bowler hat': LIKE('hat'), 'sun hat': LIKE('hat'), 'bucket hat': LIKE('hat'),
  visor: LIKE('hat'), crown: LIKE('hat'), tiara: LIKE('hat'),
  'knee pads': LIKE('sock'), 'elbow pads': LIKE('sock'), 'shin guard': LIKE('sock'),
  'tuning fork': LIKE('cutlery_fork'), switch: LIKE('x_light_switch'),
  'cash machine': LIKE('vending_machine'), gondola: LIKE('sailboat'), lifeboat: LIKE('sailboat'),
  'koala bear': LIKE('bear'), 'gorilla ape': LIKE('monkey'), 'orangutan ape': LIKE('monkey'), 'guinea pig pet': LIKE('hamster'),
  'fidget spinner': V('produce', { shape: 'spinner' }), 'socks pair': LIKE('sock'), 'gloves pair': LIKE('sock'), 'mittens pair': LIKE('sock'),
  earmuffs: LIKE('hat'), headband: LIKE('hat'), bandana: LIKE('hat'), balaclava: LIKE('hat'), tadpole: LIKE('fish'),
  'toy robot dog': LIKE('robot_toy'), 'baby bottle': LIKE('bottle'), 'rain barrel tank': LIKE('can'), 'water tank': LIKE('can'),
  'coloring book': LIKE('book'),
  // deferred-flag cleanup (2026-11): clearly wrong category bodies → closest existing template
  boomerang: V('produce', { shape: 'curved' }), castanets: V('produce', { shape: 'pair' }), shaker: V('produce', { shape: 'pear' }),
  'rain stick': V('handtool', { head: 'cane' }), 'music box instrument': LIKE('box'), 'music box toy': LIKE('box'),
  coral: LIKE('tree'), 'sea sponge': V('produce', { shape: 'tall', dimples: true }), clam: V('produce', { shape: 'oval', ridges: true }),
  scallop: V('produce', { shape: 'oval', ridges: true }), 'street sign': V('pole', { kind: 'signrect' }), flag: V('pole', { kind: 'post' }),
  banner: V('pole', { kind: 'post' }), 'toy dinosaur': LIKE('lizard'), 'toy kitchen': LIKE('oven'), 'wind-up toy': LIKE('robot_toy'),
  'tea set toy': LIKE('teapot'), 'crayon box': LIKE('box'), 'jack in the box': LIKE('box'), 'sand bucket': LIKE('bucket'),
  'party horn': LIKE('trumpet'), 'play dough': LIKE('jar'), kaleidoscope: V('part', { kind: 'scope' }), confetti: LIKE('balloon'),
  pinata: LIKE('horse'), 'rocking horse': LIKE('horse'), 'rocking toy': LIKE('horse'), 'chess piece': LIKE('trophy'),
  'bubble wand': V('handtool', { head: 'magnifier' }), slinky: V('part', { kind: 'coil' }), sticker: V('part', { kind: 'card' }),
  'swim ring': V('part', { kind: 'ring' }), 'pool float': V('part', { kind: 'ring' }), pacifier: V('part', { kind: 'ring' }),
  teether: V('part', { kind: 'ring' }), rattle: V('part', { kind: 'bell' }), pinwheel: LIKE('fan'), mask: V('produce', { shape: 'oval' }),
  wig: LIKE('hat'), 'wig hair': LIKE('hat'), sweatband: LIKE('hat'), badge: V('part', { kind: 'coin' }), belt: V('part', { kind: 'strip' }),
  suspenders: V('part', { kind: 'strip' }), lanyard: V('part', { kind: 'strip' }), ribbon: V('part', { kind: 'strip' }), bow: LIKE('tie'),
  flippers: LIKE('sneaker'), 'starting block': V('part', { kind: 'block' }), 'bath bomb': LIKE('ball'), birdbath: LIKE('bowl'),
  sponge: V('part', { kind: 'block' }), loofah: V('produce', { shape: 'long', ridges: true }), 'soap dish': LIKE('plate'),
  'toilet brush': V('handtool', { head: 'brush' }), 'plunger tool': V('handtool', { head: 'brush' }), plunger: V('handtool', { head: 'brush' }), 'towel rack': LIKE('ladder'), 'towel rail': LIKE('ladder'), well: LIKE('bucket'),
  'umbrella stand': LIKE('bucket'), beehive: V('produce', { shape: 'tall', stripes: true }), 'wasp nest': V('produce', { shape: 'tall', stripes: true }),
  cocoon: V('produce', { shape: 'tall' }), chrysalis: V('produce', { shape: 'tall' }), 'spider egg': V('produce', { shape: 'cluster' }),
  honeycomb: V('produce', { shape: 'oval', seeds: 'dark' }), 'champagne flute': LIKE('glass'), 'ironing board': LIKE('dining_table'),
  'gingerbread man': LIKE('cookie'), cardboard: LIKE('box'),   'bat animal': LIKE('bird'), hay: V('produce', { shape: 'oval', ridges: true }), 'satellite model': LIKE('router'),
  'llama animal': LIKE('camel'), 'alpaca animal': LIKE('camel'), 'wolf pup': LIKE('fox'), 'moth insect': LIKE('butterfly'),
};

/* Objects that recognisers named correctly but the registry had no identity for, so the label was an alias of a
   different object (a piggy bank was the Pig, a whale and a dolphin the Shark, a wombat the Bear, binoculars the
   Glasses). Each takes over exactly the label strings it already had (TinyCLIP text embeddings unchanged) and
   borrows the old body where no better design exists: an approximate body, the right identity. */
for (const [id, name, cat, vis] of [['piggy_bank', 'Piggy bank', 'toy', LIKE('pig')], ['whale', 'Whale', 'fish', LIKE('shark')],
  ['dolphin', 'Dolphin', 'fish', LIKE('shark')], ['wombat', 'Wombat', 'animal', LIKE('bear')], ['binoculars', 'Binoculars', 'tv', LIKE('glasses')]]) {
  OBJ(id, name, cat, vis, { al: [name.toLowerCase()] }); // binoculars: the two-lens Glasses body (the scope rule draws a tripod telescope)
}

/* ---------- build the vocabulary objects (family tier) ---------- */
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
(function addExtras() {
  for (const [cat, list] of Object.entries(VOCAB_EXTRA)) {
    for (const raw of list.split(',')) {
      const label = raw.trim(); if (!label) continue;
      const id = 'x_' + slug(label);
      if (OBJECTS[id]) continue;
      applyDesignRules(OBJ(id, label.replace(/^./, c => c.toUpperCase()), cat, null, { al: [label, ...(EXTRA_ALIASES[id] || [])] }));
    }
  }
})();

/* ---------- lookups ---------- */
// default object per category (the family template); used when a recogniser only names a broad category
const CAT_DEFAULT_OBJECT = {
  toilet: 'toilet', mug: 'mug', shoe: 'sneaker', plant: 'potted_plant', laptop: 'laptop', banana: 'banana', sofa: 'sofa', phone: 'phone', bottle: 'bottle',
  book: 'book', lamp: 'lamp', chair: 'dining_chair', car: 'car', animal: 'cat', tree: 'tree', food: 'burger', fruit: 'apple', cloth: 'shirt', tool: 'toolbox',
  toy: 'teddy', trash: 'trash_can', mirror: 'mirror', fridge: 'fridge', candle: 'candle', clock: 'clock', keys: 'key', bag: 'backpack', pillow: 'pillow',
  faucet: 'sink', tv: 'tv', bird: 'bird', fish: 'fish', bug: 'beetle', reptile: 'lizard', umbrella: 'umbrella', instrument: 'guitar', ball: 'ball', pot: 'pot',
  cake: 'cake', other: null,
};
/* Design revisions (v0.6.0). An object redesigned in revision 2 keeps its previous design in `visPrev`: a monster saved
   with the old body (dna.shape 'obj', or a category shape) still renders exactly as before; new monsters get shape
   'obj2'. An object that borrows (LIKE) a redesigned object keeps the borrowed OLD design unless it was redesigned
   itself. `rev` = the design revision to resolve (default: the object's current one). */
function visView(o, rev) { return o && o.visRev && rev < o.visRev ? { ...o, vis: o.visPrev, neutral: o.neutralPrev, visRev: 0 } : o; }
function visualSource(o, rev) {
  if (!o) return o; const r = rev || o.visRev || 1, v = visView(o, r);
  return v.vis && v.vis.like && OBJECTS[v.vis.like] ? visView(OBJECTS[v.vis.like], r) : v;
}
function objectTier(o) {
  if (!o || o.neutral) return 'family';
  if (o.vis && o.vis.like) return 'related';
  if (o.vis === 'D' || o.vis === 'X' || (o.vis && o.vis.legacy)) return 'dedicated';
  if (o.vis && o.vis.t) return 'composed';
  return 'family';
}
// Resolve any recogniser label (a whole ImageNet class string, a COCO name or a vocabulary label) to an object id.
function objectForLabel(label) {
  if (!label) return null;
  // a whole ImageNet class string resolves exactly like the generated table (src/labels.js), so both routes agree
  if (typeof LABEL_OBJECTS !== 'undefined' && LABEL_OBJECTS.imagenet && typeof LABEL_OBJECTS.imagenet[label] === 'string') return LABEL_OBJECTS.imagenet[label];
  const parts = String(label).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  for (const p of parts) if (ALIAS_INDEX.has(p)) return ALIAS_INDEX.get(p);
  for (const p of parts) { const q = p.replace(/s$/, ''); if (ALIAS_INDEX.has(q)) return ALIAS_INDEX.get(q); }
  return null;
}
function objectCounts() {
  const c = { dedicated: 0, composed: 0, related: 0, family: 0 };
  for (const o of OBJECT_LIST) c[objectTier(o)]++;
  return c;
}

/* ---------- v0.6.0 sprite redesign (owner's catalogue sprite review, 2026-11-17) ----------
   Every object the owner flagged "Sprite needs fix" (it did not look like the real object) gets its own design:
   'X' = an object-specific builder in PARTS.X. Optional natural colours [hue, sat, light] / secondary colour.
   VISUAL ONLY: category, family, stats, moves and lore are untouched. The previous design is kept (visPrev) so saved
   monsters render exactly as before until the player chooses "Update its look". */
const REDESIGN = {
  cat: {col: [28, 65, 56]},
  cucumber: {col: [110, 50, 40]},
  dial_phone: {},
  dress: {},
  fox: {col: [22, 85, 52]},
  game_console: {},
  garbage_truck: {},
  goat: {col: [40, 15, 88]},
  hamster: {col: [35, 70, 65]},
  helmet: {},
  hippo: {col: [280, 12, 55]},
  i_african_crocodile: {col: [90, 35, 35]},
  i_american_alligator: {col: [100, 20, 25]},
  i_barometer: {},
  i_bearskin: {},
  i_bib: {},
  i_brain_coral: {col: [30, 60, 65]},
  i_breastplate: {},
  i_chain_mail: {},
  i_cocktail_shaker: {},
  i_coil: {},
  i_dalmatian: {col: [0, 0, 93]},
  i_diaper: {},
  i_disk_brake: {},
  i_doberman: {col: [20, 15, 22]},
  i_electric_ray: {col: [30, 30, 55]},
  i_fire_screen: {},
  i_flatworm: {col: [30, 50, 50]},
  i_gas_pump: {},
  i_german_shepherd: {col: [32, 60, 50]},
  i_gila_monster: {col: [20, 70, 55]},
  i_golden_retriever: {col: [40, 70, 58]},
  i_gondola: {},
  i_great_dane: {col: [35, 35, 55]},
  i_grey_whale: {col: [210, 5, 55]},
  i_grille: {},
  i_harvester: {},
  i_hay: {col: [45, 80, 60]},
  i_hermit_crab: {col: [10, 70, 55]},
  i_hook: {},
  i_horned_viper: {col: [35, 35, 60]},
  i_horse_cart: {col: [28, 45, 40]},
  i_indian_cobra: {col: [35, 40, 40]},
  i_king_snake: {col: [0, 75, 50]},
  i_knot: {},
  i_lifeboat: {},
  i_madagascar_cat: {col: [0, 0, 62]},
  i_magnetic_compass: {},
  i_malamute: {col: [210, 10, 55]},
  i_mask: {},
  i_matchstick: {},
  i_mobile_home: {},
  i_model_t: {},
  i_mousetrap: {},
  i_nipple: {},
  i_odometer: {},
  i_oscilloscope: {},
  i_oxcart: {col: [28, 45, 40]},
  i_oxygen_mask: {},
  i_packet: {},
  i_pencil_sharpener: {},
  i_pill_bottle: {},
  i_pinwheel: {},
  i_plunger: {},
  i_sea_cucumber: {col: [10, 40, 35]},
  i_seat_belt: {},
  i_shower_cap: {},
  i_ski_mask: {},
  i_snorkel: {},
  i_spotted_salamander: {col: [0, 0, 20]},
  i_swimming_trunks: {},
  i_swing: {},
  i_theater_curtain: {},
  i_three_toed_sloth: {col: [35, 25, 50]},
  i_tripod: {},
  i_white_stork: {col: [0, 0, 92]},
  i_white_wolf: {col: [210, 10, 88]},
  i_wig: {},
  i_wing: {},
  i_wool: {},
  jacket: {},
  knife: {},
  paintbrush: {},
  puzzle: {},
  saw: {},
  scarf: {},
  sleeping_bag: {},
  squirrel: {col: [20, 60, 45]},
  throne: {col: [0, 65, 40]},
  tie: {},
  tiger: {col: [28, 90, 52]},
  wall_clock: {},
  whale: {col: [210, 30, 40]},
  wheelchair: {},
  whisk: {},
  wombat: {col: [30, 25, 40]},
  x_3d_printer: {},
  x_air_freshener: {},
  x_albatross: {col: [0, 0, 90]},
  x_aloe_vera: {},
  x_angelfish: {col: [50, 60, 70]},
  x_ant_hill: {col: [25, 45, 40]},
  x_anteater: {col: [30, 30, 45]},
  x_antelope: {col: [30, 60, 52]},
  x_apple_pie: {col: [35, 60, 60]},
  x_aquarium: {col: [25, 90, 55]},
  x_armadillo: {col: [30, 30, 60]},
  x_axolotl: {col: [340, 60, 80]},
  x_baby_bottle: {},
  x_baby_carriage: {},
  x_badger: {col: [0, 0, 55]},
  x_bagpipes: {},
  x_baking_tray: {},
  x_balaclava: {},
  x_ballot_box: {},
  x_bamboo: {col: [80, 45, 45]},
  x_bandana: {},
  x_barbie_doll: {},
  x_basketball_hoop: {},
  x_bat_animal: {col: [270, 10, 30]},
  x_beehive: {col: [40, 70, 60]},
  x_bikini: {},
  x_bird_feeder: {},
  x_birdhouse: {},
  x_bonfire: {col: [28, 45, 40]},
  x_book_stand: {col: [28, 45, 40]},
  x_boxing_glove: {},
  x_branch: {col: [28, 45, 40]},
  x_bush: {},
  x_cable: {},
  x_cable_car: {},
  x_campfire: {col: [28, 45, 40]},
  x_cape: {},
  x_cat_bowl: {},
  x_catfish: {col: [35, 25, 40]},
  x_caviar: {},
  x_cereal_box: {},
  x_chandelier: {},
  x_chandelier_light: {},
  x_charm_bracelet: {},
  x_cherry_blossom: {col: [340, 70, 80]},
  x_chess_board: {},
  x_chess_piece: {},
  x_chimp: {col: [25, 35, 25]},
  x_chopsticks: {col: [28, 45, 40]},
  x_christmas_tree_decorated: {},
  x_cigar_box: {},
  x_cigarette: {},
  x_cigarette_butt: {},
  x_clam: {col: [30, 30, 75]},
  x_cleaning_spray: {},
  x_cloak: {},
  x_clothes_dryer_rack: {},
  x_clover: {},
  x_clutch_bag: {},
  x_cocoa: {},
  x_coconut_tree: {col: [28, 45, 40]},
  x_coffee_beans: {col: [25, 50, 25]},
  x_coin_purse: {},
  x_coleslaw: {},
  x_comb: {},
  x_combine_harvester: {},
  x_compass: {},
  x_compass_small: {},
  x_conditioner: {},
  x_confetti: {},
  x_coral: {col: [5, 70, 60]},
  x_cork: {col: [30, 45, 60]},
  x_coupe: {},
  x_crane_bird: {col: [0, 0, 88]},
  x_croc: {},
  x_crocodile_toy: {col: [110, 60, 45]},
  x_crop_top: {},
  x_crow: {col: [0, 0, 15]},
  x_crown: {},
  x_crumpled_paper: {},
  x_cuckoo_clock: {col: [28, 45, 40]},
  x_cufflink: {},
  x_cufflinks: {},
  x_curling_iron: {},
  x_cymbal: {},
  x_dead_tree: {col: [28, 45, 40]},
  x_decanter: {},
  x_delivery_box: {},
  x_diaper_bag: {},
  x_dice: {},
  x_didgeridoo: {col: [28, 45, 40]},
  x_digital_alarm: {},
  x_dinosaur: {col: [110, 35, 45]},
  x_dinosaur_toy: {col: [140, 60, 50]},
  x_director_chair: {},
  x_dish_soap: {},
  x_dog_bowl: {},
  x_doll_house: {},
  x_domino: {},
  x_donation_box: {},
  x_donkey: {col: [30, 8, 55]},
  x_door_knocker: {},
  x_driftwood: {col: [28, 45, 40]},
  x_drone: {},
  x_duffel_bag: {},
  x_eagle: {col: [25, 50, 30]},
  x_earmuffs: {},
  x_eclair: {col: [40, 60, 70]},
  x_eel: {col: [80, 25, 35]},
  x_egg_carton: {},
  x_egg_timer: {},
  x_elbow_pads: {},
  x_electric_bass: {col: [28, 45, 40]},
  x_electric_car: {},
  x_electric_razor: {},
  x_electric_toothbrush: {},
  x_emu: {col: [30, 30, 35]},
  x_espresso_cup: {},
  x_eyeliner: {},
  x_fanny_pack: {},
  x_fern_frond: {},
  x_ferret: {col: [35, 30, 70]},
  x_fire_pit: {},
  x_firefly: {col: [0, 0, 20]},
  x_fireplace: {col: [10, 50, 40]},
  x_firewood: {col: [28, 45, 40]},
  x_firework: {},
  x_fish_and_chips: {},
  x_fishing_boat: {},
  x_fishing_reel: {},
  x_flag: {},
  x_flamingo: {col: [345, 75, 72]},
  x_flare: {},
  x_flash_drive: {},
  x_flashlight_torch: {},
  x_flip_flop: {},
  x_flip_phone: {},
  x_floor_light: {},
  x_floppy_disk: {},
  x_flower_bouquet: {},
  x_flower_pot_saucer: {},
  x_fly: {col: [0, 0, 25]},
  x_folding_screen: {},
  x_football_boot: {},
  x_football_goal: {},
  x_formula_one_car: {},
  x_fountain_pen_ink: {},
  x_fruit_bowl: {},
  x_fudge: {col: [20, 45, 30]},
  x_furnace: {},
  x_garage_door: {},
  x_garden_gnome: {},
  x_garlic_press: {},
  x_gas_can: {},
  x_gas_cylinder: {},
  x_gazebo: {},
  x_gibbon: {col: [30, 20, 40]},
  x_gift_bag: {},
  x_gift_box: {},
  x_ginger: {col: [35, 45, 65]},
  x_ginger_root: {col: [35, 45, 65]},
  x_gingerbread_man: {col: [28, 55, 45]},
  x_glass_cleaner: {},
  x_glider: {},
  x_gloves_pair: {},
  x_glow_stick: {},
  x_goldfish_bowl: {col: [25, 90, 55]},
  x_golf_tee: {},
  x_gorilla_ape: {col: [0, 0, 25]},
  x_gps_device: {},
  x_grandfather_clock: {col: [28, 45, 40]},
  x_graphics_card: {},
  x_grass: {},
  x_gravy_boat: {},
  x_guinea_pig_pet: {col: [30, 60, 60]},
  x_guitar_pick: {},
  x_guppy: {col: [25, 80, 60]},
  x_gutter: {},
  x_gym_bag: {},
  x_hair_brush: {},
  x_hair_straightener: {},
  x_hair_tie: {},
  x_hammock: {},
  x_hand_soap: {},
  x_harmonica_instrument: {},
  x_harmonica_small: {},
  x_hatchback_car: {},
  x_hawk: {col: [25, 45, 40]},
  x_headband: {},
  x_headlamp: {},
  x_hearing_aid: {},
  x_hedge: {},
  x_hedge_trimmer: {},
  x_hedgehog: {col: [30, 35, 55]},
  x_herbs: {},
  x_high_heel: {},
  x_honeycomb: {col: [40, 85, 50]},
  x_hornet: {col: [40, 60, 30]},
  x_hot_air_balloon: {},
  x_hot_rod: {},
  x_hot_water_bottle: {},
  x_houseboat: {},
  x_housefly: {col: [0, 0, 25]},
  x_hovercraft: {},
  x_hula_hoop: {},
  x_hummingbird: {col: [150, 60, 40]},
  x_hyena: {col: [38, 40, 58]},
  x_ice_skate: {},
  x_id_card: {},
  x_incense: {},
  x_incense_stick: {},
  x_inflatable_boat: {},
  x_ink_bottle: {},
  x_iris: {col: [260, 60, 55]},
  x_ivy: {},
  x_jackal: {col: [32, 50, 55]},
  x_jasmine: {},
  x_javelin: {},
  x_jello: {col: [355, 70, 50]},
  x_jelly: {},
  x_jerry_can: {},
  x_jet_fighter_toy: {},
  x_jet_ski: {},
  x_jewelry_box: {},
  x_juice_glass: {},
  x_jukebox: {},
  x_jump_rope: {},
  x_kangaroo: {col: [25, 50, 50]},
  x_keyhole: {},
  x_keyring: {},
  x_keytar: {},
  x_kidney_beans: {col: [355, 55, 35]},
  x_kitchen_counter: {},
  x_kitchen_island: {},
  x_kitchen_timer: {},
  x_kitten_cat: {col: [30, 25, 72]},
  x_knee_high_boot: {},
  x_knee_pads: {},
  x_landfill: {},
  x_lantern_light: {},
  x_laptop_bag: {},
  x_lasagna: {},
  x_laser_pointer: {},
  x_lava_lamp: {},
  x_lavender: {col: [270, 45, 60]},
  x_leaf: {},
  x_leaf_blower: {},
  x_leech: {col: [0, 0, 20]},
  x_leggings: {},
  x_lego_brick: {},
  x_lego_figure: {},
  x_lemur: {col: [0, 0, 62]},
  x_life_jacket: {},
  x_light_bar: {},
  x_lighter: {},
  x_lily_flower: {col: [0, 0, 95]},
  x_limousine: {},
  x_log_pile: {col: [28, 45, 40]},
  x_lollipop_swirl: {col: [320, 70, 60]},
  x_lotus: {col: [330, 60, 75]},
  x_luggage_cart: {},
  x_lute: {col: [28, 45, 40]},
  x_macaron: {col: [330, 55, 78]},
  x_magic_8_ball: {},
  x_magnolia: {col: [330, 30, 88]},
  x_makeup_bag: {},
  x_manatee: {col: [210, 8, 55]},
  x_mango: {col: [35, 90, 55]},
  x_manhole: {},
  x_manta_ray: {col: [220, 15, 30]},
  x_maple_leaf: {col: [15, 80, 50]},
  x_marble: {},
  x_marionette: {},
  x_marshmallow: {},
  x_martini_glass: {},
  x_massage_gun: {},
  x_match: {},
  x_matchbox: {},
  x_matches: {},
  x_matchstick_fire: {},
  x_mayonnaise: {},
  x_measuring_jug: {},
  x_meatball: {col: [15, 45, 35]},
  x_medal_ribbon: {},
  x_medicine_bottle: {},
  x_metronome: {},
  x_metronome_clock: {},
  x_microscope: {},
  x_milk_bottle: {},
  x_milk_glass: {},
  x_mint: {col: [0, 75, 50]},
  x_mint_leaves: {},
  x_mittens_pair: {},
  x_mixing_bowl_metal: {},
  x_mobile_toy: {},
  x_mole: {col: [260, 8, 25]},
  x_monitor_lizard: {col: [60, 20, 35]},
  x_monster_truck: {},
  x_moose_animal: {col: [25, 40, 28]},
  x_mortar_and_pestle: {col: [0, 0, 50]},
  x_mosquito: {col: [30, 15, 40]},
  x_moss: {col: [100, 40, 35]},
  x_moth_insect: {col: [35, 25, 60]},
  x_mouse: {col: [0, 0, 62]},
  x_mouthguard: {},
  x_muffin_tin: {},
  x_muffin_top: {col: [30, 55, 50]},
  x_mustard: {},
  x_nail_clippers: {},
  x_nail_polish: {},
  x_narwhal: {col: [210, 10, 62]},
  x_nautilus: {col: [30, 40, 80]},
  x_neck_pillow: {},
  x_necklace: {},
  x_neon_sign: {},
  x_nerf_gun: {},
  x_newt: {col: [25, 80, 55]},
  x_nightgown: {},
  x_nutcracker: {},
  x_oil_lantern: {},
  x_onesie: {},
  x_opossum: {col: [0, 0, 65]},
  x_orangutan_ape: {col: [18, 75, 42]},
  x_orca: {col: [0, 0, 14]},
  x_orchid_plant: {},
  x_origami: {},
  x_ostrich: {col: [0, 0, 22]},
  x_otter: {col: [25, 45, 35]},
  x_oven_mitt: {},
  x_overalls: {},
  x_pacifier: {},
  x_paint_can: {},
  x_paint_spray_can: {},
  x_paint_tube: {},
  x_pallet_jack: {},
  x_panini: {col: [35, 55, 60]},
  x_paper_bag: {},
  x_paper_crane: {},
  x_paper_lantern: {},
  x_paper_plane: {},
  x_paper_sheet: {},
  x_paper_stack: {},
  x_park_seat: {col: [28, 45, 40]},
  x_parrot: {col: [130, 70, 45]},
  x_party_hat: {},
  x_peacock: {col: [210, 80, 45]},
  x_pedal_bin: {},
  x_peeler: {},
  x_pelican: {col: [0, 0, 90]},
  x_pendant: {},
  x_peony: {col: [340, 65, 70]},
  x_pet_food_bowl: {},
  x_petri_dish: {},
  x_photo_album: {},
  x_pie_dish: {},
  x_pie_slice: {col: [35, 60, 60]},
  x_pine: {},
  x_pine_cone: {col: [25, 45, 35]},
  x_pipe: {},
  x_pizza_box: {},
  x_platform_shoe: {},
  x_platypus: {col: [25, 45, 35]},
  x_playing_card: {},
  x_plunger_tool: {},
  x_pocket_watch: {},
  x_pocket_watch_chain: {},
  x_polar_bear_cub: {col: [45, 30, 92]},
  x_pool_float: {},
  x_porcupine: {col: [25, 30, 35]},
  x_possum: {col: [0, 0, 65]},
  x_pram: {},
  x_prawn: {col: [10, 70, 62]},
  x_praying_mantis: {col: [100, 55, 45]},
  x_pressure_washer: {},
  x_propane_tank: {},
  x_pudding: {col: [30, 60, 50]},
  x_puffer_jacket: {},
  x_pufferfish: {col: [45, 60, 65]},
  x_puppet: {},
  x_quad_bike: {},
  x_raccoon: {col: [210, 6, 55]},
  x_raincoat_jacket: {},
  x_rally_car: {},
  x_ram_stick: {},
  x_rat: {col: [20, 10, 45]},
  x_raven: {col: [250, 10, 14]},
  x_razor: {},
  x_rear_view_mirror: {},
  x_receipt: {},
  x_receipt_roll: {},
  x_record_player: {},
  x_recorder: {},
  x_reed: {},
  x_reindeer_animal: {col: [30, 35, 45]},
  x_rhino: {col: [210, 6, 55]},
  x_rice: {},
  x_rickshaw: {},
  x_robe: {},
  x_roller_shoe: {},
  x_roller_skate: {},
  x_rope: {col: [35, 40, 55]},
  x_rosemary: {},
  x_rowboat: {col: [28, 45, 40]},
  x_rubber_band: {},
  x_rubik_cube: {},
  x_salad_bowl_wooden: {col: [28, 45, 40]},
  x_salad_spinner: {},
  x_salt_lamp: {},
  x_sand_timer_clock: {},
  x_sandpaper: {col: [35, 40, 60]},
  x_sandwich_roll: {col: [35, 60, 60]},
  x_scissor_lift: {},
  x_scone: {col: [35, 50, 62]},
  x_scrambled_eggs: {},
  x_sea_lion: {col: [30, 30, 35]},
  x_sea_sponge: {col: [50, 75, 55]},
  x_seahorse: {col: [40, 80, 55]},
  x_seal: {col: [210, 10, 50]},
  x_segway: {},
  x_server_rack: {},
  x_serving_bowl: {},
  x_sewing_box: {},
  x_shaker: {},
  x_sharpener: {},
  x_shaver: {},
  x_shawarma: {col: [30, 55, 55]},
  x_shed: {},
  x_shin_guard: {},
  x_shoe_rack: {col: [28, 45, 40]},
  x_shoebox: {},
  x_shoelace: {},
  x_shopping_trolley: {},
  x_shot_glass: {},
  x_shower: {},
  x_shower_head: {},
  x_silverfish: {col: [210, 8, 70]},
  x_sim_card: {},
  x_singing_bowl: {},
  x_sippy_cup: {},
  x_ski: {},
  x_ski_boot: {},
  x_ski_goggles: {},
  x_skipping_rope: {},
  x_skunk: {col: [260, 10, 20]},
  x_sled: {},
  x_sleeping_mat: {},
  x_slinky: {},
  x_slot_machine: {},
  x_sloth: {col: [35, 25, 50]},
  x_smart_glasses: {},
  x_smart_ring: {},
  x_snorkel_mask: {},
  x_snow_boot: {},
  x_snow_globe: {},
  x_snowboard: {},
  x_soldering_iron: {},
  x_soundbar: {},
  x_soup_can: {},
  x_space_rocket_toy: {},
  x_spikes_shoe: {},
  x_sponge: {},
  x_spray_can: {},
  x_sprouts: {},
  x_stamp: {},
  x_star_fruit: {col: [55, 85, 60]},
  x_station_wagon_car: {},
  x_step_stool: {col: [28, 45, 40]},
  x_stick_insect: {col: [90, 30, 40]},
  x_sticker: {},
  x_sticky_note: {col: [55, 90, 65]},
  x_stingray: {col: [30, 25, 45]},
  x_stockings: {},
  x_stopwatch: {},
  x_stopwatch_sport: {},
  x_stopwatch_timer: {},
  x_stork: {col: [0, 0, 92]},
  x_street_sweeper: {},
  x_stroller: {},
  x_studio_light: {},
  x_submarine_toy: {},
  x_sugar: {},
  x_sugar_bowl: {},
  x_sundial_garden: {},
  x_surfboard: {},
  x_suspenders: {},
  x_sweatband: {},
  x_swim_cap: {},
  x_swim_goggles: {},
  x_swim_trunks: {},
  x_swimsuit: {},
  x_swordfish: {col: [215, 40, 40]},
  x_t_rex: {col: [100, 35, 40]},
  x_tadpole: {col: [80, 15, 25]},
  x_tank_top: {},
  x_tankard: {},
  x_tape_gun: {},
  x_tea_bag: {},
  x_teether: {},
  x_tiara: {},
  x_ticket: {},
  x_tights: {},
  x_tiramisu: {col: [25, 45, 35]},
  x_tissue_box: {},
  x_toothbrush_holder: {},
  x_toothpick: {col: [35, 40, 70]},
  x_torch_fire: {col: [28, 45, 40]},
  x_torch_light: {},
  x_toucan: {col: [0, 0, 15]},
  x_toy_dinosaur: {},
  x_toy_gun: {},
  x_toy_robot_dog: {},
  x_toy_soldier: {},
  x_trading_card: {},
  x_trash_bag: {},
  x_tree_stump: {col: [28, 45, 40]},
  x_triangle: {},
  x_triceratops: {col: [30, 30, 50]},
  x_trout: {col: [100, 25, 55]},
  x_truffle: {col: [20, 45, 25]},
  x_tuk_tuk: {},
  x_tupperware: {},
  x_turkey: {col: [25, 45, 35]},
  x_turntable: {},
  x_turtleneck: {},
  x_umbrella_stand: {},
  x_underwear: {},
  x_uniform: {},
  x_urinal_stall: {},
  x_usb_cable: {},
  x_usb_key: {},
  x_usb_stick: {},
  x_vape: {},
  x_ventriloquist_dummy: {},
  x_venus_flytrap: {},
  x_vest: {},
  x_video_camera: {},
  x_vine: {},
  x_vinyl_record: {},
  x_visor: {},
  x_vitamin_bottle: {},
  x_volleyball_net: {},
  x_vr_headset: {},
  x_vulture: {col: [0, 0, 25]},
  x_walkie_talkie: {},
  x_walkie_talkie_handset: {},
  x_wall_lamp: {},
  x_walrus: {col: [20, 40, 50]},
  x_washer: {},
  x_wasp_nest: {col: [35, 15, 65]},
  x_water_filter_jug: {},
  x_water_pump: {},
  x_weasel: {col: [28, 60, 45]},
  x_well: {},
  x_wetsuit: {},
  x_whale_shark: {col: [205, 40, 35]},
  x_whistle_small: {},
  x_whistle_sport: {},
  x_wig_hair: {},
  x_wind_chime: {},
  x_wind_up_toy: {},
  x_windbreaker: {},
  x_wine: {},
  x_wine_glass_bottle: {},
  x_wine_rack: {col: [28, 45, 40]},
  x_wine_tumbler: {},
  x_wolf_pup: {col: [30, 10, 55]},
  x_wood_stove: {},
  x_woodlouse: {col: [220, 8, 40]},
  x_wreath: {},
  x_xylophone_toy: {},
  x_yacht: {},
  x_yak: {col: [25, 35, 25]},
  x_yarn: {},
  x_yo_yo: {},
  x_yoga_mat: {},
  x_zippo: {},
};
// Applied here for the registry's own objects and again at the end of labels.js, which adds the ImageNet-only objects
// (i_…); `strict` (the last call) requires every listed object to exist. Idempotent.
function applyRedesign(strict) {
  for (const [id, r] of Object.entries(REDESIGN)) {
    const o = OBJECTS[id]; if (!PARTS.X[id]) throw new Error('redesign: missing builder ' + id);
    if (!o) { if (strict) throw new Error('redesign: missing object ' + id); continue; }
    if (o.visRev) continue;
    o.visPrev = o.vis; o.neutralPrev = o.neutral; o.visRev = 2; o.vis = 'X'; delete o.neutral; o.redesigned = '0.6.0';
    if (r.col) [o.h, o.s, o.l] = r.col;
    if (r.sec) o.sec = r.sec;
  }
}
applyRedesign(false);
