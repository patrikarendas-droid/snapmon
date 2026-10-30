# Releasing and rolling back SNAPMON

## Branches

| Branch | Purpose |
|---|---|
| `claude/snapmon-game-dev-7o667u` | **Production.** Every push deploys to https://patrikarendas-droid.github.io/snapmon/ through `.github/workflows/pages.yml`. |
| `feature/<version>-<topic>` | Development. Pushing here never deploys. Example: `feature/v0.3.0-recognition`. |

Published history is never rewritten: no force-push, no rebase of pushed commits. Feature branches are brought into
production with a **merge commit**.

## Versions

Semantic versions, tagged on the production commit that shipped:

| Tag | What |
|---|---|
| `v0.1.0` | First playable game (commit `137e1ad`). *Not tagged yet: create it in the GitHub web UI → Releases → Draft a new release → tag `v0.1.0`, target `137e1ad`. The tagging workflow cannot create it because that commit predates the workflow.* |
| `v0.2.0` | On-device AI recognition (MobileNet + COCO-SSD). |
| `v0.3.0` | Object registry, specific monsters, live-camera only, experimental CLIP lens, save format 3. |
| `v0.3.1`–`v0.3.3` | Field-test follow-ups: second-opinion rules, fusion fixes, field-test tools. |
| `v0.4.0` | Hybrid is the single standard recogniser; photo-derived monster colours; Android Back navigation. Save format 3 (unchanged). |
| `v0.4.1` | TinyCLIP runs on the CPU (WASM, one thread) for every player, for identical decisions across devices; recognition timings in the developer panel. Same models, rules and saves. |
| `v0.4.3` | Monsters match their object: new designs (wall plates, security cameras, street furniture, boards, small parts…) and design rules for ~1,000 vocabulary objects that used to borrow a category look (a light switch drawn as a toolbox), object-group flavour text and move names; no countdown on identifications; SNAP only works when the Spirit Lens is ready. Same odds, combat numbers, models and save format. |
| `v0.4.2` | Playtest fixes: camera status text, camera zoom, Guide, rarity-specific flavour text, engine recovery after background, Settings no longer jumps, "Wrong object" before any encounter roll. Same models, thresholds, rules, odds and save format (monsters gain a stored `lore` text). |

`GAME_VERSION` and `SAVE_VERSION` live at the top of `src/game.js`. Settings shows both.

### Creating a tag

This environment cannot push tags directly, so tags are made by a workflow:
GitHub → **Actions** → *Tag a release* → **Run workflow** (branch: production), with `tag` = `v0.3.0`,
`sha` = the commit (leave empty for the branch head) and a short message. It refuses to move an existing tag.

## Release checklist

1. Work on a feature branch. Run the tests locally:
   ```
   node tests/sim.js && node tests/labels.js && node tests/sprites-v3.js && node tests/migrate.js && node tests/clip-fusion.js && node tests/color.js
   node tests/lore.js && node tests/guide.js && node tests/rules-trace.js && node tests/identity.js   # rules-trace: odds and battle maths unchanged
   node tests/sprite-regress.js check tests/fixtures/sprite-baseline-v1.json && node tests/sprite-regress-v3.js check tests/fixtures/sprite-baseline-v3.json
   python3 -m http.server 8765 &
   node tests/e2e.js http://localhost:8765/index.html tests/fixtures /tmp/shots
   node tests/e2e-engine.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist /tmp/shots
   node tests/e2e-nav.js http://localhost:8765/index.html /tmp/shots
   node tests/e2e-qol.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist /tmp/shots
   ```
2. Bump `GAME_VERSION` (and `SAVE_VERSION` + a migration in `migrate()` if the save format changes).
3. Merge into production with a merge commit and push. The Pages workflow runs **all tests first**; the site only
   deploys if they pass.
4. Check the Actions run is green and the site loads, then tag the release.

## Rolling back

Pick one; neither rewrites history.

**A. Revert the release merge (preferred).**
```
git checkout claude/snapmon-game-dev-7o667u
git pull
git revert -m 1 <merge-commit-sha>      # undoes the whole feature merge as a new commit
git push
```

**B. Restore the code of a tag as a new commit.**
```
git checkout claude/snapmon-game-dev-7o667u
git checkout v0.2.0 -- .                # bring the files back to the v0.2.0 state
git commit -m "Roll back to v0.2.0"
git push
```
Either way the Pages workflow redeploys automatically.

Rolling back from v0.4.0 to v0.3.x is save-compatible (same save format 3): monsters keep their stored colours, and
older code simply ignores the extra palette data. v0.3.x would bring back the old recogniser switch for developers.
Rolling back from v0.4.1 to v0.4.0 is fully save-compatible; it only returns TinyCLIP to WebGPU where available.
Rolling back from v0.4.3 to v0.4.2 is save-compatible (same format; nothing is lost), with one visual consequence:
monsters of a redesigned vocabulary object that were created or updated in v0.4.3 have `dna.shape: "obj"`, which v0.4.2
has no builder for, so they would appear as a plain blob there until v0.4.3 is back. Rolling back from v0.4.2 is save-compatible too: older code ignores the stored `lore` field and shows the old
per-category text again.

## ⚠️ A code rollback does not roll back save data

Progress lives in the player's browser (`localStorage`), not in git. After v0.3.0 has run once, a save is stored in
**format 3**. Older code cannot read it:

- v0.3.0 and later refuse to load a save from a *newer* format, show "Saved progress not loaded", **never overwrite
  it**, and offer it as a backup code in Settings. Rolling forward again restores it.
- v0.2.0 and older predate that guard. Before rolling back past v0.3.0, **export a backup code first** (Settings →
  Back up your progress). The v0.3.0 upgrade also keeps an untouched copy of the previous save under
  `snapmon.save.v1.backup.v2` in the same browser.
