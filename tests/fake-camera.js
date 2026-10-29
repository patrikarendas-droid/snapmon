// Test helper: replaces getUserMedia with a canvas stream that shows a chosen test photo, so the REAL camera path
// (Platform.camera.open → <video> → capture) runs in headless Chromium. Also records every track so tests can check
// that the camera is stopped after the shot.
module.exports = {
  init: () => {
    window.__cam = { tracks: [], img: null, deny: null, calls: 0 };
    const md = navigator.mediaDevices || (navigator.mediaDevices = {});
    md.getUserMedia = async constraints => {
      window.__cam.calls++;
      if (window.__cam.deny) { const e = new Error('denied'); e.name = window.__cam.deny; throw e; }
      const c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const ctx = c.getContext('2d');
      const draw = () => { ctx.fillStyle = '#556'; ctx.fillRect(0, 0, 640, 480); if (window.__cam.img) ctx.drawImage(window.__cam.img, 0, 0, 640, 480); };
      draw(); const iv = setInterval(draw, 100);
      const s = c.captureStream(15);
      s.getTracks().forEach(t => { window.__cam.tracks.push(t); const stop = t.stop.bind(t); t.stop = () => { clearInterval(iv); stop(); }; });
      return s;
    };
  },
  // load a local photo into the fake camera
  async show(page, file) {
    const data = 'data:image/jpeg;base64,' + require('fs').readFileSync(file).toString('base64');
    await page.evaluate(d => new Promise(r => { const i = new Image(); i.onload = () => { window.__cam.img = i; r(); }; i.src = d; }), data);
  },
  // open the camera from the hunt screen and take the shot
  async snap(page) {
    await page.evaluate(() => window.__snapmon.actions.openCamera());
    await page.waitForSelector('#camShutter:not([disabled])', { timeout: 15000 });
    await page.waitForFunction(() => { const v = document.querySelector('#camVideo'); return v && v.videoWidth > 0; }, null, { timeout: 15000 });
    await page.click('#camShutter');
  },
  live: page => page.evaluate(() => window.__cam.tracks.filter(t => t.readyState === 'live').length),
};
