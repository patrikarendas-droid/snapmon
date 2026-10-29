/* SNAPMON — platform layer. Everything that touches the device lives behind these small interfaces so a future
   native Android build (e.g. Capacitor + Android WebView) can replace the browser implementations without touching
   game logic, UI or AI code. See docs/ANDROID.md.

   Platform.camera  : open(video) / capture(video) → canvas / close(video) / isOpen() / supported() / describe(error)
                      zoomInfo() / setZoom(value, video) / visibleRect(video)
   Platform.storage : get(key) / set(key, value) / remove(key)   (synchronous; returns false when storage is blocked)
   Platform.device  : online() / webgl() / webgpu() / wasm()
   Platform.assets  : url(path) → where packaged model/runtime files live (site on the web, APK assets natively)   */
'use strict';

const Platform = (() => {
  /* ---------- camera: live rear camera only (no gallery / file upload) ---------- */
  let stream = null, digital = 1;
  const DIGITAL_MAX = 3; // software zoom limit: beyond 3× a 1280 px stream leaves too few pixels for recognition
  const track = () => stream && stream.getVideoTracks()[0];
  // resolves once the <video> is really showing camera frames (not merely "play() resolved")
  function firstFrame(video, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = ok => { if (done) return; done = true; clearTimeout(timer); for (const e of evs) video.removeEventListener(e, check); ok ? resolve() : reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })); };
      const check = () => { if (video.videoWidth > 0 && video.readyState >= 2) finish(true); };
      const evs = ['loadeddata', 'playing', 'resize', 'timeupdate'];
      const timer = setTimeout(() => finish(false), timeoutMs);
      for (const e of evs) video.addEventListener(e, check);
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => check());
      check();
    });
  }
  const camera = {
    supported: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    secure: () => window.isSecureContext !== false,
    // resolves when the live preview is displaying frames; rejects on permission, hardware or timeout problems
    async open(video, { timeoutMs = 12000 } = {}) {
      if (!camera.secure()) throw Object.assign(new Error('insecure'), { kind: 'insecure' });
      if (!camera.supported()) throw Object.assign(new Error('unsupported'), { kind: 'unsupported' });
      const want = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false };
      const start = c => Promise.race([navigator.mediaDevices.getUserMedia(c), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), timeoutMs))]);
      try { stream = await start(want); }
      catch (e) {
        if (e && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) stream = await start({ video: true, audio: false }); // any camera will do
        else throw e;
      }
      digital = 1;
      video.srcObject = stream; video.setAttribute('playsinline', ''); video.muted = true;
      await video.play();
      await firstFrame(video, timeoutMs);
    },
    /* Zoom. Hardware zoom (MediaStreamTrack "zoom" constraint, supported by Chrome on many Android phones) changes the
       camera stream itself. Otherwise a digital zoom crops the centre of the frame: the preview is scaled with CSS and
       capture() crops exactly the same region, so recognition always sees what the viewfinder shows. */
    zoomInfo() {
      const t = track(), caps = t && t.getCapabilities ? t.getCapabilities() : {};
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        const cur = (t.getSettings && t.getSettings().zoom) || caps.zoom.min;
        return { kind: 'hardware', min: caps.zoom.min, max: Math.min(caps.zoom.max, caps.zoom.min * 10), step: caps.zoom.step || 0.1, value: cur };
      }
      return { kind: 'digital', min: 1, max: DIGITAL_MAX, step: 0.1, value: digital };
    },
    async setZoom(v, video) {
      const z = camera.zoomInfo(); v = Math.max(z.min, Math.min(z.max, +v || z.min));
      if (z.kind === 'hardware') { await track().applyConstraints({ advanced: [{ zoom: v }] }); return v; }
      digital = v; if (video) video.style.transform = v > 1 ? `scale(${v})` : '';
      return v;
    },
    // the part of the camera frame the viewfinder shows (object-fit: cover, then digital zoom), in video pixels
    visibleRect(video) {
      const vw = video.videoWidth, vh = video.videoHeight, cw = video.clientWidth || vw, ch = video.clientHeight || vh;
      const k = Math.max(cw / vw, ch / vh), w = Math.min(vw, cw / k) / digital, h = Math.min(vh, ch / k) / digital;
      return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
    },
    capture(video, maxSide = 1280) {
      const r = camera.visibleRect(video), s = Math.min(1, maxSide / Math.max(r.w, r.h));
      const c = document.createElement('canvas'); c.width = Math.round(r.w * s); c.height = Math.round(r.h * s);
      c.getContext('2d').drawImage(video, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      return c; // stays in memory only
    },
    close(video) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null; digital = 1; if (video) { video.pause && video.pause(); video.srcObject = null; video.style.transform = ''; }
    },
    isOpen: () => !!stream,
    // map browser errors to player-facing explanations
    describe(e) {
      const kind = e && (e.kind || ({ NotAllowedError: 'denied', SecurityError: 'denied', NotFoundError: 'none', OverconstrainedError: 'none', NotReadableError: 'busy', AbortError: 'busy', TimeoutError: 'timeout' })[e.name]) || 'unknown';
      const text = {
        denied: ['Camera permission is off', 'SNAPMON needs the camera to find monsters. Allow camera access for this site (tap the lock icon next to the address, then Permissions → Camera), then try again.'],
        none: ['No camera found', 'This device does not seem to have a usable camera.'],
        busy: ['Camera is busy', 'Another app is using the camera. Close it and try again.'],
        timeout: ['Camera did not start', 'The camera took too long to start. Try again.'],
        insecure: ['Camera needs a secure page', 'Open SNAPMON from its https:// address to use the camera.'],
        unsupported: ['Camera not supported here', 'This browser cannot open a live camera. Use a recent version of Chrome on Android.'],
        unknown: ['Camera problem', 'The camera could not be opened. Try again.'],
      }[kind];
      return { kind, title: text[0], text: text[1] };
    },
  };

  /* ---------- storage ---------- */
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } },
    remove(key) { try { localStorage.removeItem(key); return true; } catch (e) { return false; } },
  };

  /* ---------- packaged assets ----------
     Every model, vocabulary and runtime file is addressed relative to one base. On GitHub Pages that is the site
     itself; a native build (Capacitor) sets window.SNAPMON_ASSET_BASE before the scripts load, e.g. to the APK's
     bundled asset folder, so the same code loads the same files from the app package instead of the network. */
  const assets = {
    base: (typeof window !== 'undefined' && window.SNAPMON_ASSET_BASE) || '',
    url(path) { return new URL(assets.base + path, location.href).href; },
  };

  /* ---------- device capabilities ---------- */
  const device = {
    online: () => navigator.onLine !== false,
    webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } },
    webgpu: () => !!navigator.gpu,
    wasm: () => typeof WebAssembly === 'object',
  };

  return { name: 'web', camera, storage, device, assets };
})();
