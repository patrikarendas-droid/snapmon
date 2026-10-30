# SNAPMON development journal

The durable hand-off between development sessions. A new Claude Code session does **not** remember earlier
conversations: this file, the other docs and the Git history are the memory. Read it first; update it after every
meaningful change (see "How to keep this journal" at the end). Detailed specifications live in the linked docs, not here.

Last updated: 2026-10-30, release v0.4.5 + Phase 1 curated-writing foundation (inactive).

---

## 1. Project overview

- **What it is:** a mobile monster-collecting RPG. The player photographs real objects with the live camera; an
  on-device AI recognises the object; a monster based on that specific object may appear; the player fights,
  captures and collects monsters, upgrades gear and does research.
- **Strategy:** Android first. Today it is a browser game (Android Chrome) served by GitHub Pages:
  <https://patrikarendas-droid.github.io/snapmon/>. A native APK is planned by wrapping the same web code (e.g.
  Capacitor); no APK work has started. iOS is a low-priority possibility only (notes in `docs/ANDROID.md`).
- **Code:** plain JavaScript, no framework, no build step for development. `index.html` holds all CSS; `src/` holds
  the game. `tools/build.js` also produces single-file builds in `dist/` (one is published as a claude.ai Artifact).
- **Architecture (short):**
  - `src/game.js` – state, saves/migrations, rule numbers (`MECH`), encounters, monsters, combat, rewards (no DOM).
  - `src/data.js` rarities, families, categories, weapons, items, research, quests · `src/objects.js` object
    registry and design rules · `src/parts.js` / `src/sprites.js` pixel-art engine · `src/lore.js` flavour text ·
    `src/guide.js` in-game Guide.
  - Recognition: `src/engine.js` (the one standard Hybrid engine), `src/lens.js` (COCO-SSD + MobileNet on TF.js),
    `src/lens-clip.js` + `src/workers/clip-worker.js` (TinyCLIP on ONNX Runtime Web), decision rules in
    `ClipLens.hybridDecision`. Details: `docs/RECOGNITION.md`.
  - `src/platform.js` – camera, storage and asset paths behind small interfaces (swappable for a native build).
  - `src/ui.js` – all screens, camera, flows, developer tools, Android Back navigation.
- **Releases:** develop on a `feature/…` branch → run tests → merge (no fast-forward) into the production branch
  `claude/snapmon-game-dev-7o667u` → `.github/workflows/pages.yml` re-runs all tests, assembles the site (models,
  vendored runtimes, manifest, site check) and deploys → tag through the `tag-release.yml` workflow (direct tag
  pushes are refused). Never force-push. Details and rollback: `docs/RELEASING.md`.

## 2. Product decisions and non-negotiable requirements

- **Live camera only.** No gallery upload, no file input, no typed or picked object names. Every monster identity
  comes from recognition of a live photo; the player may only choose among the recogniser's own suggestions.
- **One standard recogniser for every player:** the full Hybrid engine (COCO-SSD + MobileNet v2 + TinyCLIP 39M/16,
  2,940-label vocabulary, calibrated thresholds). No weaker fallback recogniser, no silent downgrade; if it cannot
  run, the player gets an explanation and Retry.
- **TinyCLIP always runs on the CPU (WASM, one thread)** so decisions are identical across devices (since v0.4.1).
  The detector/classifier may use WebGL (measured identical to CPU within 0.0001).
- **Local recognition, no paid per-photo API.** Photos never leave the phone. No new AI services.
- **The player confirms identifications manually** (Scan for monsters / Wrong object); nothing is rolled before that,
  and there is no countdown (since v0.4.3).
- **Monsters must match their object** in body design, name, colours (from the photo) and flavour text, with rarity
  escalation (v0.4.2 lore, v0.4.3 identity work).
- **Save compatibility:** save format 3 since v0.3.0; changes are additive; saves are never reset silently; saved
  monsters never change look without the player's consent.
- **Gameplay loop stays central;** balance, odds and combat numbers change only on purpose (guarded by
  `tests/rules-trace.js`).
- **Android is the priority test platform.** The developer's Android phone (Chrome) is the only real device used.

## 3. Release history (from Git tags)

| Tag | Commit | Date | Summary |
|---|---|---|---|
| v0.1.0 | 137e1ad | 2026-10-28 | First playable game (manual object entry, later removed). |
| v0.2.0 | aac158c | 2026-10-28 | Spirit Lens: MobileNet + COCO-SSD recognition; manual entry removed. |
| v0.3.0 | cf79686 | 2026-10-29 | Object registry and object-specific monsters; live camera only; experimental TinyCLIP (developer); save format 3. |
| v0.3.1 | 411b66f | 2026-10-29 | Hybrid asks the player when the lenses disagree; field-test verdicts. |
| v0.3.2 | f94ce94 | 2026-10-29 | Near-synonyms no longer trigger the disagreement prompt. |
| v0.3.3 | 9905e94 | 2026-10-29 | TinyCLIP second opinion when production is unsure; no double-counted boxes. |
| v0.4.0 | 86d4938 | 2026-10-29 | Hybrid is the only recogniser for everyone; photo-derived monster colours; Android Back navigation. |
| v0.4.1 | bfeff56 | 2026-10-29 | TinyCLIP on the CPU (WASM, one thread) for every player; timing diagnostics. |
| v0.4.2 | f6dc5cc | 2026-10-29 | Playtest fixes: camera status text, zoom, Guide, rarity lore, background recovery, Settings scroll, Wrong object. |
| v0.4.3 | a27c89c | 2026-10-30 | Monsters match their object (designs + rules for ~1,000 objects); no countdown; SNAP waits for the engine. |
| v0.4.4 | 11e8b76 | 2026-10-30 | This journal; Force CPU shutter freeze mitigated; developer Quick Monster Test Mode. |
| v0.4.5 | (see `git tag`) | 2026-10-30 | Food/drink identity; object families; per-object move kits; unique Legendaries. |

## 4. Current state and next priorities

- **State:** v0.4.5 deployed. All automated suites pass (see section 7). Phone playtest of v0.4.4 (with Quick Monster
  Test Mode): monsters now resemble their objects, except drinks/foods drawn as burgers, a Mechanical spoon, and
  Legendaries sharing titles and moves; v0.4.5 addresses these (needs phone check).
- **Lore overhaul Phase 1 (curated-writing foundation):** reviewed and approved by the developer, merged into
  production (no version bump; inert). Curated system stays disabled (`CURATED.enabled = false`, `curated.js` not
  loaded by the game or builds); `content/curated/` is empty. Live output frozen by `tests/generator-snapshot.js`.
  **Do not start the next phase without explicit approval.**
- **Developer decisions for the next phases (2026-10-30):**
  1. Existing saves/progress are not important: a save reset is acceptable only if a change genuinely requires it,
     explained clearly beforehand. Never wipe saves unnecessarily.
  2. Stable internal ability ids/keys are approved for the integration stage; cooldowns and other gameplay
     references should eventually use ids, not display names, so renaming a move can never change mechanics. Plan
     and test it as its own step.
  3. At activation keep a gameplay regression baseline (stats, move effects/numbers, cooldown behaviour, artwork,
     rarity, recognition, balance rules) separate from the text: do not just re-record the whole snapshot.
  4. Approved writing may update encyclopedia descriptions of species already discovered (consistent lore).
  5. The first 10–20 entries are written and reviewed separately before activation. Never mass-generate
     descriptions or mark entries "reviewed" automatically.
- **Next (proposed, not started):** verify v0.4.5 on the phone with Quick Monster Test Mode (drinks, foods, vegetables,
  kitchenware, Legendaries); continue visual QA of designs; native APK when requested.

## 5. Open issues / known limitations

| Issue | Status | Notes / files | Next action |
|---|---|---|---|
| Brief freeze after the camera shutter with **Force CPU backend** (developer option) | Mitigated in v0.4.4, needs phone check | The CPU detector (TF.js CPU backend) runs on the main thread for ~1 s; see section 6. `src/ui.js` `paintFirst`, `recognizeFlow`. | Phone test: the Analysing screen should now appear immediately with the photo, sweep still moving; only the clock text pauses. A full fix needs the detector in a worker (not planned). |
| Same freeze for real players whose phone cannot use WebGL | Same mitigation | Rare: only phones where WebGL fails fall back to the CPU detector. | As above. |
| ~730 objects use their category's general shape | Known | Plants, animals, clothes, cakes/pies, cups, household bottles… where the shape fits. Every food, fruit and vegetable has a design since v0.4.5. | Add designs/rules for the worst cases found in QA (`FOOD_RULES`/`DESIGN_RULES` in `src/objects.js`). |
| Curated monster writing not active | Phase 1 merged (inactive) | `src/curated.js`, `tools/curated.js`, `content/curated/`, `docs/CONTENT_WRITING_GUIDE.md`. Move-name overrides need stable ability ids (approved for the integration stage, not built). Activated entries will also update encyclopedia text (approved). | Pilot batch (10–20 objects) written and reviewed separately; then approved integration (ability ids, split gameplay/text baselines) and activation. |
| "Sausage" is recognised as the hot-dog object | Known (v0.4.5) | The recogniser vocabulary maps the label to `hotdog`; since v0.4.5 that object has meat lore/moves. A separate sausage needs a vocabulary change (engine change + lab run). | Only if requested. |
| Existing monsters keep their old family/moves (e.g. a Mechanical spoon) | By design | Saved monsters never change without consent; "Update its look" offers the new body/text for redesigned objects (energy drink), not family or stats. Test-collection monsters are never updated. | None. |
| Legendary moves: only the legend move and Ultimate are unique | Known (v0.4.5) | Signature + one kit move can repeat within the object's group; numbers come from shared archetypes (balance). | Hand-written legendary moves only if requested. |
| Some borrowed designs are approximate (drone → helicopter, microscope basic) | Known | `docs/identity-designs-*.png` | Improve when found in QA. |
| Hardware camera zoom untested on a real phone | Open | `src/platform.js` zoom; digital zoom fallback tested in browser. | Phone test. |
| Real GPU (WebGL) detector vs CPU differences on phones | Unmeasured | Measured only on a software GPU (≤ 0.0001). `docs/RECOGNITION.md`. | Optional lab work. |
| Rolling back below v0.4.3 shows redesigned new monsters as blobs | Known, documented | `docs/RELEASING.md` | None unless rolling back. |

## 6. Resolved issues (with the release that fixed them)

- **"Starting camera…" stayed on screen** – CSS `display:grid` overrode `hidden`; now removed once frames show. v0.4.2.
- **"Recognition engine could not run" after the app was in the background** – lost GPU context/stopped worker left
  the engine "ready"; now self-check on resume, automatic reload from cache, Retry reinitialises. v0.4.2.
- **Settings jumped to the top on every change** – the sheet was rebuilt; now updated in place. v0.4.2.
- **No way to reject a confident wrong identification** – Wrong object before any roll. v0.4.2; countdown removed v0.4.3.
- **Legendary monsters had the same flavour text as Commons** – rarity- and object-specific lore. v0.4.2.
- **Light switch / security camera drawn as toolboxes ("Switchette", "Cameradrake")** – vocabulary objects borrowed
  their category's single template and lore; new templates + design rules + lore groups. v0.4.3.
- **SNAP usable while the engine was still waking** – SNAP and shutter now gated on engine readiness. v0.4.3.
- **Force CPU: blank (white/black) camera area after the shutter** – v0.4.4, mitigated (see below).
  - Cause: the shutter handler stopped the camera at once (blank `<video>`), built the Analysing screen and started
    recognition in the same task. With the detector on the CPU backend, TF.js computes synchronously on the main
    thread for about a second, so the browser could not paint the new screen; the blank camera area stayed visible.
  - Change: the camera frame is paused (not cleared), the Analysing screen with the photo is shown, the photo is
    decoded and two frames are painted, then the camera is released and recognition starts. The scan sweep now
    animates with `transform` (compositor), so it keeps moving during the CPU work; only the elapsed-time text waits.
  - Not a full fix: the main thread is still busy for that second on the CPU backend. Moving TF.js into a worker
    would fix it fully but is a larger change; rejected for now as disproportionate for a developer option.

- **Energy drink drawn as a burger ("Drinkling"), other drinks/foods/vegetables in their category's single shape** –
  vocabulary objects with no design rule used the category template (food → burger) and the category's lore/moves.
  New `FOOD_RULES` (drinks, meat, seafood, dairy, sauces, bowls, dumplings, bread, breakfast, pantry, vegetables, greens,
  nuts, sweets) with the `meal` template and new produce shapes; each kind has lore and a move kit. v0.4.5.
- **Spoon was Mechanical with Nail Gun/toolbox text; pen had door/lock text** – named objects in a broad category
  (tool, keys) used its family, signature name and lore. `NAMED_GROUPS` + `GROUP_FAM` give them a fitting group and
  family (kitchen/office → Household). v0.4.5.
- **Legendaries shared "the Last Machine" titles and the same moves** – titles were per family, moves drawn with a
  per-category seed from the family's 3 moves. Now title, legend move and Ultimate carry the object's name; legendary
  lines always name the object; test checks all ~2,300 objects. Every rarity draws moves from its own object's kit. v0.4.5.

## 7. Testing and verification

- **Automated (CI on every deploy, `pages.yml`):** logic (`sim`, `rules-trace`, `generator-snapshot`, `curated`, `guide`, `lore`, `identity`, `devtest`,
  `migrate`, `labels`, `clip-fusion`, `color`, sprite regressions) and browser tests in headless Chromium with a fake
  camera (`e2e`, `e2e-engine` with the real TinyCLIP worker and a tiny test model, `e2e-nav`, `e2e-qol`, `e2e-v044`).
- **Real-model lab (`lab.yml`):** runs the real models on ~150 labelled Wikimedia photos when engine/lab files change
  (GPU vs CPU equivalence). Results in `docs/RECOGNITION.md`.
- **Manual:** only the developer's Android phone. Anything not tested there is marked "needs phone check" in reports.
  Headless tests cannot reproduce Android graphics glitches or real camera hardware (zoom, permissions UI).

## 8. Consequential technical decisions

- **TinyCLIP on WASM for everyone (v0.4.1)** – WebGPU changed outcomes on ~4.5% of photos; consistency chosen over
  speed. Phone timing ~1.15 s per analysed region, judged acceptable by the developer. `docs/RECOGNITION.md`.
- **No timer on identifications (v0.4.3)** – the developer prefers explicit confirmation.
- **Existing monsters keep their saved look (v0.4.3)** – redesigns apply to new monsters; an opt-in, undoable
  "Update its look" exists. Chosen over silent migration.
- **Rule numbers centralised in `MECH` (v0.4.2)** so the Guide shows real values; a fixed-seed trace proves balance
  is unchanged.
- **Developer tools behind `DEV_TOOLS` + 7 taps on the version line** – `DEV_TOOLS` must be set to `false` for a
  public/release build; this removes the developer menu, Force CPU, field tests and Quick Monster Test Mode.
- **Quick Monster Test Mode stores test monsters outside the save** (`snapmon.testroster.v1`), never in the backup
  code; test battles restore the save afterwards. Chosen over marking monsters in the real collection.
- **Detector stays on TF.js in the main thread** (v0.4.4) – a worker would remove the Force CPU freeze entirely but
  was judged too large for a cosmetic developer-mode issue.

- **Move kits instead of family move pools (v0.4.5)** – each category/object group has 4 moves whose numbers come
  from shared archetypes (`MOVE_ARCH`, same ranges as family moves); the extra moves are picked per object. The battle
  trace was re-recorded on purpose; replaying it with the old move functions reproduced the old fixture exactly.
- **Unique Legendaries by construction (v0.4.5)** – generated from the object's own name rather than ~2,300
  hand-written entries; hand-written lines (`LORE_OBJECT`) are still used where they exist.
- **Recogniser vocabulary unchanged in v0.4.5** – identity fixes only change how a recognised object looks and fights.

- **Curated writing kept apart from the generators (Phase 1)** – reviewed text in `content/curated/*.json`, keyed by
  exact object id, validated by `tools/curated.js`; `src/curated.js` is not loaded by the game and `CURATED.enabled`
  is false. `monsterLore` has a guarded hook (no-op unless loaded and enabled; uses no random numbers). Only
  `reviewed` entries can ever apply; anything missing/malformed falls back to the generator. Chosen over editing
  `LORE_OBJECT` directly (mixes writing with code, no validation). Audit: ability names are identifiers in battle
  cooldowns (`e.cds[name]`) and in identity updates (signature name compared with the category's); monster names,
  moves and lore are stored on monsters and in backups; encyclopedia text (`speciesLore`) is computed live.

## 9. How to keep this journal

- Start of a session: read this file, then `git log --oneline -15` and `git tag` to see what changed since.
- After a meaningful feature, fix, release or decision: update sections 3–8 briefly (one line per item where
  possible). Move items from Open to Resolved with the fixing release. Do not paste chat transcripts.
- Never write secrets, tokens, passwords, personal data or photos here.
- Facts only: say "needs phone check" for anything not verified on the Android phone.
