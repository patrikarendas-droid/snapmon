// Browser test (real UI) of the combat log, the hunter name and the "Recently disturbed" screen.
//   • Settings: hunter name saved with the Save button (trimmed; empty/symbol-only rejected; markup shown as text),
//     survives a reload, appears on the battle card, in battle narration and the combat log
//   • battle: the "Log" button opens a sheet with every action so far; it updates while the battle animates, keeps the
//     player's scroll position when reviewing older rows, never lets taps reach the battle buttons below, closes with
//     Close or Android Back (SnapmonNav.back) and returns to the SAME battle; amounts are followed by their icon in the
//     effect's colour; no horizontal overflow at 320 px; the result screen offers "View combat log"
//   • a second scan of an object that just produced a monster shows "Recently disturbed" (no timer, no "angle")
// Usage: node tests/e2e-combat-log.js <url> <screenshot-dir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [url, outDir = 'shots'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  const b = await chromium.launch();
  for (const width of [412, 320]) {
    const tag = `${width}px`;
    const ctx = await b.newContext({ viewport: { width, height: 820 }, isMobile: true, hasTouch: true });
    await ctx.route(/\/models\/|\/vendor\/|tfhub\.dev|storage\.googleapis\.com|cdn\.jsdelivr\.net/, r => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('page error: ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    const shot = async n => { if (width === 412) { await p.waitForTimeout(450); await p.screenshot({ path: path.join(outDir, n + '.png') }); } };

    // 1. hunter name in Settings
    await p.evaluate(() => { const S = window.__snapmon.S; S.stats.photos = 4; S.stats.encounters = 1; window.__snapmon.actions.settings(); });
    await p.waitForSelector('#hunterNameInput');
    ok(await p.inputValue('#hunterNameInput') === 'Hunter', `${tag}: a save without a name shows "Hunter"`);
    await p.fill('#hunterNameInput', '   '); await p.click('[data-act="saveHunterName"]');
    ok(await p.evaluate(() => window.__snapmon.S.hunterName) === 'Hunter', `${tag}: an empty name is rejected`);
    await p.fill('#hunterNameInput', '<b>Bo</b> & "Al"'); await p.click('[data-act="saveHunterName"]');
    const stored = await p.evaluate(() => window.__snapmon.S.hunterName);
    ok(stored === 'bBo/b & "Al"', `${tag}: markup characters removed, the rest kept (${stored})`);
    await p.fill('#hunterNameInput', '  Alex  '); await p.click('[data-act="saveHunterName"]');
    ok(await p.evaluate(() => window.__snapmon.S.hunterName) === 'Alex', `${tag}: "  Alex  " saved as "Alex"`);
    await p.evaluate(() => persist(true)); await p.reload(); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    ok(await p.evaluate(() => window.__snapmon.S.hunterName) === 'Alex', `${tag}: the name survives a reload`);
    await p.evaluate(() => { window.__snapmon.actions.tab('gear'); });
    ok(/Alex · Level/.test(await p.evaluate(() => document.querySelector('#screen').innerText)), `${tag}: Gear shows "Alex · Level …"`);
    // markup in a name is displayed as text, never as HTML
    await p.evaluate(() => { window.__snapmon.S.hunterName = 'x"><img src=y onerror=window.__pwned=1>'; window.__snapmon.actions.tab('hunt'); window.__snapmon.actions.tab('gear'); });
    ok(await p.evaluate(() => !window.__pwned && !document.querySelector('#screen img[src="y"]')), `${tag}: a stored name with markup is never rendered as HTML`);
    await p.evaluate(() => { window.__snapmon.S.hunterName = 'Alex'; window.__snapmon.actions.tab('hunt'); });

    // 2. a battle with the combat log
    await p.evaluate(() => { let s = 7; window.__snapmon.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; });
      const S = window.__snapmon.S; S.weapons.hammer = 1; S.equipped = 'hammer'; S.items.potion = 3;
      const m = createMonster(S, { obj: 'mouse', rarity: 'rare', word: 'mouse' }); m.stats.hp = 900; startBattle(m); });
    await p.waitForSelector('[data-act="combatLog"]');
    ok(await p.evaluate(() => document.querySelector('.hero-card .nm span').textContent) === 'Alex', `${tag}: the battle card shows the hunter name`);
    await p.waitForFunction(() => !window.__snapmon.ui.busy, null, { timeout: 15000 });
    // open the log right after an action, while it animates
    await p.click('[data-act="bAttack"]');
    await p.click('[data-act="combatLog"]');
    await p.waitForSelector('#clList .cl-row');
    const n1 = await p.$$eval('#clList .cl-row', r => r.length);
    ok(n1 >= 2, `${tag}: the log opens during the animation (${n1} rows)`);
    await p.waitForFunction(() => !window.__snapmon.ui.busy, null, { timeout: 20000 });
    const n2 = await p.$$eval('#clList .cl-row', r => r.length);
    ok(n2 > n1, `${tag}: rows keep arriving while it is open (${n1} → ${n2})`);
    const txt = await p.$eval('#clList', e => e.innerText);
    ok(/Alex attacks with the Thunder Hammer/.test(txt) && /−\d+ HP/.test(txt) && !/\bYou\b|\bHunter\b(?! Sword)/.test(txt), `${tag}: rows name the hunter and show signed HP changes`);
    const fx = await p.$$eval('#clList .cl-fx', els => els.map(e => ({ text: e.textContent.trim(), color: getComputedStyle(e).color, iconAfterAmount: !!(e.firstChild && e.firstChild.nodeType === 3 && /[−+]\d+/.test(e.firstChild.textContent) && e.querySelector('svg')), svgColor: e.querySelector('svg') ? getComputedStyle(e.querySelector('svg')).color : '' })));
    const shockRow = fx.find(f => /Shock/.test(f.text));
    ok(shockRow && shockRow.iconAfterAmount && shockRow.color === shockRow.svgColor && shockRow.color === 'rgb(255, 229, 92)', `${tag}: "−N HP ⚡ Shock" — icon right after the amount, same Shock colour as the text`);
    ok(await p.evaluate(() => { const s = document.querySelector('#sheet .sheet'); return s.scrollWidth <= s.clientWidth + 1; }), `${tag}: no horizontal overflow in the log`);
    await shot('combatlog-open');
    // taps inside the log never reach the battle buttons below
    const turn0 = await p.evaluate(() => window.__snapmon.ui.battle.turn);
    const row = await (await p.$('#clList .cl-row')).boundingBox();
    await p.touchscreen.tap(row.x + row.width / 2, row.y + row.height / 2); await p.waitForTimeout(300);
    ok(await p.evaluate(t => window.__snapmon.ui.battle.turn === t && !!document.querySelector('#clList'), turn0), `${tag}: tapping a log row does nothing to the battle`);
    // reviewing older rows: new rows must not yank the view to the bottom
    await p.evaluate(() => { document.querySelector('#sheet .sheet').scrollTop = 0; });
    await p.evaluate(() => { const B = window.__snapmon.ui.battle; const ev = heroStrike(B, window.__snapmon.S, false); CombatLog.ingest(B, ev, { heroEnergy: 0 }); refreshCombatLog(); });
    ok(await p.evaluate(() => document.querySelector('#sheet .sheet').scrollTop) < 5, `${tag}: new rows keep the player's scroll position when reviewing older entries`);
    // Android Back closes the log and returns to the same battle
    const r = await p.evaluate(() => window.SnapmonNav.back());
    ok(r === 'handled' && !(await p.$('#clList')) && await p.evaluate(() => !!window.__snapmon.ui.battle && !!document.querySelector('#battleRoot')), `${tag}: Back closes the log, the battle continues`);
    ok(await p.evaluate(() => window.SnapmonNav.back()) === 'handled' && await p.evaluate(() => !!window.__snapmon.ui.battle), `${tag}: a second Back does not abandon the battle`);
    // finish the battle and open the log from the result screen
    await p.waitForFunction(() => !window.__snapmon.ui.busy, null, { timeout: 20000 });
    await p.evaluate(() => { window.__snapmon.ui.battle.enemy.hp = 1; window.__snapmon.setRNG(() => 0.01); });
    await p.click('[data-act="bAttack"]');
    await p.waitForSelector('.result-title', { timeout: 20000 });
    ok(!!(await p.$('[data-act="combatLog"]')), `${tag}: the result screen offers "View combat log"`);
    await p.click('[data-act="combatLog"]'); await p.waitForSelector('#clList');
    const endTxt = await p.$eval('#clList', e => e.innerText);
    ok(/Victory for Alex/.test(endTxt), `${tag}: the result-screen log ends with the victory`);
    await shot('combatlog-result');
    await p.click('.sheet [data-act="closeSheet"]');

    // 3. "Recently disturbed": the object that just produced a monster
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.setRNG(() => 0.001); Engine.ready = () => true;
      const S = window.__snapmon.S; S.enc.disturbed = {}; S.enc.quiet = {}; });
    const scanOnce = () => p.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').fillRect(0, 0, 320, 240);
      window.__snapmon.ui.pending = { rec: { decision: 'auto', reason: 'confident', candidates: [{ obj: 'mouse', label: 'mouse', cat: OBJECTS.mouse.cat, conf: .9, src: 'photo', box: null }], image: c, debug: { thresholds: { min: .25, auto: .55, detMin: .45 }, times: {}, sources: {}, full: [], detections: [], crops: [], candidates: [] } },
        img: c, hash: Math.floor(Math.random() * 2 ** 32).toString(16).padStart(16, '0'), url: c.toDataURL() };
      showIdentified(window.__snapmon.ui.pending, 0); window.__snapmon.actions.pickCand(0); });
    await scanOnce();
    await p.waitForFunction(() => /Fight|appeared|slip away/i.test(document.querySelector('#overlay').innerText), null, { timeout: 10000 });
    ok(await p.evaluate(() => !!window.__snapmon.S.enc.disturbed.mouse && JSON.parse(localStorage.getItem('snapmon.save.v1')).enc.disturbed.mouse), `${tag}: the encounter locks "mouse" and is saved immediately`);
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.ui.discovered = null; render(); });
    const before = await p.evaluate(() => JSON.stringify({ ...window.__snapmon.S, lastTick: 0 }));
    await scanOnce();
    await p.waitForFunction(() => /Recently disturbed/.test(document.querySelector('#overlay').innerText), null, { timeout: 10000 });
    const dt = await p.evaluate(() => document.querySelector('#overlay').innerText);
    ok(/Recently disturbed/.test(dt) && /Try another object/.test(dt) && !/\d|angle|hour|minute/i.test(dt.replace(/Snap another object|Back/g, '')), `${tag}: a rescan shows "Recently disturbed", no timer, no "angle"`);
    ok(await p.evaluate(() => JSON.stringify({ ...window.__snapmon.S, lastTick: 0 })) === before, `${tag}: the blocked rescan changes nothing in the save`);
    await shot('disturbed');
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? `\n${errors.length} FAILED` : '\ncombat log + hunter name + disturbed objects: all browser checks passed');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
