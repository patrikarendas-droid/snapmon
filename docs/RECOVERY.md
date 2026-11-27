# SnapMon Dev — rollback, recovery and long-term APK archiving

SnapMon is an **Android game**. This page is the practical guide for the day a new build breaks something. It treats
two separate things separately:

- **code recovery:** getting a working game back onto the phone;
- **player-data recovery:** keeping the progress (monsters, level, coins and so on) through all of it.

Short version: **back up first, then install a NEW build that contains the old code, as an ordinary update. Never
uninstall as a first step.**

---

## 1. Facts about saves on the phone

| What happens | Effect on the progress on the phone |
|---|---|
| Installing a newer SnapMon Dev over the installed one (same package, same signing key, higher versionCode) | **kept** (tested on the emulator in every CI run) |
| An Actions artifact expires or is deleted, a release or tag is deleted, a branch changes | **nothing**: the phone never reads GitHub |
| The game is closed, force-stopped, or the phone restarts | kept (saved immediately, plus a native file copy) |
| **Uninstall**, or Android Settings → Apps → SnapMon Dev → Storage → **Clear storage** | **all progress on the phone is deleted**. Only a backup code brings it back. |
| Installing an APK with a **lower** versionCode than the installed one | Android **refuses** (`INSTALL_FAILED_VERSION_DOWNGRADE`); the installed app and its save stay untouched (tested on the emulator) |
| Installing an APK signed with a different key | Android refuses ("App not installed" / conflicts with an existing package); nothing changes |

The app's saves are separate from the old Chrome website's saves. The app has no internet permission, so nothing is
uploaded anywhere; Android backup is switched off for the app, so a reinstall starts empty.

## 2. Your backup routine (2 minutes)

The backup code (Settings → **Back up your progress** → **Copy backup code**) is the complete save: every monster, the
encyclopedia, level/XP, coins, materials, items, weapons, charms, research, quests, achievements, companion, hunter
name, settings and the hidden object locks. It starts with `SNAPMON1:`.

1. **When:** before installing any new APK, and after important progress (a rare catch, a long session).
2. **Where:** keep **two independent private copies**, e.g. a note in your password manager *and* a private note or
   file on another device or account. Paste the whole code; it is long.
3. **Never** post it in a GitHub issue, comment, commit or chat with anyone: anyone with the code has your progress.
   It contains no password or account, only game data.
4. **Restore:** Settings → **Restore from a backup code** → paste → **Restore this backup**. This replaces the current
   save on that device.

A backup code made by a newer build can be restored by an older one as long as the save format is the same (format
3 today). If a future build changes the format, an older build refuses the code with a clear message and changes
nothing.

## 3. Known-good recovery points

Kept up to date in [`tools/android/recovery-points.json`](../tools/android/recovery-points.json); CI reads it.

| Build | Commit | versionCode / versionName | Status |
|---|---|---|---|
| **15 — PRIMARY** | `1b9aa89` (branch `ccr-6eaf78d0-vj87lh`) | 1015 / `0.6.0-dev.15+1b9aa89` | **Owner-verified on the phone** (2026-11-25: installed as an update over build 14, progress intact). **Archived long term:** pre-release [android-dev-b15](https://github.com/patrikarendas-droid/snapmon/releases/tag/android-dev-b15) with the original CI APK `snapmon-dev-0.6.0-dev.15-1b9aa89.apk`, APK SHA-256 `8220a0f885a6f2521b43ec065abf64dc8c6e7948a97cdfac3abb5a3bbbeca719` (checked by milestone runs [45572544428](https://github.com/patrikarendas-droid/snapmon/actions/runs/45572544428) (verify) and [45572984193](https://github.com/patrikarendas-droid/snapmon/actions/runs/45572984193) (publish)). From run [45405907369](https://github.com/patrikarendas-droid/snapmon/actions/runs/45405907369); its Actions artifact `SnapMon-Dev-APK-0.6.0-build-15` lasts until 2027-02-22. The emulator recovery drill now uses this commit. |
| 20 | `4349de8` | 1020 / `0.6.0-dev.20+4349de8` | Owner-verified on the phone (2026-11-27: combat model 2, glowing variants). Run [45849271839](https://github.com/patrikarendas-droid/snapmon/actions/runs/45849271839), artifact `SnapMon-Dev-APK-0.6.0-build-20` until 2027-02-24, APK SHA-256 `8867b3a5…8a6c097c`. |
| 19 | `b8feda3` | 1019 / `0.6.0-dev.19+b8feda3` | Owner-verified on the phone (2026-11-26: real family labels). Run [45834171150](https://github.com/patrikarendas-droid/snapmon/actions/runs/45834171150), artifact `SnapMon-Dev-APK-0.6.0-build-19` until 2027-02-24, APK SHA-256 `28f85447…d407b6aa`. Last build before combat model 2 (see below). |
| 18 | `45dbff1` | 1018 / `0.6.0-dev.18+45dbff1` | Owner-verified on the phone (2026-11-26: developer tools). Artifact `SnapMon-Dev-APK-0.6.0-build-18` until 2027-02-24. |
| 14 — historical | `4207571` | 1014 / `0.6.0-dev.14+4207571` | Owner-verified on the phone (2026-11-24). Run [45379221209](https://github.com/patrikarendas-droid/snapmon/actions/runs/45379221209), artifact `SnapMon-Dev-APK-0.6.0-build-14` (zip SHA-256 `659844e2…a171ea`); APK SHA-256 in that run's summary. The artifact expires on 2026-12-24 and is not archived as a release; download it before then if you want a copy. Its code stays in git history (and in `tests/save-compat.js`). |

All dev builds share:
- package `io.github.patrikarendas.snapmon.dev`;
- signing certificate SHA-256 `73a7e01f8ca2b716889309fea6a76be76b4b233b30cd381c233b592b72ffe161`.

A build that is only CI-green is **not** a recovery point until you have checked it on the phone.

**Combat model 2 (build 20 onwards, 2026-11-26).** Families decide combat; Spectral/Mutated/Prismatic are variants on
top. Saved monsters made by build 19 or older carry no `cv: 2` stamp and are **rebuilt on load and on backup-code
import** (family, stats, moves recomputed for the same object, rarity, variant, level and seed; look, name, level, XP,
id kept). The save format stays 3, so a rollback to build 19 or older still opens the save: the old code simply uses the
rebuilt numbers. Monsters caught in an older build after such a rollback are rebuilt again when you update forward.
`tests/save-compat.js` and `tests/family-variant.js` check both directions.

## 4. Recovering from a broken build (the normal way)

Android will not install an older versionCode over a newer one. So a rollback is **a new build that contains old
code**, with a higher versionCode, installed as an ordinary update. That is safe for the save because the CI checks
that today's save loads in the old code and comes back intact (see 4c).

**Before anything:** make a fresh backup code (section 2) and keep it in two places.

### 4a. Ask a Claude session to do it (recommended)

Tell it, for example: *"Build 15 broke X. Make a recovery build with the code of build 14 (owner-verified), keeping
my save, and give me the APK."* The session should:

1. Work on the Android development branch. Never force-push and never rewrite history. Either:
   - **Revert only the bad change:** `git revert <bad-commit>` (preferred, because it keeps every later fix); or
   - **Bring back the files of the verified commit as a NEW commit:**
     `git checkout 4207571 -- src index.html android-app tools` and then commit.
     Keep `tests/`, docs and workflows current unless they are the problem.
2. Keep the modern save reader. If the bad build changed the save format (`SAVE_VERSION`) or added a migration, do not
   restore an older `migrate()`/`loadState()`. Revert the feature, not the save code, so the newer save still loads.
3. Push. The **Android debug APK** workflow runs on its own:
   - the full fast suite, including `tests/save-compat.js`, which checks today's save against the old code;
   - a new APK with **versionCode = 1000 + the new run number** (always higher), the same package and the same key;
   - the emulator update test and the recovery drill.
4. Give you the artifact name, the direct link and the SHA-256.

### 4b. Install it

Download the artifact, extract it, open the `.apk`, and tap **Update** (not Uninstall). Then open the game and check
your monsters and coins. If anything looks wrong, do not play on: restore your fresh backup code.

### 4c. What is tested about this route

- `tests/save-compat.js` (every CI run, Node, synthetic save) opens a rich save made by the current code with the
  game code of the website's v0.6.0, build 9, build 13 and build 14, taken from git history. In each case:
  - the old code loads it and is not refused;
  - the old code saves it again;
  - the current code gets back every field, including fields the old code does not know (hunter name, locks);
  - a backup code works in both directions;
  - a save made and played by the old code loads in the current code.

  The only differences are allowed by design:
  - monster display text (each version applies its own curated writing once);
  - `curatedRev`.
- **Emulator recovery drill** (every CI run, real APKs, Android 14 emulator):
  1. A rich synthetic save is written in the current build.
  2. An APK built from the drill commit (`recovery-points.json` → `drill`, currently build 14's commit) with versionCode + 2 installs as an ordinary update. It loads every field, and the old code saves a change.
  3. The current code (versionCode + 3) gets everything back.
  4. Installing a lower versionCode is refused and changes nothing.
  5. After uninstall + clean install, pasting the Settings backup code restores the whole save.
- **Not proven:**
  - a rollback across a future save-format change (none exists today; 4a step 2 covers it);
  - the real phone itself;
  - recovery builds from commits not in `recovery-points.json`. Add them there first; CI then tests them.

## 5. Last resort: uninstall and restore

Only if the installed app cannot start at all and no update helps:
1. Use your **existing** off-device backup code. The app cannot make one in this state.
2. Uninstall, then install a working build (any versionCode).
3. Settings → Restore from a backup code.

This is tested on the emulator in every run. Without a backup code, the progress is gone after the uninstall.

## 6. Keeping selected APKs long term (milestones, owner approval required)

Actions artifacts are kept for **90 days** (since build 15; older ones for 30), then GitHub deletes them.
**Archived so far: build 15** (`android-dev-b15`, 2026-11-25, owner-approved). To keep an important owner-verified build for longer, it can be archived as a GitHub **pre-release** with the **original** CI
APK and an immutable tag `android-dev-b<build>`.

- The repository is public, so **a release and its APK are public**. Nothing is archived unless you approve that exact
  build ("Archive build 14 as a milestone").
- Never a rebuild. A rebuilt APK is a different binary even from the same commit, so it is never presented as the
  verified one.
- Not every build: only owner-verified milestones.

**Route A — the workflow** (`.github/workflows/android-milestone.yml`; it is on the default branch since 2026-11-25, so
Actions → *Android milestone archive* → **Run workflow** is available; run it from `claude/snapmon-game-dev-7o667u`):
1. Actions → *Android milestone archive* → **Run workflow**.
2. Inputs:
   - `run_id` and `build` of the verified run;
   - `apk_sha256` from that run's summary;
   - `mode` = `verify` first.
3. The verify run checks:
   - the run is a finished APK run whose latest attempt passed every job;
   - there is exactly one unexpired main APK artifact (attempt-aware);
   - the downloaded original matches the SHA-256 you gave, versionCode = 1000 + build, the commit, the package, the
     stable certificate and CAMERA-only permissions, and its `provenance.json` where present.

   It then writes the release notes into the run summary.
4. Run it again with `mode` = `publish` and `approval` = `I approve publishing build 14 publicly`. It creates the
   annotated tag and a **pre-release** (never "latest"). It refuses if the tag already exists.

**Route B — by hand, no merge needed** (GitHub website on a PC):
1. Download the artifact zip and check that the APK's SHA-256 equals the run summary
   (`sha256sum`, or `certutil -hashfile <file> SHA256` on Windows).
2. Releases → Draft a new release:
   - tag `android-dev-b14`, target = the build's full commit (`4207571b72fca82c72b29b6a6651d33dfc0ec346`);
   - title "SnapMon Dev build 14 (development APK)";
   - tick **Set as a pre-release**;
   - attach the APK unchanged;
   - paste the summary table (version, versionCode, SHA-256, certificate, run link, known caveats).
3. Never edit or move that tag afterwards.

Either way, **also keep your own copy outside GitHub** (a cloud drive and/or a computer) of each milestone APK and its
`provenance.json`. GitHub releases last much longer than artifacts, but they are not a guaranteed permanent archive.

Archived APKs are for a fresh device, for a reference copy, or for exact reproduction. Installing one over a NEWER
installed build is refused by Android (lower versionCode). For rolling back on your phone, use section 4.

## 7. Why an old commit stays rebuildable

- **Git history:** never rewritten, so every commit stays available.
- **Signing:** the dev key is derived from the `ANDROID_DEV_SIGNING_SEED` secret, so the same passphrase always gives
  the same certificate. **Keep that passphrase in your password manager.** Without it, no future build can update the
  installed app, and the only way forward is backup code → uninstall → install → restore.
- **Pinned engine:**
  - TF.js 4.22.0, MobileNet 2.1.1, COCO-SSD 2.2.3 and ONNX Runtime Web 1.20.1 in `tools/android/fetch-engine.sh`;
  - TinyCLIP variant, export command and cache key in the workflow;
  - all of these guarded by `tests/android-packaging.js`.
  - Every packaged model and runtime file is SHA-256-checked against `models/manifest.json` (`check-web.js`,
    `check-apk.js`).
- **Pinned app toolchain and shell:**
  - JDK 21, SDK 36 and build-tools 36.0.0 in the workflow;
  - Capacitor 8.6.2 (exact versions in `android-app/package-lock.json`);
  - Gradle 8.14.3 (wrapper), AGP 8.13.0.
- **Provenance:** every APK artifact now includes `provenance.json` with:
  - the commit, run and attempt;
  - the APK SHA-256;
  - the versionCode and versionName;
  - the certificate and the permissions.

  `tools/android/verify-apk.js` checks any APK file against these values.
- **Remaining risk:** external downloads (the TinyCLIP export from Hugging Face, the npm packages, the GitHub runner
  images) could change or disappear years from now. The archived original APK is the protection against that.
