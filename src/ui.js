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
function catLabel(m) { return m.obj && OBJECTS[m.obj] ? esc(OBJECTS[m.obj].name) : m.cat === 'other' && m.word ? `“${esc(m.word)}”` : esc(CATEGORY[m.cat].name); }
// honest description of how specific a monster's look is (see objectTier in objects.js)
function designLine(obj) {
  const o = OBJECTS[obj], t = objectTier(o);
  if (!o) return 'Generic oddity design.';
  return { dedicated: `Specific ${esc(o.name.toLowerCase())} design.`, composed: `${esc(o.name)} design built from shared parts.`,
    related: `Shares the ${esc(visualSource(o).name.toLowerCase())} design.`, family: `General ${esc(CATEGORY[o.cat].name.split(' /')[0].toLowerCase())} design (no specific ${esc(o.name.toLowerCase())} look yet).` }[t];
}

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
      <button class="icon-btn guide-btn" data-act="guide" aria-label="Guide: how to play">?</button>
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
}

/* ---------- HUNT ---------- */
function huntScreen() {
  const hs = hunterStats(S), low = S.hp < hs.maxHp * 0.35;
  const quests = activeQuests(S);
  const ghost = S.monsters.length ? S.monsters[S.monsters.length - 1].dna : null;
  const live = false;
  return `${saveBlockedHTML()}
  <section class="viewfinder" id="vf">
    ${live ? '<video id="liveVideo" autoplay playsinline muted></video>' : ''}
    ${ghost && !live ? `<img class="vf-ghost px" alt="" src="${spriteURL(ghost, 3)}">` : ''}
    <i class="vf-corner tl"></i><i class="vf-corner tr"></i><i class="vf-corner bl"></i><i class="vf-corner br"></i><i class="vf-sweep"></i>
    ${live ? '' : `<div class="vf-center"><div><h1>Monsters hide <em>in plain sight</em></h1>
      <p>${S.stats.photos === 0 ? 'Photograph a real object near you — a mug, a shoe, a plant — and the Spirit Lens will reveal what lives inside it.' : 'Explore. Unusual objects hide unusual monsters.'}</p></div></div>`}
    <div class="vf-hud"><span class="rec">SPIRIT CAM</span><span>${S.stats.photos} SNAPS · ${Object.keys(S.dex).length} OBJECTS</span></div>
  </section>
  <div class="shutter-row">
    <button class="side-btn" data-act="tab" data-arg="dex"><span class="ic">${ICON.dex}</span>Monsters</button>
    ${snapButtonHTML()}
    <button class="side-btn" data-act="tab" data-arg="lab"><span class="ic">${ICON.lab}</span>Orders</button>
  </div>
  ${lensChipHTML()}
  ${low ? `<div class="card warn row"><div class="grow"><b>You're badly hurt.</b><div class="small muted">Monsters hit hard. Heal up before your next hunt — you also recover slowly over time.</div></div>
    ${S.items.potion ? `<button class="btn small" data-act="quickHeal">Drink potion (${S.items.potion})</button>` : `<button class="btn small" data-act="tab" data-arg="gear">Shop</button>`}</div>` : ''}
  <section class="card">
    <div class="section-title"><h2>Hunter's orders</h2><span class="small muted">${Object.keys(S.questsClaimed).length}/${QUESTS.length} done</span></div>
    ${quests.length ? quests.map(questHTML).join('') : '<p class="muted">Every order is complete. You are a legend of the hunt.</p>'}
  </section>
  ${ui.lastSightings.length ? `<section class="stack"><div class="section-title"><h2>Recent sightings</h2></div>
    <div class="sightings">${ui.lastSightings.map(s => `<div class="sighting"><img class="px" alt="" src="${spriteURL(s.dna, 3)}">${esc(s.name.split(',')[0])}<br><span style="color:${RARITY[s.rarity].color}">${s.outcome}</span></div>`).join('')}</div></section>` : ''}
  <p class="notice">Your photos stay on this phone. The Spirit Lens recognises objects on-device, then the image is thrown away.</p>`;
}
function saveBlockedHTML() {
  if (!saveBlocked) return '';
  const why = saveBlocked.reason === 'newer' ? `Your saved progress was made by a newer SNAPMON (save format ${saveBlocked.version}) than this one (format ${SAVE_VERSION}). This usually means the game was rolled back to an older version.`
    : 'Your saved progress could not be read.';
  return `<div class="card warn stack"><b>Saved progress not loaded</b><p class="small" style="margin:0">${why} It has <b>not</b> been changed or deleted: this session will not save over it. Open Settings to copy it as a backup code.</p></div>`;
}
function questHTML(q) {
  const p = questProgress(S, q), done = p >= q.target;
  const rw = Object.entries(q.reward).map(([k, v]) => rewardLabel(k, v)).join(', ');
  return `<div class="quest"><h3>${esc(q.name)}</h3>${done ? `<button class="btn small primary" data-act="claim" data-arg="${q.id}">Claim</button>` : `<span class="small muted num">${p}/${q.target}</span>`}
    <p>${esc(q.desc)} <span style="color:var(--flash)">· ${esc(rw)}</span></p><div class="bar"><i style="width:${p / q.target * 100}%"></i></div></div>`;
}

/* ---------- photo flow ---------- */
/* ---------- live camera (the only way to hunt: no gallery, no file upload) ---------- */
async function openCamera() {
  closeSheet();
  if (ui.cameraOpening || Platform.camera.isOpen()) return; // double taps
  // first hunt on this phone: say once what will be downloaded (this is information, not a choice of recogniser)
  if (snapState() === 'download' && !ui.engineNoticeOk) return showEngineNotice();
  // the camera opens only with a ready engine; "Snap another" buttons on result screens wait on the loading screen
  if (!Engine.ready()) { if (Engine.status.state === 'failed') return showEngineFailed(null, Engine.status.kind); return showEngineLoading(openCamera); }
  ui.cameraOpening = true; ui.snapping = false;
  const t0 = performance.now(), blocks = watchMainThread();
  $('#overlay').innerHTML = `<div class="overlay camera"><div class="overlay-inner cam-inner">
    <div class="sheet-head"><h2>Spirit Camera</h2><button class="btn small ghost" data-act="camClose">Close</button></div>
    <div class="cam-frame" id="camFrame"><video id="camVideo" autoplay playsinline muted></video><i class="vf-corner tl"></i><i class="vf-corner tr"></i><i class="vf-corner bl"></i><i class="vf-corner br"></i><i class="vf-sweep"></i>
      <div class="cam-status" id="camStatus"><span><i class="spin"></i> Starting camera…</span></div></div>
    <div class="zoom-row" id="zoomRow" hidden><button class="btn small ghost" data-act="camZoom" data-arg="-" aria-label="Zoom out">−</button>
      <input type="range" id="zoomRange" aria-label="Zoom" min="1" max="3" step="0.1" value="1"><button class="btn small ghost" data-act="camZoom" data-arg="+" aria-label="Zoom in">+</button><span class="small num" id="zoomVal">1.0×</span></div>
    <p class="small" id="camLensHint" style="text-align:center;margin:0;color:var(--flash)" hidden></p>
    <p class="muted small" style="text-align:center;margin:0">Fill the frame with one real object. The photo is analysed on this phone and never saved.</p>
    <div class="cam-controls"><button class="shutter" id="camShutter" data-act="camSnap" aria-label="Take photo" disabled>SNAP</button></div>
  </div></div>`;
  const v = $('#camVideo');
  try {
    await Platform.camera.open(v); // resolves once the preview is really showing frames
    ui.cameraOpening = false;
    if ($('#camVideo') !== v) { Platform.camera.close(v); return; } // closed (or reopened) while starting
    const st = $('#camStatus'); if (st) st.remove();
    syncShutter();
    setupZoom(v);
    ui.camStartMs = Math.round(performance.now() - t0);
    setTimeout(() => { ui.camLongestBlock = blocks.stop(); }, 1500);
  } catch (e) { ui.cameraOpening = false; blocks.stop(); Platform.camera.close(v); if ($('#camVideo') === v) showCameraError(e); }
}
/* Main-thread blocks while the camera starts (Chrome's Long Tasks API). A frozen or blank viewfinder for about a second
   means something held the main thread; the longest block is shown in the developer panel next to the camera time. */
function watchMainThread() {
  let longest = 0, obs = null;
  try { obs = new PerformanceObserver(list => { for (const e of list.getEntries()) longest = Math.max(longest, Math.round(e.duration)); }); obs.observe({ type: 'longtask', buffered: false }); } catch (e) { obs = null; }
  return { stop() { try { obs && obs.disconnect(); } catch (e) {} obs = null; return longest; } };
}
// zoom controls: buttons, slider and two-finger pinch on the viewfinder; hidden if the camera offers no zoom at all
function setupZoom(v) {
  const z = Platform.camera.zoomInfo(), row = $('#zoomRow'), range = $('#zoomRange'), frame = $('#camFrame');
  if (!row || !z || z.max <= z.min) return;
  Object.assign(range, { min: z.min, max: z.max, step: z.step, value: z.value });
  row.hidden = false; row.dataset.kind = z.kind;
  let busy = false, want = null;
  const apply = async val => {
    want = val; if (busy) return; busy = true;
    try { while (want != null) { const x = want; want = null; const got = await Platform.camera.setZoom(x, v); range.value = got; $('#zoomVal').textContent = (got / z.min).toFixed(1) + '×'; } }
    catch (e) { /* the camera refused this zoom level: keep the previous one */ }
    busy = false;
  };
  ui.camZoom = { info: z, apply, get value() { return +range.value; } };
  range.addEventListener('input', () => apply(+range.value));
  let pinch = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  frame.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: dist(e.touches), z: +range.value }; }, { passive: true });
  frame.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { e.preventDefault(); apply(pinch.z * dist(e.touches) / pinch.d); } }, { passive: false });
  frame.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
}
function showCameraError(e) {
  const d = Platform.camera.describe(e);
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="justify-content:center;text-align:center;gap:14px">
    <h2 style="font-size:26px">${esc(d.title)}</h2><p>${esc(d.text)}</p>
    <p class="small muted">Hunting needs the live camera. Saved photos cannot be used.</p>
    <button class="btn primary block" data-act="openCamera">Try again</button>
    <button class="btn ghost block" data-act="closeOverlay">Back</button></div></div>`;
}
function closeCamera() { Platform.camera.close($('#camVideo')); ui.camZoom = null; ui.cameraOpening = false; $('#overlay').innerHTML = ''; render(); }
function camSnap() {
  const v = $('#camVideo'); if (!v || !v.videoWidth || ui.snapping || !Engine.ready()) return; // one shot, ready engine only
  ui.snapping = true; const btn = $('#camShutter'); if (btn) btn.disabled = true;
  SFX.shutter();
  const canvas = Platform.camera.capture(v); // exactly the region the viewfinder shows (including zoom)
  Platform.camera.close(v); ui.camZoom = null;
  beginIdentify(canvas, canvas.toDataURL('image/jpeg', 0.85));
}

/* ---------- the recognition engine: one-time notice, progress, status ---------- */
const MB = b => Math.max(1, Math.round(b / 1048576));
async function showEngineNotice() {
  const bytes = await Engine.downloadBytes();
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="justify-content:center;gap:14px">
    <h2 style="font-size:26px">One-time download</h2>
    <p>SNAPMON recognises objects with AI that runs <b>on this phone</b>. Its recognition engine (up to about <b>${MB(bytes)} MB</b>) downloads once and stays saved for next time. Parts you already have are not downloaded again.</p>
    <p class="small muted">Photos are never uploaded to any AI service. Wi-Fi is recommended. While it downloads you can keep using the rest of the game.</p>
    <button class="btn primary block" data-act="engineDownload">Download now (${MB(bytes)} MB)</button>
    <button class="btn ghost block" data-act="closeOverlay">Not now</button></div></div>`;
}
function engineProgressHTML() {
  const E = Engine.status, pct = E.total ? Math.min(100, Math.round(E.loaded / E.total * 100)) : 0;
  return `<div class="stack" id="engineProgress" style="gap:6px"><div class="bar xp"><i style="width:${pct}%"></i></div>
    <div class="small muted">${E.state === 'ready' ? 'Recognition engine ready.' : esc(E.stage || 'Starting…')} ${E.total ? `· ${MB(E.loaded)} / ${MB(E.total)} MB` : ''}</div></div>`;
}
// loading screen used before the first hunt; continues with next() once the engine is ready
async function showEngineLoading(next) {
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="justify-content:center;gap:14px">
    <h2 style="font-size:26px">Preparing the recognition engine</h2>
    ${engineProgressHTML()}
    <p class="small muted">Recognition runs on this phone. This happens once; next time it starts from the saved copy.</p>
    <button class="btn ghost block" data-act="closeOverlay">Continue in the background</button></div></div>`;
  const ok = await Engine.load();
  if (!$('#engineProgress')) return; // player left the screen; loading carries on
  if (ok) { S.settings.engineCached = true; persist(); next(); } else showEngineFailed(null, Engine.status.kind);
}
function engineStatusLine() {
  const E = Engine.status;
  if (E.state === 'ready') return `Ready · ${E.backends.lens === 'webgl' ? 'GPU' : 'CPU'} detector, ${E.backends.clip === 'webgpu' ? 'GPU' : 'CPU'} vocabulary model.`;
  if (E.state === 'loading') return `Loading: ${esc(E.stage)}${E.total ? ` (${MB(E.loaded)} / ${MB(E.total)} MB)` : ''}.`;
  if (E.state === 'failed') return `Could not start: ${esc(E.error)}.`;
  return S.settings.engineCached ? 'Saved on this phone; starts when you open the game.' : 'Not downloaded yet.';
}
/* SNAP only works when the Spirit Lens (the recognition engine) is ready. While it loads, wakes up, re-checks itself
   after the app was in the background, or has failed, the button is really disabled (not just dimmed). Before the very
   first download it opens the one-time download notice instead (no capture can start without the engine). */
function snapState() {
  const E = Engine.status;
  if (Engine.ready()) return 'ready';
  if (E.state === 'failed') return 'failed';
  if (E.state === 'idle' && !S.settings.engineCached) return 'download';
  return 'waking';
}
function snapButtonHTML() {
  const st = snapState(), off = st === 'waking' || st === 'failed';
  const label = { ready: 'Open the Spirit Camera', download: 'Download the Spirit Lens to start hunting', waking: 'SNAP is unavailable while the Spirit Lens wakes up', failed: 'SNAP is unavailable: the Spirit Lens could not start' }[st];
  return `<button class="shutter ${off ? 'waiting' : ''}" id="huntSnap" data-act="openCamera" aria-label="${label}" ${off ? 'disabled aria-disabled="true"' : ''}>${st === 'waking' ? '<span class="waking">WAKING</span>' : 'SNAP'}</button>`;
}
// the camera's own shutter: needs live frames AND a ready engine
function syncShutter() {
  const btn = $('#camShutter'); if (!btn) return;
  const v = $('#camVideo'), frames = !!(v && v.videoWidth && !$('#camStatus'));
  btn.disabled = !(frames && Engine.ready()) || !!ui.snapping;
  const hint = $('#camLensHint'); if (hint) { const waiting = frames && !Engine.ready(); hint.hidden = !waiting; hint.textContent = Engine.status.state === 'failed' ? 'The Spirit Lens could not start. Close the camera and tap Retry.' : 'Spirit Lens waking up… SNAP unlocks in a moment.'; }
}
function lensChipHTML() {
  const E = Engine.status;
  const dot = E.state === 'ready' ? 'var(--good)' : E.state === 'failed' ? 'var(--danger)' : 'var(--flash)';
  const pct = E.total ? ' ' + Math.round(E.loaded / E.total * 100) + '%' : '';
  const txt = E.state === 'ready' ? 'Spirit Lens ready' : E.state === 'loading' ? 'Spirit Lens loading' + pct : E.state === 'failed' ? 'Spirit Lens could not start' : S.settings.engineCached ? 'Spirit Lens asleep' : 'Spirit Lens not downloaded';
  const btn = E.state === 'failed' ? '<button class="btn small" data-act="lensPrepare">Retry</button>' : '';
  return `<div class="lens-chip" id="lensChip"><i style="background:${dot}" class="${E.state === 'loading' ? 'pulse' : ''}"></i><span class="grow">${txt}</span>${btn}</div>`;
}
Engine.onChange(() => {
  const chip = $('#lensChip'); if (chip) chip.outerHTML = lensChipHTML();
  const snap = $('#huntSnap'); if (snap) snap.outerHTML = snapButtonHTML();
  syncShutter();
  const pr = $('#engineProgress'); if (pr) pr.outerHTML = engineProgressHTML();
  const st = $('#lensStatus'); if (st) st.textContent = lensStatusText().replace(/&[a-z]+;/g, '');
  // Settings: only the engine row and the developer readouts change; the sheet itself is never rebuilt for progress
  if (!ui.engineRowQueued && $('#engineRow')) {
    ui.engineRowQueued = true;
    requestAnimationFrame(() => {
      ui.engineRowQueued = false;
      // keep what the player is looking at in place: the row never shrinks while Settings is open, and when it grows
      // while scrolled out of view above, the sheet scrolls by the same amount
      const row = $('#engineRow');
      if (row) {
        const sh = row.closest('.sheet'), h0 = row.offsetHeight, above = sh && row.getBoundingClientRect().top < sh.getBoundingClientRect().top;
        row.style.minHeight = h0 + 'px'; row.innerHTML = engineRowHTML();
        const d = row.offsetHeight - h0; if (above && d > 0) sh.scrollTop += d;
      }
      const b = $('#devBackends'); if (b) b.textContent = backendsText();
      const l = $('#devLoadMs'); if (l) l.textContent = loadTimesText();
    });
  }
});

/* ---------- recognition flow: photo → Hybrid engine → (pick among AI suggestions) → encounter scan ----------
   There is no manual entry: only objects the engine actually recognised can be hunted. */
function beginIdentify(img, url) {
  const hash = Photo.analyze(img).hash; // whole-photo similarity fingerprint (repeat-photo detection)
  ui.pending = { img, url, hash, thumb: S.settings.keepPhotos ? Photo.thumbnail(img) : null, rec: null, t0: Date.now() };
  recognizeFlow();
}
function lensFrame(p, extra = '') {
  return `<div class="photo-frame" id="lensFrame"><img alt="Your photo" src="${p.url}">${extra}<i class="vf-corner tl"></i><i class="vf-corner tr"></i><i class="vf-corner bl"></i><i class="vf-corner br"></i></div>`;
}
function lensStatusText() {
  const E = Engine.status;
  if (E.state === 'loading') return `Starting the recognition engine: ${esc(E.stage)}${E.total ? ` (${MB(E.loaded)} / ${MB(E.total)} MB)` : ''}…`;
  if (E.state === 'ready') return 'Looking for objects… (runs on this phone)';
  return '';
}
const devOn = () => !!S.settings.devUnlocked;
async function recognizeFlow() {
  const p = ui.pending; if (!p) return;
  $('#overlay').innerHTML = `<div class="overlay scanning"><div class="overlay-inner" style="justify-content:center">
    <div class="sheet-head"><h2>Spirit Lens</h2><button class="btn small ghost" data-act="cancelPhoto">Cancel</button></div>
    ${lensFrame(p, '<i class="vf-sweep"></i><div class="scan-hud"><div class="lens-tag"><i class="spin"></i> ANALYSING <span id="lensClock">0.0s</span></div></div>')}
    <p class="muted" style="text-align:center" id="lensStatus">${lensStatusText()}</p></div></div>`;
  const clock = setInterval(() => { const el = $('#lensClock'); if (!el || ui.pending !== p) return clearInterval(clock); el.textContent = ((Date.now() - p.t0) / 1000).toFixed(1) + 's'; }, 100);
  const fail = kind => { clearInterval(clock); if (ui.pending === p) showEngineFailed(p, kind); };
  persist(true); // save progress before the memory-heavy part (Android may stop a page that runs out of memory)
  if (Engine.status.state !== 'ready') {
    const ok = await Engine.load();
    if (ui.pending !== p) return clearInterval(clock);
    if (!ok) return fail(Engine.status.kind);
  }
  let r;
  try { r = await Engine.recognize(p.img); }
  catch (e) { return fail(e.kind); }
  clearInterval(clock);
  if (ui.pending !== p) return;
  p.rec = r.rec; p.clip = r.clip; p.prodOnly = { decision: r.prodOnly.decision, reason: r.prodOnly.reason, top: ftTop(r.prodOnly) }; p.prodCands = r.prodOnly.candidates;
  if (!S.settings.engineCached) { S.settings.engineCached = true; persist(); }
  if (devOn() && S.settings.fieldTest) return showFieldTest(p);
  if (p.rec.decision === 'unknown') return showUnknown(p);
  if (p.rec.decision === 'auto') return showIdentified(p, 0);
  showChoices(p);
}
/* ---------- field test (developer mode) ----------
   Records what each model said and the tester's verdict in a SEPARATE store (snapmon.fieldtest.v1). Nothing here ever
   feeds back into recognition, and a field-test photo never creates an encounter. */
const FT_KEY = 'snapmon.fieldtest.v1';
const ftLoad = () => { try { return JSON.parse(Platform.storage.get(FT_KEY) || '[]'); } catch (e) { return []; } };
// "new" = logged after the newest entry already copied out, so each field-test round can be sent on its own
const ftNew = () => { const after = +(Platform.storage.get(FT_KEY + '.copied') || 0); return ftLoad().filter(e => e.t > after); };
const ftSave = list => Platform.storage.set(FT_KEY, JSON.stringify(list.slice(-500)));
function ftTop(rec) { return (rec.candidates || []).slice(0, 3).map(c => ({ obj: c.obj, label: c.label, conf: +c.conf.toFixed(3) })); }
function showFieldTest(p) {
  const rec = p.rec, clip = p.clip, hybrid = true; // Hybrid is the standard; the other two are shown for comparison only
  const prodRec = p.prodOnly || { decision: rec.decision, reason: rec.reason, top: ftTop(rec) }, prodTop = prodRec.top;
  const colour = colourDiagnostics(p);
  const clipTop = clip ? clip.regions[0].ranked.slice(0, 3).map(x => ({ obj: x.obj, label: x.label, p: +x.p.toFixed(3) })) : null;
  p.ft = { v: 2, t: Date.now(), prod: { decision: prodRec.decision, reason: prodRec.reason, top: prodTop, ms: rec.debug && rec.debug.times && rec.debug.times.total },
    clip: clip ? { accepted: clip.regions[0].accepted, why: clip.regions[0].why, top: clipTop, ms: clip.totalMs, inferMs: clip.inferMs, backend: clip.backend } : p.clipError ? { error: p.clipError } : null,
    hybrid: hybrid ? { decision: rec.decision, reason: rec.reason, top: ftTop(rec), ms: rec.debug.engine && rec.debug.engine.totalMs } : null,
    engine: { id: Engine.ID, backends: Engine.status.backends }, colour: colour && colour.log, marks: {} };
  const nm = x => esc(x.obj && OBJECTS[x.obj] ? OBJECTS[x.obj].name : x.label);
  // verdict buttons match what the lens did: an answer is right / in the list / wrong; no answer is rightly unknown or a miss
  const ANSWERED = [['top1', 'Right'], ['top3', 'Right one is in the list'], ['wrong', 'Wrong']];
  const UNANSWERED = [['rejected_ok', 'Rightly unknown'], ['missed_guess', 'Missed, but its best guess was right'], ['rejected_bad', 'Missed']];
  const markRow = (model, label, answered) => `<div class="stack" style="gap:6px"><b class="small">${label}</b><div class="row wrap">${(answered ? ANSWERED : UNANSWERED)
    .map(([k, l]) => `<button class="fchip" data-act="ftMark" data-arg="${model}:${k}">${l}</button>`).join('')}</div></div>`;
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="gap:12px">
    <div class="sheet-head"><h2>Field test</h2><button class="btn small ghost" data-act="cancelPhoto">Close</button></div>
    <p class="small muted" style="margin:0">No monster is created in field-test mode. Your answers are stored separately and are never used for recognition.</p>
    <div class="photo-frame" id="lensFrame"></div>
    <div class="card small stack" style="gap:4px"><b>Detector + classifier alone</b> <span class="muted">${esc(prodRec.decision)} (${esc(prodRec.reason)}) · ${p.ft.prod.ms || '?'} ms</span>
      <div>${prodTop.length ? prodTop.map((x, i) => `${i + 1}. ${nm(x)} <span class="muted">${Math.round(x.conf * 100)}%</span>`).join('<br>') : '<span class="muted">nothing accepted</span>'}</div></div>
    ${clipTop ? `<div class="card small stack" style="gap:4px"><b>TinyCLIP alone</b> <span class="muted">${clip.regions[0].accepted ? 'accepted' : 'rejected: ' + esc(clip.regions[0].why)} · ${clip.totalMs} ms · ${esc(clip.backend)}</span>
      <div>${clipTop.map((x, i) => `${i + 1}. ${nm(x)} <span class="muted">score ${(x.p * 100).toFixed(1)}</span>`).join('<br>')}</div></div>` : p.clipError ? `<div class="card small">Experimental lens failed: ${esc(p.clipError)}</div>` : ''}
    ${hybrid ? `<div class="card small stack" style="gap:4px"><b>Hybrid (what a player gets)</b> <span class="muted">${esc(rec.decision)} (${esc(rec.reason)}) · ${p.ft.hybrid.ms || '?'} ms · ${esc(Object.values(Engine.status.backends).join(' + '))}</span>
      <div>${p.ft.hybrid.top.length ? p.ft.hybrid.top.map((x, i) => `${i + 1}. ${nm(x)}`).join('<br>') : '<span class="muted">nothing</span>'}</div></div>` : ''}
    ${colour ? colour.html : ''}
    ${hybrid ? markRow('hybrid', 'Hybrid verdict', rec.decision !== 'unknown') : ''}${markRow('prod', 'Detector + classifier verdict', prodRec.decision !== 'unknown')}${clipTop ? markRow('clip', 'TinyCLIP verdict', clip.regions[0].accepted) : ''}
    ${colour ? `<div class="stack" style="gap:6px"><b class="small">Colour verdict</b><div class="row wrap">${[['right', 'Colours match the object'], ['background', 'Background leaked in'], ['wrong', 'Wrong colours']].map(([k, l]) => `<button class="fchip" data-act="ftMark" data-arg="colour:${k}">${l}</button>`).join('')}</div></div>` : ''}
    <input class="search" id="ftTruth" maxlength="60" placeholder="What was it really? (optional, for the test log only)" autocomplete="off">
    <button class="btn primary block" data-act="ftSave">Save result &amp; take another</button>
    ${debugHTML(rec)}
  </div></div>`;
  drawDetections(p);
}
// Answered: right / list / wrong. Not answered: rightly unknown / missed. v1 entries (before the verdict fix) used
// 'rejected_ok' for some wrong answers too, so those are counted from the logged decision, not the verdict.
/* Colour diagnostics for the field test: which region was used, which pixels counted as the object (cyan) and which
   were rejected as background (dimmed), the extracted swatches, and the monster those colours produce. */
function colourDiagnostics(p) {
  const c = p.rec.candidates[0]; if (!c) return null;
  const pal = Photo.palette(p.img, c.box, { mask: true }); if (!pal) return null;
  const o = OBJECTS[c.obj];
  const dna = makeDNA({ obj: c.obj, cat: o ? o.cat : 'other', rarity: 'common', seed: 12345, photo: { hue: pal.primary[0], sat: pal.primary[1] / 100, lit: pal.primary[2] / 100, pal } });
  // preview: the downscaled photo with the sampled object pixels highlighted
  const w = p.img.width, h = p.img.height, k = Math.min(1, 160 / Math.max(w, h)), cv = document.createElement('canvas');
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const g = cv.getContext('2d');
  const sx = cv.width / pal.mask.w, sy = cv.height / pal.mask.h, st = pal.mask.step;
  g.drawImage(p.img, 0, 0, w, h, 0, 0, cv.width, cv.height); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(80,240,220,0.9)'; for (const [x, y] of pal.mask.obj) g.fillRect(x * sx, y * sy, st * sx, st * sy);
  g.fillStyle = 'rgba(255,90,110,0.55)'; for (const [x, y] of pal.mask.bg) g.fillRect(x * sx, y * sy, st * sx, st * sy);
  if (c.box) { g.strokeStyle = '#ffcf5a'; g.lineWidth = 2; g.strokeRect(c.box[0] * cv.width, c.box[1] * cv.height, c.box[2] * cv.width, c.box[3] * cv.height); }
  const sw = (lab, hex) => hex ? `<span class="swatch" style="background:${hex}"></span>${lab}` : '';
  const S_ = pal.swatches;
  return {
    log: { primary: S_.primary, secondary: S_.secondary, highlight: S_.highlight, shadow: S_.shadow, conf: pal.conf, method: pal.method, objectShare: pal.fgShare, ms: pal.ms },
    html: `<div class="card small stack" style="gap:6px"><b>Colours (${esc(pal.conf)}, ${esc(pal.method)}, ${pal.ms} ms)</b>
      <div class="row" style="align-items:flex-start;gap:10px"><img src="${cv.toDataURL()}" alt="colour sampling" style="width:55%;border-radius:8px;image-rendering:pixelated">
        <div class="stack" style="gap:4px">${spriteHTML(dna, { size: 96 })}</div></div>
      <div class="row wrap" style="gap:10px">${sw('primary', S_.primary)} ${sw('secondary', S_.secondary)} ${sw('highlight', S_.highlight)} ${sw('shadow', S_.shadow)}</div>
      <span class="muted">Cyan: pixels used as the object · red: rejected as background · yellow: selected region. Object pixels ${Math.round(pal.fgShare * 100)}% of the region.</span></div>`,
  };
}
function ftStats(list) {
  const blank = () => ({ n: 0, answered: 0, right: 0, inList: 0, unknownOk: 0, missed: 0, ms: [] }), m = { prod: blank(), clip: blank(), hybrid: blank() };
  for (const e of list) for (const k of ['prod', 'clip', 'hybrid']) {
    const v = e.marks && e.marks[k], r = e[k]; if (!v || !r) continue; const s = m[k]; s.n++;
    const answered = k === 'clip' ? r.accepted : r.decision !== 'unknown';
    if (answered) { s.answered++; if (v === 'top1') s.right++; if (v === 'top1' || v === 'top3') s.inList++; }
    else if (v === 'rejected_ok') s.unknownOk++; else s.missed++;
    if (r.ms) s.ms.push(r.ms);
  }
  return m;
}
function ftSummaryHTML() {
  const list = ftLoad(), st = ftStats(list), pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
  const row = (k, l) => { const s = st[k], ms = s.ms; if (!s.n) return ''; return `<tr><td>${l}</td><td>${s.n}</td><td>${pct(s.right, s.answered)}</td><td>${pct(s.inList, s.answered)}</td><td>${s.unknownOk} / ${s.missed}</td><td>${ms.length ? ms.sort((a, b) => a - b)[ms.length >> 1] + ' / ' + ms[ms.length - 1] : '–'}</td></tr>`; };
  return `<div class="debug small"><table><tr><th></th><th>photos</th><th>right when it answered</th><th>right one in list</th><th>right unknown / missed</th><th>ms median / worst</th></tr>${row('prod', 'Production')}${row('clip', 'Experimental')}${row('hybrid', 'Hybrid')}</table></div>
    <p class="small muted" style="margin:0">${list.length} field-test photos logged on this phone.</p>`;
}

// recognition timings per backend combination (every hunt), so TinyCLIP's CPU time can be measured on a real phone
function perfHTML() {
  const log = Engine.perfLog(), groups = {};
  for (const e of log) { const k = `${e.backends.lens === 'webgl' ? 'GPU' : 'CPU'} detector + ${e.backends.clip === 'webgpu' ? 'GPU' : 'CPU'} TinyCLIP`; (groups[k] = groups[k] || []).push(e); }
  const q = (a, f) => { a = a.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * f))] : '–'; };
  const rows = Object.entries(groups).map(([k, l]) => `<tr><td>${k}</td><td>${l.length}</td><td>${q(l.map(e => e.clipInferMs), .5)} / ${q(l.map(e => e.clipInferMs), .9)}</td><td>${q(l.map(e => e.clipMs), .5)}</td><td>${q(l.map(e => e.ms), .5)} / ${q(l.map(e => e.ms), .9)}</td></tr>`).join('');
  return `<div class="debug small"><b>Recognition timings (ms, every hunt)</b>${rows ? `<table><tr><th></th><th>photos</th><th>TinyCLIP model median / p90</th><th>TinyCLIP total median</th><th>whole engine median / p90</th></tr>${rows}</table>` : '<p class="muted" style="margin:4px 0 0">No photos recognised yet.</p>'}</div>
    <div class="row wrap"><button class="btn small grow" data-act="perfExport">Copy timings (${log.length})</button><button class="btn small" data-act="perfClear">Clear timings</button></div>
    <div class="row wrap"><button class="btn small grow" data-act="rejExport">Copy "Wrong object" reports (${rejLog().length})</button></div>`;
}

const ENGINE_FAIL = "SnapMon's recognition engine couldn't run on this device. Please check for system updates or try again.";
function showEngineFailed(p, kind) {
  const E = Engine.status;
  const msg = {
    download: ['The recognition engine could not download', 'SNAPMON recognises objects on your phone, but its models must be downloaded once. The download failed or was interrupted. Check your connection and try again; nothing broken is kept.'],
    offline: ['You are offline', 'The recognition engine has to be downloaded once. Connect to the internet and try again. After that it works offline.'],
    timeout: ['Recognition took too long', 'The recognition engine did not finish in time. Close other apps, then try again.'],
    memory: ['Not enough memory', ENGINE_FAIL + ' Closing other apps may help.'],
    unsupported: ['This browser cannot run the recognition engine', ENGINE_FAIL],
    crash: ['The recognition engine stopped', ENGINE_FAIL],
    busy: ['Still thinking', 'The engine was busy with another photo. Try again.'],
  }[kind] || ['The recognition engine could not run', ENGINE_FAIL];
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="justify-content:center;text-align:center;gap:14px">
    <h2 style="font-size:26px">${msg[0]}</h2><p>${msg[1]}</p>
    <p class="small muted">No monster was created${p ? ' and the photo was not stored' : ''}. Your collection, gear and settings still work.</p>
    ${S.settings.debugLens ? `<p class="small muted" style="word-break:break-word">Details: ${esc(kind || '')} · ${esc(E.error || '')}</p>` : ''}
    <button class="btn primary block" data-act="${p ? 'lensRetry' : 'engineDownload'}">Try again</button>
    <button class="btn ghost block" data-act="${p ? 'cancelPhoto' : 'closeOverlay'}">Back</button></div></div>`;
}
function showUnknown(p) {
  const reason = p.rec.reason;
  S.stats.unrecognized = (S.stats.unrecognized || 0) + 1; persist();
  SFX.nothing();
  const msg = reason === 'person' ? ['Just a human', 'Humans are (mostly) not monsters. Point the lens at an object.']
    : reason === 'scene' ? ['Too much going on', 'That looks like a place, not an object. Get closer to one thing.']
    : ['Unknown object', 'No supernatural signature detected.'];
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="justify-content:center;text-align:center;gap:14px">
    ${lensFrame(p)}
    <h2 style="font-size:28px;color:var(--muted)">${msg[0]}</h2>
    <p style="font-size:17px">${msg[1]}</p>
    <p class="small muted">Tips: fill the frame with a single object, use good light, and hold steady. Everyday things work best: food, furniture, gadgets, pets, plants.</p>
    ${debugHTML(p.rec)}
    <button class="btn primary block" data-act="openCamera">Take another photo</button>
    <button class="btn ghost block" data-act="cancelPhoto">Back</button></div></div>`;
}
function candLine(c) {
  const o = OBJECTS[c.obj], name = o ? o.name : CATEGORY[c.cat].name;
  const same = o && o.name.toLowerCase() === String(c.label).toLowerCase();
  // a rule-5 suggestion carries a raw CLIP share, not a confidence, so it shows no percentage
  const score = c.src === 'clip' && /^(5|5b|6|alt)$/.test(String(c.rule)) ? 'second opinion' : Math.round(c.conf * 100) + '%';
  return `<b>${esc(same ? o.name : c.label)}</b> <span class="muted">${same ? '' : '· ' + esc(name) + ' '}· ${score}</span>`;
}
const catIcon = c => (CATEGORY[(OBJECTS[c.obj] || c).cat] || CATEGORY.other).icon;
/* An identification is never committed by itself: the player looks at it as long as they like and then explicitly
   taps "Scan for monsters" (the only way to reach the encounter roll) or "Wrong object". There is no timer. */
function showIdentified(p, i) {
  const c = p.rec.candidates[i];
  SFX.click();
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="justify-content:center;gap:14px" id="identRoot">
    <div class="sheet-head"><h2>Object identified</h2><button class="btn small ghost" data-act="cancelPhoto">Cancel</button></div>
    <div class="photo-frame" id="lensFrame"></div>
    <div class="card ident"><span class="e">${catIcon(c)}</span><div class="grow">${candLine(c)}<div class="bar"><i style="width:${c.conf * 100}%"></i></div></div></div>
    <div class="row"><button class="btn primary grow" data-act="pickCand" data-arg="${i}">Scan for monsters</button><button class="btn" data-act="wrongObject" data-arg="${i}">Wrong object</button></div>
    ${debugHTML(p.rec)}
  </div></div>`;
  drawDetections(p, i);
}
/* "Wrong object": nothing is rolled or created for a rejected identification. The player may pick one of the other
   objects the models themselves proposed for THIS photo (never free text, never arbitrary objects), or retake it. */
const REJ_KEY = 'snapmon.rejections.v1', ALT_MIN = 0.05, ALT_MAX = 4;
const rejLog = () => { try { return JSON.parse(Platform.storage.get(REJ_KEY) || '[]'); } catch (e) { return []; } };
function altCandidates(p) {
  const out = [], seen = new Set(p.rejected || []), add = c => { if (!c || !c.obj || !OBJECTS[c.obj] || seen.has(c.obj) || out.length >= ALT_MAX) return; seen.add(c.obj); out.push(c); };
  for (const c of p.rec.candidates) add(c);
  for (const c of p.prodCands || []) if (c.conf >= Lens.CFG.MIN_CONF) add(c);
  for (const r of (p.clip && p.clip.regions) || []) for (const x of r.ranked || []) if (x.p >= ALT_MIN) add({ label: x.label, obj: x.obj, cat: OBJECTS[x.obj] && OBJECTS[x.obj].cat, conf: x.p, box: r.box, src: 'clip', rule: 'alt' });
  return out;
}
function wrongObject(p, rejectedObjs) {
  p.rejected = [...new Set([...(p.rejected || []), ...rejectedObjs])];
  p.rejections = (p.rejections || 0) + 1;
  try { // local developer/field-test feedback only; photos are never stored or sent anywhere
    const log = JSON.parse(Platform.storage.get(REJ_KEY) || '[]');
    log.push({ t: Date.now(), v: GAME_VERSION, engine: Engine.ID, rejected: rejectedObjs, decision: p.rec.decision, reason: p.rec.reason, round: p.rejections,
      shown: p.rec.candidates.slice(0, 4).map(c => ({ obj: c.obj, conf: +(+c.conf).toFixed(3), src: c.src })) });
    Platform.storage.set(REJ_KEY, JSON.stringify(log.slice(-300)));
  } catch (e) {}
  // one round of alternatives per photo; rejecting those too means: retake
  const alts = p.rejections > 1 ? [] : altCandidates(p);
  p.alts = alts;
  $('#overlay').innerHTML = alts.length ? `<div class="overlay"><div class="overlay-inner" style="gap:12px">
    <div class="sheet-head"><h2>Which one is it?</h2><button class="btn small ghost" data-act="cancelPhoto">Cancel</button></div>
    <p class="muted small" style="margin:0">These are the other possibilities the lens found in this photo. If none of them is right, take another photo.</p>
    <div class="photo-frame" id="lensFrame"></div>
    <div class="stack">${alts.map((c, i) => `<button class="list-item cand" data-act="pickAlt" data-arg="${i}" style="text-align:left">
      <span class="num-badge">${i + 1}</span><span class="grow">${candLine(c)}</span><span class="e">${catIcon(c)}</span></button>`).join('')}</div>
    <button class="btn primary block" data-act="retakePhoto">None of these: retake photo</button>
  </div></div>` : `<div class="overlay"><div class="overlay-inner" style="justify-content:center;text-align:center;gap:14px">
    <div class="photo-frame" id="lensFrame"></div>
    <h2 style="font-size:26px">SnapMon couldn't identify this object</h2>
    <p>The lens has no other credible suggestion for this photo. Try again: get closer, fill the frame with the object, and use good light.</p>
    <button class="btn primary block" data-act="retakePhoto">Retake photo</button>
    <button class="btn ghost block" data-act="cancelPhoto">Back</button></div></div>`;
  drawDetections(p, -1);
}
function showChoices(p) {
  const rec = p.rec, multi = rec.reason === 'multiple';
  $('#overlay').innerHTML = `<div class="overlay"><div class="overlay-inner" style="gap:12px">
    <div class="sheet-head"><h2>${multi ? 'Several objects detected' : rec.reason === 'disagree' ? 'The lenses disagree' : rec.reason === 'second-opinion' ? 'Could it be this?' : 'The lens has a few ideas'}</h2><button class="btn small ghost" data-act="cancelPhoto">Cancel</button></div>
    <p class="muted small" style="margin:0">${multi ? 'Which one are you hunting?' : 'It is not completely sure. Which of these did you photograph?'} Every option comes from the lens's own analysis of your photo.</p>
    <div class="photo-frame" id="lensFrame"></div>
    <div class="stack">${rec.candidates.map((c, i) => `<button class="list-item cand" data-act="pickCand" data-arg="${i}" style="text-align:left">
      <span class="num-badge">${i + 1}</span><span class="grow">${candLine(c)}</span><span class="e">${catIcon(c)}</span></button>`).join('')}</div>
    <button class="btn block" data-act="wrongObject" data-arg="all">Wrong object: none of these</button>
    ${debugHTML(rec)}
  </div></div>`;
  drawDetections(p);
}
function drawDetections(p, only) {
  const frame = $('#lensFrame'); if (!frame) return;
  const img = p.rec.image, c = document.createElement('canvas');
  c.width = img.width; c.height = img.height; c.className = 'det-canvas';
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const lw = Math.max(2, img.width / 160);
  p.rec.candidates.forEach((cd, i) => {
    if (!cd.box || (only != null && i !== only)) return;
    const [x, y, w, h] = cd.box.map((v, k) => v * (k % 2 ? img.height : img.width));
    ctx.strokeStyle = '#7cf5d3'; ctx.lineWidth = lw; ctx.setLineDash([lw * 3, lw * 2]); ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]); ctx.fillStyle = '#7cf5d3'; const s = Math.max(18, img.width / 18);
    ctx.fillRect(x, y, s * 1.1, s * 1.1); ctx.fillStyle = '#062019'; ctx.font = `700 ${s * 0.8}px sans-serif`; ctx.fillText(String(i + 1), x + s * 0.3, y + s * 0.85);
  });
  frame.appendChild(c);
}
function debugHTML(rec) {
  if (!S.settings.debugLens || !rec) return '';
  const d = rec.debug, pct = v => (v * 100).toFixed(1) + '%', T = d.times || {};
  const rows = (arr, f) => arr.length ? arr.map(f).join('') : '<tr><td colspan="3" class="muted">none</td></tr>';
  return `<details class="debug" open><summary>Recognition debug</summary>
    <div class="small">Decision: <b>${esc(d.decision)}</b> (${esc(d.reason)}) · thresholds: recognise ≥ ${pct(d.thresholds.min)}, auto ≥ ${pct(d.thresholds.auto)}, boxes ≥ ${pct(d.thresholds.detMin)}</div>
    <div class="small">Time: <b>${T.total} ms</b> total (lens start-up ${T.lensLoad} ms) · detect ${T.detect ?? '–'} ms · classify ${T.classify ?? '–'} ms · crops ${T.crops ?? '–'} ms · backend ${esc(d.backend)} · models: ${esc(Object.entries(d.sources).map(([k, v]) => k + '=' + v).join(', '))}</div>
    <table><tr><th colspan="3">Whole photo (MobileNet top 5)</th></tr>${rows(d.full, r => `<tr><td>${esc(r.label)}</td><td>${pct(r.prob)}</td><td>${esc(r.map)}</td></tr>`)}
    <tr><th colspan="3">Detected objects (COCO-SSD)</th></tr>${rows(d.detections, r => `<tr><td>${esc(r.label)}</td><td>${pct(r.score)}</td><td>${esc(r.map)}</td></tr>`)}
    <tr><th colspan="3">Crop refinement</th></tr>${rows(d.crops, r => `<tr><td>${esc(r.box)} → ${esc(r.label)}</td><td>${pct(r.prob)}</td><td>${esc(r.map)}</td></tr>`)}
    <tr><th colspan="3">Merged candidates</th></tr>${rows(d.candidates, r => `<tr><td>${esc(r.label)}</td><td>${pct(r.conf)}</td><td>${esc(r.obj || '?')} · ${esc(r.src)}</td></tr>`)}</table>${clipDebugHTML()}</details>`;
}
function cancelPhoto() {
  if (ui.pending && ui.pending.url && ui.pending.url.startsWith('blob:')) URL.revokeObjectURL(ui.pending.url);
  ui.pending = null; $('#overlay').innerHTML = ''; render();
}

// TinyCLIP details (debug info). CLIP scores are raw similarities turned into vocabulary softmax shares;
// the "calibrated" column comes from the benchmark's reliability table and is blank where none exists.
function clipDebugHTML() {
  const p = ui.pending; if (!p || (!p.clip && !p.clipError)) return '';
  if (p.clipError) return `<div class="small" style="margin-top:8px;color:var(--danger)">TinyCLIP: ${esc(p.clipError)}</div>`;
  const c = p.clip, info = ClipLens.status.info || {}, pct = v => (v * 100).toFixed(1) + '%';
  return `<table><tr><th colspan="4">TinyCLIP (${esc(info.name || '')} · ${esc(c.backend)} · ${c.totalMs} ms · loaded in ${info.loadMs} ms · ${((info.modelBytes + info.vocabBytes) / 1048576).toFixed(1)} MB)</th></tr>
    <tr><td class="muted">region</td><td class="muted">top object</td><td class="muted">score / margin</td><td class="muted">calibrated · verdict</td></tr>
    ${c.regions.map(r => `<tr><td>${esc(r.cls)}</td><td>${esc(r.best.obj ? OBJECTS[r.best.obj].name : r.best.label)}<br><span class="muted">${r.ranked.slice(1, 3).map(x => esc(x.obj ? OBJECTS[x.obj].name : x.label) + ' ' + pct(x.p)).join(', ')}</span></td><td>${pct(r.best.p)} / ${pct(r.margin)}</td><td>${r.calibrated != null ? pct(r.calibrated) : 'n/a'} · ${r.accepted ? '<b style="color:var(--good)">accepted</b>' : esc(r.why)}</td></tr>`).join('')}</table>`;
}

async function scan(i) {
  const p = ui.pending; if (!p || !p.rec || p.scanning) return;
  const c = typeof i === 'object' ? i : p.rec.candidates[+i]; if (!c) return;
  if ((p.rejected || []).includes(c.obj)) return; // a rejected identification never leads to an encounter
  p.scanning = true;
  // colour from the chosen object (palette with background suppression), fingerprint from the whole photo
  const photo = { ...Photo.analyze(p.img, c.box), hash: p.hash, pal: Photo.palette(p.img, c.box), engine: Engine.ID };
  $('#overlay').innerHTML = `<div class="overlay scanning"><div class="overlay-inner" style="justify-content:center">
    <h2 style="text-align:center">Scanning for supernatural activity…</h2>
    <div class="photo-frame"><img alt="" src="${p.url}"><i class="vf-sweep"></i>
      <div class="scan-hud">${SCAN_READOUTS.slice(0, 4).map((r, k) => `<div class="meter"><span>${r}</span><i><b id="mt${k}"></b></i><span id="mv${k}">0.0</span></div>`).join('')}</div></div>
    <p class="muted" style="text-align:center">Target: <b style="color:var(--text)">${esc(c.label)}</b> <span class="small">(${c.rule === 'alt' || /^(5|5b|6)$/.test(String(c.rule)) ? 'your pick from the lens\'s suggestions' : Math.round(c.conf * 100) + '% sure'})</span></p>
  </div></div>`;
  SFX.scan();
  const result = resolvePhoto(S, c.obj, photo, { label: c.label, aspect: c.aspect, conf: c.conf });
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
      <button class="btn primary block" data-act="openCamera">Snap another object</button>
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
      <div class="row wrap" style="justify-content:center">${famChip(m.fam)}<span class="chip">Lv ${m.level}</span><span class="chip">from ${m.label ? esc(m.label) : catLabel(m)}</span></div>
      ${seen.isNew ? `<span class="new-tag">NEW SPECIES · +${seen.rp} RP</span>` : ''}
      <p class="muted lore lore-${m.rarity}" style="max-width:36ch">${esc(loreOf(m))}</p>
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
    victory: `${esc(m.name.split(',')[0])} dissolves back into an ordinary ${m.label ? esc(m.label) : m.cat === 'other' && m.word ? esc(m.word) : esc(CATEGORY[m.cat].name.split(' /')[0].toLowerCase())}.`,
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
      <button class="btn primary block" data-act="openCamera" style="min-height:54px">Snap the next object</button>
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
    <p class="muted lore lore-${m.rarity}">${esc(loreOf(m))}</p>
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
  const seg = `<div class="seg"><button class="${ui.dexView === 'captured' ? 'on' : ''}" data-act="dexView" data-arg="captured">Captured (${S.monsters.length})</button><button class="${ui.dexView === 'encyclopedia' ? 'on' : ''}" data-act="dexView" data-arg="encyclopedia">Encyclopedia (${Object.keys(S.dex).length})</button></div>`;
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
  const entries = Object.values(S.dex).filter(d => (ui.fR === 'all' || (d.rarities || {})[ui.fR]) && (ui.fF === 'all' || d.fam === ui.fF));
  const done = Object.keys(S.dex).length;
  const byCat = new Map();
  for (const d of entries.sort((x, y) => x.name.localeCompare(y.name))) { const c = (OBJECTS[d.obj] || d).cat || 'other'; if (!byCat.has(c)) byCat.set(c, []); byCat.get(c).push(d); }
  const groups = [...byCat.entries()].sort((x, y) => y[1].length - x[1].length).map(([c, list]) => `<section class="stack" style="gap:6px">
    <div class="section-title"><h2 style="font-size:16px">${CATEGORY[c].icon} ${esc(CATEGORY[c].name.split(' /')[0])}</h2><span class="small muted">${list.length}</span></div>
    <div class="mgrid">${list.map(d => `<button class="mcard ${d.caught ? '' : 'seen'}" data-act="species" data-arg="${esc(d.key)}"><img class="px" alt="" src="${spriteURL(d.dna, 3)}"><div class="nm">${esc(d.name)}</div>
      <div class="sub">${RARITIES.map(r => `<i class="rdot" title="${r.name}" style="background:${(d.rarities || {})[r.id] ? r.color : 'transparent'};border-color:${r.color}"></i>`).join('')}</div></button>`).join('')}</div></section>`).join('');
  const milestones = [5, 15, 40, 80, 150, 300].map(n => `<span class="chip" style="${done >= n ? 'color:var(--ecto);border-color:var(--ecto)' : ''}">${n}</span>`).join('');
  return `${seg}<div class="card stack"><b>${done} kinds of object documented</b><div class="small muted">Every kind of object hides its own monster. Each dot is a rarity you have met.</div>
    <div class="row wrap small muted">Milestones: ${milestones}</div></div>${rf}${ff}${groups || `<div class="card empty"><h3>${done ? 'Nothing matches these filters' : 'Nothing documented yet'}</h3><p>Photograph objects to fill your encyclopedia.</p></div>`}`;
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
      <div><b>Origin object:</b> ${catLabel(m)}${m.label ? ` · identified as “${esc(m.label)}”${m.conf ? ' (' + Math.round(m.conf * 100) + '% sure)' : ''}` : ''}</div>
      <div><b>Look:</b> ${designLine(m.obj)}</div>
      <div><b>Captured:</b> ${fmtDate(m.caughtAt)}</div>
      <div><b>Species first seen:</b> ${fmtDate(d.first)} · <b>Encounters:</b> ${d.seen || 1} · <b>Captures:</b> ${d.caught || 1}</div>
      <div><b>Weak to:</b> ${FAMILIES[m.fam].weak.map(e => ELEMENTS[e].name).join(', ')}</div>
      ${m.thumb ? `<div class="row"><img src="${m.thumb}" alt="Original photo" style="width:72px;border-radius:8px"><span class="muted">The photo it was found in (kept because you enabled it in settings).</span></div>` : ''}
    </div>
    <p class="muted small lore lore-${m.rarity}">${esc(loreOf(m))}</p>
    ${identityUpdate(m) ? `<div class="card small stack" style="gap:6px;border-color:var(--ecto)"><b>New ${esc(OBJECTS[m.obj].name.toLowerCase())} look available</b><span class="muted">You found this monster before SNAPMON had a proper design for a ${esc(OBJECTS[m.obj].name.toLowerCase())}. Updating changes its body design, its flavour text and the name of its signature move. Colours, eyes, stats and level stay exactly the same.</span><button class="btn small ecto" data-act="refreshLook" data-arg="${m.id}">Update its look</button></div>` : m.prevIdentity ? `<button class="btn small ghost" data-act="undoLook" data-arg="${m.id}">Restore its original look</button>` : ''}
    <div class="row">
      <button class="btn grow ${S.companion === m.id ? '' : 'ecto'}" data-act="buddy" data-arg="${m.id}">${S.companion === m.id ? 'Dismiss buddy' : 'Make hunting buddy'}</button>
      <button class="btn danger" data-act="release" data-arg="${m.id}">Release</button>
    </div>
    <p class="small muted">A hunting buddy follows you into battle and lends you part of its strength: +8% of its HP and +12% of its ATK and DEF.</p>`);
}
function speciesSheet(key) {
  const d = S.dex[key]; if (!d) return;
  const o = OBJECTS[d.obj], c = CATEGORY[o ? o.cat : d.cat] || CATEGORY.other, owned = S.monsters.filter(m => m.species === key);
  const top = RARITIES.filter(r => (d.rarities || {})[r.id]).pop() || RARITY.common;
  openSheet(`<div class="grab"></div>
    <div class="stage">${spriteHTML(d.dna, { size: 170, rarity: top.id })}<div class="shadow"></div></div>
    <div class="sheet-head"><div class="grow"><h2>${esc(d.name)}</h2>${d.monsterName && d.monsterName !== d.name ? `<div class="small muted">${esc(d.monsterName)}</div>` : ''}</div><button class="btn small ghost" data-act="closeSheet">Close</button></div>
    <div class="row wrap">${RARITIES.filter(r => (d.rarities || {})[r.id]).map(r => rarityChip(r.id)).join('')}${famChip(d.fam)}${Object.keys(d.variants || {}).map(varChip).join('')}</div>
    <p class="muted lore lore-${top.id}">${esc(speciesLore(d, top.id))}</p>
    <div class="card small stack" style="gap:4px">
      <div><b>Hides in:</b> ${o ? esc(o.name) : d.word ? '“' + esc(d.word) + '”' : esc(c.name)} <span class="muted">(${esc(c.name.split(' /')[0])})</span></div>
      <div><b>Look:</b> ${designLine(d.obj)}</div>
      <div><b>First discovered:</b> ${fmtDate(d.first)}</div>
      <div><b>Encounters:</b> ${d.seen} · <b>Captures:</b> ${d.caught}</div>
      <div><b>Signature move:</b> ${esc(((o && o.sig) || c.sig).name)}</div>
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
      <div class="wstats" style="font-size:13px"><span>Photos <b>${st.photos}</b></span><span>Encounters <b>${st.encounters}</b></span><span>Wins <b>${st.wins}</b></span><span>Captures <b>${st.captures}</b></span><span>Escapes <b>${st.flees}</b></span><span>Knockouts <b>${st.losses}</b></span><span>Object kinds <b>${Object.keys(st.objsPhotographed || {}).length}</b></span></div></section>`;
}

/* ---------- settings ---------- */
function engineRowHTML() {
  const E = Engine.status;
  return `<div><b>Recognition engine</b><p>${engineStatusLine()} Every player uses the same engine: COCO-SSD + MobileNet v2 + TinyCLIP, all running on this phone. Photos are never uploaded.</p>${E.state === 'loading' ? engineProgressHTML() : ''}</div>${E.state === 'ready' || E.state === 'loading' ? '' : `<button class="btn small" data-act="lensPrepare">${E.state === 'failed' ? 'Retry' : 'Download'}</button>`}`;
}
// start-up stages, to investigate slow or blank starts (e.g. the detector on the CPU backend)
const loadTimesText = () => { const E = Engine.status, s = E.stageMs || {}; return `Engine load ${E.loadMs || '–'} ms (detector ${s.lens ?? '–'}, TinyCLIP ${s.clip ?? '–'}) · last camera start ${ui.camStartMs ?? '–'} ms, longest main-thread block ${ui.camLongestBlock ?? '–'} ms${E.recoveries ? ` · recoveries ${E.recoveries}` : ''}`; };
const backendsText = () => Object.entries(Engine.status.backends).map(([k, v]) => k + ' ' + v).join(', ') || 'not loaded';
function settingsSheet() {
  openSheet(`<div class="sheet-head"><h2>Settings & save</h2><button class="btn small ghost" data-act="closeSheet">Close</button></div>
    <button class="list-item" data-act="guide" style="text-align:left"><span class="e">📖</span><span class="grow"><b>Guide: how to play</b><br><span class="small muted">Status effects, combat, capture, rarity, items and research explained.</span></span><span class="muted">›</span></button>
    <div class="card" style="padding-block:4px">
      <div class="toggle"><div><b>Sound effects</b><p>Synthesised on your device. Nothing plays until you tap.</p></div><button class="switch ${S.settings.muted ? '' : 'on'}" data-act="mute" aria-label="Toggle sound"></button></div>
      <div class="toggle" id="engineRow">${engineRowHTML()}</div>
      <div class="toggle"><div><b>Keep photo thumbnails</b><p>Off by default. When on, a tiny 96 px copy of the photo is stored with monsters you capture, in this browser only.</p></div><button class="switch ${S.settings.keepPhotos ? 'on' : ''}" data-act="toggleKeep" aria-label="Toggle photo thumbnails"></button></div>
    </div>
    ${saveBlocked ? `<div class="card warn stack"><b>Saved progress not loaded</b><p class="small" style="margin:0">${saveBlocked.reason === 'newer' ? `It was made by a newer SNAPMON (save format ${saveBlocked.version}).` : 'It could not be read.'} It is untouched. Copy this code before doing anything else; you can restore it once the newer version is back.</p>
      <textarea class="code" readonly>${esc('SNAPMON1:' + (() => { try { return btoa(unescape(encodeURIComponent(saveBlocked.raw))); } catch (e) { return ''; } })())}</textarea></div>` : ''}
    <div class="notice">${storageOK ? 'Progress saves automatically in this browser.' : 'This browser is blocking storage (private mode?), so progress will be lost when you close the page. Use the backup code below.'}</div>
    <div class="card stack"><b>Back up your progress</b><p class="small muted" style="margin:0">Copy this code somewhere safe (notes app, email to yourself). Paste it back below to restore on any device.</p>
      <textarea class="code" id="exportBox" readonly>${exportSave(S)}</textarea><button class="btn" data-act="copyExport">Copy backup code</button></div>
    <div class="card stack"><b>Restore from a backup code</b><textarea class="code" id="importBox" placeholder="Paste a SNAPMON1:… code here"></textarea><button class="btn ecto" data-act="importSave">Restore this backup</button></div>
    <div class="card stack" style="border-color:#6a2a3c"><b>Start over</b><p class="small muted" style="margin:0">Erases your hunter, monsters and encyclopedia from this browser. Type RESET to confirm.</p>
      <div class="row"><input class="search grow" id="resetBox" placeholder="RESET" autocomplete="off"><button class="btn danger" data-act="reset">Erase</button></div></div>
    ${developerHTML()}
    <p class="small muted">SNAPMON never uploads your photos. There are no accounts, ads or purchases. Camera access is requested only when you tap SNAP, and the camera stops the moment you take the shot or leave the app.</p>
    <p class="small muted" data-act="devTap">SNAPMON v${GAME_VERSION} · save format ${SAVE_VERSION} · engine ${Engine.ID}</p>`, 'settings');
}

// Developer tools are hidden (tap the version line 7 times). They never change how hunting recognises objects:
// the comparison views exist only inside Field-test mode, which never creates monsters.
function developerHTML() {
  if (!devOn()) return '';
  const counts = objectCounts(), E = Engine.status;
  const open = S.settings.devOpen;
  return `<div class="card stack"><button class="row" data-act="devOpen" style="background:none;border:0;color:inherit;padding:0;text-align:left"><b class="grow">Developer &amp; testing</b><span class="muted">${open ? '▾' : '▸'}</span></button>
    ${open ? `<div class="toggle"><div><b>Recognition debug info</b><p>Shows what each part of the engine saw: predictions, boxes, scores, timing and backend.</p></div><button class="switch ${S.settings.debugLens ? 'on' : ''}" data-act="toggleDebug" aria-label="Toggle recognition debug info"></button></div>
    <div class="toggle"><div><b>Field-test mode</b><p>Photos are only recognised and logged with your verdicts, side by side: Hybrid, detector + classifier alone, TinyCLIP alone, and the colour extraction. No monsters appear.</p></div><button class="switch ${S.settings.fieldTest ? 'on' : ''}" data-act="toggleFieldTest" aria-label="Toggle field-test mode"></button></div>
    <div class="toggle"><div><b>Force CPU backend</b><p>Testing only: also runs the detector and classifier on the CPU instead of the GPU (TinyCLIP always runs on the CPU). Reloads the engine. Now: <span id="devBackends">${esc(backendsText())}</span>.</p></div><button class="switch ${S.settings.forceCPU ? 'on' : ''}" data-act="toggleForceCPU" aria-label="Toggle forced CPU backend"></button></div>
    <div class="toggle"><div><b>TinyCLIP on GPU (comparison)</b><p>Testing only: runs TinyCLIP on WebGPU, like v0.4.0, to compare speed. Results can differ from what players get. Reloads the engine.</p></div><button class="switch ${S.settings.clipGPU ? 'on' : ''}" data-act="toggleClipGPU" aria-label="Toggle TinyCLIP on GPU"></button></div>
    ${perfHTML()}
    ${ftSummaryHTML()}
    <div class="row wrap"><button class="btn small grow" data-act="ftExport" data-arg="new">Copy new results (${ftNew().length})</button><button class="btn small" data-act="ftExport" data-arg="all">Copy whole log</button><button class="btn small danger" data-act="ftClear">Clear log</button></div>
    <div class="row wrap"><button class="btn small" data-act="engineRedownload">Delete saved engine files</button><span class="small muted grow" id="devLoadMs">${loadTimesText()}</span></div>
    <p class="small muted" style="margin:0">Monster designs: ${counts.dedicated} specific, ${counts.composed} built from parts, ${counts.related} borrowed from a related object, ${counts.family} general family designs.</p>` : ''}
  </div>`;
}

/* ---------- sheets ---------- */
// key: when the same sheet is already open, its contents are updated in place: no re-opening animation, and the
// scroll position, typed text and focus are kept (Settings used to jump to the top on every change)
function openSheet(html, key) {
  const cur = $('#sheet .sheet');
  if (key && cur && cur.dataset.key === key) {
    const top = cur.scrollTop, vals = {}, focus = document.activeElement && cur.contains(document.activeElement) ? document.activeElement.id : '';
    cur.querySelectorAll('input[id], textarea[id]:not([readonly])').forEach(e => { vals[e.id] = e.value; });
    cur.innerHTML = html;
    for (const [id, v] of Object.entries(vals)) { const e = cur.querySelector('#' + id); if (e) e.value = v; }
    cur.scrollTop = top;
    if (focus) { const f = cur.querySelector('#' + focus); if (f) f.focus({ preventScroll: true }); }
    return;
  }
  $('#sheet').innerHTML = `<div class="sheet-wrap" data-act="sheetBg"><div class="sheet" role="dialog" aria-modal="true"${key ? ` data-key="${key}"` : ''}>${html}</div></div>`;
}
// flip one switch in place (no rebuild); also refreshes the backup code, which contains the settings
function setSwitch(el, on) {
  if (el) { el.classList.toggle('on', !!on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  const box = $('#exportBox'); if (box) box.value = exportSave(S);
}
function closeSheet() { $('#sheet').innerHTML = ''; }

/* ---------- actions ---------- */
const actions = {
  tab(id) { ui.tab = id; closeSheet(); render(); window.scrollTo({ top: 0 }); },
  mute() { S.settings.muted = !S.settings.muted; SFX.setMuted(S.settings.muted); persist(); renderTop(); const sw = $('#sheet .switch[data-act="mute"]'); if (sw) setSwitch(sw, !S.settings.muted); },
  settings: settingsSheet, closeSheet,
  sheetBg(_, el, ev) { if (ev.target === el) closeSheet(); },
  openCamera, camClose: closeCamera, camSnap,
  camZoom(dir) { const z = ui.camZoom; if (z) z.apply(z.value + (dir === '+' ? 1 : -1) * Math.max(z.info.step, (z.info.max - z.info.min) / 10)); },
  cancelPhoto,
  guide() { openSheet(Guide.html(ui.guideOpen), 'guide'); },
  pickCand(i) { scan(i); },
  refreshLook(id) { const m = S.monsters.find(x => x.id === id); if (m && applyIdentityUpdate(S, m)) { persist(); render(); monsterSheet(id); toast('Look updated.'); } },
  undoLook(id) { const m = S.monsters.find(x => x.id === id); if (m && undoIdentityUpdate(m)) { persist(); render(); monsterSheet(id); } },
  wrongObject(arg) { const p = ui.pending; if (!p || !p.rec || p.scanning) return; wrongObject(p, arg === 'all' ? p.rec.candidates.map(c => c.obj) : [p.rec.candidates[+arg].obj]); },
  pickAlt(i) { const p = ui.pending; if (p && p.alts && p.alts[+i]) scan(p.alts[+i]); },
  retakePhoto() { cancelPhoto(); openCamera(); },
  lensRetry() { if (ui.pending) { ui.pending.t0 = Date.now(); recognizeFlow(); } },
  lensPrepare() { Engine.load().then(ok => { if (ok) { S.settings.engineCached = true; persist(); } }); },
  engineDownload() { ui.engineNoticeOk = true; showEngineLoading(openCamera); },
  devTap() {
    ui.devTaps = (ui.devTaps || 0) + 1;
    if (ui.devTaps >= 7 && !S.settings.devUnlocked) { S.settings.devUnlocked = true; persist(); toast('Developer tools unlocked.'); settingsSheet(); }
  },
  toggleForceCPU(_, el) { S.settings.forceCPU = !S.settings.forceCPU; persist(); setSwitch(el, S.settings.forceCPU); Engine.setForceCPU(S.settings.forceCPU); Engine.load(); },
  toggleClipGPU(_, el) { S.settings.clipGPU = !S.settings.clipGPU; persist(); setSwitch(el, S.settings.clipGPU); Engine.setClipGPU(S.settings.clipGPU); Engine.load(); },
  perfExport() {
    const text = JSON.stringify({ app: 'snapmon', version: GAME_VERSION, exported: new Date().toISOString(), timings: Engine.perfLog() });
    try { navigator.clipboard.writeText(text).then(() => toast('Timings copied.'), () => toast('Copy failed.', 'bad')); } catch (e) { toast('Copy failed.', 'bad'); }
  },
  perfClear() { Engine.clearPerf(); settingsSheet(); },
  rejExport() {
    const text = JSON.stringify({ app: 'snapmon', version: GAME_VERSION, exported: new Date().toISOString(), rejections: rejLog() });
    try { navigator.clipboard.writeText(text).then(() => toast('Reports copied.'), () => toast('Copy failed.', 'bad')); } catch (e) { toast('Copy failed.', 'bad'); }
  },
  async engineRedownload(_, el) {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Tap again to delete'; return; }
    await Engine.clearCache(); S.settings.engineCached = false; persist(); toast('Saved engine files deleted. They download again on the next hunt.'); settingsSheet();
  },
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
  toggleDebug(_, el) { S.settings.debugLens = !S.settings.debugLens; persist(); setSwitch(el, S.settings.debugLens); },
  devOpen() { S.settings.devOpen = !S.settings.devOpen; persist(); settingsSheet(); },
  toggleFieldTest(_, el) { S.settings.fieldTest = !S.settings.fieldTest; persist(); setSwitch(el, S.settings.fieldTest); },
  ftMark(arg, el) {
    const p = ui.pending; if (!p || !p.ft) return;
    const [model, v] = arg.split(':'); p.ft.marks[model] = v;
    el.parentNode.querySelectorAll('.fchip').forEach(b => b.classList.toggle('on', b === el));
  },
  ftSave() {
    const p = ui.pending; if (!p || !p.ft) return;
    p.ft.truth = ($('#ftTruth').value || '').trim().slice(0, 60) || null;
    const list = ftLoad(); list.push(p.ft); ftSave(list);
    toast(`Logged (${list.length} field-test photos).`); openCamera();
  },
  ftExport(which) {
    const entries = which === 'new' ? ftNew() : ftLoad();
    if (!entries.length) return toast('Nothing new since the last copy.');
    const text = JSON.stringify({ app: 'snapmon', version: GAME_VERSION, exported: new Date().toISOString(), entries });
    const done = () => { Platform.storage.set(FT_KEY + '.copied', String(entries[entries.length - 1].t)); toast(`${entries.length} field-test results copied.`); settingsSheet(); };
    try { navigator.clipboard.writeText(text).then(done, () => toast('Copy failed.', 'bad')); } catch (e) { toast('Copy failed.', 'bad'); }
  },
  ftClear(_, el) {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Tap again'; return; }
    Platform.storage.remove(FT_KEY); Platform.storage.remove(FT_KEY + '.copied'); settingsSheet();
  },
  toggleKeep(_, el) { S.settings.keepPhotos = !S.settings.keepPhotos; persist(); setSwitch(el, S.settings.keepPhotos); },
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
  fn(el.dataset.arg, el, ev);
});
// the camera never runs in the background: leaving the app closes it
document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(true); if (Platform.camera.isOpen()) closeCamera(); } else resumeEngine(); });
window.addEventListener('pageshow', e => { if (e.persisted) resumeEngine(); });
document.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('.guide-sec') && e.target.open) ui.guideOpen = e.target.dataset.sec; }, true);
// back in the foreground: make sure the recognition engine still works (Android may have taken its GPU context or
// frozen its worker) and quietly reload it from the phone's cache if not, before the player takes the next photo
function resumeEngine() { if (Engine.status.state === 'ready') Engine.check(); }
window.addEventListener('pagehide', () => persist(true));
setInterval(() => { if (!ui.battle && !document.hidden) { const before = S.hp; regen(S); if (S.hp !== before) { renderTop(); persist(); } } }, 20000);

/* ---------- Android Back button ----------
   Back closes what is on top (sheet → camera → photo flow → other overlays), then returns to the Hunt screen; on the
   Hunt screen the first Back shows a toast and a second Back within 2 s leaves SNAPMON.
   Browser: SNAPMON keeps ONE extra "guard" history entry above its page, so Back fires popstate instead of leaving.
   The guard is (re)armed by the player's taps, because Chrome ignores history entries added without a user gesture
   when the user presses Back; it is never stacked, so history cannot grow or loop and Forward is not broken.
   Native (Capacitor): call SnapmonNav.back() from the platform's backButton listener and exit the app when it
   returns 'exit' (see docs/ANDROID.md). */
const Nav = (() => {
  let exitArmedAt = 0;
  const isGuard = () => history.state && history.state.snapmon === 'guard';
  function arm() { if (!isGuard()) { try { history.pushState({ snapmon: 'guard' }, ''); } catch (e) {} } }
  // returns 'handled' (something was closed), 'armed' (exit toast shown) or 'exit'
  function back() {
    if ($('#sheet').innerHTML) { closeSheet(); return 'handled'; }
    if ($('#overlay').innerHTML) {
      if (Platform.camera.isOpen() || $('#camVideo')) { closeCamera(); return 'handled'; }
      if (ui.battle) { toast('Finish the battle, or use Flee to escape.'); return 'handled'; }        // never abandon a fight silently
      if (ui.discovered) { toast('Choose Fight or Let it slip away.'); return 'handled'; }            // an encounter is a decision
      if (ui.pending && ui.pending.scanning) return 'handled';                                        // the scan finishes by itself
      if (ui.pending) { cancelPhoto(); return 'handled'; }
      $('#overlay').innerHTML = ''; render(); return 'handled';
    }
    if (ui.tab !== 'hunt') { actions.tab('hunt'); return 'handled'; }
    if (Date.now() - exitArmedAt < 2000) { exitArmedAt = 0; persist(true); return 'exit'; }
    exitArmedAt = Date.now(); toast('Press Back again to exit SnapMon.'); return 'armed';
  }
  try { if (!history.state || !history.state.snapmon) history.replaceState({ snapmon: 'root' }, ''); } catch (e) {}
  document.addEventListener('pointerdown', arm, true);
  document.addEventListener('keydown', arm, true);
  window.addEventListener('popstate', ev => {
    if (ev.state && ev.state.snapmon === 'guard') return; // Forward onto our own guard: nothing to do
    const r = back();
    if (r === 'exit') history.back(); // leave SNAPMON (closes an installed app; returns to the previous page in a tab)
    else arm();                        // put the guard back (if Chrome skips it, the next tap re-arms it)
  });
  return { back, arm };
})();
window.SnapmonNav = { back: Nav.back }; // for a native wrapper's hardware Back button

/* test hooks (used by the automated browser tests) */
window.__snapmon = { get S() { return S; }, set S(v) { S = v; }, ui, actions, setRNG: f => { RNG = f; }, render };

render();
persist(true);
if (migratedFrom) setTimeout(() => toast(`Save upgraded from format ${migratedFrom} to ${SAVE_VERSION}. Your monsters were kept; a copy of the old save is stored too.`), 800);
// v0.4: Hybrid is the only recogniser; the old developer switch between recognisers is gone
delete S.settings.expLens;
if (S.settings.forceCPU && devOn()) Engine.setForceCPU(true);
if (S.settings.clipGPU && devOn()) Engine.setClipGPU(true);
if (S.settings.engineCached) setTimeout(() => Engine.load(), 300); // engine saved on this phone: wake it right away (SNAP unlocks when ready)
