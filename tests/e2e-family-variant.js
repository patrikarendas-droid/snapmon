// Browser test (real UI, phone widths 412 and 320 px): families vs variants and the special-variant sprite finish
// (2026-11-26).
//   • the owner's case: a Prismatic Common baby bottle (custom encounter) shows family Household — never "Mutated" —
//     and its Prismatic status on discovery, in battle (header + Intel), in the collection and on its detail sheet
//   • a save with monsters whose stored fam is 'spectral'/'mutated' (Spectral spoon, Mutated teddy, Normal book,
//     Prismatic baby bottle) shows only real families after a reload; the family filter lists exactly the six real
//     families (no Spectral / Mutated chip) in Captured and Encyclopedia, and filters by the real family
//   • variant sprites carry the vfx class (rim margin) and render at the same on-screen size as Normal ones;
//     Normal sprites have no vfx class
//   • no horizontal overflow at 320 px
// Usage: node tests/e2e-family-variant.js <url> <screenshot-dir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [url, outDir = 'shots'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const REAL = ['Organic', 'Mechanical', 'Elemental', 'Household', 'Food', 'Botanical'];

(async () => {
  const b = await chromium.launch();
  for (const width of [412, 320]) {
    const tag = `${width}px`;
    const ctx = await b.newContext({ viewport: { width, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: width === 412 ? 2 : 1 });
    await ctx.route(/\/models\/|\/vendor\/|tfhub\.dev|storage\.googleapis\.com|cdn\.jsdelivr\.net/, r => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${tag} page error: ` + e.message));
    await p.goto(url); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    const shot = async n => { if (width === 412) { await p.waitForTimeout(500); await p.screenshot({ path: path.join(outDir, n + '.png') }); } };
    const idle = () => p.waitForFunction(() => !window.__snapmon.ui.busy || !window.__snapmon.ui.battle, null, { timeout: 20000 });
    const noOverflow = () => p.evaluate(() => { const sh = document.querySelector('.sheet'); return document.documentElement.scrollWidth <= innerWidth + 1 && (!sh || sh.scrollWidth <= sh.clientWidth + 1); });

    // 0. a save as build 18 would have written it: stored fam 'mutated' / 'spectral' on several monsters
    await p.evaluate(() => {
      let s = 11; window.__snapmon.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; });
      const S = window.__snapmon.S; S.stats.photos = 12; S.stats.encounters = 6; S.level = 6; S.items.trap = 5; S.research = { ...S.research, analysis: 1 };
      const add = (obj, rarity, variant, id) => { const o = OBJECTS[obj]; const m = createMonster(S, { obj, cat: o.cat, rarity, variant, word: o.name, photo: null, first: false }); m.id = id; m.caughtAt = Date.now(); recordSighting(S, m); S.monsters.push(m); return m; };
      add('x_baby_bottle', 'common', 'shiny', 'fv1'); add('cutlery_spoon', 'rare', 'spectral', 'fv2'); add('teddy', 'uncommon', 'mutated', 'fv3'); add('book', 'common', null, 'fv4'); add('mug', 'common', null, 'fv5');
      S.settings.devUnlocked = true; S.settings.devOpen = true; persist(true);
    });
    await p.reload(); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    const stored = await p.evaluate(() => window.__snapmon.S.monsters.map(m => m.fam));
    ok(stored.join() === 'mutated,spectral,mutated,spectral,food', `${tag}: test save holds build-18-style stored natures (${stored.join(', ')})`);

    // 1. discovery of the owner's case through the custom encounter
    await p.click('[data-act="settings"]'); await p.waitForSelector('#devObjInput');
    await p.fill('#devObjInput', 'x_baby_bottle'); await p.selectOption('#devRarity', 'common'); await p.selectOption('#devVariant', 'prismatic');
    await p.click('[data-act="devSpawn"]'); await p.waitForSelector('[data-act="fight"]');
    await p.waitForTimeout(1600); // reveal animation
    const disc = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#overlay .chip')].map(c => c.textContent.trim()), banner: document.querySelector('.rarity-banner').textContent, vfx: !!document.querySelector('.disc-sprite img.vfx'), sparks: document.querySelectorAll('.disc-sprite .spark.px4').length }));
    ok(/PRISMATIC/.test(disc.banner) && disc.chips.some(c => /Household/.test(c)) && !disc.chips.some(c => /Mutated|Spectral|Prismatic/.test(c)), `${tag}: discovery: banner "${disc.banner}", chips [${disc.chips.join(' | ')}] — family Household, never Mutated`);
    ok(disc.vfx && disc.sparks === 6, `${tag}: discovery sprite has the variant finish (vfx image, ${disc.sparks} pixel sparkles)`);
    await shot('family-discovery-prismatic-baby-bottle');
    ok(await noOverflow(), `${tag}: discovery fits the screen`);

    // 2. battle header and Intel sheet
    await p.click('[data-act="fight"]'); await p.waitForSelector('[data-act="bCapture"]'); await idle();
    const head = await p.evaluate(() => document.querySelector('.foe-card .row').textContent.replace(/\s+/g, ' ').trim());
    ok(/Household/.test(head) && /Prismatic/.test(head) && !/Mutated/.test(head), `${tag}: battle header "${head}"`);
    await shot('family-battle-header');
    ok(await noOverflow(), `${tag}: battle screen fits`);
    await p.click('[data-act="bInfo"]'); await p.waitForSelector('.sheet');
    const intel = await p.evaluate(() => ({ chips: [...document.querySelectorAll('.sheet .chip')].map(c => c.textContent.trim()), text: document.querySelector('.sheet').textContent }));
    ok(intel.chips.some(c => /Household/.test(c)) && intel.chips.some(c => /Prismatic/.test(c)) && !intel.chips.some(c => /Mutated/.test(c)) && /Weak to:/.test(intel.text), `${tag}: Intel sheet chips [${intel.chips.join(' | ')}], weaknesses still listed`);
    await p.click('.sheet [data-act="closeSheet"]');
    await p.evaluate(() => { const B = window.__snapmon.ui.battle; B.enemy.hp = 0; }); // end the battle quickly: flee
    await p.evaluate(() => { window.__snapmon.setRNG(() => 0.001); });
    await p.click('[data-act="bFlee"]').catch(() => {}); await idle();
    await p.click('[data-act="closeOverlay"]').catch(() => {});
    await p.evaluate(() => { if (window.__snapmon.ui.battle) { window.__snapmon.ui.battle = null; } document.querySelector('#overlay') && (document.querySelector('#overlay').innerHTML = ''); window.__snapmon.ui.overlay = null; window.__snapmon.render(); });

    // 3. collection: family chips, filter, sprites
    await p.click('[data-act="tab"][data-arg="dex"]'); await p.evaluate(() => window.__snapmon.actions.dexView('captured'));
    await p.waitForSelector('[data-act="fF"]');
    const chips = await p.$$eval('[data-act="fF"]', a => a.map(x => x.textContent.replace(/^\W+\s*/, '').trim()));
    ok(chips.join() === ['All families', ...REAL].join(), `${tag}: Captured family filter = ${chips.join(', ')} (no Spectral/Mutated)`);
    const sizes = await p.$$eval('.mcard img', a => a.map(i => ({ vfx: i.classList.contains('vfx'), w: i.getBoundingClientRect().width, nat: i.naturalWidth })));
    const nrm = sizes.filter(s => !s.vfx), vf = sizes.filter(s => s.vfx);
    ok(vf.length === 3 && nrm.length === 2 && vf.every(s => s.nat === 132) && nrm.every(s => s.nat === 120), `${tag}: 3 variant cards carry the rim margin (132 px image), 2 Normal cards unchanged (120 px)`);
    // on-screen monster size: a variant's 40-cell body spans 40/44 of its image, its on-screen box is scaled ×1.1 (getBoundingClientRect includes it) → same body size as a Normal image
    ok(vf.every(s => Math.abs(s.w * 40 / 44 - nrm[0].w) < 1.5), `${tag}: variant monsters are drawn at the same size as Normal ones in the collection`);
    await shot('family-captured-all');
    await p.click('[data-act="fF"][data-arg="household"]');
    const hh = await p.$$eval('.mcard[data-act="mon"]', a => a.map(x => x.dataset.arg).sort());
    ok(hh.join() === 'fv1,fv2,fv3,fv4', `${tag}: Household filter shows the baby bottle, Spectral spoon, Mutated teddy and book (${hh.join(', ')})`);
    await p.click('[data-act="fF"][data-arg="food"]');
    const ff = await p.$$eval('.mcard[data-act="mon"]', a => a.map(x => x.dataset.arg));
    ok(ff.join() === 'fv5', `${tag}: Food filter shows only the mug`);
    await p.click('[data-act="fF"][data-arg="all"]');
    ok(await noOverflow(), `${tag}: collection fits`);

    // 4. monster detail sheet of the baby bottle
    await p.click('.mcard[data-arg="fv1"]'); await p.waitForSelector('.sheet .chip');
    const det = await p.$$eval('.sheet .chip', a => a.map(x => x.textContent.trim()));
    ok(det.some(c => /Household/.test(c)) && det.some(c => /Prismatic/.test(c)) && !det.some(c => /Mutated|Spectral/.test(c)), `${tag}: detail sheet chips [${det.join(' | ')}]`);
    await shot('family-detail-baby-bottle');
    await p.click('.sheet [data-act="closeSheet"]');
    await p.click('.mcard[data-arg="fv2"]'); await p.waitForSelector('.sheet .chip');
    const det2 = await p.$$eval('.sheet .chip', a => a.map(x => x.textContent.trim()));
    ok(det2.some(c => /Household/.test(c)) && det2.some(c => c === 'Spectral') && !det2.some(c => /☾/.test(c)), `${tag}: Spectral spoon: family Household + variant chip "Spectral" [${det2.join(' | ')}]`);
    await shot('family-detail-spectral-spoon');
    await p.click('.sheet [data-act="closeSheet"]');

    // 5. encyclopedia
    await p.evaluate(() => window.__snapmon.actions.dexView('encyclopedia')); await p.waitForSelector('[data-act="species"]');
    const chips2 = await p.$$eval('[data-act="fF"]', a => a.map(x => x.textContent.replace(/^\W+\s*/, '').trim()));
    ok(chips2.join() === ['All families', ...REAL].join(), `${tag}: Encyclopedia family filter = real families only`);
    await shot('family-encyclopedia');
    await p.click('[data-act="fF"][data-arg="household"]');
    const ent = await p.$$eval('[data-act="species"]', a => a.map(x => x.dataset.arg).sort());
    ok(ent.length === 4 && ent.every(k => /baby_bottle|spoon|teddy|book/.test(k)), `${tag}: Encyclopedia Household filter: ${ent.join(', ')}`);
    await p.click('[data-act="species"][data-arg="o:x_baby_bottle"]'); await p.waitForSelector('.sheet .chip');
    const sp = await p.$$eval('.sheet .chip', a => a.map(x => x.textContent.trim()));
    ok(sp.some(c => /Household/.test(c)) && sp.some(c => /Prismatic/.test(c)) && !sp.some(c => /Mutated/.test(c)), `${tag}: encyclopedia entry chips [${sp.join(' | ')}]`);
    await p.click('.sheet [data-act="closeSheet"]');
    await p.click('[data-act="fF"][data-arg="all"]');

    // 6. an old UI filter value 'spectral' (e.g. left over in memory) falls back to all
    await p.evaluate(() => { window.__snapmon.ui.fF = 'spectral'; window.__snapmon.render(); });
    ok(await p.$eval('[data-act="fF"].on', x => x.dataset.arg) === 'all' && (await p.$$('[data-act="species"]')).length >= 5, `${tag}: a stale "Spectral" family filter shows everything`);
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? `\n${errors.length} FAILED` : '\nfamily/variant UI: all browser checks passed');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
