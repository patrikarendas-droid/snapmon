#!/usr/bin/env bash
# Assembles the standard Hybrid recognition engine into <out>/models + <out>/vendor, exactly like the "Assemble site"
# steps of .github/workflows/pages.yml (same tools, same pinned versions; tests/android-packaging.js fails if the two
# ever disagree). The TinyCLIP export itself (lab/export_clip.py → models/clip/<variant>) runs in the workflow first.
# Usage: tools/android/fetch-engine.sh <out-dir>        (run from the repository root)
set -euo pipefail
OUT="${1:?usage: tools/android/fetch-engine.sh <out-dir>}"
CLIP_VARIANT="${CLIP_VARIANT:-tinyclip-39m16}"
ROOT="$(pwd)"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

# detector + classifier weights (TF.js graph models), same script as the website deploy
node tools/fetch-models.js "$OUT/models"

# runtime libraries, pinned (identical list to pages.yml)
TMP="$(mktemp -d)"
( cd "$TMP" && npm init -y > /dev/null && npm i --no-save --silent @tensorflow/tfjs@4.22.0 @tensorflow-models/mobilenet@2.1.1 @tensorflow-models/coco-ssd@2.2.3 onnxruntime-web@1.20.1 )
NM="$TMP/node_modules"
mkdir -p "$OUT/vendor/tfjs" "$OUT/vendor/ort"
cp "$NM/@tensorflow/tfjs/dist/tf.min.js" "$NM/@tensorflow-models/mobilenet/dist/mobilenet.min.js" "$NM/@tensorflow-models/coco-ssd/dist/coco-ssd.min.js" "$OUT/vendor/tfjs/"
cp "$NM"/onnxruntime-web/dist/{ort.min.js,ort.webgpu.min.js,ort-wasm-simd-threaded.mjs,ort-wasm-simd-threaded.wasm,ort-wasm-simd-threaded.jsep.mjs,ort-wasm-simd-threaded.jsep.wasm} "$OUT/vendor/ort/"
cp "$NM/onnxruntime-web/LICENSE" "$OUT/vendor/ort/LICENSE.txt" || true
rm -rf "$TMP"

# TinyCLIP (exported model + text embeddings + calibration)
mkdir -p "$OUT/models/clip/$CLIP_VARIANT"
cp "$ROOT/models/clip/$CLIP_VARIANT"/{vision.onnx,vocab.bin,vocab.json} "$OUT/models/clip/$CLIP_VARIANT/"
echo "engine assembled in $OUT"
