// Catalogue storage + cheap cloud reads (v0.5.5), in the browser with a mock Firebase backend (runs in CI).
//  1. An owner-sized store (2,308 objects with writing notes/proposals, base + local) no longer fits localStorage (the
//     v0.5.4 failure is reproduced first) but saves to IndexedDB and survives a reload.
//  2. A store saved by v0.5.4 in localStorage moves into IndexedDB once, and the old copy is freed.
//  3. A failed save is never silent: a banner says what to do, and it clears once a save works again.
//  4. The cloud listener reads everything only once per device; after a reload it asks only for recent changes.
//   node tests/e2e-catalogue-storage.js <base-url>
const { chromium } = require('playwright');
const [base = 'http://localhost:8765/'] = process.argv.slice(2);
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const DAY = 86400000;
(async () => {
  const b = await chromium.launch();

  // ---- 1 + 3: owner-sized local store, save failure banner ----
  { const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true }); await ctx.route(/gstatic\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
    await p.evaluate(() => localStorage.setItem('snapmon.save.v1', 'SENTINEL'));
    const r = await p.evaluate(async () => {
      const S = __catalogue.Store, txt = (id, k) => `Proposal for ${id} ${k}: a longer replacement text the owner wrote while reviewing, with a note about tone and detail.`;
      for (const id of __catalogue.IDS) {
        const f = {}; for (const g of ['names', 'lore']) for (const rr of ['common', 'uncommon', 'rare', 'epic', 'legendary']) f[g + '.' + rr] = { status: 'fix', note: 'owner note about ' + g + ' ' + rr + ' for ' + id, proposal: txt(id, g + rr), t: 1793786583946, d: 'dev-phone01' };
        f.visual = { status: 'ok', note: '', proposal: '', t: 1793786583946, d: 'dev-phone01' };
        const o = S.obj(id); o.local = f; o.base = JSON.parse(JSON.stringify(f)); o.rev = 3; o.t = 1793786583946;
      }
      const json = JSON.stringify({ objects: S.data.objects });
      let lsFits = true; try { localStorage.setItem('probe.size', json); } catch (e) { lsFits = false; } localStorage.removeItem('probe.size');
      const t0 = performance.now(), saved = await S.persist(true);
      return { chars: json.length, lsFits, saved, ms: performance.now() - t0 };
    });
    ok(r.chars > 6e6 && !r.lsFits, `v0.5.4 failure reproduced: an owner-sized store (${(r.chars / 1e6).toFixed(1)}M characters) does not fit in localStorage`);
    ok(r.saved, `the same store saves to IndexedDB (${Math.round(r.ms)} ms)`);
    await p.reload(); await p.waitForSelector('.row');
    const a = await p.evaluate(() => ({ n: __catalogue.Store.reviewedIds().length, prop: __catalogue.Store.fields('kettle')['lore.epic'].proposal, ls: localStorage.getItem('snapmon-catalogue.v1.store.local'), warn: !document.querySelector('#savewarn').hidden }));
    ok(a.n === 2308 && /Proposal for kettle loreepic/.test(a.prop) && a.ls === null && !a.warn, `after a reload all 2,308 reviewed objects are back (from IndexedDB, nothing in localStorage, no warning)`);
    const t1 = Date.now(); await p.click(`.row[data-id="${await p.evaluate(() => __catalogue.IDS[0])}"]`); await p.waitForSelector('#detail .field'); const openMs = Date.now() - t1;
    ok(openMs < 3000, `opening an object with the large store loaded stays fast (${openMs} ms)`);
    // a failing save (storage full / blocked) shows a banner and keeps retrying; it clears once saving works again
    await p.evaluate(() => { const I = __catalogue.idb; I._put = I.put; I.put = () => Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError')); });
    const first = await p.evaluate(() => __catalogue.IDS[0]);
    await p.click('.field[data-path="names.common"] [data-a="st"][data-s="ok"]'); await p.waitForTimeout(600);
    const w = await p.evaluate(() => ({ vis: !document.querySelector('#savewarn').hidden, t: document.querySelector('#savewarn').textContent }));
    ok(w.vis && /Not saved on this device/.test(w.t) && /QuotaExceededError/.test(w.t) && /Do not reload/.test(w.t) && /Export JSON/.test(w.t), `a failed save shows a warning: "${w.t.slice(0, 110)}…"`);
    await p.evaluate(() => { const I = __catalogue.idb; I.put = I._put; }); await p.click('#savewarn [data-a="retrysave"]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.querySelector('#savewarn').hidden), 'after "Try again" succeeds the warning disappears');
    await p.reload(); await p.waitForSelector('.row');
    ok((await p.evaluate(id => __catalogue.Store.fields(id)['names.common'].status, first)) === 'ok', 'the edit made while saving failed was saved by the retry and survives a reload');
    ok(await p.evaluate(() => localStorage.getItem('snapmon.save.v1')) === 'SENTINEL' && !errs.length, `game save untouched, no page errors${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close(); }

  // ---- 2: migration of a v0.5.4 localStorage store ----
  { const ctx = await b.newContext(); await ctx.route(/gstatic\.com/, r => r.abort());
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
      localStorage.setItem('snapmon-catalogue.v1.store.local', JSON.stringify({ objects: { kettle: { base: null, rev: 0, local: { visual: { status: 'fix', note: 'old v0.5.4 note', proposal: '' } }, dirty: false, conflicts: {} } } })); } });
    const p = await ctx.newPage(); await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
    const m = await p.evaluate(() => ({ note: (__catalogue.Store.fields('kettle').visual || {}).note, ls: localStorage.getItem('snapmon-catalogue.v1.store.local') }));
    await p.reload(); await p.waitForSelector('.row');
    const m2 = await p.evaluate(() => (__catalogue.Store.fields('kettle').visual || {}).note);
    ok(m.note === 'old v0.5.4 note' && m.ls === null && m2 === 'old v0.5.4 note', 'a review saved by v0.5.4 (localStorage) moves to IndexedDB, the old copy is freed, and it survives a reload');
    await ctx.close(); }

  // ---- 4: incremental cloud listener (mock Firebase) ----
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/gstatic\.com/, r => r.abort());
    const T0 = Date.now() - 2 * DAY;
    await ctx.addInitScript(T0 => {
      window.__since = []; window.__delivered = 0;
      let cloud = null; const C = () => { if (!cloud) { cloud = {}; for (const o of OBJECT_LIST) cloud[o.id] = ReviewModel.toRemote(o.id, { 'lore.epic': { status: 'fix', note: 'too tame', proposal: 'A much wilder epic.' } }, 1, 'phone', T0); } return cloud; };
      window.__CATALOGUE_TEST_BACKEND = { kind: 'mock', ownerUid: 'OWNER', onAuth: cb => setTimeout(() => cb({ uid: 'OWNER', email: 'owner@test' }), 50),
        signIn: async () => ({}), signOut: async () => {},
        commit: async (u, id, mutate) => { const res = mutate(C()[id] || null); if (res && res.doc) C()[id] = res.doc; return res; },
        subscribe(uid, onChanges, onError, since = 0) { window.__since.push(since);
          const ch = Object.entries(C()).filter(([, d]) => d.updatedAt > since).map(([id, data]) => ({ id, data })); window.__delivered += ch.length;
          setTimeout(() => onChanges(ch), 50); return () => {}; } };
    }, T0);
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
    await p.waitForFunction(() => /^Synced/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
    const s1 = await p.evaluate(() => ({ since: __since.slice(), n: __delivered, prog: document.querySelector('#prog').textContent }));
    ok(s1.since[0] === 0 && s1.n === 2308 && /cloud: 2308 reviewed objects/.test(s1.prog), `first sign-in on a device reads everything once (${s1.n} docs)`);
    const id = await p.evaluate(() => __catalogue.IDS[5]);
    await p.click('[data-a="mode"][data-m="sprite"]'); await p.fill('#q', id); await p.waitForTimeout(300); await p.click(`.row[data-id="${id}"]`); await p.waitForSelector('[data-a="spritefix"]');
    await p.click('[data-a="spritefix"]'); await p.waitForFunction(() => /^Synced/.test(document.querySelector('#sync').textContent) && !__catalogue.Store.pending().length, null, { timeout: 15000 });
    const tEdit = await p.evaluate(i => __catalogue.Store.data.objects[i].t, id);
    await p.reload(); await p.waitForSelector('.row');
    await p.waitForFunction(() => /^Synced/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
    await p.click('[data-a="mode"][data-m="all"]');
    const s2 = await p.evaluate(i => ({ since: __since.slice(), n: __delivered, prog: document.querySelector('#prog').textContent, vis: __catalogue.Store.fields(i).visual, all: __catalogue.Store.reviewedIds().length }), id);
    ok(s2.since[0] === tEdit - DAY && s2.n === 0, `after a reload the listener asks only for changes since the newest cloud version minus a day (since=${s2.since[0]}, docs read: ${s2.n})`);
    ok(s2.vis && s2.vis.status === 'fix' && s2.all === 2308 && /2308 reviewed objects/.test(s2.prog), 'this device still shows all 2,308 cloud reviews and the new sprite flag (from its own saved copy)');
    await p.click('[data-a="refetch"]'); await p.waitForFunction(() => __since.length >= 2, null, { timeout: 5000 });
    await p.waitForFunction(() => /^Synced/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
    const s3 = await p.evaluate(() => ({ since: __since.slice(), n: __delivered }));
    ok(s3.since[1] === 0 && s3.n === 2308, `"Re-download" reads everything from the cloud once (${s3.n} docs)`);
    ok(!errs.length, `no page errors${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close(); }

  await b.close(); console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CATALOGUE STORAGE CHECKS PASSED'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
