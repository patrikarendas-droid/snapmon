/* SNAPMON — combat log: a readable, chronological record of ONE battle, built only from the battle engine's own events
   (game.js newBattle / heroStrike / enemyTurn / heroTurnStart / useItem / attemptCapture / attemptFlee).

   Nothing is invented: every name, amount, element and status comes from an event or from the battle state. The
   engine's events are not changed (the frozen rules trace hashes them); what they leave implicit is derived exactly as
   the engine itself does it:
     • the damage element of the hunter's hits = the equipped weapon's element (heroStrike uses W.el for every hit);
       monster moves have no damage element in the current rules, so none is shown for them;
     • HP: the log replays the engine's arithmetic (damage floors at 0, heals cap at max HP, God Mode keeps the test
       hunter at 1 HP) and is checked against the engine's real HP after every action (`desyncs` counts mismatches; the
       tests require 0); on a mismatch it re-synchronises to the engine's values;
     • energy: the difference before/after the action.
   Kept in memory with the battle (B.log), never in the save; at most MAX entries (oldest dropped), far more than a
   long fight produces. Rendering escapes every name and message. */
'use strict';

const CombatLog = (() => {
  const MAX = 600;
  // colour + icon language (also used by the status chips): element = damage type, status = condition
  const FX = {
    slash:     { label: 'Slash',     color: '#e8d6a8', icon: 'blade' },
    ballistic: { label: 'Ballistic', color: '#7ff0ff', icon: 'bullet' },
    arcane:    { label: 'Arcane',    color: '#c48bff', icon: 'spark' },
    shock:     { label: 'Shock',     color: '#ffe55c', icon: 'bolt' },
    toxic:     { label: 'Toxic',     color: '#b8f25a', icon: 'fang' },
    poison:    { label: 'Poison',    color: '#4fd17a', icon: 'drop' },
    burn:      { label: 'Burn',      color: '#ff9a4d', icon: 'flame' },
    stun:      { label: 'Stun',      color: '#f7a8ff', icon: 'spiral' },
    defdown:   { label: 'Defense down', color: '#8fc4ff', icon: 'shieldDown' },
    atkup:     { label: 'Attack up', color: '#ff9aa8', icon: 'arrowUp' },
    defup:     { label: 'Defense up', color: '#7cf5d3', icon: 'shieldUp' },
    immune:    { label: 'Immunity',  color: '#d9e2ff', icon: 'shieldCheck' },
    heal:      { label: 'Healing',   color: '#7dff9a', icon: 'plus' },
    hit:       { label: '',          color: '#ff8a9a', icon: 'burst' },  // a monster move: no damage element in the rules
    energy:    { label: 'energy',    color: '#ffb13b', icon: 'battery' },
    crit:      { label: 'Critical',  color: '#ffcf5a', icon: 'burst' },
    miss:      { label: 'Miss',      color: '#a79dc9', icon: 'dash' },
    capture:   { label: 'Snap Trap', color: '#7cf5d3', icon: 'trap' },
    flee:      { label: 'Escape',    color: '#a79dc9', icon: 'run' },
  };
  const STATUS_TEXT = { poison: 'is poisoned', burn: 'is burning', stun: 'is stunned', defdown: 'has lowered defense', atkup: 'has raised attack', defup: 'has raised defense', immune: 'is immune to poison, burn and weakness' };
  const PATHS = {
    blade: '<path d="M13.5 2.5 6 10l-1.5-.5.5 1.5-2 2 1 1 2-2 1.5.5-.5-1.5 7.5-7.5z"/>',
    bullet: '<path d="M2 6.5h7.5c2 0 4 .7 5 1.5-1 .8-3 1.5-5 1.5H2z"/>',
    spark: '<path d="M8 1l1.6 5.4L15 8l-5.4 1.6L8 15l-1.6-5.4L1 8l5.4-1.6z"/>',
    bolt: '<path d="M9.5 1 3 9h4.2L6 15l7-8.5H8.6z"/>',
    fang: '<path d="M2 3h12l-1.5 3.5L11 13l-1.6-4.5L8 13 6.6 8.5 5 13 3.5 6.5z"/>',
    drop: '<path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5z"/>',
    flame: '<path d="M8.6 1c.4 2.6 3.9 3.8 3.9 8a4.5 4.5 0 0 1-9 0c0-2.2 1.2-3.5 2.2-4.3 0 1.6.8 2.4 1.5 2.6C7 5 7.6 3 8.6 1z"/>',
    spiral: '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M8 8.2a.9.9 0 1 1 .9-.9 2.2 2.2 0 1 1-2.2-2.2 3.6 3.6 0 1 1-3.6 3.6 5 5 0 0 1 5-5"/>',
    shieldDown: '<path d="M8 1 2.5 3v4.5C2.5 11 5 13.6 8 15c3-1.4 5.5-4 5.5-7.5V3z" opacity=".45"/><path d="M7 4.5h2v4h2l-3 3.5-3-3.5h2z"/>',
    shieldUp: '<path d="M8 1 2.5 3v4.5C2.5 11 5 13.6 8 15c3-1.4 5.5-4 5.5-7.5V3z" opacity=".45"/><path d="M7 11.5h2v-4h2L8 4 5 7.5h2z"/>',
    shieldCheck: '<path d="M8 1 2.5 3v4.5C2.5 11 5 13.6 8 15c3-1.4 5.5-4 5.5-7.5V3z" opacity=".45"/><path d="m5 8 2 2 4-4.2 1 1L7 12 4 9z"/>',
    arrowUp: '<path d="M8 1.5 2.5 8h3.5v6.5h4V8h3.5z"/>',
    plus: '<path d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5z"/>',
    burst: '<path d="m8 .8 1.5 4.4 4.3-1.8-2 4.2 4.4 1.6-4.6 1 .9 4.6L8 12l-4.5 2.8.9-4.6-4.6-1 4.4-1.6-2-4.2 4.3 1.8z"/>',
    battery: '<path d="M2 4.5h10v7H2zM13 6.5h1.5v3H13z"/>',
    dash: '<path d="M2 7h12v2H2z"/>',
    trap: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2 7h12v2H2z"/><circle cx="8" cy="8" r="2"/>',
    run: '<path d="M2 7h8V3.5L15 8l-5 4.5V9H2z"/>',
  };
  const icon = k => `<svg class="cl-ic" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false">${PATHS[(FX[k] || {}).icon || k] || ''}</svg>`;
  const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = n => String(n || '').split(',')[0];
  const turnsOf = (u, s) => (u && u.status && u.status[s] && u.status[s].t) || 0;

  function create(B, opts = {}) {
    const log = { entries: [], turn: 1, hp: { hero: B.hero.hp, enemy: B.enemy.hp }, desyncs: 0, dropped: 0,
      names: { hero: B.hero.name, enemy: short(B.enemy.name) } };
    add(log, { kind: 'start', who: 'enemy', parts: [n(log, 'enemy'), t(` (${RARITY[B.m.rarity].name}${B.m.variant ? ' ' + variantLabel(B.m.variant) : ''}, Lv ${B.m.level}) appears! `), n(log, 'hero'), t(` faces it with ${B.hero.hp}/${B.hero.maxHp} HP.`)] });
    if (B.enemyFirst) add(log, { kind: 'note', who: 'enemy', parts: [n(log, 'enemy'), t(' is faster and strikes first.')] });
    if (opts.god) add(log, { kind: 'note', who: 'sys', parts: [t('God Mode (developer): your HP cannot drop in this battle.')] });
    B.log = log; return log;
  }
  // parts: {t: text} | {n: 'hero'|'enemy'} | {amt, fx, unit} | {fx, label}
  const t = s => ({ t: s }), n = (log, who) => ({ n: who });
  function add(log, e) {
    e.turn = log.turn; log.entries.push(e);
    if (log.entries.length > MAX) { log.entries.splice(0, log.entries.length - MAX); log.dropped++; }
    return e;
  }

  /* Ingest the events ONE engine call returned. `before` = { heroEnergy } taken just before the call. */
  function ingest(B, ev, before = {}) {
    const log = B.log || create(B);
    let actor = null, move = null, ability = null, hitNo = 0, actEntry = null;
    const hpTxt = who => ` (${log.hp[who]}/${B[who].maxHp})`;
    for (const e of ev || []) {
      switch (e.t) {
        case 'act': {
          actor = e.who; move = e.name; hitNo = 0;
          ability = e.who === 'enemy' ? (B.m.abilities.find(a => a.name === e.name) || null) : null;
          const W = WEAPONS[B.weapon];
          let parts;
          if (e.who === 'hero') {
            if (e.name === 'Flee') parts = [n(log, 'hero'), t(' tries to flee'), { fx: 'flee', label: '' }];
            else if (e.fx === 'item') parts = [n(log, 'hero'), t(` uses ${e.name}`)];
            else if (e.fx === 'trap') parts = [n(log, 'hero'), t(' throws a Snap Trap'), { fx: 'capture', label: '' }];
            else if (e.special) parts = [n(log, 'hero'), t(` unleashes ${e.name}`), t(` (${W.name})`)];
            else parts = [n(log, 'hero'), t(` attacks with the ${W.name}`)];
          } else parts = [n(log, 'enemy'), t(e.ability ? ` uses ${e.name}` : ' attacks'), ...(e.ultimate ? [t(' (Ultimate)')] : [])];
          actEntry = add(log, { kind: 'act', who: e.who, move: e.name, parts });
          break;
        }
        case 'hit': {
          hitNo++;
          const tgt = e.who, loss = e.lost != null ? e.lost : Math.min(log.hp[tgt], e.dmg); // the engine's own HP change
          log.hp[tgt] -= loss; // God Mode: the engine sends dmg 0 for the hunter
          const el = actor === 'hero' ? WEAPONS[B.weapon].el : null; // only weapons have damage elements
          const parts = [];
          const many = ev.filter(x => x.t === 'hit' || x.t === 'miss').length > 1;
          if (many) parts.push(t(`Hit ${hitNo}: `));
          parts.push(n(log, tgt), { amt: -loss, fx: el || 'hit', unit: 'HP', label: el ? FX[el].label : '' });
          // exact breakdown from the engine (build 21): `neutral` = this hit at ×1 effectiveness, `noCrit` = this hit
          // without its critical, both with the game's rounding; differences are whole HP and never invented
          const raw = e.god ? e.blocked : e.dmg;
          if (e.crit) parts.push({ fx: 'crit', label: e.noCrit != null && raw - e.noCrit > 0 ? `critical hit +${raw - e.noCrit} HP` : 'critical hit' });
          const delta = e.neutral != null ? raw - e.neutral : null;
          if (e.eff > 1) parts.push(t(delta > 0 ? ` · super effective +${delta} HP (${e.neutral} → ${raw})` : ' · super effective (no HP difference after rounding)'));
          else if (e.eff < 1) parts.push(t(delta < 0 ? ` · resisted −${-delta} HP (${e.neutral} → ${raw})` : ' · resisted (no HP difference after rounding)'));
          if (!e.god && loss < e.dmg) parts.push(t(` (hit for ${e.dmg}, only ${loss} HP left to take)`));
          if (e.god) parts.push(t(` (${e.blocked} blocked by God Mode)`));
          parts.push(t(hpTxt(tgt)));
          add(log, { kind: 'hit', who: tgt, by: actor, move, amount: -loss, el, crit: !!e.crit, sub: true, parts });
          break;
        }
        case 'miss': {
          hitNo++;
          const many = ev.filter(x => x.t === 'hit' || x.t === 'miss').length > 1;
          add(log, { kind: 'miss', who: e.who, by: actor, move, sub: true, parts: [...(many ? [t(`Hit ${hitNo}: `)] : []), n(log, e.who), t(' dodges'), { fx: 'miss', label: 'miss' }] });
          break;
        }
        case 'heal': {
          const who = e.who, gain = Math.min(B[who].maxHp - log.hp[who], e.amt);
          log.hp[who] += Math.max(0, gain);
          // who caused it, from the engine's own paths: a monster's drain or healing move, the hunter's
          // Vampire Fang charm (heals after the hunter's attack), or an item (the action row above names it)
          let why = '';
          if (who === 'enemy') why = ability && ability.effect === 'drain' ? ' drains life' : ' recovers';
          else if (actor === 'hero' && (move === 'Attack' || WEAPONS[B.weapon].special.name === move)) why = ` (${CHARMS.fang.name})`;
          const parts = [n(log, who), t(why), { amt: Math.max(0, gain), fx: 'heal', unit: 'HP', label: '' }];
          if (gain < e.amt) parts.push(t(` (capped at max HP)`));
          parts.push(t(hpTxt(who)));
          add(log, { kind: 'heal', who, by: actor, move, amount: Math.max(0, gain), sub: !!actor, parts });
          break;
        }
        case 'status': {
          const u = B[e.who], tr = turnsOf(u, e.s);
          add(log, { kind: 'status', who: e.who, s: e.s, by: actor, move, sub: !!actor, parts: [n(log, e.who), t(' ' + (STATUS_TEXT[e.s] || e.s)), { fx: e.s, label: (FX[e.s] || {}).label || e.s }, ...(tr ? [t(` · ${tr} turn${tr === 1 ? '' : 's'}`)] : [])] });
          break;
        }
        case 'dot': {
          const loss = Math.min(log.hp[e.who], e.dmg);
          log.hp[e.who] -= loss;
          add(log, { kind: 'dot', who: e.who, s: e.s, amount: -loss, parts: [n(log, e.who), t(' suffers'), { amt: -loss, fx: e.s, unit: 'HP', label: FX[e.s].label }, ...(e.god ? [t(` (${e.blocked} blocked by God Mode)`)] : []), t(hpTxt(e.who))] });
          break;
        }
        case 'expire':
          add(log, { kind: 'expire', who: e.who, s: e.s, parts: [n(log, e.who), t(`'s `), { fx: e.s, label: (FX[e.s] || {}).label || e.s, plainIcon: true }, t(' wore off')] });
          break;
        case 'capture':
          add(log, { kind: 'capture', ok: e.ok, sub: true, parts: e.ok ? [n(log, 'enemy'), t(' is caught in the Snap Trap!'), { fx: 'capture', label: '' }] : [n(log, 'enemy'), t(' broke free of the trap')] });
          break;
        case 'text': {
          if (/super effective|resists your weapon/i.test(e.msg)) break; // shown on each hit instead
          if (e.stun) { add(log, { kind: 'skip', who: e.who, parts: [n(log, e.who), t(' is stunned'), { fx: 'stun', label: 'Stun' }, t(': loses the turn')] }); break; }
          add(log, { kind: 'note', who: actor || 'sys', sub: !!actor, parts: [t(e.msg)] });
          break;
        }
        case 'end': {
          const R = { victory: [n(log, 'enemy'), t(' is defeated. Victory for '), n(log, 'hero'), t('!')], defeat: [n(log, 'hero'), t(' is knocked out. Defeat.')], captured: [n(log, 'enemy'), t(' is captured!')], fled: [n(log, 'hero'), t(' got away.')], escaped: [n(log, 'enemy'), t(' escaped.')] }[e.result] || [t(e.result)];
          add(log, { kind: 'end', result: e.result, parts: R });
          break;
        }
      }
    }
    // energy used or gained by this action (hunter only)
    if (actEntry && actEntry.who === 'hero' && typeof before.heroEnergy === 'number') {
      const d = B.hero.energy - before.heroEnergy;
      if (d) actEntry.parts.push({ amt: d, fx: 'energy', unit: 'energy', label: '' });
      actEntry.energy = d;
    }
    // the replay must match the engine exactly; otherwise count it and follow the engine
    for (const who of ['hero', 'enemy']) if (log.hp[who] !== B[who].hp) { log.desyncs++; log.hp[who] = B[who].hp; }
    return log;
  }
  function nextTurn(B) { if (B.log) { B.log.turn++; add(B.log, { kind: 'turn', parts: [t(`Turn ${B.log.turn}`)] }); } }

  function partHTML(log, p) {
    if (p.n) return `<b class="cl-name cl-${p.n}">${escH(log.names[p.n])}</b>`;
    if (p.t != null) return escH(p.t);
    const fx = FX[p.fx] || FX.hit;
    if (p.amt != null) {
      const sign = p.amt > 0 ? '+' : p.amt < 0 ? '−' : '±';
      return ` <span class="cl-fx" style="color:${fx.color}">${sign}${Math.abs(p.amt)} ${escH(p.unit)}${icon(p.fx)}${p.label ? ' ' + escH(p.label) : ''}</span>`;
    }
    return ` <span class="cl-fx" style="color:${fx.color}">${icon(p.fx)}${p.label ? ' ' + escH(p.label) : ''}</span>`;
  }
  function entryHTML(log, e) {
    if (e.kind === 'turn') return `<li class="cl-turn">${escH(e.parts[0].t)}</li>`;
    return `<li class="cl-row cl-k-${e.kind}${e.sub ? ' cl-sub' : ''}${e.who ? ' cl-w-' + e.who : ''}">${e.parts.map(p => partHTML(log, p)).join('')}</li>`;
  }
  function html(log) { return log ? (log.dropped ? '<li class="cl-turn">Older entries trimmed</li>' : '') + log.entries.map(e => entryHTML(log, e)).join('') : ''; }
  // plain text of an entry (tests, accessibility)
  const text = (log, e) => e.parts.map(p => p.n ? log.names[p.n] : p.t != null ? p.t : p.amt != null ? ` ${p.amt > 0 ? '+' : p.amt < 0 ? '−' : '±'}${Math.abs(p.amt)} ${p.unit}${p.label ? ' ' + p.label : ''}` : (p.label ? ' ' + p.label : '')).join('');
  return { create, ingest, nextTurn, html, entryHTML, text, FX, MAX };
})();
if (typeof module !== 'undefined') module.exports = { CombatLog };
