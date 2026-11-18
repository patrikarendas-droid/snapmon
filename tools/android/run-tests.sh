#!/usr/bin/env bash
# The website's full regression suite (the same commands as the "test" job of .github/workflows/pages.yml;
# tests/android-packaging.js fails if a Pages test is missing here), run by the Android APK workflow so an APK is only
# built from a commit that would also pass the website's checks. Needs playwright + onnxruntime-web in node_modules
# and a static server on :8765 for the browser part. Usage: tools/android/run-tests.sh [logic|browser|all]
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
  node tests/devtest.js
  node tests/generator-snapshot.js
  node tests/gameplay-baseline.js
  node tests/ability-keys.js
  node tests/god-mode.js
  node tests/curated.js
  node tests/curated-pipeline.js
  node tests/curated-refresh.js
  node tests/mapping-audit.js
  node tests/catalogue-model.js
  node tools/curated.js validate
  node tests/android-packaging.js
fi
if [ "$part" = browser ] || [ "$part" = all ]; then
  mkdir -p shots
  node tests/e2e.js http://localhost:8765/index.html tests/fixtures shots
  node tests/e2e-engine.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist shots
  node tests/e2e-nav.js http://localhost:8765/index.html shots
  node tests/e2e-qol.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist shots
  node tests/e2e-v044.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist shots
  node tests/e2e-godmode.js http://localhost:8765/index.html node_modules/onnxruntime-web/dist shots
  node tests/e2e-curated.js http://localhost:8765/index.html shots
  node tests/e2e-catalogue-local.js http://localhost:8765/ shots
  node tests/e2e-catalogue-ai.js http://localhost:8765/ shots
  node tests/e2e-catalogue-sync.js http://localhost:8765/
  node tests/e2e-catalogue-sprite.js http://localhost:8765/ shots
  node tests/e2e-catalogue-storage.js http://localhost:8765/
fi
