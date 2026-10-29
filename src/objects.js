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
OBJ('can', 'Drink can', 'bottle', L('bottle', 'can'), { al: ['can', 'soda can', 'tin can', 'milk can', 'barrel', 'rain barrel', 'drum'], nm: 'Canny' });
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
OBJ('pliers', 'Pliers', 'tool', V('handtool', { head: 'pliers' }), { al: ['pliers', 'wire cutters', 'tongs'], nm: 'Pinchy' });
OBJ('shovel', 'Shovel', 'tool', V('handtool', { head: 'shovel', len: 24 }), { al: ['shovel', 'spade', 'trowel'], nm: 'Scoopy' });
OBJ('rake', 'Rake', 'tool', V('handtool', { head: 'rake', len: 24 }), { al: ['rake', 'pitchfork'], nm: 'Raky' });
OBJ('broom', 'Broom', 'tool', V('handtool', { head: 'broom' }), { al: ['broom', 'besom'], nm: 'Sweepy' });
OBJ('mop', 'Mop', 'tool', V('handtool', { head: 'mop' }), { al: ['mop', 'swab'], nm: 'Moppy' });
OBJ('paintbrush', 'Paintbrush', 'tool', V('handtool', { head: 'brush' }), { al: ['paintbrush', 'paint brush', 'brush', 'hairbrush', 'toothbrush'], nm: 'Brushy' });
OBJ('ladder', 'Ladder', 'tool', 'D', { h: 28, al: ['ladder', 'stepladder'], nm: 'Climby' });
OBJ('wheelbarrow', 'Wheelbarrow', 'tool', 'D', { h: 0, al: ['barrow', 'wheelbarrow', 'handcart', 'shopping cart'], nm: 'Barrow' });
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
OBJ('glasses', 'Glasses', 'keys', 'D', { al: ['sunglasses', 'sunglass', 'glasses', 'spectacles', 'goggles', 'binoculars', 'loupe'], nm: 'Specs' });
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
OBJ('bear', 'Bear', 'animal', L('beast', 'bear'), { al: ['bear', 'brown bear', 'american black bear', 'ice bear', 'polar bear', 'sloth bear', 'koala', 'wombat'], nm: 'Grizz' });
OBJ('panda', 'Panda', 'animal', L('beast', 'bear'), { s: 0, l: 92, al: ['giant panda', 'panda'], nm: 'Bamboo' });
OBJ('monkey', 'Monkey', 'animal', L('beast', 'monkey'), { al: ['monkey', 'chimpanzee', 'gorilla', 'orangutan', 'baboon', 'macaque'], nm: 'Chimp' });
OBJ('hamster', 'Hamster', 'animal', V('quadruped', { body: 'round', ears: 'round', snout: 'flat', tail: 'none' }), { h: 30, al: ['hamster', 'guinea pig', 'gerbil', 'mouse (animal)'], nm: 'Nibbles' });
OBJ('horse', 'Horse', 'animal', V('quadruped', { legs: 'long', neck: 4, ears: 'pointy', snout: 'long', tail: 'tuft', mane: true }), { h: 25, al: ['horse', 'sorrel', 'pony', 'foal'], nm: 'Gallop' });
OBJ('zebra', 'Zebra', 'animal', V('quadruped', { legs: 'long', neck: 3, ears: 'pointy', snout: 'long', tail: 'tuft', pattern: 'stripes' }), { s: 0, l: 95, al: ['zebra'], nm: 'Stripes' });
OBJ('cow', 'Cow', 'animal', V('quadruped', { body: 'long', ears: 'floppy', snout: 'flat', horns: 'small', tail: 'tuft', pattern: 'patches' }), { s: 0, l: 95, al: ['ox', 'cow', 'cattle', 'bull', 'water buffalo', 'bison'], nm: 'Moo' });
OBJ('pig', 'Pig', 'animal', V('quadruped', { body: 'round', ears: 'pointy', snout: 'flat', tail: 'curly' }), { h: 345, s: 60, l: 78, al: ['hog', 'pig', 'piglet', 'wild boar', 'warthog', 'piggy bank'], nm: 'Oinky' });
OBJ('sheep', 'Sheep', 'animal', V('quadruped', { body: 'round', ears: 'floppy', snout: 'short', mane: true, tail: 'fluffy' }), { s: 0, l: 95, al: ['ram', 'sheep', 'lamb', 'bighorn'], nm: 'Woolly' });
OBJ('goat', 'Goat', 'animal', V('quadruped', { ears: 'floppy', snout: 'long', horns: 'curl', tail: 'thin' }), { h: 30, s: 15, l: 80, al: ['goat', 'ibex'], nm: 'Baa' });
OBJ('deer', 'Deer', 'animal', V('quadruped', { legs: 'long', neck: 3, ears: 'pointy', snout: 'long', horns: 'antler', tail: 'fluffy' }), { h: 28, al: ['deer', 'reindeer', 'moose', 'elk', 'impala', 'gazelle', 'hartebeest'], nm: 'Antler' });
OBJ('camel', 'Camel', 'animal', V('quadruped', { legs: 'long', neck: 5, snout: 'long', hump: true, tail: 'tuft' }), { h: 35, s: 45, l: 60, al: ['arabian camel', 'camel', 'llama', 'alpaca'], nm: 'Humpy' });
OBJ('lion', 'Lion', 'animal', V('quadruped', { ears: 'round', snout: 'short', mane: true, tail: 'tuft' }), { h: 38, al: ['lion'], nm: 'Roary' });
OBJ('tiger', 'Tiger', 'animal', V('quadruped', { ears: 'round', snout: 'short', tail: 'thin', pattern: 'stripes', body: 'long' }), { h: 28, al: ['tiger', 'jaguar', 'leopard', 'cheetah', 'snow leopard', 'cougar', 'lynx'], nm: 'Prowl' });
OBJ('fox', 'Fox', 'animal', V('quadruped', { ears: 'pointy', snout: 'long', tail: 'fluffy', pattern: 'belly' }), { h: 20, al: ['red fox', 'fox', 'kit fox', 'arctic fox', 'grey fox', 'wolf', 'timber wolf', 'coyote'], nm: 'Foxy' });
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
OBJ('shark', 'Shark', 'fish', L('fish', 'shark'), { h: 210, s: 15, l: 55, al: ['great white shark', 'tiger shark', 'hammerhead', 'shark', 'whale', 'killer whale', 'dolphin'], nm: 'Chomp' });
OBJ('jellyfish', 'Jellyfish', 'fish', L('fish', 'jelly'), { h: 300, al: ['jellyfish', 'jelly fish', 'sea anemone'], nm: 'Wobble' });
OBJ('starfish', 'Starfish', 'fish', L('fish', 'star'), { h: 15, al: ['starfish', 'sea star', 'sea urchin'], nm: 'Stella' });
OBJ('octopus', 'Octopus', 'fish', 'D', { h: 345, al: ['octopus', 'squid'], nm: 'Inky' });
OBJ('beetle', 'Beetle', 'bug', L('bug'), { al: ['beetle', 'ground beetle', 'dung beetle', 'rhinoceros beetle', 'weevil', 'cockroach', 'cricket', 'grasshopper', 'ant'], nm: 'Skitter' });
OBJ('ladybug', 'Ladybug', 'bug', 'D', { h: 0, al: ['ladybug', 'ladybird'], nm: 'Dotty' });
OBJ('bee', 'Bee', 'bug', 'D', { h: 48, al: ['bee', 'bumblebee', 'wasp', 'honeybee'], nm: 'Buzz', sig: { name: 'Sting', power: 0.9, effect: 'poison', chance: 0.65 } });
OBJ('butterfly', 'Butterfly', 'bug', L('bug', 'butterfly'), { al: ['butterfly', 'monarch', 'admiral', 'moth', 'cabbage butterfly'], nm: 'Flutter' });
OBJ('dragonfly', 'Dragonfly', 'bug', 'D', { h: 190, al: ['dragonfly', 'damselfly'], nm: 'Darter' });
OBJ('spider', 'Spider', 'bug', L('bug', 'spider'), { al: ['spider', 'tarantula', 'black widow', 'garden spider', 'spider web', 'scorpion'], nm: 'Webby' });
OBJ('snail', 'Snail', 'bug', L('bug', 'snail'), { al: ['snail', 'slug', 'conch', 'seashell'], nm: 'Slimy' });
OBJ('crab', 'Crab', 'bug', L('bug', 'crab'), { h: 8, al: ['crab', 'lobster', 'crayfish', 'dungeness crab', 'rock crab', 'king crab', 'shrimp'], nm: 'Pinch' });
OBJ('caterpillar', 'Caterpillar', 'bug', 'D', { h: 100, al: ['caterpillar', 'worm', 'centipede'], nm: 'Crawly' });
OBJ('lizard', 'Lizard', 'reptile', L('reptile'), { al: ['lizard', 'gecko', 'iguana', 'chameleon', 'crocodile', 'alligator', 'komodo dragon'], nm: 'Scaly' });
OBJ('frog', 'Frog', 'reptile', L('reptile', 'frog'), { al: ['frog', 'bullfrog', 'tree frog', 'toad'], nm: 'Croak' });
OBJ('turtle', 'Turtle', 'reptile', L('reptile', 'turtle'), { al: ['turtle', 'tortoise', 'box turtle', 'terrapin', 'loggerhead'], nm: 'Shelly' });
OBJ('snake', 'Snake', 'reptile', L('reptile', 'snake'), { al: ['snake', 'python', 'cobra', 'boa constrictor', 'viper'], nm: 'Hiss' });

/* ===== toys, sport, music ===== */
OBJ('teddy', 'Teddy bear', 'toy', L('toy'), { al: ['teddy', 'teddy bear', 'stuffed animal', 'plush toy', 'doll'], nm: 'Teddy' });
OBJ('robot_toy', 'Toy robot', 'toy', 'D', { h: 210, s: 10, l: 70, al: ['robot', 'toy robot', 'action figure'], nm: 'Bleep' });
OBJ('rubber_duck', 'Rubber duck', 'toy', 'D', { h: 52, al: ['rubber duck', 'rubber duckie', 'bath toy'], nm: 'Squeak' });
OBJ('kite', 'Kite', 'toy', 'D', { al: ['kite'], nm: 'Soary' });
OBJ('balloon', 'Balloon', 'toy', V('produce', { shape: 'tall', top: 'none' }), { h: 0, al: ['balloon', 'balloons'], nm: 'Floaty' });
OBJ('puzzle', 'Jigsaw puzzle', 'toy', V('storage', { w: 24, h: 20, drawers: 2 }), { al: ['jigsaw puzzle', 'puzzle', 'rubik\'s cube', 'board game', 'dice', 'playing cards'], nm: 'Piecey' });
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

/* ---------- build the vocabulary objects (family tier) ---------- */
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
(function addExtras() {
  for (const [cat, list] of Object.entries(VOCAB_EXTRA)) {
    for (const raw of list.split(',')) {
      const label = raw.trim(); if (!label) continue;
      const id = 'x_' + slug(label);
      if (OBJECTS[id]) continue;
      OBJ(id, label.replace(/^./, c => c.toUpperCase()), cat, null, { al: [label] });
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
function visualSource(o) { return o && o.vis && o.vis.like && OBJECTS[o.vis.like] ? OBJECTS[o.vis.like] : o; }
function objectTier(o) {
  if (!o) return 'family';
  if (o.vis && o.vis.like) return 'related';
  if (o.vis === 'D' || (o.vis && o.vis.legacy)) return 'dedicated';
  if (o.vis && o.vis.t) return 'composed';
  return 'family';
}
// Resolve any recogniser label (a whole ImageNet class string, a COCO name or a vocabulary label) to an object id.
function objectForLabel(label) {
  if (!label) return null;
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
