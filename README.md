# SNAPMON: Monsters Among Us

A mobile-first browser game. The real world is full of monsters disguised as everyday objects — photograph things around you with your phone camera, fight what you find in turn-based battles, capture weakened monsters, and complete the encyclopedia.

Runs in Chrome on Android with nothing to install: no APK, no account, no ads, no purchases, no server.

## Play

| Where | How |
|---|---|
| **GitHub Pages** (recommended) | Once Pages is enabled (see below), open `https://patrikarendas-droid.github.io/snapmon/` in Chrome on Android. Optional: Chrome menu → *Add to Home screen* for a full-screen app icon. |
| **Single file** | Download `dist/snapmon.html` to your phone and open it in Chrome. Everything (code, sprites, sounds) is inside that one file. Fonts need internet; the game falls back to system fonts offline. |
| **Claude Artifact** | `dist/artifact.html` is the same game formatted for a Claude Artifact page. The artifact sandbox blocks the AI model download, so hunting does not work there — use GitHub Pages. |
| **Local dev** | `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`. |

### Enabling GitHub Pages (one time, works from a phone browser)
1. On github.com open the repo → **Settings** → **Pages**.
2. Under *Build and deployment → Source* choose **GitHub Actions**.
3. Open the **Actions** tab → *Deploy to GitHub Pages* → **Run workflow** (or just push a commit).

The repository must be public for free GitHub Pages, or on a paid plan if private.

## How it plays

1. Tap **SNAP**. On Android Chrome this opens your real camera app (`<input capture="environment">`). **Gallery** picks an existing photo. **Live view** opens an in-page viewfinder (`getUserMedia`) where the browser allows it — the stream stops as soon as you take the shot.
2. The **Spirit Lens** (on-device AI, see below) recognises what is in the photo:
   - one confident object → identified automatically;
   - several objects → you pick which detected object to hunt (numbered boxes on the photo);
   - unsure → you pick among the lens's own top suggestions;
   - nothing recognisable → *"Unknown object — no supernatural signature detected."* and no monster.
   There is no way to type an object name or pick an arbitrary category.
3. A scan runs. The encounter roll still decides whether a monster appears (≈ 45–55% of recognised photos).
4. The monster is generated from the recognised object: its category picks the body (30+ object shapes), the sub-type picks details (dog vs cat ears, strawberry vs pineapple, bus vs bike, guitar vs drum…), colours come from the detected object's pixels, and unmapped objects take their silhouette from the detected box's proportions.
5. Turn-based battle: **Attack**, weapon **Special** (costs energy, which attacks build up), **Items**, **Capture** (uses a Snap Trap), **Flee**, **Intel**.
6. Win for XP, coins, materials and occasional weapons/charms; capture to add the monster to your permanent collection.

## Spirit Lens (object recognition)

Two open-source TensorFlow.js models run in the browser, sharing one WebGL runtime:

| Model | Job | Size |
|---|---|---|
| **MobileNet v2 1.0** (ImageNet, 1000 classes) | What is it? Fine-grained labels like "coffee mug", "strawberry", "golden retriever". Falls back to MobileNet v2 0.5 if the full model can't load. | ~14 MB |
| **COCO-SSD lite** (80 classes, boxes) | Where are things? Enables choosing between several objects. Each box is cropped and re-classified by MobileNet for a specific label. | ~18 MB |

- Weights download **once** (about 30 MB), then live in IndexedDB on the phone. Loading starts in the background as soon as you open the camera, and automatically on later visits.
- The GitHub Pages build mirrors both models onto the site (`tools/fetch-models.js`); the public hosts (tfhub.dev, storage.googleapis.com) are the fallback.
- Photos are downscaled to 640 px before inference, work is split across animation frames so the screen keeps animating, and GPU textures are released eagerly.
- Thresholds (`src/lens.js` → `CFG`): candidates need ≥ 25% confidence; automatic identification needs ≥ 55% and a clear lead over the runner-up; detector boxes count from 45%. Tables, beds, sofas and benches under another object are treated as background. People, landscapes, buildings and weapons are recognised but never become monsters.
- `tools/gen-labels.js` maps every ImageNet and COCO class to a monster category + sub-type (`src/labels.js`): 858 of 1000 ImageNet classes map to object-shaped monsters, 134 are excluded, 8 become generic "oddities".
- **Recognition debug info** (Settings) shows the top-5 whole-photo predictions, detector boxes, crop refinements, merged candidates, the decision and timings.

Why these models: they are free, private, run well on Android Chrome's WebGL backend, and the MobileNet lens was already proven on a real phone in v1. MediaPipe's EfficientNet-Lite/EfficientDet-Lite would need a second runtime (WASM), and Transformers.js open-vocabulary models (CLIP, OWL-ViT) are 100+ MB and too slow on most phones.

## Systems

- **Encounters** (only for recognised objects): base 45% + research lens bonuses, +15% for an object type you have never photographed, −12% for spamming the same type, and a 64-bit perceptual hash rejects near-identical repeat photos (×0.3 chance, no pity credit). Hidden pity: a guaranteed encounter after 4 quiet photos (3 with research), and a guaranteed Rare-or-better after 10 encounters without one. Rarity weights: Common 46 / Uncommon 28 / Rare 20 / Epic 5 / Legendary 1. The very first photo always finds an easy monster.
- **Procedural monsters** (`src/sprites.js`): 39 object categories with 60+ body builders including sub-types; the original 30 (toilet, mug, shoe, plant, laptop, banana, sofa, phone, bottle, book, lamp, chair, car, pet, tree, burger, fruit, clothing, toolbox, teddy, bin, mirror, fridge, candle, clock, key, backpack, pillow, faucet, TV) plus generic shapes for typed-in objects. Species traits (eyes, mouth, horns/crowns, legs) come from a hash of object + rarity; individual traits (colours from the photo, pattern, arms) from the monster's seed. Rarity adds anatomy: rare → horns/spikes/patterns, epic → wings/extra eyes, legendary → crowns, glowing eyes, auras and an ultimate move. Variants: Spectral, Mutated and Prismatic (unlocked by research). Each monster's full visual DNA is saved, so captured monsters never change.
- **Families & weaknesses**: Organic, Mechanical, Elemental, Household, Food, Botanical, Spectral, Mutated — each weak or resistant to weapon elements (Slash, Ballistic, Arcane, Shock, Toxic).
- **Combat**: poison, burn, stun, defense down, attack/defense buffs, immunity; enemy abilities with cooldowns; capture chance from HP, rarity, status effects and gear.
- **Weapons**: Rusty Hunter Sword, Ghostbuster Pistol (double-tap, never misses), Cursed Dagger (crits + poison), Arcane Wand (armour-piercing, burn), Thunder Hammer (huge, inaccurate, stuns). Forge with materials, upgrade to +5 (+8 with research). Six droppable charms, two slots from level 5.
- **Items**: Healing, Greater Healing, Strength, Defense, Antidote, Capture Enhancer, Snap Trap, Smoke Bomb — buy with coins or craft from materials.
- **Progression**: hunter levels, 14 research nodes bought with Research Points (from new species, first captures, levels and orders), 15 sequential orders (quests), 14 achievements, an encyclopedia of 155 species (31 object types × 5 rarities) with filters, renaming, and a hunting-buddy companion that lends you stats.
- **Defeat**: you lose 15% of your coins and wake at 40% HP. The collection is never touched. HP regenerates slowly (3%/min) between fights.

## Privacy

Photos never leave the device: recognition runs locally and only the models are downloaded. After analysis the image is discarded; a 96 px thumbnail is kept only if you turn on *Keep photo thumbnails*. Saves live in `localStorage` (`snapmon.save.v1`). Settings → *Back up your progress* gives a copyable code to restore on any device; *Start over* asks you to type RESET.

## Project layout

```
index.html          page shell + all CSS
src/data.js         rarities, families, object categories, weapons, items, research, quests
src/sprites.js      seeded RNG, pixel-grid sprite engine, monster DNA, hunter art
src/game.js         state & saves, encounters, monster generation, combat rules, rewards (no DOM)
src/audio.js        WebAudio sound effects
src/photo.js        photo loading, colour/hash analysis, live viewfinder
src/lens.js         Spirit Lens: model loading/caching, detection + classification, decision logic
src/labels.js       generated label → monster mapping (tools/gen-labels.js)
src/ui.js           screens, battle animation playback, event handling
tools/build.js      inlines everything into dist/snapmon.html and dist/artifact.html
tools/gen-labels.js builds src/labels.js from tools/data/*.json
tools/fetch-models.js mirrors the models into the Pages site
tests/sim.js        Node: encounter odds, battle balance, save round-trip
tests/e2e.js        Playwright: full loop on a phone viewport (lens result stubbed)
tests/e2e-lens.js   Playwright: real COCO-SSD + TF.js on real photos, scripted MobileNet, v1 save migration
tests/labels.js     every recogniser label maps to a real category and drawable sprite
tests/sprite-regress.js  saved v1 monsters must render pixel-identically
```

Develop: edit `src/`, then `node tools/build.js` to refresh the single-file builds.

Test: `node tests/sim.js`, and with a local server running, `node tests/e2e.js http://localhost:8000/index.html tests/fixtures <screenshot-dir>`.

## Saves across versions

v2 (AI recognition) migrates v1 saves automatically: hunter, monsters, encyclopedia, gear and quests are kept, and monsters created in v1 render pixel-identically (checked by `tests/sprite-regress.js`). Monsters a v1 player named by typing keep their names.
