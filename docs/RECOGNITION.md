# Spirit Lens: recognition design and benchmark

All recognition runs **on the phone**. No photo is uploaded, there is no cloud inference and no paid API.
Models are downloaded once and cached.

## Pipeline

**Production lens** (`src/lens.js`, every player):
1. COCO-SSD lite finds objects and boxes; MobileNet v2 classifies the whole photo and each box crop.
2. Labels map to registry objects through `src/labels.js` (forklift → `forklift`, never "vehicle").
3. Decision: one confident object → automatic; several boxes → the player picks; unsure → the lens's own top
   suggestions; nothing above threshold → "Unknown object". Never manual entry, never a random fallback.

**Experimental lens** (`src/lens-clip.js` + `src/workers/clip-worker.js`, Settings → Developer & testing, off by default):
1. Regions = whole photo + up to 3 production boxes, cropped to 224 px with CLIP normalisation.
2. TinyCLIP image encoder (int8 ONNX) in a Web Worker, ONNX Runtime Web: WebGPU when an adapter exists, else WASM
   (multi-threaded only when the page is cross-origin isolated).
3. Cosine similarity against **precomputed** float16 text embeddings for 2,940 labels (1,963 objects + 46
   background concepts such as "a wall", "grass"), each averaged over 4 prompt templates; softmax with the model's
   logit scale; probabilities summed per object.
4. Rejection: best object share ≥ `p`, lead over the runner-up ≥ `margin`, and the winner must not be a background
   concept. CLIP scores are **not** probabilities. The UI shows a *calibrated* value only where the benchmark's
   reliability table has ≥ 5 photos in that score bin; otherwise "n/a".

**Hybrid** (developer setting "Hybrid", `ClipLens.fuse`), per region:
1. CLIP accepted and agrees with production → that object.
2. CLIP accepted, same category as production → CLIP's more specific object (truck → forklift).
3. CLIP accepted and *trusted* (calibrated bin accuracy, or held-out precision of the thresholds measured on ≥ 10
   accepted photos, is ≥ 0.7) → CLIP's object, even when production disagrees or found nothing.
4. Otherwise → production's answer. Without deployed calibration rule 3 never fires.
Rules are unit-tested in `tests/clip-fusion.js`.

## Models evaluated

| Model | Licence | Shippable in a commercial Play app? | Notes |
|---|---|---|---|
| MobileNet v2 + COCO-SSD (production) | Apache-2.0 | yes | proven on a real phone since v0.1 |
| TinyCLIP ViT-8M/16 | MIT | yes | 9.4 MB int8; far too weak (accepts 5%) |
| TinyCLIP ViT-40M/32 | MIT | yes | 45 MB int8; fast, lower precision |
| **TinyCLIP ViT-39M/16** | MIT | yes | **41 MB int8; chosen experimental model** |
| OpenAI CLIP ViT-B/32 | MIT code, model card discourages deployment | no | 96 MB; accuracy reference only |
| Apple MobileCLIP / MobileCLIP2 | Apple ML research licence | no (non-commercial) | not benchmarked |
| MetaCLIP | CC-BY-NC | no | not benchmarked |
| SigLIP base | Apache-2.0 | licence yes, size no | ≥ 90 MB vision tower |

The vision towers were exported from the Hugging Face checkpoints with `lab/export_clip.py` (TorchScript exporter,
opset 17) and quantised with ONNX Runtime dynamic int8 (MatMul/Gemm weights only).

## Benchmark (`.github/workflows/lab.yml`)

Photos: 3 per object for ~85 objects plus out-of-vocabulary scenes and rare instruments, fetched from Wikimedia
Commons inside CI (evaluation only, never committed). About 215–230 object photos and 18–26 out-of-vocabulary photos
per run (a few downloads fail each time). Scoring is strict: the top answer must be **exactly** the labelled object
(van for a forklift, or garbage truck for a cement mixer, counts as wrong).

**Measured in headless Chromium on a GitHub Actions CPU (SwiftShader WebGL, ONNX WASM). Not phone numbers.**

Run 40838253067, all photos:

| | Top-1 | Top-3 | Accepts | Precision when accepted | Confidently wrong | OOV rejected | ms avg / p95 |
|---|---|---|---|---|---|---|---|
| Production | 21–22% | 27–28% | 76% | 28–29% | 54% | 0% | 980–1510 / 1290–2010 |
| TinyCLIP 8M/16 | 4% | 4% | 5% | 75% | 1% | 100% | 173 / 296 |
| TinyCLIP 40M/32 | 17% | 19% | 24% | 72% | 7% | 50% | 192 / 336 |
| TinyCLIP 39M/16 | 21% | 22% | 25% | 84% | 4% | 100% | 472 / 838 |
| OpenAI B/32 (ref.) | 30% | 37% | 49% | 62% | 19% | 50% | 245 / 439 |

Run 40839920111, TinyCLIP 39M/16, **held-out half only** (thresholds chosen on the other half):

| | Top-1 | Top-3 | Precision when accepted | Confidently wrong | OOV rejected | ms avg / p95 |
|---|---|---|---|---|---|---|
| Production | 20.5% | 24.1% | 25.8% | 58.9% | 0% | 1260 / 1833 |
| Trusted hybrid | **30.4%** | **33.9%** | 36.6% | 52.7% | 0% | 1863 / 3139 |

Calibrated thresholds: `p ≥ 0.35`, `margin ≥ 0.15` (held-out precision 75% on 28 accepted photos). Reliability
table: `lab/calib/tinyclip-39m16.json`. Load time in CI: ~1.1 s from cache.

Look-alike pairs (production / experimental): forklift photos → production said van, truck, nothing; TinyCLIP rejected
all three (no forklift was mis-named as a train, but none was recognised either). Banana and cucumber: both lenses
right on some photos. Office chair: neither lens recognised any. No teapot or train photos were downloaded in these
runs, so those pairs are untested.

## Decision for v0.3.0

- **Production stays the default for every player.** The hybrid improves top-1 by about 10 points on this
  benchmark, but costs a 41 MB extra download and roughly +0.6 s per photo on a desktop CPU; on a phone using WASM it
  will be slower, and that has not been measured. The sample is small (112 held-out object photos).
- The hybrid ships as an opt-in developer mode so it can be field-tested on the real phone (Settings → Developer →
  Hybrid + Field-test mode). If field tests confirm the gain at acceptable latency, it can become the default in a
  later version.
- Production still fails to reject out-of-vocabulary photos. CLIP rejects them reliably on its own, but the hybrid
  keeps production's answer when CLIP abstains (rule 4). Using CLIP as a veto is a possible next step and needs its
  own measurement.

## Reproducing

Push to a `feature/**` branch touching `lab/**`, or run *Recognition lab* manually. Each job prints `EXPORT`, `BENCH`,
`TRUSTED`, `CALIB` and `PER-OBJECT` lines.
