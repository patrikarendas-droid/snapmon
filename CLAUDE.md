# SNAPMON – instructions for Claude Code sessions

1. **Start of every session:** read `docs/DEVELOPMENT_JOURNAL.md` (project overview, non-negotiable requirements,
   release history, open issues, current priorities), then check `git log --oneline -15` and `git tag`.
2. **After meaningful work** (feature, fix, release, important decision): update the journal briefly – release table,
   open/resolved issues, current state, decisions. Keep it concise; facts only; never secrets or personal data.
3. **Workflow:** feature branch → tests (`docs/RELEASING.md`) → merge into `claude/snapmon-game-dev-7o667u` → the
   Pages workflow tests and deploys → tag via `tag-release.yml`. Never force-push or rewrite history.
4. **Do not break:** live-camera-only hunting (no gallery, no typed objects), the single standard Hybrid recogniser,
   TinyCLIP on single-thread WASM for everyone, manual confirmation (no countdown), save compatibility, game balance
   (`tests/rules-trace.js`). Android first.
5. Detailed specs: `README.md`, `docs/RECOGNITION.md`, `docs/RELEASING.md`, `docs/ANDROID.md`.
6. **Curated monster writing** (names, flavour text, move names) is **live for all 2,308 objects since v0.5.0**. Source:
   human-readable JSON in `content/curated/` keyed by object id → rarity / move slot; the game reads only the generated
   `src/curated-data.js`. Corrections are single fields, each approved by the developer, via "Correcting live writing"
   in `docs/CONTENT_WRITING_GUIDE.md` (`patch … --approved-edit` → validate → build → `rebaseline` → tests → release).
   Never regenerate, bulk-rewrite or "improve" approved text on your own; never set `"reviewed"` yourself on new
   drafts; never add drafts to `src/curated-data.js`. Style: `docs/SNAPMON_WRITING_BIBLE.md`. Counts:
   `node tools/campaign.js status`; coverage: `docs/review/COVERAGE.md`. Saved monsters refresh their text once per
   content revision (`tests/curated-refresh.js`).
7. **Developer catalogue** (`catalogue/`, `docs/CATALOGUE.md`): review-only, owner-only Firebase sync at
   `catalogue/{uid}/reviews/{objectId}`. Never let it write game saves, curated data or sprites; never weaken the
   Firestore rules or add credentials/admin SDK. Owner feedback (exported JSON) is applied only after explicit approval
   via "Correcting live writing".
