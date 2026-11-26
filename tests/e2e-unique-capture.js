// Browser test (real UI) of the one-per-slot collection rule (object + rarity + variant).
//   • battle against a monster whose slot is already owned: the Capture button LOOKS unavailable (dimmed, dashed,
//     "Already owned", aria-disabled) but is not HTML-disabled; tapping it only shows a short explanation naming the
//     monster, rarity and variant — no trap, turn, roll, log entry, animation or save/battle change
//   • the duplicate can still be defeated for the normal rewards; it is never added to the collection
//   • another rarity / variant is capturable as usual; releasing the owned monster frees its slot
//   • the rule survives a reload; developer custom encounters follow it exactly like camera hunts
// Usage: node tests/e2e-unique-capture.js <url> <screenshot-dir>
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
    const idle = () => p.waitForFunction(() => !window.__snapmon.ui.busy, null, { timeout: 20000 });
    // a battle against a Common mouse of the given variant (rarity 'common' unless given); returns nothing
    const fight = (variant, rarity = 'common') => p.evaluate(([variant, rarity]) => {
      document.querySelector('#overlay').innerHTML = '';
      const S = window.__snapmon.S; const m = createMonster(S, { obj: 'mouse', rarity, variant, word: 'mouse' });
      m.stats.spd = 1; startBattle(m); }, [variant, rarity]);
    const capBtn = () => p.$eval('[data-act="bCapture"]', e => ({ cls: e.className, disabled: e.disabled, hasDisabledAttr: e.hasAttribute('disabled'), aria: e.getAttribute('aria-disabled'), label: e.getAttribute('aria-label') || '', small: e.querySelector('small').textContent, opacity: +getComputedStyle(e).opacity }));
    const state = () => p.evaluate(() => { const B = window.__snapmon.ui.battle; return JSON.stringify({ S: { ...window.__snapmon.S, lastTick: 0 }, B: { turn: B.turn, over: B.over, result: B.result, fails: B.captureFails, enemy: B.enemy, hero: B.hero, enh: B.enhancer }, log: (B.log && B.log.entries ? B.log.entries.length : JSON.stringify(B.log || '').length) }); });

    // a hunter that owns a Normal Common mouse
    await p.evaluate(() => { let s = 11; window.__snapmon.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; });
      const S = window.__snapmon.S; S.stats.photos = 6; S.stats.encounters = 3; S.level = 5; S.items.trap = 4; S.coins = 50;
      const m = createMonster(S, { obj: 'mouse', rarity: 'common', word: 'mouse' }); m.id = 'm' + (S.nextId++); m.caughtAt = Date.now(); m.level = 3; S.monsters.push(m); persist(true); });

    // 1. the duplicate: Capture looks unavailable but explains itself
    await fight(null); await p.waitForSelector('[data-act="bCapture"]'); await idle();
    let c = await capBtn();
    ok(/unavail/.test(c.cls) && !c.hasDisabledAttr && !c.disabled && c.aria === 'true', `${tag}: Capture is marked unavailable (aria-disabled) without the HTML disabled attribute`);
    ok(c.small === 'Already owned' && /already in your collection/i.test(c.label) && c.opacity < 0.6, `${tag}: it reads "Already owned", is dimmed (${c.opacity}) and has an accessible explanation`);
    ok(await p.evaluate(() => { const a = document.querySelector('#actions'); return a.scrollWidth <= a.clientWidth + 1; }), `${tag}: no overflow in the action buttons`);
    await shot('unique-capture-unavailable');
    const before = await state();
    const bb = await (await p.$('[data-act="bCapture"]')).boundingBox(); // a real finger tap (Playwright will not tap aria-disabled)
    await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await p.waitForSelector('#toasts .toast');
    const t = await p.$eval('#toasts .toast:last-child', e => e.textContent);
    const nm = await p.evaluate(() => window.__snapmon.ui.battle.enemy.name.split(',')[0]);
    ok(/already have a Normal Common/.test(t) && t.includes(nm) && /Defeat it for rewards, or flee/.test(t), `${tag}: tapping it explains the rule ("${t}")`);
    await shot('unique-capture-message');
    await p.waitForTimeout(300);
    ok(await state() === before, `${tag}: the tap uses no trap, turn or roll and changes neither save, battle nor combat log`);
    ok(await p.evaluate(() => !window.__snapmon.ui.busy && !document.querySelector('#arena .fx-trap, #arena .trap')), `${tag}: no trap animation, the hunter can still act`);
    await p.evaluate(() => { window.__snapmon.S.items.trap = 0; refreshActions(); });
    c = await capBtn();
    ok(/unavail/.test(c.cls) && c.small === 'Already owned' && !c.hasDisabledAttr, `${tag}: still "Already owned" (and tappable for the reason) when out of traps`);
    await p.evaluate(() => { window.__snapmon.S.items.trap = 4; refreshActions(); });
    // a direct capture call is refused by the game logic too
    ok(await p.evaluate(() => { const r = attemptCapture(window.__snapmon.ui.battle, window.__snapmon.S); return r.owned && !r.used && r.ev.length === 0; }), `${tag}: a direct attemptCapture call is refused by the game logic`);

    // 2. defeat the duplicate: normal victory and rewards, collection unchanged
    const coins0 = await p.evaluate(() => window.__snapmon.S.coins);
    await p.evaluate(() => { window.__snapmon.ui.battle.enemy.hp = 1; window.__snapmon.setRNG(() => 0.01); });
    await p.click('[data-act="bAttack"]');
    await p.waitForSelector('.result-title', { timeout: 20000 });
    const res = await p.evaluate(() => ({ title: document.querySelector('.result-title').textContent, n: window.__snapmon.S.monsters.length, coins: window.__snapmon.S.coins, saved: JSON.parse(localStorage.getItem('snapmon.save.v1')).monsters.length }));
    ok(res.title === 'Victory!' && res.n === 1 && res.saved === 1 && res.coins > coins0, `${tag}: defeating the duplicate is a normal Victory with rewards (+${res.coins - coins0} coins); still one mouse`);

    // 3. another variant and another rarity are capturable as usual
    for (const [v, r] of [['spectral', 'common'], [null, 'rare']]) {
      await fight(v, r); await p.waitForSelector('[data-act="bCapture"]'); await idle();
      c = await capBtn();
      ok(!/unavail/.test(c.cls) && !c.disabled && / traps · /.test(c.small), `${tag}: ${v || 'Normal'} ${r} mouse: Capture is available ("${c.small}")`);
      await p.evaluate(() => { window.__snapmon.ui.battle.enemy.hp = 1; window.__snapmon.setRNG(() => 0); });
      await p.click('[data-act="bCapture"]');
      await p.waitForSelector('.result-title', { timeout: 20000 });
      ok(await p.$eval('.result-title', e => e.textContent) === 'Captured!', `${tag}: ${v || 'Normal'} ${r} mouse captured`);
    }
    ok(await p.evaluate(() => window.__snapmon.S.monsters.length) === 3, `${tag}: three mice in three different slots`);

    // 4. the rule survives a reload
    await p.evaluate(() => persist(true)); await p.reload(); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    await fight('spectral'); await p.waitForSelector('[data-act="bCapture"]'); await idle();
    ok(/unavail/.test((await capBtn()).cls), `${tag}: after a reload the Spectral Common mouse is "Already owned"`);

    // 5. releasing frees exactly that slot
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.ui.battle = null; const S = window.__snapmon.S; const m = S.monsters.find(x => x.variant === 'spectral'); releaseMonster(S, m.id); });
    await fight('spectral'); await p.waitForSelector('[data-act="bCapture"]'); await idle();
    ok(!/unavail/.test((await capBtn()).cls), `${tag}: after releasing it, a Spectral Common mouse can be captured again`);
    await fight(null); await p.waitForSelector('[data-act="bCapture"]'); await idle();
    ok(/unavail/.test((await capBtn()).cls), `${tag}: the Normal Common slot is still owned`);

    // 6. a developer custom encounter of an owned slot (Settings → Developer & testing → Custom encounter) is refused too
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.ui.battle = null; const S = window.__snapmon.S; S.settings.devUnlocked = true; S.settings.devOpen = true; window.__snapmon.ui.devSel.obj = 'mouse'; window.__snapmon.ui.devSel.rarity = 'common'; window.__snapmon.ui.devSel.variant = 'normal'; });
    await p.click('[data-act="settings"]'); await p.waitForSelector('[data-act="devSpawn"]'); await p.click('[data-act="devSpawn"]');
    await p.waitForSelector('[data-act="fight"]'); await p.click('[data-act="fight"]'); await p.waitForSelector('[data-act="bCapture"]'); await idle();
    c = await capBtn();
    ok(/unavail/.test(c.cls) && c.small === 'Already owned', `${tag}: a custom encounter of the owned Normal Common mouse shows "Already owned"`);
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.ui.battle = null; });
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? `\n${errors.length} FAILED` : '\nunique collection slots: all browser checks passed');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
