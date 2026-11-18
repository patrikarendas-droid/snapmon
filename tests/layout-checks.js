// Shared layout checks (tests/e2e-layout.js in Chromium, tools/android/emulator-smoke.js in the real Android WebView):
// the HUD and the tab bar must never cover page content or steal its taps. See tests/e2e-layout.js.
'use strict';
// screens: [name, how to open, is it a sheet]
const SCREENS = [
  ['hunt', () => window.__snapmon.actions.tab('hunt')],
  ['monsters-captured', () => { window.__snapmon.actions.tab('dex'); window.__snapmon.actions.dexView('captured'); }],
  ['monsters-encyclopedia', () => { window.__snapmon.actions.tab('dex'); window.__snapmon.actions.dexView('encyclopedia'); }],
  ['gear-arsenal', () => { window.__snapmon.actions.tab('gear'); window.__snapmon.actions.gearTab('arsenal'); }],
  ['gear-bag', () => { window.__snapmon.actions.tab('gear'); window.__snapmon.actions.gearTab('bag'); }],
  ['gear-shop', () => { window.__snapmon.actions.tab('gear'); window.__snapmon.actions.gearTab('shop'); }],
  ['lab-research', () => { window.__snapmon.actions.tab('lab'); window.__snapmon.actions.labTab('research'); }],
  ['lab-orders', () => { window.__snapmon.actions.tab('lab'); window.__snapmon.actions.labTab('quests'); }],
  ['lab-trophies', () => { window.__snapmon.actions.tab('lab'); window.__snapmon.actions.labTab('trophies'); }],
  ['settings-sheet', () => { window.__snapmon.actions.tab('hunt'); window.__snapmon.actions.settings(); }, true],
  ['monster-sheet', () => { window.__snapmon.actions.tab('dex'); window.__snapmon.actions.dexView('captured'); window.__snapmon.actions.mon(window.__snapmon.S.monsters[0].id); }, true],
];

// runs in the page: geometry of the current screen
function measure(isSheet) {
  const r = e => e.getBoundingClientRect();
  const top = document.querySelector('.topbar'), tabs = document.querySelector('.tabs');
  const tb = r(top), tabsR = r(tabs), vh = innerHeight;
  const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')) || 0;
  const visible = e => { const b = r(e); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  // controls the game deliberately makes untappable (not enough coins/scrap/RP: pointer-events: none) are skipped
  const tappable = e => getComputedStyle(e).pointerEvents !== 'none';
  // what matters under the HUD: controls and visible text (decorative effects such as the scan sweep are ignored)
  const matters = e => e.matches('button, [data-act], a[href], input, select, textarea, summary') || [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const label = e => (e.dataset.act ? e.dataset.act + (e.dataset.arg ? ':' + e.dataset.arg : '') : e.tagName.toLowerCase()) + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"';
  const out = { topbarTop: tb.top, topbarBottom: tb.bottom, inset, under: [], blocked: [], tabsTop: tabsR.top, endGap: null, sheetTop: null, n: 0 };
  if (!isSheet) {
    window.scrollTo(0, 0);
    // nothing of the page may lie under the HUD at scroll 0
    for (const e of document.querySelectorAll('#screen *')) {
      if (!visible(e) || !matters(e)) continue;
      const b = r(e); if (b.bottom <= 0 || b.top >= vh) continue;
      if (b.top < tb.bottom - 0.5 && b.bottom > tb.top + 0.5) out.under.push(label(e) + ' top ' + Math.round(b.top) + ' < HUD bottom ' + Math.round(tb.bottom));
    }
  }
  // every tappable element can be brought into the free band and is then really the element hit at its centre
  const root = isSheet ? document.querySelector('#sheet .sheet') : document.querySelector('#screen');
  if (isSheet) { const s = r(root); out.sheetTop = s.top; }
  for (const e of root.querySelectorAll('button, [data-act], a[href], input, select, textarea, summary')) {
    if (!visible(e) || e.disabled || !tappable(e)) continue;
    out.n++;
    e.scrollIntoView({ block: 'center', inline: 'center' });
    const b = r(e), x = Math.min(Math.max(b.left + b.width / 2, 1), innerWidth - 1), y = b.top + b.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(hit === e || e.contains(hit) || hit.contains(e) && hit.closest('button, [data-act]') === e)) {
      out.blocked.push(label(e) + ' at y ' + Math.round(y) + ' → hit ' + (hit ? (hit.closest('.topbar') ? 'TOP BAR' : hit.closest('.tabs') ? 'TAB BAR' : label(hit)) : 'nothing'));
    }
  }
  if (!isSheet) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const kids = [...document.querySelectorAll('#screen > *')].filter(visible);
    if (kids.length) out.endGap = r(tabs).top - r(kids[kids.length - 1]).bottom;
    window.scrollTo(0, 0);
  }
  return out;
}


// seeds a small collection so the monster grid, the encyclopedia and the monster sheet have content (test saves only)
function seed() {
  const S = window.__snapmon.S; let s = 11; window.__snapmon.setRNG(() => { s = (s * 16807) % 2147483647; return s / 2147483647; });
  if (!S.monsters.length) for (const [obj, rarity] of [['mug', 'common'], ['apple', 'rare'], ['sock', 'epic'], ['book', 'uncommon'], ['padlock', 'legendary']]) {
    const m = createMonster(S, { obj, rarity, word: obj }); m.id = 'L' + S.monsters.length; S.monsters.push(m); recordSighting(S, m);
  }
  S.coins = 999;
}
// runs every screen in a Playwright page; returns a list of [ok, message]
async function checkScreens(page, tag, insetTop, wait = 450, shot = null) {
  const res = [];
  for (const [name, open, isSheet] of SCREENS) {
    await page.evaluate(`(${open})()`);
    await page.waitForTimeout(wait);
    const m = await page.evaluate(measure, !!isSheet);
    res.push([Math.abs(m.topbarTop - insetTop) < 1, `${tag} ${name}: top bar starts at the status bar inset (${Math.round(m.topbarTop)} vs ${insetTop})`]);
    res.push([!m.under.length, `${tag} ${name}: no content under the top bar at scroll 0${m.under.length ? ': ' + m.under.slice(0, 3).join('; ') : ''}`]);
    res.push([!m.blocked.length, `${tag} ${name}: all ${m.n} controls tappable${m.blocked.length ? ' — blocked: ' + m.blocked.slice(0, 3).join('; ') : ''}`]);
    if (!isSheet) res.push([m.endGap === null || m.endGap >= 0, `${tag} ${name}: end of the page clears the tab bar (${m.endGap === null ? '—' : Math.round(m.endGap) + ' px'})`]);
    if (isSheet) res.push([m.sheetTop >= insetTop, `${tag} ${name}: sheet starts below the status bar (${Math.round(m.sheetTop)} ≥ ${insetTop})`]);
    if (shot) await shot(name);
    await page.evaluate(() => { closeSheet(); window.scrollTo(0, 0); });
  }
  return res;
}
module.exports = { SCREENS, measure, seed, checkScreens };
