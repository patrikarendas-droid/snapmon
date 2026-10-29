# Preparing for an Android / Google Play build

No APK is built yet. This is how the web version is organised so a native wrapper (e.g. **Capacitor** with the
Android System WebView) can be added later without rewriting the game, and what must be checked when that happens.

## Layers

| Layer | Files | Native build |
|---|---|---|
| Game logic (pure, testable in Node) | `src/data.js`, `src/game.js`, `src/objects.js`, `src/labels.js` | unchanged |
| Rendering | `src/sprites.js`, `src/parts.js`, `src/ui.js`, `index.html` | unchanged |
| Device access | `src/platform.js` (`Platform.camera`, `Platform.storage`, `Platform.device`) | replace implementations here only |
| AI | `src/lens.js` (production), `src/lens-clip.js` + `src/workers/clip-worker.js` (experimental) | model URLs configurable via `Lens.CFG` / `ClipLens.CFG` |

## Camera
- The web build uses `getUserMedia` with `facingMode: environment`, started only after a tap and stopped on capture,
  close, or when the app is hidden. No gallery, no file input.
- In Capacitor the same `getUserMedia` call works in the Android WebView once the app holds `android.permission.CAMERA`
  and grants the WebView's permission request (`WebChromeClient.onPermissionRequest`; Capacitor's bridge does this).
  Alternative: implement `Platform.camera` with a native preview plugin; the rest of the game only needs a canvas back.
- Permissions needed: **CAMERA** only. No storage, location, microphone or network-state permissions. `INTERNET` only
  if models are downloaded instead of bundled.

## Models
- Production models (~30 MB) are fetched once and cached in IndexedDB. For a Play build, bundle them in the APK assets
  and point `Lens.CFG.localUrls` at them (Play's base APK limit is 150 MB, or use Play Asset Delivery).
- The experimental CLIP model is off by default and should stay out of a store build unless field tests justify it.
- WebGL is available in the Android WebView; **WebGPU** support in WebView lags Chrome, so the worker falls back to
  WASM (`ort.min.js`). WASM multithreading requires cross-origin isolation, which a WebView app can enable with
  `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` headers from the local server.

## Storage
- `Platform.storage` is synchronous localStorage today. A WebView keeps localStorage per app, but Android can clear it
  under storage pressure; a native build should back it with Capacitor Preferences or files and keep the export /
  import backup code.

## Licences
All runtime dependencies and model weights are under permissive licences compatible with commercial distribution;
see `THIRD_PARTY_NOTICES.md`. Re-check that list before a store submission.
