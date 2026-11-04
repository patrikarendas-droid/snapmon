// Catalogue AI writing batches, in the browser (no Firebase; runs in CI): export 50/25 objects with all ten live
// names + flavour texts (read-only), then import a plausible AI answer: name fix, lore fix, a "looks good", omitted
// fields, a forbidden move field and an invalid proposal (both ignored), and a clash with an existing owner review
// (becomes a conflict, never an overwrite). The owner's move/sprite/mapping reviews stay untouched.
//   node tests/e2e-catalogue-ai.js <base-url> <outdir>
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const [base = 'http://localhost:8765/', out = '/tmp'] = process.argv.slice(2);
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch();
  for (const w of [412, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true, ...(w < 600 ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.route(/gstatic\.com/, r => r.abort());
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); sessionStorage.setItem('s', '1'); } });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
    // existing owner reviews: a move + sprite review (must never be touched) and a name review (must not be overwritten)
    const ids = await p.evaluate(() => __catalogue.IDS.slice(0, 3));
    await p.evaluate(([a, b2]) => { const S = __catalogue.Store;
      S.obj(a).local = { 'moves.signature': { status: 'fix', note: 'owner move note', proposal: 'Owner Move' }, visual: { status: 'ok', note: '', proposal: '' }, mapping: { status: 'fix', note: 'owner mapping', proposal: '' } };
      S.obj(b2).local = { 'names.rare': { status: 'fix', note: 'owner: too plain', proposal: 'Owner Name' } }; S.persist(true); }, ids);
    const snap = () => p.evaluate(() => JSON.stringify(__catalogue.Store.data));
    const before = await snap();
    const exportBatch = async () => { await p.click('[data-a="aibatch"]'); await p.waitForSelector('#dlg[open] #bsz'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dlg [data-i="0"]')]); return JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); };
    ok(await p.isVisible('[data-a="aibatch"]') && await p.isVisible('[data-a="aiimport"]'), `${w}px: "Export AI writing batch" and "Import AI writing reviews" buttons visible`);
    // 1. default batch: 50, whole catalogue, from the start, only open objects (includes never-reviewed objects)
    const e1 = await exportBatch();
    const chk = await p.evaluate(e => { const bad = []; for (const o of e.objects) { const c = CURATED.data[o.id];
      for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary']) if (o.live.names[r] !== c.names[r] || o.live.lore[r] !== c.lore[r]) bad.push(o.id + ' ' + r);
      const extra = Object.keys(o).filter(k => !['id', 'name', 'category', 'source', 'live', 'review'].includes(k)); if (extra.length || !OBJECTS[o.id] || o.name !== OBJECTS[o.id].name) bad.push(o.id + ' keys'); }
      return { bad, first: e.objects.map(o => o.id).join() === __catalogue.IDS.slice(0, 50).join() }; }, e1);
    ok(e1.schema === 'snapmon-ai-writing-batch/1' && e1.count === 50 && chk.first && !chk.bad.length, `${w}px: batch of 50 in catalogue order (never-reviewed objects included), all 10 live texts exact and untruncated, no extra fields${chk.bad.length ? ': ' + chk.bad.slice(0, 3) : ''}`);
    const txt = JSON.stringify(e1);
    ok(!/moves\.|"visual|mapping|"uid"|@|firebase|token/i.test(JSON.stringify(e1.objects)) && e1.objects[1].review['names.rare'].note === 'owner: too plain' && !e1.objects[0].review, `${w}px: no moves/sprite/mapping/account data; the owner's existing name review is included`);
    ok(/Legendary: 3-40/.test(txt) && /12-220/.test(txt) && e1.responseFormat.schema === 'snapmon-catalogue-export/1', `${w}px: instructions state the real limits and the import format`);
    const e2 = await exportBatch();
    ok(JSON.stringify(e2.objects) === JSON.stringify(e1.objects) && await snap() === before, `${w}px: exporting again gives the same batch; exporting changed no review`);
    // 2. 25 from the selected object
    await p.fill('#q', 'kettle'); await p.waitForTimeout(300); await p.click('.row[data-id="kettle"]');
    await p.click('[data-a="aibatch"]'); await p.waitForSelector('#dlg[open] #bsz'); await p.selectOption('#bsz', '25'); await p.selectOption('#bfr', 'selected');
    ok(/<b>25<\/b> object/.test(await p.innerHTML('#dlg')) && await p.evaluate(() => document.querySelector('#dlg').scrollWidth <= document.querySelector('#dlg').clientWidth + 2), `${w}px: batch dialog shows the count before download and fits the screen`);
    const [dl3] = await Promise.all([p.waitForEvent('download'), p.click('#dlg [data-i="0"]')]); const e3 = JSON.parse(fs.readFileSync(await dl3.path(), 'utf8'));
    ok(e3.count === 25 && e3.objects[0].id === 'kettle', `${w}px: 25 objects starting at the selected object (kettle)`);
    if (!(await p.isVisible('#q'))) await p.click('#detail [data-a="close"]'); await p.fill('#q', ''); await p.waitForTimeout(300);
    // 3. import a plausible AI answer
    const [a, b2, c] = ids, lg = await p.evaluate(id => CURATED.data[id].lore.legendary, a);
    const answer = { schema: 'snapmon-catalogue-export/1', objects: {
      [a]: { fields: { 'names.common': { status: 'fix', note: 'Too generic', proposal: 'Grumblewick' }, 'lore.legendary': { status: 'fix', note: 'Not mythic enough', proposal: 'Swallowed the moon for breakfast and now glows every Tuesday.' },
        'moves.signature': { status: 'ok', note: 'AI must not touch moves', proposal: '' }, visual: { status: 'fix', note: 'AI must not touch sprites' } } },
      [b2]: { fields: { 'names.rare': { status: 'ok', note: 'Fine as it is', proposal: '' }, 'names.legendary': { status: 'fix', note: 'Too long', proposal: 'An Absurdly Long Legendary Name That Breaks Limits' } } },
      [c]: { fields: { 'lore.rare': { status: 'ok', note: 'Strong', proposal: '' } } } } };
    const af = path.join(out, `ai-answer-${w}.json`); fs.writeFileSync(af, JSON.stringify(answer));
    await p.setInputFiles('#aifile', af); await p.waitForSelector('#dlg[open]'); const dlg = await p.innerHTML('#dlg');
    ok(/<b>3<\/b> field\(s\) will be added \(2 needs fix, 1 looks good\)/.test(dlg) && /<b>1<\/b> differ/.test(dlg) && /2 non-writing field/.test(dlg) && /1 skipped/.test(dlg), `${w}px: import preview: 3 added (2 fix, 1 good), 1 conflict, 2 non-writing fields ignored, 1 invalid name skipped`);
    await p.click('#dlg [data-i="0"]'); await p.waitForTimeout(300);
    const st = await p.evaluate(([a, b2, c]) => ({ A: __catalogue.Store.fields(a), B: __catalogue.Store.fields(b2), C: __catalogue.Store.fields(c), conf: __catalogue.Store.obj(b2).conflicts }), ids);
    ok(st.A['names.common'].proposal === 'Grumblewick' && st.A['lore.legendary'].status === 'fix' && st.C['lore.rare'].status === 'ok' && !st.A['names.rare'] && !st.A['lore.common'], `${w}px: name fix, lore fix and "looks good" imported; omitted fields unchanged`);
    ok(st.A['moves.signature'].note === 'owner move note' && st.A['moves.signature'].proposal === 'Owner Move' && st.A.visual.status === 'ok' && st.A.mapping.note === 'owner mapping', `${w}px: the owner's move, sprite and mapping reviews are untouched`);
    ok(st.B['names.rare'].note === 'owner: too plain' && st.conf['names.rare'] && st.conf['names.rare'].source === 'ai-import' && st.conf['names.rare'].mine.status === 'ok' && !st.B['names.legendary'], `${w}px: an existing owner review is kept; the AI's different review is a conflict to choose; the invalid name was not imported`);
    ok(lg === await p.evaluate(id => CURATED.data[id].lore.legendary, a), `${w}px: the live game text is unchanged (suggestions only)`);
    await p.reload(); await p.waitForSelector('.row');
    ok(await p.evaluate(id => __catalogue.Store.fields(id)['names.common'].proposal, a) === 'Grumblewick', `${w}px: imported reviews are saved on the device (survive a reload) and queued for the normal sync`);
    ok(!errs.length, `${w}px: no page errors${errs.length ? ': ' + errs[0] : ''}`);
    await p.screenshot({ path: path.join(out, `cat-ai-${w}.png`) }); await ctx.close();
  }
  await b.close(); console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CATALOGUE AI-BATCH CHECKS PASSED'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
