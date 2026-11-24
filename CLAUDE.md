# SNAPMON – instructions for Claude Code sessions

1. **Start of every session:** read `docs/DEVELOPMENT_JOURNAL.md` (project overview, non-negotiable requirements,
   release history, open issues, current priorities), then check `git log --oneline -15` and `git tag`.
2. **After meaningful work** (feature, fix, release, important decision): update the journal briefly – release table,
   open/resolved issues, current state, decisions. Keep it concise; facts only; never secrets or personal data.
3. **Android is the ONLY supported playable platform** (decided 2026-11-24; iOS maybe far later). There are no Chrome
   game releases, no duty to keep the public browser game up to date and no Chrome feature parity. If the best
   implementation of a feature needs an Android capability that cannot work in Chrome, build the Android version; do
   not add a browser fallback or weaken it for the old browser game. Keep the shared JavaScript (`src/`): the APK's
   WebView and the developer catalogue run it — do not delete files because of their names.
   **Workflow:** work on the Android development branch (currently `ccr-6eaf78d0-vj87lh`) → push → the *Android debug
   APK* workflow (`.github/workflows/android-apk.yml`) runs the fast suite (`tools/android/run-tests.sh`), builds the
   signed APK (versionCode = 1000 + run number) and runs the emulator test → the owner installs it as an update.
   Merging into the Pages branch `claude/snapmon-game-dev-7o667u` is NOT a step for producing an APK; it changes the
   live website and needs the owner's explicit approval, like retiring the browser game, Firebase/domain changes,
   publishing a release/tag or a milestone (`docs/RECOVERY.md`). Never force-push or rewrite history; never move tags.
4. **Do not break:** live-camera-only hunting (no gallery, no typed objects), the single standard Hybrid recogniser,
   TinyCLIP on single-thread WASM for everyone, manual confirmation (no countdown), save compatibility (additive
   changes; `tests/save-compat.js` loads today's save with older verified builds and back), game balance
   (`tests/rules-trace.js`), CAMERA as the only Android permission (no INTERNET), the package id
   `io.github.patrikarendas.snapmon.dev`, its stable signing (`ANDROID_DEV_SIGNING_SEED`, never change or expose it),
   a growing versionCode (every build must install as an UPDATE). Never reset, clear or uninstall on the owner's phone.
   **Tests:** keep the fast suite broad. Tests protect the Android game, not browser parity; when an Android-only
   feature invalidates a browser-level test, replace it at the right layer (unit / mocked bridge
   `tests/e2e-android-web.js` / emulator `tools/android/emulator-smoke.js`) — never silently delete or weaken it
   (`tests/android-packaging.js` fails if a test file stops running). Real-phone checks stay manual (camera, speed,
   heat, device quirks); never call a CI-green build phone-verified.
8. **Recovery and archives** (`docs/RECOVERY.md`, `tools/android/recovery-points.json`): rollback = a NEW build with
   old code and a higher versionCode installed as an update, after a fresh backup code — never uninstall first. Add a
   build to `recovery-points.json` only after the owner verified it on the phone. Milestone pre-releases are public
   and need the owner's approval of that exact build; they archive the original CI APK, never a rebuild.
5. Detailed specs: `README.md`, `docs/ANDROID.md`, `docs/RECOVERY.md`, `docs/RECOGNITION.md`, `docs/CATALOGUE.md`,
   `docs/RELEASING.md` (website/Pages releases: legacy, only with approval).
6. **Curated monster writing** (names, flavour text, move names) is **live for all 2,308 objects since v0.5.0**. Source:
   human-readable JSON in `content/curated/` keyed by object id → rarity / move slot; the game reads only the generated
   `src/curated-data.js`. Corrections are single fields, each approved by the developer, via "Correcting live writing"
   in `docs/CONTENT_WRITING_GUIDE.md` (`patch … --approved-edit` → validate → build → `rebaseline` → tests → release).
   Never regenerate, bulk-rewrite or "improve" approved text on your own; never set `"reviewed"` yourself on new
   drafts; never add drafts to `src/curated-data.js`. Style: `docs/SNAPMON_WRITING_BIBLE.md`. Counts:
   `node tools/campaign.js status`; coverage: `docs/review/COVERAGE.md`. Saved monsters refresh their text once per
   content revision (`tests/curated-refresh.js`).
7. **Developer catalogue** (`catalogue/`, `docs/CATALOGUE.md`): an ACTIVE tool that must stay online at
   `/snapmon/catalogue/` even after the browser game is retired (staged catalogue-only site: `tools/catalogue/`,
   `docs/staged/pages-catalogue-only.yml`; it loads `src/` game data code, so keep that browser-loadable). Review-only, owner-only Firebase sync at
   `catalogue/{uid}/reviews/{objectId}`. Never let it write game saves, curated data or sprites; never weaken the
   Firestore rules or add credentials/admin SDK. Owner feedback (exported JSON) is applied only after explicit approval
   via "Correcting live writing".
