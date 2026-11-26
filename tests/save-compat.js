// Save compatibility ACROSS GAME VERSIONS — the player-data half of a rollback (docs/RECOVERY.md).
// A synthetic, rich save (every persistent field the game has: monsters of every rarity and variant with levels/XP,
// encyclopedia, coins, materials, items, weapons, charms + slots, research, quests, achievements, companion, hunter
// name, quiet + encounter locks, settings, statistics, a legacy nickname) is checked:
//   • current code: saveState → loadState, and backup code export → import, give back exactly the same save
//   • BACKWARD (a recovery APK built from older code): for every commit in tools/android/recovery-points.json the
//     OLD game code (read with `git show <commit>:src/…`) loads the current save without refusing it, keeps every
//     field, and after the old code SAVES it again (and after a backup-code import into the old code) the current
//     code loads the same progress — including fields the old code does not know (hunter name, locks)
//   • FORWARD (updating again after a recovery): a save made and played by the old code loads in the current code
//     with everything kept and only additive defaults added
// Allowed differences: monster display text (name, flavour text, move names) — every version refreshes saved
// monsters to ITS curated writing once per content revision (by design, text only) — and the bookkeeping field
// curatedRev. Nothing else may differ. Needs the git history of the listed commits (CI: fetch-depth 0).
// Usage: node tests/save-compat.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const POINTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/android/recovery-points.json'), 'utf8'));
const FILES = ['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'lore.js', 'game.js', 'combatlog.js', 'curated.js', 'curated-data.js'];

// one game version in its own VM; `read` returns a source file's text or null if that version has no such file
function game(read, tag) {
  const store = {};
  const ctx = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, escape, unescape,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  vm.createContext(ctx);
  const src = FILES.map(f => read(f)).filter(s => s != null).join('\n');
  vm.runInContext(src + `\n;globalThis.__api = { freshState, migrate, exportSave, importSave, saveState, loadState, createMonster, recordSighting,
    newBattle, finishBattle, SAVE_KEY, SAVE_VERSION, GAME_VERSION, blocked: () => saveBlocked, setRNG: f => { RNG = f; },
    COMBAT_MODEL: typeof COMBAT_MODEL !== 'undefined' ? COMBAT_MODEL : 1, objectFamily: typeof objectFamily === 'function' ? objectFamily : null,
    monsterStats: typeof monsterStats === 'function' ? monsterStats : null };`, ctx, { filename: tag });
  return { api: ctx.__api, store };
}
const current = () => game(f => { const p = path.join(ROOT, 'src', f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }, 'current');
const gitShow = (ref, f) => { try { return execSync(`git show ${ref}:src/${f}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).toString(); } catch (e) { return null; } };
const hasRef = ref => { try { execSync(`git cat-file -e ${ref}^{commit}`, { cwd: ROOT, stdio: 'ignore' }); return true; } catch (e) { return false; } };

// deep comparison; returns the differing paths (allowed text paths filtered out)
const TEXT = /^monsters\.\d+\.(name|lore)$|^monsters\.\d+\.abilities\.\d+\.name$|^curatedRev$/;
function diff(a, b, p = '', out = []) {
  if (a === b) return out;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) { if (!TEXT.test(p)) out.push(p || '(root)'); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p ? p + '.' + k : k, out);
  return out;
}
const J = s => JSON.parse(JSON.stringify(s));

// ---------- the synthetic save (made by the CURRENT code) ----------
function richSave(G) {
  let seed = 4242; G.setRNG(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
  const S = G.freshState(), now = Date.now();
  Object.assign(S, { level: 9, xp: 777, hp: 88, coins: 12345, rp: 31, nextId: 1, equipped: 'pistol', hunterName: 'Zoë "Test" O\'Neil',
    companion: null, questsClaimed: { q_first_catch: Date.now() - 5e6 }, achievements: { a_first: Date.now() - 4e6 } });
  S.hunterName = 'Zoë Test-Hunter';
  S.mats = { scrap: 21, goo: 13, ecto: 8, prism: 3 };
  S.items = { potion: 7, greater: 2, strength: 1, defense: 1, antidote: 4, enhancer: 2, trap: 11, smoke: 3 };
  S.weapons = { sword: 3, pistol: 2, wand: 1, dagger: 0 };
  S.charms = { fang: true, battery: true, slipper: true }; S.charmSlots = ['fang', 'battery'];
  S.research = { capture2: 1, medic: 1, spectral: 1, analysis: 1 };
  S.settings.muted = true; S.settings.keepPhotos = true;
  const kinds = [['mug', 'common', null], ['apple', 'uncommon', 'spectral'], ['dog', 'rare', 'mutated'], ['lamp', 'epic', 'shiny'], ['cactus', 'legendary', null], ['mouse', 'common', null]];
  for (const [obj, rarity, variant] of kinds) {
    const m = G.createMonster(S, { obj, rarity, variant, word: obj });
    G.recordSighting(S, m);
    m.id = 'm' + (S.nextId++); m.caughtAt = now - 3600e3 * S.nextId; m.level = 2 + S.nextId; m.xp = 5 * S.nextId;
    S.dex[m.species].caught++;
    S.monsters.push(m);
  }
  S.monsters[2].nick = 'Old nickname'; // renaming was removed; an old nickname must still survive in the save
  S.companion = S.monsters[3].id;
  Object.assign(S.stats, { photos: 40, encounters: 19, wins: 9, losses: 2, captures: 6, flees: 1, battles: 18, cleanWins: 4, rareBeaten: 3, epicSeen: 1, legendSeen: 1 });
  S.enc.miss = 2; S.enc.sinceRare = 3;
  S.enc.quiet = { mug: now + 10 * 60e3, x_light_switch: now + 5 * 60e3 };
  S.enc.disturbed = { mouse: now + 40 * 60e3 };
  return S;
}

// ---------- current code ----------
const C = current();
const RICH = richSave(C.api);
{
  C.api.saveState(RICH);
  const G2 = current(); Object.assign(G2.store, C.store);
  const L = G2.api.loadState();
  const d = diff(J(RICH), J(L));
  ok(!G2.api.blocked() && !d.length, `current code: save → load keeps every field (${d.length ? d.slice(0, 5).join(', ') : RICH.monsters.length + ' monsters, ' + Object.keys(RICH.dex).length + ' encyclopedia entries'})`);
  const code = C.api.exportSave(RICH);
  const I = current().api.importSave(code);
  const di = diff(J(RICH), J(I));
  ok(/^SNAPMON1:/.test(code) && !di.length, `current code: backup code export → import keeps every field (${di.length ? di.slice(0, 5).join(', ') : code.length + ' characters'})`);
  ok(I.hunterName === RICH.hunterName && I.enc.disturbed.mouse === RICH.enc.disturbed.mouse && I.enc.quiet.mug === RICH.enc.quiet.mug && I.companion === RICH.companion && I.monsters[2].nick === 'Old nickname',
    'backup code carries the hunter name, both locks, the companion and an old nickname');
}

// ---------- every recovery point ----------
const refs = POINTS.compatibilityRefs.map(r => r.ref);
if (!refs.includes(POINTS.drill)) refs.push(POINTS.drill);
for (const ref of refs) {
  const what = (POINTS.compatibilityRefs.find(r => r.ref === ref) || { what: 'recovery drill commit' }).what;
  const tag = `${ref.slice(0, 7)} (${what})`;
  if (!hasRef(ref)) { ok(false, `${tag}: commit not available — CI must check out the full history (fetch-depth: 0)`); continue; }
  const oldGame = () => game(f => gitShow(ref, f), ref);

  // BACKWARD: the current save opened by the old code
  const O = oldGame();
  ok(O.api.SAVE_VERSION === C.api.SAVE_VERSION, `${tag}: same save format (${O.api.SAVE_VERSION}) as the current code (${C.api.SAVE_VERSION})`);
  O.store[C.api.SAVE_KEY] = C.store[C.api.SAVE_KEY];
  const OL = O.api.loadState();
  ok(!O.api.blocked(), `${tag}: the old code loads the current save (not refused as newer/corrupt)`);
  const d1 = diff(J(RICH), J(OL));
  ok(!d1.length, `${tag}: the old code sees every field of the current save${d1.length ? ' — differs: ' + d1.slice(0, 6).join(', ') : ''}`);
  O.api.saveState(OL); // the old code writes the save again (any action in the recovery build does this)
  const back = current(); back.store[C.api.SAVE_KEY] = O.store[C.api.SAVE_KEY];
  const BL = back.api.loadState();
  const d2 = diff(J(RICH), J(BL));
  ok(!back.api.blocked() && !d2.length, `${tag}: after the old code saved it, the current code gets the same progress back, incl. hunter name and locks${d2.length ? ' — differs: ' + d2.slice(0, 6).join(', ') : ''}`);
  // backup code made by the current code, restored in the old code, then exported again from there
  let OI = null; try { OI = oldGame().api.importSave(C.api.exportSave(RICH)); } catch (e) { OI = e; }
  const d3 = OI instanceof Error ? ['import refused: ' + OI.message] : diff(J(RICH), J(current().api.importSave(O.api.exportSave(OI))));
  ok(!d3.length, `${tag}: current backup code → restored in the old code → its backup code → restored in the current code: nothing lost${d3.length ? ' — ' + d3.slice(0, 6).join(', ') : ''}`);

  // FORWARD: a save created and played by the old code, opened by the current code
  const P = oldGame();
  let s2 = 77; P.api.setRNG(() => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; });
  const PS = P.api.freshState(); PS.coins = 999; PS.level = 4; PS.items.trap = 9;
  for (const [obj, rarity] of [['clock', 'rare'], ['umbrella', 'common']]) {
    const m = P.api.createMonster(PS, { obj, rarity, word: obj }); P.api.recordSighting(PS, m);
    const B = P.api.newBattle(PS, m); B.result = 'captured'; B.over = true; P.api.finishBattle(PS, B);
  }
  P.api.saveState(PS);
  const F = current(); F.store[C.api.SAVE_KEY] = P.store[C.api.SAVE_KEY];
  const FL = F.api.loadState();
  // Combat model 2 (2026-11-26) is an intentional change: a monster made by older code gets its combat data (family,
  // stats, moves, stamp `cv`) rebuilt on load; old 'spectral'/'mutated' statistic keys are dropped. Those paths are
  // allowed here ONLY because the rebuilt values are verified right below against the current model.
  const COMBAT = /^monsters\.\d+\.(fam|cv|stats(\.\w+)?|abilities(\.\d+(\.\w+)?)?)$|^dex\.[^.]+\.fam$|^stats\.(famSeen|capByFam)\.(spectral|mutated)$/;
  const added = diff(J(PS), J(FL)).filter(p => !/^hunterName$|^enc\.quiet$|^enc\.disturbed$/.test(p) && !COMBAT.test(p));
  ok(!F.api.blocked() && PS.monsters.length === 2 && FL.monsters.length === 2 && !added.length,
    `${tag}: a save made and played by the old code (2 captures) loads in the current code unchanged apart from additive defaults and the combat-model rebuild${added.length ? ' — differs: ' + added.slice(0, 6).join(', ') : ''}`);
  const A = F.api, rebuilt = FL.monsters.every((m, i) => { const o = PS.monsters[i], fam = A.objectFamily(o.obj);
    return m.cv === A.COMBAT_MODEL && m.fam === fam && JSON.stringify(m.stats) === JSON.stringify(A.monsterStats(o.rarity, fam, o.level, o.seed, o.variant || null)) && m.level === o.level && JSON.stringify(m.dna) === JSON.stringify(o.dna) && m.id === o.id; });
  ok(rebuilt, `${tag}: its monsters are rebuilt to combat model ${A.COMBAT_MODEL} (real family, current stats) with level, look and id kept`);
}

console.log(errors.length ? `\n${errors.length} FAILED` : `\nsave compatibility: all checks passed (${refs.length} older versions)`);
process.exit(errors.length ? 1 : 0);
