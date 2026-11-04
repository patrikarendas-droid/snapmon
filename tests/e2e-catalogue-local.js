// Developer catalogue browser smoke test WITHOUT Firebase (runs in CI): the Firebase CDN is blocked, as on a strict
// company network. Phone and desktop widths, all 2,308 objects, real sprites and writing, a local review that survives
// a reload, export → import, and the game's storage untouched. Cloud sync is covered by tests/e2e-catalogue.js
// (real SDK + Firebase emulators, run locally: docs/CATALOGUE.md).   node tests/e2e-catalogue-local.js <base-url> <outdir>
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const [base = 'http://localhost:8765/', out = '/tmp'] = process.argv.slice(2);
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch();
  for (const w of [412, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true });
    await ctx.route(/gstatic\.com/, r => r.abort());
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('snapmon.save.v1', 'SENTINEL'); sessionStorage.setItem('s', '1'); } });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
    await p.waitForFunction(() => /could not be loaded/.test(document.querySelector('#sync').textContent), null, { timeout: 20000 });
    ok(await p.textContent('#count') === '2308' && /Local only — NOT synced/.test(await p.textContent('#sync')), `${w}px: 2,308 objects; Firebase blocked → clearly "Local only — NOT synced"`);
    await p.fill('#q', 'kettle'); await p.waitForTimeout(300); await p.click('.row[data-id="kettle"]'); await p.waitForSelector('.rars canvas');
    const d = await p.evaluate(() => ({ n: document.querySelectorAll('.rars canvas').length, name: document.querySelector('.rname').textContent, rarity: __catalogue.UI.rarity, cur: CURATED.data.kettle.names, list: getComputedStyle(document.querySelector('#listwrap')).display, ov: document.documentElement.scrollWidth <= innerWidth }));
    ok(d.n === 5 && d.name === d.cur[d.rarity] && d.ov, `${w}px: kettle detail with 5 real sprites and its live name "${d.name}", no horizontal overflow`);
    ok(w < 980 ? d.list === 'none' : d.list !== 'none', `${w}px: ${w < 980 ? 'full-screen detail on the phone' : 'list and detail side by side on the desktop'}`);
    await p.click('[data-a="rar"][data-r="epic"]'); await p.click('.field[data-path="lore.epic"] [data-a="st"][data-s="fix"]');
    await p.fill('.field[data-path="lore.epic"] [data-k="note"]', 'needs a real consequence'); await p.waitForTimeout(900);
    await p.reload(); await p.waitForSelector('.row');
    const kept = await p.evaluate(() => __catalogue.Store.fields('kettle')['lore.epic']);
    ok(kept && kept.status === 'fix' && kept.note === 'needs a real consequence', `${w}px: review saved on this device survives a reload`);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-a="export"]')]); const file = path.join(out, `cat-local-${w}.json`); fs.copyFileSync(await dl.path(), file);
    const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
    ok(exp.objects.kettle.fields['lore.epic'].note === 'needs a real consequence' && exp.objects.kettle.source && /local only/.test(exp.syncedAccount), `${w}px: export holds the review with its source file and says it was local-only`);
    await p.evaluate(() => { localStorage.removeItem('snapmon-catalogue.v1.store.local'); }); await p.reload(); await p.waitForSelector('.row');
    await p.setInputFiles('#file', file); await p.waitForSelector('#dlg[open]'); await p.click('#dlg [data-i="0"]'); await p.waitForTimeout(300);
    ok((await p.evaluate(() => __catalogue.Store.fields('kettle')['lore.epic'].note)) === 'needs a real consequence', `${w}px: import restores the review`);
    ok(await p.evaluate(() => localStorage.getItem('snapmon.save.v1')) === 'SENTINEL' && !errs.length, `${w}px: game save untouched, no page errors${errs.length ? ': ' + errs[0] : ''}`);
    await p.screenshot({ path: path.join(out, `cat-local-${w}.png`) }); await ctx.close();
  }
  await b.close(); console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CATALOGUE LOCAL CHECKS PASSED'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
