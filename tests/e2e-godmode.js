// Developer God Mode in the real page: the Settings switch and its state line, that it never touches a normal battle,
// that it only works in Quick Monster Test Mode with Instant capture off, the battle indicator, specials at 0 energy,
// traps/items with an EMPTY bag (the UI must not block them), survival against a very strong monster with its moves and
// statuses still shown, 100% capture into the test collection, the real save unchanged, and normal test battles again
// once it is switched off. Usage: node tests/e2e-godmode.js <url> <ort-dist-dir> <screenshot-dir>
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
  const roster = () => p.evaluate(() => TestRoster.list().length);
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
  const encounter = async () => { await cam.snap(p); await p.waitForSelector('text=Object identified'); await p.click('[data-act="pickCand"]'); await waitText(/Fight!|Test fight/, 8000); await p.click('[data-act="fight"]'); await p.waitForSelector('#actions'); await idle(); };
  const godText = () => p.$eval('#godState', e => e.textContent);
  await p.goto(url); await p.waitForTimeout(400);
  await setup('mug'); // the tiny test model behind the stub settles on a mug

  /* 1) the switch: off by default, explains when it is inactive, changes no other setting, no scroll jump */
  await p.evaluate(() => { window.__snapmon.S.settings.devUnlocked = true; window.__snapmon.S.settings.devOpen = true; });
  await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="toggleGodMode"]');
  ok(!(await p.$eval('[data-act="toggleGodMode"]', e => e.classList.contains('on'))) && await godText() === 'Off.', 'God Mode is off by default');
  await p.$eval('[data-act="toggleGodMode"]', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(800); // let any smooth scrolling finish
  const before = await S(), scroll0 = await p.evaluate(() => document.querySelector('.sheet').scrollTop);
  await p.click('[data-act="toggleGodMode"]'); await p.waitForTimeout(800);
  const after = await S(), scroll1 = await p.evaluate(() => document.querySelector('.sheet').scrollTop);
  ok(await godText() === 'On, but inactive: needs Quick Monster Test Mode on and Instant capture off.', `switched on with test mode off: "${await godText()}"`);
  ok(after.settings.quickTest === before.settings.quickTest && after.settings.instantCapture === before.settings.instantCapture && Math.abs(scroll1 - scroll0) < 2, 'switching it does not change the other test switches and does not move the Settings page');
  await shot('G01-settings-inactive');
  await p.click('.sheet [data-act="closeSheet"]');

  /* 2) a NORMAL battle with the God switch on: no God Mode at all */
  await p.evaluate(() => { const S = window.__snapmon.S; S.items.trap = 0; window.__snapmon.setRNG(() => 0.01); });
  await encounter();
  ok(await p.evaluate(() => !window.__snapmon.ui.battle.god && !godOn(window.__snapmon.ui.battle)) && !(await p.$('#godBanner')), 'normal battle: God Mode not active, no indicator');
  ok(await p.$eval('[data-act="bCapture"]', e => e.disabled) && /0 traps/.test(await p.$eval('[data-act="bCapture"]', e => e.textContent)), 'normal battle with 0 traps: Capture stays disabled as before');
  for (let i = 0; i < 30 && await p.evaluate(() => !!window.__snapmon.ui.battle); i++) { await p.evaluate(() => { const B = window.__snapmon.ui.battle; if (B) { B.enemy.hp = 1; B.disp.enemy = 1; } }); await p.click('[data-act="bAttack"]').catch(() => {}); await idle(); }
  await waitText(/Victory|defeated|won|escaped|Continue/i, 15000).catch(() => {});
  await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.ui.battle = null; window.__snapmon.render(); });

  /* 3) active only with Quick Monster Test Mode on AND Instant capture off; remembered after a reload */
  await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="toggleQuickTest"]');
  await p.click('[data-act="toggleQuickTest"]');
  ok(await godText() === 'On, but inactive: needs Instant capture off.', `test mode on, instant capture on: "${await godText()}"`);
  await p.click('[data-act="toggleInstantCapture"]');
  ok(await godText() === 'ACTIVE in test battles.', `test mode on, instant capture off: "${await godText()}"`);
  await p.$eval('[data-act="toggleGodMode"]', e => e.scrollIntoView({ block: 'center' })); await shot('G02-settings-active');
  await p.click('.sheet [data-act="closeSheet"]');
  await p.reload(); await p.waitForTimeout(500); await setup('mug'); // the tiny test model behind the stub settles on a mug
  await p.click('[data-act="settings"]'); await p.waitForSelector('#godState');
  ok(await godText() === 'ACTIVE in test battles.' && await p.$eval('[data-act="toggleGodMode"]', e => e.classList.contains('on')), 'the God Mode switch is remembered after a reload');
  await p.click('.sheet [data-act="closeSheet"]');

  /* 4) God Mode test battle with an EMPTY bag and 0 energy against a Pilot 01 Legendary */
  await p.evaluate(() => { const S = window.__snapmon.S; S.items = {}; S.settings.testOdds = undefined; window.__snapmon.setRNG(() => 0.999); }); // 0.999 -> Legendary in test odds
  const s0 = await S(), r0 = await roster();
  await encounter();
  const B0 = await p.evaluate(() => { const B = window.__snapmon.ui.battle; return { god: godOn(B), rarity: B.m.rarity, obj: B.m.obj, names: B.m.abilities.map(a => a.name) }; });
  ok(B0.god && (await p.$eval('#godBanner', e => e.textContent)) === 'GOD MODE · TEST BATTLE', `test battle: God Mode active with the "GOD MODE · TEST BATTLE" indicator (${B0.rarity} ${B0.obj}: ${B0.names.join(', ')})`);
  await p.waitForTimeout(1500); await shot('G03-god-battle');
  await p.evaluate(() => { window.__snapmon.setRNG(Math.random); const B = window.__snapmon.ui.battle; B.hero.energy = 0; B.enemy.atk *= 25; B.enemy.hp = B.enemy.maxHp = 99999; B.disp.enemy = 99999; refreshActions(); });
  ok(!(await p.$eval('[data-act="bSpecial"]', e => e.disabled)) && !(await p.$eval('[data-act="bCapture"]', e => e.disabled)), 'with 0 energy and 0 traps, Special and Capture are enabled');
  // collect what the battle shows: the log and the hunter's status chips
  await p.evaluate(() => { window.__seen = { log: new Set(), st: new Set(), minHp: Infinity }; new MutationObserver(() => { const l = document.querySelector('#blog'), h = document.querySelector('#hst'), t = document.querySelector('#hhpTxt'); if (l) window.__seen.log.add(l.textContent); if (h) for (const c of h.querySelectorAll('.st')) window.__seen.st.add(c.textContent); if (t) window.__seen.minHp = Math.min(window.__seen.minHp, parseInt(t.textContent, 10)); }).observe(document.querySelector('#overlay'), { childList: true, subtree: true, characterData: true }); });
  await p.click('[data-act="bSpecial"]'); await idle();
  const en = await p.evaluate(() => window.__snapmon.ui.battle.hero.energy);
  ok(en === 0, `the special cost no energy (energy now ${en})`);
  await p.click('[data-act="bItems"]'); await p.waitForSelector('[data-act="bUse"][data-arg="strength"]');
  ok(await p.$$eval('[data-act="bUse"]', bs => bs.every(x => !x.disabled)) && /not used up/.test(await p.$eval('.sheet', e => e.textContent)), 'Items: every item is usable with an empty bag');
  await p.click('[data-act="bUse"][data-arg="strength"]'); await idle();
  const afterItem = await p.evaluate(() => ({ st: Object.keys(window.__snapmon.ui.battle.hero.status), items: window.__snapmon.S.items }));
  ok(afterItem.st.includes('atkup') && JSON.stringify(afterItem.items) === '{}', 'Strength potion works (ATK↑) and nothing is taken from the bag');
  let minHp = Infinity;
  for (let i = 0; i < 12 && await p.evaluate(() => !!window.__snapmon.ui.battle); i++) { await p.click('[data-act="bAttack"]').catch(() => {}); await idle(); minHp = Math.min(minHp, await p.evaluate(() => window.__snapmon.ui.battle ? window.__snapmon.ui.battle.hero.hp : -1)); }
  const seen = await p.evaluate(() => ({ log: [...window.__seen.log], st: [...window.__seen.st], minHp: window.__seen.minHp }));
  minHp = Math.min(minHp, seen.minHp);
  const used = B0.names.filter(n => seen.log.some(l => l.includes(n)));
  ok(await p.evaluate(() => !!window.__snapmon.ui.battle && !window.__snapmon.ui.battle.over) && minHp >= 1, `12 rounds against a ×25-strength monster: still standing (lowest HP shown ${minHp})`);
  ok(seen.log.some(l => /attacks!|uses /.test(l)) && used.length >= 1, `the monster's attacks and move names are shown in the battle log (${used.join(', ')})`);
  ok(seen.st.length >= 1, `status chips are shown (${seen.st.join(', ')})`);
  await p.click('[data-act="bCapture"]'); await waitText(/Test capture/, 20000); await shot('G04-god-capture');
  ok(await roster() === r0 + 1, 'one capture attempt with 0 traps caught the full-HP monster; it went to the test collection');
  const s1 = await S(), strip = s => JSON.stringify({ ...s, lastTick: 0, settings: 0 });
  ok(strip(s1) === strip(s0) && JSON.stringify(s1.items) === '{}', 'the real save is exactly as before the test battle (HP, items, coins, XP, stats)');
  ok(await p.evaluate(() => !localStorage.getItem('snapmon.save.v1').includes('test-')), 'no test monster reaches the stored save');
  await p.click('[data-act="closeOverlay"]');

  /* 5) God Mode off again: test battles are normal (empty bag blocks capture, specials need energy) */
  await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="toggleGodMode"]'); await p.click('[data-act="toggleGodMode"]');
  ok(await godText() === 'Off.', 'switched off');
  await p.click('.sheet [data-act="closeSheet"]');
  await encounter();
  await p.evaluate(() => { const B = window.__snapmon.ui.battle; B.hero.energy = 0; refreshActions(); });
  ok(await p.evaluate(() => !godOn(window.__snapmon.ui.battle)) && !(await p.$('#godBanner')) && await p.$eval('[data-act="bCapture"]', e => e.disabled) && await p.$eval('[data-act="bSpecial"]', e => e.disabled), 'God Mode off: no indicator, Capture disabled with 0 traps, Special disabled at 0 energy');
  for (let i = 0; i < 30 && await p.evaluate(() => !!window.__snapmon.ui.battle); i++) { await p.evaluate(() => { const B = window.__snapmon.ui.battle; if (B) { B.enemy.hp = 1; B.disp.enemy = 1; } }); await p.click('[data-act="bAttack"]').catch(() => {}); await idle(); }
  await waitText(/Test battle over/, 15000);
  ok(await roster() === r0 + 1, 'a won (not captured) test battle adds nothing to the test collection');

  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S)` : '\nALL GOD MODE BROWSER CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
