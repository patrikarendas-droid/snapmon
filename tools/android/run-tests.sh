#!/usr/bin/env bash
# The FAST regression suite of the current Android source (Node logic tests + headless Chromium tests of the shared
# game code, the catalogue and the catalogue-only website). Android is the only supported playable platform: these
# tests protect the Android game and the catalogue; they do NOT keep a browser game in step with the app. When an
# Android-only feature makes a browser-level test meaningless, replace it with an equivalent test at the right layer
# (unit, mocked native bridge in tests/e2e-android-web.js, emulator in tools/android/emulator-smoke.js) — never just
# delete it. tests/android-packaging.js fails if a test file is neither run here / in android-apk.yml nor listed with a
# reason. Needs playwright + onnxruntime-web in node_modules and a static server on :8765 for the browser part.
# Usage: tools/android/run-tests.sh [logic|browser|all]
set -euo pipefail
part="${1:-all}"
if [ "$part" = logic ] || [ "$part" = all ]; then
  node tests/sim.js > /dev/null
  node tests/labels.js
  node tests/sprite-regress.js check tests/fixtures/sprite-baseline-v1.json
  node tests/sprites-v3.js
  node tests/sprite-regress-v3.js check tests/fixtures/sprite-baseline-v3.json
  node tests/sprite-redesign.js
  node tests/migrate.js
  node tests/clip-fusion.js
  node tests/color.js
  node tests/lore.js
  node tests/guide.js
  node tests/rules-trace.js
  node tests/identity.js
  node tests/devtest.js            # developer Custom encounter + Give items (real save; refused in a release build)
  node tests/generator-snapshot.js
  node tests/gameplay-baseline.js
  node tests/ability-keys.js
  node tests/god-mode.js           # developer God Mode: HP protection only, in every real battle
  node tests/curated.js
  node tests/curated-pipeline.js
  node tests/curated-refresh.js
  node tests/mapping-audit.js
  node tests/catalogue-model.js
  node tools/curated.js validate
  node tests/android-packaging.js
  node tests/quiet-objects.js       # a missed object stays quiet (hidden period); fake clock + RNG
  node tests/encounter-lock.js      # an object that produced a monster is locked (hidden period); hunter name rules
  node tests/combat-log.js          # the combat log reports exactly what the battle engine did
  node tests/unique-capture.js      # one monster per object + rarity + variant in the real collection
  node tests/family-variant.js      # Spectral/Mutated/Prismatic are variants, never families (all objects × rarities × variants)
  node tests/save-compat.js         # today's save in the game code of older verified builds and back (needs git history)
fi
if [ "$part" = browser ] || [ "$part" = all ]; then
  mkdir -p shots
  node tests/e2e.js http://localhost:8765/index.html tests/fixtures shots
  node tests/e2e-engine.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist shots
  node tests/e2e-nav.js http://localhost:8765/index.html shots
  node tests/e2e-qol.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist shots
  node tests/e2e-v044.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist shots
  node tests/e2e-godmode.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist shots
  node tests/e2e-devtools.js http://localhost:8765/index.html shots   # Custom encounter + Give items on the real save (412/320 px)
  node tests/e2e-family-variant.js http://localhost:8765/index.html shots   # real families on every screen; variant sprite finish (412/320 px)
  node tests/e2e-curated.js http://localhost:8765/index.html shots
  node tests/e2e-catalogue-local.js http://localhost:8765/ shots
  node tests/e2e-catalogue-ai.js http://localhost:8765/ shots
  node tests/e2e-catalogue-sync.js http://localhost:8765/
  node tests/e2e-catalogue-sprite.js http://localhost:8765/ shots
  node tests/e2e-catalogue-storage.js http://localhost:8765/
  node tests/e2e-layout.js http://localhost:8765/index.html shots   # HUD / tab bar never cover content (website, inset 0)
  node tests/e2e-quiet.js http://localhost:8765/index.html shots    # quiet objects in the real UI; text-only recognition choices
  node tests/e2e-combat-log.js http://localhost:8765/index.html shots   # combat log sheet, hunter name, Recently disturbed
  node tests/e2e-unique-capture.js http://localhost:8765/index.html shots   # unavailable Capture button for an owned slot
  # the catalogue-only Pages site (what pages.yml deploys), served under /snapmon/ like the real site
  node tools/catalogue/build-site.js shots/catalogue-site
  node tests/e2e-catalogue-preview.js shots/catalogue-site 8799 shots
  node tools/catalogue/serve.js shots/catalogue-site 8798 > /dev/null & CAT=$!
  sleep 1
  node tests/e2e-catalogue-local.js http://localhost:8798/snapmon/ shots
  node tests/e2e-catalogue-ai.js http://localhost:8798/snapmon/ shots
  node tests/e2e-catalogue-sync.js http://localhost:8798/snapmon/
  node tests/e2e-catalogue-sprite.js http://localhost:8798/snapmon/ shots
  node tests/e2e-catalogue-storage.js http://localhost:8798/snapmon/
  kill $CAT
fi
