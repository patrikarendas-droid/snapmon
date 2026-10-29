// End-to-end browser test of the core loop on a phone-sized viewport.
// Usage: node tests/e2e.js <url> <dir-with-test-images> <screenshot-dir>
const { chromium } = require('playwright');
const cam = require('./fake-camera');
const [url, imgDir, outDir] = process.argv.slice(2);
const errors = [];
const shot = (p, n) => p.screenshot({ path: `${outDir}/${n}.png` });
const ok = (c, msg) => { if (!c) { errors.push('ASSERT: ' + msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 870 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  // the lens is stubbed in this test: keep the real model downloads (started in the background after a reload) out of it
  await ctx.route(/\/models\/|tfhub\.dev|kaggle|storage\.googleapis\.com|cdn\.jsdelivr\.net\/npm\/@tensorflow/, r => r.abort());
  const p = await ctx.newPage();
  await p.addInitScript(cam.init);
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) { errors.push('console: ' + m.text()); console.log('CONSOLE', m.text()); } });
  await p.goto(url); await p.waitForTimeout(600);
  await shot(p, '01-hunt');
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));
  // Gameplay test: the lens result is stubbed (tests/e2e-lens.js covers real recognition).
  const fakeLens = (label, obj, decision = 'auto') => p.evaluate(([label, obj, decision]) => {
    const cat = obj && OBJECTS[obj] ? OBJECTS[obj].cat : 'other';
    Lens.status.state = 'ready'; Lens.load = async () => true;
    Lens.recognize = async img => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').drawImage(img, 0, 0, 320, 240);
      return { decision, reason: decision === 'auto' ? 'confident' : 'low', candidates: decision === 'unknown' ? [] : [{ label, obj, cat, conf: 0.91, box: null, src: 'photo' }], image: c,
        debug: { decision, reason: 'stub', thresholds: { min: .25, auto: .55, detMin: .45 }, times: { total: 1 }, sources: {}, backend: 'stub', full: [], detections: [], crops: [], candidates: [] } }; };
  }, [label, obj, decision]);
  const snapPhoto = async file => { await cam.show(p, `${imgDir}/${file}`); await cam.snap(p); };
  ok((await S()).items.potion === 3 && (await S()).items.trap === 5, 'starts with 3 potions and 5 traps');
  ok(await p.evaluate(() => document.body.scrollWidth <= window.innerWidth), 'no horizontal scroll on hunt');

  // 1) first photo -> identify -> guaranteed first encounter
  ok(!(await p.$('#objSearch')) && !(await p.$('#catGrid')), 'no manual object entry');
  ok((await p.$$('input[type=file]')).length === 0, 'no file / gallery input anywhere');
  await fakeLens('coffee mug', 'mug');
  await p.evaluate(() => window.__snapmon.actions.openCamera());
  await p.waitForSelector('#camShutter:not([disabled])'); await p.waitForTimeout(300); await shot(p, '01b-camera');
  ok(await cam.live(p) === 1, 'camera starts only after the player taps SNAP');
  await p.click('#camShutter');
  await p.waitForSelector('text=Object identified'); await shot(p, '02-identified');
  ok(await cam.live(p) === 0, 'camera tracks stopped right after the shot');
  await p.waitForSelector('text=Scanning for supernatural activity', { timeout: 4000 }); await p.waitForTimeout(300); await shot(p, '03-scanning');
  await p.waitForSelector('[data-act="fight"]', { timeout: 6000 }); await p.waitForTimeout(1500);
  await shot(p, '04-discovery');
  let st = await S();
  ok(st.stats.encounters === 1 && Object.keys(st.dex).length === 1, 'first photo produced an encounter + dex entry');
  ok(Object.values(st.dex)[0].obj === 'mug', 'monster generated from the chosen object (mug)');
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
  await fakeLens('running shoe', 'sneaker');
  await snapPhoto('blue_thing.jpg');
  await p.waitForSelector('text=Snap another object', { timeout: 6000 }); await p.waitForTimeout(200);
  await shot(p, '09-no-encounter');
  ok((await S()).enc.miss === 1, 'no-encounter increments hidden pity counter');
  await p.click('button[data-act="closeOverlay"]');

  // 2b) unrecognised photo: no scan, no monster
  const ph = (await S()).stats.photos;
  await fakeLens('', null, 'unknown');
  await snapPhoto('blue_thing.jpg');
  await p.waitForSelector('text=Unknown object'); await shot(p, '09b-unknown');
  ok(!!(await p.$('[data-act="openCamera"]')) && (await p.$$('input[type=file]')).length === 0, 'unknown offers a retake, never a gallery or manual choice');
  ok((await S()).stats.photos === ph && (await S()).stats.unrecognized === 1, 'unknown object is not hunted');
  await p.click('button[data-act="cancelPhoto"]');

  // 3) capture path: force low RNG (encounter + successful capture), weaken first
  await p.evaluate(() => window.__snapmon.setRNG(() => 0.01));
  const traps0 = (await S()).items.trap;
  await fakeLens('forklift', 'forklift');
  await snapPhoto('green_plant.jpg');
  await p.waitForSelector('[data-act="fight"]', { timeout: 6000 }); await p.waitForTimeout(1300);
  await shot(p, '10-discovery-2');
  await p.click('[data-act="fight"]'); await p.waitForSelector('#actions');
  await p.evaluate(() => { const B = window.__snapmon.ui.battle; B.enemy.hp = Math.ceil(B.enemy.maxHp * 0.2); B.disp.enemy = B.enemy.hp; });
  await p.click('[data-act="bCapture"]'); await p.waitForTimeout(900); await shot(p, '11-capture-anim');
  await p.waitForSelector('.result-title', { timeout: 15000 }); await p.waitForTimeout(600);
  await shot(p, '12-captured');
  st = await S();
  ok(st.monsters.length === 1 && st.items.trap === traps0 - 1, 'monster captured and trap consumed');
  ok(st.monsters[0].obj === 'forklift' && st.monsters[0].dna.obj === 'forklift' && st.monsters[0].species === 'o:forklift', 'captured monster keeps the specific object (forklift), not a generic vehicle');
  await p.evaluate(() => window.__snapmon.setRNG(Math.random));
  await p.click('[data-act="viewNew"]'); await p.waitForTimeout(400); await shot(p, '13-monster-detail');
  ok(await p.$('text=Specific forklift design.'), 'monster sheet states the design tier honestly');
  await p.fill('#nickInput', 'Sir Leafington'); await p.click('[data-act="rename"]'); await p.waitForTimeout(200);
  ok((await S()).monsters[0].nick === 'Sir Leafington', 'rename works');
  await p.click('[data-act="buddy"]'); ok((await S()).companion === (await S()).monsters[0].id, 'set hunting buddy');
  await p.click('.sheet [data-act="closeSheet"]');

  // 3b) camera failures: explained, retry offered, never a gallery fallback
  await p.evaluate(() => { window.__cam.deny = 'NotAllowedError'; });
  await p.evaluate(() => window.__snapmon.actions.openCamera());
  await p.waitForSelector('text=Camera permission is off'); await shot(p, '13b-camera-denied');
  ok(!!(await p.$('[data-act="openCamera"]')) && (await p.$$('input[type=file]')).length === 0, 'camera denied -> retry button, no gallery fallback');
  await p.evaluate(() => { window.__cam.deny = 'NotReadableError'; });
  await p.click('[data-act="openCamera"]'); await p.waitForSelector('text=Camera is busy');
  ok(true, 'camera busy has its own message');
  await p.evaluate(() => { window.__cam.deny = null; });
  await p.click('[data-act="openCamera"]'); await p.waitForSelector('#camShutter:not([disabled])');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(200);
  ok(await cam.live(p) === 0 && !(await p.$('#camVideo')), 'leaving the app stops the camera');
  await p.evaluate(() => { delete document.hidden; });
  await p.evaluate(() => window.__snapmon.actions.openCamera()); await p.waitForSelector('#camShutter:not([disabled])');
  await p.click('[data-act="camClose"]'); await p.waitForTimeout(150);
  ok(await cam.live(p) === 0, 'closing the camera stops its tracks');

  // 3c) developer hybrid mode: production says coffeepot, the experimental lens says kettle -> the player chooses;
  //     field-test mode logs production alone, the experimental lens and the hybrid separately, and creates no monster
  await p.evaluate(() => {
    const S = window.__snapmon.S; S.settings.expLens = 'hybrid';
    ClipLens.status.state = 'ready'; ClipLens.status.meta = { labels: [], calib: { accept: { p: 0.35, margin: 0.15 }, heldOut: { accepted: 28, precision: 0.75 } } };
    ClipLens.status.info = { backend: 'stub', loadMs: 1, modelBytes: 0, vocabBytes: 0, name: 'stub' };
    ClipLens.recognize = async () => ({ regions: [{ box: null, cls: 'whole photo', best: { obj: 'kettle', label: 'electric kettle', p: 0.267 }, accepted: false, why: 'low score', calibrated: null,
      ranked: [{ obj: 'kettle', label: 'electric kettle', p: 0.267 }, { obj: 'teapot', label: 'coffeepot', p: 0.104 }], margin: 0.163 }], inferMs: 5, totalMs: 6, backend: 'stub' });
  });
  await fakeLens('coffeepot', 'teapot');
  await snapPhoto('red_mug.jpg');
  await p.waitForSelector('text=The lenses disagree'); await shot(p, '13c-lenses-disagree');
  const cands = await p.evaluate(() => window.__snapmon.ui.pending.rec.candidates.map(c => c.obj));
  ok(cands.join() === 'teapot,kettle', 'hybrid: lenses disagree -> choice between coffeepot and kettle (' + cands + ')');
  ok(!!(await p.$('text=second opinion')), "the experimental lens's suggestion shows no fake percentage");
  await p.click('[data-act="cancelPhoto"]');
  const enc0 = (await S()).stats.encounters;
  await p.evaluate(() => { window.__snapmon.S.settings.fieldTest = true; });
  await snapPhoto('red_mug.jpg');
  await p.waitForSelector('text=Hybrid result'); await shot(p, '13d-field-test');
  ok(!!(await p.$('text=auto (confident)')), "field test shows production's own decision, not the hybrid's");
  ok(!(await p.$('[data-arg="prod:rejected_ok"]')) && !!(await p.$('[data-arg="clip:missed_guess"]')), 'field test offers verdicts that match what each lens did');
  await p.click('[data-arg="prod:wrong"]'); await p.click('[data-arg="clip:missed_guess"]'); await p.click('[data-arg="hybrid:top3"]');
  await p.fill('#ftTruth', 'electric kettle'); await p.click('[data-act="ftSave"]'); await p.waitForTimeout(300);
  const log = await p.evaluate(() => JSON.parse(localStorage.getItem('snapmon.fieldtest.v1')));
  const e = log[log.length - 1];
  ok(e.v === 2 && e.prod.decision === 'auto' && e.prod.top[0].obj === 'teapot' && e.hybrid.decision === 'choose' && e.marks.hybrid === 'top3' && e.truth === 'electric kettle', 'field-test log keeps production alone, the hybrid result and the verdicts');
  ok((await S()).stats.encounters === enc0, 'field-test photos never create encounters');
  ok(await p.evaluate(() => ftNew().length) === 1, 'the field-test round counts as new results until it is copied out');
  await p.evaluate(() => { window.__snapmon.actions.camClose(); const S = window.__snapmon.S; S.settings.fieldTest = false; S.settings.expLens = 'off'; });
  await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; });

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
