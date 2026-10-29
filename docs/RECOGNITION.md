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
4. Otherwise → production's answer, and production's other candidates stay in the choice list. Without deployed
   calibration rule 3 never fires.
5. (v0.3.1) Production would identify the photo automatically, but CLIP's best whole-photo object differs and scores
   ≥ 0.08 → the player chooses between them ("The lenses disagree"). CLIP's suggestion shows no percentage, because
   its score is not a confidence. (v0.3.2) Not for near-synonyms: same category and CLIP rates production's object
   at least half as high.
5b. (v0.3.3) Production unsure → CLIP's best object (≥ 0.08) is added to the choices.
6. (v0.3.3) Production found nothing (and saw no person) → "Could it be this?" with CLIP's best object (≥ 0.08).
Since v0.3.3 each production candidate belongs to one region, so one detected object is never counted twice.
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

## First phone field test (v0.3.0, 29 Oct 2026)

30 photos on the developer's Android phone, Chrome, experimental lens on **WebGPU**. Verdicts by the tester.

| | Result |
|---|---|
| Production: #1 answer right | 16/30 (53%); answered 27, right when it answered 59% |
| Production: identified automatically but wrong | **7** (stopwatch for a tape measure, coffeepot for an electric kettle, bicycle for a pallet jack, garbage truck for a carton press, clock for an angle grinder, fridge for a door, bowl for a trash can) |
| TinyCLIP: best guess right (ignoring its threshold) | 20/30 (67%) |
| TinyCLIP: accepted at the calibrated threshold | 9/30, all 9 right |
| Time per photo | production median 144 ms (max 241); TinyCLIP median 1.48 s (max 3.1 s, first photo) |
| Hybrid at the deployed thresholds | 16/30, same as production: whenever CLIP was confident enough, production was already right |

Simulated on the same photos (so not independent evidence):
- Lower CLIP thresholds (p ≥ 0.2, margin ≥ 0.1) would give 19/30 with 1 doubtful acceptance. 30 photos are too few to
  re-tune thresholds, so they stay as calibrated in CI.
- Rule 5 turns all 7 wrong automatic answers into choices. 4 of those include the right object (tape measure, kettle,
  pallet jack, trash can); in the other 3 nothing is right and the player can retake. No correct automatic answer
  would have become a choice.
- The bowl/trash-can photo exposed a fusion bug: without detector boxes, fusion kept only production's top
  candidate. Fixed in v0.3.1: production's runner-up candidates stay in the choice list.

The verdict buttons were also ambiguous: "Rightly unknown" was used for some wrong answers. Since v0.3.1 they match what
each lens did (answered: right / in list / wrong; no answer: rightly unknown / missed), and the log keeps the production
result separate from the hybrid result.

**Decision:** production stays the default. Production is fast on the phone, and the hybrid adds about 1.5 s per photo
for no measured top-1 gain at the calibrated thresholds. Next field test: Hybrid with rule 5, to measure how often
the player now gets the right object (automatically or in the choice list) and how many extra choices it causes.

## Second phone field test (v0.3.1, 29 Oct 2026)

11 photos with Hybrid on (log truncated in transit after the 11th). Production identified 9 photos automatically and
was wrong on 3: stopwatch for a tape measure, suitcase for a speaker, cup for a trash can. Hybrid turned all 3 into
choices; 2 of them offered the right object. Hybrid also asked once needlessly: production's "wall clock" was right,
but CLIP's best was "clock".

Fixed in v0.3.2: a same-category CLIP answer counts as agreement when CLIP scores production's object at least half
as high (wall clock 0.075 vs clock 0.118 → agree; coffeepot 0.104 vs electric kettle 0.267 → still a disagreement).

Replaying rule 5 (with that fix) on all 32 automatically identified photos from both tests:
- 10 production answers were confidently wrong; all 10 became choices, and 6 of those offered the right object.
- 0 correct answers turned into needless choices.
- Again, this is measured on the photos that shaped the rule.

Still open: in 3 photos production found nothing while CLIP's best guess was right (security camera twice, handsaw,
scores 0.13–0.22). Offering CLIP's guess when production finds nothing is a candidate rule 6. There are too few cases
to add it yet.

Per-photo time with Hybrid stayed at a 1.5 s median for TinyCLIP (max 3.1 s, the first photo after loading).

## Third phone field test (v0.3.2, 29 Oct 2026)

29 photos with Hybrid on. The phone did not get warm. TinyCLIP took a median of 1.5 s per photo (max 3.1 s, the first
photo after loading); production took 0.08–0.2 s.

Out of sample: everything Hybrid did here used rules designed before this run.

| | Production alone | Hybrid (v0.3.2, as logged) |
|---|---|---|
| Right object, automatically | 17 | 18 |
| Right object in the choice list | 0 | 4 |
| **Player can get the right object** | **17/29 (59%)** | **22/29 (76%)** |
| Confidently wrong (automatic) | 5 | 2 |
| Needless choices (production was right) | – | 2 (chair; wall clock, from a duplicate-box bug) |

Examples: production named a bench, Hybrid a drink can (TinyCLIP accepted it); production offered soap dispenser or
knife, Hybrid a tap (accepted); production stopwatch → choice that includes the tape measure; traffic cone in a
"scene" photo production rejected.

Changes in v0.3.3, designed on this run (in sample):
- Fixed: one detected clock was counted twice ("wall clock" and "clock").
- Rule 5b would have added the fire extinguisher and the pallet jack.
- Rule 6 would have offered the kettle.

Replaying all three field tests (69 photos) through the v0.3.3 rules gives: right object reachable 56/69 (81%) vs
production 40/69 (58%), confidently wrong 3 vs 15, 1 needless choice. This includes in-sample photos, so the real gain
is likely smaller; the out-of-sample run 3 table above is the fairest single number.

## v0.4.0: Hybrid becomes the standard

After three phone field tests (69 photos; the out-of-sample run: right object reachable on 22/29 with Hybrid vs 17/29
with detector + classifier alone; confidently wrong 2 vs 5; no warming; ~1.5 s extra per photo with WebGPU), Hybrid
is the **only** recogniser for players (`src/engine.js`, `ENGINE_ID = 'hybrid-1'`).

- **Same models for everyone.** COCO-SSD lite + MobileNet v2 1.0 (TF.js), TinyCLIP ViT-39M/16 int8 (ONNX), the
  2,940-label vocabulary, and the calibration in `lab/calib/tinyclip-39m16.json`.
- **No substitutes.** The old tfhub/MobileNet 0.5 fallbacks are gone, and the engine needs all three parts. If one
  cannot load or run, hunting stops with an explanation and a Retry.
- **Backends.** GPU where it works (WebGL / WebGPU), otherwise CPU with the same weights (TF.js CPU / WASM). WebGPU
  failures fall back automatically (also tested with simulated failures in `tests/e2e-engine.js`).
- **Consistency.** TinyCLIP scores and margins are rounded to 3 decimals before any threshold, and ties are broken by
  name, so last-digit float differences between backends cannot reorder results. Measured GPU vs CPU: see below.
- **Downloads.** Downloads are checked against `models/manifest.json` (size and SHA-256) before they are cached.
- **Developer comparison.** "Production only" and "Compare" survive only inside the hidden developer Field-test mode,
  which never creates monsters.

## GPU vs CPU consistency (real models, lab run 40887992402)

The same 155 distinct benchmark photos went through the full standard engine twice in headless Chromium: GPU pass
(WebGL detector/classifier + WebGPU TinyCLIP, on a software SwiftShader adapter) and CPU pass (TF.js CPU + WASM).

| | Result |
|---|---|
| Detector/classifier confidences, WebGL vs CPU | max difference 0.0001: effectively identical |
| TinyCLIP scores, WebGPU vs WASM | median difference 0.007, 95th percentile 0.025, max 0.077 |
| Same final result (decision and choice list) | 148 of 154 object photos; 1 out-of-vocabulary photo differed |
| Photos whose outcome changed | 7 of 155 (≈ 4.5%) |

What changed:
- bulldozer: CPU auto "bulldozer", GPU a crane/excavator choice;
- broccoli: CPU unknown, GPU a "cashew" suggestion;
- strawberry: auto vs a one-item choice;
- dog: "badger" vs "panda" (both wrong);
- rocking chair and clock: one extra or different suggestion;
- stethoscope (out of vocabulary): auto vs a two-item choice.

**Cause.** The int8 TinyCLIP model is computed differently by the two runtimes: integer kernels on WASM, dequantised
float math on WebGPU, where ONNX Runtime also warns that some nodes fall back to the CPU. The softmax over 2,940
labels amplifies small cosine differences. Rounding to 3 decimals removes last-digit noise but not differences of
this size.

**Speed in this run** (software GPU, not representative of phones): TinyCLIP took 0.57 s on WASM (avg, p95 1.04 s) on
the CI CPU, against 8.3 s on the software WebGPU adapter. On the developer's phone, real WebGPU took ~1.5 s median.
WASM on the phone has not been measured.

**Correction to earlier numbers.** Until this fix, `lab/fetch-photos.mjs` saved every out-of-vocabulary photo under the
same two file names, so each category overwrote the previous one. The "out-of-vocabulary rejected" percentages in the
benchmark tables above (including TinyCLIP 39M/16's 100%) were measured on effectively **2 distinct photos repeated**,
not 26. Treat them as anecdotal until the next benchmark run. All object-photo numbers are unaffected.

## Reproducing

Push to a `feature/**` branch touching `lab/**`, or run *Recognition lab* manually. Each job prints `EXPORT`, `BENCH`,
`TRUSTED`, `CALIB` and `PER-OBJECT` lines.
