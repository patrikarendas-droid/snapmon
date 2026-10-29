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

1. Tap **SNAP**. The live rear camera opens inside the game (`getUserMedia`). Frame one real object (zoom with the slider, the +/− buttons or a two-finger pinch) and tap the shutter. The photo is exactly what the viewfinder shows. The camera stops as soon as the shot is taken, the camera screen is closed, or you leave the app. There is **no gallery or file upload**, and photos are never saved or uploaded.
2. The **Spirit Lens** (on-device AI, see below) recognises what is in the photo:
   - one confident object → shown for a few seconds with **Wrong object** before anything is rolled (touch the screen to pause; it continues by itself if you do nothing);
   - several objects → you pick which detected object to hunt (numbered boxes on the photo);
   - unsure → you pick among the lens's own top suggestions;
   - nothing recognisable → *"Unknown object"* with a retake button, and no monster.
   **Wrong object** rejects an identification: nothing is created, and you can pick one of the other objects the AI itself proposed for that photo, or retake it. There is no way to type an object name or pick an arbitrary category. Camera problems (permission off, busy, no camera), model download failures, timeouts and unsupported devices each get their own message and a retry; none of them ever produces a random monster.
3. A scan runs. The encounter roll (separate from recognition) decides whether a monster appears.
4. The monster is generated from the **specific recognised object** (see *Procedural monsters*): a forklift becomes a forklift monster, not a generic vehicle. Its flavour text reflects both the object and the rarity (playful for Commons, mythic for Legendaries; `src/lore.js`) and is stored with the monster.
5. Turn-based battle: **Attack**, weapon **Special**, **Items**, **Capture** (uses a Snap Trap), **Flee**, **Intel**.
6. Win for XP, coins, materials and occasional weapons/charms; capture to add the monster to your permanent collection.

The **Guide** (the **?** button at the top, or Settings → Guide) explains status effects, combat, damage types, capture, rarity, levels, items, gear and research. Its numbers are read from the game's rule tables (`src/guide.js`).

## Spirit Lens (object recognition)

Every player uses the **same Hybrid recognition engine** (`src/engine.js`): same model files, vocabulary, thresholds
and decision rules. Only the speed depends on the phone.

| Part | Model | Job | Runs on |
|---|---|---|---|
| Detector | COCO-SSD lite (80 classes) | where are the objects (boxes, so a photo with several things offers a choice) | TF.js: WebGL, or CPU with the same weights |
| Classifier | MobileNet v2 1.0 (ImageNet) | what is it, per photo and per box | TF.js: WebGL, or CPU |
| Vocabulary model | TinyCLIP ViT-39M/16 (MIT), 2,940 labels | a second, zero-shot opinion over a much larger vocabulary | ONNX Runtime Web in a worker, on the CPU (WebAssembly) for every player so results match across devices |

- The engine combines the two opinions with calibrated rules (`docs/RECOGNITION.md`):
  - agreement → identified automatically;
  - disagreement, uncertainty or a miss → you choose between the AI's own suggestions;
  - nothing recognisable → "Unknown object" and a retake.
- **Download:** the first hunt shows a one-time notice and downloads the engine (about 86 MB). It is saved for next time and works offline afterwards. Downloads are checked for completeness
  and against the deploy manifest's checksums; a broken download is never kept.
- **Failures:** if the engine cannot download or run, you get an explanation and Try again. There is no weaker
  fallback recogniser, and the rest of the game (collection, gear, lab) keeps working.
- **Back from the background:** when the app returns to the foreground the engine checks itself (GPU context, worker)
  and reloads from the phone's cache if Android took something away; a hunt that fails on a broken engine is
  recovered and retried once, and Try again really reinitialises the engine. No page reload needed.
- **Privacy:** photos never leave the phone.
- **Developer tools:** tap the version line in Settings 7 times. Debug info, Field-test mode (side-by-side results
  of each engine part and the colour extraction, logged with your verdicts, no monsters) and a forced CPU backend
  for testing. None of them changes how hunting recognises objects.

## Monster colours from the photo

Monsters take the colours of the **photographed object itself** (`src/color.js`):
- **Region.** Colour is read from the detected box of the object you picked (or the photo's centre if there is no
  box), plus a ring and border around it that model the background.
- **Background removal.** Background colours are clustered and removed from the object's pixels, so a blue mug on a
  brown table stays blue.
- **Palette.** The remaining pixels are clustered into surfaces. Shading and glints are folded into one surface, and
  white, black and metal objects stay colourless. That gives a primary, secondary, highlight and shadow colour.
- **On the monster.** These colour the body and its shading; outlines, eyes, tyres and metal parts keep their own
  colours so the object stays readable. If the extraction is unsure, the monster only leans towards the photo's
  colour.
- **Saved.** The palette is stored in the monster's DNA, so it never changes. Monsters from earlier versions render
  exactly as before.
- **Examples:** `docs/color-examples.png`. Typical extraction time is a few milliseconds.

## Android Back button

Back closes what is on top: a sheet, the camera (stopping it), a photo or result screen. From another tab it returns
to Hunt. During a battle it reminds you to finish or flee; it never abandons the fight. On the Hunt screen the first
Back shows "Press Back again to exit SnapMon." and a second Back within 2 s leaves.

In Chrome this uses one History API guard entry, re-armed by your taps. Chrome ignores history entries made without a
tap when Back is pressed, so if you press Back twice without touching the screen in between, the second press may
leave immediately. A native build will call the same logic from the hardware Back button (`docs/ANDROID.md`).

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
src/lore.js             rarity-specific monster flavour text (deterministic, stored with each monster)
src/game.js             state, save migration, rule numbers (MECH), encounters, monsters, combat, rewards (no DOM)
src/audio.js            WebAudio sound effects
src/color.js            object palette extraction with background suppression (pure, unit-tested)
src/photo.js            colour palette + perceptual hash of the captured frame
src/engine.js           the standard Hybrid recognition engine: loading, progress, backends, decisions
src/lens.js             detector + classifier part (TF.js COCO-SSD + MobileNet)
src/lens-clip.js        TinyCLIP part: preprocessing, rejection, calibration, fusion rules
src/workers/clip-worker.js  ONNX Runtime Web inference worker (WASM for players; WebGPU for developer comparison)
src/guide.js            the in-game Guide, generated from the rule tables
src/ui.js               screens, camera (zoom), Wrong object flow, battle playback, developer tools
tools/                  build, label/vocabulary generators, model mirror, sprite contact sheet
lab/                    model export, labelled-photo fetcher and benchmark (run by .github/workflows/lab.yml)
tests/                  logic, rules trace, guide, lore, labels, sprites, colours, save migration, fusion rules; browser: gameplay (live camera), engine (real worker), Back navigation, v0.4.2 fixes
docs/                   RECOGNITION.md, RELEASING.md (versions, rollback), ANDROID.md
```

Develop on a feature branch, run the tests (see `docs/RELEASING.md`), then merge into the production branch; the Pages workflow runs every test before it deploys.

## Saves across versions

Saves migrate forward automatically (v1 → v2 → v3). v0.4.0 keeps save format 3 (no reset): new monsters simply store a photo palette, older ones render unchanged. v0.3.0 keeps your hunter, monsters (pixel-identical: `tests/sprite-regress.js`), gear, quests and encyclopedia, which is regrouped by object; an untouched copy of the old save is kept in the same browser. A save from a *newer* version is never overwritten (see `docs/RELEASING.md` before rolling back). Export a backup code from Settings at any time.
