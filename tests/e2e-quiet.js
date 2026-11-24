// Browser test (real UI, stubbed recogniser) of the quiet-object rule and the text-only recognition choices.
//   • "All quiet" after a miss → the object is quiet; the hint asks for another object, with no timer and no "angle"
//   • the same object again (other photo, lucky roll): "Still quiet", no monster, nothing in the save changes
//   • another object meanwhile rolls normally; the quiet object rolls again once the hidden period is over (fake clock)
//   • Wrong object, cancelling a photo and a failed recognition never make anything quiet
//   • quiet objects survive a page reload (the normal save)
//   • recognition choices (identified card, "lenses disagree" list, Wrong-object alternatives) are text only — no
//     generic category icons — and every choice is the element hit at its centre, also at 320 px width
// Usage: node tests/e2e-quiet.js <url> <screenshot-dir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [url, outDir = 'shots'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

(async () => {
  const b = await chromium.launch();
  for (const width of [412, 320]) {
    const ctx = await b.newContext({ viewport: { width, height: 860 }, isMobile: true, hasTouch: true });
    await ctx.route(/\/models\/|\/vendor\/|tfhub\.dev|storage\.googleapis\.com|cdn\.jsdelivr\.net/, r => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('page error: ' + e.message));
    await p.goto(url);
    await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    const T0 = Date.now(); // real time: a reload loads the save with the real clock
    // a save past the first-hunt guarantee; fake clock (stored on window so it survives in the page) and fake RNG
    await p.evaluate(T0 => {
      window.__now = T0; window.__snapmon.setClock(() => window.__now);
      const S = window.__snapmon.S; S.stats.photos = 4; S.stats.encounters = 1; S.settings.engineCached = true; persist(true);
      Engine.ready = () => true;
    }, T0);
    // a photo "recognised" as the given candidates; decision 'auto' → Object identified card, otherwise the choice list
    const recognise = (cands, decision = 'auto', reason = 'confident') => p.evaluate(([cands, decision, reason]) => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d');
      x.fillStyle = `hsl(${Math.random() * 360},50%,50%)`; x.fillRect(0, 0, 320, 240);
      const candidates = cands.map(([obj, label, conf, src]) => ({ obj, label, cat: OBJECTS[obj].cat, conf, src: src || 'photo', box: [0.1, 0.15, 0.7, 0.6] }));
      window.__snapmon.ui.pending = { rec: { decision, reason, candidates, image: c, debug: { decision, reason, thresholds: { min: .25, auto: .55, detMin: .45 }, times: {}, sources: {}, backend: 'stub', full: [], detections: [], crops: [], candidates: [] } },
        img: c, hash: Math.floor(Math.random() * 2 ** 32).toString(16).padStart(16, '0'), url: c.toDataURL() };
      decision === 'auto' ? showIdentified(window.__snapmon.ui.pending, 0) : showChoices(window.__snapmon.ui.pending);
    }, [cands, decision, reason]);
    const text = () => p.evaluate(() => document.querySelector('#overlay').innerText);
    const result = async () => { await p.waitForFunction(() => /All quiet|Still quiet|Already scanned|Fight|appeared|encounter/i.test(document.querySelector('#overlay').innerText), null, { timeout: 8000 }); return text(); };
    // S.lastTick is the HP-regeneration clock the game refreshes on every render — time-keeping, not progress
    const state = () => p.evaluate(() => JSON.stringify({ ...window.__snapmon.S, lastTick: 0 }));
    const tapCentre = async sel => { const bb = await (await p.$(sel)).boundingBox(); const hit = await p.evaluate(([x, y, sel]) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest(sel); }, [bb.x + bb.width / 2, bb.y + bb.height / 2, sel]); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return hit; };
    const tag = `${width}px`;

    // 1. identified card is text only; a miss makes the object quiet
    await recognise([['monitor', 'monitor', 0.99]]);
    ok(!(await p.$('.ident .e')) && !EMOJI.test(await p.$eval('.ident', e => e.textContent)), `${tag}: "Object identified" card has no category icon`);
    await p.evaluate(() => window.__snapmon.setRNG(() => 0.999));
    ok(await tapCentre('[data-act="pickCand"]'), `${tag}: "Scan for monsters" is hittable at its centre`);
    let t = await result();
    ok(/All quiet/.test(t) && /Try another object, or come back to this one later/.test(t) && !/spirit pressure|angle|\d+\s*min/i.test(t), `${tag}: miss → "All quiet" with the new hint, no timer, no "angle"`);
    ok(await p.evaluate(() => !!window.__snapmon.S.enc.quiet.monitor), `${tag}: the object is now quiet (canonical id "monitor")`);
    if (width === 412) await p.waitForTimeout(450), await p.screenshot({ path: path.join(outDir, 'quiet-1-all-quiet.png') });

    // 2. same object, new photo/hash, lucky roll → Still quiet, save unchanged
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.setRNG(() => 0.001); });
    let before = await state();
    await recognise([['monitor', 'computer monitor', 0.97]]);
    await tapCentre('[data-act="pickCand"]');
    t = await result();
    ok(/Still quiet/.test(t) && !/Fight/.test(t) && !/\d/.test(t.replace(/Snap another object|Back/g, '')) && !/angle/i.test(t), `${tag}: same object again → "Still quiet", no monster, no numbers/timer, no "angle"`);
    const after = await state();
    if (after !== before) { const A = JSON.parse(before), B = JSON.parse(after); const d = []; const walk = (x, y, k) => { if (JSON.stringify(x) === JSON.stringify(y)) return; if (x && y && typeof x === 'object' && typeof y === 'object') { for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[key], y[key], k + '.' + key); } else d.push(k + ': ' + JSON.stringify(x) + ' → ' + JSON.stringify(y)); }; walk(A, B, 'S'); console.log('DIFF', d.slice(0, 10).join(' | ')); }
    ok(after === before, `${tag}: a blocked scan leaves the save completely unchanged`);
    if (width === 412) await p.waitForTimeout(450), await p.screenshot({ path: path.join(outDir, 'quiet-2-still-quiet.png') });

    // 3. "lenses disagree" choice list is text only and its rows are hittable; picking the quiet object stays blocked
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; });
    await recognise([['monitor', 'Monitor', 0.99], ['x_workstation', 'workstation', 0.3, 'clip']], 'choose', 'disagree');
    const rows = await p.$$eval('.cand', els => els.map(e => ({ icon: !!e.querySelector('.e'), emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(e.textContent), badge: !!e.querySelector('.num-badge'), text: e.textContent.trim() })));
    ok(rows.length === 2 && rows.every(r => !r.icon && !r.emoji && r.badge), `${tag}: choice rows keep their number badge and text, no icons (${rows.map(r => r.text.replace(/\s+/g, ' ')).join(' | ')})`);
    ok(await p.$('.det-canvas') !== null, `${tag}: the photo with its numbered detection box is still shown`);
    if (width === 412) await p.waitForTimeout(450), await p.screenshot({ path: path.join(outDir, 'quiet-3-choices-text-only.png') });
    ok(await tapCentre('.cand[data-arg="0"]'), `${tag}: choice 1 is hittable at its centre`);
    t = await result();
    ok(/Still quiet/.test(t), `${tag}: picking the quiet object from the choice list is blocked too`);

    // 4. another object rolls normally meanwhile
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; });
    await recognise([['mug', 'coffee mug', 0.95]]);
    await tapCentre('[data-act="pickCand"]');
    t = await result();
    ok(!/quiet/i.test(t), `${tag}: a different object is not blocked (lucky roll → encounter)`);
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__snapmon.ui.battle = null; window.__snapmon.ui.discovered = null; render(); });

    // 5. Wrong object / alternatives are text only; rejecting and cancelling never make anything quiet
    await p.evaluate(() => { window.__snapmon.S.enc.quiet = {}; window.__snapmon.setRNG(() => 0.999); });
    await recognise([['apple', 'apple', 0.9], ['x_workstation', 'workstation', 0.4], ['desktop_pc', 'desktop computer', 0.35]]);
    await tapCentre('[data-act="wrongObject"]');
    await p.waitForSelector('[data-act="pickAlt"], [data-act="retakePhoto"]');
    const alts = await p.$$eval('[data-act="pickAlt"]', els => els.map(e => ({ icon: !!e.querySelector('.e'), emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(e.textContent) })));
    ok(alts.length >= 1 && alts.every(a => !a.icon && !a.emoji), `${tag}: Wrong-object alternatives are text only (${alts.length})`);
    if (alts.length) ok(await p.evaluate(() => { const e = document.querySelector('[data-act="pickAlt"]'), b = e.getBoundingClientRect(), h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return h && h.closest('[data-act="pickAlt"]') === e; }), `${tag}: alternative 1 is hittable at its centre`);
    await p.evaluate(() => window.__snapmon.actions.cancelPhoto());
    ok(await p.evaluate(() => JSON.stringify(window.__snapmon.S.enc.quiet) === '{}'), `${tag}: Wrong object + cancel make nothing quiet`);
    await recognise([], 'unknown', 'nothing');
    await p.evaluate(() => window.__snapmon.actions.cancelPhoto());
    ok(await p.evaluate(() => JSON.stringify(window.__snapmon.S.enc.quiet) === '{}'), `${tag}: a failed recognition makes nothing quiet`);

    // 6. persistence across a reload, then expiry with the (hidden) clock
    await recognise([['monitor', 'monitor', 0.99]]); await tapCentre('[data-act="pickCand"]'); await result();
    const until = await p.evaluate(() => window.__snapmon.S.enc.quiet.monitor);
    await p.evaluate(() => persist(true));
    await p.reload(); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    await p.evaluate(T0 => { window.__now = T0 + 19 * 60 * 1000; window.__snapmon.setClock(() => window.__now); Engine.ready = () => true; window.__snapmon.setRNG(() => 0.001); }, T0);
    ok(await p.evaluate(u => window.__snapmon.S.enc.quiet.monitor === u, until), `${tag}: the quiet object survives a reload (normal save)`);
    await recognise([['monitor', 'monitor', 0.99]]); await tapCentre('[data-act="pickCand"]'); t = await result();
    ok(/Still quiet/.test(t), `${tag}: still quiet 19 minutes later`);
    await p.evaluate(() => { document.querySelector('#overlay').innerHTML = ''; window.__now += 2 * 60 * 1000; });
    await recognise([['monitor', 'monitor', 0.99]]); await tapCentre('[data-act="pickCand"]'); t = await result();
    ok(!/quiet/i.test(t), `${tag}: after the hidden period the object can produce a monster again`);
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? `\n${errors.length} FAILED` : '\nquiet objects + text-only choices: all browser checks passed');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
