// Layout regression: the fixed/sticky HUD (top bar) and the bottom tab bar must never cover page content or steal its
// taps, on every main tab and the common sub-pages, at several phone sizes and with Android status/navigation bar
// insets. Found on the owner's phone with the first Android app (build 9): the HUD covered the top of every screen
// (Gear's Arsenal / Bag / Shop & Craft row could not be tapped) because the sticky top bar was offset by the status
// bar height while the layout did not reserve that space.
//
// Usage: node tests/e2e-layout.js <url> <screenshot-dir> [--insets]
//   website (index.html):      insets are 0 in a browser tab (env() cannot be emulated) — checks the unchanged layout
//   Android packaged game (android-app/www/index.html) with --insets: also emulates Capacitor's --safe-area-inset-*
//   values (status bar 24/48 px, navigation bar 0/24/48 px), exactly what the app's SystemBars plugin injects.
// Checks per screen: the top bar starts below the status bar; at scroll 0 no content element lies under the top bar;
// every button / tappable element of the page can be scrolled into view and is then the element actually hit at its
// centre (not the HUD, the tab bar or anything else); the end of the page clears the tab bar; sheets stay below the
// status bar and their controls are hittable; a real tap on "Shop & Craft" opens the shop.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [url, outDir = 'shots'] = process.argv.slice(2);
const emulate = process.argv.includes('--insets');
fs.mkdirSync(outDir, { recursive: true });
const errors = [];
let checks = 0;
const ok = (c, msg) => { checks++; if (!c) { errors.push(msg); console.log('FAIL', msg); } };

const VIEWPORTS = [[360, 640], [412, 915], [600, 960]];
const INSETS = emulate ? [{ top: 0, bottom: 0 }, { top: 24, bottom: 24 }, { top: 48, bottom: 48 }, { top: 48, bottom: 0 }] : [{ top: 0, bottom: 0 }];

const { seed, checkScreens, SCREENS } = require('./layout-checks');

(async () => {
  const b = await chromium.launch();
  for (const [w, h] of VIEWPORTS) for (const ins of INSETS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('page error: ' + e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__snapmon && window.__snapmon.actions, null, { timeout: 20000 });
    await page.evaluate(ins => {
      if (ins.top || ins.bottom) for (const [k, v] of Object.entries({ top: ins.top, bottom: ins.bottom, left: 0, right: 0 })) document.documentElement.style.setProperty('--safe-area-inset-' + k, v + 'px');
    }, ins);
    await page.evaluate(seed);
    const tag = `${w}x${h} inset ${ins.top}/${ins.bottom}`;
    const shot = w === 412 && (ins.top === 48 || !emulate) ? name => page.screenshot({ path: path.join(outDir, `layout-${name}-${ins.top}.png`) }) : null;
    for (const [c, msg] of await checkScreens(page, tag, ins.top, 450, shot)) ok(c, msg);
    // the control found hidden on the phone: a real tap on "Shop & Craft" at scroll 0
    await page.evaluate(() => { window.__snapmon.actions.tab('gear'); window.__snapmon.actions.gearTab('arsenal'); window.scrollTo(0, 0); });
    await page.waitForTimeout(450);
    const shopBtn = await page.$('[data-act="gearTab"][data-arg="shop"]');
    const box = await shopBtn.boundingBox();
    const hud = await (await page.$('.topbar')).boundingBox();
    ok(box && box.y >= hud.y + hud.height - 0.5, `${tag}: "Shop & Craft" is below the HUD at scroll 0 (button ${box && Math.round(box.y)}, HUD bottom ${Math.round(hud.y + hud.height)})`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => window.__snapmon.ui.gearTab === 'shop'), `${tag}: tapping "Shop & Craft" at scroll 0 opens the shop`);
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? `\n${errors.length} of ${checks} layout checks FAILED` : `\nall ${checks} layout checks passed (${VIEWPORTS.length} sizes × ${INSETS.length} inset sets × ${SCREENS.length} screens)`);
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
