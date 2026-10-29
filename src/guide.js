/* SNAPMON — in-game Guide ("How to play"). Every number shown here is read from the game's own rule tables
   (MECH, STATUS_TURNS and RARITIES in game.js/data.js; FAMILIES, WEAPONS, ITEMS, RESEARCH, CHARMS in data.js),
   so the guide cannot drift from the rules: change a value there and the guide follows.
   Deliberately not shown: hidden safety nets the game does not advertise. */
'use strict';

const Guide = (() => {
  const SN = { poison: 'poison', burn: 'burn', stun: 'stun', defdown: 'DEF↓', atkup: 'ATK↑', defup: 'DEF↑', immune: 'immunity' };
  const pct = x => Math.round(x * 100) + '%';
  const pct1 = x => (Math.round(x * 1000) / 10) + '%';
  const T = STATUS_TURNS, X = MECH.status, C = MECH.capture, E = MECH.enc;
  const turns = n => n + (n === 1 ? ' turn' : ' turns');
  const el = id => `<span style="color:${ELEMENTS[id].color}">${ELEMENTS[id].name}</span>`;
  const famName = f => `<span style="color:${FAMILIES[f].color}">${FAMILIES[f].glyph} ${FAMILIES[f].name}</span>`;
  const weaponsWith = test => WEAPON_ORDER.filter(w => test(WEAPONS[w])).map(w => WEAPONS[w].name);
  const familiesUsing = eff => Object.keys(FAMILIES).filter(f => FAMILIES[f].abilities.some(a => a.effect === eff)).map(f => FAMILIES[f].name);
  const totalWeight = RARITIES.reduce((a, r) => a + r.weight, 0);

  const sections = [
    { id: 'hunt', title: 'Hunting & encounters', body: () => `
      <p>Photograph a real object with the Spirit Camera. The recognition engine runs on your phone and names the object; you can always reject a wrong answer before anything happens. Then the lens scans the object for a monster.</p>
      <ul>
        <li><b>Encounter chance:</b> ${pct(E.base)} per photo, <b>+${pct(E.newObj)}</b> for a kind of object you have never photographed, <b>+${pct(E.perMiss)}</b> for every quiet photo in a row.</li>
        <li>After <b>${E.pity}</b> quiet photos in a row the next new photo is a guaranteed encounter (${E.pitySensor} with the Paranormal Sensor research).</li>
        <li>Photographing the same kind of object three times in a row: <b>−${pct(E.sameObj)}</b>. The same view again: chance × ${E.dupMult}. Explore!</li>
        <li>Wide-Angle and Night Vision lenses (research) add <b>+${pct(E.lens)}</b> each.</li>
        <li>Your first ever monster is always a gentle Common one.</li>
      </ul>` },
    { id: 'combat', title: 'Combat basics', body: () => `
      <p>Battles are turn-based: you act, then the monster acts. Each turn you can <b>Attack</b>, use your weapon's <b>Special</b>, use an <b>Item</b>, throw a <b>Snap Trap</b> or try to <b>Flee</b>. Using an item takes your turn.</p>
      <ul>
        <li><b>Damage</b> = attack × move power × 25 ÷ (25 + defence), varying ±10%. Defence never blocks everything: every hit does at least 1.</li>
        <li><b>Who goes first:</b> you, unless the monster's speed is more than ${MECH.firstStrike}× yours.</li>
        <li><b>Hitting:</b> each weapon has an accuracy; you lose 1 percentage point for every point of speed the monster has over you. The Pistol never misses.</li>
        <li><b>Dodging:</b> you dodge a monster's hit ${pct(MECH.enemy.dodgeBase)} of the time, ${pct(MECH.enemy.dodgePerSpd)} more (or less) per point of speed you have over (or under) it, at most ${pct(MECH.enemy.dodgeMax)}.</li>
        <li><b>Critical hits:</b> yours depend on the weapon (and charms); a monster crits ${pct(MECH.enemy.crit)} of the time for ×${MECH.enemy.critX} damage.</li>
        <li><b>Monster abilities:</b> each monster has a signature move plus more moves the rarer it is (Legendaries add an Ultimate). After use, a move needs a few turns to recharge. A monster that can heal does so when below ${pct(MECH.enemy.healBelow)} HP.</li>
      </ul>` },
    { id: 'types', title: 'Damage types, weaknesses & resistances', body: () => `
      <p>Every weapon deals one damage type. Hitting a weakness does <b>×${MECH.weak}</b> damage ("super effective"); a resistance takes only <b>×${MECH.resist}</b>. A monster's family decides its weaknesses.</p>
      <div class="guide-table"><table><tr><th>Family</th><th>Weak to (×${MECH.weak})</th><th>Resists (×${MECH.resist})</th></tr>
      ${Object.keys(FAMILIES).map(f => `<tr><td>${famName(f)}</td><td>${FAMILIES[f].weak.map(el).join(', ')}</td><td>${FAMILIES[f].resist.map(el).join(', ') || '–'}</td></tr>`).join('')}</table></div>
      <p class="small muted">Weapons: ${WEAPON_ORDER.map(w => `${WEAPONS[w].name} = ${el(WEAPONS[w].el)}`).join(' · ')}. The family is shown next to every monster's name.</p>` },
    { id: 'status', title: 'Status effects', body: () => `
      <p>Effects tick and count down at the <b>start of the affected creature's turn</b>; "Lasts" below says what that means in practice. The same effect does not stack: applying it again only resets its timer (to the longer of the two). Different effects can be active at the same time.</p>
      <div class="guide-cards">
        ${statusCard('POISON', 'poison', `Loses ${pct(X.poisonPct)} of max HP (at least ${X.poisonMin}) at the start of each of its turns.`, `damage at the start of its next ${turns(T.poison)}`, `Cured by an Antidote. On a monster it adds +${pct(C.dot)} capture chance.`, [`Monsters: ${familiesUsing('poison').join(', ')}`, `Weapons: Cursed Dagger hits (${pct(WEAPONS.dagger.poison)}, only if not already poisoned) and Hex Flurry`])}
        ${statusCard('BURN', 'burn', `Loses ${pct(X.burnPct)} of max HP + ${X.burnFlat} at the start of each of its turns, and deals ${pct(1 - X.burnAtk)} less damage.`, `damage at the start of its next ${turns(T.burn)}; weaker attacks for its next ${T.burn - 1}`, `Cured by an Antidote. On a monster it adds +${pct(C.dot)} capture chance (not added again if also poisoned).`, [`Monsters: ${familiesUsing('burn').join(', ')}`, `Weapons: Arcane Wand special (Arcane Nova)`])}
        ${statusCard('STUN', 'stun', 'Loses its next turn.', T.stun === 1 ? 'its next turn' : `its next ${turns(T.stun)}`, `No cure: it wears off after one turn. A stunned monster is ${pct(X.stunAcc)} easier to hit and +${pct(C.stun)} easier to capture.`, [`Monsters: ${familiesUsing('stun').join(', ')}`, `Weapons: Thunder Hammer hits (${pct(WEAPONS.hammer.stun)}) and Thunderclap`])}
        ${statusCard('DEF↓', 'defdown', `Defence is halved (×${X.defdown}): it takes more damage.`, `the opponent's next ${T.defdown - 1} attacks against it`, 'Cured by an Antidote.', [`Monsters: ${familiesUsing('defdown').join(', ')}`, `Weapons: Rusty Hunter Sword special (Rusty Cleave)`])}
        ${statusCard('ATK↑', 'atkup', `Deals ×${X.atkup} damage.`, `its next ${T.atkup - 1} attacks`, 'Yours comes from a Strength Potion; monsters may power themselves up too.', [`Monsters: ${familiesUsing('atkup').join(', ')}`])}
        ${statusCard('DEF↑', 'defup', `Defence ×${X.defup}: takes less damage.`, `the opponent's next ${T.defup} attacks`, 'Yours comes from a Defense Potion; some monsters raise their own defence.', [`Monsters: ${familiesUsing('defup').join(', ')}`])}
        ${statusCard('IMMUNE', 'immune', 'Cannot be poisoned, burned, stunned or weakened (DEF↓).', `the monster's next ${turns(T.immune)}`, 'Given by an Antidote, together with the cure and +10 HP.', [])}
      </div>
      <p class="small muted">Example: your attack poisons a monster. It then loses HP at the start of each of its next ${T.poison} turns, and the poison is gone.</p>` },
    { id: 'energy', title: 'Energy & weapon specials', body: () => `
      <p>You start each battle with <b>${MECH.energy.start} energy</b> (+${MECH.energy.battery} with the Spare Battery charm). Every normal attack adds <b>+${MECH.energy.perAttack}</b> (up to ${MECH.energy.max}). A Special spends energy for a powerful move:</p>
      <div class="guide-table"><table><tr><th>Weapon</th><th>Normal attack</th><th>Special (cost)</th></tr>
      ${WEAPON_ORDER.map(w => { const W = WEAPONS[w], sp = W.special; return `<tr><td>${W.name}<br><span class="muted small">${el(W.el)}</span></td><td class="small">${W.hits ? W.hits + ' hits × ' + pct(W.hitPow) : '1 hit'} · accuracy ${pct(W.acc)} · crit ${pct(W.crit)} (×${W.critX})${W.pierce ? ` · ignores ${pct(W.pierce)} of defence` : ''}${W.poison ? ` · ${pct(W.poison)} poison` : ''}${W.stun ? ` · ${pct(W.stun)} stun` : ''}</td><td class="small"><b>${sp.name}</b> (${sp.cost}): ${pct(sp.power)} power${sp.hits ? ' × ' + sp.hits + ' hits' : ''}${sp.sure ? ', never misses' : ''}${sp.effect ? `, ${pct(sp.chance || 1)} ${SN[sp.effect]}` : ''}</td></tr>`; }).join('')}</table></div>
      <p class="small muted">Each upgrade level in the Arsenal adds 15% to the weapon's attack.</p>` },
    { id: 'capture', title: 'Capturing monsters', body: () => `
      <p>Throw a <b>Snap Trap</b> (uses one trap and your turn). Captured monsters join your collection and can become your hunting buddy.</p>
      <ul>
        <li>The base chance depends on rarity (below) and <b>rises as the monster's HP falls</b>: at full HP you get only ${pct(1 - C.hpWeight)} of the base chance, near 0 HP almost all of it.</li>
        <li><b>Stunned:</b> +${pct(C.stun)} · <b>poisoned or burning:</b> +${pct(C.dot)} · <b>Capture Enhancer:</b> +${pct(C.enhancer)} for the battle · <b>Reinforced / Quantum Traps</b> research: +${pct(C.research)} each · <b>Spirit Lens Cap</b> charm: +${pct(C.lenscap)}.</li>
        <li>Variants (Spectral, Mutated, Prismatic) are harder: chance × ${C.variantMult}.</li>
        <li>The chance is always between ${pct(C.min)} and ${pct(C.max)}. Epic and Legendary monsters may break free and vanish after ${C.escapeAfter} failed traps (${pct(C.escapeChance)} each time).</li>
        <li>With Quantum Traps, a failed trap comes back ${pct(C.quantumRefund)} of the time. Monster Analysis research shows the exact odds in battle.</li>
      </ul>` },
    { id: 'rarity', title: 'Rarity', body: () => `
      <p>When a monster appears, its rarity is rolled. The object you photographed does not change these odds.</p>
      <div class="guide-table"><table><tr><th>Rarity</th><th>Chance</th><th>Stats</th><th>Base capture</th><th>Level vs you</th><th>Rewards</th></tr>
      ${RARITIES.map(r => `<tr><td style="color:${r.color}"><b>${r.name}</b></td><td>${pct1(r.weight / totalWeight)}</td><td>×${r.mult} (HP ×${r.hpMult})</td><td>${pct(r.capture)}</td><td>${r.lvl[0] === r.lvl[1] ? (r.lvl[0] ? '+' + r.lvl[0] : 'same') : `+${r.lvl[0]} to +${r.lvl[1]}`}</td><td>×${r.xp}</td></tr>`).join('')}</table></div>
      <ul class="small"><li>Research: the Ectoplasmic Lens makes Rare, Epic and Legendary 40% more likely; the Legend Tracker doubles Legendary odds.</li>
        <li>Rarer monsters know more abilities; Legendaries also have an Ultimate and a title.</li>
        <li>Variants (unlocked by research): Spectral and Mutated forms (9% each) change the monster's family; Prismatic colours (1 in 12) give +8% stats and double coins.</li></ul>` },
    { id: 'levels', title: 'Levels & scaling', body: () => `
      <ul>
        <li>Win or capture to earn XP. Each hunter level: <b>+12 max HP, +2 attack, +1 defence, +1 speed</b>. A second charm slot opens at level 5.</li>
        <li>Monsters appear at about your level, higher for rarer ones (table above). Below level 3, monsters are at most one level above you; Commons are sometimes one level below.</li>
        <li>XP needed for the next level grows with each level.</li>
      </ul>` },
    { id: 'rewards', title: 'Rewards, defeat & healing', body: () => `
      <ul>
        <li><b>Victory:</b> XP, coins and materials (more for rarer, higher-level monsters); sometimes a potion or trap, a new weapon or a charm. You recover ${pct(MECH.afterWin)} of your max HP.</li>
        <li><b>Capture:</b> slightly less XP, half the coins and materials, but you keep the monster. First capture of a species: +3 RP.</li>
        <li><b>New species discovered:</b> research points (more for rare finds).</li>
        <li><b>Defeat:</b> you lose ${pct(MECH.defeatCoins)} of your coins and wake up with ${pct(MECH.defeatHp)} HP. Monsters are never lost.</li>
        <li><b>Fleeing:</b> ${pct(MECH.flee.base)} chance, +${pct(MECH.flee.perSpd)} per point of speed over the monster's, +${pct(MECH.flee.slipper)} with Haste Slippers, −${pct(MECH.flee.legendary)} against Legendaries (between ${pct(MECH.flee.min)} and ${pct(MECH.flee.max)}). A Smoke Bomb always works.</li>
        <li><b>Resting:</b> you heal ${pct(MECH.regenPerMin)} of your max HP per minute between battles.</li>
      </ul>` },
    { id: 'items', title: 'Items', body: () => `
      <div class="guide-table"><table><tr><th>Item</th><th>Effect</th><th>Shop</th></tr>
      ${ITEM_ORDER.map(id => `<tr><td>${ITEMS[id].name}</td><td class="small">${ITEMS[id].desc}${id === 'antidote' ? ` Also immunity for the monster's next ${turns(T.immune)}.` : ''}</td><td class="small">${ITEMS[id].price} coins</td></tr>`).join('')}</table></div>
      <p class="small muted">Items can also be crafted from materials in Gear → Shop &amp; Craft. Field Medicine research makes healing potions 30% stronger.</p>` },
    { id: 'gear', title: 'Gear, charms & hunting buddy', body: () => `
      <ul>
        <li><b>Weapons</b> unlock with coins and materials (or drop from beaten monsters) and can be upgraded up to level 5 (8 with Master Smithing).</li>
        <li><b>Charms</b> drop from beaten monsters; equip up to your slot count: ${CHARM_ORDER.map(c => `${CHARMS[c].name} (${CHARMS[c].desc.toLowerCase()})`).join(', ')}.</li>
        <li><b>Hunting buddy:</b> one captured monster can follow you, adding 8% of its HP and 12% of its attack and defence to yours.</li>
      </ul>` },
    { id: 'research', title: 'Research', body: () => `
      <p>Spend research points (RP) in the Lab. Some research needs an earlier one first.</p>
      <div class="guide-table"><table><tr><th>Research</th><th>RP</th><th>Effect</th></tr>
      ${RESEARCH.map(r => `<tr><td>${r.name}</td><td>${r.cost}</td><td class="small">${r.desc}${r.req ? ` <span class="muted">(needs ${RESEARCH_BY_ID[r.req].name})</span>` : ''}</td></tr>`).join('')}</table></div>` },
  ];

  function statusCard(label, cls, does, lasts, counter, sources) {
    return `<div class="guide-status"><span class="st ${cls}">${label}</span><div class="small"><b>Effect:</b> ${does}<br><b>Lasts:</b> ${lasts}<br><b>Counter:</b> ${counter}${sources.length ? `<br><span class="muted">${sources.join(' · ')}</span>` : ''}</div></div>`;
  }
  // accordion: each section expands on its own; the open one is remembered while the guide is open
  function html(open) {
    return `<div class="sheet-head"><h2>Guide</h2><button class="btn small ghost" data-act="closeSheet">Close</button></div>
      <p class="small muted" style="margin:0">How SNAPMON works. Numbers come straight from the game's rules.</p>
      ${sections.map(s => `<details class="guide-sec" data-sec="${s.id}"${s.id === open ? ' open' : ''}><summary>${s.title}</summary><div class="guide-body">${s.body()}</div></details>`).join('')}`;
  }
  return { html, sections };
})();
