// Android Back-button behaviour in the browser (History API): Back closes sheets, the camera (stopping its stream),
// photo flows and screens, never abandons a battle, and on the Hunt screen needs a second press within 2 s to leave.
// History must stay bounded (no loops), and game state must survive.
// Usage: node tests/e2e-nav.js <url> <screenshot-dir>
const { chromium } = require('playwright');
const cam = require('./fake-camera');
const [url, outDir] = process.argv.slice(2);
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 870 }, isMobile: true, hasTouch: true });
  await ctx.route(/\/models\/|\/vendor\/|tfhub|googleapis|jsdelivr/, r => r.abort());
  await ctx.addInitScript(cam.init);
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
  await p.goto('data:text/html,<title>previous page</title>previous page');
  await p.goto(url); await p.waitForTimeout(400);
  const back = async () => { await p.goBack({ waitUntil: 'commit', timeout: 3000 }).catch(() => {}); await p.waitForTimeout(250); };
  const onGame = async () => (await p.title()).includes('SNAPMON');
  const tap = sel => p.click(sel);
  const histLen = () => p.evaluate(() => history.length);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));

  // a sheet (settings) closes on Back
  await tap('[data-act="settings"]'); await p.waitForSelector('.sheet');
  await back();
  ok(await onGame() && !(await p.$('.sheet')), 'Back closes the settings sheet and stays in the game');

  // the camera closes on Back and its stream stops
  await p.evaluate(() => { window.__snapmon.S.settings.engineCached = true; Engine.load = async () => false; });
  await tap('[data-act="openCamera"]'); await p.waitForSelector('#camShutter:not([disabled])');
  ok(await cam.live(p) === 1, 'camera running');
  await back();
  ok(await onGame() && !(await p.$('#camVideo')) && await cam.live(p) === 0, 'Back closes the camera and stops its stream');

  // screens: collection -> Back -> hunt
  await tap('[data-act="tab"][data-arg="dex"]'); await p.waitForTimeout(150);
  await back();
  ok(await onGame() && await p.evaluate(() => window.__snapmon.ui.tab) === 'hunt', 'Back from the collection returns to the Hunt screen');
  await tap('[data-act="tab"][data-arg="gear"]'); await p.waitForTimeout(150); await tap('[data-act="tab"][data-arg="lab"]'); await p.waitForTimeout(150);
  await back();
  ok(await p.evaluate(() => window.__snapmon.ui.tab) === 'hunt', 'Back from the lab returns to the Hunt screen');

  // a battle is never abandoned by Back
  await p.evaluate(() => { const S = window.__snapmon.S; const m = createMonster(S, { obj: 'mug', cat: 'mug', rarity: 'common', first: true }); window.__snapmon.ui.discovered = m; window.__snapmon.actions.fight(); });
  await p.waitForSelector('#actions');
  const coins0 = (await S()).coins;
  await back();
  ok(await onGame() && await p.evaluate(() => !!window.__snapmon.ui.battle) && !!(await p.$('text=Finish the battle')), 'Back during a battle keeps the battle and explains how to leave');
  ok((await S()).coins === coins0, 'no game state lost or changed by Back');
  await p.evaluate(() => { const B = window.__snapmon.ui.battle; B.enemy.hp = 1; B.disp.enemy = 1; });
  for (let i = 0; i < 20 && await p.evaluate(() => !!window.__snapmon.ui.battle); i++) { await tap('[data-act="bAttack"]').catch(() => {}); await p.waitForFunction(() => !window.__snapmon.ui.busy || !window.__snapmon.ui.battle, null, { timeout: 15000 }); }
  await p.waitForSelector('.result-title', { timeout: 10000 });
  await back();
  ok(await onGame() && !(await p.$('.result-title')), 'Back closes the battle result screen');

  // history stays bounded after many Back presses
  const len0 = await histLen();
  for (let i = 0; i < 6; i++) { await tap('[data-act="settings"]'); await p.waitForSelector('.sheet'); await back(); }
  ok(await histLen() <= len0 + 1, `history does not grow with use (${len0} -> ${await histLen()})`);

  // double-Back to exit on the Hunt screen
  await p.waitForTimeout(2100); await tap('.vf-hud').catch(() => {}); // a tap re-arms the guard
  await back();
  ok(await onGame() && !!(await p.$('text=Press Back again to exit SnapMon.')), 'first Back on the Hunt screen shows the exit hint and stays');
  await p.screenshot({ path: `${outDir}/N01-exit-hint.png` });
  await p.waitForTimeout(2300); // too slow: the pending exit is cancelled
  await tap('.vf-hud').catch(() => {});
  await back();
  ok(await onGame(), 'a second Back after more than 2 s only shows the hint again');
  await back();
  ok(!(await onGame()), 'a second Back within 2 s leaves SNAPMON');
  await p.goForward({ waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(500);
  ok(await onGame() && (await S()).stats.wins + (await S()).stats.losses >= 1, 'Forward returns to the game with progress intact');
  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S)` : '\nALL NAVIGATION CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
