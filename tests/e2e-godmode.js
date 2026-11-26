// Developer God Mode (2026-11-26) in the real page: HP protection ONLY, in every real battle — a camera hunt (fake camera
// + stubbed recogniser) and a developer custom encounter. Checks: hidden until the developer section is unlocked; off by
// default; remembered after a reload; a Hunt-screen reminder and a battle indicator while on; against a very strong
// monster the hunter's HP never drops (hits and poison/burn are shown as BLOCKED; the monster still acts and applies
// statuses); NO free specials, items, traps or captures (empty bag and 0 energy stay disabled, a capture attempt uses a
// trap at the normal odds); the saved HP after the battle is not lower; switched off, the next battle takes damage.
// Usage: node tests/e2e-godmode.js <url> <ort-dist-dir> <screenshot-dir>
const { chromium } = require('playwright');
const path = require('path');
const cam = require('./fake-camera');
const [url, ortDir, outDir] = process.argv.slice(2);
const MODEL = path.join(__dirname, 'fixtures/testcolor-model');
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 870 }, isMobile: true, hasTouch: true });
  await ctx.route(/\/models\/manifest\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ engine: 'hybrid-1', groups: { lens: 32610304, clip: 43725619 }, files: [] }) }));
  await ctx.route(/\/models\/clip\/tinyclip-39m16\//, r => r.fulfill({ path: path.join(MODEL, r.request().url().split('/').pop()) }));
  await ctx.route(/\/vendor\/ort\//, r => r.fulfill({ path: path.join(ortDir, r.request().url().split('/').pop()) }));
  await ctx.route(/\/vendor\/tfjs\/|\/models\/(mobilenet|ssdlite)|cdn\.jsdelivr|tfhub|googleapis/, r => r.abort());
  await ctx.addInitScript(cam.init);
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
  const shot = n => p.screenshot({ path: `${outDir}/${n}.png` });
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));
  const waitText = (re, timeout = 10000) => p.waitForFunction(src => new RegExp(src).test(document.querySelector('#overlay').textContent), re.source, { timeout });
  const idle = () => p.waitForFunction(() => !window.__snapmon.ui.busy || !window.__snapmon.ui.battle, null, { timeout: 20000 });
  const setup = async obj => {
    await p.evaluate(obj => {
      Lens.load = async () => { Lens.status.state = 'ready'; Lens.status.backend = 'webgl'; return true; };
      Lens.recognize = async img => {
        const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').drawImage(img, 0, 0, 320, 240);
        return { decision: 'auto', reason: 'confident', candidates: [{ label: obj, obj, conf: 0.95, box: null, cat: OBJECTS[obj].cat, src: 'photo' }], image: c, boxes: [],
          debug: { decision: 'auto', reason: 'stub', thresholds: { min: .25, auto: .55, detMin: .45 }, times: { total: 3 }, sources: {}, backend: 'stub', full: [], detections: [], crops: [], candidates: [] } };
      };
    }, obj);
    await p.evaluate(async () => { window.__snapmon.S.settings.engineCached = true; await Engine.load(); });
  };
  const cameraEncounter = async () => {
    await p.evaluate(() => { const S = window.__snapmon.S; S.enc.disturbed = {}; S.enc.quiet = {}; window.__snapmon.setRNG(() => 0.01); }); // a fresh object, a sure encounter
    await cam.snap(p); await p.waitForSelector('text=Object identified'); await p.click('[data-act="pickCand"]'); await waitText(/Fight!/, 8000);
    await p.click('[data-act="fight"]'); await p.waitForSelector('#actions'); await idle();
  };
  const customEncounter = async () => {
    await p.click('[data-act="settings"]'); await p.waitForSelector('#devObjInput');
    await p.fill('#devObjInput', 'apple'); await p.selectOption('#devRarity', 'legendary'); await p.selectOption('#devVariant', 'normal');
    await p.click('[data-act="devSpawn"]'); await p.waitForSelector('[data-act="fight"]'); await p.click('[data-act="fight"]'); await p.waitForSelector('#actions'); await idle();
  };
  const godSwitch = () => p.$eval('[data-act="toggleGodMode"]', e => e.classList.contains('on'));
  // a monster ×25 stronger, very sturdy, that likes to poison/burn; record what the battle shows
  const brutalise = () => p.evaluate(() => {
    window.__snapmon.setRNG(Math.random);
    const B = window.__snapmon.ui.battle; B.enemy.atk *= 25; B.enemy.hp = B.enemy.maxHp = 99999; B.disp.enemy = 99999; B.hero.status.poison = { t: 9 }; B.hero.status.burn = { t: 9 };
    window.__seen = { floats: new Set(), st: new Set(), log: new Set(), hp: [] };
    new MutationObserver(() => { const l = document.querySelector('#blog'), h = document.querySelector('#hst'), t = document.querySelector('#hhpTxt');
      for (const f of document.querySelectorAll('.float')) window.__seen.floats.add(f.textContent);
      if (l) window.__seen.log.add(l.textContent); if (h) for (const c of h.querySelectorAll('.st')) window.__seen.st.add(c.textContent); if (t) window.__seen.hp.push(parseInt(t.textContent, 10)); })
      .observe(document.querySelector('#overlay'), { childList: true, subtree: true, characterData: true });
    return B.hero.hp;
  });
  await p.goto(url); await p.waitForTimeout(400);
  await setup('mug'); // the tiny test model behind the stub settles on a mug

  /* 1) the switch: hidden while locked, off by default, remembered, a Hunt-screen reminder while on */
  await p.click('[data-act="settings"]'); await p.waitForSelector('.sheet');
  ok(!(await p.$('[data-act="toggleGodMode"]')), 'God Mode is not offered while the developer section is locked');
  await p.click('.sheet [data-act="closeSheet"]');
  await p.evaluate(() => { const st = window.__snapmon.S.settings; st.devUnlocked = true; st.devOpen = true; st.godMode = true; }); // an old save's retired test-battle switch
  await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="toggleGodMode"]');
  ok(!(await godSwitch()) && !(await S()).settings.devGodMode, 'God Mode is off by default (an old save\'s retired test-battle switch does not count)');
  await p.$eval('[data-act="toggleGodMode"]', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(600);
  const scroll0 = await p.evaluate(() => document.querySelector('.sheet').scrollTop);
  await p.click('[data-act="toggleGodMode"]'); await p.waitForTimeout(400);
  ok(await godSwitch() && (await S()).settings.devGodMode === true && Math.abs(await p.evaluate(() => document.querySelector('.sheet').scrollTop) - scroll0) < 2, 'switched on in place (no jump in Settings)');
  await shot('G01-settings-god-on');
  await p.click('.sheet [data-act="closeSheet"]');
  await p.reload(); await p.waitForTimeout(500); await setup('mug');
  await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="toggleGodMode"]');
  ok(await godSwitch(), 'the switch is remembered after a reload');
  await p.click('.sheet [data-act="closeSheet"]');
  ok(/GOD MODE IS ON/.test(await p.textContent('#app')), 'the Hunt screen reminds you that God Mode is on');

  /* 2) a normal CAMERA hunt with God Mode on, an empty bag and 0 energy */
  await p.evaluate(() => { const S = window.__snapmon.S; S.items = { trap: 0 }; S.stats.photos = Math.max(S.stats.photos, 3); });
  await cameraEncounter();
  ok(await p.evaluate(() => godOn(window.__snapmon.ui.battle)) && (await p.$eval('#godBanner', e => e.textContent)) === 'GOD MODE · HP PROTECTED', 'camera hunt battle: God Mode active, "GOD MODE · HP PROTECTED" shown');
  await p.evaluate(() => { const B = window.__snapmon.ui.battle; B.hero.energy = 0; refreshActions(); });
  ok(await p.$eval('[data-act="bSpecial"]', e => e.disabled) && await p.$eval('[data-act="bCapture"]', e => e.disabled) && /0 traps/.test(await p.$eval('[data-act="bCapture"]', e => e.textContent)), 'no free specials or traps: Special disabled at 0 energy, Capture disabled with 0 traps');
  await p.click('[data-act="bItems"]'); await p.waitForSelector('[data-act="bUse"]');
  ok(await p.$$eval('[data-act="bUse"]', bs => bs.every(x => x.disabled)), 'no free items: with an empty bag every item is disabled');
  await p.click('.sheet [data-act="closeSheet"]');
  const hp0 = await brutalise();
  for (let i = 0; i < 10 && await p.evaluate(() => !!window.__snapmon.ui.battle); i++) { await p.click('[data-act="bAttack"]').catch(() => {}); await idle(); }
  const seen = await p.evaluate(() => ({ floats: [...window.__seen.floats], st: [...window.__seen.st], log: [...window.__seen.log], hp: window.__seen.hp }));
  const hpNow = await p.evaluate(() => window.__snapmon.ui.battle && window.__snapmon.ui.battle.hero.hp);
  ok(hpNow === hp0 && seen.hp.every(h => h >= hp0) && await p.evaluate(() => !window.__snapmon.ui.battle.over), `10 rounds against a ×25 monster with poison and burn: HP stayed ${hp0} (lowest shown ${Math.min(...seen.hp)})`);
  ok(seen.floats.includes('BLOCKED') && seen.log.some(l => /attacks!|uses /.test(l)) && seen.log.some(l => /God Mode blocks the (poison|burn) damage/.test(l)), 'enemy hits and damage ticks are shown as BLOCKED; the monster still attacks');
  ok(seen.st.length >= 1, `status chips are still shown (${seen.st.join(', ')})`);
  await p.click('[data-act="combatLog"]'); await p.waitForSelector('#clList');
  ok(/blocked by God Mode/.test(await p.textContent('#clList')) && /God Mode \(developer\)/.test(await p.textContent('#clList')), 'the combat log records the blocked damage');
  await shot('G02-god-battle-log'); await p.click('.sheet [data-act="closeSheet"]');
  await shot('G03-god-battle');
  // a capture attempt uses a real trap at the normal odds (not 100 %)
  await p.evaluate(() => { window.__snapmon.S.items.trap = 1; window.__snapmon.setRNG(() => 0.999); refreshActions(); });
  ok(!/100%/.test(await p.$eval('[data-act="bCapture"]', e => e.textContent)), `the capture odds are the normal ones ("${await p.$eval('[data-act="bCapture"] small', e => e.textContent)}")`);
  await p.click('[data-act="bCapture"]'); await idle();
  ok((await S()).items.trap === 0 && await p.evaluate(() => !!window.__snapmon.ui.battle && window.__snapmon.ui.battle.result !== 'captured'), 'a capture attempt used the Snap Trap and, with an unlucky roll, failed as usual');
  const savedBefore = (await S()).hp;
  for (let i = 0; i < 40 && await p.evaluate(() => !!window.__snapmon.ui.battle); i++) { await p.evaluate(() => window.__snapmon.setRNG(() => 0.001)); await p.click('[data-act="bFlee"]').catch(() => {}); await idle(); }
  await waitText(/Got away/, 15000);
  ok((await S()).hp >= savedBefore && (await S()).hp >= hp0, `after the battle the saved HP is not lower (${(await S()).hp})`);
  await p.click('[data-act="closeOverlay"]').catch(() => {});

  /* 3) a developer CUSTOM encounter with God Mode on */
  await customEncounter();
  const hp1 = await brutalise();
  for (let i = 0; i < 8 && await p.evaluate(() => !!window.__snapmon.ui.battle); i++) { await p.click('[data-act="bAttack"]').catch(() => {}); await idle(); }
  ok(await p.evaluate(h => window.__snapmon.ui.battle.hero.hp === h, hp1) && !!(await p.$('#godBanner')), `custom encounter: HP stayed ${hp1} against the same ×25 monster`);
  await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.ui.battle = null; window.__snapmon.render(); });

  /* 4) switched off: the next battle takes damage normally */
  await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="toggleGodMode"]'); await p.click('[data-act="toggleGodMode"]');
  ok(!(await godSwitch()) && (await S()).settings.devGodMode === false, 'switched off');
  await p.click('.sheet [data-act="closeSheet"]');
  ok(!/GOD MODE IS ON/.test(await p.textContent('#app')), 'the Hunt-screen reminder is gone');
  await customEncounter();
  const hp2 = await brutalise();
  for (let i = 0; i < 3 && await p.evaluate(() => !!window.__snapmon.ui.battle && !window.__snapmon.ui.battle.over); i++) { await p.click('[data-act="bAttack"]').catch(() => {}); await idle(); }
  ok(!(await p.$('#godBanner')) && await p.evaluate(h => !window.__snapmon.ui.battle || window.__snapmon.ui.battle.hero.hp < h || window.__snapmon.ui.battle.result === 'defeat', hp2), 'God Mode off: no indicator and the hunter takes damage again');

  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S)` : '\nALL GOD MODE BROWSER CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
