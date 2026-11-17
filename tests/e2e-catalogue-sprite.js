// Catalogue Sprite Review Mode (v0.5.4), in the browser (no Firebase; runs in CI). Starts from a store like the
// owner's: 2,254 objects with writing-only "Needs fix", a few existing sprite reviews and move reviews. Checks that
// sprite progress ignores writing fixes, mode switches never change data, sprite-only actions touch only `visual`,
// variant flags survive, Next unreviewed works, and "Export sprite fixes" lists exactly the flagged sprite fields.
//   node tests/e2e-catalogue-sprite.js <base-url> <outdir>
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const [base = 'http://localhost:8765/', out = '/tmp'] = process.argv.slice(2);
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const F = (status, note = '') => ({ status, note, proposal: '' });
(async () => {
  const b = await chromium.launch();
  for (const w of [412, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true, ...(w < 600 ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.route(/gstatic\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
    // seed: writing-only fixes on 2,254 objects; existing sprite + move reviews on a few
    const ids = await p.evaluate(async () => {
      const F = (status, note = '') => ({ status, note, proposal: '' }), S = __catalogue.Store, all = __catalogue.IDS, W = id => ({ 'names.common': { status: 'fix', note: 'writing', proposal: 'New Name' }, 'lore.rare': { status: 'fix', note: 'writing', proposal: 'A new rare text for this one.' } });
      for (const id of all.slice(0, 2254)) S.obj(id).local = W(id);
      const [a, b2, c] = [all[10], all[20], all[30]];
      S.obj(a).local = { ...W(a), visual: F('fix', 'wombat looks like a bear'), 'moves.legend': F('fix', 'move note') };
      S.obj(b2).local = { ...W(b2), visual: F('ok'), 'visual.rare.spectral': F('fix', 'spectral rare is a blob') };
      S.obj(c).local = { ...W(c), visual: F('ok'), mapping: F('fix', 'map note') };
      await S.persist(true); return { all, a, b2, c, first: all[0] };
    });
    await p.reload(); await p.waitForSelector('.row');
    const snap = () => p.evaluate(() => JSON.stringify(__catalogue.Store.data));
    const allProg = await p.textContent('#prog'), before = await snap();
    ok(/2254 need fix/.test(allProg), `${w}px: "All reviews" view unchanged (${allProg.trim().slice(0, 60)}…)`);
    await p.click('[data-a="mode"][data-m="sprite"]');
    const sp = await p.textContent('#prog');
    ok(/Sprites: 3 reviewed \(1 look good · 2 need fix\) · 2305 remaining of 2308/.test(sp) && await snap() === before, `${w}px: Sprite review: writing fixes ignored, existing sprite reviews counted ("${sp.trim().slice(0, 80)}"), switching mode changed no data`);
    ok(await p.isVisible('#spriteexport') && /Sprite unreviewed/.test(await p.textContent('#list')), `${w}px: sprite badges and the "Export sprite fixes" button are shown`);
    // Next unreviewed ignores writing flags; sprite-only approval touches only `visual`
    await p.fill('#q', ''); await p.waitForTimeout(250); await p.click(`.row[data-id="${ids.first}"]`); await p.waitForSelector('[data-a="spriteok"]');
    ok(await p.isVisible('.rars canvas') && !(await p.isVisible('[data-a="good"]')) && !(await p.isVisible('.field[data-path="names.common"]')), `${w}px: sprite mode shows the five real sprites and sprite actions; "Everything looks good" and writing review are hidden`);
    const fieldsBefore = await p.evaluate(id => JSON.stringify(__catalogue.Store.fields(id)), ids.first);
    await p.click('[data-a="spriteok"]'); await p.waitForTimeout(150);
    const fa = await p.evaluate(id => __catalogue.Store.fields(id), ids.first), fb = JSON.parse(fieldsBefore);
    ok(fa.visual.status === 'ok' && JSON.stringify({ ...fa, visual: undefined }) === JSON.stringify({ ...fb, visual: undefined }), `${w}px: "Sprite looks good" sets only visual; names/lore fields byte-identical`);
    await p.click('#detail [data-a="nextopen"]'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => __catalogue.UI.sel) === ids.all[1], `${w}px: "Next unreviewed" goes to the next object without a sprite review, regardless of writing fixes`);
    // needs fix + note; variant-specific flag; looks-good keeps variant flag; confirm before overriding a fix
    await p.click('[data-a="spritefix"]'); await p.fill('.field[data-path="visual"] [data-k="note"]', 'the eyes float outside the body'); await p.waitForTimeout(900);
    await p.click('[data-a="rar"][data-r="epic"]'); await p.click('[data-a="var"][data-v="mutated"]');
    await p.click('.field[data-path="visual.epic.mutated"] [data-a="st"][data-s="fix"]'); await p.fill('.field[data-path="visual.epic.mutated"] [data-k="note"]', 'mutated epic has no legs'); await p.waitForTimeout(900);
    const f2 = await p.evaluate(id => __catalogue.Store.fields(id), ids.all[1]);
    ok(f2.visual.status === 'fix' && f2.visual.note === 'the eyes float outside the body' && f2['visual.epic.mutated'].note === 'mutated epic has no legs' && f2['names.common'].status === 'fix', `${w}px: "Sprite needs fix" with a note and a rarity/variant flag; writing review untouched`);
    if (!(await p.isVisible('#q'))) await p.click('#detail [data-a="close"]');
    await p.fill('#q', ids.b2); await p.waitForTimeout(300); await p.click(`.row[data-id="${ids.b2}"]`); await p.waitForSelector('[data-a="spriteok"]');
    ok(/rarity\/variant sprite is flagged/.test(await p.textContent('#detail')), `${w}px: an object with a flagged variant shows why it still needs a sprite fix`);
    if (!(await p.isVisible('#q'))) await p.click('#detail [data-a="close"]');
    await p.fill('#q', ids.a); await p.waitForTimeout(300); await p.click(`.row[data-id="${ids.a}"]`); await p.waitForSelector('[data-a="spriteok"]'); await p.click('[data-a="spriteok"]');
    ok(await p.isVisible('#dlg[open]') && /flagged <b>Needs fix<\/b>/.test(await p.innerHTML('#dlg')), `${w}px: marking a flagged sprite as good asks first (never silent)`);
    await p.click('#dlg [data-a="dlgclose"]');
    ok((await p.evaluate(id => __catalogue.Store.fields(id).visual.status, ids.a)) === 'fix', `${w}px: cancelling keeps the "Needs fix" flag and note`);
    // reload: counts and mode persist
    await p.reload(); await p.waitForSelector('.row'); const sp2 = await p.textContent('#prog');
    ok(/Sprites: 5 reviewed \(2 look good · 3 need fix\) · 2303 remaining/.test(sp2), `${w}px: after reload the sprite mode and counts persist ("${sp2.trim().slice(0, 70)}")`);
    // export: warning for incomplete + local; exactly the flagged sprite fields
    if (!(await p.isVisible('#spriteexport'))) await p.click('#detail [data-a="close"]');
    await p.click('#spriteexport'); await p.waitForSelector('#dlg[open]'); const dlg = await p.innerHTML('#dlg');
    ok(/<b>2303 object\(s\) have no sprite review yet\.<\/b>/.test(dlg) && /local mode, NOT synced/.test(dlg), `${w}px: export warns about the 2,303 objects not yet reviewed and that the data is local`);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dlg [data-i="0"]')]); const e = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    const flagged = Object.fromEntries(e.objects.map(o => [o.id, Object.keys(o.fixes).sort().join(',')]));
    ok(e.schema === 'snapmon-sprite-fixes/1' && e.count === 3 && flagged[ids.a] === 'visual' && flagged[ids.b2] === 'visual.rare.spectral' && flagged[ids.all[1]] === 'visual,visual.epic.mutated' && e.coverage.remaining === 2303 && !e.coverage.complete,
      `${w}px: export lists exactly the 3 objects with sprite fixes and their flagged fields (${JSON.stringify(flagged)})`);
    ok(!/names\.|lore\.|moves\.|mapping|writing|New Name/.test(JSON.stringify(e.objects)) && e.objects.find(o => o.id === ids.a).fixes.visual.note === 'wombat looks like a bear', `${w}px: export holds sprite notes only (no writing, move or mapping data)`);
    ok(await snap() !== null && (await p.evaluate(id => __catalogue.Store.fields(id)['moves.legend'].note, ids.a)) === 'move note', `${w}px: export changed nothing; existing move/mapping reviews preserved`);
    await p.click('[data-a="mode"][data-m="all"]'); ok(/need fix/.test(await p.textContent('#prog')) && !(await p.isVisible('#spriteexport')), `${w}px: switching back to "All reviews" restores the normal view`);
    ok(!errs.length, `${w}px: no page errors${errs.length ? ': ' + errs[0] : ''}`);
    await p.screenshot({ path: path.join(out, `cat-sprite-${w}.png`) }); await ctx.close();
  }
  // v0.6.0: redesigned sprites — "Redesigned · to re-check" lists the objects whose Needs fix predates the redesign
  { const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true }); await ctx.route(/gstatic\.com/, r => r.abort()); const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
    const r = await p.evaluate(async () => { const S = __catalogue.Store, ids = __catalogue.IDS.filter(id => OBJECTS[id].redesigned), old = Date.parse('2026-11-16T10:00:00Z');
      S.obj(ids[0]).local = { visual: { status: 'fix', note: 'too generic', proposal: '', t: old } }; S.obj(ids[1]).local = { visual: { status: 'ok', note: '', proposal: '', t: Date.now() } };
      await S.persist(true); __catalogue.prefs.mode = 'sprite'; __catalogue.prefs.st = 'recheck'; localStorage.setItem('snapmon-catalogue.v1.prefs', JSON.stringify(__catalogue.prefs)); return { n: ids.length, a: ids[0], b2: ids[1] }; });
    await p.reload(); await p.waitForSelector('.row');
    const shown = await p.$$eval('.row', rs => rs.map(x => x.dataset.id)), prog = await p.textContent('#prog');
    ok(r.n === 672 && shown.includes(r.a) && !shown.includes(r.b2) && /new sprites \(v0\.6\.0\): 671 of 672 to re-check/.test(prog), `"Redesigned · to re-check" lists redesigned sprites not yet re-checked (${prog.match(/new sprites[^·]*/) || prog})`);
    await p.click(`.row[data-id="${r.a}"]`); await p.waitForSelector('[data-a="spriteok"]');
    ok(/New sprite in v0\.6\.0/.test(await p.textContent('#detail')) && /new sprite/.test(await p.textContent('#list').catch(() => 'new sprite')), 'the detail page says the sprite is new and the old flag was about the old sprite');
    await p.click('[data-a="spriteok"]'); await p.waitForTimeout(200);
    ok(!(await p.isVisible('#dlg[open]')) && (await p.evaluate(id => __catalogue.Store.fields(id).visual.status, r.a)) === 'ok', 'marking a redesigned sprite good needs no confirmation when the old flag predates the redesign');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : '')); await ctx.close(); }
  // a complete audit with 0 fixes is distinguishable from an incomplete one
  { const ctx = await b.newContext({ acceptDownloads: true }); await ctx.route(/gstatic\.com/, r => r.abort()); const p = await ctx.newPage();
    await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
    await p.evaluate(async () => { for (const id of __catalogue.IDS) __catalogue.Store.obj(id).local = { visual: { status: 'ok', note: '', proposal: '' } }; await __catalogue.Store.persist(true); __catalogue.prefs.mode = 'sprite'; localStorage.setItem('snapmon-catalogue.v1.prefs', JSON.stringify(__catalogue.prefs)); });
    await p.reload(); await p.waitForSelector('.row'); await p.click('#spriteexport'); await p.waitForSelector('#dlg[open]');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dlg [data-i="0"]')]); const e = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    ok(e.count === 0 && e.coverage.complete === true && e.coverage.reviewed === 2308, 'complete audit with 0 sprite fixes: valid export, coverage complete'); await ctx.close(); }
  await b.close(); console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CATALOGUE SPRITE CHECKS PASSED'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
