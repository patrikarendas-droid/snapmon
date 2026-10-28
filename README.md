# SNAPMON: Monsters Among Us

A mobile-first browser game. The real world is full of monsters disguised as everyday objects — photograph things around you with your phone camera, fight what you find in turn-based battles, capture weakened monsters, and complete the encyclopedia.

Runs in Chrome on Android with nothing to install: no APK, no account, no ads, no purchases, no server.

## Play

| Where | How |
|---|---|
| **GitHub Pages** (recommended) | Once Pages is enabled (see below), open `https://patrikarendas-droid.github.io/snapmon/` in Chrome on Android. Optional: Chrome menu → *Add to Home screen* for a full-screen app icon. |
| **Single file** | Download `dist/snapmon.html` to your phone and open it in Chrome. Everything (code, sprites, sounds) is inside that one file. Fonts need internet; the game falls back to system fonts offline. |
| **Claude Artifact** | `dist/artifact.html` is the same game formatted for a Claude Artifact page. |
| **Local dev** | `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`. |

### Enabling GitHub Pages (one time, works from a phone browser)
1. On github.com open the repo → **Settings** → **Pages**.
2. Under *Build and deployment → Source* choose **GitHub Actions**.
3. Open the **Actions** tab → *Deploy to GitHub Pages* → **Run workflow** (or just push a commit).

The repository must be public for free GitHub Pages, or on a paid plan if private.

## How it plays

1. Tap **SNAP**. On Android Chrome this opens your real camera app (`<input capture="environment">`). **Gallery** picks an existing photo. **Live view** opens an in-page viewfinder (`getUserMedia`) where the browser allows it — the stream stops as soon as you take the shot.
2. Tell the camera what you photographed (tap a category or type a word like "kettle"). The game does **not** pretend to recognise objects; see *Object recognition* below.
3. A scan runs. The encounter roll decides whether a monster appears (≈ 45–55% of photos).
4. Monsters are generated from the object type, the photo's dominant colour, the rarity, and a random seed.
5. Turn-based battle: **Attack**, weapon **Special** (costs energy, which attacks build up), **Items**, **Capture** (uses a Snap Trap), **Flee**, **Intel**.
6. Win for XP, coins, materials and occasional weapons/charms; capture to add the monster to your permanent collection.

## Systems

- **Encounters**: base 45% + research lens bonuses, +15% for an object type you have never photographed, −12% for spamming the same type, and a 64-bit perceptual hash rejects near-identical repeat photos (×0.3 chance, no pity credit). Hidden pity: a guaranteed encounter after 4 quiet photos (3 with research), and a guaranteed Rare-or-better after 10 encounters without one. Rarity weights: Common 46 / Uncommon 28 / Rare 20 / Epic 5 / Legendary 1. The very first photo always finds an easy monster.
- **Procedural monsters** (`src/sprites.js`): 30 object-shaped body builders (toilet, mug, shoe, plant, laptop, banana, sofa, phone, bottle, book, lamp, chair, car, pet, tree, burger, fruit, clothing, toolbox, teddy, bin, mirror, fridge, candle, clock, key, backpack, pillow, faucet, TV) plus generic shapes for typed-in objects. Species traits (eyes, mouth, horns/crowns, legs) come from a hash of object + rarity; individual traits (colours from the photo, pattern, arms) from the monster's seed. Rarity adds anatomy: rare → horns/spikes/patterns, epic → wings/extra eyes, legendary → crowns, glowing eyes, auras and an ultimate move. Variants: Spectral, Mutated and Prismatic (unlocked by research). Each monster's full visual DNA is saved, so captured monsters never change.
- **Families & weaknesses**: Organic, Mechanical, Elemental, Household, Food, Botanical, Spectral, Mutated — each weak or resistant to weapon elements (Slash, Ballistic, Arcane, Shock, Toxic).
- **Combat**: poison, burn, stun, defense down, attack/defense buffs, immunity; enemy abilities with cooldowns; capture chance from HP, rarity, status effects and gear.
- **Weapons**: Rusty Hunter Sword, Ghostbuster Pistol (double-tap, never misses), Cursed Dagger (crits + poison), Arcane Wand (armour-piercing, burn), Thunder Hammer (huge, inaccurate, stuns). Forge with materials, upgrade to +5 (+8 with research). Six droppable charms, two slots from level 5.
- **Items**: Healing, Greater Healing, Strength, Defense, Antidote, Capture Enhancer, Snap Trap, Smoke Bomb — buy with coins or craft from materials.
- **Progression**: hunter levels, 14 research nodes bought with Research Points (from new species, first captures, levels and orders), 15 sequential orders (quests), 14 achievements, an encyclopedia of 155 species (31 object types × 5 rarities) with filters, renaming, and a hunting-buddy companion that lends you stats.
- **Defeat**: you lose 15% of your coins and wake at 40% HP. The collection is never touched. HP regenerates slowly (3%/min) between fights.

## Object recognition (honest version)

By default the player chooses what they photographed; the game reads only the photo's colours (to tint the monster) and a similarity fingerprint (to stop repeat-photo farming). **AI Lens** in Settings is an opt-in experiment that loads TensorFlow.js + MobileNet (≈10 MB, from cdn.jsdelivr.net / Google storage) and runs it in the browser to *suggest* a category — the player still confirms. It is untested on real devices and is blocked in sandboxes that restrict network access (including the Claude Artifact viewer); the game then says so and falls back to manual selection.

## Privacy

Photos never leave the device. After analysis the image is discarded; a 96 px thumbnail is kept only if you turn on *Keep photo thumbnails*. Saves live in `localStorage` (`snapmon.save.v1`). Settings → *Back up your progress* gives a copyable code to restore on any device; *Start over* asks you to type RESET.

## Project layout

```
index.html          page shell + all CSS
src/data.js         rarities, families, object categories, weapons, items, research, quests
src/sprites.js      seeded RNG, pixel-grid sprite engine, monster DNA, hunter art
src/game.js         state & saves, encounters, monster generation, combat rules, rewards (no DOM)
src/audio.js        WebAudio sound effects
src/photo.js        photo loading, colour/hash analysis, live viewfinder, optional AI lens
src/ui.js           screens, battle animation playback, event handling
tools/build.js      inlines everything into dist/snapmon.html and dist/artifact.html
tests/sim.js        Node: encounter odds, battle balance, save round-trip
tests/e2e.js        Playwright: full loop on a phone viewport
```

Develop: edit `src/`, then `node tools/build.js` to refresh the single-file builds.

Test: `node tests/sim.js`, and with a local server running, `node tests/e2e.js http://localhost:8000/index.html tests/fixtures <screenshot-dir>`.
