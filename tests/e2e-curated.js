// Pilot 02 integration in the real page (phone viewport 412 px): a save made by the previous build (generated names)
// is refreshed on load: the Captured grid, the monster sheet (also Spectral, Mutated, Shiny and a nicknamed one), the
// encyclopedia and a battle show the reviewed names, text and move names; stats, levels and nicknames stay; the
// untouched save is backed up once; reloading changes nothing; the longest Legendary names fit on screen.
// Usage: node tests/e2e-curated.js <url> <screenshot-dir>
const { chromium } = require('playwright');
const fs = require('fs'), vm = require('vm'), path = require('path');
const [url, outDir] = process.argv.slice(2);
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

// the old save, generated the way v0.4.7 did it for these objects (no Pilot 02 content)
const ctx = { console, Math, JSON, Date, btoa: x => Buffer.from(x, 'binary').toString('base64'), atob: x => Buffer.from(x, 'base64').toString('binary'), escape, unescape }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + ';globalThis.T={createMonster,freshState,recordSighting,setRNG:f=>{RNG=f}}', ctx);
const T = ctx.T, P02 = require('../content/curated/pilot-02-approved.json').entries;
const longest = Object.keys(P02).sort((a, b) => P02[b].names.legendary.length - P02[a].names.legendary.length).slice(0, 2); // longest Legendary names
const picks = [['toaster', 'legendary', 'shiny'], ['dog', 'epic', 'spectral'], ['umbrella', 'rare', 'mutated'], ['banana', 'common', null], ['apple', 'legendary', null], ['mug', 'rare', null], ...longest.map(id => [id, 'legendary', null])];
const S0 = T.freshState(); S0.level = 12; S0.coins = 777; let n = 0;
for (const [obj, rarity, variant] of picks) { let s = 7 + n; T.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; }); const m = T.createMonster(S0, { obj, rarity, variant, word: obj }); m.id = 'm' + (++n); m.level = 10 + n; S0.monsters.push(m); T.recordSighting(S0, m); }
S0.monsters[1].nick = 'Biscuit';
S0.settings = { ...S0.settings, engineCached: true, seenEngineNotice: true, guideSeen: true };
const RAW = JSON.stringify(S0);

(async () => {
  const b = await chromium.launch();
  const bctx = await b.newContext({ viewport: { width: 412, height: 870 }, isMobile: true, hasTouch: true });
  await bctx.route(/\/vendor\/|\/models\/|cdn\.jsdelivr|tfhub|googleapis/, r => r.abort());
  await bctx.addInitScript(raw => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('snapmon.save.v1', raw); sessionStorage.setItem('seeded', '1'); } }, RAW);
  const p = await bctx.newPage();
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
  const shot = nm => p.screenshot({ path: `${outDir}/${nm}.png` });
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__snapmon.S)));
  const sheetFits = () => p.evaluate(() => { const h = document.querySelector('.sheet .sheet-head h2'), c = document.querySelector('.sheet .sheet-head [data-act="closeSheet"]'), hr = h.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return { text: h.textContent, fits: hr.right <= cr.left + 1 && hr.left >= 0 && document.documentElement.scrollWidth <= window.innerWidth && h.scrollWidth <= h.clientWidth + 1 }; });
  await p.goto(url); await p.waitForTimeout(600);

  /* 1) the save was refreshed once, backed up, nothing else changed */
  const s1 = await S(), backup = await p.evaluate(() => localStorage.getItem('snapmon.save.v1.backup.precurated'));
  const rev = await p.evaluate(() => CURATED.revision);
  ok(backup === RAW, 'the untouched save is backed up before the refresh');
  ok(s1.curatedRev === rev, `the save is refreshed to content revision ${rev}`);
  ok(s1.monsters.every((m, i) => m.level === S0.monsters[i].level && JSON.stringify(m.stats) === JSON.stringify(S0.monsters[i].stats) && m.rarity === S0.monsters[i].rarity && m.variant === S0.monsters[i].variant && JSON.stringify(m.dna) === JSON.stringify(S0.monsters[i].dna)) && s1.coins === 777 && s1.level === 12, 'levels, stats, rarity, variants, colours/DNA, coins and hunter level unchanged');
  ok(s1.monsters[1].nick === 'Biscuit', 'nickname kept');
  const named = s1.monsters.filter(m => P02[m.obj]);
  ok(named.every(m => m.name === P02[m.obj].names[m.rarity] && m.lore === P02[m.obj].lore[m.rarity]), `Pilot 02 monsters renamed: ${named.map(m => m.name).join(', ')}`);
  ok(s1.monsters[4].name === S0.monsters[4].name && s1.monsters[5].name === S0.monsters[5].name, `Pilot 01 apple keeps "${s1.monsters[4].name}"; mug keeps "${s1.monsters[5].name}"`);

  /* 2) Captured grid and monster sheets */
  await p.click('[data-act="tab"][data-arg="dex"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__snapmon.ui.dexView = 'captured'; window.__snapmon.render(); }); await p.waitForTimeout(300);
  const cards = await p.$$eval('.mgrid [data-act="mon"] .nm', els => els.map(e => e.textContent));
  ok(cards.some(t => t.includes(P02.toaster.names.legendary)) && cards.some(t => t.includes('Biscuit')), `Captured grid shows the curated names and nickname (${cards.length} cards)`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Captured grid: no horizontal overflow at 412 px');
  await shot('C01-captured');
  for (const [i, nm] of [[0, 'C02-shiny-legendary-toaster'], [1, 'C03-spectral-dog-nickname'], [2, 'C04-mutated-umbrella'], [6, 'C05-longest-legendary'], [7, 'C06-second-longest-legendary']]) {
    if (!s1.monsters[i]) continue;
    await p.evaluate(id => window.__snapmon.actions.mon(id), s1.monsters[i].id); await p.waitForSelector('.sheet .sheet-head h2'); await p.waitForTimeout(250);
    const f = await sheetFits(), body = await p.$eval('.sheet', e => e.textContent), m = s1.monsters[i];
    ok(f.fits && f.text === (m.nick || m.name) && body.includes(m.lore) && m.abilities.every(a => body.includes(a.name)) && (!m.nick || body.includes(m.name)), `monster sheet ${m.obj}/${m.rarity}/${m.variant || 'normal'}: "${f.text}" fits, curated text and moves shown`);
    await shot(nm); await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(200);
  }

  /* 3) encyclopedia */
  await p.evaluate(() => { window.__snapmon.ui.dexView = 'encyclopedia'; window.__snapmon.render(); }); await p.waitForTimeout(300);
  await p.evaluate(() => window.__snapmon.actions.species('o:toaster')); await p.waitForSelector('.sheet .sheet-head h2'); await p.waitForTimeout(250);
  const dex = await p.$eval('.sheet', e => e.textContent);
  ok(dex.includes(P02.toaster.names.legendary) && dex.includes(P02.toaster.lore.legendary), `encyclopedia: toaster shows "${P02.toaster.names.legendary}" and its Legendary text`);
  await shot('C07-encyclopedia-toaster'); await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(200);
  await p.evaluate(id => window.__snapmon.actions.species('o:' + id), longest[0]); await p.waitForSelector('.sheet .sheet-head h2'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `encyclopedia: ${longest[0]} (longest Legendary name) without horizontal overflow`);
  await shot('C08-encyclopedia-longest'); await p.click('.sheet [data-act="closeSheet"]'); await p.waitForTimeout(200);

  /* 4) battle header: the longest name part shown there (text before a comma) among all Pilot 02 names */
  const seg = Object.entries(P02).flatMap(([id, e]) => Object.entries(e.names).map(([r, nm]) => ({ id, r, nm, s: nm.split(',')[0] }))).sort((x, y) => y.s.length - x.s.length)[0];
  await p.evaluate(({ id, r }) => { let s = 3; window.__snapmon.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; }); startBattle(createMonster(window.__snapmon.S, { obj: id, rarity: r, word: id })); }, seg);
  await p.waitForSelector('.hp-card.foe-card .nm span'); await p.waitForTimeout(400);
  const hdr = await p.evaluate(() => { const e = document.querySelector('.hp-card.foe-card .nm span'), card = e.closest('.hp-card').getBoundingClientRect(), r = e.getBoundingClientRect();
    const inside = [...e.closest('.hp-card').querySelectorAll('*')].every(x => x.getBoundingClientRect().right <= card.right + 1); // name, chips and the HP bar stay inside the card
    return { t: e.textContent, ok: inside && r.right <= card.right + 1 && card.right <= window.innerWidth && document.documentElement.scrollWidth <= window.innerWidth, clipped: e.scrollWidth > e.clientWidth + 1 }; });
  ok(hdr.ok && hdr.t === seg.s, `battle header: "${hdr.t}" (${seg.r} ${seg.id}, longest shown name) and its HP bar stay inside the card at 412 px${hdr.clipped ? ' (shortened with an ellipsis)' : ' (shown in full)'}`);
  await shot('C09-battle-longest');
  await p.evaluate(() => { window.__snapmon.ui.battle = null; window.__snapmon.ui.busy = false; window.__snapmon.render(); });

  /* 5) reload: nothing more happens */
  await p.reload(); await p.waitForTimeout(600);
  const s2 = await S(), keys = await p.evaluate(() => Object.keys(localStorage).filter(k => /backup/.test(k)));
  ok(JSON.stringify(s2.monsters) === JSON.stringify(s1.monsters) && s2.curatedRev === rev, 'reload: same monsters, same revision (idempotent)');
  ok(keys.length === 1 && keys[0] === 'snapmon.save.v1.backup.precurated' && (await p.evaluate(() => localStorage.getItem('snapmon.save.v1.backup.precurated'))) === RAW, 'reload: still exactly one backup, untouched');

  await b.close();
  console.log(errors.length ? `\n${errors.length} PROBLEM(S)` : '\nALL CURATED BROWSER CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
