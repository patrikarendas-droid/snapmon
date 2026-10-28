// End-to-end browser test of the core loop on a phone-sized viewport.
// Usage: node tests/e2e.js <url> <dir-with-test-images> <screenshot-dir>
const { chromium } = require('playwright');
const [url, imgDir, outDir] = process.argv.slice(2);
const errors = [];
const shot = (p, n) => p.screenshot({ path: `${outDir}/${n}.png` });
const ok = (c, msg) => { if (!c) { errors.push('ASSERT: ' + msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 870 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) { errors.push('console: ' + m.text()); console.log('CONSOLE', m.text()); } });
  await p.goto(url); await p.waitForTimeout(600);
  await shot(p, '01-hunt');
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));
  // Gameplay test: the lens result is stubbed (tests/e2e-lens.js covers real recognition).
  const fakeLens = (label, cat, sub = null, decision = 'auto') => p.evaluate(([label, cat, sub, decision]) => {
    Lens.status.state = 'ready'; Lens.load = async () => true;
    Lens.recognize = async img => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').drawImage(img, 0, 0, 320, 240);
      return { decision, reason: decision === 'auto' ? 'confident' : 'low', candidates: decision === 'unknown' ? [] : [{ label, cat, sub, conf: 0.91, box: null, src: 'photo' }], image: c,
        debug: { decision, reason: 'stub', thresholds: { min: .25, auto: .55, detMin: .45 }, times: { total: 1 }, sources: {}, backend: 'stub', full: [], detections: [], crops: [], candidates: [] } }; };
  }, [label, cat, sub, decision]);
  ok((await S()).items.potion === 3 && (await S()).items.trap === 5, 'starts with 3 potions and 5 traps');
  ok(await p.evaluate(() => document.body.scrollWidth <= window.innerWidth), 'no horizontal scroll on hunt');

  // 1) first photo -> identify -> guaranteed first encounter
  ok(!(await p.$('#objSearch')) && !(await p.$('#catGrid')), 'no manual object entry');
  await fakeLens('coffee mug', 'mug', 'mug');
  await p.setInputFiles('#camInput', `${imgDir}/red_mug.jpg`);
  await p.waitForSelector('text=Object identified'); await shot(p, '02-identified');
  await p.waitForSelector('text=Scanning for supernatural activity', { timeout: 4000 }); await p.waitForTimeout(300); await shot(p, '03-scanning');
  await p.waitForSelector('[data-act="fight"]', { timeout: 6000 }); await p.waitForTimeout(1500);
  await shot(p, '04-discovery');
  let st = await S();
  ok(st.stats.encounters === 1 && Object.keys(st.dex).length === 1, 'first photo produced an encounter + dex entry');
  ok(Object.values(st.dex)[0].cat === 'mug', 'monster generated from the chosen object (mug)');
  await p.click('[data-act="fight"]'); await p.waitForSelector('#actions'); await p.waitForTimeout(400);
  await shot(p, '05-battle');
  // use a potion mid-fight to verify items work
  await p.evaluate(() => { window.__snapmon.ui.battle.hero.hp = 20; window.__snapmon.ui.battle.disp.hero = 20; });
  await p.click('[data-act="bItems"]'); await p.waitForSelector('[data-act="bUse"][data-arg="potion"]'); await shot(p, '06-items');
  await p.click('[data-act="bUse"][data-arg="potion"]'); await p.waitForTimeout(200);
  await p.waitForFunction(() => !window.__snapmon.ui.busy, null, { timeout: 15000 });
  const hpAfter = await p.evaluate(() => window.__snapmon.ui.battle ? window.__snapmon.ui.battle.hero.hp : -1);
  ok(hpAfter > 20 || hpAfter === -1, 'healing potion restored HP in battle (hp=' + hpAfter + ')');
  ok((await S()).items.potion === 2, 'potion consumed');
  // attack until over
  for (let i = 0; i < 40; i++) {
    const over = await p.evaluate(() => !window.__snapmon.ui.battle);
    if (over) break;
    const sp = await p.$('[data-act="bSpecial"]:not([disabled])');
    await p.click(sp ? '[data-act="bSpecial"]' : '[data-act="bAttack"]');
    if (i === 1) { await p.waitForTimeout(250); await shot(p, '07-battle-fx'); }
    await p.waitForFunction(() => !window.__snapmon.ui.busy || !window.__snapmon.ui.battle, null, { timeout: 20000 });
  }
  await p.waitForSelector('.result-title', { timeout: 8000 }); await p.waitForTimeout(700);
  await shot(p, '08-result');
  st = await S();
  ok(st.stats.wins + st.stats.losses === 1, 'battle finished and recorded (wins=' + st.stats.wins + ')');
  ok(st.xp > 0 || st.level > 1 || st.stats.losses === 1, 'XP awarded');
  await p.click('button[data-act="closeOverlay"]');

  // 2) no-encounter path: force RNG high
  await p.evaluate(() => window.__snapmon.setRNG(() => 0.999));
  await fakeLens('running shoe', 'shoe', 'sneaker');
  await p.setInputFiles('#camInput', `${imgDir}/blue_thing.jpg`);
  await p.waitForSelector('text=Snap another object', { timeout: 6000 }); await p.waitForTimeout(200);
  await shot(p, '09-no-encounter');
  ok((await S()).enc.miss === 1, 'no-encounter increments hidden pity counter');
  await p.click('button[data-act="closeOverlay"]');

  // 2b) unrecognised photo: no scan, no monster
  const ph = (await S()).stats.photos;
  await fakeLens('', '', null, 'unknown');
  await p.setInputFiles('#camInput', `${imgDir}/blue_thing.jpg`);
  await p.waitForSelector('text=No supernatural signature detected.'); await shot(p, '09b-unknown');
  ok((await S()).stats.photos === ph && (await S()).stats.unrecognized === 1, 'unknown object is not hunted');
  await p.click('button[data-act="cancelPhoto"]');

  // 3) capture path: force low RNG (encounter + successful capture), weaken first
  await p.evaluate(() => window.__snapmon.setRNG(() => 0.01));
  const traps0 = (await S()).items.trap;
  await fakeLens('daisy', 'plant', 'flower');
  await p.setInputFiles('#galInput', `${imgDir}/green_plant.jpg`);
  await p.waitForSelector('[data-act="fight"]', { timeout: 6000 }); await p.waitForTimeout(1300);
  await shot(p, '10-discovery-2');
  await p.click('[data-act="fight"]'); await p.waitForSelector('#actions');
  await p.evaluate(() => { const B = window.__snapmon.ui.battle; B.enemy.hp = Math.ceil(B.enemy.maxHp * 0.2); B.disp.enemy = B.enemy.hp; });
  await p.click('[data-act="bCapture"]'); await p.waitForTimeout(900); await shot(p, '11-capture-anim');
  await p.waitForSelector('.result-title', { timeout: 15000 }); await p.waitForTimeout(600);
  await shot(p, '12-captured');
  st = await S();
  ok(st.monsters.length === 1 && st.items.trap === traps0 - 1, 'monster captured and trap consumed');
  ok(st.monsters[0].label === 'daisy' && st.monsters[0].dna.sub === 'flower', 'captured monster keeps the recognised object and its flower shape');
  await p.evaluate(() => window.__snapmon.setRNG(Math.random));
  await p.click('[data-act="viewNew"]'); await p.waitForTimeout(400); await shot(p, '13-monster-detail');
  await p.fill('#nickInput', 'Sir Leafington'); await p.click('[data-act="rename"]'); await p.waitForTimeout(200);
  ok((await S()).monsters[0].nick === 'Sir Leafington', 'rename works');
  await p.click('[data-act="buddy"]'); ok((await S()).companion === (await S()).monsters[0].id, 'set hunting buddy');
  await p.click('.sheet [data-act="closeSheet"]');

  // 4) persistence: reload
  await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(600);
  st = await S();
  ok(st.monsters.length === 1 && st.monsters[0].nick === 'Sir Leafington' && st.stats.photos === 3, 'progress restored after reload');
  const dnaBefore = st.monsters[0].dna;
  // 5) screens
  await p.click('[data-act="tab"][data-arg="dex"]'); await p.waitForTimeout(300); await shot(p, '14-dex');
  await p.click('[data-act="dexView"][data-arg="encyclopedia"]'); await p.waitForTimeout(300); await shot(p, '15-encyclopedia');
  ok(await p.evaluate(() => document.body.scrollWidth <= window.innerWidth), 'no horizontal scroll on encyclopedia');
  await p.click('[data-act="tab"][data-arg="gear"]'); await p.waitForTimeout(300); await shot(p, '16-gear');
  await p.click('[data-act="gearTab"][data-arg="shop"]'); await p.waitForTimeout(200);
  const coins0 = (await S()).coins; await p.click('[data-act="buy"][data-arg="potion"]');
  ok((await S()).coins === coins0 - 25, 'buying a potion costs 25 coins');
  await shot(p, '17-shop');
  await p.click('[data-act="tab"][data-arg="lab"]'); await p.waitForTimeout(300); await shot(p, '18-lab');
  const rp0 = (await S()).rp;
  if (rp0 >= 2) { await p.click('[data-act="research"][data-arg="analysis"]'); ok((await S()).research.analysis, 'research purchase works'); }
  await p.click('[data-act="labTab"][data-arg="quests"]'); await p.waitForTimeout(200); await shot(p, '19-quests');
  const claim = await p.$('[data-act="claim"]'); if (claim) { const c0 = (await S()).coins; await claim.click(); ok((await S()).coins >= c0, 'quest claimed'); }
  await p.click('[data-act="settings"]'); await p.waitForTimeout(300); await shot(p, '20-settings');
  const code = await p.inputValue('#exportBox');
  ok(code.startsWith('SNAPMON1:'), 'export code generated');
  await p.fill('#resetBox', 'RESET'); await p.click('[data-act="reset"]'); await p.waitForTimeout(200);
  ok((await S()).monsters.length === 0, 'reset clears progress');
  await p.click('[data-act="settings"]'); await p.fill('#importBox', code); await p.click('[data-act="importSave"]'); await p.waitForTimeout(200);
  st = await S();
  ok(st.monsters.length === 1 && JSON.stringify(st.monsters[0].dna) === JSON.stringify(dnaBefore), 'import restores monster with identical DNA');
  await p.click('[data-act="tab"][data-arg="hunt"]'); await p.waitForTimeout(300); await shot(p, '21-hunt-after');
  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S):\n` + errors.join('\n') : '\nALL CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
