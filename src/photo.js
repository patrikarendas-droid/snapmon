/* SNAPMON — real photo input, on-device colour/similarity analysis and the optional live viewfinder.
   Object recognition lives in lens.js.
   Photos never leave the device. Pixels are reduced to a colour signature + 64-bit similarity hash, then discarded
   (unless the player opts in to keeping small thumbnails). */
'use strict';

const Photo = (() => {
  function loadFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No photo was selected.'));
      if (file.type && !file.type.startsWith('image/')) return reject(new Error('That file is not an image.'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This photo format could not be read by the browser. Try JPEG or PNG.')); };
      img.src = url;
    });
  }

  // box: optional [x, y, w, h] as fractions of the image (a detected object). Colour is read from that region.
  function analyze(src, box) {
    const w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (box) {
      const bx = box[0] * w, by = box[1] * h, bw = Math.max(4, box[2] * w), bh = Math.max(4, box[3] * h);
      ctx.drawImage(src, bx + bw * 0.1, by + bh * 0.1, bw * 0.8, bh * 0.8, 0, 0, 64, 64);
    } else {
      // centre crop: the object being photographed is usually in the middle
      const side = Math.min(w, h) * 0.8, sx = (w - side) / 2, sy = (h - side) / 2;
      ctx.drawImage(src, sx, sy, side, side, 0, 0, 64, 64);
    }
    const d = ctx.getImageData(0, 0, 64, 64).data;
    const bins = new Array(24).fill(0); let sumS = 0, sumL = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
      const s = dd === 0 ? 0 : dd / (1 - Math.abs(2 * l - 1));
      let hh = 0;
      if (dd) { hh = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; hh *= 60; if (hh < 0) hh += 360; }
      if (s > 0.15 && l > 0.1 && l < 0.92) bins[Math.floor(hh / 15) % 24] += s;
      sumS += s; sumL += l; n++;
    }
    let best = 0; for (let i = 1; i < 24; i++) if (bins[i] > bins[best]) best = i;
    const hue = best * 15 + 7, sat = Math.min(1, sumS / n), lit = sumL / n;
    // average hash 8x8
    const c8 = document.createElement('canvas'); c8.width = 8; c8.height = 8;
    const x8 = c8.getContext('2d', { willReadFrequently: true }); x8.drawImage(c, 0, 0, 8, 8);
    const g8 = x8.getImageData(0, 0, 8, 8).data, gray = [];
    for (let i = 0; i < g8.length; i += 4) gray.push(g8[i] * 0.3 + g8[i + 1] * 0.59 + g8[i + 2] * 0.11);
    const avg = gray.reduce((a, b) => a + b, 0) / 64;
    let hash = '';
    for (let i = 0; i < 64; i += 4) hash += ((gray[i] > avg) << 3 | (gray[i + 1] > avg) << 2 | (gray[i + 2] > avg) << 1 | (gray[i + 3] > avg)).toString(16);
    const swatch = `hsl(${hue},${Math.round(Math.max(sat, 0.2) * 100)}%,${Math.round(Math.min(0.7, Math.max(0.3, lit)) * 100)}%)`;
    return { hue, sat: +sat.toFixed(3), lit: +lit.toFixed(3), hash, swatch };
  }

  function thumbnail(src, size = 96) {
    const w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const side = Math.min(w, h);
    c.getContext('2d').drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.6);
  }

  /* Live viewfinder (getUserMedia). Only opened on an explicit tap; stream is stopped as soon as the photo is taken or the viewfinder closes. */
  let stream = null;
  const live = {
    supported: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    async open(video) {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      video.srcObject = stream; video.setAttribute('playsinline', ''); video.muted = true;
      await video.play();
    },
    snap(video) {
      const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0); return c;
    },
    close(video) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null; if (video) video.srcObject = null;
    },
    attach(video) { if (stream && video) { video.srcObject = stream; video.play().catch(() => {}); } },
    isOpen: () => !!stream,
  };

  return { loadFile, analyze, thumbnail, live };
})();
