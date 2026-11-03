# SNAPMON development journal

The durable hand-off between development sessions. A new Claude Code session does **not** remember earlier
conversations: this file, the other docs and the Git history are the memory. Read it first; update it after every
meaningful change (see "How to keep this journal" at the end). Detailed specifications live in the linked docs, not here.

Last updated: 2026-11-03, release v0.5.0 (full curated writing live for all 2,308 objects).

**A fresh session: read section 4 (current state + next priorities) first. Section 10 is history only.**

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
| v0.4.5 | a13f396 | 2026-10-30 | Food/drink identity; object families; per-object move kits; unique Legendaries. |
| v0.4.6 | fc5f65d | 2026-10-31 | Pilot 01 curated writing active (10 objects); stable ability keys (Stage A, f95f3c7). |
| v0.4.7 | 51f3c50 | 2026-10-31 | Developer God Mode for Quick Monster Test Mode battles. |
| v0.4.8 | 4fa85a6 | 2026-11-02 | Pilot 02 curated writing (50 objects, with monster names); automatic refresh of saved monsters; encyclopedia names. |
| v0.4.9 | 996d52b | 2026-11-02 | Recognition → identity → visual audit: sea urchin fixed, 40+ labels to their correct object, 5 new objects, honest bodies, whole-word design rules; mapping-audit tooling and CI test.
| v0.5.0 | 6ecd64f | 2026-11-03 | Full curated writing live: monster names, flavour text and move names for all 2,308 objects (60 previously approved + 2,248 campaign); Pilot 01 gains names; saved monsters refresh their text once. | |

## 4. Current state and next priorities

- **Live: v0.5.0** (merge 6ecd64f on production `claude/snapmon-game-dev-7o667u`, Pages run 24 green, tag v0.5.0).
  Save format 3 (unchanged since v0.3.0). Feature branch: `content/full-writing-rollout`.
- **Curated writing is live for all 2,308 objects** (names, flavour text, move display names; 5 rarities each):
  - previously approved: Pilot 01 (10 objects, v0.4.6; names added in v0.5.0) and Pilot 02 (50 objects, v0.4.8);
  - campaign: 22 batches w01–w22 (2,248 objects), developer-approved for release AS IS on 2026-11-03 (imperfect lines
    are corrected later, one at a time, through the catalogue — no more bulk rewrite campaigns).
  - Counts (from the source fields; `node tools/campaign.js status` → `content/campaign/STATUS.md`): 11,540 names,
    11,540 lore lines, 10,271 move display overrides (220 previously approved + 10,051 campaign). Slots without an
    override keep their generated move name. Only fix made at release: 139 duplicate Legendary legend/Ultimate move
    names made unique (object-name prefix; list in `content/campaign/patches/v050-unique-legendary-moves/renames.tsv`).
  - Data: `src/curated-data.js` ≈ 1.8 MB (≈ 0.6 MB gzipped), bundled, offline; parse ≈ 50 ms desktop, ≈ 140–240 ms with
    4–6× CPU throttling. No lazy loading (not needed by measurement).
  - Saved monsters take the latest reviewed text once per content revision (names, lore, move names only; nicknames,
    stats, levels, variants, colours, DNA kept); the untouched pre-curated save stays in
    `snapmon.save.v1.backup.precurated` (written once, never overwritten).
- **Editing one field later (the simple update path):** the editable truth is human-readable JSON in
  `content/curated/` keyed by object id → `names`/`lore` per rarity, `moves` per stable slot (`signature`, `legend`,
  `ultimate`, `kit.<slot>`). Edit the field (by hand, or `node tools/campaign.js patch <batch> <fixes.json>
  --approved-edit`) → `node tools/curated.js validate` → `node tools/curated.js build --enable --out
  src/curated-data.js` (new `CURATED.revision`) → `node tools/campaign.js rebaseline "<reason>"` → tests → release →
  existing monsters refresh once. Live entries are guarded: `ingest` never regenerates them and `patch` refuses them
  without `--approved-edit`; `node tools/campaign.js immutable` (CI-friendly) flags any unrecorded change. Details:
  `docs/CONTENT_WRITING_GUIDE.md` ("Correcting live writing").
- **Not done / untested:** no real Android phone playtest of v0.5.0 (browser checks at 412 px only); no APK.

**Next priorities (agreed 2026-11-03):**
1. Phone playtest of v0.5.0 when convenient (postponed; not blocking).
2. Separate, mobile-friendly **developer catalogue** of all 2,308 objects: actual rendered sprites (rarities and
   variants), monster names, flavour text, move names and mechanics, persistent review notes and exportable per-field
   corrections that map 1:1 to the source records above. **Out of scope until explicitly started.**
3. Later: name/flavour UI refinements (postponed redesign), targeted sprite and writing fixes from catalogue feedback.

## 5. Open issues / known limitations

| Issue | Status | Notes / files | Next action |
|---|---|---|---|
| Brief freeze after the camera shutter with **Force CPU backend** (developer option) | Mitigated in v0.4.4, needs phone check | The CPU detector (TF.js CPU backend) runs on the main thread for ~1 s; see section 6. `src/ui.js` `paintFirst`, `recognizeFlow`. | Phone test: the Analysing screen should now appear immediately with the photo, sweep still moving; only the clock text pauses. A full fix needs the detector in a worker (not planned). |
| Same freeze for real players whose phone cannot use WebGL | Same mitigation | Rare: only phones where WebGL fails fall back to the CPU detector. | As above. |
| ~730 objects use their category's general shape | Known | Plants, animals, clothes, cakes/pies, cups, household bottles… where the shape fits. Every food, fruit and vegetable has a design since v0.4.5. | Add designs/rules for the worst cases found in QA (`FOOD_RULES`/`DESIGN_RULES` in `src/objects.js`). |
| Curated writing: some lines imperfect | v0.5.0: all 2,308 objects live, released as is by decision | Corrections one field at a time (section 4, editing path), found via the planned catalogue. Previously: "only 60 objects curated" (v0.4.6/v0.4.8). | `content/curated/`, `src/curated-data.js` (generated). Same-name shared cooldown (`cdWith`, 4 configs) kept for compatibility. | Catalogue review; phone checking before full coverage. |
| "Sausage" is recognised as the hot-dog object | Known (v0.4.5) | The recogniser vocabulary maps the label to `hotdog`; since v0.4.5 that object has meat lore/moves. A separate sausage needs a vocabulary change (engine change + lab run). | Only if requested. |
| Approximate bodies kept (seals, stingray, mobile toy, mouthguard) and ImageNet name collisions (kite, crane) | Audited, kept with reasons (v0.4.9 branch) | `docs/review/MAPPING_AUDIT.md`, `docs/review/audit-sheets/04-review-queue.png` | Design work / new identities later; ImageNet "kite"/"crane" collide by name. |
| Starfish caught from "sea urchin" photos before the audit | Known | Stored `m.label` = "sea urchin" would allow a migration | Proposed separately; not automatic (could alter genuine starfish if labels were noisy). |
| Existing monsters keep their old family/moves (e.g. a Mechanical spoon) | By design | Saved monsters never change family, moves' numbers or stats without consent (since the Pilot 02 integration their curated TEXT — name, lore, move names — is refreshed automatically, see section 4); "Update its look" offers the new body/text for redesigned objects (energy drink), not family or stats. Test-collection monsters are never updated. | None. |
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

- **Automated (CI on every deploy, `pages.yml`):** logic (`sim`, `rules-trace`, `gameplay-baseline`, `ability-keys`, `generator-snapshot`, `curated`, `curated-pipeline`, `curated-refresh`, `god-mode`, `guide`, `lore`, `identity`, `devtest`,
  `migrate`, `labels`, `clip-fusion`, `color`, sprite regressions) and browser tests in headless Chromium with a fake
  camera (`e2e`, `e2e-engine` with the real TinyCLIP worker and a tiny test model, `e2e-nav`, `e2e-qol`, `e2e-v044`, `e2e-godmode`, `e2e-curated`).
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
  public/release build; this removes the developer menu, Force CPU, field tests, Quick Monster Test Mode and God Mode
  (the engine itself refuses God Mode without DEV_TOOLS). The hidden menu is not security in a public web build.
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

- **Curated writing kept apart from the generators (Phase 1; HISTORY — since v0.4.6 `src/curated.js` is loaded and
  enabled, since v0.5.0 every object is curated)** – reviewed text in `content/curated/*.json`, keyed by
  exact object id, validated by `tools/curated.js`; at the time `src/curated.js` was not loaded by the game and `CURATED.enabled`
  was false. `monsterLore` has a guarded hook (no-op unless loaded and enabled; uses no random numbers). Only
  `reviewed` entries can ever apply; anything missing/malformed falls back to the generator. Chosen over editing
  `LORE_OBJECT` directly (mixes writing with code, no validation). Audit: ability names are identifiers in battle
  cooldowns (`e.cds[name]`) and in identity updates (signature name compared with the category's); monster names,
  moves and lore are stored on monsters and in backups; encyclopedia text (`speciesLore`) is computed live.
- **Curated writing at scale (2026-11-02):** batches of ~50 by theme with variety, fixed manifests, writer pass →
  separate editor pass → lint → developer approval; AI never sets "reviewed" (Pilot 02's status change was explicitly authorized by the developer). Monster names
  are live since the Pilot 02 integration (reviewed entries only, own switch `namesEnabled`). Data size: ~1.1 KB per approved object → ~2.5 MB for all objects;
  consider per-object lazy loading past a few hundred (not built).
- **Two regression baselines (2026-10-31):** `gameplay-baseline` (no text at all) must never change for wording work;
  `generator-snapshot` (text + names + save) changes only on purpose (curated activation re-records it, the gameplay
  baseline must still pass). Cooldowns by stable key, not display name; `cdWith` kept for exact compatibility rather
  than silently fixing the shared-cooldown quirk (a possible later balance decision).
- **Curated refresh of saved monsters (Pilot 02 integration):** automatic, per content revision, text fields only,
  chosen over a save reset (no data loss, deterministic, reversible via the one-time backup and plain-string rollback).
  One backup key rather than one per revision so future batches never fill localStorage.

## 9. How to keep this journal

- Start of a session: read this file, then `git log --oneline -15` and `git tag` to see what changed since.
- After a meaningful feature, fix, release or decision: update sections 3–8 briefly (one line per item where
  possible). Move items from Open to Resolved with the fixing release. Do not paste chat transcripts.
- Never write secrets, tokens, passwords, personal data or photos here.
- Facts only: say "needs phone check" for anything not verified on the Android phone.

## 10. History: earlier stages (superseded; kept for reference only)

The notes below describe states that are NO LONGER current (e.g. "v0.4.5 deployed", writing "inactive" or "draft").
The current state is section 4.

- **State (at v0.4.5):** v0.4.5 deployed. All automated suites pass (see section 7). Phone playtest of v0.4.4 (with Quick Monster
  Test Mode): monsters now resemble their objects, except drinks/foods drawn as burgers, a Mechanical spoon, and
  Legendaries sharing titles and moves; v0.4.5 addresses these (needs phone check).
- **Lore overhaul Phase 1 (curated-writing foundation):** reviewed and approved by the developer, merged into
  production (no version bump; inert). Curated system stays disabled (`CURATED.enabled = false`, `curated.js` not
  loaded by the game or builds); `content/curated/` is empty. Live output frozen by `tests/generator-snapshot.js`.
  **Do not start the next phase without explicit approval.**
- **Curated Pilot 01 imported (2026-10-31), INACTIVE:** `content/curated/pilot-01-approved.json`, byte-identical to the
  developer's FINAL APPROVED file (sha256 2ab5752f…), on branch `content/pilot-01` (merged into `feature/ability-ids`). 10 objects (apple, x_light_switch,
  x_security_camera, x_energy_drink, forklift, microwave, rubber_duck, sock, padlock, book) × 5 rarities = 50 lore texts,
  40 proposed move names, all `reviewed` (= editorially approved, NOT activation). Validator: 0 errors, 0 warnings.
  Preview: `docs/review/pilot-01-preview.txt`. Generator snapshot still matches the pre-activation baseline; game,
  builds and saves unchanged; `CURATED.enabled`/`movesEnabled` false. Editorial notes (not acted on): some proposed
  legendary move names do not match the generated mechanics (legend move type / Ultimate effect come from the
  generator, and the Ultimate effect varies with Spectral/Mutated variants); light switch's signature override equals
  its current name. Activation needs separate approval.
  2026-10-31 developer-approved name fixes applied (lore untouched): padlock legend → Rusty Lockjaw, signature →
  Clack Clack Clack; light switch legend → Maximum Power, redundant signature override removed; microwave ultimate →
  Defrost Disaster; book signature → Papercut Barrage. Now 39 move names. Final developer decisions (2026-10-31):
  light switch ultimate → The Big Switch; rubber duck legend → Flaming Quack; energy drink legend → Caffeine Crash;
  book legend → Rewrite the Ending; "Wake-Up Call" kept.
- **Curated-writing pipeline + Pilot 02 drafts (2026-11-02), branch `feature/curated-pipeline-pilot02`, NOT merged,
  no release:** developer approved Pilot 01 on the phone and asked for names + lore + move names for all objects via
  an auditable pipeline. Built: `tools/inventory.js` (2,301 objects, coverage per layer → `docs/review/COVERAGE.md`),
  `docs/SNAPMON_WRITING_BIBLE.md` (editorial standard from approved Pilot 01), draft-only `names` field (schema 1,
  validated, never used by the game or copied by `build`), `needs-revision` status, batch workflow
  (`manifest`/`pack`/`progress`/`lint`/`review` in `tools/curated.js`). Pilot 02: fixed 50-id manifest, writer pass
  (250 names, 250 texts, 180 move names, all `draft`), independent editor pass in a separate context (80 issues:
  14 high, 44 medium, 22 low → `content/review/pilot-02-issues.json`), writer pass 2 addressing all highs and clear
  mediums (`pilot-02-writer-response.json`). Review: `docs/review/pilot-02-review.md`. Live game, Pilot 01 and
  `src/curated-data.js` byte-identical; builds not rebuilt (validator code in `src/curated.js` changed, runtime
  unchanged: rebuild dist when merging). Next: developer reviews Pilot 02 and decides per entry.
- **Pilot 02 editorial pass 3 (2026-11-02):** developer approved the pipeline but not yet the content; asked for a
  third pass on the remaining issues with 10 decisions (Bible strictly; legendary feats, not passive states; varied
  name structures; no cross-object joke repeats; specific fixes; keep i_hip; preserve good writing; fresh editor).
  Writer pass 3 (122 logged changes, `content/review/pilot-02-writer-pass3.json`) → fresh independent editor
  (`pilot-02-issues-pass3.json`: 7 high, 32 medium, 25 low) → pass 3b fixing all highs and substantial mediums
  (57 changes, `pilot-02-writer-response-pass3.json`). Open: 1 medium (office chair legendary kept as the developer's
  reference) + 14 low taste notes, all listed in `docs/review/pilot-02-final-report.md` (new `report` command).
  Still all draft; nothing merged or live.
- **Pilot 02 final editorial instructions (2026-11-02):** Bible updated (Uncommon = recognizable behaviour, unusual
  talent or small trick, magic optional; legendary achievements need not be physical; recognizability over technical
  accuracy, e.g. spiky sea urchins). Exactly five texts revised (`content/review/pilot-02-final-five.json`): sea
  urchin shell legendary, candle legendary punchline, tea bag epic, garden gnome legendary, egg uncommon. Dog uncommon
  and office chair legendary kept by decision. All 50 still draft, awaiting the developer's final approval.
- **Pilot 02 FINAL EDITORIAL APPROVAL (2026-11-02, developer):** all 50 objects approved, including the five final
  revisions: monster names, flavour texts and proposed move names accepted (`content/curated/pilot-02-draft.json` at
  commit 49ddad4). `docs/SNAPMON_WRITING_BIBLE.md` approved as the standard for future batches. No further editorial
  passes. Working state preserved on purpose: entries keep `"status": "draft"` in the file until the integration
  step (the status change is part of that approved implementation), nothing merged, deployed or rebuilt, monster
  names not activated. **Next phase (separate task, needs approval): plan safe integration of curated monster names
  and approved Pilot 02 content, incl. existing saves and the encyclopedia.**
- **Full curated-writing campaign (started 2026-11-02, developer-authorized, DRAFT only)**, branch
  `content/full-writing-rollout` (from production 550121b, v0.4.9). Baseline: 2,308 objects = 50 approved (Pilot 02)
  + 10 approved lore/moves needing names (Pilot 01) + 2,248 new; targets 11,290 new names and 11,240 new lore lines.
  Frozen manifest `content/campaign/manifest.json`, 22 thematic batches `content/batches/w01…w22`, tool
  `tools/campaign.js` (brief/ingest/status/immutable), tracker + handoff `content/campaign/TRACKER.md`, live counts
  `content/campaign/STATUS.md`. Pilot 01 names proposal kept outside `content/curated/`. Independent editor agent per
  batch → `content/review/<batch>-issues.json`. Nothing reviewed/merged/deployed; v0.4.9 Android playtest still pending.
  Progress (2026-11-03): **all 22 batches written** — 2,248/2,248 new objects, 11,290/11,290 names, 11,240/11,240
  lore lines, 9,934 move display overrides, all DRAFT; Pilot 01 names proposed 10/10; `campaign.js status` reconciles
  every registry ID; approved files byte-identical to baseline. Independent editor passes applied to all 22 batches
  (2,712 high / 6,042 medium issues; 8,943 fields patched); lint clean (only the accepted usb_key callback);
  curated/pipeline/refresh/rules-trace tests pass. Approval package + activation proposal (not performed):
  `content/campaign/APPROVAL_PACKAGE.md`; review sheets `docs/review/wNN-*-review.md`. Sensitive objects written
  neutrally and listed in TRACKER.md (bible, cigarettes, vape, matches, ballot box, i_slot as pier arcade machine,
  church pew/bell without religious content, all drinkware alcohol-free, medicines/cleaners/fuel as grown-up only,
  x_nutella written without the brand).
- **Recognition → identity → visual audit (2026-11-02), branch `feature/recognition-identity-audit`, NOT merged or
  deployed (awaits approval).** Trigger: phone test of v0.4.8, a photographed sea urchin spawned the Starfish. Root
  cause: Starfish carried the alias "sea urchin" (first registration wins in `ALIAS_INDEX`), so `objectForLabel`, the
  generated ImageNet table and the TinyCLIP vocabulary all routed it there; `x_sea_urchin_shell` (approved Pilot 02
  writing) was only reachable as "sea urchin shell" and was drawn as a fish (no design). Fix: alias moved
  (`EXTRA_ALIASES`), new round spiky body (`produce` shape `spiky`). New reusable tooling: `tools/audit-mapping.js`
  (inventory of every route: 1000 ImageNet, 80 COCO, 2941 TinyCLIP labels, 3,230 aliases, 2,303 objects; triage
  lint + recorded decisions; `docs/review/MAPPING_AUDIT.md`, `content/audit/*.csv`), `tools/audit-sheet(s).js`
  (labelled contact sheets of real sprites, `docs/review/audit-sheets/`), `tests/mapping-audit.js` (CI). Fixed
  identities (26 regression cases): sea urchin; drum (was Drink can); dice (Jigsaw puzzle); shopping cart
  (Wheelbarrow → curated Shopping trolley); ImageNet flowerpot (Cooking pot), Cardigan corgi (T-shirt → new
  `i_cardigan`), carpenter's plane (Airplane → new `i_plane`), stick insect (Walking stick cane) via `CLASS_OVERRIDES` in
  `tools/gen-labels.js`; sibling species with their own existing object: koala, gorilla, orangutan, guinea pig, llama,
  alpaca, wolf/timber wolf, moth, scorpion, slug, centipede, toad. Honest bodies for 57 objects (`VIS_FIXES`, visual
  only: never lore group/family/moves), e.g. tuning fork (was a guitar), fidget spinner (was a teddy; new `spinner`
  shape), electric switch (phone), sea turtle/krill/nautilus/anemone (fish), hats (T-shirt), snakes (lizard).
  `objectForLabel` resolves whole ImageNet class strings like the generated table. TinyCLIP: label strings and order
  unchanged (`gen-vocab` keeps the previous order), so the CI re-export produces the same text embeddings; only 17
  label → object assignments change. No object id removed (frozen list `tests/fixtures/registry-ids-v0.4.8.json`).
  Baselines: rules, mechanics (new frozen hash), encounters, battles and the text of every v0.4.8 object unchanged;
  artwork/recognition hashes re-recorded on purpose. Saved monsters render identically (design stored in DNA); old
  urchins can opt in via "Update its look"; Starfish caught from "sea urchin" photos are NOT relabelled (possible via
  `m.label`, proposed separately). Kept for review: 88 medium flags (74 approximate category bodies, homonyms such as
  kite/crane/bat/monitor, piggy bank → Pig, whale → Shark, wombat → Bear). Next: phone check, approval, release.
- **Audit round 2 — deferred-flag cleanup (2026-11-02, developer-approved approach), released as v0.4.9 (merge 996d52b, Pages run 41467754965, tag v0.4.9).** Of the 88 deferred flags 73 fixed, 15 kept with reasons (`MAPPING_AUDIT.md` lists every one).
  New objects with exactly their old label strings (TinyCLIP labels/order unchanged): Piggy bank (pig body), Whale and
  Dolphin (shark body), Wombat (bear body), Binoculars (glasses body); "killer whale" → Orca, "tongs"/"trowel"/"gerbil"
  → their own objects. ~70 more honest bodies from existing templates (boomerang curve, castanets pair, coral tree,
  street sign/flag poles, toy dinosaur lizard, shells, rings, strips, hats, ladders, hives …). Found and fixed a new
  bug class: design rules matched inside words (weasel → easel, motherboard/chess board/headboard → oar, windbreaker →
  breaker, honeycomb → comb, champagne flute → lute …): rules now match whole words (`wholeWordMatch`, 5 legitimate
  exceptions). Those 15 objects get their correct lore group, so their generated moves/text change (the only mechanics
  change; rule tables and move numbers unchanged; baselines re-recorded with that list). Kept: kite/crane (ImageNet
  name collisions), mouse/washer/pot/hot pot homonyms, seals/sea lion/walrus/manatee/dugong (four-legged mammal body),
  stingray (fish body), mobile toy, mouthguard. Curated writing, models, calibration and saves unchanged. GAME_VERSION
  0.4.9. CI: all tests incl. mapping-audit; TinyCLIP re-export identical (2941 labels, int8 38.8 MB, cos 0.9981, calibrated). Next: Android playtest; then the full curated-writing rollout (all 2,308 objects), then
  the postponed name/flavour-text UI.
- **v0.4.8 — Pilot 02 INTEGRATION (2026-11-02, developer-approved, merged and deployed as v0.4.8):** the 50 entries are `reviewed` (file renamed `content/curated/pilot-02-approved.json`;
  only the status line changed). Curated **monster names** are live (`CURATED.namesEnabled`, `curatedMonsterName`):
  Pilot 02 objects use their 5 approved names (a Legendary's curated name replaces the generated "Name, title");
  Pilot 01 keeps generated names (no reviewed names yet); the other 2,241 objects are fully procedural. Lore and move
  names as before (by stable ability key). **Existing monsters:** `curatedRefresh` (src/curated.js) runs on load and
  on backup restore once per content revision (`CURATED.revision`, a 12-char hash written by the build; the save
  stores `curatedRev`): it rewrites only `name`, `lore` and ability `name` of monsters whose object has reviewed
  content; nicknames, level, stats, rarity, variant, DNA/colours, keys, numbers, equipment and progression untouched;
  no random numbers; idempotent. Before the first refresh the untouched save is copied once to
  `snapmon.save.v1.backup.precurated` (one key only, never overwritten). Encyclopedia sheet shows the curated name for
  the top rarity seen (`curatedDexName`), otherwise the first-seen name; dex records are not rewritten. Test collection
  shows the latest writing too. Rollback: older builds read the refreshed names/text as plain strings and ignore
  `curatedRev`. Battle HP card fixed for long names (grid column `minmax(0,1fr)`: ellipsis instead of the HP bar
  overflowing; found by the new browser test). Mechanics unchanged: gameplay baseline, rules trace (fixture unchanged;
  curated-on run compared without names and message wording) pass; generator snapshot live hash re-recorded on purpose
  (`withoutCurated` still matches). New tests: `tests/curated-refresh.js`, `tests/e2e-curated.js` (CI + RELEASING).
  Size projection for all 2,301 objects: ~1.9 MB raw / ~0.7 MB gzip, ~35 ms cold parse on desktop Node (expect several
  × on mid-range phones), refresh of 300 monsters ~3 ms → consider lazy loading before full coverage. Needs a phone
  check (developer Android playtest next). Then the remaining 2,241 objects as their own assignment (not started).
- **v0.4.7 developer God Mode (2026-10-31):** Settings → Developer & testing → "God Mode (test battles)", default off,
  remembered like the other developer switches; active only with Quick Monster Test Mode on AND Instant capture off
  (the Settings line says why it is inactive; it never changes the other switches). Engine: `enableGodMode(B)` sets a
  flag on one battle object only for a test monster (`m.test`) with DEV_TOOLS; `godOn(B)` re-checks both at every use,
  so a normal battle (or DEV_TOOLS=false) ignores even a forced flag. Effects: hunter floored at 1 HP and restored at the
  start of each of its turns (hits, damage numbers, statuses still shown), specials cost no energy, traps/items not
  required or used up, capture attempt always succeeds (→ test collection only). Monster stats, moves, AI, statuses,
  cooldowns untouched. Real save restored after test battles as before. Tests: `tests/god-mode.js`,
  `tests/e2e-godmode.js`; gameplay baseline, rules trace and text snapshot unchanged. Needs phone check.
- **v0.4.6 Pilot 01 ACTIVE (2026-10-31):** Stage A (stable ability keys + Pilot 01 content, curated off) merged as
  `f95f3c7` and deployed (CI green). Stage B (separate commit/merge): `src/curated-data.js` generated with
  `--enable`, loaded by index.html after game.js; createMonster applies curated move names by ability key; curated lore
  via the existing hook; encyclopedia shows curated text. Only the 10 Pilot 01 objects change (tests/curated.js checks
  all 34,515 configurations); gameplay baseline unchanged; rules trace unchanged (fixture checked with curated off, plus
  curated-on run identical without names); text snapshot re-recorded for the live output while keeping the original
  recording as `withoutCurated`. Existing monsters keep their stored text/names; no save reset. Needs phone check.
  Release verified: tag v0.4.6 → fc5f65d; Pages run 41196303977 (tests + site check incl. curated files + deploy)
  succeeded and is the latest deployment; curated-data.js at the tag has the 10 entries with both switches on; the
  real page and the single-file build were checked in a browser (v0.4.6, curated active, no errors). The live URL
  itself cannot be fetched from Claude sessions (github.io is outside their network allowance).
- **Claude Artifact copy not updated for v0.4.6** (still v0.4.5): the Artifact tool was unavailable in the release
  session. Next session with the tool: publish `dist/snapmon.html` (or `dist/artifact.html`) to the existing artifact.
- **Stable ability keys (2026-10-31), merged in Stage A:** approved by the developer as
  a separate technical step. `tests/gameplay-baseline.js` (no display text: rules, 46,020 monsters' stats/move
  numbers/DNA/sprites, recognition mapping, encounter odds, 1,052 battles) was recorded and committed BEFORE the change
  and is unchanged after it. Every ability now has `key` (signature / kit.<move> / fam.<move> / legend / ultimate /
  move.<name>); enemy cooldowns use the key; `cdWith` preserves the old shared cooldown for the 4 monsters with two
  same-named moves (epic bee "Sting", rare/epic pin cushion "Pin Prick"). Older saves gain keys on load (additive,
  no save reset, SAVE_VERSION unchanged; older versions ignore the field). Text snapshot unchanged apart from the
  new fields (excluded from its hash on purpose). Curated system still inactive.
- **Developer decisions on Pilot 01 (2026-10-31):** the 50 lore texts are accepted exactly as written; fix move NAMES
  that do not fit their mechanics (never mechanics to fit names); Ultimate names must suit every effect the game can
  give (burn, poison, stun, defence down; it varies by variant); remove the redundant light-switch signature override.
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
- **Next:** developer Android playtest of v0.4.8 (old save refreshed, nicknames kept, Legendary names in battle and
  encyclopedia); then curated writing for the remaining 2,241 objects as its own assignment (not started);
  phone check of v0.4.7 God Mode; update the Claude Artifact (still v0.4.5); phone check of v0.4.6 (Pilot 01 text and move names, encyclopedia, old monsters
  unchanged); next curated batch when written and approved; verify v0.4.5 on the phone with Quick Monster Test Mode (drinks, foods, vegetables,
  kitchenware, Legendaries); continue visual QA of designs; native APK when requested.
