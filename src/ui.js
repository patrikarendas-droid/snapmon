/* SNAPMON — user interface: screens, photo flow, discovery, battle playback, collection, gear, research, settings. */
'use strict';

let S = loadState();
const ui = { tab: 'hunt', dexView: 'captured', fR: 'all', fF: 'all', gearTab: 'arsenal', labTab: 'research', battle: null, busy: false, pending: null, lastSightings: [] };
const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fmtDate = t => t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
let saveTimer = null;
function persist(now) { clearTimeout(saveTimer); if (now) saveState(S); else saveTimer = setTimeout(() => saveState(S), 250); }
SFX.setMuted(S.settings.muted);

const ICON = {
  hunt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  dex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><circle cx="12" cy="8.5" r="1.6" fill="currentColor"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.5 4.5 19.5 4.5 19.5 9.5 9 20l-3-3z"/><path d="M5 14l5 5M3.5 20.5l2-2"/></svg>',
  lab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  gallery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/></svg>',
  live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>',
};

/* ---------- toasts ---------- */
function toast(msg, kind = '') {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3200);
}

/* ---------- helpers for sprites ---------- */
function spriteHTML(dna, { size = 160, rarity = 'common', variant = null, cls = '' } = {}) {
  const tier = RARITY[rarity].tier;
  const sparks = tier >= 3 || variant === 'shiny' ? [0, 1, 2, 3, 4].map(i => `<i class="spark" style="left:${10 + i * 19}%;top:${20 + (i % 3) * 22}%;animation-delay:${i * 0.45}s"></i>`).join('') : '';
  return `<div class="sprite ${variant || ''} ${dna.shape === 'cloth' || dna.shape === 'key' || variant === 'spectral' ? 'hover' : ''} ${cls}" style="--rc:${RARITY[rarity].color};width:${size}px;max-width:100%">
    ${tier >= 2 || variant ? '<i class="aura"></i>' : ''}${sparks}<img class="px" alt="" src="${spriteURL(dna, 5)}" style="width:100%"></div>`;
}
const rarityChip = r => `<span class="chip r" style="color:${RARITY[r].color}">${RARITY[r].name.toUpperCase()}</span>`;
const famChip = f => `<span class="chip" style="color:${FAMILIES[f].color}">${FAMILIES[f].glyph} ${FAMILIES[f].name}</span>`;
const varChip = v => v ? `<span class="chip" style="color:var(--violet)">${variantLabel(v)}</span>` : '';
function monsterTitle(m) { return m.nick ? esc(m.nick) : esc(m.name); }
function catLabel(m) { return m.cat === 'other' && m.word ? `“${esc(m.word)}”` : esc(CATEGORY[m.cat].name); }

/* ---------- top bar & tabs ---------- */
function renderTop() {
  regen(S);
  const hs = hunterStats(S), need = xpFor(S.level), hpPct = S.hp / hs.maxHp * 100;
  $('#topbar').innerHTML = `
    <div class="lvl-badge" aria-label="Hunter level ${S.level}"><div><span>LV</span><b>${S.level}</b></div></div>
    <div class="bars">
      <div class="bar-row"><span class="lbl">HP</span><div class="bar hp ${hpPct > 40 ? 'ok' : ''}"><i style="width:${hpPct}%"></i></div><span class="val">${S.hp}/${hs.maxHp}</span></div>
      <div class="bar-row"><span class="lbl">XP</span><div class="bar xp"><i style="width:${S.xp / need * 100}%"></i></div><span class="val">${S.xp}/${need}</span></div>
    </div>
    <div class="top-right">
      <div class="wallet"><span class="c">${S.coins}¢</span><span class="r">${S.rp} RP</span></div>
      <button class="icon-btn" data-act="mute" aria-label="${S.settings.muted ? 'Unmute sound' : 'Mute sound'}">${S.settings.muted ? ICON.mute : ICON.sound}</button>
      <button class="icon-btn" data-act="settings" aria-label="Settings and save data">${ICON.cog}</button>
    </div>`;
}
function claimableQuests() { return activeQuests(S).filter(q => questProgress(S, q) >= q.target).length; }
function renderTabs() {
  const tabs = [['hunt', 'Hunt'], ['dex', 'Monsters'], ['gear', 'Gear'], ['lab', 'Lab']];
  const dot = { lab: claimableQuests() > 0 || RESEARCH.some(r => !S.research[r.id] && S.rp >= r.cost && (!r.req || S.research[r.req])) };
  $('#tabs').innerHTML = tabs.map(([id, label]) => `<button class="${ui.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}" aria-current="${ui.tab === id}">${ICON[id]}${label}${dot[id] ? '<i class="dot"></i>' : ''}</button>`).join('');
}
function render() {
  renderTop(); renderTabs();
  const el = $('#screen');
  el.innerHTML = ({ hunt: huntScreen, dex: dexScreen, gear: gearScreen, lab: labScreen })[ui.tab]();
  el.classList.remove('screen-enter'); void el.offsetWidth; el.classList.add('screen-enter');
  if (ui.tab === 'hunt' && Photo.live.isOpen()) Photo.live.attach($('#liveVideo'));
  else if (ui.tab !== 'hunt' && Photo.live.isOpen()) { ui.liveWanted = false; Photo.live.close(); }
}

/* ---------- HUNT ---------- */
function huntScreen() {
  const hs = hunterStats(S), low = S.hp < hs.maxHp * 0.35;
  const quests = activeQuests(S);
  const ghost = S.monsters.length ? S.monsters[S.monsters.length - 1].dna : null;
  const live = ui.liveWanted || Photo.live.isOpen();
  return `
  <section class="viewfinder" id="vf">
    ${live ? '<video id="liveVideo" autoplay playsinline muted></video>' : ''}
    ${ghost && !live ? `<img class="vf-ghost px" alt="" src="${spriteURL(ghost, 3)}">` : ''}
    <i class="vf-corner tl"></i><i class="vf-corner tr"></i><i class="vf-corner bl"></i><i class="vf-corner br"></i><i class="vf-sweep"></i>
    ${live ? '' : `<div class="vf-center"><div><h1>Monsters hide <em>in plain sight</em></h1>
      <p>${S.stats.photos === 0 ? 'Photograph any real object near you — a mug, a shoe, a plant — and see what lives inside it.' : 'Snap a new object. Different things attract different creatures.'}</p></div></div>`}
    <div class="vf-hud"><span class="rec">SPIRIT CAM</span><span>${S.stats.photos} SNAPS · ${Object.keys(S.dex).length} SPECIES</span></div>
  </section>
  <div class="shutter-row">
    <label class="side-btn" for="galInput"><span class="ic">${ICON.gallery}</span>Gallery</label>
    ${live ? `<button class="shutter" data-act="liveSnap" aria-label="Take photo">SNAP</button>`
           : `<label class="shutter" for="camInput" role="button" aria-label="Open camera and take a photo">SNAP</label>`}
    ${live ? `<button class="side-btn" data-act="liveClose"><span class="ic">✕</span>Close</button>`
           : Photo.live.supported() ? `<button class="side-btn" data-act="liveOpen"><span class="ic">${ICON.live}</span>Live view</button>` : '<span></span>'}
  </div>
  ${low ? `<div class="card warn row"><div class="grow"><b>You're badly hurt.</b><div class="small muted">Monsters hit hard. Heal up before your next hunt — you also recover slowly over time.</div></div>
    ${S.items.potion ? `<button class="btn small" data-act="quickHeal">Drink potion (${S.items.potion})</button>` : `<button class="btn small" data-act="tab" data-arg="gear">Shop</button>`}</div>` : ''}
  <section class="card">
    <div class="section-title"><h2>Hunter's orders</h2><span class="small muted">${Object.keys(S.questsClaimed).length}/${QUESTS.length} done</span></div>
    ${quests.length ? quests.map(questHTML).join('') : '<p class="muted">Every order is complete. You are a legend of the hunt.</p>'}
  </section>
  ${ui.lastSightings.length ? `<section class="stack"><div class="section-title"><h2>Recent sightings</h2></div>
    <div class="sightings">${ui.lastSightings.map(s => `<div class="sighting"><img class="px" alt="" src="${spriteURL(s.dna, 3)}">${esc(s.name.split(',')[0])}<br><span style="color:${RARITY[s.rarity].color}">${s.outcome}</span></div>`).join('')}</div></section>` : ''}
  <p class="notice">Your photos stay on this phone. SNAPMON reads only colours and a similarity fingerprint from each picture, then throws the image away.</p>`;
}
function questHTML(q) {
  const p = questProgress(S, q), done = p >= q.target;
  const rw = Object.entries(q.reward).map(([k, v]) => rewardLabel(k, v)).join(', ');
  return `<div class="quest"><h3>${esc(q.name)}</h3>${done ? `<button class="btn small primary" data-act="claim" data-arg="${q.id}">Claim</button>` : `<span class="small muted num">${p}/${q.target}</span>`}
    <p>${esc(q.desc)} <span style="color:var(--flash)">· ${esc(rw)}</span></p><div class="bar"><i style="width:${p / q.target * 100}%"></i></div></div>`;
}

/* ---------- photo flow ---------- */
async function onPhotoFile(file) {
  SFX.shutter();
  try {
    const { img, url } = await Photo.loadFile(file);
    beginIdentify(img, url);
  } catch (e) { toast(e.message, 'bad'); }
}
async function openLive() {
  ui.tab = 'hunt'; ui.liveWanted = true; render();
  try { await Photo.live.open($('#liveVideo')); }
  catch (e) {
    ui.liveWanted = false; Photo.live.close(); render();
    toast(e && e.name === 'NotAllowedError' ? 'Camera permission was refused. The SNAP button still works — it opens your camera app.' : 'Live view is not available here. The SNAP button still opens your phone camera.', 'bad');
  }
}
function closeLive() { ui.liveWanted = false; Photo.live.close($('#liveVideo')); render(); }
function liveSnap() {
  const v = $('#liveVideo'); if (!v || !v.videoWidth) return;
  SFX.shutter();
  const canvas = Photo.live.snap(v);
  ui.liveWanted = false; Photo.live.close(v); render();
  beginIdentify(canvas, canvas.toDataURL('image/jpeg', 0.85));
}

function beginIdentify(img, url) {
  const photo = Photo.analyze(img);
  const thumb = S.settings.keepPhotos ? Photo.thumbnail(img) : null;
  ui.pending = { img, url, photo, thumb, cat: null, word: '', ai: null };
  showIdentify();
  if (S.settings.aiLens) runAI();
}
async function runAI() {
  const p = ui.pending; if (!p) return;
  p.ai = { state: 'loading' }; refreshAI();
  const model = await Photo.ai.load();
  if (ui.pending !== p) return;
  if (!model) { p.ai = { state: 'failed', error: Photo.ai.error }; refreshAI(); return; }
  try { p.ai = { state: 'ready', preds: await Photo.ai.classify(p.img) }; } catch (e) { p.ai = { state: 'failed', error: String(e.message || e) }; }
  refreshAI();
}
function aiHTML() {
  const p = ui.pending; if (!p || !S.settings.aiLens || !p.ai) return '';
  if (p.ai.state === 'loading') return `<div class="ai-box">AI Lens is analysing your photo on this device… (the first run downloads the model)</div>`;
  if (p.ai.state === 'failed') return `<div class="ai-box">AI Lens could not load here, so it can't suggest anything (${esc(p.ai.error)}). Pick the object yourself below — that always works.</div>`;
  const preds = p.ai.preds.filter(x => x.prob > 0.04).slice(0, 3);
  if (!preds.length) return `<div class="ai-box">AI Lens isn't sure what this is. Pick the object yourself below.</div>`;
  return `<div class="ai-box">AI Lens guesses (on-device, can be wrong — confirm it):<br>${preds.map(x =>
    `<button class="btn small" data-act="aiPick" data-arg="${x.cat || 'other'}" data-word="${esc(x.label)}">${esc(x.label)} · ${Math.round(x.prob * 100)}%${x.cat ? ' → ' + esc(CATEGORY[x.cat].name) : ''}</button>`).join('')}</div>`;
}
function refreshAI() { const el = $('#aiSlot'); if (el) el.innerHTML = aiHTML(); }
function showIdentify() {
  const p = ui.pending;
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner">
    <div class="sheet-head"><h2>What did you photograph?</h2><button class="btn small ghost" data-act="cancelPhoto">Cancel</button></div>
    <div class="photo-frame"><img alt="Your photo" src="${p.url}"><i class="vf-corner tl"></i><i class="vf-corner tr"></i><i class="vf-corner bl"></i><i class="vf-corner br"></i></div>
    <div class="row small muted"><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${p.photo.swatch};border:1px solid var(--line)"></span>
      Ecto-signature read from the photo's colours. ${S.settings.aiLens ? '' : 'Tell the camera what the object is:'}</div>
    <div id="aiSlot">${aiHTML()}</div>
    <input class="search" id="objSearch" type="text" inputmode="text" autocomplete="off" placeholder="Type it: “kettle”, “sock”, “umbrella”…" value="${esc(p.word)}">
    <div id="typedHint"></div>
    <div class="cat-grid" id="catGrid">${CATEGORIES.filter(c => c.id !== 'other').map(c => `<button class="cat-btn" data-act="pickCat" data-arg="${c.id}"><span class="e">${c.icon}</span>${esc(c.name)}</button>`).join('')}</div>
  </div></div>`;
  const inp = $('#objSearch');
  inp.addEventListener('input', () => {
    p.word = inp.value.trim();
    const m = matchCategory(p.word), q = p.word.toLowerCase();
    document.querySelectorAll('#catGrid .cat-btn').forEach(b => {
      const c = CATEGORY[b.dataset.arg];
      b.classList.toggle('hint', !!m && b.dataset.arg === m);
      b.hidden = q.length > 1 && !m && !c.name.toLowerCase().includes(q);
    });
    $('#typedHint').innerHTML = p.word.length > 1 ? (m
      ? `<button class="btn block ecto" data-act="pickCat" data-arg="${m}">Scan “${esc(p.word)}” as ${esc(CATEGORY[m].name)}</button>`
      : `<button class="btn block ecto" data-act="pickCat" data-arg="other">Scan “${esc(p.word)}” as something new</button>`) : '';
  });
}
function cancelPhoto() {
  if (ui.pending && ui.pending.url && ui.pending.url.startsWith('blob:')) URL.revokeObjectURL(ui.pending.url);
  ui.pending = null; $('#overlay').innerHTML = '';
}

async function scan(cat, word) {
  const p = ui.pending; if (!p) return;
  if (cat !== 'other' && word && matchCategory(word) !== cat) word = ''; // the typed text was only a filter
  if (cat === 'other' && !word) word = 'mystery object';
  $('#overlay').innerHTML = `<div class="overlay scanning"><div class="overlay-inner" style="justify-content:center">
    <h2 style="text-align:center">Scanning for supernatural activity…</h2>
    <div class="photo-frame"><img alt="" src="${p.url}"><i class="vf-sweep"></i>
      <div class="scan-hud">${SCAN_READOUTS.slice(0, 4).map((r, i) => `<div class="meter"><span>${r}</span><i><b id="mt${i}"></b></i><span id="mv${i}">0.0</span></div>`).join('')}</div></div>
    <p class="muted" style="text-align:center">Object: <b style="color:var(--text)">${esc(word && cat === 'other' ? word : CATEGORY[cat].name)}</b></p>
  </div></div>`;
  SFX.scan();
  const result = resolvePhoto(S, cat, p.photo, word);
  const strength = result.encounter ? 0.55 + RARITY[result.monster.rarity].tier * 0.11 : 0.25;
  for (let step = 0; step < 6; step++) {
    await wait(220);
    for (let i = 0; i < 4; i++) {
      const v = Math.min(1, Math.random() * 0.5 + strength * (step / 5) + (Math.random() - 0.5) * 0.2);
      const b = $('#mt' + i), t = $('#mv' + i); if (b) b.style.width = (v * 100) + '%'; if (t) t.textContent = (v * 9.9).toFixed(1);
    }
  }
  await wait(250);
  if (p.url && p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
  const thumb = p.thumb; ui.pending = null;
  if (!result.encounter) {
    SFX.nothing(); persist();
    $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="justify-content:center;text-align:center;gap:18px">
      <h2 style="font-size:28px;color:var(--muted)">${result.dup ? 'Already scanned' : 'All quiet'}</h2>
      <p style="font-size:18px">${esc(result.line)}</p>
      <p class="small muted">${result.dup ? 'Try a different object or a new angle.' : 'Keep hunting — every quiet snap builds up spirit pressure for the next one.'}</p>
      <label class="btn primary block" for="camInput" data-act="closeOverlay">Snap another object</label>
      <button class="btn ghost" data-act="closeOverlay">Back</button></div></div>`;
    render(); return;
  }
  const m = result.monster; if (thumb) m.thumb = thumb;
  const seen = recordSighting(S, m);
  persist();
  showDiscovery(m, seen);
}

/* ---------- discovery ---------- */
function showDiscovery(m, seen) {
  const r = RARITY[m.rarity], tier = r.tier;
  if (tier >= 4) SFX.legendary(); else if (tier >= 2 || m.variant) SFX.rare(); else SFX.encounter();
  const analysis = !!S.research.analysis;
  $('#overlay').innerHTML = `<div class="overlay discovery" style="--rc:${r.color}">
    ${tier >= 1 ? '<div class="disc-rays"></div>' : ''}${tier >= 2 ? '<div class="disc-flash"></div>' : ''}
    <div class="overlay-inner" style="justify-content:center;align-items:center;position:relative">
      <p class="small" style="letter-spacing:.2em;color:var(--ecto)">${m.first ? 'YOUR FIRST MONSTER!' : 'SUPERNATURAL ACTIVITY DETECTED'}</p>
      <div class="disc-sprite">${spriteHTML(m.dna, { size: 220, rarity: m.rarity, variant: m.variant })}</div>
      <div class="rarity-banner" style="color:${r.color}">${r.name.toUpperCase()}${m.variant ? ' · ' + variantLabel(m.variant).toUpperCase() : ''}</div>
      <h1 class="disc-name">${esc(m.name)}</h1>
      <div class="row wrap" style="justify-content:center">${famChip(m.fam)}<span class="chip">Lv ${m.level}</span><span class="chip">from ${catLabel(m)}</span></div>
      ${seen.isNew ? `<span class="new-tag">NEW SPECIES · +${seen.rp} RP</span>` : ''}
      <p class="muted" style="max-width:34ch">${esc(CATEGORY[m.cat].flavor)}</p>
      ${analysis ? `<p class="small muted num">HP ${m.stats.hp} · ATK ${m.stats.atk} · DEF ${m.stats.def} · SPD ${m.stats.spd} · weak to ${FAMILIES[m.fam].weak.map(e => ELEMENTS[e].name).join(', ')}</p>` : ''}
      <div class="stack" style="width:100%;max-width:340px">
        <button class="btn primary block" data-act="fight" style="font-size:18px;min-height:56px">Fight!</button>
        <button class="btn ghost block" data-act="ignore">Let it slip away</button>
      </div>
    </div></div>`;
  if (tier >= 3) { const o = $('.overlay'); o.classList.add('shake'); }
  ui.discovered = m;
  ui.lastSightings = [{ dna: m.dna, name: m.name, rarity: m.rarity, outcome: 'sighted' }, ...ui.lastSightings].slice(0, 8);
}

/* ---------- battle ---------- */
function startBattle(m) {
  const B = newBattle(S, m); ui.battle = B; ui.busy = false;
  B.disp = { hero: B.hero.hp, enemy: B.enemy.hp };
  renderBattle();
  if (B.enemyFirst) { ui.busy = true; setLog(`${B.enemy.name} is faster and strikes first!`); setTimeout(() => runEnemy(), 700); }
  else setLog(`What will you do?`);
}
function statusChips(u) {
  const names = { poison: 'POISON', burn: 'BURN', stun: 'STUN', defdown: 'DEF↓', atkup: 'ATK↑', defup: 'DEF↑', immune: 'IMMUNE' };
  return Object.keys(u.status).map(s => `<span class="st ${s}">${names[s] || s}</span>`).join('');
}
function renderBattle() {
  const B = ui.battle, m = B.m, W = WEAPONS[B.weapon], comp = companionOf(S);
  const cap = captureChance(S, B), analysis = !!S.research.analysis;
  const capTxt = analysis ? Math.round(cap * 100) + '%' : cap > 0.6 ? 'High' : cap > 0.3 ? 'Medium' : 'Low';
  const hunter = renderHunter(document.createElement('canvas'), B.weapon, 6).toDataURL();
  $('#overlay').innerHTML = `<div class="overlay battle"><div class="overlay-inner" id="battleRoot">
    <div class="arena" id="arena" style="--fc:${FAMILIES[m.fam].color}">
      <div class="hp-card foe-card"><div class="nm"><span>${esc(B.enemy.name.split(',')[0])}</span><span class="lv">Lv ${m.level}</span></div>
        <div class="row" style="gap:6px"><span class="chip r" style="color:${RARITY[m.rarity].color};font-size:9.5px;padding:1px 6px">${RARITY[m.rarity].name.toUpperCase()}</span><span class="small" style="color:${FAMILIES[m.fam].color}">${FAMILIES[m.fam].glyph} ${FAMILIES[m.fam].name}</span></div>
        <div class="bar hp ok"><i id="ehp" style="width:${B.disp.enemy / B.enemy.maxHp * 100}%"></i></div>
        ${analysis ? `<div class="small muted num" id="ehpTxt">${B.disp.enemy}/${B.enemy.maxHp}</div>` : ''}
        <div class="st-row" id="est">${statusChips(B.enemy)}</div></div>
      <div class="foe" id="foe">${spriteHTML(m.dna, { size: 400, rarity: m.rarity, variant: m.variant })}<i class="plat"></i></div>
      <div class="hero" id="hero"><img class="hunter px" alt="Your hunter" src="${hunter}">${comp ? `<img class="comp px" alt="" src="${spriteURL(comp.dna, 3)}">` : ''}<i class="plat"></i></div>
      <div class="hp-card hero-card"><div class="nm"><span>You</span><span class="lv">Lv ${S.level}</span></div>
        <div class="bar hp ok"><i id="hhp" style="width:${B.disp.hero / B.hero.maxHp * 100}%"></i></div>
        <div class="small muted num" id="hhpTxt">${B.disp.hero}/${B.hero.maxHp} HP</div>
        <div class="bar en" title="Energy"><i id="hen" style="width:${B.hero.energy}%"></i></div>
        <div class="st-row" id="hst">${statusChips(B.hero)}</div></div>
    </div>
    <div class="battle-log" id="blog">…</div>
    <div class="actions ${ui.busy ? 'busy' : ''}" id="actions">
      <button class="act attack" data-act="bAttack">Attack<small>${esc(W.name.split(' ').slice(-1)[0])} · ${ELEMENTS[W.el].name}</small></button>
      <button class="act special" data-act="bSpecial" ${B.hero.energy < W.special.cost ? 'disabled' : ''}>${esc(W.special.name)}<small>${W.special.cost} energy</small></button>
      <button class="act" data-act="bItems">Items<small>${BATTLE_ITEMS.reduce((a, k) => a + (S.items[k] || 0), 0)} in bag</small></button>
      <button class="act capture" data-act="bCapture" ${S.items.trap ? '' : 'disabled'}>Capture<small>${S.items.trap} traps · ${capTxt}</small></button>
      <button class="act" data-act="bFlee">Flee<small>${analysis ? Math.round(fleeChance(S, B) * 100) + '%' : 'escape'}</small></button>
      <button class="act" data-act="bInfo">Intel<small>${analysis ? 'full scan' : 'basic'}</small></button>
    </div>
  </div></div>`;
}
function setLog(msg) { const el = $('#blog'); if (el) el.textContent = msg; }
function refreshBattleBars() {
  const B = ui.battle; if (!B) return;
  const e = $('#ehp'), h = $('#hhp'), en = $('#hen'), ht = $('#hhpTxt'), et = $('#ehpTxt');
  if (e) { e.style.width = (B.disp.enemy / B.enemy.maxHp * 100) + '%'; e.parentElement.classList.toggle('ok', B.disp.enemy > B.enemy.maxHp * 0.35); }
  if (h) { h.style.width = (B.disp.hero / B.hero.maxHp * 100) + '%'; h.parentElement.classList.toggle('ok', B.disp.hero > B.hero.maxHp * 0.35); }
  if (ht) ht.textContent = `${B.disp.hero}/${B.hero.maxHp} HP`;
  if (et) et.textContent = `${B.disp.enemy}/${B.enemy.maxHp}`;
  if (en) en.style.width = B.hero.energy + '%';
  const es = $('#est'), hs = $('#hst'); if (es) es.innerHTML = statusChips(B.enemy); if (hs) hs.innerHTML = statusChips(B.hero);
}
function refreshActions() {
  const B = ui.battle; if (!B || B.over) return;
  const a = $('#actions'); if (!a) return;
  a.classList.toggle('busy', ui.busy);
  const sp = a.querySelector('[data-act="bSpecial"]'); if (sp) sp.disabled = B.hero.energy < WEAPONS[B.weapon].special.cost;
  const cap = captureChance(S, B), analysis = !!S.research.analysis;
  const c = a.querySelector('[data-act="bCapture"]');
  if (c) { c.disabled = !S.items.trap; c.querySelector('small').textContent = `${S.items.trap} traps · ${analysis ? Math.round(cap * 100) + '%' : cap > 0.6 ? 'High' : cap > 0.3 ? 'Medium' : 'Low'}`; }
  const it = a.querySelector('[data-act="bItems"] small'); if (it) it.textContent = `${BATTLE_ITEMS.reduce((x, k) => x + (S.items[k] || 0), 0)} in bag`;
}
function arenaPoint(who) {
  const ar = $('#arena'), el = who === 'enemy' ? $('#foe') : $('#hero');
  if (!ar || !el) return { x: 0, y: 0 };
  const a = ar.getBoundingClientRect(), b = el.getBoundingClientRect();
  return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height * 0.45 };
}
function floatText(who, text, cls = '', color = '') {
  const ar = $('#arena'); if (!ar) return;
  const p = arenaPoint(who), el = document.createElement('div');
  el.className = 'float ' + cls; el.textContent = text; if (color) el.style.color = color;
  el.style.left = (p.x + (Math.random() * 30 - 15)) + 'px'; el.style.top = (p.y - 20) + 'px';
  ar.appendChild(el); setTimeout(() => el.remove(), 1000);
}
function spawnFx(kind) {
  const ar = $('#arena'); if (!ar) return 0;
  const from = arenaPoint('hero'), to = arenaPoint('enemy'), el = document.createElement('div');
  el.className = 'fx ' + kind;
  if (kind === 'bullet' || kind === 'orb' || kind === 'trap') {
    el.style.left = (from.x + 30) + 'px'; el.style.top = (from.y - 10) + 'px';
    el.style.setProperty('--dx', (to.x - from.x - 40) + 'px'); el.style.setProperty('--dy', (to.y - from.y) + 'px');
    if (kind === 'bullet') el.style.transform = `rotate(${Math.atan2(to.y - from.y, to.x - from.x)}rad)`;
    if (kind === 'trap') { el.style.transition = 'transform .45s cubic-bezier(.3,.7,.4,1)'; ar.appendChild(el); requestAnimationFrame(() => { el.style.transform = `translate(${to.x - from.x - 40}px, ${to.y - from.y + 30}px) rotate(540deg)`; }); return el; }
  } else if (kind === 'bolt') { el.style.left = (to.x - 30) + 'px'; const f = document.createElement('div'); f.className = 'arena-flash'; ar.appendChild(f); setTimeout(() => f.remove(), 320); }
  else if (kind === 'hex') { el.textContent = '✕'; el.style.left = (to.x - 14) + 'px'; el.style.top = (to.y - 24) + 'px'; }
  else if (kind === 'impact') { el.style.left = (to.x - 35) + 'px'; el.style.top = (to.y - 35) + 'px'; }
  else { el.style.left = (to.x - ar.clientWidth * 0.23) + 'px'; el.style.top = (to.y - ar.clientWidth * 0.23) + 'px'; }
  ar.appendChild(el); setTimeout(() => el.remove(), 600);
  return el;
}
function heroImpact() {
  const ar = $('#arena'); if (!ar) return;
  const p = arenaPoint('hero'), el = document.createElement('div'); el.className = 'fx impact';
  el.style.left = (p.x - 35) + 'px'; el.style.top = (p.y - 35) + 'px'; ar.appendChild(el); setTimeout(() => el.remove(), 400);
}
function anim(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 700); }
const STATUS_NAME = { poison: 'Poisoned', burn: 'Burning', stun: 'Stunned', defdown: 'Defense down', atkup: 'Attack up', defup: 'Defense up', immune: 'Immune' };

async function play(events) {
  const B = ui.battle;
  let lastFx = 'slash';
  for (const e of events) {
    if (!ui.battle) return;
    switch (e.t) {
      case 'act': {
        const actor = e.who === 'hero' ? 'You' : B.enemy.name.split(',')[0];
        if (e.who === 'hero') {
          setLog(e.name === 'Attack' ? `You attack with the ${WEAPONS[B.weapon].name}!` : e.name === 'Flee' ? 'You try to run…' : e.fx === 'item' ? `You use ${e.name}.` : e.fx === 'trap' ? 'You hurl a Snap Trap!' : `You unleash ${e.name}!`);
          if (e.fx === 'trap') break;
          if (e.fx && e.fx !== 'item') { anim($('#hero'), 'lunge-r'); lastFx = e.fx; await wait(e.special ? 320 : 180); }
          else await wait(350);
        } else {
          setLog(e.ability ? `${actor} uses ${e.name}!` : `${actor} attacks!`);
          if (e.ultimate) { const o = $('.overlay'); anim(o, 'shake'); }
          anim($('#foe'), 'lunge-l'); await wait(e.ability ? 420 : 260);
        }
        break;
      }
      case 'hit': {
        if (e.who === 'enemy') {
          spawnFx(lastFx); SFX.hit(lastFx); await wait(lastFx === 'orb' ? 300 : 120);
          B.disp.enemy = Math.max(0, B.disp.enemy - e.dmg);
          anim($('#foe img'), 'hitflash');
          floatText('enemy', (e.crit ? 'CRIT ' : '') + e.dmg, e.crit ? 'crit' : '', e.eff > 1 ? '#ffe55c' : e.eff < 1 ? '#a0a0b8' : '#fff');
          if (e.crit) anim($('.overlay'), 'shake');
        } else {
          heroImpact(); SFX.hurt();
          B.disp.hero = Math.max(0, B.disp.hero - e.dmg);
          anim($('#hero img'), 'hitflash');
          floatText('hero', (e.crit ? 'CRIT ' : '') + e.dmg, e.crit ? 'crit' : '', '#ff8a9a');
          if (e.crit) anim($('.overlay'), 'shake');
        }
        refreshBattleBars(); await wait(380); break;
      }
      case 'miss': SFX.miss(); floatText(e.who, 'MISS', '', '#a0a0b8'); setLog(e.who === 'enemy' ? 'Missed!' : 'You dodged it!'); await wait(380); break;
      case 'heal': SFX.heal(); B.disp[e.who] = Math.min(B[e.who].maxHp, B.disp[e.who] + e.amt); floatText(e.who, '+' + e.amt, '', '#7dff9a'); refreshBattleBars(); await wait(380); break;
      case 'status': SFX.status(); floatText(e.who, STATUS_NAME[e.s] || e.s, '', '#d6a2ff'); refreshBattleBars(); await wait(360); break;
      case 'dot': B.disp[e.who] = Math.max(0, B.disp[e.who] - e.dmg); floatText(e.who, e.dmg, '', e.s === 'poison' ? '#c48bff' : '#ffae5c'); setLog(`${e.who === 'hero' ? 'You take' : B.enemy.name.split(',')[0] + ' takes'} ${e.s} damage.`); refreshBattleBars(); await wait(420); break;
      case 'expire': refreshBattleBars(); break;
      case 'text': setLog(e.msg); await wait(e.stun ? 650 : 520); break;
      case 'capture': await captureAnim(e.ok); break;
      case 'end': break;
    }
  }
  B.disp.hero = B.hero.hp; B.disp.enemy = B.enemy.hp; refreshBattleBars();
}
async function captureAnim(ok) {
  const trap = spawnFx('trap'); const foe = $('#foe img');
  await wait(480);
  if (foe) { foe.style.transition = 'transform .3s, opacity .3s'; foe.style.transform = 'scale(.1)'; foe.style.opacity = '0'; }
  await wait(380);
  const shakes = ok ? 3 : 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < shakes; i++) { SFX.trap(); anim(trap, 'wobble'); setLog('…'.repeat(i + 1)); await wait(620); }
  if (ok) { SFX.capture(); setLog(`Gotcha! ${ui.battle.enemy.name.split(',')[0]} was captured!`); if (trap) trap.style.boxShadow = '0 0 40px #7cf5d3, 0 0 80px #fff'; await wait(900); }
  else {
    SFX.breakfree(); if (trap) trap.remove();
    if (foe) { foe.style.transform = ''; foe.style.opacity = ''; setTimeout(() => { if (foe) foe.style.transition = ''; }, 350); }
    setLog('Argh! It broke free!'); await wait(650);
  }
  if (trap && trap.parentElement) setTimeout(() => trap.remove(), 200);
}

async function battleAction(kind, arg) {
  const B = ui.battle; if (!B || ui.busy || B.over) return;
  let ev;
  if (kind === 'attack') ev = heroStrike(B, S, false);
  else if (kind === 'special') { if (B.hero.energy < WEAPONS[B.weapon].special.cost) return toast('Not enough energy yet — basic attacks charge it.'); ev = heroStrike(B, S, true); }
  else if (kind === 'capture') { const r = attemptCapture(B, S); if (!r.used) return toast('You are out of Snap Traps. Craft or buy more in Gear.', 'bad'); ev = r.ev; }
  else if (kind === 'flee') ev = attemptFlee(B, S);
  else if (kind === 'item') { const r = useItem(B, S, arg); closeSheet(); if (!r.ok) return toast(r.ev[0] ? r.ev[0].msg : 'You cannot use that right now.'); ev = r.ev; }
  ui.busy = true; refreshActions();
  await play(ev);
  if (B.over) return endBattle();
  await runEnemy();
}
async function runEnemy() {
  const B = ui.battle; if (!B) return;
  ui.busy = true; refreshActions();
  for (let guard = 0; guard < 6; guard++) {
    await play(enemyTurn(B));
    if (B.over) return endBattle();
    const st = heroTurnStart(B);
    await play(st.ev);
    if (B.over) return endBattle();
    if (!st.skip) break;
  }
  B.turn++; ui.busy = false; refreshActions(); setLog('Your move.');
}
async function endBattle() {
  const B = ui.battle;
  await wait(400);
  if (B.result === 'victory') { SFX.victory(); const f = $('#foe img'); if (f) { f.style.transition = 'transform .6s, opacity .6s, filter .6s'; f.style.filter = 'brightness(3)'; f.style.opacity = '0'; f.style.transform = 'translateY(-20px) scale(.6)'; } await wait(650); }
  else if (B.result === 'defeat') { SFX.defeat(); await wait(500); }
  const sum = finishBattle(S, B);
  if (sum.levelUps.length) setTimeout(() => SFX.levelup(), 400);
  persist(true);
  const s0 = ui.lastSightings[0]; if (s0 && s0.dna === B.m.dna) s0.outcome = { victory: 'defeated', captured: 'captured', defeat: 'won', fled: 'escaped', escaped: 'escaped' }[B.result];
  ui.battle = null; ui.busy = false;
  showResult(B, sum);
}
function showResult(B, sum) {
  const m = B.m;
  const titles = { victory: ['Victory!', 'var(--flash)'], captured: ['Captured!', 'var(--ecto)'], defeat: ['Knocked out…', 'var(--danger)'], fled: ['Got away', 'var(--muted)'], escaped: ['It escaped', 'var(--muted)'] };
  const [title, color] = titles[sum.result];
  const rewards = sum.rewards.map((r, i) => `<span class="reward" style="animation-delay:${i * 0.08}s">+${esc(rewardLabel(r.k, r.v))}${r.why ? ' <span class="muted">(' + esc(r.why) + ')</span>' : ''}</span>`).join('');
  const drops = sum.drops.map(d => `<div class="card row"><div class="item-ic">${d.kind === 'weapon' ? `<img class="px" alt="" src="${weaponIconURL(d.id)}">` : '✦'}</div><div class="grow"><b>${d.kind === 'weapon' ? 'Weapon found: ' + esc(WEAPONS[d.id].name) : 'Charm found: ' + esc(CHARMS[d.id].name)}</b><div class="small muted">${d.kind === 'weapon' ? esc(WEAPONS[d.id].desc) : esc(CHARMS[d.id].desc)} Equip it in Gear.</div></div></div>`).join('');
  const lines = {
    victory: `${esc(m.name.split(',')[0])} dissolves back into an ordinary ${m.cat === 'other' && m.word ? esc(m.word) : esc(CATEGORY[m.cat].name.split(' /')[0].toLowerCase())}.`,
    captured: `${esc(m.name.split(',')[0])} joins your collection. ${sum.newCapture ? 'A new species for your encyclopedia!' : ''}`,
    defeat: `You wake up dazed. You dropped ${sum.lostCoins} coins, but your collection is safe.`,
    fled: 'You live to hunt another day.', escaped: 'It vanished back into the everyday world.',
  };
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="justify-content:center;align-items:center;text-align:center">
    <h1 class="result-title" style="color:${color}">${title}</h1>
    ${sum.result === 'defeat' ? '' : spriteHTML(m.dna, { size: 150, rarity: m.rarity, variant: m.variant })}
    <p style="max-width:34ch">${lines[sum.result]}</p>
    ${rewards ? `<div class="rewards">${rewards}</div>` : ''}
    ${sum.levelUps.map(l => `<div class="levelup" style="width:100%"><h2>LEVEL ${l}!</h2><div class="small">Full heal · +1 Research Point · stronger hits${l === 5 ? ' · second charm slot' : ''}${Object.entries(WEAPONS).filter(([, w]) => w.unlock && w.unlock.lvl === l).map(([, w]) => ' · ' + esc(w.name) + ' can now be forged').join('')}</div></div>`).join('')}
    ${drops}
    ${(sum.achievements || []).map(a => `<div class="card" style="width:100%;border-color:var(--flash)"><b style="color:var(--flash)">Achievement: ${esc(a.name)}</b><div class="small muted">${esc(a.desc)} · ${Object.entries(a.reward).map(([k, v]) => esc(rewardLabel(k, v))).join(', ')}</div></div>`).join('')}
    <div class="stack" style="width:100%;max-width:340px;margin-top:6px">
      <label class="btn primary block" for="camInput" data-act="closeOverlay" style="min-height:54px">Snap the next object</label>
      ${sum.result === 'captured' ? `<button class="btn block" data-act="viewNew" data-arg="${m.id}">View ${esc((m.name).split(',')[0])}</button>` : ''}
      <button class="btn ghost block" data-act="closeOverlay">Back to base</button>
    </div></div></div>`;
  render();
}
function itemsSheet() {
  const list = BATTLE_ITEMS.map(id => {
    const it = ITEMS[id], n = S.items[id] || 0;
    return `<div class="list-item ${n ? '' : 'locked'}"><div class="item-ic"><i class="potion-ic" style="--pc:${it.color}"></i></div>
      <div class="grow"><h3>${esc(it.name)} <span class="muted num">×${n}</span></h3><p>${esc(it.desc)}</p></div>
      <button class="btn small ${n ? 'ecto' : ''}" data-act="bUse" data-arg="${id}" ${n ? '' : 'disabled'}>Use</button></div>`;
  }).join('');
  openSheet(`<div class="sheet-head"><h2>Items</h2><button class="btn small ghost" data-act="closeSheet">Close</button></div><p class="small muted">Using an item takes your turn.</p>${list}`);
}
function infoSheet() {
  const B = ui.battle, m = B.m, analysis = !!S.research.analysis, f = FAMILIES[m.fam];
  openSheet(`<div class="sheet-head"><h2>${esc(m.name.split(',')[0])}</h2><button class="btn small ghost" data-act="closeSheet">Close</button></div>
    <div class="row wrap">${rarityChip(m.rarity)}${famChip(m.fam)}${varChip(m.variant)}<span class="chip">Lv ${m.level}</span></div>
    <p class="muted">${esc(CATEGORY[m.cat].flavor)}</p>
    ${analysis ? `<div class="stat-grid">${statBars(m.stats)}</div>
      <div class="small"><b>Weak to:</b> ${f.weak.map(e => ELEMENTS[e].name).join(', ')} · <b>Resists:</b> ${f.resist.map(e => ELEMENTS[e].name).join(', ') || 'nothing'}</div>
      <div class="small"><b>Your weapon:</b> ${ELEMENTS[WEAPONS[B.weapon].el].name} — ${effMult(m.fam, WEAPONS[B.weapon].el) > 1 ? '<span style="color:var(--good)">super effective</span>' : effMult(m.fam, WEAPONS[B.weapon].el) < 1 ? '<span style="color:var(--danger)">resisted</span>' : 'normal damage'}</div>
      <div class="stack">${m.abilities.map(abilityHTML).join('')}</div>`
    : `<div class="notice">Research <b>Monster Analysis</b> in the Lab to see stats, weaknesses, abilities and exact capture odds.</div>
       <div class="small"><b>Family hint:</b> ${f.name} monsters are weak to ${f.weak.map(e => ELEMENTS[e].name).join(' and ')} weapons.</div>`}
    <div class="small muted">Capture odds rise as its HP falls, and when it is stunned, poisoned or burning.</div>`);
}

/* ---------- monster info pieces ---------- */
function statBars(st) {
  const max = { hp: 260, atk: 60, def: 40, spd: 40 };
  return ['hp', 'atk', 'def', 'spd'].map(k => `<div class="stat"><b>${k.toUpperCase()}</b><div class="bar"><i style="width:${Math.min(100, st[k] / max[k] * 100)}%"></i></div><span>${st[k]}</span></div>`).join('');
}
function abilityDesc(a) {
  const parts = [];
  if (a.self) parts.push(a.effect === 'heal' ? 'Heals 25% of its HP' : a.effect === 'atkup' ? 'Raises its attack' : 'Raises its defense');
  else {
    parts.push(`${Math.round(a.power * 100)}% power${a.hits ? ' × ' + a.hits + ' hits' : ''}`);
    if (a.effect === 'drain') parts.push('heals itself for half the damage');
    else if (a.effect) parts.push(`${Math.round((a.chance || 1) * 100)}% chance to inflict ${STATUS_NAME[a.effect].toLowerCase()}`);
  }
  return parts.join(' · ') + ` · recharge ${a.cd} turns`;
}
function abilityHTML(a) { return `<div class="ability"><b>${esc(a.name)}${a.ultimate ? ' <span style="color:var(--r-legendary)">★ ULTIMATE</span>' : ''}</b><span class="muted">${esc(abilityDesc(a))}</span></div>`; }

/* ---------- DEX / collection ---------- */
function dexScreen() {
  const totalSpecies = CATEGORIES.length * RARITIES.length;
  const seg = `<div class="seg"><button class="${ui.dexView === 'captured' ? 'on' : ''}" data-act="dexView" data-arg="captured">Captured (${S.monsters.length})</button><button class="${ui.dexView === 'encyclopedia' ? 'on' : ''}" data-act="dexView" data-arg="encyclopedia">Encyclopedia (${Object.keys(S.dex).length}/${totalSpecies})</button></div>`;
  const rf = `<div class="chips-scroll">${['all', ...RARITIES.map(r => r.id)].map(r => `<button class="fchip ${ui.fR === r ? 'on' : ''}" data-act="fR" data-arg="${r}" ${r !== 'all' ? `style="${ui.fR === r ? '' : 'color:' + RARITY[r].color}"` : ''}>${r === 'all' ? 'All rarities' : RARITY[r].name}</button>`).join('')}</div>`;
  const ff = `<div class="chips-scroll">${['all', ...Object.keys(FAMILIES)].map(f => `<button class="fchip ${ui.fF === f ? 'on' : ''}" data-act="fF" data-arg="${f}">${f === 'all' ? 'All families' : FAMILIES[f].glyph + ' ' + FAMILIES[f].name}</button>`).join('')}</div>`;
  if (ui.dexView === 'captured') {
    const list = S.monsters.filter(m => (ui.fR === 'all' || m.rarity === ui.fR) && (ui.fF === 'all' || m.fam === ui.fF)).slice().reverse();
    const grid = list.length ? `<div class="mgrid">${list.map(m => `<button class="mcard r-${m.rarity}" style="--rc:${RARITY[m.rarity].color}" data-act="mon" data-arg="${m.id}">
        ${S.companion === m.id ? '<span class="badge">BUDDY</span>' : ''}${m.variant ? `<span class="vbadge">${variantLabel(m.variant)[0]}</span>` : ''}
        <img class="px" alt="" src="${spriteURL(m.dna, 3)}"><div class="nm">${monsterTitle(m)}</div><div class="sub">Lv ${m.level} · <span style="color:${RARITY[m.rarity].color}">${RARITY[m.rarity].name}</span></div></button>`).join('')}</div>`
      : `<div class="card empty"><h3>${S.monsters.length ? 'Nothing matches these filters' : 'No monsters captured yet'}</h3><p>${S.monsters.length ? 'Try another rarity or family.' : 'Weaken a monster in battle, then throw a Snap Trap. The lower its HP, the better your odds.'}</p></div>`;
    return `${seg}${rf}${ff}${grid}`;
  }
  const done = Object.keys(S.dex).length;
  const rows = CATEGORIES.map(c => {
    const slots = RARITIES.map(r => {
      const d = S.dex[speciesKey(c.id, r.id)];
      if (ui.fR !== 'all' && ui.fR !== r.id) return `<span class="slot locked" style="--rc:${r.color};opacity:.25"></span>`;
      if (!d || (ui.fF !== 'all' && d.fam !== ui.fF)) return `<span class="slot locked" style="--rc:${r.color}">?</span>`;
      return `<button class="slot ${d.caught ? 'caught' : ''}" style="--rc:${r.color}" data-act="species" data-arg="${d.key}" aria-label="${esc(d.name)}"><img class="px" alt="" src="${spriteURL(d.dna, 2)}"></button>`;
    }).join('');
    return `<div class="dex-row"><div class="cat"><b>${c.icon} ${esc(c.name.split(' /')[0])}</b>${RARITIES.filter(r => S.dex[speciesKey(c.id, r.id)]).length}/5</div>${slots}</div>`;
  }).join('');
  const milestones = [5, 15, 40, 80, totalSpecies].map(n => `<span class="chip" style="${done >= n ? 'color:var(--ecto);border-color:var(--ecto)' : ''}">${n}</span>`).join('');
  return `${seg}<div class="card stack"><div class="row"><div class="grow"><b>${done} of ${totalSpecies} species documented</b><div class="bar xp" style="margin-top:6px"><i style="width:${done / totalSpecies * 100}%"></i></div></div></div>
    <div class="row wrap small muted">Milestones: ${milestones}</div></div>${rf}${ff}<div class="stack">${rows}</div>`;
}
function monsterSheet(id) {
  const m = S.monsters.find(x => x.id === id); if (!m) return;
  const d = S.dex[m.species] || {};
  openSheet(`<div class="grab"></div>
    <div class="stage" style="background:radial-gradient(circle, color-mix(in srgb, ${RARITY[m.rarity].color} 25%, transparent), transparent 65%)">${spriteHTML(m.dna, { size: 190, rarity: m.rarity, variant: m.variant })}<div class="shadow"></div></div>
    <div class="sheet-head"><div class="grow"><h2>${monsterTitle(m)}</h2>${m.nick ? `<div class="small muted">${esc(m.name)}</div>` : ''}</div><button class="btn small ghost" data-act="closeSheet">Close</button></div>
    <div class="row wrap">${rarityChip(m.rarity)}${famChip(m.fam)}${varChip(m.variant)}<span class="chip">Lv ${m.level}</span></div>
    <div class="row"><input class="search grow" id="nickInput" maxlength="20" placeholder="Give it a nickname" value="${esc(m.nick || '')}"><button class="btn" data-act="rename" data-arg="${m.id}">Rename</button></div>
    <div class="stat-grid">${statBars(m.stats)}</div>
    <div class="stack">${m.abilities.map(abilityHTML).join('')}</div>
    <div class="card small stack" style="gap:4px">
      <div><b>Origin object:</b> ${catLabel(m)}</div>
      <div><b>Captured:</b> ${fmtDate(m.caughtAt)}</div>
      <div><b>Species first seen:</b> ${fmtDate(d.first)} · <b>Encounters:</b> ${d.seen || 1} · <b>Captures:</b> ${d.caught || 1}</div>
      <div><b>Weak to:</b> ${FAMILIES[m.fam].weak.map(e => ELEMENTS[e].name).join(', ')}</div>
      ${m.thumb ? `<div class="row"><img src="${m.thumb}" alt="Original photo" style="width:72px;border-radius:8px"><span class="muted">The photo it was found in (kept because you enabled it in settings).</span></div>` : ''}
    </div>
    <p class="muted small">${esc(CATEGORY[m.cat].flavor)}</p>
    <div class="row">
      <button class="btn grow ${S.companion === m.id ? '' : 'ecto'}" data-act="buddy" data-arg="${m.id}">${S.companion === m.id ? 'Dismiss buddy' : 'Make hunting buddy'}</button>
      <button class="btn danger" data-act="release" data-arg="${m.id}">Release</button>
    </div>
    <p class="small muted">A hunting buddy follows you into battle and lends you part of its strength: +8% of its HP and +12% of its ATK and DEF.</p>`);
}
function speciesSheet(key) {
  const d = S.dex[key]; if (!d) return;
  const c = CATEGORY[d.cat], owned = S.monsters.filter(m => m.species === key);
  openSheet(`<div class="grab"></div>
    <div class="stage">${spriteHTML(d.dna, { size: 170, rarity: d.rarity })}<div class="shadow"></div></div>
    <div class="sheet-head"><h2>${esc(d.name)}</h2><button class="btn small ghost" data-act="closeSheet">Close</button></div>
    <div class="row wrap">${rarityChip(d.rarity)}${famChip(d.fam)}${Object.keys(d.variants || {}).map(varChip).join('')}</div>
    <p class="muted">${esc(c.flavor)}</p>
    <div class="card small stack" style="gap:4px">
      <div><b>Hides in:</b> ${d.cat === 'other' && d.word ? '“' + esc(d.word) + '” and other unusual objects' : esc(c.name)}</div>
      <div><b>First discovered:</b> ${fmtDate(d.first)}</div>
      <div><b>Encounters:</b> ${d.seen} · <b>Captures:</b> ${d.caught}</div>
      <div><b>Signature move:</b> ${esc(c.sig.name)}</div>
    </div>
    ${owned.length ? `<div class="mgrid">${owned.map(m => `<button class="mcard r-${m.rarity}" style="--rc:${RARITY[m.rarity].color}" data-act="mon" data-arg="${m.id}"><img class="px" alt="" src="${spriteURL(m.dna, 3)}"><div class="nm">${monsterTitle(m)}</div><div class="sub">Lv ${m.level}</div></button>`).join('')}</div>` : '<p class="small muted">You have not captured one of these yet.</p>'}`);
}

/* ---------- GEAR ---------- */
function gearScreen() {
  const seg = `<div class="seg">${[['arsenal', 'Arsenal'], ['bag', 'Bag'], ['shop', 'Shop & Craft']].map(([id, l]) => `<button class="${ui.gearTab === id ? 'on' : ''}" data-act="gearTab" data-arg="${id}">${l}</button>`).join('')}</div>`;
  return seg + ({ arsenal: arsenalHTML, bag: bagHTML, shop: shopHTML })[ui.gearTab]();
}
function costHTML(cost) {
  return Object.entries(cost).filter(([k]) => k !== 'lvl').map(([k, v]) => {
    const have = k === 'coins' ? S.coins : S.mats[k] || 0;
    return `<span style="color:${have >= v ? 'var(--text)' : 'var(--danger)'}">${v} ${k === 'coins' ? '¢' : MATERIALS[k].short}</span>`;
  }).join(' · ');
}
function arsenalHTML() {
  const hs = hunterStats(S), comp = companionOf(S);
  const hunter = renderHunter(document.createElement('canvas'), S.equipped, 3).toDataURL();
  const cur = hunterStats(S, S.equipped);
  const weapons = WEAPON_ORDER.map(id => {
    const w = WEAPONS[id], owned = S.weapons[id] != null, lvl = S.weapons[id] || 0, on = S.equipped === id;
    const st = owned ? hunterStats(S, id) : { atk: 6 + 2 * (S.level - 1) + w.atk, crit: w.crit };
    const dAtk = st.atk - cur.atk;
    const cmp = on ? '<span class="chip" style="color:var(--ecto)">EQUIPPED</span>' : `<span class="cmp ${dAtk > 0 ? 'up' : dAtk < 0 ? 'down' : ''}">${dAtk > 0 ? '+' : ''}${dAtk} ATK vs current</span>`;
    let btns = '';
    if (owned) {
      const max = maxWeaponLevel(S), c = upgradeCost(S, id);
      btns = `${on ? '' : `<button class="btn small ecto" data-act="equip" data-arg="${id}">Equip</button>`}
        ${lvl < max ? `<button class="btn small ${canAfford(S, c) ? '' : 'disabled'}" data-act="upgrade" data-arg="${id}">Upgrade → +${lvl + 1} <span class="small">(${costHTML(c)})</span></button>` : '<span class="chip">MAX LEVEL</span>'}`;
    } else if (w.unlock) {
      const ok = canAfford(S, w.unlock);
      btns = S.level >= w.unlock.lvl ? `<button class="btn small ${ok ? 'primary' : 'disabled'}" data-act="unlockW" data-arg="${id}">Forge (${costHTML(w.unlock)})</button>` : `<span class="small muted">Forging unlocks at hunter level ${w.unlock.lvl} — or find it as a monster drop.</span>`;
    }
    return `<div class="list-item ${on ? 'on' : ''} ${owned ? '' : 'locked'}" style="grid-template-columns:auto 1fr">
      <div class="item-ic"><img class="px" alt="" src="${weaponIconURL(id)}"></div>
      <div class="grow"><h3>${esc(w.name)}${lvl ? ` <span style="color:var(--flash)">+${lvl}</span>` : ''}</h3>
        <div class="row wrap" style="gap:6px;margin-top:3px"><span class="chip" style="color:${ELEMENTS[w.el].color}">${ELEMENTS[w.el].name}</span>${cmp}</div>
        <div class="wstats"><span>ATK <b>${weaponAtk(id, lvl)}</b></span><span>ACC <b>${Math.round(w.acc * 100)}%</b></span><span>CRIT <b>${Math.round((w.crit + lvl * 0.02) * 100)}%</b></span>${w.hits ? `<span>HITS <b>${w.hits}</b></span>` : ''}</div>
        <p>${esc(w.desc)} Special: <b>${esc(w.special.name)}</b> (${w.special.cost} energy).</p>
        <div class="row wrap" style="margin-top:8px">${btns}</div></div></div>`;
  }).join('');
  const slots = charmSlotCount(S);
  const charms = CHARM_ORDER.map(id => {
    const c = CHARMS[id], owned = S.charms[id], on = S.charmSlots.includes(id);
    return owned ? `<div class="list-item ${on ? 'on' : ''}"><div class="item-ic">✦</div><div class="grow"><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p></div><button class="btn small ${on ? '' : 'ecto'}" data-act="charm" data-arg="${id}">${on ? 'Remove' : 'Wear'}</button></div>`
      : `<div class="list-item locked"><div class="item-ic">?</div><div class="grow"><h3>Unknown charm</h3><p>Dropped by defeated monsters. Rarer monsters drop them more often.</p></div><span></span></div>`;
  }).join('');
  return `<div class="card row" style="align-items:flex-start">
      <img class="px" alt="Your hunter" src="${hunter}" style="width:96px">
      <div class="grow stack" style="gap:6px"><h2 style="font-size:19px">Hunter · Level ${S.level}</h2>
        <div class="wstats"><span>HP <b>${hs.maxHp}</b></span><span>ATK <b>${hs.atk}</b></span><span>DEF <b>${hs.def}</b></span><span>SPD <b>${hs.spd}</b></span><span>CRIT <b>${Math.round(hs.crit * 100)}%</b></span></div>
        <div class="small muted">${comp ? `Buddy: <b style="color:var(--text)">${monsterTitle(comp)}</b> (+${Math.round(comp.stats.atk * 0.12)} ATK, +${Math.round(comp.stats.def * 0.12)} DEF)` : 'No hunting buddy. Pick one from your captured monsters.'}</div></div></div>
    <div class="section-title"><h2>Weapons</h2><span class="small muted">${Object.keys(S.weapons).length}/5 owned</span></div>
    <div class="stack">${weapons}</div>
    <div class="section-title"><h2>Charms</h2><span class="small muted">${S.charmSlots.slice(0, slots).filter(Boolean).length}/${slots} slots${slots < 2 ? ' · 2nd slot at Lv 5' : ''}</span></div>
    <div class="stack">${charms}</div>`;
}
function matsHTML() { return `<div class="mats">${['scrap', 'goo', 'ecto', 'prism'].map(k => `<div class="mat" style="--mc:${MATERIALS[k].color}"><i></i><b>${S.mats[k] || 0}</b>${MATERIALS[k].short}</div>`).join('')}</div>`; }
function bagHTML() {
  const items = ITEM_ORDER.map(id => {
    const it = ITEMS[id], n = S.items[id] || 0, usable = (id === 'potion' || id === 'greater' || id === 'antidote') && n > 0;
    return `<div class="list-item"><div class="item-ic"><i class="potion-ic" style="--pc:${it.color}"></i></div><div class="grow"><h3>${esc(it.name)} <span class="muted num">×${n}</span></h3><p>${esc(it.desc)}</p></div>
      ${usable ? `<button class="btn small ecto" data-act="useOut" data-arg="${id}">Use</button>` : '<span></span>'}</div>`;
  }).join('');
  return `<div class="section-title"><h2>Materials</h2></div>${matsHTML()}
    <p class="small muted">Monsters drop materials based on their family: mechanical and household foes leave Scrap, organic ones Goo, spectral and elemental ones Ectoplasm. Rare and rarer monsters drop Prism Shards.</p>
    <div class="section-title"><h2>Items</h2></div><div class="stack">${items}</div>`;
}
function shopHTML() {
  return `<div class="row"><div class="grow"><h2 style="font-size:19px">Night Market</h2><div class="small muted">Spend coins, or craft from monster materials. No real money, ever.</div></div><span class="chip" style="color:var(--flash)">${S.coins}¢</span></div>
    ${matsHTML()}
    <div class="stack">${ITEM_ORDER.map(id => {
      const it = ITEMS[id];
      return `<div class="list-item" style="grid-template-columns:auto 1fr"><div class="item-ic"><i class="potion-ic" style="--pc:${it.color}"></i></div>
        <div class="grow"><h3>${esc(it.name)} <span class="muted num">×${S.items[id] || 0}</span></h3><p>${esc(it.desc)}</p>
        <div class="row wrap" style="margin-top:8px"><button class="btn small ${S.coins >= it.price ? 'primary' : 'disabled'}" data-act="buy" data-arg="${id}">Buy · ${it.price}¢</button>
        <button class="btn small ${canAfford(S, it.craft) ? 'ecto' : 'disabled'}" data-act="craft" data-arg="${id}">Craft · ${costHTML(it.craft)}</button></div></div></div>`;
    }).join('')}</div>`;
}

/* ---------- LAB ---------- */
function labScreen() {
  const n = claimableQuests();
  const seg = `<div class="seg">${[['research', 'Research'], ['quests', 'Orders' + (n ? ` (${n})` : '')], ['trophies', 'Trophies']].map(([id, l]) => `<button class="${ui.labTab === id ? 'on' : ''}" data-act="labTab" data-arg="${id}">${l}</button>`).join('')}</div>`;
  if (ui.labTab === 'research') {
    return `${seg}<div class="card row"><div class="grow"><h2 style="font-size:19px">Research Points: <span style="color:var(--ecto)">${S.rp}</span></h2>
      <div class="small muted">Earn RP by discovering new species (+2, more for rare ones), capturing a species for the first time (+3), levelling up, and completing orders.</div></div></div>
      <div class="stack">${RESEARCH.map(r => {
        const own = S.research[r.id], locked = r.req && !S.research[r.req], ok = S.rp >= r.cost && !locked;
        return `<div class="list-item ${own ? 'on' : ''} ${locked ? 'locked' : ''}" style="grid-template-columns:1fr auto"><div class="grow"><h3>${esc(r.name)}</h3><p>${esc(r.desc)}${locked ? ` <span style="color:var(--danger)">Requires ${esc(RESEARCH_BY_ID[r.req].name)}.</span>` : ''}</p></div>
          ${own ? '<span class="chip" style="color:var(--ecto)">DONE</span>' : `<button class="btn small ${ok ? 'ecto' : 'disabled'}" data-act="research" data-arg="${r.id}">${r.cost} RP</button>`}</div>`;
      }).join('')}</div>`;
  }
  if (ui.labTab === 'quests') {
    const done = QUESTS.filter(q => S.questsClaimed[q.id]);
    return `${seg}<section class="card"><div class="section-title"><h2>Active orders</h2></div>${activeQuests(S).map(questHTML).join('') || '<p class="muted">All orders complete!</p>'}</section>
      <section class="card"><div class="section-title"><h2>Completed</h2><span class="small muted">${done.length}/${QUESTS.length}</span></div>
      ${done.length ? done.map(q => `<div class="quest"><h3 class="muted">✓ ${esc(q.name)}</h3><span></span><p>${esc(q.desc)}</p></div>`).join('') : '<p class="muted small">Finished orders appear here.</p>'}</section>`;
  }
  const st = S.stats;
  return `${seg}<div class="stack">${ACHIEVEMENTS.map(a => `<div class="list-item ${S.achievements[a.id] ? 'on' : 'locked'}" style="grid-template-columns:auto 1fr auto"><div class="item-ic" style="color:${S.achievements[a.id] ? 'var(--flash)' : 'var(--line)'}">★</div>
      <div><h3>${esc(a.name)}</h3><p>${esc(a.desc)} · ${Object.entries(a.reward).map(([k, v]) => esc(rewardLabel(k, v))).join(', ')}</p></div>${S.achievements[a.id] ? `<span class="small muted">${fmtDate(S.achievements[a.id])}</span>` : '<span></span>'}</div>`).join('')}</div>
    <section class="card"><div class="section-title"><h2>Hunter's log</h2></div>
      <div class="wstats" style="font-size:13px"><span>Photos <b>${st.photos}</b></span><span>Encounters <b>${st.encounters}</b></span><span>Wins <b>${st.wins}</b></span><span>Captures <b>${st.captures}</b></span><span>Escapes <b>${st.flees}</b></span><span>Knockouts <b>${st.losses}</b></span><span>Object kinds <b>${Object.keys(st.catsPhotographed).length}</b></span></div></section>`;
}

/* ---------- settings ---------- */
function settingsSheet() {
  const ai = Photo.ai;
  openSheet(`<div class="sheet-head"><h2>Settings & save</h2><button class="btn small ghost" data-act="closeSheet">Close</button></div>
    <div class="card" style="padding-block:4px">
      <div class="toggle"><div><b>Sound effects</b><p>Synthesised on your device. Nothing plays until you tap.</p></div><button class="switch ${S.settings.muted ? '' : 'on'}" data-act="mute" aria-label="Toggle sound"></button></div>
      <div class="toggle"><div><b>AI Lens (experimental)</b><p>Suggests what your photo shows using MobileNet running in your browser. Downloads about 10 MB once; works only where the host allows it. ${ai.state === 'ready' ? 'Status: ready.' : ai.state === 'failed' ? 'Status: could not load here (' + esc(ai.error) + ').' : ai.state === 'loading' ? 'Status: loading…' : ''} You always confirm the object yourself.</p></div><button class="switch ${S.settings.aiLens ? 'on' : ''}" data-act="toggleAI" aria-label="Toggle AI lens"></button></div>
      <div class="toggle"><div><b>Keep photo thumbnails</b><p>Off by default. When on, a tiny 96 px copy of the photo is stored with monsters you capture, in this browser only.</p></div><button class="switch ${S.settings.keepPhotos ? 'on' : ''}" data-act="toggleKeep" aria-label="Toggle photo thumbnails"></button></div>
    </div>
    <div class="notice">${storageOK ? 'Progress saves automatically in this browser.' : 'This browser is blocking storage (private mode?), so progress will be lost when you close the page. Use the backup code below.'}</div>
    <div class="card stack"><b>Back up your progress</b><p class="small muted" style="margin:0">Copy this code somewhere safe (notes app, email to yourself). Paste it back below to restore on any device.</p>
      <textarea class="code" id="exportBox" readonly>${exportSave(S)}</textarea><button class="btn" data-act="copyExport">Copy backup code</button></div>
    <div class="card stack"><b>Restore from a backup code</b><textarea class="code" id="importBox" placeholder="Paste a SNAPMON1:… code here"></textarea><button class="btn ecto" data-act="importSave">Restore this backup</button></div>
    <div class="card stack" style="border-color:#6a2a3c"><b>Start over</b><p class="small muted" style="margin:0">Erases your hunter, monsters and encyclopedia from this browser. Type RESET to confirm.</p>
      <div class="row"><input class="search grow" id="resetBox" placeholder="RESET" autocomplete="off"><button class="btn danger" data-act="reset">Erase</button></div></div>
    <p class="small muted">SNAPMON never uploads your photos. There are no accounts, ads or purchases. Camera access is requested only when you tap SNAP or Live view, and the live camera stops the moment you take the shot.</p>`);
}

/* ---------- sheets ---------- */
function openSheet(html) {
  $('#sheet').innerHTML = `<div class="sheet-wrap" data-act="sheetBg"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
}
function closeSheet() { $('#sheet').innerHTML = ''; }

/* ---------- actions ---------- */
const actions = {
  tab(id) { ui.tab = id; closeSheet(); render(); window.scrollTo({ top: 0 }); },
  mute() { S.settings.muted = !S.settings.muted; SFX.setMuted(S.settings.muted); persist(); renderTop(); if ($('#sheet').innerHTML) settingsSheet(); },
  settings: settingsSheet, closeSheet,
  sheetBg(_, el, ev) { if (ev.target === el) closeSheet(); },
  liveOpen: openLive, liveClose: closeLive, liveSnap,
  cancelPhoto,
  pickCat(cat) { const p = ui.pending; if (!p) return; scan(cat, cat === 'other' ? (p.word || 'mystery object') : p.word); },
  aiPick(cat, el) { const p = ui.pending; if (!p) return; p.word = el.dataset.word; scan(cat, cat === 'other' ? p.word : ''); },
  closeOverlay() { $('#overlay').innerHTML = ''; render(); },
  fight() { const m = ui.discovered; ui.discovered = null; if (m) startBattle(m); },
  ignore() {
    const m = ui.discovered; ui.discovered = null; $('#overlay').innerHTML = '';
    if (m && ui.lastSightings[0] && ui.lastSightings[0].dna === m.dna) ui.lastSightings[0].outcome = 'slipped away';
    toast(`${m ? m.name.split(',')[0] : 'It'} melts back into the shadows.`); render();
  },
  bAttack: () => battleAction('attack'), bSpecial: () => battleAction('special'), bCapture: () => battleAction('capture'), bFlee: () => battleAction('flee'),
  bItems() { if (!ui.busy) itemsSheet(); }, bInfo: infoSheet, bUse: id => battleAction('item', id),
  claim(id) {
    const r = claimQuest(S, id); if (!r) return;
    SFX.coin(); const lv = r.filter(x => x.levelUp);
    toast('Order complete: ' + r.filter(x => x.k).map(x => rewardLabel(x.k, x.v)).join(', '), 'gold');
    if (lv.length) SFX.levelup();
    checkAchievements(S).forEach(a => toast('Achievement: ' + a.name, 'gold'));
    persist(); render();
  },
  quickHeal() { const r = useItem(null, S, 'potion'); if (r.ok) { SFX.heal(); toast(`Healed ${r.ev[0].amt} HP.`); persist(); render(); } },
  dexView(v) { ui.dexView = v; render(); }, fR(v) { ui.fR = v; render(); }, fF(v) { ui.fF = v; render(); },
  mon: monsterSheet, species: speciesSheet,
  viewNew(id) { $('#overlay').innerHTML = ''; ui.tab = 'dex'; ui.dexView = 'captured'; render(); monsterSheet(id); },
  rename(id) {
    const m = S.monsters.find(x => x.id === id); if (!m) return;
    m.nick = ($('#nickInput').value || '').trim().slice(0, 20) || null; persist(); toast(m.nick ? `Renamed to ${m.nick}.` : 'Nickname removed.'); render(); monsterSheet(id);
  },
  buddy(id) { S.companion = S.companion === id ? null : id; S.hp = Math.min(S.hp, hunterStats(S).maxHp); persist(); render(); monsterSheet(id); },
  release(id, el) {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Tap again to release'; return; }
    const r = releaseMonster(S, id); closeSheet(); persist(); render();
    if (r) toast('Released into the wild. It left behind ' + Object.entries(r).map(([k, v]) => rewardLabel(k, v)).join(', ') + '.');
  },
  gearTab(t) { ui.gearTab = t; render(); }, labTab(t) { ui.labTab = t; render(); },
  equip(id) { if (S.weapons[id] != null) { S.equipped = id; SFX.click(); persist(); render(); } },
  upgrade(id) { if (upgradeWeapon(S, id)) { SFX.levelup(); toast(`${WEAPONS[id].name} upgraded to +${S.weapons[id]}!`, 'gold'); persist(); render(); } },
  unlockW(id) { if (unlockWeapon(S, id)) { SFX.rare(); toast(`Forged the ${WEAPONS[id].name}!`, 'gold'); checkAchievements(S).forEach(a => toast('Achievement: ' + a.name, 'gold')); persist(); render(); } },
  charm(id) { toggleCharm(S, id); persist(); render(); },
  useOut(id) { const r = useItem(null, S, id); if (r.ok) { SFX.heal(); toast(`${ITEMS[id].name} used.`); persist(); render(); } else if (r.ev[0]) toast(r.ev[0].msg); },
  buy(id) { if (buyItem(S, id)) { SFX.coin(); persist(); render(); } },
  craft(id) { if (craftItem(S, id)) { SFX.coin(); toast(`Crafted ${ITEMS[id].name}.`); persist(); render(); } },
  research(id) { if (buyResearch(S, id)) { SFX.levelup(); toast(`Research complete: ${RESEARCH_BY_ID[id].name}`, 'gold'); persist(); render(); } },
  toggleAI() { S.settings.aiLens = !S.settings.aiLens; persist(); if (S.settings.aiLens) Photo.ai.load().then(() => { if ($('#sheet').innerHTML) settingsSheet(); }); settingsSheet(); },
  toggleKeep() { S.settings.keepPhotos = !S.settings.keepPhotos; persist(); settingsSheet(); },
  copyExport() {
    const box = $('#exportBox'); box.value = exportSave(S);
    const fallback = () => { box.focus(); box.select(); toast('Code selected — use your phone’s Copy.'); };
    try { navigator.clipboard.writeText(box.value).then(() => toast('Backup code copied.'), fallback); } catch (e) { fallback(); }
  },
  importSave() {
    try { const s = importSave($('#importBox').value); S = s; saveState(S); SFX.setMuted(S.settings.muted); closeSheet(); render(); toast('Backup restored. Welcome back, hunter.', 'gold'); }
    catch (e) { toast(e.message || 'That code could not be read.', 'bad'); }
  },
  reset() {
    if (($('#resetBox').value || '').trim().toUpperCase() !== 'RESET') return toast('Type RESET in the box first.', 'bad');
    S = freshState(); saveState(S); ui.lastSightings = []; closeSheet(); ui.tab = 'hunt'; render(); toast('Fresh start. Go find your first monster.');
  },
};
document.addEventListener('click', ev => {
  SFX.unlock();
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const fn = actions[el.dataset.act]; if (!fn) return;
  if (el.tagName === 'LABEL') { // labels open the camera via their `for` input; just run side effects
    if (el.dataset.act === 'closeOverlay') { $('#overlay').innerHTML = ''; setTimeout(render, 0); }
    return;
  }
  fn(el.dataset.arg, el, ev);
});
for (const id of ['camInput', 'galInput']) {
  const inp = document.getElementById(id);
  inp.addEventListener('click', () => { SFX.unlock(); });
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) onPhotoFile(f); });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(true); if (Photo.live.isOpen()) closeLive(); } });
window.addEventListener('pagehide', () => persist(true));
setInterval(() => { if (!ui.battle && !document.hidden) { const before = S.hp; regen(S); if (S.hp !== before) { renderTop(); persist(); } } }, 20000);

/* test hooks (used by the automated browser tests) */
window.__snapmon = { get S() { return S; }, set S(v) { S = v; }, ui, actions, setRNG: f => { RNG = f; }, render };

render();
persist(true);
