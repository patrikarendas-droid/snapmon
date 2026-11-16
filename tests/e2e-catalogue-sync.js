// Catalogue cloud listener robustness (v0.5.3), with a mock Firebase backend (runs in CI): a listener that fails after
// a partial snapshot (Spark daily quota, "resource-exhausted") must never be reported as "Synced"; it is restarted
// with backoff, and the restarted listener's large initial snapshot (2,308 reviewed objects) reconciles the device
// completely, with accurate counts and the cloud document count shown.   node tests/e2e-catalogue-sync.js <base-url>
const { chromium } = require('playwright');
const [base = 'http://localhost:8765/'] = process.argv.slice(2);
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 412, height: 900 } });
  await ctx.route(/gstatic\.com/, r => r.abort());
  await ctx.addInitScript(() => {
    localStorage.clear(); window.__subs = 0;
    const docs = n => OBJECT_LIST.slice(0, n).map(o => ({ id: o.id, data: ReviewModel.toRemote(o.id, { 'lore.epic': { status: 'fix', note: 'too tame', proposal: 'A much wilder epic.' } }, 1, 'phone', 1) }));
    window.__CATALOGUE_TEST_BACKEND = { kind: 'mock', ownerUid: 'OWNER', onAuth: cb => setTimeout(() => cb({ uid: 'OWNER', email: 'owner@test' }), 50),
      signIn: async () => ({}), signOut: async () => {}, commit: async (u, id, mutate) => mutate(null),
      subscribe(uid, onChanges, onError) { const n = ++window.__subs;
        if (n === 1) { setTimeout(() => onChanges(docs(600)), 100); setTimeout(() => onError({ code: 'resource-exhausted', message: 'Quota exceeded.' }), 400); }
        else setTimeout(() => { window.__t0 = performance.now(); onChanges(docs(OBJECT_LIST.length)); window.__ms = performance.now() - window.__t0; }, 100);
        return () => {}; } };
  });
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'catalogue/'); await p.waitForSelector('.row');
  await p.waitForFunction(() => /quota/i.test(document.querySelector('#sync').textContent), null, { timeout: 5000 });
  const s1 = await p.evaluate(() => ({ sync: document.querySelector('#sync').textContent, prog: document.querySelector('#prog').textContent }));
  ok(!/^Synced/.test(s1.sync) && /quota/i.test(s1.sync) && /may be incomplete/.test(s1.sync), `listener died after 600 objects (quota): status is NOT "Synced": "${s1.sync.slice(0, 90)}…"`);
  ok(/600 need fix/.test(s1.prog) && /cloud not connected/.test(s1.prog), `counts are labelled as this device's copy: "${s1.prog}"`);
  await p.waitForFunction(() => window.__subs >= 2 && /^Synced/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
  const s2 = await p.evaluate(() => ({ sync: document.querySelector('#sync').textContent, prog: document.querySelector('#prog').textContent, ms: window.__ms, n: __catalogue.Store.reviewedIds().length }));
  ok(/^Synced/.test(s2.sync) && s2.n === 2308 && /2308 need fix/.test(s2.prog) && /cloud: 2308 reviewed objects/.test(s2.prog), `listener restarted automatically; the 2,308-record snapshot reconciles the device: "${s2.prog}"`);
  ok(s2.ms < 3000, `processing a 2,308-record initial snapshot took ${Math.round(s2.ms)} ms`);
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CATALOGUE SYNC CHECKS PASSED'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
