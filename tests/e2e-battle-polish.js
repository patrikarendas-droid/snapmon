// Browser test (real UI, phone widths 412 / 360 / 320 px) of three battle fixes (build 21):
//   1. NO FLASH: during a sustained battle (attacks, specials, multi-hit pistol/dagger, forced critical hits that
//      shake the screen, an enemy Ultimate, statuses, the combat log opened and closed) the battle overlay is sampled
//      on EVERY animation frame: its opacity must stay 1, its fade-in animation must never restart, its element must
//      never be replaced, and its background must be opaque (the Hunt screen can never show through). Build 20 failed
//      this: the crit shake restarted the overlay's fade-in and the opacity dropped to 0 for ~0.2 s.
//   2. ENERGY NUMBER: "<energy>/<max> energy" under the energy bar matches the engine and the bar after every action;
//      it fits the hunter card at every width.
//   3. COMBAT LOG: resisted/super-effective hits show the exact HP amount in the real log sheet.
// Usage: node tests/e2e-battle-polish.js <url> <screenshot-dir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [url, outDir = 'shots'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  const b = await chromium.launch();
  for (const width of [412, 360, 320]) {
    const tag = `${width}px`;
    const ctx = await b.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
    await ctx.route(/\/models\/|\/vendor\/|tfhub\.dev|storage\.googleapis\.com|cdn\.jsdelivr\.net/, r => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${tag} page error: ` + e.message));
    await p.goto(url); await p.waitForFunction(() => window.__snapmon && window.__snapmon.actions);
    const idle = () => p.waitForFunction(() => !window.__snapmon.ui.busy || !window.__snapmon.ui.battle, null, { timeout: 30000 });

    // a legendary Spectral monster with lots of HP; pistol (2 hits, Ballistic) against an Organic family (neutral) is
    // switched per round with the dagger (Toxic) and wand; random numbers low → hits and critical hits
    await p.evaluate(() => {
      const S = window.__snapmon.S; S.level = 9; S.weapons = { sword: 2, pistol: 2, dagger: 2, wand: 2 }; S.equipped = 'pistol'; S.research = { ...S.research, analysis: 1 };
      const m = createMonster(S, { obj: 'x_baby_bottle', rarity: 'legendary', variant: 'spectral', word: 'baby bottle' }); m.stats.hp = 5000;
      startBattle(m); window.__snapmon.ui.busy = false;
      // frame sampler for the whole battle
      const ov = document.querySelector('#overlay .overlay');
      window.__flash = { ov, min: 1, frames: 0, replaced: 0, fadeRestarts: 0, bgAlpha: getComputedStyle(ov).backgroundColor, run: true };
      const F = window.__flash; let fadeSeen = 0;
      (function tick() {
        const cur = document.querySelector('#overlay .overlay');
        if (cur && cur !== F.ov) F.replaced++;
        if (cur) {
          const o = +getComputedStyle(cur).opacity; F.min = Math.min(F.min, o); F.frames++;
          const fades = cur.getAnimations().filter(a => a.animationName === 'fadeIn' && a.playState === 'running').length;
          if (fades && F.frames > 15) F.fadeRestarts++;
        }
        if (F.run) requestAnimationFrame(tick);
      })();
    });
    await p.waitForTimeout(500);
    const energyCheck = async label => {
      const r = await p.evaluate(() => { const B = window.__snapmon.ui.battle, t = document.querySelector('#henTxt'), bar = document.querySelector('#hen'), card = document.querySelector('.hero-card');
        return { txt: t.textContent, want: `${B.hero.energy}/${MECH.energy.max} energy`, w: parseFloat(bar.style.width), e: B.hero.energy, fits: t.scrollWidth <= t.clientWidth + 1 && card.getBoundingClientRect().right <= innerWidth + 0.5 }; });
      return r.txt === r.want && Math.abs(r.w - r.e) < 0.01 && r.fits ? null : `${label}: ${JSON.stringify(r)}`;
    };
    const energyBad = [];
    { const e = await energyCheck('start'); if (e) energyBad.push(e); }
    const weapons = ['pistol', 'dagger', 'wand', 'sword'];
    for (let round = 0; round < 10; round++) {
      await p.evaluate(w => { const B = window.__snapmon.ui.battle; B.weapon = w; window.__snapmon.setRNG(() => 0.01); }, weapons[round % 4]);
      const special = await p.evaluate(() => { const B = window.__snapmon.ui.battle; return B.hero.energy >= WEAPONS[B.weapon].special.cost; });
      await p.evaluate(sp => window.__snapmon.actions[sp ? 'bSpecial' : 'bAttack'](), special && round % 2 === 1);
      await idle();
      const e = await energyCheck(`round ${round} (${weapons[round % 4]}${special && round % 2 === 1 ? ' special' : ''})`); if (e) energyBad.push(e);
      if (round === 3) { // the enemy's Ultimate shakes the screen too: play one through the real UI path
        await p.evaluate(() => { const B = window.__snapmon.ui.battle; const ult = B.m.abilities.find(a => a.ultimate); if (ult) B.enemy.cds = {}; window.__snapmon.setRNG(() => 0.0001); });
      }
      if (round === 5) { await p.evaluate(() => window.__snapmon.actions.combatLog()); await p.waitForTimeout(300); await shot(p, width, outDir, 'battle-combat-log-amounts'); await p.evaluate(() => closeSheet()); }
      if (round === 2) await shot(p, width, outDir, 'battle-energy-number');
    }
    await p.waitForTimeout(900); // the last shake class is removed after 700 ms: the build-20 flash happened here
    const F = await p.evaluate(() => { const F = window.__flash; F.run = false; return { min: F.min, frames: F.frames, replaced: F.replaced, fadeRestarts: F.fadeRestarts, bg: F.bgAlpha, shakes: document.querySelectorAll('.shake').length }; });
    const shook = await p.evaluate(() => window.__snapmon.ui.battle && window.__snapmon.ui.battle.log.entries.some(e => e.crit));
    ok(shook, `${tag}: the sequence contained critical hits (screen shakes)`);
    ok(F.frames > 200 && F.min === 1 && F.replaced === 0 && F.fadeRestarts === 0, `${tag}: no flash — battle overlay opacity 1 on all ${F.frames} sampled frames, never replaced, fade-in never restarted (min ${F.min}, replaced ${F.replaced}, fade frames ${F.fadeRestarts})`);
    ok(/rgb\(11, 8, 20\)$|rgba\(11, 8, 20, 1\)/.test(F.bg), `${tag}: the battle overlay background is opaque (${F.bg}); the Hunt screen cannot show through`);
    ok(!energyBad.length, `${tag}: energy number = engine value and bar width after every one of 11 checks, fits the card${energyBad.length ? ' — ' + energyBad.slice(0, 2).join(' | ') : ''}`);
    const lines = await p.evaluate(() => window.__snapmon.ui.battle.log.entries.filter(e => e.kind === 'hit' && e.who === 'enemy').map(e => CombatLog.text(window.__snapmon.ui.battle.log, e)));
    ok(lines.some(l => /resisted −\d+ HP \(\d+ → \d+\)|super effective \+\d+ HP \(\d+ → \d+\)/.test(l)), `${tag}: the log shows effectiveness amounts, e.g. "${(lines.find(l => /→/.test(l)) || '').trim().slice(0, 80)}"`);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    ok(ov, `${tag}: no horizontal overflow`);
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? `\n${errors.length} FAILED` : '\nbattle polish: all browser checks passed');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
async function shot(p, width, outDir, name) { if (width === 412) { await p.waitForTimeout(250); await p.screenshot({ path: path.join(outDir, name + '.png') }); } }
