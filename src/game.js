/* SNAPMON — game state, saves, encounters, monster generation, combat rules, rewards. No DOM access here. */
'use strict';

const SAVE_KEY = 'snapmon.save.v1';      // storage key name kept from v0.1 so existing saves are found
const SAVE_VERSION = 3;                  // bump + add a migration step whenever the save format changes
const GAME_VERSION = '0.6.0';
const STORE = {
  get: k => { try { return typeof Platform !== 'undefined' ? Platform.storage.get(k) : localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { if (typeof Platform !== 'undefined') return Platform.storage.set(k, v); localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const randRange = (rng, a, b) => a + rng() * (b - a);
const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
let RNG = Math.random; // swappable for tests
let CLOCK = () => Date.now(); // wall-clock ms for the quiet-object rule; swappable for tests

function freshState() {
  return {
    v: SAVE_VERSION, created: Date.now(), level: 1, xp: 0, hp: 60, coins: 40, rp: 0,
    mats: { scrap: 4, goo: 4, ecto: 0, prism: 0 },
    items: { potion: 3, greater: 0, strength: 0, defense: 0, antidote: 1, enhancer: 0, trap: 5, smoke: 1 },
    weapons: { sword: 0 }, equipped: 'sword', charms: {}, charmSlots: [null, null],
    research: {}, monsters: [], dex: {}, companion: null,
    questsClaimed: {}, achievements: {},
    stats: { photos: 0, encounters: 0, wins: 0, losses: 0, captures: 0, flees: 0, capByFam: {}, famSeen: {}, catsPhotographed: {}, objsPhotographed: {},
             cleanWins: 0, rareBeaten: 0, epicSeen: 0, legendSeen: 0, shinySeen: 0, upgrades: 0, battles: 0, unrecognized: 0, labelsSeen: {} },
    enc: { miss: 0, sinceRare: 0, recentHashes: [], recentCats: [], recentObjs: [], quiet: {}, disturbed: {} },
    hunterName: 'Hunter', // the player's own character (Settings); monsters keep their official names
    settings: { muted: false, keepPhotos: false, debugLens: false, lensCached: false, engineCached: false, fieldTest: false },
    lastTick: Date.now(), nextId: 1, log: [],
  };
}
function migrate(s) {
  const base = freshState();
  const out = Object.assign(base, s);
  for (const k of ['mats', 'items', 'stats', 'enc', 'settings']) out[k] = Object.assign(base[k] || freshState()[k], s[k] || {});
  for (const k of ['capByFam', 'famSeen', 'catsPhotographed', 'objsPhotographed']) out.stats[k] = out.stats[k] || {};
  out.enc.recentObjs = out.enc.recentObjs || [];
  if (!Array.isArray(out.charmSlots)) out.charmSlots = [null, null];
  if (!out.weapons || !Object.keys(out.weapons).length) out.weapons = { sword: 0 };
  if (!WEAPONS[out.equipped] || out.weapons[out.equipped] == null) out.equipped = Object.keys(out.weapons)[0];
  out.monsters = (out.monsters || []).filter(m => m && m.cat && CATEGORY[m.cat] && m.dna);
  // v1 -> v2 (AI recognition update): manual-entry setting retired, new counters added. Monsters, dex and progress are kept as-is.
  if ((s.v || 1) < 2) { delete out.settings.aiLens; out.v = 2; }
  if (!out.stats.labelsSeen) out.stats.labelsSeen = {};
  if ((s.v || 1) < 3) migrateV2toV3(out);
  for (const m of out.monsters) assignAbilityKeys(m); // additive: older saves gain stable ability keys, nothing else changes
  for (const m of out.monsters) rebuildCombat(m); // combat model 2: pre-model-2 monsters fight by their real family
  for (const d of Object.values(out.dex || {})) if (d && !FAMILY_IDS.includes(d.fam)) d.fam = familyOf(d);
  for (const st of [out.stats.famSeen, out.stats.capByFam]) for (const k of Object.keys(st)) if (!FAMILY_IDS.includes(k)) delete st[k]; // 'spectral'/'mutated' were never families
  out.enc.quiet = quietClean(out.enc.quiet, CLOCK()); // additive (older saves have none); invalid entries dropped
  out.enc.disturbed = lockClean(out.enc.disturbed, CLOCK(), ENCOUNTER_LOCK_MS);
  out.hunterName = cleanHunterName(out.hunterName) || 'Hunter';
  return out;
}
/* v2 -> v3 (object registry): monsters and the encyclopedia are keyed by specific objects instead of category+rarity.
   Nothing is deleted: captured monsters keep their exact appearance (their stored DNA still renders with the original
   sprite code) and gain an object id; old encyclopedia entries are merged into the matching object entries. */
function migrateV2toV3(out) {
  const objFor = (label, word, cat) => objectForLabel(label) || objectForLabel(word) || CAT_DEFAULT_OBJECT[cat] || null;
  for (const m of out.monsters) {
    if (m.obj) continue;
    m.obj = objFor(m.label, m.word, m.cat);
    if (m.obj) m.species = 'o:' + m.obj;
  }
  const dex = {};
  const merge = (obj, d) => {
    if (!obj || !OBJECTS[obj]) return;
    const k = 'o:' + obj, e = dex[k] || (dex[k] = { key: k, obj, name: OBJECTS[obj].name, monsterName: d.name || OBJECTS[obj].name, cat: OBJECTS[obj].cat, fam: d.fam, first: d.first || Date.now(), seen: 0, caught: 0, rarities: {}, dna: d.dna, variants: {} });
    e.first = Math.min(e.first, d.first || e.first); e.seen += d.seen || 0; e.caught += d.caught || 0;
    if (d.rarity) e.rarities[d.rarity] = true;
    Object.assign(e.variants, d.variants || {});
  };
  for (const d of Object.values(out.dex || {})) if (!d.obj) merge(objFor(null, d.word, d.cat), d); else dex[d.key] = d;
  for (const m of out.monsters) if (m.obj && !dex['o:' + m.obj]) merge(m.obj, { name: m.name, fam: m.fam, first: m.caughtAt, seen: 1, caught: 1, rarity: m.rarity, dna: m.dna });
  out.dex = dex;
  for (const [cat, n] of Object.entries(out.stats.catsPhotographed || {})) { const o = CAT_DEFAULT_OBJECT[cat]; if (o) out.stats.objsPhotographed[o] = (out.stats.objsPhotographed[o] || 0) + n; }
  out.v = 3;
}
let storageOK = true;
let saveBlocked = null; // set when the stored save comes from a NEWER game version (e.g. after a code rollback)
let migratedFrom = 0;    // old save format number when this load upgraded the save
function loadState() {
  let raw = null;
  try { raw = STORE.get(SAVE_KEY); } catch (e) { storageOK = false; }
  if (!raw) return freshState();
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { saveBlocked = { reason: 'corrupt', raw }; return freshState(); }
  if ((parsed.v || 1) > SAVE_VERSION) { saveBlocked = { reason: 'newer', version: parsed.v, raw }; return freshState(); }
  // keep an untouched copy of the old save before migrating it (one per old version)
  if ((parsed.v || 1) < SAVE_VERSION) { migratedFrom = parsed.v || 1; const bk = SAVE_KEY + '.backup.v' + (parsed.v || 1); if (!STORE.get(bk)) STORE.set(bk, raw); }
  let S;
  try { S = withLore(migrate(parsed)); } catch (e) { saveBlocked = { reason: 'corrupt', raw }; return freshState(); }
  // curated-writing refresh (src/curated.js): once per content revision, existing monsters take the latest reviewed
  // names, flavour text and move names. Before the FIRST refresh the untouched save is kept once (a single key, so later
  // content revisions never pile up copies in storage; they only ever change text).
  if (typeof curatedRefresh === 'function' && CURATED.enabled && CURATED.revision && S.curatedRev !== CURATED.revision) {
    const bk = SAVE_KEY + '.backup.precurated'; try { if (!STORE.get(bk)) STORE.set(bk, raw); } catch (e) { /* backup is best effort */ }
    curatedRefresh(S);
  }
  return S;
}
// v0.4.2: monsters store their flavour text; older monsters get theirs once (deterministic, so it is the same text
// they already showed after the update) and keep it from then on. Additive field: the save format stays 3.
function withLore(s) { for (const m of s.monsters || []) if (!m.lore) m.lore = monsterLore(m); return s; }
function saveState(S) {
  if (saveBlocked) return false; // never overwrite a save we could not read safely
  const ok = STORE.set(SAVE_KEY, JSON.stringify(S));
  storageOK = ok; return ok;
}
function exportSave(S) { return 'SNAPMON1:' + btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function importSave(text) {
  text = (text || '').trim();
  if (!text.startsWith('SNAPMON1:')) throw new Error('That is not a SNAPMON backup code. It should start with SNAPMON1:');
  const obj = JSON.parse(decodeURIComponent(escape(atob(text.slice(9)))));
  if (!obj || typeof obj.level !== 'number' || !Array.isArray(obj.monsters)) throw new Error('The backup code is damaged or incomplete.');
  if ((obj.v || 1) > SAVE_VERSION) throw new Error(`This backup was made by a newer SNAPMON (save format ${obj.v}). Update the game before restoring it.`);
  const S = migrate(obj);
  if (typeof curatedRefresh === 'function') curatedRefresh(S); // restored backups get the latest reviewed writing too
  return S;
}

/* ---------- hunter ---------- */
const has = (S, r) => !!S.research[r];
const charmOn = (S, c) => S.charmSlots.includes(c);
function xpFor(level) { return Math.round(25 * Math.pow(level, 1.55)); }
function charmSlotCount(S) { return S.level >= 5 ? 2 : 1; }
function companionOf(S) { return S.companion ? S.monsters.find(m => m.id === S.companion) : null; }
function weaponAtk(id, lvl) { return Math.round(WEAPONS[id].atk * (1 + 0.15 * lvl)); }
function maxWeaponLevel(S) { return has(S, 'smith') ? 8 : 5; }
function hunterStats(S, weaponId = S.equipped) {
  const L = S.level, comp = companionOf(S), w = WEAPONS[weaponId], up = S.weapons[weaponId] || 0;
  const st = {
    maxHp: 60 + 12 * (L - 1) + (has(S, 'vital') ? 20 : 0),
    atk: 6 + 2 * (L - 1) + weaponAtk(weaponId, up),
    def: 3 + (L - 1) + (charmOn(S, 'plate') ? 4 : 0),
    spd: 10 + L + (charmOn(S, 'slipper') ? 4 : 0),
    crit: w.crit + up * 0.02 + (charmOn(S, 'sock') ? 0.06 : 0),
  };
  if (comp) { st.maxHp += Math.round(comp.stats.hp * 0.08); st.atk += Math.round(comp.stats.atk * 0.12); st.def += Math.round(comp.stats.def * 0.12); }
  return st;
}
function regen(S, now = Date.now()) { // gentle passive healing between hunts: 3% max HP per minute
  const mins = Math.max(0, (now - (S.lastTick || now)) / 60000);
  const max = hunterStats(S).maxHp;
  if (S.hp < max && mins > 0) S.hp = Math.min(max, S.hp + Math.floor(mins * max * MECH.regenPerMin));
  if (mins >= 1 / 3 || S.hp >= max) S.lastTick = now;
  S.hp = Math.min(S.hp, max);
}
function addXP(S, amt) {
  const ups = [];
  S.xp += amt;
  while (S.xp >= xpFor(S.level)) {
    S.xp -= xpFor(S.level); S.level++; S.rp += 1;
    S.hp = hunterStats(S).maxHp; ups.push(S.level);
  }
  return ups;
}

/* ---------- rewards ---------- */
function grant(S, reward, mult = 1) {
  const out = [];
  for (const [k, v0] of Object.entries(reward || {})) {
    const v = Math.round(v0 * mult); if (!v) continue;
    if (k === 'coins') S.coins += v;
    else if (k === 'rp') S.rp += v;
    else if (k === 'xp') out.push(...addXP(S, v).map(l => ({ levelUp: l })));
    else if (MATERIALS[k]) S.mats[k] = (S.mats[k] || 0) + v;
    else if (ITEMS[k]) S.items[k] = (S.items[k] || 0) + v;
    out.push({ k, v });
  }
  return out;
}
function rewardLabel(k, v) {
  if (k === 'coins') return `${v} Spirit Coins`;
  if (k === 'rp') return `${v} Research Point${v > 1 ? 's' : ''}`;
  if (k === 'xp') return `${v} XP`;
  if (MATERIALS[k]) return `${v} ${MATERIALS[k].name}`;
  if (ITEMS[k]) return `${v}× ${ITEMS[k].name}`;
  return `${v} ${k}`;
}
function canAfford(S, cost) {
  return Object.entries(cost || {}).every(([k, v]) => k === 'lvl' ? S.level >= v : k === 'coins' ? S.coins >= v : (S.mats[k] || 0) >= v);
}
function pay(S, cost) {
  for (const [k, v] of Object.entries(cost || {})) { if (k === 'lvl') continue; if (k === 'coins') S.coins -= v; else S.mats[k] -= v; }
}

/* ---------- quests & achievements ---------- */
function activeQuests(S) { return QUESTS.filter(q => !S.questsClaimed[q.id]).slice(0, 3); }
function questProgress(S, q) { return Math.min(q.target, q.prog(S) || 0); }
function claimQuest(S, id) {
  const q = QUESTS.find(x => x.id === id);
  if (!q || S.questsClaimed[id] || !activeQuests(S).includes(q) || questProgress(S, q) < q.target) return null;
  S.questsClaimed[id] = Date.now();
  return grant(S, q.reward);
}
function checkAchievements(S) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) if (!S.achievements[a.id] && a.check(S)) { S.achievements[a.id] = Date.now(); grant(S, a.reward); fresh.push(a); }
  return fresh;
}

/* ---------- photo similarity ---------- */
function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 99;
  let d = 0;
  for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } }
  return d;
}

/* ---------- rule numbers ----------
   The battle, capture and encounter numbers live here so the in-game Guide (src/guide.js) can show the real values.
   Changing a number here changes the game AND the guide. */
const MECH = {
  enc: { base: 0.45, lens: 0.06, newObj: 0.15, sameObj: 0.12, perMiss: 0.08, pity: 4, pitySensor: 3, dupMult: 0.3, min: 0.02 },
  status: { poisonPct: 0.07, poisonMin: 2, burnPct: 0.05, burnFlat: 2, burnMin: 2, burnAtk: 0.85, defdown: 0.5, atkup: 1.5, defup: 1.6, stunAcc: 0.15 },
  weak: 1.5, resist: 0.7, firstStrike: 1.25,
  enemy: { abilityRate: 0.5, healBelow: 0.4, healAmt: 0.25, crit: 0.06, critX: 1.5, dodgeBase: 0.04, dodgePerSpd: 0.01, dodgeMax: 0.2, missPerSpd: 0.01 },
  energy: { start: 30, battery: 25, perAttack: 20, max: 100 },
  capture: { hpWeight: 0.8, stun: 0.15, dot: 0.05, research: 0.08, lenscap: 0.06, variantMult: 0.85, min: 0.03, max: 0.97, enhancer: 0.25, escapeAfter: 3, escapeChance: 0.35, quantumRefund: 0.35 },
  flee: { base: 0.55, perSpd: 0.03, slipper: 0.15, legendary: 0.2, min: 0.15, max: 0.95 },
  afterWin: 0.2, defeatCoins: 0.15, defeatHp: 0.4, regenPerMin: 0.03, fang: 0.15,
};

/* ---------- encounters ---------- */
/* Quiet objects. When a confirmed object is scanned and the encounter roll finds no monster, that object stays quiet
   for QUIET_MS of real time: scanning it again cannot produce a monster, whatever the odds, pity or luck. The key is the
   canonical object id the player confirmed (OBJECTS registry), so it covers the object TYPE: every physical object the
   recogniser identifies as that kind (two different monitors are both "monitor"), from any angle or photo. Recognition
   cannot tell two physical objects of the same kind apart, so a per-instance lock would only be a photo-hash lock, which
   a new angle defeats. A blocked scan changes nothing at all: no roll, no photo/pressure/pity/quest progress, and the
   expiry is not extended. Stored as S.enc.quiet = { objectId: expiresAtMs } in the normal save (format 3, additive).
   The duration is never shown to the player. */
/* Disturbed objects (2026-11-24): the same idea for SUCCESS. When a confirmed object produces any normal encounter
   (whatever happens next: fight, capture, flee, defeat, letting it slip away), that object TYPE cannot produce another
   monster for ENCOUNTER_LOCK_MS — no rarity farming on one object. Same key, same rules and the same blocking point as
   the quiet lock; stored as S.enc.disturbed = { objectId: expiresAtMs }. Both durations are developer configuration
   only (one constant each), never shown to the player. */
const QUIET_MS = 20 * 60 * 1000;           // after a scan that found NO monster
const ENCOUNTER_LOCK_MS = 60 * 60 * 1000;  // after a scan that found a monster
const QUIET_MAX = 300; // more entries than this are pruned (latest-expiring kept); expired ones always are
// valid, unexpired entries only; an expiry further away than maxMs (the clock was turned back) is capped at maxMs
function lockClean(q, now, maxMs) {
  const out = {};
  if (!q || typeof q !== 'object' || Array.isArray(q) || !Number.isFinite(now)) return out;
  const live = Object.entries(q).filter(([k, v]) => typeof k === 'string' && k && typeof v === 'number' && Number.isFinite(v) && v > now)
    .map(([k, v]) => [k, Math.min(v, now + maxMs)]).sort((a, b) => b[1] - a[1]).slice(0, QUIET_MAX);
  for (const [k, v] of live) out[k] = v;
  return out;
}
const quietClean = (q, now) => lockClean(q, now, QUIET_MS);
// expiry (ms) when the object is locked in map `q` right now, otherwise 0
function lockUntil(q, objId, now, maxMs) {
  if (!q || typeof q !== 'object') return 0;
  let u = q[objId];
  if (typeof u !== 'number' || !Number.isFinite(u) || u <= now) return 0;
  if (u > now + maxMs) { u = now + maxMs; q[objId] = u; } // clock turned back: never longer than the rule allows
  return u;
}
function quietUntil(S, objId, now = CLOCK()) { return lockUntil(S.enc && S.enc.quiet, objId, now, QUIET_MS); }
function disturbedUntil(S, objId, now = CLOCK()) { return lockUntil(S.enc && S.enc.disturbed, objId, now, ENCOUNTER_LOCK_MS); }
// which lock blocks this object right now: 'disturbed' (after an encounter) wins over 'quiet' (after a miss), or null
function objectLock(S, objId, now = CLOCK()) { return disturbedUntil(S, objId, now) ? 'disturbed' : quietUntil(S, objId, now) ? 'quiet' : null; }

/* The player's own character name (Settings). Trimmed, inner whitespace collapsed, control characters and angle brackets
   removed, at most HUNTER_NAME_MAX characters, and it must contain a letter or digit; otherwise null (rejected). The UI
   escapes it on every render anyway. */
const HUNTER_NAME_MAX = 16;
function cleanHunterName(v) {
  if (typeof v !== 'string') return null;
  let s = v.normalize ? v.normalize('NFC') : v;
  s = s.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, HUNTER_NAME_MAX).join('').trim();
  return /[\p{L}\p{N}]/u.test(s) ? s : null;
}
const hunterName = S => cleanHunterName(S && S.hunterName) || 'Hunter';

function encounterChance(S, obj, photo) {
  const dup = !!(photo && photo.hash && S.enc.recentHashes.some(h => hamming(h, photo.hash) <= 6));
  const newCat = !S.stats.objsPhotographed[obj];   // exploring new kinds of object is rewarded
  const rc = S.enc.recentObjs, cat = obj;
  const E = MECH.enc;
  let p = E.base + (has(S, 'lens1') ? E.lens : 0) + (has(S, 'lens2') ? E.lens : 0);
  if (newCat) p += E.newObj;
  if (rc.length >= 2 && rc[rc.length - 1] === cat && rc[rc.length - 2] === cat) p -= E.sameObj;
  p += S.enc.miss * E.perMiss;
  const pityMax = has(S, 'sensor') ? E.pitySensor : E.pity;
  let pity = false;
  if (!dup && S.enc.miss >= pityMax) { p = 1; pity = true; }
  if (dup) p *= E.dupMult;
  return { p: clamp(p, E.min, 1), dup, newCat, pity };
}
function rarityWeights(S) {
  const w = Object.fromEntries(RARITIES.map(r => [r.id, r.weight]));
  if (has(S, 'lens3')) { w.rare *= 1.4; w.epic *= 1.4; w.legendary *= 1.4; }
  if (has(S, 'legend')) w.legendary *= 2;
  if (S.enc.sinceRare >= 10) { w.common = 0; w.uncommon = 0; } // hidden rarity pity
  return w;
}
function pickWeighted(weights, rng) {
  const tot = Object.values(weights).reduce((a, b) => a + b, 0);
  let x = rng() * tot;
  for (const [k, v] of Object.entries(weights)) { if ((x -= v) < 0) return k; }
  return Object.keys(weights)[0];
}
/* Main photo resolution for a RECOGNISED object. Mutates S. Returns { encounter, monster?, line, ... }
   obj: the recognised object { label, sub, aspect, conf } (a plain string is accepted as the label). */
function resolvePhoto(S, objId, photo, obj, rng = RNG) {
  if (typeof obj === 'string' || obj == null) obj = { label: obj || '' };
  if (!OBJECTS[objId] && CATEGORY[objId]) objId = CAT_DEFAULT_OBJECT[objId] || objId; // a bare category id (older callers/tests)
  const cat = OBJECTS[objId] ? OBJECTS[objId].cat : objId;
  const word = obj.label;
  // quiet object (see quietUntil): decided before ANY change or roll — no first-hunt guarantee, odds or pity apply
  const now = CLOCK();
  if (!S.enc.quiet || typeof S.enc.quiet !== 'object') S.enc.quiet = {};
  if (!S.enc.disturbed || typeof S.enc.disturbed !== 'object') S.enc.disturbed = {};
  const lock = objectLock(S, objId, now);
  if (lock) {
    const objName = (word || (OBJECTS[objId] ? OBJECTS[objId].name : CATEGORY[cat] ? CATEGORY[cat].name.split(' /')[0] : 'object')).toLowerCase();
    const lines = lock === 'disturbed' ? DISTURBED_OBJECT_LINES : QUIET_OBJECT_LINES;
    const line = lines[(S.stats.photos + objId.length) % lines.length]; // no RNG: nothing is rolled
    return { encounter: false, quiet: lock === 'quiet', disturbed: lock === 'disturbed', lock, line: line.replace('{obj}', objName) };
  }
  if (word) S.stats.labelsSeen[word] = (S.stats.labelsSeen[word] || 0) + 1;
  const first = S.stats.photos === 0 && S.stats.encounters === 0;
  const ch = encounterChance(S, objId, photo);
  S.stats.photos++;
  S.stats.catsPhotographed[cat] = (S.stats.catsPhotographed[cat] || 0) + 1;
  S.stats.objsPhotographed[objId] = (S.stats.objsPhotographed[objId] || 0) + 1;
  S.enc.recentObjs = [...S.enc.recentObjs, objId].slice(-5);
  if (photo && photo.hash) S.enc.recentHashes = [...S.enc.recentHashes, photo.hash].slice(-12);
  const hit = first || rng() < ch.p;
  if (!hit) {
    if (!ch.dup) S.enc.miss++;
    S.enc.quiet = quietClean({ ...S.enc.quiet, [objId]: now + QUIET_MS }, now); // this object goes quiet (set once per miss)
    const lines = ch.dup ? DUPLICATE_LINES : NO_ENCOUNTER_LINES;
    const objName = (word || CATEGORY[cat].name.split(' /')[0]).toLowerCase();
    return { encounter: false, dup: ch.dup, line: lines[Math.floor(rng() * lines.length)].replace('{obj}', objName), chance: ch };
  }
  S.enc.miss = 0;
  S.enc.disturbed = lockClean({ ...S.enc.disturbed, [objId]: now + ENCOUNTER_LOCK_MS }, now, ENCOUNTER_LOCK_MS); // any encounter locks the object type
  let rarity = first ? 'common' : pickWeighted(rarityWeights(S), rng);
  if (RARITY[rarity].tier >= 2) S.enc.sinceRare = 0; else S.enc.sinceRare++;
  let variant = null;
  if (!first) {
    if (has(S, 'spectral') && rng() < 0.09) variant = 'spectral';
    else if (has(S, 'mutagen') && rng() < 0.09) variant = 'mutated';
    if (has(S, 'chroma') && rng() < 1 / 12) variant = 'shiny';
  }
  const m = createMonster(S, { obj: objId, cat, rarity, variant, word, photo, first, rng, aspect: obj.aspect, conf: obj.conf });
  return { encounter: true, monster: m, first, chance: ch };
}

/* ---------- developer tools (2026-11-26) ----------
   DEV_TOOLS is the single build switch: true only in the private debug APK; tools/android/build-web.js flips it to false
   for a release-safe build and a release build refuses a dev-tools game. Every developer ACTION below checks it AND the
   hidden "Developer & testing" unlock (S.settings.devUnlocked) itself, so nothing depends on the UI hiding a button.
   The tools work on the REAL save: a spawned encounter is an ordinary monster from the normal generator (no test flag,
   no separate roster) and goes through the normal discovery, battle, capture, reward and collection code; a grant adds
   to the real bag. The old Quick Monster Test Mode, its TestRoster (storage key snapmon.testroster.v1, left untouched
   and unread) and Instant capture are retired. */
const DEV_TOOLS = true;
const devToolsOn = S => DEV_TOOLS === true && !!(S && S.settings && S.settings.devUnlocked === true);
// God Mode: its own setting key (the retired test-battle switch S.settings.godMode is ignored, so an old "on" never
// carries over into real battles). Default off.
const godModeOn = S => devToolsOn(S) && S.settings.devGodMode === true;
// user-facing variant -> stored value (Normal = null, Prismatic = 'shiny', as everywhere in the save)
const DEV_VARIANTS = { normal: null, spectral: 'spectral', mutated: 'mutated', prismatic: 'shiny' };
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
/* Custom encounter: a real monster of exactly this registry object, rarity and variant. It bypasses only the camera,
   recognition, the encounter roll, rarity/variant rolls, the first-hunt rules and the object locks; it neither reads
   nor writes S.enc (locks, pity, recent objects) or the photo statistics, so regular hunting is unaffected. No photo:
   the generator's own neutral colouring is used. The caller records the sighting and shows the ordinary discovery. */
/* Monster level (build 22): 'auto' (the default; also empty/null) keeps the normal rule — the hunter's level plus the
   rarity's bonus — exactly as a camera hunt; or a whole number DEV_LEVEL_MIN..DEV_LEVEL_MAX, used DURING generation
   (createMonster `level`), so stats come from the generator for that level, family, rarity, variant and seed. 100 is
   far beyond normal play (hunters reach the low teens) yet keeps every number small and finite. */
const DEV_LEVEL_MIN = 1, DEV_LEVEL_MAX = 100;
function devParseLevel(level) {
  if (level == null || level === 'auto' || (typeof level === 'string' && !level.trim())) return { ok: true, level: null };
  const n = typeof level === 'number' ? level : typeof level === 'string' && /^\s*\d{1,4}\s*$/.test(level) ? Number(level) : NaN;
  if (!Number.isInteger(n) || n < DEV_LEVEL_MIN || n > DEV_LEVEL_MAX) return { ok: false, error: `Monster level must be a whole number from ${DEV_LEVEL_MIN} to ${DEV_LEVEL_MAX} (or empty for Auto).` };
  return { ok: true, level: n };
}
function devSpawnEncounter(S, objId, rarity, variant, rng = RNG, level = 'auto') {
  if (!devToolsOn(S)) return { ok: false, error: 'Developer tools are not available.' };
  if (!own(OBJECTS, objId) || !OBJECTS[objId] || OBJECTS[objId].id !== objId) return { ok: false, error: 'Unknown object id.' };
  if (!own(RARITY, rarity)) return { ok: false, error: 'Unknown rarity.' };
  if (!own(DEV_VARIANTS, variant)) return { ok: false, error: 'Unknown variant.' };
  const lv = devParseLevel(level); if (!lv.ok) return lv;
  const o = OBJECTS[objId];
  const m = createMonster(S, { obj: objId, cat: o.cat, rarity, variant: DEV_VARIANTS[variant], word: o.name, photo: null, first: false, rng, level: lv.level });
  return { ok: true, monster: m };
}
/* Give items: Snap Traps, potions and the other bag items, and the crafting materials (not coins, XP or research
   points). A positive whole number up to DEV_GRANT_MAX per grant; the resulting total may not pass DEV_GRANT_TOTAL. */
const DEV_GRANT_MAX = 999, DEV_GRANT_TOTAL = 99999;
const DEV_GRANT_MATS = ['scrap', 'goo', 'ecto', 'prism'];
const devGrantable = () => [...ITEM_ORDER.map(id => ({ id, kind: 'item', name: ITEMS[id].name })), ...DEV_GRANT_MATS.map(id => ({ id, kind: 'mat', name: MATERIALS[id].name }))];
function devGrantItem(S, id, qty) {
  if (!devToolsOn(S)) return { ok: false, error: 'Developer tools are not available.' };
  const kind = own(ITEMS, id) ? 'item' : DEV_GRANT_MATS.includes(id) ? 'mat' : null;
  if (!kind) return { ok: false, error: 'Unknown item.' };
  const n = typeof qty === 'number' ? qty : typeof qty === 'string' && /^\s*\d{1,6}\s*$/.test(qty) ? Number(qty) : NaN;
  if (!Number.isSafeInteger(n) || n < 1 || n > DEV_GRANT_MAX) return { ok: false, error: `Enter a whole number from 1 to ${DEV_GRANT_MAX}.` };
  const box = kind === 'item' ? S.items : S.mats, cur = Number.isSafeInteger(box[id]) && box[id] > 0 ? box[id] : 0;
  if (cur + n > DEV_GRANT_TOTAL) return { ok: false, error: `That would pass ${DEV_GRANT_TOTAL} in total.` };
  box[id] = cur + n;
  return { ok: true, id, kind, total: box[id] };
}

/* ---------- stable ability keys ----------
   Every ability carries `key`, a stable internal id unique within its monster: 'signature' (the first move),
   'kit.<slug>' (a move from its kit), 'fam.<slug>' (a family move), 'legend', 'ultimate', or 'move.<slug>' for
   anything else in older saves. Battle cooldowns use the key, so renaming a move can never change how it works.
   `cdWith` keeps the pre-key rule that two moves with the SAME NAME share one cooldown (it occurs in 4 of ~46,000
   possible monsters, e.g. an epic bee with "Sting" as signature and kit move); it is decided once, when keys are
   assigned, and never again from names. Keys are additive: older game versions ignore them. */
const abilitySlug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function assignAbilityKeys(m) {
  if (!m || !Array.isArray(m.abilities)) return m;
  const o = m.obj && OBJECTS[m.obj], kit = new Set(), fam = new Set();
  try { for (const a of moveKit(m.cat || (o && o.cat) || 'other', o)) kit.add(a.name); } catch (e) { /* unknown category: no kit */ }
  for (const f of Object.values(FAMILIES)) for (const a of f.abilities) fam.add(a.name);
  const used = new Set(m.abilities.filter(a => a && a.key).map(a => a.key)), byName = {};
  for (const a of m.abilities) if (a && a.key) byName[a.name] = byName[a.name] || a.cdWith || a.key;
  m.abilities.forEach((a, i) => {
    if (!a || a.key) return;
    const base = i === 0 ? 'signature' : a.variant ? 'variant' : a.ultimate ? 'ultimate' : a.legend ? 'legend' : kit.has(a.name) ? 'kit.' + abilitySlug(a.name) : fam.has(a.name) ? 'fam.' + abilitySlug(a.name) : 'move.' + abilitySlug(a.name);
    let k = base, n = 2; while (used.has(k)) k = base + '.' + n++;
    a.key = k; used.add(k);
    if (byName[a.name]) a.cdWith = byName[a.name]; else byName[a.name] = k;
  });
  return m;
}
const cooldownKey = a => a.cdWith || a.key || a.name;
const signatureOf = m => m && m.abilities && (m.abilities.find(a => a.key === 'signature') || m.abilities[0]); // name only as a last resort for a keyless ability

/* ---------- monsters ---------- */
function joinName(a, b) {
  if (!a) return b;
  const al = a[a.length - 1].toLowerCase(), bf = b[0].toLowerCase();
  if (al === bf) return a + b.slice(1);
  if ('aeiouy'.includes(al) && 'aeiouy'.includes(bf)) return a + b.slice(1);
  return a + b;
}
function titleCase(w) { return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w; }
function speciesKey(cat, rarity) { return cat + ':' + rarity; }
function speciesName(cat, rarity, word, fam) {
  const c = CATEGORY[cat];
  const h = hashStr(cat + '|' + rarity + '|' + (word || ''));
  let pre = c.names.length ? c.names[h % c.names.length] : titleCase((word || 'Odd').replace(/[^a-z]/gi, '').slice(0, 6)) || 'Odd';
  const suf = SUFFIX[rarity][(h >>> 5) % SUFFIX[rarity].length];
  let name = joinName(pre, suf);
  if (rarity === 'legendary') name += ', ' + (word ? legendTitle({ id: 'w:' + word, name: word }, fam) : LEGEND_TITLES[fam]);
  return name;
}
/* Combat model 2 (2026-11-26): the monster's family (stored as m.fam) comes from its object alone — never from its
   variant — and drives its stats, weaknesses, resistances, family moves and family material. See VARIANTS (data.js)
   for what a variant adds on top. `variant` is accepted for the old call shape and deliberately ignored. */
function monsterFamily(cat, word, variant, o) {
  if (o && o.fam) return o.fam; // v0.4.5: the object's own family (a spoon is Household, not Mechanical like its "tool" category)
  return CATEGORY[cat].fam || NATIVE_FAMILIES[hashStr(word || 'x') % 6];
}
// the FAMILY of a registry object: identical for every rarity and variant of that object
function objectFamily(objId) { const o = OBJECTS[objId]; return o ? monsterFamily(o.cat, o.name, null, o) : null; }
/* The family of a monster or an encyclopedia entry ({obj, cat, word, fam}): its object's family; an object-less
   legacy monster keeps a stored real family, else its category's. Always one of FAMILY_IDS. After the combat-model
   migration (rebuildCombat) a saved monster's m.fam equals familyOf(m). */
function familyOf(m) {
  if (!m) return 'household';
  const id = collectionObjId(m);
  if (id && OBJECTS[id]) return objectFamily(id);
  if (FAMILY_IDS.includes(m.fam)) return m.fam;
  const cat = CATEGORY[m.cat] ? m.cat : null;
  if (!cat) return 'household';
  return monsterFamily(cat, m.word, null, null);
}
function cdFor(ab) { return ab.self ? 3 : (ab.power >= 1.3 || ab.hits) ? 3 : ab.effect ? 2 : 2; }
// the object's display name for move names and titles ("Energy Drink", "Padlock")
const objNoun = o => o.name.split(' / ')[0].split(' ').map(titleCase).join(' ');
function moveKit(cat, o) {
  const g = o && o.lore, src = (g && (MOVE_KITS[g] || MOVE_KITS[MOVE_KIT_ALIAS[g]])) || MOVE_KITS[cat] || MOVE_KITS.other;
  return src.split(',').map(s => { const [name, arch] = s.split(':').map(t => t.trim()); return { name, ...MOVE_ARCH[arch] }; });
}
function monsterAbilities(cat, rarity, fam, word, o, variant = null) {
  const list = baseAbilities(cat, rarity, fam, word, o);
  const vm = VARIANTS[variant] && VARIANTS[variant].move;
  if (vm) { // the variant's own move, after the kit/family moves and before a Legendary's legend move and Ultimate
    const at = list.findIndex(a => a.legend || a.ultimate);
    list.splice(at < 0 ? list.length : at, 0, { ...vm, variant: true, cd: cdFor(vm) });
  }
  return list;
}
function baseAbilities(cat, rarity, fam, word, o) {
  const tier = RARITY[rarity].tier;
  // objects get their own seed, so two objects of one category do not share a repertoire
  const SR = mulberry(hashStr('abil:' + cat + rarity + fam + (word || '') + (o ? '|' + o.id : '')));
  const list = [{ ...CATEGORY[cat].sig }];
  if (!o) { // category-only monsters (Oddities): unchanged rules
    const pool = FAMILIES[fam].abilities.slice();
    const extra = [0, 1, 1, 2, 2][tier];
    for (let i = 0; i < extra && pool.length; i++) list.push({ ...pool.splice(Math.floor(SR() * pool.length), 1)[0] });
    if (tier >= 4) list.push({ name: 'Cataclysm of ' + FAMILIES[fam].name.replace(/al$/, 'ia'), power: 2.1, effect: ['burn', 'poison', 'stun', 'defdown'][SR.int(0, 3)], chance: 0.6, ultimate: true });
    return list.map(a => ({ ...a, cd: a.ultimate ? 4 : cdFor(a) }));
  }
  const pool = moveKit(cat, o);
  const extra = [0, 1, 1, 2, 1][tier];
  for (let i = 0; i < extra && pool.length; i++) list.push({ ...pool.splice(Math.floor(SR() * pool.length), 1)[0] });
  if (tier >= 4) {
    // legendary: a legend move and an ultimate that carry the object's own name, unique to this monster
    const N = objNoun(o), archs = Object.keys(LEGEND_MOVE_TPL), arch = archs[hashStr('legend|' + o.id) % archs.length];
    list.push({ ...MOVE_ARCH[arch], name: LEGEND_MOVE_TPL[arch].replace('{N}', N), legend: true });
    const eff = ['burn', 'poison', 'stun', 'defdown'][SR.int(0, 3)], tpl = ULTIMATE_TPL[eff];
    list.push({ name: tpl[hashStr('ult|' + o.id) % tpl.length].replace('{N}', N), power: 2.1, effect: eff, chance: 0.6, ultimate: true });
  }
  return list.map(a => ({ ...a, cd: a.ultimate ? 4 : cdFor(a) }));
}
function monsterStats(rarity, fam, L, seed, variant) {
  const r = RARITY[rarity], f = FAMILIES[fam], R = mulberry(seed + 99);
  const v = () => randRange(R, 0.92, 1.08);
  let st = {
    hp: Math.round((30 + 8 * L) * r.hpMult * f.hp * v()),
    atk: Math.round((5.5 + 1.9 * L) * r.mult * f.atk * v()),
    def: Math.round((2 + 0.9 * L) * r.mult * f.def * v()),
    spd: Math.round((8 + 0.8 * L) * f.spd * v()),
  };
  const vs = VARIANTS[variant] && VARIANTS[variant].stats; // the variant's modifiers on top of family + rarity
  if (vs) for (const k in st) if (vs[k] !== 1) st[k] = Math.round(st[k] * vs[k]);
  return st;
}
function speciesName3(objId, rarity, fam) {
  const o = OBJECTS[objId];
  const h = hashStr(objId + '|' + rarity);
  const head = o.nm || titleCase(o.name.split(/[\s/-]+/).filter(Boolean).pop().replace(/[^a-z]/gi, '').slice(0, 8)) || 'Odd';
  let name = joinName(head, SUFFIX[rarity][(h >>> 5) % SUFFIX[rarity].length]);
  if (rarity === 'legendary') name += ', ' + legendTitle(o, fam);
  return name;
}
// v0.4.5: "the Unbroken Padlock", "the Bottomless Energy Drink": one title per object, never shared
function legendTitle(o, fam) { const adj = LEGEND_ADJ[fam] || LEGEND_ADJ.household; return 'the ' + adj[hashStr('title|' + o.id) % adj.length] + ' ' + objNoun(o); }
function combatAbilities(cat, rarity, fam, word, o, variant) {
  const abilities = monsterAbilities(cat, rarity, fam, word, o, variant);
  if (o && o.sig) abilities[0] = { ...o.sig, cd: cdFor(o.sig) }; // object-specific signature move
  else if (o && o.sigName) abilities[0] = { ...abilities[0], name: o.sigName }; // same numbers, a name that fits the object
  return abilities;
}
/* Combat-model migration (model 2, 2026-11-26). A saved monster whose combat data predates model 2 (no `cv: 2`:
   made by build 19 or older, restored from such a backup code, or caught in an older build after a rollback) gets
   its family, stats and moves rebuilt EXACTLY as a new monster of the same object, rarity, variant, level and seed
   would get them now. Its look (DNA), name, flavour text, level, XP, id, nickname and capture date stay. Every
   monster in a loaded or restored save is therefore of the current model: no mix of old and new combat records.
   Additive field, save format 3 unchanged, so older builds still open the save (they read the stored values). */
const COMBAT_MODEL = 2;
function rebuildCombat(m) {
  if (!m || m.cv === COMBAT_MODEL) return false;
  const id = collectionObjId(m), o = id && OBJECTS[id];
  const cat = o ? o.cat : m.cat;
  if (!CATEGORY[cat] || !RARITY[m.rarity]) return false;
  const fam = o ? objectFamily(id) : familyOf(m);
  const seed = (m.seed >>> 0) || hashStr(String(m.id || m.name || 'm'));
  m.fam = fam;
  m.stats = monsterStats(m.rarity, fam, Math.max(1, m.level | 0), seed, m.variant || null);
  m.abilities = combatAbilities(cat, m.rarity, fam, m.word || null, o || null, m.variant || null);
  assignAbilityKeys(m);
  if (typeof curatedMoveName === 'function' && o) for (const a of m.abilities) { const n = curatedMoveName(o.id, a.key); if (n) a.name = n; }
  m.cv = COMBAT_MODEL;
  return true;
}
// `level` (developer custom encounters only): a fixed monster level used for the stats below; honoured only in a
// developer build (DEV_TOOLS), otherwise ignored, so a release build can never create a forced-level monster. Without
// it every rule — and every random draw — is exactly as before.
function createMonster(S, { obj = null, cat, rarity, variant, word, photo, first, rng = RNG, sub = null, aspect = null, conf = null, level: fixedLevel = null }) {
  if (!obj) obj = CAT_DEFAULT_OBJECT[cat] || null;
  if (obj && OBJECTS[obj]) cat = OBJECTS[obj].cat;
  const o = obj && OBJECTS[obj];
  const fam = monsterFamily(cat, word, variant, o);
  const r = RARITY[rarity];
  const lo = S.level < 3 ? 0 : r.lvl[0], hi = S.level < 3 ? Math.min(1, r.lvl[1]) : r.lvl[1];
  const forced = DEV_TOOLS === true && Number.isInteger(fixedLevel) && fixedLevel >= DEV_LEVEL_MIN && fixedLevel <= DEV_LEVEL_MAX;
  let level = forced ? fixedLevel : first ? 1 : Math.max(1, S.level + randInt(rng, lo, hi) - (rarity === 'common' && rng() < 0.35 ? 1 : 0));
  const seed = Math.floor(rng() * 4294967295) >>> 0;
  const ph = photo ? { hue: photo.hue, sat: photo.sat, lit: photo.lit, ...(photo.pal ? { pal: photo.pal } : {}), ...(photo.engine ? { engine: photo.engine } : {}) } : null; // engine: which recogniser identified it
  const base = { obj, cat, rarity, variant, word: cat === 'other' ? (word || '').toLowerCase().slice(0, 24) : null, seed, photo: ph, sub: sub || null, aspect: aspect ? +(+aspect).toFixed(2) : null };
  const abilities = combatAbilities(cat, rarity, fam, base.word, o, variant);
  const m = {
    ...base, id: null, fam, level, cv: COMBAT_MODEL,
    name: o ? speciesName3(obj, rarity, fam) : speciesName(cat, rarity, base.word, fam),
    stats: monsterStats(rarity, fam, level, seed, variant),
    abilities,
    dna: makeDNA(base), species: o ? 'o:' + obj : speciesKey(cat, rarity), seenAt: Date.now(),
    label: word ? String(word).slice(0, 40) : null, conf: conf != null ? +(+conf).toFixed(2) : null,
  };
  if (first) { m.stats.hp = Math.round(m.stats.hp * 0.8); m.stats.atk = Math.max(3, Math.round(m.stats.atk * 0.8)); }
  assignAbilityKeys(m);
  // curated monster name (reviewed content, src/curated.js): replaces the generated name, including a Legendary's
  // generated title; family, rarity, species, stats and everything else stay as generated. No random numbers.
  if (typeof curatedMonsterName === 'function' && o) { const cn = curatedMonsterName(obj, rarity); if (cn) m.name = cn; }
  // curated move names (src/curated.js, reviewed content only): display names by stable key; numbers, cooldowns and
  // keys are untouched, and no random numbers are used. Saved monsters get them via curatedRefresh (on load/restore).
  if (typeof curatedMoveName === 'function' && o) for (const a of m.abilities) { const n = curatedMoveName(obj, a.key); if (n) a.name = n; }
  m.lore = monsterLore(m); // flavour text for this object AND rarity, stored so it never changes (lore.js)
  return m;
}
/* v0.4.3: monsters found before their object had a proper design keep the look and text they were found with. The
   player can choose to update one: only its body design, its signature move's NAME (same numbers) and its flavour text
   change; colours, eyes, features, stats and level stay. Deterministic, and the old values are kept for undo. */
function identityUpdate(m) {
  const o = m && OBJECTS[m.obj]; if (!o || !m.dna || m.dna.v < 3) return null;
  const want = designOf(o, { aspect: m.aspect, sub: m.sub }), ch = {};
  if (want.shape !== m.dna.shape || (want.sub || null) !== (m.dna.sub || null)) ch.design = want;
  const ab = signatureOf(m);
  if (o.sigName && ab && ab.name === CATEGORY[o.cat].sig.name) ch.sig = o.sigName; // display name only; its key and numbers stay
  if (o.rule) { const fresh = monsterLore({ ...m, abilities: ch.sig ? [{ ...ab, name: ch.sig }] : m.abilities }); if (fresh !== m.lore) ch.lore = fresh; }
  return ch.design ? ch : null; // offered only where the body changes; the rest rides along
}
function applyIdentityUpdate(S, m) {
  const ch = identityUpdate(m); if (!ch) return false;
  m.prevIdentity = { shape: m.dna.shape, sub: m.dna.sub || null, lore: m.lore || null, sig: signatureOf(m).name };
  m.dna.shape = ch.design.shape; m.dna.sub = ch.design.sub;
  if (ch.sig) signatureOf(m).name = ch.sig;
  if (ch.lore) m.lore = ch.lore;
  const d = S.dex[m.species]; if (d && d.dna && d.dna.v >= 3 && d.dna.shape !== ch.design.shape) { d.dna = { ...d.dna, shape: ch.design.shape, sub: ch.design.sub }; }
  return true;
}
function undoIdentityUpdate(m) {
  const p = m && m.prevIdentity; if (!p) return false;
  m.dna.shape = p.shape; m.dna.sub = p.sub; if (p.lore) m.lore = p.lore; signatureOf(m).name = p.sig; delete m.prevIdentity; return true;
}
function variantLabel(v) { return v === 'spectral' ? 'Spectral' : v === 'mutated' ? 'Mutated' : v === 'shiny' ? 'Prismatic' : ''; }

/* Register a sighting in the encyclopedia. Returns {isNew, rp} */
function recordSighting(S, m) {
  S.stats.encounters++;
  const fam = familyOf(m); S.stats.famSeen[fam] = (S.stats.famSeen[fam] || 0) + 1;
  if (m.rarity === 'epic') S.stats.epicSeen++;
  if (m.rarity === 'legendary') S.stats.legendSeen++;
  if (m.variant === 'shiny') S.stats.shinySeen++;
  let d = S.dex[m.species], isNew = false, rp = 0;
  if (!d) {
    isNew = true; rp = 2 + (RARITY[m.rarity].tier >= 2 ? 1 : 0) + (RARITY[m.rarity].tier >= 4 ? 2 : 0);
    const o = m.obj && OBJECTS[m.obj];
    d = S.dex[m.species] = { key: m.species, obj: m.obj || null, name: o ? o.name : m.name, monsterName: m.name, cat: m.cat, fam: m.fam, first: Date.now(), seen: 0, caught: 0, rarities: {}, dna: m.dna, word: m.word, variants: {} };
    S.rp += rp;
  }
  d.seen++;
  d.rarities = d.rarities || {};
  if (!d.rarities[m.rarity]) { d.rarities[m.rarity] = true; if (RARITY[m.rarity].tier > Math.max(-1, ...Object.keys(d.rarities).filter(r => r !== m.rarity).map(r => RARITY[r].tier))) d.dna = m.dna; }
  if (m.variant) d.variants[m.variant] = true;
  return { isNew, rp };
}

/* ---------- combat ---------- */
const NEG = ['poison', 'burn', 'stun', 'defdown'];
function newBattle(S, m) {
  assignAbilityKeys(m); // monsters from any source (very old saves) fight by key
  const hs = hunterStats(S);
  const B = {
    m, turn: 1, over: false, result: null, usedPotion: false, enhancer: 0, captureFails: 0, weapon: S.equipped,
    enemy: { name: m.name, hp: m.stats.hp, maxHp: m.stats.hp, atk: m.stats.atk, def: m.stats.def, spd: m.stats.spd, fam: FAMILIES[m.fam] ? m.fam : familyOf(m), status: {}, cds: {} },
    hero: { name: hunterName(S), hp: Math.max(1, Math.min(S.hp, hs.maxHp)), maxHp: hs.maxHp, atk: hs.atk, def: hs.def, spd: hs.spd, crit: hs.crit,
            energy: MECH.energy.start + (charmOn(S, 'battery') ? MECH.energy.battery : 0), status: {} },
  };
  B.enemyFirst = m.stats.spd > hs.spd * MECH.firstStrike;
  if (godModeOn(S)) { B.god = true; B.godHp = B.hero.hp; } // developer God Mode (HP protection only), fixed for this battle
  return B;
}
/* ---------- developer God Mode (HP protection only) ----------
   Decided once per battle in newBattle from godModeOn(S) (developer build + unlocked tools + the switch). In such a
   battle the hunter's HP never goes DOWN: enemy hits and poison/burn are rolled exactly as usual (same random numbers,
   statuses, drain, events) but take no HP; the events carry dmg 0, god: true and the blocked amount. Nothing else
   changes: specials cost energy, items and Snap Traps are used up, capture chances, the owned-slot rule, rewards and
   the enemy are all normal. godOn re-checks DEV_TOOLS, so a release build ignores even a forced flag. */
const godOn = B => !!(DEV_TOOLS === true && B && B.god === true);

function effMult(fam, el) { const f = FAMILIES[fam]; return f.weak.includes(el) ? MECH.weak : f.resist.includes(el) ? MECH.resist : 1; }
function addStatus(tgt, s, turns, ev, who) {
  if (NEG.includes(s) && tgt.status.immune) { ev.push({ t: 'text', msg: `${tgt.name} resisted ${s}!` }); return; }
  tgt.status[s] = { t: Math.max(turns, (tgt.status[s] || {}).t || 0) };
  ev.push({ t: 'status', who, s });
}
const STATUS_TURNS = { poison: 3, burn: 3, stun: 1, defdown: 3, atkup: 4, defup: 4, immune: 3 };
function effDef(u) { const X = MECH.status; return u.def * (u.status.defdown ? X.defdown : 1) * (u.status.defup ? X.defup : 1); }
function effAtk(u) { const X = MECH.status; return u.atk * (u.status.atkup ? X.atkup : 1) * (u.status.burn ? X.burnAtk : 1); }
function dmgCalc(atk, power, def, rng) { return atk * power * randRange(rng, 0.9, 1.1) * 25 / (25 + def); }

function tickStatuses(B, who, ev) { // start of `who`'s turn. returns true if the unit loses its turn
  const u = B[who];
  let skip = false;
  const X = MECH.status;
  const shield = who === 'hero' && godOn(B); // God Mode: the damage is worked out as usual but not taken
  const dot = (d, s) => { if (shield) ev.push({ t: 'dot', who, dmg: 0, s, god: true, blocked: d }); else { u.hp = Math.max(0, u.hp - d); ev.push({ t: 'dot', who, dmg: d, s }); } };
  if (u.status.poison) dot(Math.max(X.poisonMin, Math.round(u.maxHp * X.poisonPct)), 'poison');
  if (u.status.burn) dot(Math.max(X.burnMin, Math.round(u.maxHp * X.burnPct + X.burnFlat)), 'burn');
  if (u.status.stun) { skip = true; ev.push({ t: 'text', msg: `${u.name === 'Hunter' ? 'You are' : u.name + ' is'} stunned and can't move!`, who, stun: true }); }
  for (const k of Object.keys(u.status)) { u.status[k].t--; if (u.status[k].t <= 0) { delete u.status[k]; ev.push({ t: 'expire', who, s: k }); } }
  if (who === 'enemy') for (const k of Object.keys(B.enemy.cds)) if (B.enemy.cds[k] > 0) B.enemy.cds[k]--;
  checkEnd(B, ev);
  return skip;
}
function checkEnd(B, ev) {
  if (B.over) return;
  if (B.enemy.hp <= 0) { B.over = true; B.result = 'victory'; ev.push({ t: 'end', result: 'victory' }); }
  else if (B.hero.hp <= 0) { B.over = true; B.result = 'defeat'; ev.push({ t: 'end', result: 'defeat' }); }
}
function heroStrike(B, S, special, rng = RNG) {
  const ev = [], W = WEAPONS[B.weapon], e = B.enemy, h = B.hero;
  const sp = special ? W.special : null;
  const hits = sp ? (sp.hits || 1) : (W.hits || 1);
  const pow = sp ? sp.power : (W.hitPow || 1);
  const eff = effMult(e.fam, W.el);
  ev.push({ t: 'act', who: 'hero', name: sp ? sp.name : 'Attack', fx: W.fx, special: !!sp });
  let total = 0;
  for (let i = 0; i < hits && !B.over; i++) {
    const acc = (sp && sp.sure) || W.acc >= 1 ? 1 : W.acc - Math.max(0, e.spd - h.spd) * MECH.enemy.missPerSpd + (e.status.stun ? MECH.status.stunAcc : 0);
    if (rng() > acc) { ev.push({ t: 'miss', who: 'enemy' }); continue; }
    const def = effDef(e) * (1 - (W.pierce || 0));
    const raw = dmgCalc(effAtk(h), pow, def, rng); // attack, power, defence, status effects and the 0.9–1.1 roll
    let dmg = raw * eff;
    const crit = rng() < h.crit;
    if (crit) dmg *= W.critX;
    dmg = Math.max(1, Math.round(dmg));
    const hp0 = e.hp;
    e.hp = Math.max(0, e.hp - dmg); total += dmg;
    // breakdown for the combat log (no extra random numbers; the damage itself is computed exactly as before):
    // neutral = this very hit at ×1 effectiveness (same roll, same crit), noCrit = this hit without the critical,
    // both rounded with the game's own rule; lost = the HP actually taken (less than dmg on an overkill)
    const hit = { t: 'hit', who: 'enemy', dmg, crit, eff, fx: W.fx, lost: hp0 - e.hp };
    if (eff !== 1) hit.neutral = Math.max(1, Math.round(raw * (crit ? W.critX : 1)));
    if (crit) hit.noCrit = Math.max(1, Math.round(raw * eff));
    ev.push(hit);
    if (!sp && W.poison && rng() < W.poison && !e.status.poison) addStatus(e, 'poison', STATUS_TURNS.poison, ev, 'enemy');
    if (!sp && W.stun && rng() < W.stun && e.hp > 0) addStatus(e, 'stun', 1, ev, 'enemy');
    if (sp && sp.effect && rng() < (sp.chance || 1) && e.hp > 0) addStatus(e, sp.effect, STATUS_TURNS[sp.effect], ev, 'enemy');
  }
  if (charmOn(S, 'fang') && total > 0) { const heal = Math.max(1, Math.round(total * MECH.fang)); h.hp = Math.min(h.maxHp, h.hp + heal); ev.push({ t: 'heal', who: 'hero', amt: heal }); }
  if (eff > 1 && total) ev.push({ t: 'text', msg: "It's super effective!" });
  else if (eff < 1 && total) ev.push({ t: 'text', msg: 'It resists your weapon...' });
  h.energy = clamp(h.energy + (sp ? -sp.cost : MECH.energy.perAttack), 0, MECH.energy.max);
  checkEnd(B, ev);
  return ev;
}
function enemyTurn(B, rng = RNG) {
  const ev = [], e = B.enemy, h = B.hero;
  if (B.over) return ev;
  if (tickStatuses(B, 'enemy', ev) || B.over) return ev;
  const ready = B.m.abilities.filter(a => !(e.cds[cooldownKey(a)] > 0));
  let ab = null;
  const healer = ready.find(a => a.effect === 'heal');
  if (healer && e.hp < e.maxHp * MECH.enemy.healBelow) ab = healer;
  else if (ready.length && rng() < MECH.enemy.abilityRate) {
    const pick = ready.filter(a => !(a.self && a.effect !== 'heal' && e.status[a.effect])).filter(a => a.effect !== 'heal' || e.hp < e.maxHp * 0.7);
    if (pick.length) ab = pick[Math.floor(rng() * pick.length)];
  }
  if (!ab) ab = { name: 'Attack', power: 1, basic: true };
  else e.cds[cooldownKey(ab)] = ab.cd;
  ev.push({ t: 'act', who: 'enemy', name: ab.name, ability: !ab.basic, ultimate: !!ab.ultimate });
  if (ab.self) {
    if (ab.effect === 'heal') { const amt = Math.round(e.maxHp * MECH.enemy.healAmt); e.hp = Math.min(e.maxHp, e.hp + amt); ev.push({ t: 'heal', who: 'enemy', amt }); }
    else addStatus(e, ab.effect, STATUS_TURNS[ab.effect], ev, 'enemy');
    return ev;
  }
  const hits = ab.hits || 1;
  for (let i = 0; i < hits && !B.over; i++) {
    const dodge = clamp(MECH.enemy.dodgeBase + (h.spd - e.spd) * MECH.enemy.dodgePerSpd, 0, MECH.enemy.dodgeMax);
    if (rng() < dodge) { ev.push({ t: 'miss', who: 'hero' }); continue; }
    const raw = dmgCalc(effAtk(e), ab.power, effDef(h), rng);
    let dmg = raw;
    const crit = rng() < MECH.enemy.crit; if (crit) dmg *= MECH.enemy.critX;
    dmg = Math.max(1, Math.round(dmg));
    const noCrit = crit ? { noCrit: Math.max(1, Math.round(raw)) } : {}; // the same hit without the critical (log only)
    if (godOn(B)) ev.push({ t: 'hit', who: 'hero', dmg: 0, crit, god: true, blocked: dmg, lost: 0, ...noCrit }); // God Mode: no HP lost
    else { const hp0 = h.hp; h.hp = Math.max(0, h.hp - dmg); ev.push({ t: 'hit', who: 'hero', dmg, crit, lost: hp0 - h.hp, ...noCrit }); }
    if (ab.effect === 'drain') { const amt = Math.round(dmg * 0.5); e.hp = Math.min(e.maxHp, e.hp + amt); ev.push({ t: 'heal', who: 'enemy', amt }); }
    else if (ab.effect && rng() < (ab.chance || 1) && h.hp > 0) addStatus(h, ab.effect, STATUS_TURNS[ab.effect], ev, 'hero');
  }
  checkEnd(B, ev);
  return ev;
}
function heroTurnStart(B) {
  const ev = []; const skip = tickStatuses(B, 'hero', ev);
  return { ev, skip };
}

function captureChance(S, B) {
  const m = B.m, e = B.enemy, r = RARITY[m.rarity];
  const C = MECH.capture;
  let c = r.capture * (1 - C.hpWeight * (e.hp / e.maxHp));
  if (e.status.stun) c += C.stun;
  if (e.status.poison || e.status.burn) c += C.dot;
  c += B.enhancer + (has(S, 'capture1') ? C.research : 0) + (has(S, 'capture2') ? C.research : 0) + (charmOn(S, 'lenscap') ? C.lenscap : 0);
  if (m.variant) c *= C.variantMult;
  return clamp(c, C.min, C.max);
}
/* Unique collection slots (2026-11-25): the real collection holds at most ONE monster per canonical object id + rarity
   + variant. Level, stats, DNA, colours, photo and names do not matter. Normal is stored as null/absent and Prismatic
   as 'shiny' (save format unchanged). Only monsters CURRENTLY in S.monsters count: encyclopedia sightings, past
   captures and released monsters never block. Developer-spawned encounters are ordinary monsters and follow the rule
   exactly (the m.test checks below only concern monsters of the retired Quick Monster Test Mode, which can no longer
   be created). Duplicates still spawn and can be fought for the normal rewards; only capturing one is
   refused, in attemptCapture (the UI just explains it), before anything is consumed, rolled or changed. */
const variantSlot = v => (v == null || v === '' || v === 'normal') ? 'normal' : String(v); // 'spectral' | 'mutated' | 'shiny'
function collectionObjId(m) {
  if (!m) return null;
  const o = m.obj;
  if (o && OBJECTS[o]) return o;
  if (o && CATEGORY[o] && CAT_DEFAULT_OBJECT[o]) return CAT_DEFAULT_OBJECT[o]; // a bare category id stored as object
  if (o) return String(o);
  return m.cat ? 'cat:' + m.cat + (m.word ? ':' + m.word : '') : null; // very old monsters without an object id
}
function collectionKey(m) {
  const obj = collectionObjId(m);
  return obj && m.rarity ? obj + '|' + m.rarity + '|' + variantSlot(m.variant) : null;
}
// the monster in the real collection that already fills m's slot, or null
function ownedCopy(S, m) {
  if (!m || m.test || !S || !Array.isArray(S.monsters)) return null;
  const k = collectionKey(m); if (!k) return null;
  return S.monsters.find(x => x && x !== m && !x.test && collectionKey(x) === k) || null;
}
function alreadyOwnedText(m) {
  const v = variantLabel(m.variant) || 'Normal', r = RARITY[m.rarity] ? RARITY[m.rarity].name : m.rarity;
  return `You already have a ${v} ${r} ${String(m.name || 'monster').split(',')[0]} in your collection. Defeat it for rewards, or flee.`;
}
function attemptCapture(B, S, rng = RNG) {
  const ev = [];
  if (B && ownedCopy(S, B.m)) return { ev, used: false, owned: true, msg: alreadyOwnedText(B.m) }; // nothing consumed, rolled or changed
  if ((S.items.trap || 0) <= 0) { ev.push({ t: 'text', msg: 'You are out of Snap Traps!' }); return { ev, used: false }; }
  const ch = captureChance(S, B);
  S.items.trap--;
  ev.push({ t: 'act', who: 'hero', name: 'Snap Trap', fx: 'trap' });
  if (rng() < ch) { B.over = true; B.result = 'captured'; ev.push({ t: 'capture', ok: true }); ev.push({ t: 'end', result: 'captured' }); return { ev, used: true }; }
  B.captureFails++;
  ev.push({ t: 'capture', ok: false });
  if (has(S, 'capture2') && rng() < MECH.capture.quantumRefund) { S.items.trap++; ev.push({ t: 'text', msg: 'Quantum recovery: the trap rematerialised in your bag.' }); }
  if (B.captureFails >= MECH.capture.escapeAfter && RARITY[B.m.rarity].tier >= 3 && rng() < MECH.capture.escapeChance) { B.over = true; B.result = 'escaped'; ev.push({ t: 'text', msg: `${B.enemy.name} tore free and vanished!` }); ev.push({ t: 'end', result: 'escaped' }); }
  return { ev, used: true };
}
function fleeChance(S, B) {
  const F = MECH.flee;
  let c = F.base + (B.hero.spd - B.enemy.spd) * F.perSpd + (charmOn(S, 'slipper') ? F.slipper : 0) - (B.m.rarity === 'legendary' ? F.legendary : 0);
  return clamp(c, F.min, F.max);
}
function attemptFlee(B, S, rng = RNG) {
  const ev = [{ t: 'act', who: 'hero', name: 'Flee' }];
  if (rng() < fleeChance(S, B)) { B.over = true; B.result = 'fled'; ev.push({ t: 'end', result: 'fled' }); }
  else ev.push({ t: 'text', msg: "Couldn't get away!" });
  return ev;
}
function useItem(B, S, id) {
  const ev = [], h = B ? B.hero : null;
  if ((S.items[id] || 0) <= 0) return { ev, ok: false };
  const medic = has(S, 'medic') ? 1.3 : 1;
  const maxHp = h ? h.maxHp : hunterStats(S).maxHp;
  const curHp = h ? h.hp : S.hp;
  const setHp = v => { if (h) h.hp = v; else S.hp = v; };
  switch (id) {
    case 'potion': case 'greater': {
      if (curHp >= maxHp) return { ev: [{ t: 'text', msg: 'Already at full health.' }], ok: false };
      const amt = Math.round((id === 'potion' ? 40 : maxHp * 0.7) * medic);
      const real = Math.min(maxHp - curHp, amt); setHp(curHp + real);
      if (B) B.usedPotion = true;
      ev.push({ t: 'heal', who: 'hero', amt: real }); break;
    }
    case 'strength': if (!B) return { ev, ok: false }; addStatus(h, 'atkup', STATUS_TURNS.atkup, ev, 'hero'); B.usedPotion = true; break;
    case 'defense': if (!B) return { ev, ok: false }; addStatus(h, 'defup', STATUS_TURNS.defup, ev, 'hero'); B.usedPotion = true; break;
    case 'antidote': {
      if (h) { for (const s of ['poison', 'burn', 'defdown']) delete h.status[s]; h.status.immune = { t: STATUS_TURNS.immune }; ev.push({ t: 'status', who: 'hero', s: 'immune' }); B.usedPotion = true; }
      const real = Math.min(maxHp - (h ? h.hp : S.hp), 10); setHp((h ? h.hp : S.hp) + real); if (real) ev.push({ t: 'heal', who: 'hero', amt: real });
      break;
    }
    case 'enhancer': if (!B) return { ev, ok: false }; B.enhancer += MECH.capture.enhancer; ev.push({ t: 'text', msg: 'Capture field amplified! +25% capture chance.' }); break;
    case 'smoke': if (!B) return { ev, ok: false }; B.over = true; B.result = 'fled'; ev.push({ t: 'text', msg: 'Poof! You vanish in a cloud of smoke.' }); ev.push({ t: 'end', result: 'fled' }); break;
    default: return { ev, ok: false };
  }
  S.items[id]--;
  if (B) ev.unshift({ t: 'act', who: 'hero', name: ITEMS[id].name, fx: 'item' });
  return { ev, ok: true };
}

/* Apply battle outcome to the save. Returns summary for the results screen. */
// a variant's extra drop for defeating or capturing it (Spectral +2 Ectoplasm, Mutated +3 Goo, Prismatic +1 Prism Shard)
const variantBonus = m => ({ ...((VARIANTS[m && m.variant] || {}).bonus || {}) });
function finishBattle(S, B, rng = RNG) {
  const m = B.m, r = RARITY[m.rarity], tier = r.tier, sum = { result: B.result, rewards: [], levelUps: [], drops: [], newCapture: false };
  S.stats.battles++;
  S.hp = Math.max(1, B.hero.hp);
  const shinyX = (VARIANTS[m.variant] && VARIANTS[m.variant].coinsX) || 1;
  const famMat = FAMILIES[familyOf(m)].mat;
  if (B.result === 'captured' && ownedCopy(S, m)) { B.result = 'escaped'; sum.result = 'escaped'; } // never a second copy of a slot (only reachable by bypassing attemptCapture, which refuses)
  if (B.result === 'victory' || B.result === 'captured') {
    const caught = B.result === 'captured';
    const xp = Math.round((12 + 6 * m.level) * r.xp * (caught ? 0.85 : 1));
    const reward = { xp, coins: Math.round((8 + 3 * m.level) * r.xp * randRange(rng, 0.8, 1.2) * (caught ? 0.5 : 1) * shinyX) };
    reward[famMat] = Math.round((randInt(rng, 2, 4) + tier) * (caught ? 0.5 : 1)) || 1;
    const other = ['scrap', 'goo', 'ecto'][randInt(rng, 0, 2)];
    reward[other] = (reward[other] || 0) + 1;
    if (tier >= 2) reward.prism = tier - 1;
    const vb = variantBonus(m); // the variant's own extra drop, on top of the family material (listed separately)
    for (const [k, v] of Object.entries(vb)) reward[k] = (reward[k] || 0) + v;
    if (!caught && rng() < 0.25) reward[rng() < 0.6 ? 'potion' : 'trap'] = 1;
    const out = grant(S, reward);
    sum.rewards = out.filter(o => o.k);
    sum.variantBonus = variantBonus(m);
    sum.levelUps = out.filter(o => o.levelUp).map(o => o.levelUp);
    if (!caught) {
      S.stats.wins++;
      if (!B.usedPotion) S.stats.cleanWins++;
      const lockedW = WEAPON_ORDER.filter(w => S.weapons[w] == null);
      const lockedC = CHARM_ORDER.filter(c => !S.charms[c]);
      if (lockedW.length && rng() < 0.04 + tier * 0.05) { const w = lockedW[0]; S.weapons[w] = 0; sum.drops.push({ kind: 'weapon', id: w }); }
      else if (lockedC.length && rng() < 0.08 + tier * 0.04) { const c = lockedC[randInt(rng, 0, lockedC.length - 1)]; S.charms[c] = true; sum.drops.push({ kind: 'charm', id: c }); }
    }
    if (tier >= 2) S.stats.rareBeaten++;
    if (caught) {
      S.stats.captures++;
      S.stats.capByFam[familyOf(m)] = (S.stats.capByFam[familyOf(m)] || 0) + 1;
      const d = S.dex[m.species];
      if (d && !d.caught) { S.rp += 3; sum.rewards.push({ k: 'rp', v: 3, why: 'first capture of this species' }); sum.newCapture = true; }
      if (d) d.caught++;
      m.id = 'm' + (S.nextId++);
      m.caughtAt = Date.now();
      S.monsters.push(m);
    }
    S.hp = Math.min(hunterStats(S).maxHp, S.hp + Math.round(hunterStats(S).maxHp * MECH.afterWin));
  } else if (B.result === 'defeat') {
    S.stats.losses++;
    const lost = Math.floor(S.coins * MECH.defeatCoins); S.coins -= lost;
    sum.lostCoins = lost;
    S.hp = Math.round(hunterStats(S).maxHp * MECH.defeatHp);
  } else if (B.result === 'fled' || B.result === 'escaped') {
    S.stats.flees++;
  }
  if (godOn(B) && Number.isFinite(B.godHp) && S.hp < B.godHp) S.hp = B.godHp; // God Mode: never save less HP than at the start
  S.lastTick = Date.now();
  sum.achievements = checkAchievements(S);
  return sum;
}

/* ---------- gear ---------- */
function unlockWeapon(S, id) {
  const w = WEAPONS[id]; if (!w || S.weapons[id] != null || !w.unlock || !canAfford(S, w.unlock)) return false;
  pay(S, w.unlock); S.weapons[id] = 0; return true;
}
function upgradeCost(S, id) {
  const lvl = S.weapons[id] || 0, disc = has(S, 'smith') ? 0.8 : 1, n = lvl + 1;
  const main = { sword: 'scrap', pistol: 'scrap', dagger: 'goo', wand: 'ecto', hammer: 'scrap' }[id];
  const cost = { coins: Math.round(30 * n * disc), [main]: Math.round(5 * n * disc) };
  if (n >= 3) cost.prism = Math.round((n - 2) * disc) || 1;
  return cost;
}
function upgradeWeapon(S, id) {
  if (S.weapons[id] == null || S.weapons[id] >= maxWeaponLevel(S)) return false;
  const c = upgradeCost(S, id); if (!canAfford(S, c)) return false;
  pay(S, c); S.weapons[id]++; S.stats.upgrades++; return true;
}
function buyItem(S, id, n = 1) { const p = ITEMS[id].price * n; if (S.coins < p) return false; S.coins -= p; S.items[id] = (S.items[id] || 0) + n; return true; }
function craftItem(S, id) { const c = ITEMS[id].craft; if (!canAfford(S, c)) return false; pay(S, c); S.items[id] = (S.items[id] || 0) + 1; return true; }
function buyResearch(S, id) {
  const r = RESEARCH_BY_ID[id];
  if (!r || S.research[id] || S.rp < r.cost || (r.req && !S.research[r.req])) return false;
  S.rp -= r.cost; S.research[id] = Date.now();
  if (id === 'vital') S.hp += 20;
  return true;
}
function toggleCharm(S, id) {
  if (!S.charms[id]) return false;
  const i = S.charmSlots.indexOf(id);
  if (i >= 0) { S.charmSlots[i] = null; return true; }
  const slots = charmSlotCount(S);
  let free = S.charmSlots.slice(0, slots).indexOf(null);
  if (free < 0) free = 0;
  S.charmSlots[free] = id;
  for (let k = slots; k < S.charmSlots.length; k++) S.charmSlots[k] = null;
  S.hp = Math.min(S.hp, hunterStats(S).maxHp);
  return true;
}
function releaseMonster(S, id) {
  const i = S.monsters.findIndex(m => m.id === id); if (i < 0) return null;
  const m = S.monsters[i]; S.monsters.splice(i, 1);
  if (S.companion === id) S.companion = null;
  const reward = { [FAMILIES[familyOf(m)].mat]: 2 + RARITY[m.rarity].tier * 2, coins: 10 + 10 * RARITY[m.rarity].tier };
  grant(S, reward); S.hp = Math.min(S.hp, hunterStats(S).maxHp);
  return reward;
}

/* ---------- object identification from text ---------- */
function matchCategory(text) {
  const t = ' ' + (text || '').toLowerCase().replace(/[^a-z ]/g, ' ') + ' ';
  if (!t.trim()) return null;
  let best = null, bestLen = 0;
  for (const c of CATEGORIES) for (const k of c.kw) {
    const kk = k.trim();
    if ((t.includes(' ' + kk + ' ') || t.includes(' ' + kk + 's ') || t.includes(' ' + kk + 'es ')) && kk.length > bestLen) { best = c.id; bestLen = kk.length; }
  }
  return best;
}

if (typeof module !== 'undefined') module.exports = { freshState, migrate, resolvePhoto, recordSighting, createMonster, newBattle, heroStrike, enemyTurn, heroTurnStart, attemptCapture, captureChance, attemptFlee, useItem, finishBattle, hunterStats, encounterChance, matchCategory, exportSave, importSave, unlockWeapon, upgradeWeapon, buyResearch, claimQuest, activeQuests, setRNG: f => { RNG = f; }, setClock: f => { CLOCK = f; }, quietUntil, quietClean, QUIET_MS, disturbedUntil, objectLock, lockClean, ENCOUNTER_LOCK_MS, cleanHunterName, hunterName, HUNTER_NAME_MAX, xpFor, hamming, collectionKey, ownedCopy, releaseMonster, DEV_TOOLS, devToolsOn, godModeOn, godOn, devSpawnEncounter, devGrantItem, devGrantable, DEV_VARIANTS, DEV_GRANT_MAX, DEV_GRANT_TOTAL };
