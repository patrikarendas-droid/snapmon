// Browser test (real UI, phone widths 412 and 320 px) of the developer tools in Settings → Developer & testing
// (2026-11-26): Custom encounter and Give items, working on the REAL save without a camera or the recognition engine.
//   • hidden until unlocked; object search by name, exact canonical ids, refusal of anything not exactly one object
//   • every rarity and variant; Prismatic = stored 'shiny', Normal = no variant
//   • Spawn encounter → the ordinary discovery screen → ordinary battle → capture with a real Snap Trap → the monster is
//     in the real collection (not a test monster) after a reload; victory gives the normal rewards
//   • repeated spawns of the same object; object locks untouched; no camera / engine download
//   • Give items: adds to the real bag, totals update, persists, bad quantities refused
//   • no horizontal overflow at 320 px
// Usage: node tests/e2e-devtools.js <url> <screenshot-dir>
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
    const net = [];
    await ctx.route(/\/models\/|\/vendor\/|tfhub\.dev|storage\.googleapis\.com|cdn\.jsdelivr\.net/, r => { net.push(r.request().url()); r.abort(); });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${tag} page error: ` + e.message));
    await p.goto(url); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    const shot = async n => { if (width === 412) { await p.waitForTimeout(400); await p.screenshot({ path: path.join(outDir, n + '.png') }); } };
    const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));
    const idle = () => p.waitForFunction(() => !window.__snapmon.ui.busy || !window.__snapmon.ui.battle, null, { timeout: 20000 });
    const toastText = async () => { await p.waitForSelector('#toasts .toast'); const t = await p.$$eval('#toasts .toast', a => a.map(x => x.textContent).pop()); await p.evaluate(() => { document.querySelector('#toasts').innerHTML = ''; }); return t; };
    const openSettings = async () => { await p.click('[data-act="settings"]'); await p.waitForSelector('.sheet'); };
    const noOverflow = () => p.evaluate(() => { const sh = document.querySelector('.sheet'); return document.documentElement.scrollWidth <= innerWidth + 1 && (!sh || sh.scrollWidth <= sh.clientWidth + 1); });

    // 0. a veteran hunter; tools hidden until unlocked
    await p.evaluate(() => { let s = 5; window.__snapmon.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; });
      const S = window.__snapmon.S; S.stats.photos = 10; S.stats.encounters = 4; S.level = 6; S.items.trap = 2; S.enc.disturbed = { mug: Date.now() + 3e6 }; persist(true); });
    await openSettings();
    ok(!(await p.$('[data-act="devSpawn"]')) && !(await p.$('[data-act="devGrant"]')) && !(await p.$('[data-act="toggleGodMode"]')), `${tag}: the developer tools are hidden until unlocked`);
    await p.click('.sheet [data-act="closeSheet"]');
    await p.evaluate(() => { window.__snapmon.S.settings.devUnlocked = true; window.__snapmon.S.settings.devOpen = true; });
    await openSettings(); await p.waitForSelector('#devObjInput');
    ok(await noOverflow(), `${tag}: the developer section fits the screen (no horizontal scroll)`);

    // 1. object search and validation
    await p.$eval('#devSpawnCard', e => e.scrollIntoView({ block: 'start' }));
    await p.fill('#devObjInput', 'light sw');
    await p.waitForSelector('[data-act="devPickObj"]');
    const picks = await p.$$eval('[data-act="devPickObj"]', a => a.map(x => x.dataset.arg));
    ok(picks.includes('x_light_switch') && picks.length <= 8, `${tag}: searching "light sw" lists matching objects (${picks.slice(0, 4).join(', ')})`);
    await shot('devtools-search');
    await p.click('[data-act="devPickObj"][data-arg="x_light_switch"]');
    ok(await p.inputValue('#devObjInput') === 'x_light_switch' && /Selected: .*x_light_switch/.test(await p.textContent('#devObjStatus')), `${tag}: picking a result fills in the exact canonical id`);
    for (const badId of ['no_such_object', 'light', 'kitchen', '__proto__']) {
      await p.fill('#devObjInput', badId); await p.click('[data-act="devSpawn"]');
      const t = await toastText();
      ok(/exact object/i.test(t) && !(await p.$('[data-act="fight"]')), `${tag}: "${badId}" is refused ("${t}") — nothing is substituted`);
    }
    await p.fill('#devObjInput', 'coffee MUG');
    ok(/Selected: Coffee mug · mug/.test(await p.textContent('#devObjStatus')), `${tag}: an exact display name in any letter case ("coffee MUG") resolves to its object (mug)`);

    // 2. every rarity × variant: the ordinary discovery screen, no camera, no engine
    const combos = [['common', 'normal', ''], ['uncommon', 'spectral', 'SPECTRAL'], ['rare', 'mutated', 'MUTATED'], ['epic', 'prismatic', 'PRISMATIC'], ['legendary', 'normal', '']];
    for (const [rar, vr, label] of combos) {
      if (!(await p.$('#devObjInput'))) { await openSettings(); await p.waitForSelector('#devObjInput'); }
      await p.fill('#devObjInput', 'mug'); await p.selectOption('#devRarity', rar); await p.selectOption('#devVariant', vr);
      await p.click('[data-act="devSpawn"]');
      await p.waitForSelector('[data-act="fight"]');
      const d = await p.evaluate(() => ({ m: window.__snapmon.ui.discovered, banner: document.querySelector('.rarity-banner').textContent, text: document.querySelector('#overlay').textContent, cam: !!document.querySelector('#camVideo') }));
      ok(d.m.obj === 'mug' && d.m.rarity === rar && d.m.variant === ({ normal: null, prismatic: 'shiny' }[vr] !== undefined ? { normal: null, prismatic: 'shiny' }[vr] : vr) && !('test' in d.m), `${tag}: ${rar} ${vr} mug → monster ${d.m.rarity}/${d.m.variant}, no test flag`);
      ok(d.banner.startsWith(rar.toUpperCase()) && (label ? d.banner.includes(label) : !d.banner.includes('·')) && /SUPERNATURAL ACTIVITY DETECTED/.test(d.text) && /Fight!/.test(d.text) && /Let it slip away/.test(d.text) && !d.cam && !/TEST/.test(d.text), `${tag}: the ordinary discovery screen ("${d.banner}")`);
      if (rar === 'epic') { await p.waitForTimeout(1200); await shot('devtools-discovery-prismatic'); } // after the 1.3 s silhouette reveal
      await p.click('[data-act="ignore"]'); await p.evaluate(() => { document.querySelector('#toasts').innerHTML = ''; });
    }
    const s1 = await S();
    ok(s1.dex['o:mug'] && s1.dex['o:mug'].seen === 5 && s1.dex['o:mug'].variants.shiny && s1.stats.encounters === 9, `${tag}: each spawn is recorded as a normal sighting (encyclopedia, counters)`);
    ok(s1.stats.photos === 10 && Object.keys(s1.enc.disturbed).join() === 'mug' && !Object.keys(s1.enc.quiet || {}).length, `${tag}: 5 spawns of a locked object: no photo counted, the lock neither reset nor extended, no new lock`);
    ok(!net.some(u => /models|vendor/.test(u)), `${tag}: no recognition model or runtime was requested`);

    // 3. ordinary battle → capture with a real trap → real collection, after reload
    await openSettings(); await p.waitForSelector('#devObjInput');
    await p.fill('#devObjInput', 'x_light_switch'); await p.selectOption('#devRarity', 'rare'); await p.selectOption('#devVariant', 'prismatic');
    await p.click('[data-act="devSpawn"]'); await p.waitForSelector('[data-act="fight"]'); await p.click('[data-act="fight"]');
    await p.waitForSelector('[data-act="bCapture"]'); await idle();
    ok(!(await p.$('#godBanner')) && /2 traps/.test(await p.$eval('[data-act="bCapture"]', e => e.textContent)), `${tag}: the ordinary battle screen (2 traps shown, no God Mode)`);
    let traps0 = (await S()).items.trap, caught = false;
    for (let i = 0; i < 6 && !caught; i++) {
      await p.evaluate(() => { const B = window.__snapmon.ui.battle; if (B) { B.enemy.hp = 1; B.disp.enemy = 1; B.enemy.stats = B.enemy.stats; } window.__snapmon.setRNG(() => 0.001); });
      if ((await S()).items.trap === 0) await p.evaluate(() => { window.__snapmon.S.items.trap = 1; });
      traps0 = (await S()).items.trap;
      await p.click('[data-act="bCapture"]'); await idle();
      caught = await p.evaluate(() => /Captured!/.test(document.querySelector('#overlay').textContent));
    }
    await p.waitForFunction(() => /Captured!/.test(document.querySelector('#overlay').textContent), null, { timeout: 15000 });
    let s2 = await S();
    const mine = s2.monsters.find(m => m.obj === 'x_light_switch');
    ok(caught && s2.items.trap === traps0 - 1, `${tag}: the capture used a real Snap Trap (${traps0} → ${s2.items.trap})`);
    ok(mine && mine.rarity === 'rare' && mine.variant === 'shiny' && /^m\d+$/.test(mine.id) && !mine.test, `${tag}: the Prismatic Rare light switch is in the real collection (${mine && mine.id})`);
    await shot('devtools-captured');
    await p.click('[data-act="closeOverlay"]').catch(() => {});
    await p.reload(); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    s2 = await S();
    ok(s2.monsters.some(m => m.obj === 'x_light_switch' && m.variant === 'shiny' && !m.test) && await p.evaluate(() => localStorage.getItem('snapmon.testroster.v1') === null), `${tag}: after a reload it is still in the collection; nothing went to the retired test roster`);

    // 4. the same slot again: "Already owned"; a victory gives the normal rewards
    await p.evaluate(() => { window.__snapmon.S.settings.devUnlocked = true; window.__snapmon.S.settings.devOpen = true; });
    await openSettings(); await p.waitForSelector('#devObjInput');
    await p.fill('#devObjInput', 'x_light_switch'); await p.selectOption('#devRarity', 'rare'); await p.selectOption('#devVariant', 'prismatic');
    await p.click('[data-act="devSpawn"]'); await p.waitForSelector('[data-act="fight"]'); await p.click('[data-act="fight"]');
    await p.waitForSelector('[data-act="bCapture"]'); await idle();
    ok(/Already owned/.test(await p.$eval('[data-act="bCapture"]', e => e.textContent)), `${tag}: a second spawn of the owned slot shows "Already owned"`);
    const xp0 = (await S()).xp, coins0 = (await S()).coins;
    for (let i = 0; i < 10 && await p.evaluate(() => !!window.__snapmon.ui.battle); i++) { await p.evaluate(() => { const B = window.__snapmon.ui.battle; if (B) { B.enemy.hp = 1; B.disp.enemy = 1; } window.__snapmon.setRNG(() => 0.5); }); await p.click('[data-act="bAttack"]').catch(() => {}); await idle(); }
    await p.waitForFunction(() => /Victory!/.test(document.querySelector('#overlay').textContent), null, { timeout: 15000 });
    const s3 = await S();
    ok(s3.xp !== xp0 || s3.level > s2.level, `${tag}: victory over a custom encounter gives XP`);
    ok(s3.coins > coins0 && s3.monsters.filter(m => m.obj === 'x_light_switch').length === 1, `${tag}: …and coins, and no second copy of the slot`);
    await p.click('[data-act="closeOverlay"]').catch(() => {});

    // 5. Give items
    await openSettings(); await p.waitForSelector('#devGrantCard');
    await p.$eval('#devGrantCard', e => e.scrollIntoView({ block: 'center' }));
    const t0 = (await S()).items.trap;
    await p.selectOption('#devItem', 'trap');
    ok((await p.textContent('#devStock')).includes(`You have ${t0} × Snap Trap`), `${tag}: the current Snap Trap count is shown (${t0})`);
    await p.fill('#devQty', '25'); await p.click('[data-act="devGrant"]');
    let t = await toastText();
    ok((await S()).items.trap === t0 + 25 && (await p.textContent('#devStock')).includes(`You have ${t0 + 25}`) && /Added 25/.test(t), `${tag}: +25 Snap Traps added to the real bag, total updated on screen ("${t}")`);
    await p.selectOption('#devItem', 'prism'); await p.fill('#devQty', '3'); const pr0 = (await S()).mats.prism || 0; await p.click('[data-act="devGrant"]'); await toastText();
    ok((await S()).mats.prism === pr0 + 3, `${tag}: materials too (Prism Shard ${pr0} → ${pr0 + 3})`);
    await shot('devtools-give-items');
    const before = JSON.stringify(await S());
    for (const q of ['0', '-5', '2.5', '1000', 'abc', '', '1e3']) { await p.fill('#devQty', q); await p.click('[data-act="devGrant"]'); const msg = await toastText(); if (!/whole number/.test(msg)) ok(false, `${tag}: quantity "${q}" should be refused (got "${msg}")`); }
    ok(JSON.stringify(await S()) === before, `${tag}: bad quantities (0, -5, 2.5, 1000, abc, empty, 1e3) are refused and change nothing`);
    ok(await noOverflow(), `${tag}: Give items fits the screen`);
    await p.click('.sheet [data-act="closeSheet"]');
    await p.reload(); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    ok((await S()).items.trap === t0 + 25 && (await S()).mats.prism === pr0 + 3, `${tag}: granted items persist after a reload`);
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? `\n${errors.length} FAILED` : '\ndeveloper tools: all browser checks passed');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
