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
