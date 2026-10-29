# Preparing for an Android / Google Play build

No APK is built yet. This is how the web version is organised so a native wrapper (planned: **Capacitor** with the
Android System WebView) can be added without rewriting the game, and what must be checked before a store release.

## Layers

| Layer | Files | Native build |
|---|---|---|
| Game logic (pure, tested in Node) | `src/data.js`, `src/game.js`, `src/objects.js`, `src/labels.js`, `src/color.js` | unchanged |
| Rendering | `src/sprites.js`, `src/parts.js`, `src/ui.js`, `index.html` | unchanged |
| Device access | `src/platform.js` (`Platform.camera`, `Platform.storage`, `Platform.device`, `Platform.assets`) | replace implementations here only |
| Recognition engine | `src/engine.js` → `src/lens.js` + `src/lens-clip.js` + `src/workers/clip-worker.js` | same code; asset base points into the APK |
| Navigation | `Nav` / `window.SnapmonNav.back()` in `src/ui.js` | hook the hardware Back button |

## One recogniser, bundled in the app

Hybrid recognition (COCO-SSD lite + MobileNet v2 + TinyCLIP ViT-39M/16 with the calibrated decision rules) is part of
the game, not an option. The APK should **contain** every model and runtime file so all players run the same versions
and nothing is fetched from AI hosts during play.

- **One asset base.** All engine files are addressed through `Platform.assets.url(path)`. The web build serves them
  from the site. The native build sets `window.SNAPMON_ASSET_BASE` (e.g. `https://localhost/` for Capacitor's local
  server, which serves the app's `public/` folder) before the scripts load. No other code changes.
- **The file list already exists.** The deploy writes `models/manifest.json` with every file's path, size and SHA-256.
  A native build step can copy exactly those files into the app and verify them. The worker already checks TinyCLIP
  downloads against the manifest.
- **Size.** About 32.6 MB (detector, classifier and TF.js) plus about 53 MB (TinyCLIP 38.8 MB, vocabulary 2.9 MB,
  ONNX Runtime CPU/WASM build 11 MB), roughly 86 MB. Since v0.4.1 the 22 MB WebGPU runtime build is used only by a
  developer comparison switch and need not be bundled in the APK.
  - Google Play's limit for the base download is 200 MB (Android App Bundle), so the models fit. **Play Asset
    Delivery** with an *install-time* asset pack is the alternative if the base module needs to stay small. Install-time
    packs arrive with the app, are updated with each release, and need no in-game download screen.
  - Avoid *on-demand* or *fast-follow* packs for the engine: they reintroduce a "download before you can play" state.
- **Updates.** Model changes ship as normal app releases. Bump `ENGINE_ID` in `src/engine.js` whenever a model file,
  the vocabulary, a threshold or a decision rule changes. Every monster records the engine that identified it
  (`monster.photo.engine`), for future competitive or multiplayer checks.
- **Licences.** All models and runtimes are under permissive licences compatible with commercial distribution (see
  `THIRD_PARTY_NOTICES.md`). The APK must include those notices, e.g. on a Settings → Licences screen.

## Same AI, different hardware

| Part | GPU path | CPU path | Same weights? |
|---|---|---|---|
| Detector + classifier (TF.js) | WebGL | TF.js CPU backend | yes (automatic fallback, also mid-session if WebGL is lost) |
| TinyCLIP (ONNX Runtime Web, in a worker) | developer comparison only (WebGPU) | **standard for every player since v0.4.1**: WebAssembly, one thread | yes |

- If both backends fail, the player gets "SnapMon's recognition engine couldn't run on this device. Please check for
  system updates or try again." with a Retry. Hunting never continues with a weaker model.
- **WebView caveats.**
  - TinyCLIP no longer depends on WebGPU, so WebView's patchy WebGPU support does not matter for it.
  - TinyCLIP is pinned to one WASM thread so every device does the same arithmetic. Multi-threaded WASM (needs
    cross-origin isolation: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy:
    require-corp`) could be faster, but should only be enabled after checking that it gives identical scores.
- **Consistency.** TinyCLIP on WebGPU changed the outcome on ~4.5% of benchmark photos, which is why it runs on the
  CPU for everyone. Remaining differences (WebGL detector, canvas preprocessing) are listed in `docs/RECOGNITION.md`.

## Camera
- **Web build:** uses `getUserMedia` with the rear camera. It starts only after a tap and stops on capture, on close,
  on Back, or when the app is hidden. There is no gallery and no file input.
- **Capacitor:** the same `getUserMedia` call works in the WebView once the app holds `android.permission.CAMERA` and
  grants the WebView's permission request (Capacitor's bridge does this).
- **Permissions:** CAMERA only. INTERNET is not needed for play once the models are bundled.
- **Zoom (v0.4.2).** If the camera track reports a `zoom` capability (`MediaStreamTrack.getCapabilities()`), the game
  uses real camera zoom through `applyConstraints({ advanced: [{ zoom }] })`. Chrome on Android supports this on many
  phones, but which phones and which zoom range is up to the phone's camera driver; it has not been checked on a real
  device yet. Otherwise the game uses a digital zoom of up to 3×: the preview is scaled and the photo is cropped to
  exactly the same region. Either way the photo (and what recognition sees) matches the viewfinder. Digital zoom
  lowers the resolution (at 3×, a 1280 px frame leaves about 430 px), which recognition handles because the models work
  at 224–300 px anyway. A native build can use CameraX zoom behind the same `Platform.camera.setZoom`.
- **Viewfinder = photo (v0.4.2).** The viewfinder crops the camera frame to 3:4 (`object-fit: cover`). Before v0.4.2
  the photo contained the full frame, including edges the player could not see; now it is cropped to the visible region.

## App lifecycle (background / resume)
- Android Chrome freezes background pages and may drop their GPU context (WebGL) or stop workers to save memory. v0.4.2
  checks the engine when the page becomes visible again (`visibilitychange`, `pageshow`): it detects a lost WebGL
  context (`webglcontextlost`, `isContextLost()`) and pings the TinyCLIP worker, and if anything is broken it reloads
  both parts from the phone's cache (no download). A hunt that fails anyway triggers the same recovery and one retry;
  Try again always reinitialises. Recoveries never switch to another model.
- **Limit:** if Chrome kills the whole page (common after a long time in the background or under memory pressure), it
  reloads from scratch when reopened. Progress is safe (saved before the heavy step and when the app is hidden), but
  nothing in memory can survive that. A native app has the same limit when Android kills its process.
- The camera is always stopped when the app goes to the background; the player reopens it with SNAP.

## Back button
The game already routes Back through one function:

```js
// Capacitor (@capacitor/app)
import { App } from '@capacitor/app';
App.addListener('backButton', () => {
  if (window.SnapmonNav.back() === 'exit') App.exitApp(); // or App.minimizeApp()
});
```

`SnapmonNav.back()` returns:
- `'handled'`: it closed a sheet, the camera or a screen, or refused to abandon a battle;
- `'armed'`: on the Hunt screen, it showed "Press Back again to exit SnapMon.";
- `'exit'`: the second press within 2 s.

In the browser the same function is driven by a History API guard entry (see `src/ui.js`). Native code gives fully
reliable double-Back, which Chrome cannot guarantee (see the README).

## Storage
- `Platform.storage` uses synchronous localStorage today. Android can clear WebView storage under pressure, so a
  native build should back it with Capacitor Preferences or files.
- Keep the export/import backup code either way.
- Model files in the APK need no browser cache at all.

## Compatibility testing before a store release (not done yet)

Nothing below has been measured beyond the developer's own phone (WebGPU in Chrome: TinyCLIP ~1.5 s median, ~3 s on
the first photo, no warming over 30 photos).

1. **Devices.** At least:
   - a recent mid-range phone (WebGPU likely);
   - a 3–4-year-old mid-range phone (WebView WebGPU unlikely → WASM);
   - a 3–4 GB RAM phone;
   - an Android Go or very low-memory device to find the floor.
2. **Measure on each:**
   - engine initialisation time;
   - first and repeated photo times;
   - which backends ran (Field-test log);
   - peak memory (Android Studio profiler or `adb shell dumpsys meminfo`);
   - WebView crashes or renderer kills over 50 photos;
   - temperature and battery.
3. **Set the minimum from data:**
   - Candidate rule: Android version with a WebView that runs WASM SIMD (Android 8+ with an updated WebView) **and** a
     minimum RAM where 50 consecutive photos complete without the renderer being killed.
   - Do not exclude devices only for lacking WebGPU: the CPU path runs the same engine.
4. **Play Console.** Use the Device Catalog to exclude genuinely incompatible devices (by RAM or SoC) once the floor
   is known. Declare the camera as a required feature.

Known risks:
- Memory pressure on 2–3 GB phones while both model parts are resident (~100 MB of weights plus runtime buffers).
- Very slow WASM on old CPUs: recognition times out after 45 s with a message.
- WebView builds without SIMD.
- Background eviction of a browser cache: this only affects the web version.
