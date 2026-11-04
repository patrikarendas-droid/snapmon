// Developer catalogue, end to end with the REAL Firebase Web SDK 13.2.0 against the local Firebase emulators
// (Auth + Firestore with catalogue/firestore.rules). Two browser contexts = two devices (phone 412 px, desktop 1280 px).
// Needs: a static server for the repo, the emulators running (see docs/CATALOGUE.md "Testing"), test users created
// with the owner UID and an intruder UID, and the npm package firebase@13.2.0 (its CDN builds are served in place of
// www.gstatic.com). No real account or password is used.
//   node tests/e2e-catalogue.js <base-url> <firebase-package-dir> <outdir>
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const [base = 'http://localhost:8765/', fbdir, outDir = '/tmp'] = process.argv.slice(2);
const OWNER = 'AaFbfMYZryW21xXczxKQCsdTEsv2', EMU = 'http://127.0.0.1', PROJ = 'snapmon-catalogue';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const url = base + 'catalogue/?emulator=1';
const fsREST = (p, opt = {}) => fetch(`${EMU}:8080/v1/projects/${PROJ}/databases/(default)/documents/${p}`, opt);
const token = async (email, password) => (await (await fetch(`${EMU}:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json()).idToken;
const serverDoc = async (id, tok) => { const r = await fsREST(`catalogue/${OWNER}/reviews/${id}`, { headers: { authorization: 'Bearer ' + tok } }); return r.ok ? r.json() : null; };
const fieldOf = (d, key) => d && d.fields && d.fields.fields.mapValue.fields[key] && d.fields.fields.mapValue.fields[key].mapValue.fields;

async function device(b, w, name, { blockCdn = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true, ...(w < 600 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/www\.gstatic\.com\/firebasejs\/13\.2\.0\/(.+)$/, (r, req) => blockCdn ? r.abort() : r.fulfill({ path: path.join(fbdir, 'node_modules/firebase', req.url().split('/13.2.0/')[1]), contentType: 'text/javascript' }));
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('seed')) { localStorage.setItem('snapmon.save.v1', 'SENTINEL-SAVE'); localStorage.setItem('snapmon.testroster.v1', 'SENTINEL-TR'); sessionStorage.setItem('seed', '1'); } });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.name = name; p.ctx = ctx;
  await p.goto(blockCdn ? base + 'catalogue/' : url); await p.waitForSelector('.row');
  return p;
}
const sync = p => p.textContent('#sync');
const waitSync = async (p, re, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (re.test(await sync(p))) return true; await p.waitForTimeout(250); } console.log('   ', p.name, 'status:', await sync(p)); return false; };
const open = async (p, id) => { if (!(await p.isVisible('#q'))) await p.click('#detail [data-a="close"]'); await p.fill('#q', id); await p.waitForTimeout(350); await p.click(`.row[data-id="${id}"]`); await p.waitForSelector('#detail h2'); };
const showField = async (p, fpath) => { const m = /^(names|lore)\.(\w+)$/.exec(fpath); if (m && !(await p.$(`.field[data-path="${fpath}"]`))) { await p.click(`[data-a="rar"][data-r="${m[2]}"]`); await p.waitForSelector(`.field[data-path="${fpath}"]`); } };
const typeNote = async (p, fpath, text, k = 'note') => { await showField(p, fpath); const el = p.locator(`.field[data-path="${fpath}"] [data-k="${k}"]`); await el.fill(text); await p.waitForTimeout(900); };
const status = async (p, fpath, s) => { await showField(p, fpath); return p.click(`.field[data-path="${fpath}"] [data-a="st"][data-s="${s}"]`); };
async function signIn(p, email, pw, expectErr) {
  await p.click('[data-a="signin"]'); await p.fill('#em', email); await p.fill('#pw', pw); await p.click('#sf button[type="submit"]');
  if (expectErr) { await p.waitForFunction(() => /not correct|failed/i.test(document.querySelector('#serr').textContent), null, { timeout: 10000 }); return p.textContent('#serr'); }
}

(async () => {
  const b = await chromium.launch();
  // --- rules (server side, REST): only the owner may read/write catalogue/{owner}/** ---
  const tOwner = await token('owner@test.local', 'test-pass-1'), tOther = await token('intruder@test.local', 'test-pass-2');
  const body = JSON.stringify({ fields: { schema: { integerValue: '1' } } });
  ok((await fsREST(`catalogue/${OWNER}/reviews/rules_probe`, { method: 'PATCH', body })).status === 403, 'rules: unauthenticated write to the owner path is denied');
  ok((await fsREST(`catalogue/${OWNER}/reviews/rules_probe`, { method: 'PATCH', body, headers: { authorization: 'Bearer ' + tOther } })).status === 403, 'rules: another signed-in account cannot write the owner path');
  ok((await fsREST(`catalogue/intruder-uid-0001/reviews/x`, { method: 'PATCH', body, headers: { authorization: 'Bearer ' + tOther } })).status === 403, 'rules: another account cannot write even under its own uid');
  ok((await fsREST(`catalogue/${OWNER}/reviews/rules_probe`, { headers: { authorization: 'Bearer ' + tOther } })).status === 403, 'rules: another account cannot read the owner path');
  ok((await fsREST(`catalogue/${OWNER}/reviews/rules_probe`, { method: 'PATCH', body, headers: { authorization: 'Bearer ' + tOwner } })).status === 200, 'rules: the owner can write');
  await fsREST(`catalogue/${OWNER}/reviews/rules_probe`, { method: 'DELETE', headers: { authorization: 'Bearer ' + tOwner } });

  // --- device A: phone, real SDK loads; everything visible ---
  const A = await device(b, 412, 'A');
  await A.waitForSelector('[data-a="signin"]', { timeout: 15000 });
  ok(await A.textContent('#count') === '2308' && /2308 shown/.test(await A.textContent('#found')), 'phone: 2,308 objects listed (real OBJECT_LIST)');
  ok(/NOT synced/.test(await sync(A)) && await A.isVisible('#localwarn'), 'phone: signed out = clearly "Local only — NOT synced"');
  await open(A, 'toaster');
  const d = await A.evaluate(() => ({ cv: document.querySelectorAll('.rars canvas').length, name: document.querySelector('.rname').textContent, lore: document.querySelector('.lore').textContent,
    want: CURATED.data.toaster.names.common, wantLore: CURATED.data.toaster.lore.common, keys: [...document.querySelectorAll('table.moves code')].map(c => c.textContent), w: document.documentElement.scrollWidth <= innerWidth }));
  ok(d.cv === 5 && d.name === d.want && d.lore === d.wantLore && d.keys[0] === 'moves.signature' && d.w, `phone: toaster shows 5 real sprites, live name "${d.name}", live text, real move slots (${d.keys.join(', ')}), no overflow`);
  await A.click('[data-a="rar"][data-r="legendary"]'); await A.click('[data-a="var"][data-v="spectral"]');
  const L = await A.evaluate(() => ({ name: document.querySelector('.rname').textContent, mv: [...document.querySelectorAll('table.moves tr td:first-child b')].map(x => x.textContent), eff: [...document.querySelectorAll('table.moves tr td:nth-child(3)')].map(x => x.textContent) }));
  ok(L.mv.length >= 3 && L.eff.some(e => /% power/.test(e)), `Legendary Spectral sample: "${L.name}" with ${L.mv.length} moves and real numbers (${L.eff.join(' | ')})`);
  await open(A, 'i_band_aid'); await A.click('[data-a="rar"][data-r="legendary"]');
  const ln = await A.evaluate(() => { const e = document.querySelector('.rname'); return { t: e.textContent, fits: e.scrollWidth <= e.clientWidth + 1 }; });
  ok(ln.t.length === 40 && ln.fits, `the longest Legendary name (40 characters) is shown in full: "${ln.t}"`);
  await A.screenshot({ path: path.join(outDir, 'cat-A-phone-legendary.png') });

  // --- local-only review survives a reload ---
  await open(A, 'toaster'); await status(A, 'names.common', 'fix'); await typeNote(A, 'names.common', 'local-only note');
  await A.reload(); await A.waitForSelector('.row'); await open(A, 'toaster');
  await showField(A, 'names.common'); ok(await A.inputValue('.field[data-path="names.common"] [data-k="note"]') === 'local-only note', 'a local-only review survives a reload');

  // --- sign in: wrong password, intruder, owner ---
  ok(/not correct/i.test(await signIn(A, 'owner@test.local', 'wrong-password', true)), 'wrong password: clear error, nothing stored');
  await A.click('[data-a="dlgclose"]');
  await signIn(A, 'intruder@test.local', 'test-pass-2'); await A.waitForSelector('text=not the catalogue owner', { timeout: 10000 });
  ok(true, 'a non-owner account is refused with a clear message (and signed out)'); await A.click('#dlg [data-a="dlgclose"]');
  await signIn(A, 'owner@test.local', 'test-pass-1');
  ok(await waitSync(A, /^Synced/), 'owner signed in: cloud loaded first, status "Synced" (server-acknowledged)');
  await A.waitForSelector('#localmerge:not([hidden])'); await A.click('[data-a="mergelocal"]');
  ok(await waitSync(A, /^Synced/), 'local-only review merged into the cloud and acknowledged');
  let sd = await serverDoc('toaster', tOwner), nc = fieldOf(sd, 'names:common');
  ok(nc && nc.status.stringValue === 'fix' && nc.note.stringValue === 'local-only note' && sd.name.endsWith(`catalogue/${OWNER}/reviews/toaster`), 'Firestore holds catalogue/{owner}/reviews/toaster with the review (names.common)');

  // --- device B: desktop sees it ---
  const B = await device(b, 1280, 'B');
  await B.waitForSelector('[data-a="signin"]'); await signIn(B, 'owner@test.local', 'test-pass-1'); ok(await waitSync(B, /^Synced/), 'desktop: signed in and synced');
  await open(B, 'toaster'); await showField(B, 'names.common');
  ok(await B.inputValue('.field[data-path="names.common"] [data-k="note"]') === 'local-only note' && /Needs fix/.test(await B.textContent('#detail h2')), 'desktop shows the phone\'s review (Needs fix + note)');
  await B.screenshot({ path: path.join(outDir, 'cat-B-desktop.png') });

  // --- offline edits on both devices, then conflict handling ---
  await A.ctx.setOffline(true); await B.ctx.setOffline(true);
  await typeNote(A, 'names.common', 'A version'); await A.waitForTimeout(3000);
  ok(await waitSync(A, /Offline|pending/), `offline: status says the edit is NOT uploaded ("${await sync(A)}")`);
  await typeNote(B, 'names.common', 'B version'); await status(B, 'lore.common', 'ok'); await B.waitForTimeout(300);
  await A.ctx.setOffline(false); await A.evaluate(() => dispatchEvent(new Event('online')));
  ok(await waitSync(A, /^Synced/, 30000), 'A reconnects: queued edit uploaded and acknowledged');
  await B.ctx.setOffline(false); await B.evaluate(() => dispatchEvent(new Event('online')));
  ok(await waitSync(B, /^Synced/, 30000), 'B reconnects and syncs');
  sd = await serverDoc('toaster', tOwner);
  ok(fieldOf(sd, 'names:common').note.stringValue === 'A version' && fieldOf(sd, 'lore:common').status.stringValue === 'ok', 'independent fields merged (B\'s lore.common kept); same field changed on both: server keeps A, nothing lost');
  await B.waitForSelector('#conf:not([hidden])'); await open(B, 'toaster'); await showField(B, 'names.common');
  ok(/B version/.test(await B.textContent('.field[data-path="names.common"] .conflict')), 'B shows an explicit conflict with both versions');
  await B.click('.field[data-path="names.common"] [data-a="keep"][data-k="mine"]'); ok(await waitSync(B, /^Synced/), 'conflict resolved on B ("Keep A" = this device) and synced');
  sd = await serverDoc('toaster', tOwner); ok(fieldOf(sd, 'names:common').note.stringValue === 'B version', 'the chosen version is now in Firestore');
  await A.waitForTimeout(1500); await open(A, 'toaster'); await showField(A, 'names.common');
  ok(await A.inputValue('.field[data-path="names.common"] [data-k="note"]') === 'B version', 'A receives the change live (subscription)');

  // --- "Everything looks good" keeps Needs fix; proposals; export ---
  await open(A, 'apple'); await status(A, 'lore.legendary', 'fix'); await typeNote(A, 'lore.legendary', 'Make the Legendary truly powerful and funny.');
  await typeNote(A, 'lore.legendary', 'A much bigger orchard catastrophe.', 'proposal'); await A.click('[data-a="good"][data-id="apple"]'); await A.waitForTimeout(300);
  const ap = await A.evaluate(() => { const f = __catalogue.Store.fields('apple'); return { leg: f['lore.legendary'], ok: Object.values(f).filter(x => x.status === 'ok').length, req: __catalogue.required('apple').length }; });
  ok(ap.leg.status === 'fix' && ap.leg.note && ap.ok === ap.req - 1, `"Everything looks good": ${ap.ok} fields good, the "Needs fix" field and its note kept`);
  ok(await waitSync(A, /^Synced/), 'apple review synced');
  const [dl] = await Promise.all([A.waitForEvent('download'), A.click('[data-a="export"]')]); const exp = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(exp.schema === 'snapmon-catalogue-export/1' && exp.objects.apple.fields['lore.legendary'].live === (await A.evaluate(() => CURATED.data.apple.lore.legendary)) && exp.objects.apple.source === 'content/curated/pilot-01-approved.json' && exp.patches['pilot-01-approved'].apple['lore.legendary'] === 'A much bigger orchard catastrophe.' && !JSON.stringify(exp).includes('test-pass'),
    `export: schema, exact ids and field paths, live values, patch-ready proposals per source file; no password (${exp.counts.objects} objects)`);
  fs.writeFileSync(path.join(outDir, 'cat-export.json'), JSON.stringify(exp, null, 1));

  // --- import into a third, local-only device (Firebase CDN blocked = company firewall) ---
  const C = await device(b, 1280, 'C', { blockCdn: true });
  ok(/NOT synced/.test(await sync(C)) && /could not be loaded/.test(await sync(C)), 'Firebase blocked: the catalogue still works, labelled "Local only — NOT synced"');
  await C.setInputFiles('#file', path.join(outDir, 'cat-export.json')); await C.waitForSelector('#dlg[open]'); await C.click('#dlg [data-i="0"]'); await C.waitForTimeout(300);
  ok(await C.evaluate(() => __catalogue.Store.fields('apple')['lore.legendary'].proposal) === 'A much bigger orchard catastrophe.', 'import: reviews added as local edits');
  await C.setInputFiles('#file', path.join(outDir, 'cat-export.json')); await C.waitForSelector('#dlg[open]');
  ok(/<b>0<\/b> new review field\(s\)/.test(await C.innerHTML('#dlg')) && /<b>0<\/b> differ/.test(await C.innerHTML('#dlg')), 'importing the same file again adds nothing and overwrites nothing'); await C.click('#dlg [data-a="dlgclose"]');

  // --- the game is untouched ---
  for (const p of [A, B, C]) {
    const s = await p.evaluate(() => ({ save: localStorage.getItem('snapmon.save.v1'), tr: localStorage.getItem('snapmon.testroster.v1'), keys: Object.keys(localStorage).filter(k => !k.startsWith('snapmon-catalogue.v1.') && !k.startsWith('firebase:') && !['snapmon.save.v1', 'snapmon.testroster.v1'].includes(k)) }));
    ok(s.save === 'SENTINEL-SAVE' && s.tr === 'SENTINEL-TR' && !s.keys.length, `${p.name}: game save keys untouched; catalogue writes only its own keys${s.keys.length ? ' (extra: ' + s.keys.join(',') + ')' : ''}`);
    ok(!p.errs.length, `${p.name}: no page errors${p.errs.length ? ': ' + p.errs.slice(0, 2).join(' | ') : ''}`);
  }
  await b.close(); console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL CATALOGUE CHECKS PASSED'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
