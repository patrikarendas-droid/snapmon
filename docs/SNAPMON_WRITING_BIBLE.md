# The SNAPMON Writing Bible

The editorial standard for every curated monster: its **monster names**, its **flavour text** and its **move names**,
for each of the five rarities. Read this before writing or reviewing a batch. It is built on the writing the developer
approved and play-tested on an Android phone: **Pilot 01** (`content/curated/pilot-01-approved.json`). Where this
document quotes Pilot 01 it says **(approved)** and the quote is exact. Anything marked **(illustration)** was invented
here to explain a point and is **not** approved canon.

Workflow, file format and tools: [`CONTENT_WRITING_GUIDE.md`](CONTENT_WRITING_GUIDE.md). Coverage: [`review/COVERAGE.md`](review/COVERAGE.md).

---

## 1. The one-sentence brief

**A real object does something that makes sense for what it is, and the consequence is concrete, surprising and funny.**

The humour is *slightly stupid in a smart way*: simple, physical, logically connected absurdity. A child understands
the setup; an adult enjoys the punchline. It stays funny all the way up to Legendary.

> Heats the bowl until nobody can touch it. Leaves the soup freezing cold on purpose. — microwave, common **(approved)**

Every reader has burnt their fingers on that bowl. The joke is only one step away from real life, and "on purpose"
turns an appliance flaw into a personality.

## 2. Anatomy of a good passage

1. **Hook it to the object.** Its purpose, shape, sound, habit or the way people use it. A forklift lifts and beeps;
   a security camera watches, records and replays; a book has pages, margins, characters and endings.
2. **One premise.** One clear idea per rarity, not three.
3. **A concrete consequence.** A specific person, place or thing reacts: "the photocopier has called in sick",
   "the ceiling is now covered in shoes". Specific nouns are funnier than abstractions.
4. **Land it short.** Usually two short sentences: the trick, then the punchline. Pilot 01 averages 94 characters
   (65–129). Aim for ~60–160; the validator stops at 220.

> Picked up an entire house to look for a lost TV remote underneath. It was in the sofa. — forklift, rare **(approved)**

Huge power (a house), petty motive (the remote), deflating punchline (it was in the sofa all along). Power and
pettiness together is the house style.

## 3. The five rarities

Rarity raises the **power** and the **scale of trouble**, but each rarity is a **new comic premise**. Never the same
joke with bigger numbers. These rules apply to the monster name, the flavour text and the move names together.

| Rarity | Premise | Monster name feels… | Move names feel… |
|---|---|---|---|
| **Common** | An annoying, stupid everyday habit. | small, catchy, playful, mildly troublesome | petty, physical |
| **Uncommon** | A recognizable behaviour, unusual talent, or small supernatural trick. Relatable and playful. **Magic is optional.** | hints at a quirk or talent | a believable odd twist |
| **Rare** | A memorable, genuinely troublesome power. | more bite, confidence, character | distinct, confident |
| **Epic** | Ridiculous large-scale chaos with a funny consequence. | bolder or sillier, **not** automatically grander fantasy syllables | big but readable |
| **Legendary** | An outrageous, almost unbelievable achievement with a funny punchline. Cosmic scale is allowed, never required, and the achievement does not have to be physical or destructive (becoming the boss without doing any work counts). | iconic, memorable, tied to the object, still amusing | must fit the real mechanics of every variant |

Every rarity still needs a **different comic premise**, and humour must be present at every level. What matters is
humour, personality and a natural progression through the five rarities (updated 2026-11-02 by the developer: an
Uncommon can simply be a recognizable everyday behaviour, e.g. a dog knowing you opened the cheese from the far end of
the garden).

### The reference ladder: apple (approved, exact)

- **Common:** Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- **Uncommon:** Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- **Rare:** Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- **Epic:** Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- **Legendary:** Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.

Why it works: five **different** premises (stealing crunch → regrowing cores → seed artillery → tree eruptions →
redecorating the Moon), each tied to a real apple fact (crunch, cores, seeds, trees, worms), each with a human
reaction (you hear chewing, the bin-taker, the lunchbox ban, seat belts, Australia for scale).
**This ladder shows scale and distinct premises. It is not a template to copy 2,291 times.**

### More approved ladders, and what each teaches

**Security camera: every rarity is a different *kind* of watching.**
- Common: Has recorded 400 hours of a pigeon sitting on a bin. The investigation is ongoing. **(approved)**
- Rare: Can replay the last five minutes of real life, not just video. Mostly uses it to watch people trip twice. **(approved)**
- Legendary: Once froze the whole universe for one photograph. Kept it still for three days because somebody blinked. **(approved)**

Recording, zoom, replay, broadcasting, freezing a frame: the function stays the same, the trick changes. The
legendary punchline ("somebody blinked") is the same small annoyance as a bad holiday photo.

**Book: the joke uses the object's own vocabulary (plot, villain, margins, ending).**
- Uncommon: Gave its main characters hiccups. The villain's big speech took three hours. **(approved)**
- Rare: Anything written in its margins becomes real for an hour. Someone wrote FREE PIZZA, and the school is still finding boxes. **(approved)**
- Legendary: Can write entire new worlds into existence with one page. Keeps forgetting to include toilets. **(approved)**

The legendary line is god-tier power undercut by a practical oversight. Cleverness, not volume, makes it legendary.

**Forklift: workplace bureaucracy and pride.**
- Common: Reverses even when parked, just so it can make the beeping noise. **(approved)**
- Uncommon: Uses its forks to pick olives off a pizza without touching the cheese. Calls this precision engineering. **(approved)**
- Epic: Drove a cruise ship straight across the desert on its forks. The passengers are still asking when they can use the pool. **(approved)**

"Calls this precision engineering": the object has an *attitude*. Give objects opinions.

**Microwave: real annoyances, magnified.**
- Uncommon: Can warm leftovers without being plugged in. Still makes you press START six times. **(approved)**
- Legendary: Can reheat the Sun when it cools down. Still beeps six times because nobody comes to open the door. **(approved)**

A callback across rarities (six presses → six beeps) is welcome when it is the object's real habit.

**Rubber duck: stubborn character, silly logistics.**
- Rare: Copies anyone's voice perfectly, but adds QUACK at the end. Three radio stations have fired it. **(approved)**
- Legendary: Convinced every real duck on Earth that it is their king. The ducks have formed an army and demanded more bread. **(approved)**

A legendary that is huge (every duck on Earth) but whose payoff is tiny and in character (more bread).

## 4. Comic mechanisms: rotate them

Pick the mechanism that suits the object, and vary it across a batch so objects do not feel reskinned:

- **Literal misunderstanding:** the object takes its job too literally.
- **Workplace bureaucracy:** complaints, sick days, paperwork ("The investigation is ongoing").
- **Stubbornness / pride:** "Calls this ventilation." (sock, approved)
- **Physics gone wrong:** gravity, temperature, size swapped.
- **Embarrassment:** the worst possible moment.
- **Unintended consequences:** a small act snowballs.
- **Petty revenge:** "just to annoy whoever takes out the rubbish".
- **Silly logistics:** the practical problem nobody planned for (seat belts, toilets, the pool).
- **Overconfidence:** a big claim, a small result.
- **Misplaced helpfulness:** trying to help, making it worse.
- **Deadpan reaction:** the world responds calmly to madness ("The plant has started doing push-ups." energy drink, approved).

## 5. Warning signs: not forbidden, just watched

These phrases are fine once. Mass-produced, they make a batch feel templated. `node tools/curated.js lint` counts them
across all content and flags clusters.

- Lines starting with **"Can …"**: 11 of the 50 approved Pilot 01 lines already do. Prefer a verb of action
  ("Fires…", "Locked…", "Picked up…") or a situation.
- **"entire …"** (8 of 50 in Pilot 01), **"…is furious"**, **"has been banned from…"**, **"…fired it"**.
- **Sun, Moon, stars, universe, Earth, planet**: 7 of 50 in Pilot 01, mostly legendaries. Cosmic scale is *one*
  legendary option. Aim for at most about a third of legendaries in a batch being cosmic.
- **"Scientists / astronomers are baffled"**, **"nobody knows"**, **"ancient scrolls / prophecy / kingdom / gods"**.
  Generic mystery is the opposite of the house style.
- The **number three** as an automatic comic number ("three radio stations", "three bedtime stories", "three hours").

## 6. Never

- Gore, cruelty, body horror, tragedy played for laughs, anything frightening for a child.
- Modern memes, brand names and slogans, trademarked characters, real people, politics.
- Random non sequiturs (the joke must follow from the object), pretentious myth, dark-for-dark's-sake.
- Facts that are wrong for the object in a way players would notice (a sock does not have a plug).
- Toolbox, kingdom or "door" filler that belongs to another object.

### Recognizability over technical accuracy

SnapMon is a fantasy monster game. Prefer the **familiar, intuitive association** over scientific nitpicking: people
associate sea urchins with painful spikes, so the sea urchin shell monster embraces spikes even though an empty urchin
shell is usually spineless. Fantasy exaggeration is welcome; the joke must still connect logically to the object.

## 7. Monster display names

A **monster name** is the creature's species name for one rarity (what the encounter, battle and encyclopedia show).
It is not the object's name ("Apple"), the recogniser's label, the internal id, the player's nickname or the species
identity. One object has five named rarity forms.

**Rules**
- Sounds like a creature in a playful monster-collecting game: not "Common Apple", not a plain object label, not five
  interchangeable fantasy titles.
- Recognisably derived from the object's identity or function. Puns are welcome when they are **good**; clarity beats
  a tortured pun. A well-chosen straightforward name is allowed.
- Personality and power rise with rarity; humour and specificity stay.
- Vary the construction. Do not lean on one suffix or word across the collection (‑ling, ‑lord, ‑zilla, Supreme,
  Cosmic, King, Mega, Ultra…). The linter counts repeated endings.
- Short and pronounceable on a phone: Common–Epic up to 24 characters; Legendary up to 40, and it may carry a short
  epithet ("Name, the …") when it fits. Not every legendary needs an epithet.
- The five names of one object must all differ.

**Today's generated names** come from the object's short name plus a rarity suffix (e.g. energy drink: Drinkling,
Drinkster, Drinkbeast, Drinkdrake, "Drinkcolossus, the Golden Energy Drink"). Curated names replace that pattern
with deliberate names. **Curated names are not live yet:** they are draft-only until the developer approves an
activation step (see the guide).

**Illustrations (NOT approved, for feedback only)**: Pilot 01 has no curated names yet.

| Object | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| apple (illustration) | Crunchling | Corebounce | Pipshooter | Orchard Quake | Applestorm, the Moon Biter |
| forklift (illustration) | Beepback | Forkfinesse | Palletgrab | Cargo Colossus | Atlas the Stacker |
| rubber duck (illustration) | Squeakums | Floatquack | Mimicduck | Rubbertown | Admiral Quackington |

Questions for the human editor: is "Applestorm, the Moon Biter" the right weight for a legendary? Are compound
pun-names (Pipshooter) preferred over two-word names (Orchard Quake)? Should legendaries usually carry an epithet?

## 8. Move display names

Moves have **mechanics that never change**. A curated name only relabels an existing stable move slot
(`signature`, `kit.<move>`, `legend`, `ultimate`).

1. **Read the real mechanics first** (`node tools/curated.js pack <batch>` lists them). Never trust the default name.
2. **Be truthful to the effect.**

| Effect | Good name ideas | Avoid |
|---|---|---|
| plain hit, high power | slam, crash, whack, the object's heavy part | names promising a status |
| multi-hit (×3) | plural or repeated: "Clack Clack Clack", "Papercut Barrage" **(approved)** | a single big blow ("Headbutt") |
| burn | heat, scald, sizzle, toast, flame ("Flaming Quack" **(approved)**) | freeze, ice |
| poison | rot, stink, mould, rust ("Rusty Lockjaw" **(approved)**) | clean, fresh |
| stun | flash, jolt, dazzle, beep, sudden noise ("Red Light Flash" **(approved)**) | heal or buff words |
| defence down | crack, dent, soften, unravel, distract | |
| drain | sip, slurp, steal, borrow, siphon | |
| self heal | rest, refill, patch, rewind ("One More Minute" **(approved)**) | attack words |
| self attack up | warm-up, power-up, boost ("Maximum Power" **(approved)**) | attack words |
| self defence up | brace, lock, shell, armour ("No Entry" **(approved)**) | attack words |

3. **Which rarities use the slot?** The signature appears at every rarity, kit moves only at the rarities the pack
   lists, and legend move and Ultimate only on Legendaries. A kit move used by Common and Epic monsters must not
   sound legendary.
4. **Legendary moves: check every variant.** The legend move has one type. The Ultimate's effect can differ between
   normal, Spectral and Mutated forms: if it does, the name must be **effect-neutral** ("Apple-ocalypse", "Planet
   Pickup", "The Big Switch" **(approved)**).
5. **Only rename when it is a real improvement.** One good name per slot. No collisions with the monster's other moves.
6. Same comic voice as the lore, but short: 3–28 characters.

## 9. Per-object checklist (writer and editor)

- [ ] Five premises, all different, each tied to a real trait of **this** object.
- [ ] Power rises Common → Legendary; every rarity still has a punchline.
- [ ] At most one or two warning-sign phrases in the whole object; legendary not cosmic by reflex.
- [ ] Each line is one or two short sentences a child can follow; under 220 characters.
- [ ] Five distinct monster names that sound like creatures and fit the rarity.
- [ ] Move names match the real effect, the rarities that use them and, for legendaries, every variant.
- [ ] No brands, memes, gore, real people or wrong facts.
- [ ] Status stays `draft` until the developer approves it.
