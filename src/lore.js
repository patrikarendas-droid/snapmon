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
  fridge:   { place: ['the kitchen at midnight', 'the corner of the utility room'], stuff: ['frost', 'electric hums'], habit: ['hums louder when you raid it at night', 'freezes the milk and melts the ice cream'], omen: ['summer freezes solid in a single breath', 'every appliance in the city starts humming its name'], realm: ['the eternal winter', 'the cold at the end of time'] },
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
  other:    { place: ['the place nobody looks', 'the edge of the photo'], stuff: ['odd smells', 'static'], habit: ['pretends to be something else, badly', 'is never quite where you left it'], omen: ['ordinary things stop being ordinary', 'everyday objects forget what they are'], realm: ['the unexplained', 'everything nobody can name'] },
};

// v0.4.3: kits for object groups that share a category but not a nature (a light switch is not a hand tool). The
// group comes from the object's design rule (objects.js DESIGN_RULES); objects without a group use their category kit.
const LORE_GROUP_KITS = {
  electric: { place: ['the wall by the door', 'the dark hallway', 'the wiring behind the plaster'], stuff: ['static sparks', 'hot-plastic smells', 'tiny blue sparks'], habit: ['flicks the lights off just as you reach the stairs', 'gives you a static zap when you are not expecting it', 'clicks on and off by itself at 3 a.m.'], omen: ['every light in the city blinks out at once', 'the power grid hums its name'], realm: ['the endless current', 'the great blackout'] },
  alarm: { place: ['the ceiling above your bed', 'the front door', 'the hallway corner'], stuff: ['ear-splitting beeps', 'low-battery chirps'], habit: ['chirps once at 4 a.m. and then never again', 'rings when nobody is there', 'goes off every time you make toast'], omen: ['every alarm in the city screams at once', 'no one can ever sleep again'], realm: ['the last warning', 'the alarm that never stops'] },
  camera: { place: ['the corner of the ceiling', 'the shop doorway', 'the car park'], stuff: ['blinking red lights', 'grainy footage', 'infrared glow'], habit: ['follows you with its lens wherever you walk', 'records your most embarrassing moments in high definition', 'zooms in whenever you pick your nose'], omen: ['every screen in the city shows what it sees', 'nothing anywhere goes unwatched'], realm: ['the all-seeing eye', 'every moment ever recorded'] },
  gadget: { place: ['the junk drawer', 'the charging corner', 'the bottom of the gadget box'], stuff: ['dead batteries', 'blinking lights', 'tangled cables'], habit: ['runs out of battery exactly when you need it', 'beeps for reasons it will not explain', 'updates itself in the middle of the night'], omen: ['every device in the land rebels at once', 'the machines stop listening to their owners'], realm: ['the endless update', 'every gadget ever forgotten'] },
  street: { place: ['the street corner', 'the crossing', 'the empty car park at night'], stuff: ['rain puddles', 'orange light', 'parking tickets'], habit: ['turns red the moment you are in a hurry', 'flickers just as you walk under it', 'tells you to stop for no reason at all'], omen: ['every road in the city goes red at once', 'the traffic stops and never moves again'], realm: ['every road ever travelled', 'the endless rush hour'] },
  office: { place: ['the office supply cupboard', 'the back of the desk drawer', 'the meeting room'], stuff: ['paper cuts', 'sticky notes', 'ink smudges'], habit: ['jams right before a deadline', 'hides under the paperwork when you need it', 'squeaks during the quiet part of the meeting'], omen: ['every deadline in the world arrives at once', 'the paperwork never ends'], realm: ['the eternal Monday', 'every form ever filed'] },
  art: { place: ['the gallery wall', 'the attic studio', 'the hallway'], stuff: ['paint drips', 'charcoal dust'], habit: ['changes its expression when you look away', 'leaves wet paint on your fingers', 'tilts a little crooked every night'], omen: ['every painting in the museum opens its eyes', 'colour drains from the whole city'], realm: ['the endless canvas', 'every picture ever painted'] },
  medical: { place: ['the first-aid cupboard', 'the doctor\'s waiting room', 'the bathroom cabinet'], stuff: ['antiseptic fumes', 'sticky plasters'], habit: ['is always missing when someone gets a scrape', 'is a little too cold when it touches you', 'insists you say "aah"'], omen: ['every hospital light flickers at once', 'the whole city catches the same cold'], realm: ['the last cure', 'every fever ever broken'] },
  science: { place: ['the school laboratory', 'the observatory', 'the dusty science cupboard'], stuff: ['bubbling liquid', 'lens smudges', 'mysterious residue'], habit: ['bubbles over when nobody is watching', 'shows you things you did not want to see up close', 'gets every measurement slightly wrong'], omen: ['every experiment in the world goes wrong at once', 'the stars rearrange themselves'], realm: ['the unknown', 'every secret of the universe'] },
  hardware: { place: ['the garage shelf', 'the jar of spare bits', 'the bottom of the toolbag'], stuff: ['rust', 'loose threads of wire', 'tiny metal shavings'], habit: ['rolls away and hides under the fridge', 'tangles itself the moment you put it away', 'is always one short of what you need'], omen: ['every bolt in every bridge loosens at once', 'the whole city comes apart at the seams'], realm: ['the unmaking of things', 'everything that holds the world together'] },
  kitchen: { place: ['the cutlery drawer', 'the kitchen counter', 'the back of the cupboard'], stuff: ['crumbs', 'flour dust', 'sticky fingerprints'], habit: ['hides in the drawer you checked twice', 'clatters onto the floor at the quietest moment', 'is always in the dishwasher when you need it'], omen: ['every kitchen in the land falls silent', 'no meal will ever be cooked again'], realm: ['the endless feast', 'every meal ever made'] },
  craft: { place: ['the sewing box', 'the craft drawer', 'the knitting basket'], stuff: ['loose thread', 'tiny pinpricks'], habit: ['vanishes into the carpet', 'tangles every thread it touches', 'pricks your finger just once, on purpose'], omen: ['every stitch in the world comes undone', 'the cloth of the city unravels'], realm: ['the great unravelling', 'every thread ever spun'] },
  outdoor: { place: ['the garden shed', 'the campsite', 'the back of the car boot'], stuff: ['mud', 'pine needles', 'damp grass'], habit: ['collapses the moment you finish setting it up', 'drags mud into the house', 'is always at the bottom of the bag'], omen: ['the wilderness takes back the town', 'every garden grows wild overnight'], realm: ['the wild outdoors', 'every trail ever walked'] },
  sport: { place: ['the sports hall', 'the kit bag', 'the playing field'], stuff: ['sweat', 'grass stains', 'chalk lines'], habit: ['goes missing right before the big game', 'cheats when the referee is not looking', 'demands one more lap'], omen: ['every scoreboard in the world resets to zero', 'the game never ends'], realm: ['the eternal match', 'every game ever played'] },
  gym: { place: ['the gym corner', 'the spare room'], stuff: ['sweat', 'squeaky rubber'], habit: ['makes the last minute feel like an hour', 'is mostly used to hang clothes on', 'beeps every time you slow down'], omen: ['nobody in the city can ever stop running', 'every heart in town races at once'], realm: ['the endless workout', 'the final rep'] },
  arcade: { place: ['the arcade at the end of the pier', 'the station hall'], stuff: ['jingling coins', 'flashing lights'], habit: ['swallows your coin and gives nothing back', 'plays its jingle when nobody is near', 'always wins'], omen: ['every machine in the land lights up at once', 'the high score belongs to it forever'], realm: ['the endless game over', 'every coin ever spent'] },
  computer: { place: ['the server room', 'the desk drawer of forgotten parts', 'the back of the computer'], stuff: ['dust bunnies', 'error codes', 'warm air'], habit: ['loses your files at the worst moment', 'whirs loudly when you need silence', 'needs a restart, again'], omen: ['every computer in the world crashes at once', 'all the world\'s data vanishes'], realm: ['the endless network', 'every byte ever saved'] },
  media: { place: ['the record shelf', 'the box in the attic', 'the living room cabinet'], stuff: ['dusty sleeves', 'crackles and hiss'], habit: ['skips at the best part of the song', 'tangles its own tape', 'plays the same song all day'], omen: ['every speaker on earth plays the same note', 'music fades from the world'], realm: ['the last song', 'every melody ever recorded'] },
  jewel: { place: ['the jewellery box', 'the bathroom sink', 'the gap between the floorboards'], stuff: ['sparkles', 'tiny scratches'], habit: ['slips off at the beach', 'hides in the sink drain', 'tarnishes the night before a wedding'], omen: ['every jewel in the land shines blood-red', 'kings and queens kneel before it'], realm: ['the treasure of all treasures', 'every crown ever worn'] },
  cosmetic: { place: ['the bathroom cabinet', 'the bottom of the handbag'], stuff: ['smudges', 'sweet perfume'], habit: ['smudges itself the moment you leave the house', 'rolls under the sink', 'dries up the day before a party'], omen: ['every mirror in the city shows a stranger', 'faces forget who they are'], realm: ['the perfect face', 'every disguise ever worn'] },
  door: { place: ['the front door', 'the long hallway', 'the room you never open'], stuff: ['creaks', 'cold draughts'], habit: ['creaks loudly when you sneak home late', 'locks itself when you step outside', 'slams in the wind'], omen: ['every door in the city opens at once', 'no lock will ever hold again'], realm: ['every door ever closed', 'the threshold between worlds'] },
  // v0.4.5: food and drink groups (objects.js FOOD_RULES)
  drink: { place: ['the back of the fridge', 'the vending machine', 'the corner-shop cooler'], stuff: ['sticky rings', 'fizz', 'condensation drips'], habit: ['shakes itself up just before you open it', 'goes flat the second you look away', 'keeps you awake until 3 a.m.'], omen: ['every drink in the city fizzes over at once', 'nobody anywhere can sleep again'], realm: ['the bottomless cup', 'every last drop'] },
  meat: { place: ['the barbecue', 'the butcher\'s counter', 'the back of the grill'], stuff: ['sizzling grease', 'smoky sauce'], habit: ['sizzles louder when someone says the word "vegetarian"', 'burns on one side and stays raw on the other', 'steals the best spot on the grill'], omen: ['every barbecue in the land roars into flame', 'the smoke of a thousand grills blots out the sun'], realm: ['the eternal barbecue', 'the great grill at the end of the world'] },
  seafood: { place: ['the fish market', 'the harbour restaurant', 'the bottom of the ice tray'], stuff: ['brine', 'a fishy whiff', 'crushed ice'], habit: ['smells stronger every hour it is left out', 'slips off the plate when you reach for it', 'pinches the waiter'], omen: ['the tide comes in and never goes out', 'every fish shop in town fills with seawater'], realm: ['the briny deep', 'the bottom of the sea'] },
  dairy: { place: ['the cheese counter', 'the butter dish', 'the fridge door'], stuff: ['crumbs of rind', 'a sour smell', 'melted puddles'], habit: ['goes off one day before the date on the label', 'melts the moment you leave it on the table', 'smells stronger than it looks'], omen: ['all the milk in the land turns sour at once', 'the cheese caves rumble awake'], realm: ['the great cheese cave', 'the river of cream'] },
  condiment: { place: ['the fridge door', 'the condiment tray', 'the back of the cupboard'], stuff: ['sticky drips', 'crusty lids'], habit: ['comes out all at once after refusing for ages', 'squirts sideways onto your shirt', 'glues its own lid shut'], omen: ['every jar in the land bursts open', 'the streets run thick and sticky'], realm: ['the endless pantry', 'the sauce that covers the world'] },
  bowl: { place: ['the noodle bar', 'the kitchen table', 'the microwave at work'], stuff: ['steam', 'splashes of broth', 'stray grains'], habit: ['splashes broth on your shirt at the first slurp', 'is too hot until it is suddenly cold', 'never quite fills you up'], omen: ['every pot in the land boils over at once', 'a great tide of broth rolls through the streets'], realm: ['the bottomless bowl', 'the great cauldron of all meals'] },
  bakery: { place: ['the bread bin', 'the bakery window', 'the toaster'], stuff: ['crumbs', 'flour dust', 'burnt crusts'], habit: ['goes stale the morning you wanted it', 'lands butter-side down on purpose', 'hides the last slice behind the heel'], omen: ['every oven in the city bakes at once', 'the smell of bread fills the world and no one can resist it'], realm: ['the eternal oven', 'the first loaf ever baked'] },
  dumpling: { place: ['the steamer basket', 'the takeaway bag', 'the night-market stall'], stuff: ['steam puffs', 'dipping-sauce drips'], habit: ['bursts and squirts hot filling at the first bite', 'sticks to the bottom of the basket', 'hides one extra in the bag to make you feel guilty'], omen: ['every steamer in the city puffs at once', 'the fog of a thousand kitchens rolls in'], realm: ['the endless steamer', 'the folded heart of every kitchen'] },
  snack: { place: ['the takeaway bag', 'the food truck', 'the late-night snack drawer'], stuff: ['greasy wrappers', 'salt crumbs', 'cheesy fingerprints'], habit: ['vanishes faster than you meant to eat it', 'drips sauce down your sleeve', 'calls to you at midnight'], omen: ['every food truck in the land opens at once and never closes', 'the whole city wakes up starving'], realm: ['the street of endless stalls', 'the midnight feast'] },
  breakfast: { place: ['the frying pan', 'the breakfast table', 'the diner counter'], stuff: ['yolk drips', 'syrup puddles', 'shell bits'], habit: ['sticks to the pan just as you flip it', 'is cold before you sit down', 'makes you late every single morning'], omen: ['the sun refuses to rise until it is fed', 'every kitchen in the land smells of burning'], realm: ['the eternal morning', 'the first breakfast ever cooked'] },
  veg: { place: ['the vegetable patch', 'the bottom of the fridge drawer', 'the market stall'], stuff: ['soil', 'crunchy peel', 'a sharp smell'], habit: ['hides at the bottom of the fridge drawer until it goes soft', 'makes children push their plates away', 'grows twice as big when you are not looking'], omen: ['the fields rise up and march on the cities', 'every garden in the land bursts out of its fences'], realm: ['the endless field', 'the deep, dark soil'] },
  leafy: { place: ['the herb pot on the windowsill', 'the salad drawer', 'the kitchen garden'], stuff: ['loose leaves', 'a fresh green smell'], habit: ['wilts the day after you buy it', 'gets stuck in your teeth before a meeting', 'grows back the moment you pick it'], omen: ['green leaves cover every street overnight', 'the gardens swallow the town'], realm: ['the green that covers the world', 'the first garden'] },
  nut: { place: ['the bottom of the snack bowl', 'the squirrel\'s stash', 'the old jar on the shelf'], stuff: ['shell fragments', 'crumbs'], habit: ['refuses to crack until you hit your thumb', 'rolls under the sofa and waits for years', 'hides its shell in your slipper'], omen: ['every squirrel in the land turns to stare', 'the great oaks drop their nuts on the city like hail'], realm: ['the forest floor', 'the hoard of every squirrel that ever lived'] },
  pantry: { place: ['the back of the pantry', 'the top shelf of the cupboard', 'the corner-shop aisle'], stuff: ['spilled grains', 'flour dust', 'torn packets'], habit: ['tears open the moment you pick it up', 'expires the week before you finally use it', 'spills across the whole shelf'], omen: ['every cupboard in the land bursts open at once', 'the shelves of the world empty overnight'], realm: ['the endless pantry', 'the storehouse at the end of the world'] },
};
const LORE_GROUP_ALIAS = { light: 'lamp', furniture: 'chair', appliance: 'fridge', music: 'instrument', toyish: 'toy', tool: 'tool' };
const loreKitFor = (o, cat) => { const g = o && o.lore; return (g && (LORE_GROUP_KITS[g] || LORE_KITS[LORE_GROUP_ALIAS[g]])) || LORE_KITS[cat] || LORE_KITS.other; };

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
  // v0.4.5: every Legendary line names its own object (directly or through its unique title), so no two legendary
  // species can share their text
  legendary: [
    'Where this {obj} takes hold, {omen}. Even the gods fear {realm}.',
    'Before the first {obj} was ever made, it was already waiting. It will remain after the last.',
    'Ancient texts call it {title}. When it wakes, {omen}.',
    'Kingdoms have fallen to its {sig}. Hunters call it {title}, and only in whispers.',
    'This {colour} {obj} is the titan of {realm}. Stars dim when it opens its eyes.',
    'Every {obj} in the world answers to it. It has begun to call them home.',
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
  x_light_switch: { common: 'Flicks the lights off just as you reach the top of the stairs, then giggles in the dark.', uncommon: 'Nobody remembers wiring it in. It clicks on by itself whenever someone says its name.', rare: 'Every bulb in the house answers to it. On stormy nights it decides who gets to see.', epic: 'One flick, and a whole street falls into darkness. It has been practising on yours.', legendary: 'At the dawn of time it said "let there be light". It has been deciding when to take it back ever since.' },
  x_security_camera: { common: 'Watches the car park all night and judges everyone\'s parking.', uncommon: 'Its little red light blinks a second after you blink. It records things nobody else saw.', rare: 'It has seen every secret on this street, and it remembers every face.', epic: 'Its infrared eye sees through walls. Burglars confess before it even moves.', legendary: 'The all-seeing lens. It recorded the first sunrise and will record the last. Nothing has ever escaped its gaze.' },
  x_power_socket: { common: 'Two surprised holes and one very shocked face. Keep your fingers out.', rare: 'It powers half the house and charges a little extra for every plug.', legendary: 'All the lightning of the world flows through its two small mouths. It decides which cities stay lit.' },
  x_traffic_light: { common: 'Turns red the moment it sees you running late.', rare: 'Drivers whisper that it can hold a red light for an entire afternoon, just to make a point.', legendary: 'When its red eye opens, the whole world stops. Nobody has ever seen it turn green.' },
  x_smoke_detector: { common: 'Chirps once at 4 a.m., then never again. It knows exactly what it is doing.', legendary: 'It smelled the first fire ever lit, and it has been screaming about it ever since.' },
  x_stethoscope: { common: 'Listens to your heartbeat and gossips about it to the other medical supplies.', legendary: 'It has heard every heart that ever beat. It knows which one will be the last.' },
};

const LORE_HOOK = ['It was last seen near {place}.', 'It leaves {stuff} wherever it goes.', 'It still {habit}.', 'Look for {stuff} near {place}.'];
function loreHook(text, objName, kit, sig) {
  const t = text.toLowerCase();
  if (t.includes(objName) || (sig && t.includes(sig.toLowerCase()))) return true;
  return ['place', 'stuff', 'habit', 'omen', 'realm'].some(k => kit[k].some(ph => t.includes(ph.toLowerCase())));
}
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
  const kit = loreKitFor(o, cat), rarity = RARITY[m.rarity] ? m.rarity : 'common';
  // curated, reviewed text (src/curated.js): not loaded by the game and switched off until explicitly activated;
  // returns null for anything missing or malformed, and uses no random numbers
  const curated = typeof curatedLore === 'function' ? curatedLore(m.obj, rarity, m.seed) : null;
  if (curated) return curated;
  const R = mulberry(hashStr('lore|' + (m.obj || cat) + '|' + rarity + '|' + (m.seed >>> 0)));
  const pick = a => a[Math.floor(R() * a.length)];
  const pal = m.photo && m.photo.pal, colour = pal && pal.conf === 'confident' && pal.primary ? LORE_COLOUR(pal.primary) : null;
  const objName = o ? o.name.split(' / ')[0].toLowerCase() : (m.word || CATEGORY[cat].name.split(' /')[0]).toLowerCase();
  const sig = (m.abilities && m.abilities[0] && m.abilities[0].name) || (o && o.sig && o.sig.name) || (o && o.sigName) || CATEGORY[cat].sig.name;
  const fam = m.fam || (o && o.fam) || CATEGORY[cat].fam;
  const title = m.name && m.name.includes(', ') ? m.name.split(', ').slice(1).join(', ') : o && typeof legendTitle === 'function' ? legendTitle(o, fam) : LEGEND_TITLES[fam] || 'the Nameless';
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
  // every text must say something about THIS object: a sentence without the object's name or one of its own details
  // gets a detail from its kit (the old generic lines could describe anything)
  if (!own && !loreHook(text, objName, kit, sig)) text += ' ' + fill(pick(LORE_HOOK));
  return text;
}
// text shown for a monster: its stored lore, or (monsters from before v0.4.2) the same deterministic result
const loreOf = m => (m && m.lore) || monsterLore(m);
// encyclopedia entry: the lore of the rarest form met so far, the same for everyone with that object
function speciesLore(d, rarity) { return monsterLore({ obj: d.obj, cat: d.cat, rarity, seed: hashStr('species|' + d.key), fam: d.fam, name: d.monsterName }); }
