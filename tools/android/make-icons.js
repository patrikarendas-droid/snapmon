#!/usr/bin/env node
// Renders the Android launcher icons and splash images from the game's own icon.svg (pixel art, crisp scaling) into
// android-app/android/app/src/main/res. Run after icon.svg changes; the PNGs are committed. Placeholder-quality
// development artwork, not store graphics. Usage: node tools/android/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const RES = path.join(ROOT, 'android-app/android/app/src/main/res');
const BG = '#110d1b';
const svg = fs.readFileSync(path.join(ROOT, 'icon.svg'), 'utf8');
const art = svg.replace(/<rect width="16" height="16" rx="3" fill="#110d1b"\/>/, ''); // the monster without its tile
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage();
  async function render(file, w, h, body) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden">${body}</body></html>`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }
  const img = (s, size, extra = '') => `<img style="width:${size}px;height:${size}px;image-rendering:pixelated;${extra}" src="data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}">`;
  for (const [d, k] of Object.entries(DENS)) {
    const legacy = Math.round(48 * k), adaptive = Math.round(108 * k);
    await render(path.join(RES, `mipmap-${d}/ic_launcher.png`), legacy, legacy, img(svg, legacy));
    await render(path.join(RES, `mipmap-${d}/ic_launcher_round.png`), legacy, legacy, `<div style="width:${legacy}px;height:${legacy}px;border-radius:50%;overflow:hidden;background:${BG};display:grid;place-items:center">${img(art, Math.round(legacy * 0.8))}</div>`);
    // adaptive foreground: art inside the 66 dp safe zone of the 108 dp layer
    await render(path.join(RES, `mipmap-${d}/ic_launcher_foreground.png`), adaptive, adaptive, `<div style="width:${adaptive}px;height:${adaptive}px;display:grid;place-items:center">${img(art, Math.round(72 * k))}</div>`);
  }
  // splash (shown for a moment while the WebView starts): the icon on the game's background
  for (const f of fs.readdirSync(RES).filter(f => f.startsWith('drawable'))) {
    const p = path.join(RES, f, 'splash.png'); if (!fs.existsSync(p)) continue;
    const { w, h } = (() => { const buf = fs.readFileSync(p); return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; })();
    const s = Math.round(Math.min(w, h) * 0.3);
    await render(p, w, h, `<div style="width:${w}px;height:${h}px;background:${BG};display:grid;place-items:center">${img(svg, s)}</div>`);
  }
  fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
  await b.close();
  console.log('icons and splash images written to', path.relative(ROOT, RES));
})();
