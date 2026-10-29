/* SNAPMON — static game data: rarities, families, object categories, weapons, items, research, quests. */
'use strict';

const RARITIES = [
  { id: 'common',    name: 'Common',    color: '#a9b4c6', mult: 1.00, hpMult: 1.00, capture: 0.90, xp: 1.0, weight: 46, lvl: [0, 0], tier: 0 },
  { id: 'uncommon',  name: 'Uncommon',  color: '#62d87a', mult: 1.10, hpMult: 1.12, capture: 0.75, xp: 1.3, weight: 28, lvl: [0, 1], tier: 1 },
  { id: 'rare',      name: 'Rare',      color: '#4fb0ff', mult: 1.32, hpMult: 1.32, capture: 0.55, xp: 1.8, weight: 20, lvl: [0, 1], tier: 2 },
  { id: 'epic',      name: 'Epic',      color: '#c977ff', mult: 1.50, hpMult: 1.55, capture: 0.36, xp: 2.6, weight: 5,  lvl: [1, 2], tier: 3 },
  { id: 'legendary', name: 'Legendary', color: '#ffbe3b', mult: 1.70, hpMult: 1.90, capture: 0.22, xp: 4.0, weight: 1,  lvl: [1, 3], tier: 4 },
];
const RARITY = Object.fromEntries(RARITIES.map(r => [r.id, r]));

/* Weapon damage elements */
const ELEMENTS = {
  slash:     { name: 'Slash',     color: '#e8d6a8' },
  ballistic: { name: 'Ballistic', color: '#7ff0ff' },
  arcane:    { name: 'Arcane',    color: '#c48bff' },
  shock:     { name: 'Shock',     color: '#ffe55c' },
  toxic:     { name: 'Toxic',     color: '#8dff6a' },
};

const FAMILIES = {
  organic:    { name: 'Organic',    color: '#e8946a', glyph: '♣', hp: 1.10, atk: 1.00, def: 0.95, spd: 1.00, weak: ['toxic', 'slash'], resist: ['arcane'], mat: 'goo',
                abilities: [ { name: 'Gnash', power: 1.25 }, { name: 'Leech Bite', power: 0.85, effect: 'drain' }, { name: 'Musk Spray', power: 0.6, effect: 'defdown', chance: 0.7 } ] },
  mechanical: { name: 'Mechanical', color: '#9db6cf', glyph: '⚙', hp: 0.95, atk: 1.05, def: 1.20, spd: 0.90, weak: ['shock'], resist: ['toxic', 'slash'], mat: 'scrap',
                abilities: [ { name: 'Laser Zap', power: 1.05, effect: 'burn', chance: 0.3 }, { name: 'Overclock', power: 0, effect: 'atkup', self: true }, { name: 'Short Circuit', power: 0.8, effect: 'stun', chance: 0.3 } ] },
  elemental:  { name: 'Elemental',  color: '#6fd3ff', glyph: '✦', hp: 0.95, atk: 1.15, def: 0.90, spd: 1.10, weak: ['arcane'], resist: ['shock'], mat: 'ecto',
                abilities: [ { name: 'Flare', power: 1.0, effect: 'burn', chance: 0.45 }, { name: 'Frost Snap', power: 0.9, effect: 'defdown', chance: 0.45 }, { name: 'Static Pulse', power: 0.75, effect: 'stun', chance: 0.25 } ] },
  household:  { name: 'Household',  color: '#e7c77d', glyph: '⌂', hp: 1.15, atk: 0.95, def: 1.10, spd: 0.85, weak: ['slash'], resist: ['ballistic'], mat: 'scrap',
                abilities: [ { name: 'Body Slam', power: 1.3 }, { name: 'Dust Cloud', power: 0.55, effect: 'defdown', chance: 0.7 }, { name: 'Rattle', power: 0, effect: 'defup', self: true } ] },
  food:       { name: 'Food',       color: '#ff8a5c', glyph: '◕', hp: 1.05, atk: 1.00, def: 0.90, spd: 1.05, weak: ['toxic', 'ballistic'], resist: ['shock'], mat: 'goo',
                abilities: [ { name: 'Sour Spit', power: 0.9, effect: 'poison', chance: 0.5 }, { name: 'Sugar Rush', power: 0, effect: 'atkup', self: true }, { name: 'Greasy Slap', power: 1.15 } ] },
  botanical:  { name: 'Botanical',  color: '#7fdc6a', glyph: '❦', hp: 1.10, atk: 0.95, def: 1.00, spd: 0.95, weak: ['slash'], resist: ['toxic'], mat: 'goo',
                abilities: [ { name: 'Thorn Whip', power: 1.0, effect: 'poison', chance: 0.4 }, { name: 'Photosynthesis', power: 0, effect: 'heal', self: true }, { name: 'Root Bind', power: 0.7, effect: 'stun', chance: 0.3 } ] },
  spectral:   { name: 'Spectral',   color: '#b9a6ff', glyph: '☾', hp: 0.90, atk: 1.10, def: 0.95, spd: 1.15, weak: ['ballistic', 'arcane'], resist: ['slash', 'toxic'], mat: 'ecto',
                abilities: [ { name: 'Haunt', power: 1.0, effect: 'defdown', chance: 0.4 }, { name: 'Banshee Wail', power: 0.8, effect: 'stun', chance: 0.25 }, { name: 'Soul Siphon', power: 0.9, effect: 'drain' } ] },
  mutated:    { name: 'Mutated',    color: '#c3ff4f', glyph: '☣', hp: 1.10, atk: 1.15, def: 0.90, spd: 0.95, weak: ['arcane', 'shock'], resist: ['toxic'], mat: 'goo',
                abilities: [ { name: 'Acid Spew', power: 0.95, effect: 'poison', chance: 0.55 }, { name: 'Tentacle Flurry', power: 0.45, hits: 3 }, { name: 'Unstable Growth', power: 0, effect: 'atkup', self: true } ] },
};
const NATIVE_FAMILIES = ['organic', 'mechanical', 'elemental', 'household', 'food', 'botanical', 'spectral', 'mutated'];

/* Object categories. hue: base body hue (deg), sat/lit tweak; shape: sprite builder id. kw: keywords matched against
   typed names and (optional) AI-lens labels. sig: the category's signature ability. */
const CATEGORIES = [
  { id: 'toilet',  name: 'Toilet',         icon: '🚽', fam: 'household',  shape: 'toilet',  hue: 205, sat: 18, lit: 88, acc: 200, names: ['Flush', 'Porce', 'Plunj', 'Loo', 'Bidet'], kw: ['toilet', 'loo', 'commode', 'wc', 'potty', 'urinal'],
    sig: { name: 'Flush Vortex', power: 1.25, effect: 'stun', chance: 0.25 }, flavor: 'It gurgles hungrily whenever someone forgets to close the lid.' },
  { id: 'mug',     name: 'Mug / Cup',      icon: '☕', fam: 'food',       shape: 'mug',     hue: -1,  sat: 55, lit: 62, acc: 25, names: ['Mug', 'Brew', 'Latte', 'Java', 'Bean'], kw: ['mug', 'cup', 'coffee', 'tea', 'espresso', 'teapot', 'glass', 'beaker'],
    sig: { name: 'Scalding Splash', power: 1.0, effect: 'burn', chance: 0.55 }, flavor: 'Runs on pure caffeine. Has not slept since it was fired in the kiln.' },
  { id: 'shoe',    name: 'Shoe',           icon: '👟', fam: 'organic',    shape: 'shoe',    hue: 25,  sat: 45, lit: 45, acc: 0, names: ['Sneak', 'Stomp', 'Lace', 'Heel', 'Sole'], kw: ['shoe', 'sneaker', 'boot', 'sandal', 'loafer', 'clog', 'slipper', 'heel', 'trainer', 'cowboy boot'],
    sig: { name: 'Sneaky Stomp', power: 1.35 }, flavor: 'Hunts in pairs. If you ever lost one sock, this is why.' },
  { id: 'plant',   name: 'Plant / Flower', icon: '🪴', fam: 'botanical',  shape: 'plant',   hue: 110, sat: 55, lit: 45, acc: 18, names: ['Fern', 'Thorn', 'Leafy', 'Sprout', 'Vine'], kw: ['plant', 'flower', 'pot', 'flowerpot', 'cactus', 'fern', 'leaf', 'daisy', 'rose', 'vase', 'succulent', 'herb', 'grass', 'mushroom'],
    sig: { name: 'Thorn Lash', power: 1.05, effect: 'poison', chance: 0.5 }, flavor: 'Leans toward the window by day. Leans toward you by night.' },
  { id: 'laptop',  name: 'Laptop / PC',    icon: '💻', fam: 'mechanical', shape: 'laptop',  hue: 215, sat: 10, lit: 70, acc: 195, names: ['Byte', 'Pixel', 'Lappy', 'Glitch', 'Kernel'], kw: ['laptop', 'computer', 'notebook', 'keyboard', 'monitor', 'desktop', 'pc', 'mouse', 'printer', 'tablet'],
    sig: { name: 'Blue Screen', power: 0.85, effect: 'stun', chance: 0.4 }, flavor: 'Installs updates at the worst possible moment out of pure spite.' },
  { id: 'banana',  name: 'Banana',         icon: '🍌', fam: 'food',       shape: 'banana',  hue: 52,  sat: 90, lit: 60, acc: 30, names: ['Nana', 'Peel', 'Bunch', 'Split', 'Plantain'], kw: ['banana', 'plantain'],
    sig: { name: 'Slippery Peel', power: 0.7, effect: 'stun', chance: 0.45 }, flavor: 'Ripens into something far more dangerous than a slipping hazard.' },
  { id: 'sofa',    name: 'Sofa / Couch',   icon: '🛋️', fam: 'household',  shape: 'sofa',    hue: -1,  sat: 40, lit: 50, acc: 40, names: ['Couch', 'Cushion', 'Lounge', 'Futon', 'Divan'], kw: ['sofa', 'couch', 'futon', 'armchair', 'studio couch', 'loveseat', 'ottoman', 'recliner'],
    sig: { name: 'Cushion Swallow', power: 0.95, effect: 'drain' }, flavor: 'Every coin, remote and TV snack you ever lost lives inside it.' },
  { id: 'phone',   name: 'Phone',          icon: '📱', fam: 'mechanical', shape: 'phone',   hue: 240, sat: 8,  lit: 22, acc: 280, names: ['Ring', 'Swipe', 'Buzz', 'Selfie', 'Dial'], kw: ['phone', 'smartphone', 'cellular', 'mobile', 'iphone', 'telephone', 'dial', 'ipod', 'remote control', 'remote'],
    sig: { name: 'Notification Spam', power: 0.42, hits: 3 }, flavor: 'Feeds on your attention span. It is very, very well fed.' },
  { id: 'bottle',  name: 'Bottle',         icon: '🍾', fam: 'elemental',  shape: 'bottle',  hue: 190, sat: 60, lit: 60, acc: 0, names: ['Fizz', 'Splash', 'Gulp', 'Cap', 'Aqua'], kw: ['bottle', 'water', 'flask', 'can', 'jar', 'jug', 'thermos', 'soda', 'beer', 'wine', 'pop bottle', 'water bottle', 'pill bottle'],
    sig: { name: 'Pressure Burst', power: 1.15, effect: 'defdown', chance: 0.5 }, flavor: 'Shake it once and it remembers you forever.' },
  { id: 'book',    name: 'Book / Paper',   icon: '📕', fam: 'spectral',   shape: 'book',    hue: -1,  sat: 45, lit: 38, acc: 45, names: ['Tome', 'Grim', 'Page', 'Codex', 'Inkwyrm'], kw: ['book', 'paper', 'notebook', 'magazine', 'newspaper', 'comic', 'binder', 'letter', 'envelope', 'book jacket', 'menu'],
    sig: { name: 'Papercut Storm', power: 0.4, hits: 3 }, flavor: 'Overdue library books eventually become this. Return yours.' },
  { id: 'lamp',    name: 'Lamp / Light',   icon: '💡', fam: 'elemental',  shape: 'lamp',    hue: 45,  sat: 70, lit: 62, acc: 50, names: ['Lumen', 'Glare', 'Bulb', 'Shade', 'Flick'], kw: ['lamp', 'light', 'bulb', 'lantern', 'lampshade', 'torch', 'flashlight', 'spotlight', 'chandelier'],
    sig: { name: 'Blinding Glare', power: 0.8, effect: 'stun', chance: 0.35 }, flavor: 'Moths worship it. That should have been your first warning.' },
  { id: 'chair',   name: 'Chair / Table',  icon: '🪑', fam: 'household',  shape: 'chair',   hue: 30,  sat: 45, lit: 42, acc: 30, names: ['Stool', 'Perch', 'Squeak', 'Rocker', 'Throne'], kw: ['chair', 'stool', 'bench', 'table', 'desk', 'rocking chair', 'barber chair', 'folding chair', 'throne', 'shelf', 'cabinet', 'drawer', 'wardrobe'],
    sig: { name: 'Leg Sweep', power: 1.0, effect: 'stun', chance: 0.25 }, flavor: 'Pulled out from under more people than any prankster in history.' },
  { id: 'car',     name: 'Car / Vehicle',  icon: '🚗', fam: 'mechanical', shape: 'car',     hue: -1,  sat: 70, lit: 48, acc: 50, names: ['Vroom', 'Honk', 'Torque', 'Piston', 'Muffler'], kw: ['car', 'truck', 'bus', 'van', 'bike', 'bicycle', 'motorcycle', 'scooter', 'vehicle', 'taxi', 'jeep', 'wheel', 'tire', 'sports car', 'minivan', 'tractor'],
    sig: { name: 'Road Rage', power: 1.5 }, flavor: 'Its horn is not a warning. It is a battle cry.' },
  { id: 'animal',  name: 'Pet / Animal',   icon: '🐈', fam: 'organic',    shape: 'beast',   hue: -1,  sat: 35, lit: 50, acc: 340, names: ['Furr', 'Whisk', 'Paw', 'Fang', 'Snoot'], kw: ['cat', 'dog', 'pet', 'animal', 'bird', 'hamster', 'rabbit', 'fish', 'horse', 'cow', 'tabby', 'retriever', 'terrier', 'puppy', 'kitten', 'pigeon', 'duck'],
    sig: { name: 'Feral Pounce', power: 1.3 }, flavor: 'Not your pet. Something wearing your pet as a costume.' },
  { id: 'tree',    name: 'Tree / Wood',    icon: '🌳', fam: 'botanical',  shape: 'tree',    hue: 125, sat: 50, lit: 35, acc: 28, names: ['Bark', 'Oak', 'Timber', 'Root', 'Sap'], kw: ['tree', 'wood', 'log', 'branch', 'stick', 'bush', 'hedge', 'forest', 'oak', 'pine', 'palm', 'stump'],
    sig: { name: 'Timber!', power: 1.6 }, flavor: 'If it falls in the forest and nobody hears it, it was hunting.' },
  { id: 'food',    name: 'Meal / Snack',   icon: '🍔', fam: 'food',       shape: 'burger',  hue: 30,  sat: 60, lit: 50, acc: 8, names: ['Chomp', 'Grub', 'Munch', 'Patty', 'Crust'], kw: ['food', 'pizza', 'burger', 'cheeseburger', 'sandwich', 'hotdog', 'hot dog', 'cake', 'bread', 'cookie', 'donut', 'meal', 'plate', 'pasta', 'snack', 'chips', 'bagel', 'pretzel', 'taco', 'sushi', 'ice cream', 'chocolate', 'candy'],
    sig: { name: 'Grease Fire', power: 1.0, effect: 'burn', chance: 0.5 }, flavor: 'Wants to be eaten. Specifically, it wants to eat you first.' },
  { id: 'fruit',   name: 'Fruit / Veg',    icon: '🍎', fam: 'food',       shape: 'fruit',   hue: -1,  sat: 75, lit: 50, acc: 110, names: ['Apple', 'Pulp', 'Rind', 'Pip', 'Jam'], kw: ['apple', 'orange', 'lemon', 'fruit', 'pear', 'peach', 'grape', 'strawberry', 'tomato', 'potato', 'onion', 'carrot', 'pepper', 'vegetable', 'melon', 'pineapple', 'avocado', 'cucumber', 'broccoli', 'cabbage', 'pumpkin', 'egg'],
    sig: { name: 'Rotten Core', power: 0.95, effect: 'poison', chance: 0.6 }, flavor: 'One bad apple spoils the bunch. This is the bad apple.' },
  { id: 'cloth',   name: 'Clothing',       icon: '👕', fam: 'spectral',   shape: 'cloth',   hue: -1,  sat: 50, lit: 58, acc: 0, names: ['Sock', 'Hoodie', 'Lint', 'Sleeve', 'Drape'], kw: ['shirt', 'clothing', 'clothes', 'sock', 'hoodie', 'jacket', 'coat', 'dress', 'pants', 'jeans', 'hat', 'cap', 'scarf', 'towel', 'blanket', 'curtain', 'jersey', 'sweatshirt', 'cardigan', 'glove', 'tie', 'sombrero', 'cowboy hat'],
    sig: { name: 'Smother', power: 0.9, effect: 'drain' }, flavor: 'Floats out of the laundry pile at 3 a.m. looking for its missing half.' },
  { id: 'tool',    name: 'Tool',           icon: '🔧', fam: 'mechanical', shape: 'tool',    hue: 0,   sat: 70, lit: 45, acc: 210, names: ['Wrench', 'Bolt', 'Clamp', 'Rivet', 'Drill'], kw: ['tool', 'wrench', 'hammer', 'screwdriver', 'drill', 'saw', 'pliers', 'scissors', 'knife', 'toolbox', 'nail', 'screw', 'tape', 'broom', 'mop', 'shovel', 'rake', 'spatula', 'ladle', 'fork', 'spoon', 'pan', 'pot ', 'frying pan', 'wok'],
    sig: { name: 'Nail Gun', power: 0.45, hits: 3 }, flavor: 'Fixes nothing. Breaks everything. Takes its time doing both.' },
  { id: 'toy',     name: 'Toy / Game',     icon: '🧸', fam: 'mutated',    shape: 'toy',     hue: 28,  sat: 50, lit: 55, acc: 330, names: ['Teddy', 'Plush', 'Squeaky', 'Button', 'Dolly'], kw: ['toy', 'teddy', 'doll', 'plush', 'ball', 'lego', 'game', 'puzzle', 'balloon', 'action figure', 'robot', 'kite', 'controller', 'joystick', 'dice', 'cards', 'teddy bear'],
    sig: { name: 'Stuffing Burst', power: 0.8, effect: 'defdown', chance: 0.65 }, flavor: 'Its button eyes moved. They definitely moved.' },
  { id: 'trash',   name: 'Trash / Bin',    icon: '🗑️', fam: 'mutated',    shape: 'bin',     hue: 140, sat: 18, lit: 40, acc: 85, names: ['Rubb', 'Grime', 'Bin', 'Litter', 'Muck'], kw: ['trash', 'bin', 'garbage', 'waste', 'rubbish', 'dumpster', 'recycling', 'bag', 'plastic bag', 'ashcan', 'trash can'],
    sig: { name: 'Stench Cloud', power: 0.75, effect: 'poison', chance: 0.75 }, flavor: 'Raccoons fear it. You should too.' },
  { id: 'mirror',  name: 'Mirror / Window', icon: '🪞', fam: 'spectral',  shape: 'mirror',  hue: 200, sat: 30, lit: 72, acc: 45, names: ['Mirr', 'Glint', 'Visage', 'Echo', 'Vanity'], kw: ['mirror', 'window', 'glass', 'reflection', 'screen door', 'window shade', 'frame', 'picture', 'painting', 'photo'],
    sig: { name: 'Cursed Reflection', power: 0.95, effect: 'defdown', chance: 0.6 }, flavor: 'Your reflection blinked first. That was not you.' },
  { id: 'fridge',  name: 'Fridge / Appliance', icon: '🧊', fam: 'elemental', shape: 'fridge', hue: 195, sat: 25, lit: 80, acc: 190, names: ['Frost', 'Chill', 'Fridj', 'Rime', 'Icebox'], kw: ['fridge', 'refrigerator', 'freezer', 'microwave', 'oven', 'stove', 'washer', 'washing machine', 'dishwasher', 'toaster', 'kettle', 'blender', 'appliance', 'heater', 'fan', 'air conditioner', 'vacuum', 'iron', 'dryer', 'ice'],
    sig: { name: 'Deep Freeze', power: 0.85, effect: 'stun', chance: 0.35 }, flavor: 'The light inside does not turn off when the door closes. It watches.' },
  { id: 'candle',  name: 'Candle / Fire',  icon: '🕯️', fam: 'elemental',  shape: 'candle',  hue: 20,  sat: 70, lit: 75, acc: 25, names: ['Wick', 'Ember', 'Wax', 'Pyre', 'Cinder'], kw: ['candle', 'fire', 'flame', 'match', 'lighter', 'fireplace', 'bonfire', 'campfire', 'grill', 'bbq'],
    sig: { name: 'Wax Inferno', power: 1.0, effect: 'burn', chance: 0.65 }, flavor: 'Blow it out and it simply relights itself, angrier.' },
  { id: 'clock',   name: 'Clock / Watch',  icon: '⏰', fam: 'spectral',   shape: 'clock',   hue: 40,  sat: 55, lit: 55, acc: 0, names: ['Tick', 'Tock', 'Chrono', 'Cuckoo', 'Dial'], kw: ['clock', 'watch', 'timer', 'alarm', 'stopwatch', 'hourglass', 'sundial', 'wall clock', 'digital clock', 'analog clock'],
    sig: { name: 'Time Skip', power: 0.9, effect: 'stun', chance: 0.35 }, flavor: 'Steals five minutes from every morning. It has been saving up.' },
  { id: 'keys',    name: 'Keys / Small item', icon: '🔑', fam: 'mechanical', shape: 'key',  hue: 45,  sat: 65, lit: 55, acc: 0, names: ['Jingle', 'Lock', 'Skelly', 'Latch', 'Keyring'], kw: ['key', 'keys', 'lock', 'padlock', 'coin', 'wallet', 'ring', 'jewelry', 'necklace', 'pen', 'pencil', 'battery', 'charger', 'cable', 'headphones', 'earbuds', 'glasses', 'sunglasses', 'lipstick', 'comb', 'brush', 'toothbrush'],
    sig: { name: 'Jingle Jab', power: 0.45, hits: 3 }, flavor: 'Hides itself whenever you are late. Every single time.' },
  { id: 'bag',     name: 'Bag / Box',      icon: '🎒', fam: 'organic',    shape: 'bag',     hue: -1,  sat: 45, lit: 45, acc: 40, names: ['Satchel', 'Zip', 'Tote', 'Pouch', 'Parcel'], kw: ['bag', 'backpack', 'purse', 'handbag', 'suitcase', 'box', 'carton', 'package', 'parcel', 'basket', 'crate', 'briefcase', 'luggage', 'mailbag'],
    sig: { name: 'Zipper Bite', power: 1.15, effect: 'defdown', chance: 0.45 }, flavor: 'Has a pocket you have never found. Something lives in that pocket.' },
  { id: 'pillow',  name: 'Bed / Pillow',   icon: '🛏️', fam: 'household',  shape: 'pillow',  hue: -1,  sat: 35, lit: 72, acc: 260, names: ['Snooze', 'Fluff', 'Pillo', 'Duvet', 'Nap'], kw: ['bed', 'pillow', 'mattress', 'duvet', 'quilt', 'sheet', 'cushion', 'bean bag', 'hammock', 'crib', 'sleeping bag'],
    sig: { name: 'Lullaby', power: 0.6, effect: 'stun', chance: 0.5 }, flavor: 'Lures victims with "just five more minutes".' },
  { id: 'faucet',  name: 'Sink / Bath',    icon: '🚿', fam: 'elemental',  shape: 'faucet',  hue: 210, sat: 15, lit: 75, acc: 195, names: ['Drip', 'Spout', 'Drain', 'Gurgle', 'Splosh'], kw: ['sink', 'faucet', 'tap', 'bath', 'bathtub', 'tub', 'shower', 'drain', 'hose', 'pipe', 'soap', 'sponge', 'bucket'],
    sig: { name: 'Drip Torture', power: 0.4, hits: 3 }, flavor: 'Drip. Drip. Drip. It knows exactly how long you can take it.' },
  { id: 'tv',      name: 'TV / Screen',    icon: '📺', fam: 'mechanical', shape: 'tv',      hue: 260, sat: 12, lit: 30, acc: 170, names: ['Telly', 'Static', 'Channel', 'Tubey', 'Rerun'], kw: ['tv', 'television', 'screen', 'console', 'speaker', 'radio', 'projector', 'camera', 'stereo', 'router', 'modem', 'entertainment center'],
    sig: { name: 'Static Storm', power: 0.9, effect: 'stun', chance: 0.3 }, flavor: 'Channel 0 never shows anything. Unless you are alone.' },
  { id: 'bird',    name: 'Bird',           icon: '🐦', fam: 'organic',    shape: 'bird',    hue: -1,  sat: 55, lit: 55, acc: 40, names: ['Tweet', 'Feather', 'Beak', 'Squawk', 'Plume'], kw: ['bird', 'parrot', 'pigeon', 'owl', 'duck', 'goose', 'chicken', 'crow', 'sparrow', 'penguin'],
    sig: { name: 'Dive Bomb', power: 1.35 }, flavor: 'It is not singing at dawn. It is summoning.' },
  { id: 'fish',    name: 'Fish / Sea life', icon: '🐟', fam: 'elemental', shape: 'fish',    hue: -1,  sat: 60, lit: 55, acc: 200, names: ['Gill', 'Fin', 'Splosh', 'Scale', 'Gulp'], kw: ['fish', 'shark', 'goldfish', 'whale', 'jellyfish', 'starfish', 'aquarium'],
    sig: { name: 'Tidal Slap', power: 1.0, effect: 'defdown', chance: 0.45 }, flavor: 'The goldfish has been plotting for three seconds at a time, forever.' },
  { id: 'bug',     name: 'Bug / Critter',  icon: '🐞', fam: 'mutated',    shape: 'bug',     hue: -1,  sat: 60, lit: 42, acc: 0, names: ['Skitter', 'Buzz', 'Crawl', 'Mandi', 'Chitin'], kw: ['bug', 'insect', 'beetle', 'spider', 'ant', 'bee', 'butterfly', 'crab', 'snail', 'ladybug'],
    sig: { name: 'Venom Nip', power: 0.9, effect: 'poison', chance: 0.6 }, flavor: 'For every human there are a million of these. They have noticed.' },
  { id: 'reptile', name: 'Reptile / Frog', icon: '🦎', fam: 'organic',    shape: 'reptile', hue: 110, sat: 50, lit: 42, acc: 60, names: ['Scaly', 'Croak', 'Hiss', 'Slither', 'Shell'], kw: ['lizard', 'snake', 'frog', 'turtle', 'tortoise', 'gecko', 'toad', 'crocodile'],
    sig: { name: 'Cold-Blooded Bite', power: 1.1, effect: 'poison', chance: 0.35 }, flavor: 'Basks under your desk lamp. Dreams of when it was a dinosaur.' },
  { id: 'umbrella', name: 'Umbrella',      icon: '☂️', fam: 'household',  shape: 'umbrella', hue: -1, sat: 65, lit: 48, acc: 30, names: ['Brolly', 'Canopy', 'Drizzle', 'Parasol', 'Spoke'], kw: ['umbrella', 'parasol', 'parachute'],
    sig: { name: 'Spoke Jab', power: 0.45, hits: 3 }, flavor: 'Opens indoors on purpose. That is where the bad luck comes from.' },
  { id: 'instrument', name: 'Instrument',  icon: '🎸', fam: 'spectral',   shape: 'instrument', hue: 28, sat: 60, lit: 45, acc: 45, names: ['Strum', 'Tuba', 'Chord', 'Drumm', 'Sonata'], kw: ['guitar', 'piano', 'drum', 'violin', 'trumpet', 'flute', 'saxophone', 'instrument', 'harp', 'ukulele'],
    sig: { name: 'Haunting Chord', power: 0.85, effect: 'stun', chance: 0.35 }, flavor: 'Plays itself at midnight. Always slightly out of tune.' },
  { id: 'ball',    name: 'Ball',           icon: '⚽', fam: 'household',  shape: 'ball',    hue: -1,  sat: 70, lit: 52, acc: 0, names: ['Bounce', 'Dribbl', 'Spinn', 'Kick', 'Lob'], kw: ['ball', 'football', 'soccer', 'basketball', 'tennis ball', 'baseball', 'volleyball', 'golf ball'],
    sig: { name: 'Ricochet', power: 0.5, hits: 3 }, flavor: 'Rolls under the sofa on purpose. It likes the dark down there.' },
  { id: 'pot',     name: 'Pot / Pan / Bowl', icon: '🍳', fam: 'household', shape: 'pot',    hue: 220, sat: 10, lit: 40, acc: 20, names: ['Simmer', 'Skillet', 'Wok', 'Ladle', 'Stew'], kw: ['pan', 'frying pan', 'wok', 'bowl', 'plate', 'saucepan', 'cauldron', 'dish', 'tray'],
    sig: { name: 'Boiling Over', power: 1.0, effect: 'burn', chance: 0.5 }, flavor: 'A watched pot never boils. An unwatched one crawls away.' },
  { id: 'cake',    name: 'Cake / Dessert', icon: '🍰', fam: 'food',       shape: 'cake',    hue: 330, sat: 60, lit: 72, acc: 30, names: ['Frost', 'Sprinkl', 'Gateau', 'Sugar', 'Fondant'], kw: ['cake', 'donut', 'doughnut', 'cupcake', 'ice cream', 'dessert', 'muffin', 'pie'],
    sig: { name: 'Sugar Crash', power: 0.7, effect: 'stun', chance: 0.4 }, flavor: 'Every birthday wish ever made went into it. Most were selfish.' },
  { id: 'other',   name: 'Oddity',         icon: '❔', fam: null,        shape: null,      hue: -1,  sat: 55, lit: 52, acc: 0, names: [], kw: [],
    sig: { name: 'Uncanny Strike', power: 1.15, effect: 'defdown', chance: 0.3 }, flavor: 'Even hunters are not sure what this one was pretending to be.' },
];
const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const SUFFIX = {
  common:    ['ling', 'let', 'bit', 'kin', 'y', 'ette'],
  uncommon:  ['mon', 'ster', 'grub', 'bug', 'nik', 'imp'],
  rare:      ['goyle', 'fiend', 'wraith', 'beast', 'gloom', 'hex'],
  epic:      ['zilla', 'geist', 'tron', 'osaur', 'drake', 'naught'],
  legendary: ['archon', 'omega', 'rex', 'ultimus', 'colossus', 'sovereign'],
};
const LEGEND_TITLES = {
  organic: 'the Primordial', mechanical: 'the Last Machine', elemental: 'the Living Storm', household: 'the House That Breathes',
  food: 'the Eternal Feast', botanical: 'the Elder Root', spectral: 'the Unseen King', mutated: 'the Abomination',
};

/* Weapons — base stats, distinct damage behaviour, and visual effect id */
const WEAPONS = {
  sword:  { name: 'Rusty Hunter Sword', el: 'slash', atk: 6, acc: 0.95, crit: 0.08, critX: 1.75, fx: 'slash',
            desc: 'Reliable all-rounder. Special cleaves armour.', special: { name: 'Rusty Cleave', power: 2.0, cost: 40, effect: 'defdown', chance: 0.6 },
            unlock: null },
  pistol: { name: 'Ghostbuster Pistol', el: 'ballistic', atk: 5, acc: 1.0, crit: 0.05, critX: 1.6, hits: 2, hitPow: 0.6, fx: 'bullet',
            desc: 'Double-tap that never misses. Shreds spectral foes.', special: { name: 'Proton Stream', power: 2.2, cost: 45, sure: true },
            unlock: { lvl: 2, coins: 60, scrap: 25 } },
  dagger: { name: 'Cursed Dagger', el: 'toxic', atk: 4, acc: 0.97, crit: 0.25, critX: 2.1, poison: 0.35, fx: 'hex',
            desc: 'Weak hits, brutal crits, and lingering poison.', special: { name: 'Hex Flurry', power: 0.8, hits: 3, cost: 40, effect: 'poison', chance: 0.7 },
            unlock: { lvl: 3, coins: 90, goo: 25, ecto: 10 } },
  wand:   { name: 'Arcane Wand', el: 'arcane', atk: 7, acc: 0.95, crit: 0.06, critX: 1.75, pierce: 0.4, fx: 'orb',
            desc: 'Magic ignores 40% of armour. Special sets foes ablaze.', special: { name: 'Arcane Nova', power: 2.4, cost: 50, effect: 'burn', chance: 0.6 },
            unlock: { lvl: 4, coins: 130, ecto: 25, goo: 15 } },
  hammer: { name: 'Thunder Hammer', el: 'shock', atk: 10, acc: 0.82, crit: 0.10, critX: 1.8, stun: 0.15, fx: 'bolt',
            desc: 'Huge hits that may miss. Can stun.', special: { name: 'Thunderclap', power: 2.6, cost: 60, effect: 'stun', chance: 0.5 },
            unlock: { lvl: 6, coins: 200, scrap: 50, prism: 2 } },
};
const WEAPON_ORDER = ['sword', 'pistol', 'dagger', 'wand', 'hammer'];

/* Charms — equippable trinkets dropped by monsters */
const CHARMS = {
  sock:    { name: 'Lucky Odd Sock',   desc: '+6% critical chance' },
  plate:   { name: 'Porcelain Plating', desc: '+4 defense' },
  lenscap: { name: 'Spirit Lens Cap',  desc: '+6% capture chance' },
  slipper: { name: 'Haste Slippers',   desc: '+4 speed, flee more easily' },
  fang:    { name: 'Vampire Fang',     desc: 'Heal 15% of damage you deal' },
  battery: { name: 'Spare Battery',    desc: 'Start battles with +25 energy' },
};
const CHARM_ORDER = Object.keys(CHARMS);

const MATERIALS = {
  coins: { name: 'Spirit Coins', short: 'Coins', color: '#ffd45e' },
  scrap: { name: 'Haunted Scrap', short: 'Scrap', color: '#b7c6d8' },
  goo:   { name: 'Monster Goo',   short: 'Goo',   color: '#9cff6b' },
  ecto:  { name: 'Ectoplasm',     short: 'Ecto',  color: '#b59cff' },
  prism: { name: 'Prism Shard',   short: 'Prism', color: '#ff9ce6' },
};

const ITEMS = {
  potion:   { name: 'Healing Potion',         desc: 'Restore 40 HP.',                        price: 25, craft: { goo: 3 },            color: '#ff6b7f' },
  greater:  { name: 'Greater Healing Potion', desc: 'Restore 70% of max HP.',                price: 70, craft: { goo: 6, ecto: 2 },   color: '#ff3d6e' },
  strength: { name: 'Strength Potion',        desc: '+50% attack for your next 3 attacks.',              price: 45, craft: { goo: 4, scrap: 2 },  color: '#ff9b3d' },
  defense:  { name: 'Defense Potion',         desc: '+60% defense against the next 4 attacks.',             price: 45, craft: { scrap: 4, goo: 2 },  color: '#5ab3ff' },
  antidote: { name: 'Antidote',               desc: 'Cure poison, burn & weakness. +10 HP.', price: 20, craft: { goo: 2 },            color: '#8dff6a' },
  enhancer: { name: 'Capture Enhancer',       desc: '+25% capture chance this battle.',      price: 60, craft: { ecto: 3 },           color: '#c48bff' },
  trap:     { name: 'Snap Trap',              desc: 'Capture device. Used on capture attempts.', price: 30, craft: { scrap: 2, ecto: 1 }, color: '#7cf5d3' },
  smoke:    { name: 'Smoke Bomb',             desc: 'Guaranteed escape from battle.',        price: 35, craft: { scrap: 2, goo: 1 },  color: '#a0a0b8' },
};
const ITEM_ORDER = Object.keys(ITEMS);
const BATTLE_ITEMS = ['potion', 'greater', 'strength', 'defense', 'antidote', 'enhancer', 'smoke'];

/* Research tree */
const RESEARCH = [
  { id: 'analysis', name: 'Monster Analysis',     cost: 2,  desc: 'See exact capture odds, enemy stats, weaknesses and abilities in battle.' },
  { id: 'lens1',    name: 'Wide-Angle Lens',      cost: 3,  desc: '+6% encounter chance per photo.' },
  { id: 'vital',    name: 'Hunter Conditioning',  cost: 3,  desc: '+20 maximum HP.' },
  { id: 'capture1', name: 'Reinforced Traps',     cost: 3,  desc: '+8% capture chance.' },
  { id: 'sensor',   name: 'Paranormal Sensor',    cost: 4,  desc: 'Pity kicks in sooner: guaranteed encounter after 3 quiet photos.' },
  { id: 'medic',    name: 'Field Medicine',       cost: 4,  desc: 'All healing potions restore 30% more.' },
  { id: 'spectral', name: 'Spectral Resonance',   cost: 5,  desc: 'Unlocks Spectral variants: any object may hide a ghostly form.' },
  { id: 'mutagen',  name: 'Mutagen Detector',     cost: 5,  desc: 'Unlocks Mutated variants: extra eyes, extra trouble, extra loot.' },
  { id: 'lens2',    name: 'Night Vision Lens',    cost: 6,  desc: '+6% more encounter chance.', req: 'lens1' },
  { id: 'smith',    name: 'Master Smithing',      cost: 6,  desc: 'Weapon max level 5 → 8 and upgrades cost 20% less.' },
  { id: 'capture2', name: 'Quantum Traps',        cost: 7,  desc: '+8% capture chance; failed traps are recovered 35% of the time.', req: 'capture1' },
  { id: 'chroma',   name: 'Chromatic Filter',     cost: 8,  desc: 'Unlocks Prismatic colour variants (1 in 12) with bonus rewards.' },
  { id: 'lens3',    name: 'Ectoplasmic Lens',     cost: 10, desc: 'Rare, Epic and Legendary monsters appear 40% more often.', req: 'lens2' },
  { id: 'legend',   name: 'Legend Tracker',       cost: 15, desc: 'Doubles Legendary encounter odds.', req: 'lens3' },
];
const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map(r => [r.id, r]));

/* Quests: activated in order, 3 active at a time. prog(S) -> current number. */
const QUESTS = [
  { id: 'q_snap',     name: 'First Snap',             desc: 'Photograph any object.',                       target: 1,  prog: S => S.stats.photos,               reward: { coins: 20 } },
  { id: 'q_contact',  name: 'First Contact',          desc: 'Discover a monster.',                          target: 1,  prog: S => S.stats.encounters,           reward: { rp: 1, potion: 1 } },
  { id: 'q_catch',    name: 'Gotcha!',                desc: 'Capture a monster.',                           target: 1,  prog: S => S.stats.captures,             reward: { trap: 2 } },
  { id: 'q_variety',  name: 'Variety Hunter',         desc: 'Photograph 5 different kinds of object.',      target: 5,  prog: S => Object.keys(S.stats.objsPhotographed || {}).length, reward: { rp: 1, coins: 40 } },
  { id: 'q_species5', name: 'Field Researcher',       desc: 'Discover 5 different species.',                target: 5,  prog: S => Object.keys(S.dex).length,       reward: { rp: 2 } },
  { id: 'q_house3',   name: 'Household Pest Control', desc: 'Capture 3 Household monsters.',                target: 3,  prog: S => S.stats.capByFam.household || 0, reward: { greater: 1, coins: 50 } },
  { id: 'q_purist',   name: 'Purist',                 desc: 'Win a battle without using a potion.',         target: 1,  prog: S => S.stats.cleanWins,            reward: { strength: 2 } },
  { id: 'q_rare',     name: 'Rare Specimen',          desc: 'Defeat or capture a Rare (or rarer) monster.', target: 1,  prog: S => S.stats.rareBeaten,           reward: { rp: 3 } },
  { id: 'q_arsenal',  name: 'Arsenal',                desc: 'Unlock a second weapon.',                      target: 2,  prog: S => Object.keys(S.weapons).length,   reward: { coins: 60 } },
  { id: 'q_upgrade',  name: 'Whetstone',              desc: 'Upgrade any weapon once.',                     target: 1,  prog: S => S.stats.upgrades,             reward: { scrap: 15, goo: 10 } },
  { id: 'q_family6',  name: 'Family Reunion',         desc: 'Discover monsters from 6 different families.', target: 6,  prog: S => Object.keys(S.stats.famSeen).length, reward: { rp: 4 } },
  { id: 'q_collect10',name: 'Collector',              desc: 'Capture 10 monsters.',                         target: 10, prog: S => S.stats.captures,             reward: { enhancer: 1, rp: 3 } },
  { id: 'q_epic',     name: 'Epic Tale',              desc: 'Discover an Epic monster.',                    target: 1,  prog: S => S.stats.epicSeen,             reward: { rp: 5 } },
  { id: 'q_level10',  name: 'Veteran Hunter',         desc: 'Reach hunter level 10.',                       target: 10, prog: S => S.level,                      reward: { coins: 150, prism: 2 } },
  { id: 'q_legend',   name: 'Myth Made Real',         desc: 'Discover your first Legendary creature.',      target: 1,  prog: S => S.stats.legendSeen,           reward: { rp: 10 } },
];

const ACHIEVEMENTS = [
  { id: 'a_sp5',   name: 'Curious Mind',     desc: 'Discover 5 species',            check: S => Object.keys(S.dex).length >= 5,   reward: { rp: 1 } },
  { id: 'a_sp15',  name: 'Cryptozoologist',  desc: 'Discover 15 species',           check: S => Object.keys(S.dex).length >= 15,  reward: { rp: 3 } },
  { id: 'a_sp40',  name: 'Monsterologist',   desc: 'Discover 40 species',           check: S => Object.keys(S.dex).length >= 40,  reward: { rp: 6, prism: 3 } },
  { id: 'a_sp80',  name: 'Living Encyclopedia', desc: 'Discover 80 species',        check: S => Object.keys(S.dex).length >= 80,  reward: { rp: 10, prism: 6 } },
  { id: 'a_cap1',  name: 'Trapper',          desc: 'Capture your first monster',    check: S => S.stats.captures >= 1,            reward: { coins: 25 } },
  { id: 'a_cap25', name: 'Zookeeper',        desc: 'Capture 25 monsters',           check: S => S.stats.captures >= 25,           reward: { rp: 4 } },
  { id: 'a_win10', name: 'Brawler',          desc: 'Win 10 battles',                check: S => S.stats.wins >= 10,               reward: { coins: 60 } },
  { id: 'a_win50', name: 'Monster Slayer',   desc: 'Win 50 battles',                check: S => S.stats.wins >= 50,               reward: { rp: 5 } },
  { id: 'a_cats10',name: 'Explorer',         desc: 'Photograph 10 kinds of object', check: S => Object.keys(S.stats.objsPhotographed || {}).length >= 10, reward: { rp: 2 } },
  { id: 'a_epic',  name: 'Something Epic',   desc: 'Meet an Epic monster',          check: S => S.stats.epicSeen >= 1,            reward: { prism: 1 } },
  { id: 'a_legend',name: 'Legend Hunter',    desc: 'Meet a Legendary monster',      check: S => S.stats.legendSeen >= 1,          reward: { prism: 3 } },
  { id: 'a_shiny', name: 'Prismatic!',       desc: 'Find a Prismatic variant',      check: S => S.stats.shinySeen >= 1,           reward: { rp: 3 } },
  { id: 'a_arms',  name: 'Fully Armed',      desc: 'Own all five weapons',          check: S => Object.keys(S.weapons).length >= 5, reward: { rp: 5 } },
  { id: 'a_lvl5',  name: 'Seasoned',         desc: 'Reach hunter level 5',          check: S => S.level >= 5,                     reward: { coins: 80 } },
];

/* Flavour text */
const NO_ENCOUNTER_LINES = [
  'No supernatural activity detected.',
  'Just a {obj}. Probably.',
  'The needle twitched... then nothing.',
  'Faint residue. Whatever lived in this {obj} has moved on.',
  'Readings normal. Suspiciously normal.',
  'Something was here a moment ago. The {obj} looks smug.',
  'Silence. The {obj} is holding its breath.',
];
const DUPLICATE_LINES = [
  'You already scanned this exact view. The spirits have scattered.',
  'Same object, same angle. Monsters hate being photographed twice.',
];
const SCAN_READOUTS = ['EMF', 'ECTO', 'PSI', 'HAUNT', 'GLOOM', 'WEIRD'];
