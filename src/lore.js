/* SNAPMON — monster flavour text that reflects BOTH the photographed object and the monster's rarity.

   No AI service and no randomness at display time: the text is assembled from curated pieces and picked
   deterministically from (object, rarity, monster seed), then stored on the monster (m.lore) when it appears, so it
   never changes between screens, restarts or future edits of these tables.

   Pieces:
     • LORE_KITS      — per object category: where it lurks, what it leaves behind, a petty habit, an ominous deed,
                        and the mythic domain it rules. Works for every object in the registry (~2,000).
     • LORE_TEMPLATES — per rarity, rising in tone: Common playful/mundane → Uncommon odd/mysterious → Rare distinctive
                        → Epic ominous → Legendary mythic. A second "coda" sentence is added from Rare upwards.
     • LORE_OBJECT    — hand-written lines for some very common objects, used for some of their monsters.
     • the photo colour (only when the colour extraction was confident) and the monster's signature move/title.
   Edit freely: monsters that already exist keep the text they were given. */
'use strict';

const LORE_KITS = {
  toilet:   { place: ['the bathroom at 3 a.m.', 'the last stall'], stuff: ['suspicious bubbles', 'blue cleaning foam'], habit: ['gurgles whenever someone forgets to close the lid', 'flushes itself just to make you jump'], omen: ['every drain in the city gurgles in unison', 'the sewers rise to answer it'], realm: ['the endless sewers', 'the great drain beneath the world'] },
  mug:      { place: ['the back of the cupboard', 'the office kitchen'], stuff: ['cold coffee rings', 'tea stains'], habit: ['cools your drink the moment you look away', 'hides behind the kettle and steals sugar'], omen: ['every cup in the house boils at once', 'no one in the city can sleep for a week'], realm: ['the bottomless brew', 'every sleepless night ever spent'] },
  shoe:     { place: ['the pile by the front door', 'the dark under the bed'], stuff: ['muddy footprints', 'tangled laces'], habit: ['ties its own laces together when you are in a hurry', 'hides its partner somewhere new every morning'], omen: ['the ground shakes with footsteps that belong to no one', 'every road leads back to its door'], realm: ['every road ever walked', 'the march of a thousand years'] },
  plant:    { place: ['the sunny windowsill', 'the corner nobody waters'], stuff: ['pale pollen', 'creeping roots'], habit: ['leans toward the window by day and toward you by night', 'drops a leaf every time you forget to water it'], omen: ['vines swallow the street overnight', 'the gardens close their petals and turn to face it'], realm: ['the green that covers everything', 'the roots beneath every city'] },
  laptop:   { place: ['the desk drawer of forgotten cables', 'the server room'], stuff: ['error messages', 'warm crumbs in the keyboard'], habit: ['installs updates at the worst possible moment', 'hides your cursor when you are in a rush'], omen: ['every screen in the country goes blue', 'all the world\'s passwords are forgotten at once'], realm: ['the endless network', 'every machine that ever thought'] },
  banana:   { place: ['the fruit bowl', 'the bottom of a school bag'], stuff: ['slippery peel', 'brown spots'], habit: ['ripens the moment you decide to eat it', 'leaves its peel exactly where you will step'], omen: ['the whole market ripens and rots in a single hour', 'every floor in town turns slippery'], realm: ['the great ripening', 'the yellow storm'] },
  sofa:     { place: ['the gap between the cushions', 'the living room after dark'], stuff: ['lost coins', 'stale crumbs'], habit: ['swallows remote controls and refuses to give them back', 'pulls you in for "just five minutes" that last three hours'], omen: ['nobody in the house ever stands up again', 'whole families vanish into its cushions'], realm: ['the eternal afternoon nap', 'everything ever lost between cushions'] },
  phone:    { place: ['the bottom of every pocket', 'the charging cable you can never find'], stuff: ['notifications', 'cracked-screen glitter'], habit: ['buzzes in your pocket when nobody called', 'dies at exactly 1% battery'], omen: ['every phone on earth rings at the same moment', 'nobody can look away from a screen ever again'], realm: ['the endless scroll', 'every message never sent'] },
  bottle:   { place: ['the recycling bin', 'the back of the fridge'], stuff: ['sticky fizz', 'condensation'], habit: ['shakes itself before you open it', 'rolls under the car seat on purpose'], omen: ['rivers fizz and overflow their banks', 'the sea itself starts to bubble'], realm: ['the great tide', 'every drop that ever spilled'] },
  book:     { place: ['the library\'s restricted shelf', 'the gap under a wobbly table leg'], stuff: ['ink blots', 'loose pages'], habit: ['loses your page whenever you close it', 'moves its bookmark three chapters back'], omen: ['every word in the library rearranges itself', 'the stories start writing their readers'], realm: ['the unwritten final chapter', 'every story ever told'] },
  lamp:     { place: ['the dark corner of the room', 'the porch light'], stuff: ['moth wings', 'flickering shadows'], habit: ['flickers just when the film gets scary', 'burns out the moment you need it'], omen: ['every light in the city goes out at once', 'night forgets how to end'], realm: ['the last light', 'the long night between stars'] },
  chair:    { place: ['the head of the dinner table', 'the classroom\'s back row'], stuff: ['squeaks', 'loose screws'], habit: ['wobbles only when someone important sits on it', 'scoots away just as you sit down'], omen: ['every seat in the land is suddenly taken', 'thrones crack and kings fall'], realm: ['the throne of all thrones', 'every seat at every table'] },
  car:      { place: ['the multi-storey car park', 'the hard shoulder'], stuff: ['oil puddles', 'tyre marks'], habit: ['honks at pigeons for no reason', 'hides your keys inside itself'], omen: ['the motorways fill with engines that have no drivers', 'every traffic light turns red forever'], realm: ['the endless highway', 'every journey ever started'] },
  animal:   { place: ['the sunny spot on the floor', 'the crawlspace under the porch'], stuff: ['loose fur', 'muddy paw prints'], habit: ['knocks things off tables and watches you pick them up', 'demands dinner an hour early'], omen: ['every animal in town falls silent and turns to look', 'the wild things of the world answer its call'], realm: ['the wild', 'the first hunt and the last'] },
  tree:     { place: ['the old park', 'the edge of the woods'], stuff: ['sap', 'falling leaves'], habit: ['drops branches on cars it does not like', 'creaks loudly when you walk past alone'], omen: ['the forest walks', 'roots split the roads and swallow the town'], realm: ['the elder forest', 'the roots beneath the world'] },
  food:     { place: ['the takeaway box', 'the back of the fridge'], stuff: ['grease stains', 'crumbs'], habit: ['shrinks a little every time you look away', 'smells delicious and tastes of regret'], omen: ['every kitchen in the city catches fire', 'the whole town wakes up hungry and never stops'], realm: ['the endless feast', 'every meal ever eaten'] },
  fruit:    { place: ['the fruit bowl', 'the orchard'], stuff: ['sticky juice', 'seeds'], habit: ['rolls off the counter just to watch you chase it', 'bruises itself on purpose before you buy it'], omen: ['entire orchards wither overnight', 'the harvest rots on the branch from here to the sea'], realm: ['the final harvest', 'every orchard that ever bloomed'] },
  cloth:    { place: ['the laundry pile', 'the back of the wardrobe'], stuff: ['lint', 'lost buttons'], habit: ['eats one sock from every pair', 'shrinks itself in the wash out of spite'], omen: ['every wardrobe in the land swings open at midnight', 'the city wakes up wearing someone else\'s clothes'], realm: ['the great unravelling', 'every thread ever spun'] },
  tool:     { place: ['the garage toolbox', 'the junk drawer'], stuff: ['rust', 'stray screws'], habit: ['vanishes the moment you need it and reappears after', 'strips every screw it touches'], omen: ['every machine in the city falls apart at once', 'bridges loosen their bolts and lie down'], realm: ['the unmaking of things', 'every machine ever built'] },
  toy:      { place: ['the toy box', 'the dark under the bed'], stuff: ['glitter', 'stuffing'], habit: ['moves when you are not looking', 'squeaks at night when everyone is asleep'], omen: ['every toy in the city opens its eyes', 'playrooms fall silent and nurseries go cold'], realm: ['the endless game', 'every forgotten childhood'] },
  trash:    { place: ['the bins behind the restaurant', 'the forgotten corner of the yard'], stuff: ['mystery goo', 'banana peels'], habit: ['tips itself over right after you clean up', 'smells worst on the hottest day of the year'], omen: ['rubbish rises from every bin and walks', 'the landfill opens its eyes'], realm: ['the great heap', 'everything ever thrown away'] },
  mirror:   { place: ['the hallway at night', 'the steamed-up bathroom'], stuff: ['fingerprints', 'fog'], habit: ['blinks a split second after you do', 'makes your hair look worse than it is'], omen: ['every reflection steps out of its glass', 'nobody can tell which side is real any more'], realm: ['the world behind the glass', 'every face ever reflected'] },
  fridge:   { place: ['the kitchen at midnight', 'the corner of the utility room'], stuff: ['frost', 'a low electric hum'], habit: ['hums louder when you raid it at night', 'freezes the milk and melts the ice cream'], omen: ['summer freezes solid in a single breath', 'every appliance in the city starts humming its name'], realm: ['the eternal winter', 'the cold at the end of time'] },
  candle:   { place: ['the birthday cake', 'the windowsill during a power cut'], stuff: ['dripping wax', 'smoke curls'], habit: ['relights itself after you blow it out', 'leans until the wax drips on the tablecloth'], omen: ['every flame in the city leans toward it', 'the sky glows orange from coast to coast'], realm: ['the first fire', 'the flame that never goes out'] },
  clock:    { place: ['the bedside table', 'the station wall'], stuff: ['lost minutes', 'ticking echoes'], habit: ['steals five minutes from every morning', 'rings one minute after you fall back asleep'], omen: ['time stops for everyone but it', 'yesterday starts happening again'], realm: ['the end of time', 'every hour ever wasted'] },
  keys:     { place: ['the bottom of the bag', 'the bowl by the door'], stuff: ['jingles', 'pocket fluff'], habit: ['hides whenever you are late', 'gets tangled with every other small thing'], omen: ['every lock in the world clicks open at once', 'all the doors forget who they belong to'], realm: ['every door ever closed', 'the lock on the last secret'] },
  bag:      { place: ['the back of the wardrobe', 'the luggage carousel'], stuff: ['receipts', 'crumbs from last year'], habit: ['hides your phone in a pocket you did not know it had', 'zips itself shut on your fingers'], omen: ['everything anyone has ever lost spills out of it', 'whole buildings vanish into its pockets'], realm: ['the pocket with no bottom', 'everything ever packed and never found'] },
  pillow:   { place: ['the unmade bed', 'the sofa\'s corner'], stuff: ['feathers', 'drool stains'], habit: ['lures you in with "just five more minutes"', 'gets too warm on one side however often you flip it'], omen: ['the whole city falls asleep and dreams the same dream', 'nobody wakes up for a hundred years'], realm: ['the endless dream', 'every night ever slept'] },
  faucet:   { place: ['the bathroom sink', 'the leaky garden hose'], stuff: ['drips', 'limescale'], habit: ['drips just loud enough to keep you awake', 'runs hot when you want cold'], omen: ['every tap in the city opens at once', 'the floodwaters answer its call'], realm: ['the great flood', 'every drop that ever fell'] },
  tv:       { place: ['the living room corner', 'the waiting room wall'], stuff: ['static', 'reruns'], habit: ['changes the channel during the best part', 'shows static only when you are alone'], omen: ['every screen on earth shows the same face', 'nobody can switch anything off ever again'], realm: ['channel zero', 'every broadcast ever sent'] },
  bird:     { place: ['the rooftop', 'the park bench'], stuff: ['loose feathers', 'early-morning noise'], habit: ['sings outside your window at 4 a.m.', 'aims for freshly washed cars'], omen: ['the sky goes dark with wings', 'every bird on earth sings one terrible note'], realm: ['the open sky', 'the storm above the clouds'] },
  fish:     { place: ['the aquarium', 'the harbour'], stuff: ['scales', 'bubbles'], habit: ['forgets you every three seconds and is offended each time', 'stares at you through the glass'], omen: ['the tides stop and the sea draws breath', 'every aquarium cracks at once'], realm: ['the deep', 'the bottom of every ocean'] },
  bug:      { place: ['the crack in the wall', 'the kitchen at night'], stuff: ['tiny footprints', 'webs'], habit: ['scuttles under the fridge the moment you see it', 'buzzes near your ear just as you fall asleep'], omen: ['the ground hums with a billion legs', 'every crack in the city starts to move'], realm: ['the swarm', 'the million hidden things'] },
  reptile:  { place: ['the warm rock', 'the warm spot under the desk lamp'], stuff: ['shed skin', 'cold footprints'], habit: ['basks in your seat the moment you get up', 'pretends to be a statue until you turn around'], omen: ['the old lizard-kings wake from their long sleep', 'the swamps rise and the cold-blooded march'], realm: ['the age of dragons', 'the time before mammals'] },
  umbrella: { place: ['the stand by the door', 'the lost-property office'], stuff: ['raindrops', 'bent spokes'], habit: ['opens indoors on purpose', 'turns inside out in the gentlest breeze'], omen: ['storms gather wherever it goes', 'it never stops raining again'], realm: ['the endless storm', 'every rainy day'] },
  instrument: { place: ['the music room', 'the attic'], stuff: ['broken strings', 'out-of-tune echoes'], habit: ['plays itself at midnight, always slightly out of tune', 'goes flat right before the concert'], omen: ['every song in the world becomes its song', 'the music never stops, and no one can stop dancing'], realm: ['the last song', 'the music before the world began'] },
  ball:     { place: ['the dust under the sofa', 'the neighbour\'s garden'], stuff: ['grass stains', 'bounce marks'], habit: ['rolls under the sofa on purpose', 'bounces exactly where you are not'], omen: ['the ground itself starts to bounce', 'every window in town shatters at once'], realm: ['the endless game', 'the first game ever played'] },
  pot:      { place: ['the back of the stove', 'the sink full of dishes'], stuff: ['burnt crust', 'steam'], habit: ['boils over the second you look away', 'never boils while you watch'], omen: ['every kitchen in the land boils over', 'the city drowns in soup'], realm: ['the cauldron of all things', 'every meal ever burnt'] },
  cake:     { place: ['the birthday table', 'the bakery window'], stuff: ['frosting', 'sprinkles'], habit: ['makes its last slice look bigger than it is', 'wobbles when someone says the word "diet"'], omen: ['every party in the land turns into a feast without end', 'sugar rains from the sky'], realm: ['the endless celebration', 'every birthday wish ever made'] },
  other:    { place: ['the place nobody looks', 'the edge of the photo'], stuff: ['an odd smell', 'static'], habit: ['pretends to be something else, badly', 'is never quite where you left it'], omen: ['ordinary things stop being ordinary', 'everyday objects forget what they are'], realm: ['the unexplained', 'everything nobody can name'] },
};

// {obj} object name · {Obj} capitalised · {colour} photo colour (templates with it are only used when the colour is
// known) · {place} {stuff} {habit} {omen} {realm} from the category kit · {sig} signature move · {name} · {title}
const LORE_TEMPLATES = {
  common: [
    'A tiny troublemaker that {habit}.',
    'Mostly harmless. It {habit}, then pretends nothing happened.',
    'Lives in {place} and {habit}.',
    'Smells faintly of {stuff}. It bites, but only a little.',
    'You have probably met one already: it {habit}.',
    'Small, smug and {colour}. It {habit}.',
  ],
  uncommon: [
    'Nobody knows how it got into {place}. The only clue is the {stuff} it leaves behind, glowing faintly at night.',
    'Some say it is the {obj} you lost years ago, come back changed.',
    'Watch {place} after midnight: it rearranges things there, one tiny detail at a time.',
    'Its {colour} skin shimmers whenever nobody is looking straight at it.',
    'It hums a tune no one taught it. Pets refuse to go near {place} when it does.',
    'Throw it out of {place} and it is back by morning, a little bigger every time.',
  ],
  rare: [
    'Old hunters tell of a {colour} {obj} that rules {place} like a small kingdom.',
    'Its {sig} can be heard three streets away. Lesser monsters scatter when it wakes.',
    'An urban legend: it appears only beneath a blood-red moon, and leaves nothing behind but {stuff}.',
    'Collectors have spent fortunes chasing it. It has never been seen the same way twice.',
    'It remembers every hunter who failed to catch it, and it keeps count.',
    'Wherever it sleeps, {place} grows strangely quiet, as if listening.',
  ],
  epic: [
    'When it stirs, {omen}. Hunters mark its lair on their maps in red.',
    'It was sealed beneath {place} long ago. The seal did not hold.',
    'Its {sig} has flattened whole neighbourhoods of lesser spirits, and it is still growing.',
    'Its {colour} glow shines through walls. Nobody who followed it came back unchanged.',
    'Old almanacs warn: if the {obj} goes silent, run. That silence is this creature breathing in.',
    'It does not hunt to eat. It hunts to be remembered, and nobody forgets.',
  ],
  legendary: [
    'Where it takes hold, {omen}. Even the gods fear {realm}.',
    'Before the first {obj} was ever made, it was already waiting. It will remain after the last.',
    'Ancient texts call it {title}. When it wakes, {omen}.',
    'Kingdoms have fallen to its {sig}. Its true name is spoken only in whispers.',
    'It is the {colour} titan of {realm}. Stars dim when it opens its eyes.',
    'Every {obj} in the world is a door, and it holds every key. It has begun to open them.',
  ],
};
// second sentence from Rare upwards, so the rarest monsters read the most distinctive
const LORE_CODA = {
  rare: ['Few hunters have seen one up close.', 'Collectors pay a fortune for a trace of its {stuff}.', 'It is never found in the same place twice.'],
  epic: ['Its name is not spoken in {place}.', 'The ground is still warm where it last slept.', 'Seasoned hunters turn back when they find its {stuff}.'],
  legendary: ['Mortal hunters were never meant to face it.', 'The world remembers its last awakening, and trembles.', 'Legends say only the bravest hunter will ever hold it.'],
};
// hand-written lines for some very common objects (used for some of their monsters, so not every one reads the same)
const LORE_OBJECT = {
  apple:   { common: 'A tiny troublemaker with a surprisingly sharp bite.', rare: 'An orchard legend, said to appear only beneath a blood-red moon.', legendary: 'Where its roots take hold, entire kingdoms wither. Even the gods fear the final harvest.' },
  banana:  { common: 'Ripens into something far more dangerous than a slipping hazard.', legendary: 'When the great peel falls, empires slip. Every ruin on earth was once a banana\'s idea.' },
  mug:     { common: 'Runs on pure caffeine. Has not slept since it was fired in the kiln.', legendary: 'It has drunk the dreams of every sleepless night. When its last drop falls, nobody will ever rest again.' },
  cat:     { common: 'Not your pet. Something wearing your pet as a costume.', legendary: 'Older than the pyramids built in its honour. It allows the world to continue, for now.' },
  dog:     { common: 'A very good monster. Mostly. It steals socks and hides them in the garden.', legendary: 'Its howl was the first sound the moon ever heard, and the moon has been afraid ever since.' },
  toilet:  { common: 'It gurgles hungrily whenever someone forgets to close the lid.', legendary: 'Every drain on earth leads to its throne. One day it will flush, and the world will go with it.' },
  phone:   { common: 'Feeds on your attention span. It is very, very well fed.', legendary: 'It holds every message ever sent. When it finally rings, the whole world will answer.' },
  laptop:  { common: 'Installs updates at the worst possible moment out of pure spite.', legendary: 'It has read every password ever typed. It is simply deciding when to log out humanity.' },
  sofa:    { common: 'Every coin, remote and snack you ever lost lives inside it.', legendary: 'Whole civilisations sat down on it for "just five minutes". None of them ever got up.' },
  potted_plant: { common: 'Leans toward the window by day. Leans toward you by night.', legendary: 'Its roots have quietly wrapped around the planet. It is waiting for the gardeners to sleep.' },
  sock:    { common: 'Floats out of the laundry at 3 a.m. looking for its missing half.', legendary: 'Every lost sock in history joined its army. The final laundry day is coming.' },
  candle:  { common: 'Blow it out and it simply relights itself, angrier.', legendary: 'It was lit at the dawn of time. When it gutters, so will the sun.' },
  rubber_duck: { common: 'Squeaks once for yes, twice for "you will regret this".', legendary: 'The tide obeys it. Sailors pray to it. It has never once blinked.' },
};

const LORE_COLOUR = h => {
  // [hue, sat 0-100, light 0-100] → a colour word suited to monster lore
  const [hu, sa, li] = h;
  if (sa < 12) return li > 78 ? 'bone-white' : li < 22 ? 'pitch-black' : 'ash-grey';
  if (li < 18) return 'shadow-dark';
  const H = ((hu % 360) + 360) % 360;
  return H < 14 || H >= 345 ? 'blood-red' : H < 40 ? 'ember-orange' : H < 65 ? 'golden' : H < 95 ? 'lime-green' : H < 160 ? 'emerald' : H < 195 ? 'sea-green' : H < 250 ? 'sapphire' : H < 290 ? 'violet' : 'rose-pink';
};

/* monsterLore(m): m needs obj (or cat), rarity, seed; optional photo.pal, name, abilities, fam */
function monsterLore(m) {
  const o = m.obj && OBJECTS[m.obj], cat = (o && o.cat) || m.cat || 'other';
  const kit = LORE_KITS[cat] || LORE_KITS.other, rarity = RARITY[m.rarity] ? m.rarity : 'common';
  const R = mulberry(hashStr('lore|' + (m.obj || cat) + '|' + rarity + '|' + (m.seed >>> 0)));
  const pick = a => a[Math.floor(R() * a.length)];
  const pal = m.photo && m.photo.pal, colour = pal && pal.conf === 'confident' && pal.primary ? LORE_COLOUR(pal.primary) : null;
  const objName = o ? o.name.split(' / ')[0].toLowerCase() : (m.word || CATEGORY[cat].name.split(' /')[0]).toLowerCase();
  const sig = (m.abilities && m.abilities[0] && m.abilities[0].name) || ((o && o.sig) || CATEGORY[cat].sig).name;
  const title = (m.name && m.name.includes(', ') ? m.name.split(', ').slice(1).join(', ') : LEGEND_TITLES[m.fam] || 'the Nameless').replace(/^the /, 'the ');
  const fill = t => t.replace(/\{(\w+)\}/g, (_, k) => ({ obj: objName, Obj: objName[0].toUpperCase() + objName.slice(1), colour, place: pick(kit.place), stuff: pick(kit.stuff), habit: pick(kit.habit), omen: pick(kit.omen), realm: pick(kit.realm), sig, title })[k] || '');
  const own = o && LORE_OBJECT[m.obj] && LORE_OBJECT[m.obj][rarity];
  let text;
  if (own && R() < 0.5) text = own;
  else {
    const usable = LORE_TEMPLATES[rarity].filter(t => colour || !t.includes('{colour}'));
    text = fill(pick(usable));
  }
  // a coda only after a one-sentence opening, so even Legendary lore stays at two sentences
  if (LORE_CODA[rarity] && !own && !/[.!?] /.test(text)) text += ' ' + fill(pick(LORE_CODA[rarity]));
  return text;
}
// text shown for a monster: its stored lore, or (monsters from before v0.4.2) the same deterministic result
const loreOf = m => (m && m.lore) || monsterLore(m);
// encyclopedia entry: the lore of the rarest form met so far, the same for everyone with that object
function speciesLore(d, rarity) { return monsterLore({ obj: d.obj, cat: d.cat, rarity, seed: hashStr('species|' + d.key), fam: d.fam, name: d.monsterName }); }
