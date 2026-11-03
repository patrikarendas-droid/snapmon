# Full curated-writing campaign — approval package

> **Executed in v0.5.0 (2026-11-03):** the developer approved the release AS IS; all 22 batches are live
> (`"status": "reviewed"`), Pilot 01 names were added, and the files were renamed to `content/curated/wNN-<theme>.json`.
> This file is kept as the record of what was approved. Current counts: `content/campaign/STATUS.md`.
> **Count correction:** the "10,010 move display names" below was a snapshot taken before the w20–w22 editor pass added
> 41 kit move names. The actual count, read from the source fields, is **10,051** for the 2,248 campaign objects; with
> the 60 previously approved objects (220) the live total is **10,271**. No move name was changed to reconcile counts.
> At release, 139 duplicate Legendary legend/Ultimate names were made unique (`patches/v050-unique-legendary-moves/`).

Branch `content/full-writing-rollout` (from production 550121b, v0.4.9). Content-only: no change to `src/`,
mappings, recognition, mechanics, save format or build. **Nothing is reviewed, merged, deployed or tagged.**

## What is done

| Item | Target | Done |
|---|---|---|
| Registry objects reconciled (`node tools/campaign.js status`) | 2,308 | 2,308, 0 missing, 0 double-owned |
| New objects written (22 batches, `content/curated/w01…w22-*-draft.json`) | 2,248 | 2,248 (all `"status": "draft"`) |
| New monster names | 11,290 | 11,290 (unique across all content) |
| New lore lines | 11,240 | 11,240 |
| Move display names (campaign objects only) | — | 10,010 at the time of writing; **10,051** actual (see note at top) |
| Pilot 01 names (`content/campaign/pilot-01-names-proposal.json`) | 10 × 5 | 10/10 |
| Approved Pilot 01/02 files | unchanged | byte-identical to baseline (`node tools/campaign.js immutable`) |

Quality gates:
- An independent editor pass ran on every batch: 2,712 high, 6,042 medium and 796 low issues. Every high and
  meaningful medium was applied, 8,943 fields in total. The issues are in `content/review/wNN-*-issues.json`; the
  applied patches are in `content/campaign/patches/`.
- `node tools/curated.js lint` reports 0 high and 0 medium on every batch.
- The global scan finds no duplicate names and no duplicate lore lines across 11,540 lines.
- The tests `tests/curated.js`, `tests/curated-pipeline.js`, `tests/curated-refresh.js` and `tests/rules-trace.js`
  pass, so game rules are unchanged.

Per-batch review sheets: `docs/review/wNN-*-review.md` (lint, editor issues, full text).

## Please check by hand (sensitive objects, written neutrally — see TRACKER.md)

- **Religion:**
  - x_bible is written as a family book.
  - x_church_pew is a hall bench.
  - x_church_bell is a village tower bell.
  - There is no religious content anywhere.
- **Smoking:** x_cigarette, x_cigarette_butt and x_vape are framed negatively (litter, quitting).
- **Fire:** x_matches, candles, bonfire and fireworks carry safety framing. The unsafe firework line was removed.
- **Gambling:** i_slot (the one-armed bandit) is a retired pier arcade machine.
- **Politics:** x_ballot_box is a class pet vote.
- **Alcohol:** every drink and drink container is alcohol-free.
  - x_wine is grape juice.
  - x_beer is ginger beer.
  - The hip flask holds cocoa.
  - The champagne, martini, shot, tankard and stein objects hold juice or milkshake.
- **Hazardous products:** medicines, vitamins, bleach, cleaners, fuel cans, gas and propane are high-shelf or
  grown-up only, with no ingestion jokes.
- **Health and hygiene:**
  - Wheelchair, crutch and cane are written as empowering.
  - The sanitary bin and sharps bin are neutral.
  - The toilet and bidet humour is mild.
- **Brands:** x_nutella is written as "chocolate hazelnut spread", without the brand.

## Known limits

- The writing is 100% draft from one writer plus independent editors. Approval is per batch or per object, by the
  developer only.
- Some house style repeats remain at a lower level, for example "the whole family/street". The editor passes cut the
  formula Legendaries and "The X That Y" names sharply, but a final read of the review sheets is still worthwhile.

## How to approve (developer only)

1. Read `docs/review/<batch>-review.md`, then edit text directly in `content/curated/<batch>-draft.json` as needed.
2. Set `"status": "reviewed"` on the entries you approve (per object or for a whole batch). Optionally move
   approved entries into an approved file.
3. Pilot 01: copy the approved names from `content/campaign/pilot-01-names-proposal.json` into the Pilot 01 entries.

## Activation proposal (NOT performed — needs separate approval)

1. **Data size.** Today `src/curated-data.js` is 51 KB for 60 objects. All 2,308 objects would be about 2 MB, which is
   too large to ship inline on Android.
   - Proposal: split the data into per-category chunks, or one lazily fetched JSON file loaded after start-up and
     cached by the service worker, keeping `CURATED.revision` as one fingerprint.
   - A small loader change in `src/curated.js` plus a `tools/curated.js build --split` option.
   - Fallback: the generated text, as today, until the data has loaded.
2. **Build.** Run `node tools/curated.js build --enable --out src/curated-data.js` (or the split equivalent). This
   includes only entries marked `reviewed`.
3. **Saves.** The existing once-per-revision refresh (`tests/curated-refresh.js`) moves saved monsters to the new
   names and lore. Stats, moves and mechanics are unchanged (rules-trace).
4. **Release.** Run the `docs/RELEASING.md` tests, an Android playtest of name, lore and encyclopedia display
   (long Legendary names wrap correctly), merge into `claude/snapmon-game-dev-7o667u`, let the Pages workflow deploy,
   then tag via `tag-release.yml`.
5. **Staged option.** Approve and activate a few batches first (for example w01–w05 animals). The pipeline already
   supports partial activation, because only reviewed entries are built.
