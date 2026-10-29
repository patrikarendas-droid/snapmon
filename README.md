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

1. Tap **SNAP**. The live rear camera opens inside the game (`getUserMedia`). Frame one real object and tap the shutter. The camera stops as soon as the shot is taken, the camera screen is closed, or you leave the app. There is **no gallery or file upload**, and photos are never saved or uploaded.
2. The **Spirit Lens** (on-device AI, see below) recognises what is in the photo:
   - one confident object → identified automatically;
   - several objects → you pick which detected object to hunt (numbered boxes on the photo);
   - unsure → you pick among the lens's own top suggestions;
   - nothing recognisable → *"Unknown object"* with a retake button, and no monster.
   There is no way to type an object name or pick an arbitrary category. Camera problems (permission off, busy, no camera), model download failures, timeouts and unsupported devices each get their own message and a retry; none of them ever produces a random monster.
3. A scan runs. The encounter roll (separate from recognition) decides whether a monster appears.
4. The monster is generated from the **specific recognised object** (see *Procedural monsters*): a forklift becomes a forklift monster, not a generic vehicle.
5. Turn-based battle: **Attack**, weapon **Special**, **Items**, **Capture** (uses a Snap Trap), **Flee**, **Intel**.
6. Win for XP, coins, materials and occasional weapons/charms; capture to add the monster to your permanent collection.

## Spirit Lens (object recognition)

**Production** (what every player uses): two open-source TensorFlow.js models in the browser, sharing one WebGL runtime.

| Model | Job | Size |
|---|---|---|
| **MobileNet v2 1.0** (ImageNet, 1000 classes) | What is it? Fine-grained labels like "forklift", "coffee mug", "golden retriever". Falls back to MobileNet v2 0.5. | ~14 MB |
| **COCO-SSD lite** (80 classes, boxes) | Where are things? Each box is cropped and re-classified by MobileNet for a specific label. | ~18 MB |

- Weights download once (about 30 MB) and stay in IndexedDB. One recognition runs at a time.
- `tools/gen-labels.js` maps every recogniser class to a **registry object** (`src/labels.js`): 562 ImageNet classes to registry objects, 271 to their own identity with a related design (e.g. dog breeds), 62 to family-tier objects, 105 excluded (people, places, weapons); all 80 COCO classes.

**Experimental** (developer-only, off by default, Settings → Developer & testing): a TinyCLIP zero-shot classifier (MIT licence) running in a Web Worker with ONNX Runtime Web (WebGPU when available, otherwise WASM), scoring photo crops against precomputed text embeddings for a ~2,900-label vocabulary. *Compare* shows both lenses side by side; *Hybrid* lets it refine production results under documented rules. *Field-test mode* logs each photo's results with your verdict in a separate store for top-1/top-3 statistics, without creating monsters. Model evaluation, benchmark numbers and fusion rules: [`docs/RECOGNITION.md`](docs/RECOGNITION.md).

## Systems

- **Encounters** (only for recognised objects): base 45% + research lens bonuses, +15% for an object type you have never photographed, −12% for spamming the same type, and a 64-bit perceptual hash rejects near-identical repeat photos (×0.3 chance, no pity credit). Hidden pity: a guaranteed encounter after 4 quiet photos (3 with research), and a guaranteed Rare-or-better after 10 encounters without one. Rarity weights: Common 46 / Uncommon 28 / Rare 20 / Epic 5 / Legendary 1. The very first photo always finds an easy monster.
- **Procedural monsters** (`src/objects.js`, `src/parts.js`, `src/sprites.js`): a registry links each recognised object → identity → visual template → variation → stats and signature move. Designs come in honest tiers: *specific* (hand-built from reusable parts, e.g. forklift, excavator, office chair, teapot), *composed* (a parametric template such as vehicle, seat or appliance with object-specific parameters), *related* (borrows a close relative's design, e.g. dog breeds), and *family* (the category's general shape). Settings → Developer shows the counts, and every monster sheet says which kind of design it has. Individuals vary in colour, eyes, mouth, pattern and rarity features while keeping the object's silhouette (`tests/sprites-v3.js` checks this). Legacy (v0.1/v0.2) monsters: 39 object categories with 60+ body builders including sub-types; the original 30 (toilet, mug, shoe, plant, laptop, banana, sofa, phone, bottle, book, lamp, chair, car, pet, tree, burger, fruit, clothing, toolbox, teddy, bin, mirror, fridge, candle, clock, key, backpack, pillow, faucet, TV) plus generic shapes for typed-in objects. Species traits (eyes, mouth, horns/crowns, legs) come from a hash of object + rarity; individual traits (colours from the photo, pattern, arms) from the monster's seed. Rarity adds anatomy: rare → horns/spikes/patterns, epic → wings/extra eyes, legendary → crowns, glowing eyes, auras and an ultimate move. Variants: Spectral, Mutated and Prismatic (unlocked by research). Each monster's full visual DNA is saved, so captured monsters never change.
- **Families & weaknesses**: Organic, Mechanical, Elemental, Household, Food, Botanical, Spectral, Mutated — each weak or resistant to weapon elements (Slash, Ballistic, Arcane, Shock, Toxic).
- **Combat**: poison, burn, stun, defense down, attack/defense buffs, immunity; enemy abilities with cooldowns; capture chance from HP, rarity, status effects and gear.
- **Weapons**: Rusty Hunter Sword, Ghostbuster Pistol (double-tap, never misses), Cursed Dagger (crits + poison), Arcane Wand (armour-piercing, burn), Thunder Hammer (huge, inaccurate, stuns). Forge with materials, upgrade to +5 (+8 with research). Six droppable charms, two slots from level 5.
- **Items**: Healing, Greater Healing, Strength, Defense, Antidote, Capture Enhancer, Snap Trap, Smoke Bomb — buy with coins or craft from materials.
- **Progression**: hunter levels, 14 research nodes bought with Research Points (from new species, first captures, levels and orders), 15 sequential orders (quests), 14 achievements, an encyclopedia of object kinds (each object hides its own species; dots show the rarities met) with filters, renaming, and a hunting-buddy companion that lends you stats.
- **Defeat**: you lose 15% of your coins and wake at 40% HP. The collection is never touched. HP regenerates slowly (3%/min) between fights.

## Privacy

Photos never leave the device: recognition runs locally and only the models are downloaded. After analysis the image is discarded; a 96 px thumbnail is kept only if you turn on *Keep photo thumbnails*. Saves live in `localStorage` (key `snapmon.save.v1`, save format 3). Settings → *Back up your progress* gives a copyable code to restore on any device; *Start over* asks you to type RESET.

## Project layout

```
index.html              page shell + all CSS
src/data.js             rarities, families, object categories, weapons, items, research, quests
src/objects.js          object registry: identities, aliases, visual tiers, colours, signature moves
src/parts.js            sprite components, parametric templates, dedicated object designs
src/sprites.js          seeded RNG, pixel-grid sprite engine, monster DNA (v1/v2 legacy + v3 object DNA)
src/labels.js           generated recogniser label → object mapping (tools/gen-labels.js)
src/platform.js         camera / storage / device layer (swap for a native build, see docs/ANDROID.md)
src/game.js             state, save migration, encounters, monster generation, combat, rewards (no DOM)
src/audio.js            WebAudio sound effects
src/photo.js            colour and perceptual-hash analysis of the captured frame
src/lens.js             production Spirit Lens (TF.js MobileNet + COCO-SSD)
src/lens-clip.js        experimental CLIP lens: preprocessing, rejection, calibration, fusion
src/workers/clip-worker.js  ONNX Runtime Web inference worker
src/ui.js               screens, camera, battle playback, developer tools
tools/                  build, label/vocabulary generators, model mirror, sprite contact sheet
lab/                    model export, labelled-photo fetcher and benchmark (run by .github/workflows/lab.yml)
tests/                  logic, labels, sprites, save migration, fusion rules, browser end-to-end (live camera)
docs/                   RECOGNITION.md, RELEASING.md (versions, rollback), ANDROID.md
```

Develop on a feature branch, run the tests (see `docs/RELEASING.md`), then merge into the production branch; the Pages workflow runs every test before it deploys.

## Saves across versions

Saves migrate forward automatically (v1 → v2 → v3). v0.3.0 keeps your hunter, monsters (pixel-identical: `tests/sprite-regress.js`), gear, quests and encyclopedia, which is regrouped by object; an untouched copy of the old save is kept in the same browser. A save from a *newer* version is never overwritten (see `docs/RELEASING.md` before rolling back). Export a backup code from Settings at any time.
