# Next milestone — SnapMon Dev (Android development APK)

Status: **PREPARED, NOT PUBLISHED.** The candidate is the first CI build that contains the two pre-milestone tweaks
(crit wording, developer monster level). It becomes a milestone only after the owner has installed and tested THAT
EXACT APK on the phone and approved it in so many words. Until then build 15 (`android-dev-b15`) stays the primary
archived recovery milestone. Procedure: `docs/RECOVERY.md` section 6 (Route A, the *Android milestone archive* workflow).

## Candidate: build 22 (awaiting the owner's phone test)

| | |
|---|---|
| Proposed tag | `android-dev-b22` (pre-release, not "latest") |
| APK | `snapmon-dev-0.6.0-dev.22-0681beb.apk`, SHA-256 `450721e1ad9da7ea867fb41f57b1d8dee4921436789fd6edcccd5e6d267d8000` (72,317,142 bytes) |
| Version | `0.6.0-dev.22+0681beb`, versionCode 1022; package `io.github.patrikarendas.snapmon.dev`; CAMERA only |
| Certificate | `73a7e01f8ca2b716889309fea6a76be76b4b233b30cd381c233b592b72ffe161` (stable dev key) |
| Commit | `0681bebb6ad56393e2d6b6a1583e50ad980806e0` (branch `ccr-6eaf78d0-vj87lh`) |
| CI run | [46000181733](https://github.com/patrikarendas-droid/snapmon/actions/runs/46000181733): tests, APK, emulator + recovery drill all green (first attempt); artifact `SnapMon-Dev-APK-0.6.0-build-22` (id 15198622185, zip `c0bc65d6…b76df1`), expires 2027-02-25 |
| Milestone VERIFY | [46004930826](https://github.com/patrikarendas-droid/snapmon/actions/runs/46004930826): passed — run finished with every job green; exactly one APK artifact; downloaded ORIGINAL binary: SHA-256, package, certificate, CAMERA-only, versionCode 1022, versionName names commit 0681beb, provenance.json (SHA, versionCode, certificate, commit) all match. Publish step skipped. |
| Owner phone verification | **pending** |

To publish after the phone test: the owner writes, in the session, *I approve publishing build 22 publicly*; then the
milestone workflow runs with `mode=publish`, the same inputs and that sentence; afterwards `recovery-points.json`
(`drill`, primary role), RECOVERY.md and the journal name build 22 as the PRIMARY milestone; build 15's archive stays.

## What this milestone contains (since build 15)

- **One monster per object + rarity + variant** in the collection (level ignored); release frees the slot (build 17).
- **Real developer tools** on the real save (hidden; refused by the game logic in release builds): custom encounters
  by exact object, rarity, variant and — new — **monster level** (1–100 or Auto); Give items; HP-only God Mode (build 18,
  level in the milestone build).
- **Six real families decide combat** (combat model 2): Household, Mechanical, Organic, Elemental, Food, Botanical.
  Spectral, Mutated and Prismatic are variants layered on top (stats, one extra move, extra rewards), never families.
  Saved monsters were rebuilt to the model on load (builds 19–20; `docs/review/COMBAT_MODEL_2.md`).
- **Glowing variant sprites**: crisp rim + soft fading halo for Spectral (cyan), Mutated (acid green, stink wisps) and
  Prismatic (rainbow, sparkles); Normal sprites unchanged (build 20).
- **Combat log transparency**: exact HP prevented by resistance / added by a weakness, critical bonus damage
  ("critical bonus: +N damage" — milestone build), overkill, God Mode blocks; numeric energy under the energy bar
  (build 21).
- **Battle-screen flash fixed**: the crit/Ultimate screen shake no longer restarts the battle overlay's fade-in; the
  battle is opaque (build 21).
- No change to recognition, encounter odds, capture odds or the damage formula in builds 21 and the milestone build
  (rules-trace and gameplay baselines unchanged since build 20's intentional combat-model change).

## Test evidence (filled in per candidate)

- Fast suite (Node + headless Chromium), APK + release-configuration checks, Android 14 emulator incl. the recovery
  drill from build 15's code, the real-WebView glow and flash checks: see the candidate's CI run.
- Milestone workflow in **verify** mode on the ORIGINAL CI artifact: SHA-256, package, versionCode = 1000 + build,
  commit, signing certificate `73a7e01f…ffe161`, CAMERA-only permission, provenance.
- Owner phone verification: **pending** until the owner reports it.

## Recovery

- Install over any older SnapMon Dev as an **update** after making a backup code (Settings → Back up your progress).
- Android refuses it over a newer build (higher versionCode). Rolling back = a new build from the wanted commit with a
  higher versionCode, same key (`docs/RECOVERY.md` section 4). Last resort: uninstall → install → restore backup code.
- Build 15 (`android-dev-b15`) and its recovery path stay available after this milestone is published.
