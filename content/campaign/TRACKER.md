# Curated-writing campaign — tracker and handoff

**Read this first when resuming** ("continue the SnapMon full writing rollout"). Live counts: `content/campaign/STATUS.md`
(regenerate with `node tools/campaign.js status`). Everything new is **draft**; nothing is merged, deployed or reviewed.

## Ground rules (from the developer's brief)
- Branch `content/full-writing-rollout` (from production after v0.4.9). Never work on production, never force-push.
- Approved files are immutable: `content/curated/pilot-01-approved.json`, `pilot-02-approved.json`
  (`node tools/campaign.js immutable` must say ok). Pilot 01 names are a separate proposal:
  `content/campaign/pilot-01-names-proposal.json` (applied only after approval).
- New entries stay `"status": "draft"`. No `src/` changes (no objects/mapping/mechanics/curated-data/dist).
- Follow `docs/SNAPMON_WRITING_BIBLE.md`. Five different premises per object, object-specific, Common→Legendary escalation,
  legendaries not cosmic by reflex; names unique across all content; move names truthful to mechanics.

## How to continue (exact loop)
1. `node tools/campaign.js next` → the batch and next unwritten object index.
2. `node tools/campaign.js brief <batch> <index> 27` → facts + used move slots (mechanics, rarities).
3. Write `content/campaign/chunks/<wNN>-<chunk>.txt` in the compact format (see `tools/campaign.js` header):
   `@id`, `N:` five names, `1:`–`5:` lore, `M:` move overrides (`signature`, `legend`, `ultimate`, optional `kit.*`).
   Policy so far: rename signature + legend + ultimate for every object (generated defaults are generic); keep kit
   moves when they already fit (animal kits do); Ultimates that vary by variant get effect-neutral names.
4. `node tools/campaign.js ingest <batch> <chunk file>` (validates, enforces globally unique names and real move keys,
   rejects unfinished lines), then `node tools/curated.js lint --batch <batch>` → fix every HIGH/MEDIUM.
5. `node tools/campaign.js status` and commit (`Campaign: <batch> chunk N (x/y, draft)`).
6. Fix passes: write `content/campaign/patches/<batch>-*.json` ({id: {"lore.rare": …}}) and run
   `node tools/campaign.js patch <batch> <file>`. If a chunk is ever re-ingested, re-apply that batch's patches after it.
7. When a batch is complete: run an independent editor agent (prompt pattern in the w01/w02 commits' session; it writes
   `content/review/<batch>-issues.json`), then apply fixes to the chunk files, re-ingest, record the result below.

## Batches (22, frozen manifests in `content/batches/`)
| Batch | Objects | Written | Editor pass | Fixes applied | Notes |
|---|---|---|---|---|---|
| w01-mammals-1 | 107 | 107 | done: 39 high / 102 medium / 64 low + 23 patterns | 143 fields (all high + all medium) via `patches/w01-editor-auto.json` | open: Sir/Lady legendary-name formula (~25), some award-shaped legendaries, low taste notes |
| w02-mammals-2 | 106 | 106 | done: 76 high / 118 medium / 83 low + 14 patterns | 193 lore/move fields (`patches/w02-editor-auto.json`, bad suggestions overridden) + 146 names re-paired to their lore (`w02-editor-names.json`) + religious settings removed | open: one-trait-across-rarities in ~30 objects only partly fixed; Ultimate = Epic name + word (51); award legendaries |
| w03-birds-and-sea-life | 120 | 120 | done: 120 high / 168 medium / 27 low + 12 patterns | 288 fields (`patches/w03-editor-auto.json`, incl. names re-paired to lore; 4 suggestions overridden for payment/brand frames) | open: crowd-scene Epics, homecoming Legendaries (pattern level) |
| w04-bugs-and-reptiles | 118 | 118 | done: 58 high / 125 medium / 33 low + 9 patterns | 221 fields (`patches/w04-editor-auto.json`, names re-paired) then `w04-self-fixes.json` (apply in that order) | open: Ultimate = Epic name in ~70 objects (pattern), crowd-scene Epics |
| w05-vehicles-1 | 79 | 79 | done: 28 high / 114 medium / 48 low + 12 patterns | 155 fields (`patches/w05-vehicles-1-editor-auto.json`, half-swaps auto-completed) then `w05-self-fixes.json` | open: templated "N years" Legendaries partly fixed |
| w06-vehicles-2 | 79 | 79 | done: 38 high / 129 medium / 31 low + 12 patterns | 184 fields (`patches/w06-vehicles-2-editor-auto.json`) then `w06-self-fixes.json` | open: "every Y in town" Epics (pattern) |
| w07-clothing-and-shoes | 118 | 118 | done: 268 high / 354 medium / 45 low + 14 patterns | 622 fields (`patches/w07-clothing-and-shoes-editor-auto.json`: Epics/Legendaries/Rares largely rewritten) then `w07-self-fixes.json` | open: Legendary name shape Lady/Sir X of the Y |
| w08-bags-jewellery-and-carry | 94 | 94 | done: 92 high / 221 medium / 41 low + 11 patterns | 313 fields (`patches/w08-bags-jewellery-and-carry-editor-auto.json`) then `w08-self-fixes.json` | |
| w09-gadgets-and-computers | 123 | 123 | done: 132 high / 261 medium / 27 low + 16 patterns | 393 fields (`patches/w09-gadgets-and-computers-editor-auto.json`) then `w09-self-fixes.json` | usb_key L deliberately calls back to C (lint medium accepted) |
| w10-screens-sound-and-light | 98 | 98 | done: 185 high / 312 medium / 41 low + 11 patterns | 497 fields (`patches/w10-screens-sound-and-light-editor-auto.json`) then `w10-self-fixes.json` | |
| w11-office-books-and-art | 112 | 112 | done: 86 high / 287 medium / 67 low + 11 patterns | 373 fields (`patches/w11-office-books-and-art-editor-auto.json`) then `w11-self-fixes.json` | sensitive objects written neutrally for developer review: x_bible (family book, no religious content), x_cigarette/x_cigarette_butt/x_vape (negative framing, litter/quitting), x_incense_stick, x_ballot_box (w08, class pet vote) |
| w12-house-odds-and-ends | 101 | 101 | editor running (with w13) | self-fixes | many fire objects (matches x4, candles, bonfire, fireworks) written with safety framing |
| w13-tools-and-sport | 98 | 98 | editor running (with w12) | self-fixes | i_slot = one-armed bandit (gambling, written as seaside arcade) |
| w14-garden-and-plants | 115 | 115 | pending | self-fixes | |
| w15-trees-fruit-and-veg | 117 | 117 | pending | self-fixes | |
| w16-toys-and-games | 85 | 85 | pending | self-fixes | |
| w17-furniture-and-bedding | 100 | 100 | pending | self-fixes | x_church_pew written as a hall bench (no religious content); wheelchair written as empowering/fast |
| w18–w22 | 478 | 0 | — | — | not started |

## Lessons from editor passes (apply while writing)
- One DIFFERENT trait per rarity (don't scale one habit over 4–5 rarities). Check neighbours: no shared premises between
  related objects (breeds, species) and none with approved Pilot 02 lines.
- Avoid stock frames: "in the land/country", contests/judges/medals/trophies, "was declared/crowned", "according to its
  own story", payment punchlines (charged in biscuits), shake-off soaking a crowd, "seen from space", palaces/emperors.
- Legendary = a concrete outrageous achievement with a real punchline. Vary legendary name shapes (not always Sir/Lady X).
- Apply order when re-ingesting a batch: chunks → `<batch>-editor-auto.json` → `<batch>-editor-names.json` (if any) → `<batch>-self-fixes.json`.
- Rare = a troublesome POWER (not the object simply doing its job well). Epic = a concrete CONSEQUENCE with a joke (not a crowd + comparison). Legendary = an outrageous FEAT with a punchline. Vary Legendary name shapes.
- Legendaries: avoid "has done X for N years / still has its original …" and "polished every Sunday"; Epics: avoid "every Y in town / a hundred others" crowd scenes without a joke.
- Names must sit on the rarity whose lore they describe (write names AFTER the lore, per line).
- Ultimate names: don't reuse the Epic monster name plus Rush/Charge/Storm; give the finisher its own image.
- Check `brief` mechanics BEFORE naming moves (legend/ultimate effects differ per object; varied Ultimates need effect-neutral names).
- Move names: no heat words on non-burn moves, no heal/rescue words on attacks, no cold words when a variant burns.

## Decisions and known issues
- Batch partition: by inventory theme, sorted by visual source then name (related objects side by side).
- Pilot 01 names proposal written (10 × 5), validated, no collisions; awaits approval with the campaign.
- `wolf` now maps to `x_wolf_pup` (v0.4.9): its lore is written for a young wolf.
- Hippo inventory alias includes "rhinoceros" (mapping quirk); a separate `x_rhino` exists. Lore written for hippo.
  Recorded as a future mapping issue, not changed here.
