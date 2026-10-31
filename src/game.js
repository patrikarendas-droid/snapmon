/* SNAPMON — game state, saves, encounters, monster generation, combat rules, rewards. No DOM access here. */
'use strict';

const SAVE_KEY = 'snapmon.save.v1';      // storage key name kept from v0.1 so existing saves are found
const SAVE_VERSION = 3;                  // bump + add a migration step whenever the save format changes
const GAME_VERSION = '0.4.6';
const STORE = {
  get: k => { try { return typeof Platform !== 'undefined' ? Platform.storage.get(k) : localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { if (typeof Platform !== 'undefined') return Platform.storage.set(k, v); localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const randRange = (rng, a, b) => a + rng() * (b - a);
const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
let RNG = Math.random; // swappable for tests

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
    enc: { miss: 0, sinceRare: 0, recentHashes: [], recentCats: [], recentObjs: [] },
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
  try { return withLore(migrate(parsed)); } catch (e) { saveBlocked = { reason: 'corrupt', raw }; return freshState(); }
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
  return migrate(obj);
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
    const lines = ch.dup ? DUPLICATE_LINES : NO_ENCOUNTER_LINES;
    const objName = (word || CATEGORY[cat].name.split(' /')[0]).toLowerCase();
    return { encounter: false, dup: ch.dup, line: lines[Math.floor(rng() * lines.length)].replace('{obj}', objName), chance: ch };
  }
  S.enc.miss = 0;
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

/* ---------- developer Quick Monster Test Mode (v0.4.4) ----------
   For checking monster designs, names, colours and flavour text quickly. Only reachable from the hidden developer
   tools, and only while DEV_TOOLS is true (set it to false for a public/release build: the developer menu and this
   mode then disappear). A test monster is made by the normal generator from the REAL recognised object and photo, with
   test-only rarity odds, and never touches the player's save: no encounter roll, pity, photo count, encyclopedia entry,
   reward or item use. Test monsters live in their own storage key (TestRoster), are marked test:true, are not part of
   the save or the backup code, and can be cleared at any time. */
const DEV_TOOLS = true;
const TEST_RARITY_WEIGHTS = { common: 20, uncommon: 20, rare: 25, epic: 20, legendary: 15 }; // real weights: RARITIES (46/28/20/5/1)
function createTestMonster(S, objId, photo, obj = {}, rng = RNG) {
  const cat = OBJECTS[objId] ? OBJECTS[objId].cat : 'other';
  const m = createMonster(S, { obj: objId, cat, rarity: pickWeighted(TEST_RARITY_WEIGHTS, rng), word: obj.label, photo, rng, aspect: obj.aspect, conf: obj.conf });
  m.test = true; m.id = 'test-' + Date.now().toString(36) + '-' + Math.floor(rng() * 1e6).toString(36); m.caughtAt = Date.now();
  return m;
}
const TestRoster = {
  KEY: 'snapmon.testroster.v1', MAX: 300,
  list() { try { return JSON.parse(STORE.get(this.KEY) || '[]'); } catch (e) { return []; } },
  add(m) { const l = this.list(); l.push({ ...m, test: true }); return STORE.set(this.KEY, JSON.stringify(l.slice(-this.MAX))); },
  remove(id) { STORE.set(this.KEY, JSON.stringify(this.list().filter(m => m.id !== id))); },
  clear() { STORE.set(this.KEY, '[]'); },
};

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
    const base = i === 0 ? 'signature' : a.ultimate ? 'ultimate' : a.legend ? 'legend' : kit.has(a.name) ? 'kit.' + abilitySlug(a.name) : fam.has(a.name) ? 'fam.' + abilitySlug(a.name) : 'move.' + abilitySlug(a.name);
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
function monsterFamily(cat, word, variant, o) {
  if (variant === 'spectral') return 'spectral';
  if (variant === 'mutated') return 'mutated';
  if (o && o.fam) return o.fam; // v0.4.5: the object's own nature (a spoon is Household, not Mechanical like its "tool" category)
  return CATEGORY[cat].fam || NATIVE_FAMILIES[hashStr(word || 'x') % 6];
}
function cdFor(ab) { return ab.self ? 3 : (ab.power >= 1.3 || ab.hits) ? 3 : ab.effect ? 2 : 2; }
// the object's display name for move names and titles ("Energy Drink", "Padlock")
const objNoun = o => o.name.split(' / ')[0].split(' ').map(titleCase).join(' ');
function moveKit(cat, o) {
  const g = o && o.lore, src = (g && (MOVE_KITS[g] || MOVE_KITS[MOVE_KIT_ALIAS[g]])) || MOVE_KITS[cat] || MOVE_KITS.other;
  return src.split(',').map(s => { const [name, arch] = s.split(':').map(t => t.trim()); return { name, ...MOVE_ARCH[arch] }; });
}
function monsterAbilities(cat, rarity, fam, word, o) {
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
  if (variant === 'shiny') for (const k in st) st[k] = Math.round(st[k] * 1.08);
  if (variant === 'mutated') st.atk = Math.round(st.atk * 1.1);
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
function createMonster(S, { obj = null, cat, rarity, variant, word, photo, first, rng = RNG, sub = null, aspect = null, conf = null }) {
  if (!obj) obj = CAT_DEFAULT_OBJECT[cat] || null;
  if (obj && OBJECTS[obj]) cat = OBJECTS[obj].cat;
  const o = obj && OBJECTS[obj];
  const fam = monsterFamily(cat, word, variant, o);
  const r = RARITY[rarity];
  const lo = S.level < 3 ? 0 : r.lvl[0], hi = S.level < 3 ? Math.min(1, r.lvl[1]) : r.lvl[1];
  let level = first ? 1 : Math.max(1, S.level + randInt(rng, lo, hi) - (rarity === 'common' && rng() < 0.35 ? 1 : 0));
  const seed = Math.floor(rng() * 4294967295) >>> 0;
  const ph = photo ? { hue: photo.hue, sat: photo.sat, lit: photo.lit, ...(photo.pal ? { pal: photo.pal } : {}), ...(photo.engine ? { engine: photo.engine } : {}) } : null; // engine: which recogniser identified it
  const base = { obj, cat, rarity, variant, word: cat === 'other' ? (word || '').toLowerCase().slice(0, 24) : null, seed, photo: ph, sub: sub || null, aspect: aspect ? +(+aspect).toFixed(2) : null };
  const abilities = monsterAbilities(cat, rarity, fam, base.word, o);
  if (o && o.sig) abilities[0] = { ...o.sig, cd: cdFor(o.sig) }; // object-specific signature move
  else if (o && o.sigName) abilities[0] = { ...abilities[0], name: o.sigName }; // same numbers, a name that fits the object
  const m = {
    ...base, id: null, fam, level,
    name: o ? speciesName3(obj, rarity, fam) : speciesName(cat, rarity, base.word, fam),
    stats: monsterStats(rarity, fam, level, seed, variant),
    abilities,
    dna: makeDNA(base), species: o ? 'o:' + obj : speciesKey(cat, rarity), seenAt: Date.now(),
    label: word ? String(word).slice(0, 40) : null, conf: conf != null ? +(+conf).toFixed(2) : null,
  };
  if (first) { m.stats.hp = Math.round(m.stats.hp * 0.8); m.stats.atk = Math.max(3, Math.round(m.stats.atk * 0.8)); }
  assignAbilityKeys(m);
  // curated move names (src/curated.js, reviewed content only): display names by stable key; numbers, cooldowns and
  // keys are untouched, and no random numbers are used. Only new monsters get them; saved monsters keep their names.
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
  S.stats.famSeen[m.fam] = (S.stats.famSeen[m.fam] || 0) + 1;
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
  assignAbilityKeys(m); // monsters from any source (test collection, very old saves) fight by key
  const hs = hunterStats(S);
  const B = {
    m, turn: 1, over: false, result: null, usedPotion: false, enhancer: 0, captureFails: 0, weapon: S.equipped,
    enemy: { name: m.nick || m.name, hp: m.stats.hp, maxHp: m.stats.hp, atk: m.stats.atk, def: m.stats.def, spd: m.stats.spd, fam: m.fam, status: {}, cds: {} },
    hero: { name: 'Hunter', hp: Math.max(1, Math.min(S.hp, hs.maxHp)), maxHp: hs.maxHp, atk: hs.atk, def: hs.def, spd: hs.spd, crit: hs.crit,
            energy: MECH.energy.start + (charmOn(S, 'battery') ? MECH.energy.battery : 0), status: {} },
  };
  B.enemyFirst = m.stats.spd > hs.spd * MECH.firstStrike;
  return B;
}
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
  if (u.status.poison) { const d = Math.max(X.poisonMin, Math.round(u.maxHp * X.poisonPct)); u.hp = Math.max(0, u.hp - d); ev.push({ t: 'dot', who, dmg: d, s: 'poison' }); }
  if (u.status.burn) { const d = Math.max(X.burnMin, Math.round(u.maxHp * X.burnPct + X.burnFlat)); u.hp = Math.max(0, u.hp - d); ev.push({ t: 'dot', who, dmg: d, s: 'burn' }); }
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
    let dmg = dmgCalc(effAtk(h), pow, def, rng) * eff;
    const crit = rng() < h.crit;
    if (crit) dmg *= W.critX;
    dmg = Math.max(1, Math.round(dmg));
    e.hp = Math.max(0, e.hp - dmg); total += dmg;
    ev.push({ t: 'hit', who: 'enemy', dmg, crit, eff, fx: W.fx });
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
    let dmg = dmgCalc(effAtk(e), ab.power, effDef(h), rng);
    const crit = rng() < MECH.enemy.crit; if (crit) dmg *= MECH.enemy.critX;
    dmg = Math.max(1, Math.round(dmg));
    h.hp = Math.max(0, h.hp - dmg);
    ev.push({ t: 'hit', who: 'hero', dmg, crit });
    if (ab.effect === 'drain') { const amt = Math.round(dmg * 0.5); e.hp = Math.min(e.maxHp, e.hp + amt); ev.push({ t: 'heal', who: 'enemy', amt }); }
    else if (ab.effect && rng() < (ab.chance || 1) && h.hp > 0) addStatus(h, ab.effect, STATUS_TURNS[ab.effect], ev, 'hero');
  }
  checkEnd(B, ev);
  return ev;
}
function heroTurnStart(B) { const ev = []; const skip = tickStatuses(B, 'hero', ev); return { ev, skip }; }

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
function attemptCapture(B, S, rng = RNG) {
  const ev = [];
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
function finishBattle(S, B, rng = RNG) {
  const m = B.m, r = RARITY[m.rarity], tier = r.tier, sum = { result: B.result, rewards: [], levelUps: [], drops: [], newCapture: false };
  S.stats.battles++;
  S.hp = Math.max(1, B.hero.hp);
  const shinyX = m.variant === 'shiny' ? 2 : 1;
  const famMat = FAMILIES[m.fam].mat;
  if (B.result === 'victory' || B.result === 'captured') {
    const caught = B.result === 'captured';
    const xp = Math.round((12 + 6 * m.level) * r.xp * (caught ? 0.85 : 1));
    const reward = { xp, coins: Math.round((8 + 3 * m.level) * r.xp * randRange(rng, 0.8, 1.2) * (caught ? 0.5 : 1) * shinyX) };
    reward[famMat] = Math.round((randInt(rng, 2, 4) + tier) * (caught ? 0.5 : 1)) || 1;
    const other = ['scrap', 'goo', 'ecto'][randInt(rng, 0, 2)];
    reward[other] = (reward[other] || 0) + 1;
    if (tier >= 2) reward.prism = tier - 1 + (m.variant === 'shiny' ? 1 : 0);
    if (m.variant === 'mutated') reward.goo = (reward.goo || 0) + 3;
    if (!caught && rng() < 0.25) reward[rng() < 0.6 ? 'potion' : 'trap'] = 1;
    const out = grant(S, reward);
    sum.rewards = out.filter(o => o.k);
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
      S.stats.capByFam[m.fam] = (S.stats.capByFam[m.fam] || 0) + 1;
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
  const reward = { [FAMILIES[m.fam].mat]: 2 + RARITY[m.rarity].tier * 2, coins: 10 + 10 * RARITY[m.rarity].tier };
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

if (typeof module !== 'undefined') module.exports = { freshState, migrate, resolvePhoto, recordSighting, createMonster, newBattle, heroStrike, enemyTurn, heroTurnStart, attemptCapture, captureChance, attemptFlee, useItem, finishBattle, hunterStats, encounterChance, matchCategory, exportSave, importSave, unlockWeapon, upgradeWeapon, buyResearch, claimQuest, activeQuests, setRNG: f => { RNG = f; }, xpFor, hamming };
