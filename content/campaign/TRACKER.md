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
6. When a batch is complete: run an independent editor agent (prompt pattern in the w01/w02 commits' session; it writes
   `content/review/<batch>-issues.json`), then apply fixes to the chunk files, re-ingest, record the result below.

## Batches (22, frozen manifests in `content/batches/`)
| Batch | Objects | Written | Editor pass | Fixes applied | Notes |
|---|---|---|---|---|---|
| w01-mammals-1 | 107 | 107 | running/see review file | — | bears, camelids, weasels, cow, deer, dog breeds A–Sam |
| w02-mammals-2 | 106 | 106 | running/see review file | — | dog breeds Sch–Y, wild canids, primates, farm, cats, small & marine mammals |
| w03–w22 | 2,035 | 0 | — | — | not started |

## Decisions and known issues
- Batch partition: by inventory theme, sorted by visual source then name (related objects side by side).
- Pilot 01 names proposal written (10 × 5), validated, no collisions; awaits approval with the campaign.
- `wolf` now maps to `x_wolf_pup` (v0.4.9): its lore is written for a young wolf.
- Hippo inventory alias includes "rhinoceros" (mapping quirk); a separate `x_rhino` exists. Lore written for hippo.
  Recorded as a future mapping issue, not changed here.
