// Disturbed objects (game.js ENCOUNTER_LOCK_MS / disturbedUntil): after ANY normal encounter from a confirmed object,
// that object TYPE (canonical registry id) cannot produce another monster for 60 minutes of wall-clock time, whatever
// happens to the monster. Coexists with the 20-minute quiet lock after a miss. Deterministic: fake clock + fake RNG.
// Usage: node tests/encounter-lock.js
'use strict';
const G = require('./load')();
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const MIN = 60 * 1000, H = G.ENCOUNTER_LOCK_MS, Q = G.QUIET_MS;
let now = Date.UTC(2026, 10, 24, 10, 0, 0);
G.setClock(() => now);
let rngCalls = 0, rngValue = 0;                // 0 = the luckiest roll (encounter), 0.999 = a miss
const rng = () => { rngCalls++; return rngValue; };
G.setRNG(rng);
const veteran = () => { const S = G.freshState(); S.stats.photos = 5; S.stats.encounters = 2; return S; };
const scan = (S, obj, h) => G.resolvePhoto(S, obj, { hue: 10, sat: .5, lit: .5, hash: h }, { label: 'mouse', conf: .9 }, rng);
const snap = S => JSON.stringify(S);

ok(H === 60 * 60 * 1000 && Q === 20 * 60 * 1000, 'one constant each: ENCOUNTER_LOCK_MS = 60 min, QUIET_MS = 20 min (independent)');

// 1. an encounter locks the object type immediately (at generation, before any battle)
let S = veteran(), t0 = now;
let r = scan(S, 'mouse', '0000000000000001');
ok(r.encounter && S.enc.disturbed.mouse === t0 + H, 'an encounter locks its object type at once (expiry = encounter time + 60 min)');
ok(!S.enc.quiet.mouse, 'an encounter creates no quiet (miss) entry');
// …whatever happens to the monster next: the battle code never touches the lock
const B = G.newBattle(S, r.monster); B.over = true; B.result = 'fled'; G.finishBattle(S, B, rng);
ok(S.enc.disturbed.mouse === t0 + H, 'fleeing / any battle outcome leaves the lock as it was');

// 2. blocked: new hash/angle, lucky RNG, maximum pity, during the whole hour; nothing changes
now = t0 + 10 * MIN; S.enc.miss = 99; let before = snap(S); rngCalls = 0;
r = scan(S, 'mouse', 'ffffffffffffffff');
ok(!r.encounter && r.disturbed && r.lock === 'disturbed' && !r.monster, 'same object, new angle, lucky roll, max pity: no monster ("disturbed")');
ok(rngCalls === 0 && snap(S) === before, 'a blocked scan rolls nothing and changes nothing (no rarity, rewards, pity, photo counts, expiry)');
ok(!/\d|minute|hour|%/.test(r.line), `the message has no timer, duration or percentage ("${r.line}")`);
for (let i = 0; i < 30; i++) scan(S, 'mouse', i.toString(16).padStart(16, '0'));
ok(snap(S) === before, '30 more blocked scans change nothing either');
now = t0 + H - 1000; r = scan(S, 'mouse', 'eeeeeeeeeeeeeeee');
ok(r.disturbed && snap(S) === before, 'still blocked at 59 min 59 s');

// 3. other object types keep their normal odds
r = scan(S, 'mug', 'aaaaaaaaaaaaaaaa');
ok(r.encounter && S.enc.disturbed.mug, 'a different object type is not delayed (lucky roll → monster) and gets its own lock');

// 4. at 60 min the object is eligible again — normal odds, nothing guaranteed
now = t0 + H; rngValue = 0.999; S.enc.miss = 0;
r = scan(S, 'mouse', 'bbbbbbbbbbbbbbbb');
ok(!r.encounter && !r.disturbed && !r.quiet, 'at 60 min it rolls again with normal odds (here: an unlucky roll → no monster, not guaranteed)');
ok(S.enc.quiet.mouse === now + Q && !G.disturbedUntil(S, 'mouse', now), '…and that miss starts the ordinary 20-minute quiet lock');
now += 5 * MIN; rngValue = 0; r = scan(S, 'mouse', 'cccccccccccccccc');
ok(r.quiet && !r.encounter, 'the quiet lock then applies as before ("Still quiet")');

// 5. both records present: the encounter lock wins and neither is extended
S = veteran(); S.enc.quiet.mouse = now + 5 * MIN; S.enc.disturbed.mouse = now + 40 * MIN; before = snap(S);
r = scan(S, 'mouse', 'dddddddddddddddd');
ok(r.lock === 'disturbed' && snap(S) === before, 'if both locks exist, "disturbed" is reported; neither expiry changes');
now += 6 * MIN; r = scan(S, 'mouse', 'dddddddddddddde0');
ok(r.lock === 'disturbed', 'after the quiet lock ends the encounter lock still blocks');

// 6. first-ever hunt: still guaranteed, and it locks its object
S = G.freshState(); rngValue = 0.999;
r = scan(S, 'apple', '1111111111111111');
ok(r.encounter && r.first && S.enc.disturbed.apple === now + H, 'the very first hunt is still guaranteed and locks its object type');
r = scan(S, 'apple', '1111111111111112');
ok(!r.encounter && r.disturbed, 'a second scan of that object right after is blocked (the first-hunt guarantee cannot repeat)');

// 7. aliases share the lock (category id → canonical object)
S = veteran(); rngValue = 0;
r = G.resolvePhoto(S, 'shoe', { hash: '2222222222222222' }, { label: '' }, rng);
ok(r.encounter && S.enc.disturbed.sneaker, 'a category alias ("shoe") locks its canonical object ("sneaker")');
ok(scan(S, 'sneaker', '3333333333333333').disturbed, 'scanning the canonical object is blocked too');

// 8. persistence, migration, corrupt data, pruning, clock rollback
S = veteran(); rngValue = 0; scan(S, 'mouse', '4444444444444444');
const back = G.importSave(G.exportSave(S));
ok(back.enc.disturbed.mouse === S.enc.disturbed.mouse, 'backup code export → import keeps the encounter lock');
ok(G.migrate(JSON.parse(JSON.stringify(S))).enc.disturbed.mouse === S.enc.disturbed.mouse, 'save reload (migrate) keeps it');
const old = JSON.parse(JSON.stringify(S)); delete old.enc.disturbed; delete old.hunterName;
const mo = G.migrate(old);
ok(JSON.stringify(mo.enc.disturbed) === '{}' && mo.enc.quiet && mo.hunterName === 'Hunter', 'older saves load with no encounter locks, quiet entries kept, hunter name "Hunter"');
const bad = JSON.parse(JSON.stringify(S));
bad.enc.disturbed = { mouse: now + 30 * MIN, a: 'x', b: NaN, c: -1, d: now - 1, e: null, f: now + 10 * 60 * MIN };
const fixed = G.migrate(bad).enc.disturbed;
ok(Object.keys(fixed).sort().join() === 'f,mouse' && fixed.f === now + H, `corrupt/expired entries dropped, far-future capped at 60 min (${Object.keys(fixed).join(',')})`);
ok(JSON.stringify(G.migrate({ ...JSON.parse(JSON.stringify(S)), enc: { ...S.enc, disturbed: [1, 2] } }).enc.disturbed) === '{}', 'a non-object field does not break the save');
const quietKept = JSON.parse(JSON.stringify(S)); quietKept.enc.quiet = { lamp: now + 3 * MIN };
ok(G.migrate(quietKept).enc.quiet.lamp === now + 3 * MIN, 'existing quiet entries are never wiped by the new field');
const many = {}; for (let i = 0; i < 1000; i++) many['o' + i] = now + 1 + i;
ok(Object.keys(G.lockClean(many, now, H)).length === 300, 'more than 300 entries are pruned');
S = veteran(); rngValue = 0; scan(S, 'clock', '5555555555555555');
now -= 5 * 60 * MIN; r = scan(S, 'clock', '5555555555555556');
ok(r.disturbed && S.enc.disturbed.clock === now + H, 'clock turned back 5 h: still locked, capped at 60 min from the new time');
now += H; r = scan(S, 'clock', '5555555555555557');
ok(!r.disturbed, '…and eligible again 60 minutes later');

// 9. developer custom encounters never touch the locks (not even a locked object's), and the locks still hold afterwards
S = veteran(); S.settings.devUnlocked = true; rngValue = 0; scan(S, 'mouse', '6666666666666666'); const q0 = snap(S.enc), st0 = snap(S.stats);
for (let i = 0; i < 3; i++) { const sp = G.devSpawnEncounter(S, 'mouse', 'rare', 'normal'); ok(sp.ok && sp.monster.obj === 'mouse', `custom encounter ${i + 1} of a locked object works`); }
ok(snap(S.enc) === q0 && snap(S.stats) === st0, 'custom encounters create, reset or extend no lock and change no encounter state or photo statistics');
ok(scan(S, 'mouse', '6666666666666667').disturbed, '…and a normal hunt of that object is still blocked by its lock');

// 10. hunter name
const C = G.cleanHunterName;
ok(C('  Alex  ') === 'Alex' && C('Zoë  Ann') === 'Zoë Ann' && C("O'Brien-Smith") === "O'Brien-Smith", 'normal names are trimmed and kept');
ok(C('') === null && C('   ') === null && C('!!!') === null && C(42) === null && C(null) === null, 'empty, symbol-only and non-text names are rejected');
ok(C('<img src=x onerror=1>') === 'img src=x onerro' && C('<b>Al</b>') === 'bAl/b', 'angle brackets are removed (and the UI escapes every render)');
ok(Array.from(C('A'.repeat(50))).length === G.HUNTER_NAME_MAX && G.HUNTER_NAME_MAX === 16, 'overlong names are cut to 16 characters');
S = veteran(); S.hunterName = 'Alex';
ok(G.newBattle(S, G.createMonster(S, { obj: 'mug', rarity: 'common', word: 'mug' })).hero.name === 'Alex', 'battles use the hunter name');
ok(G.importSave(G.exportSave(S)).hunterName === 'Alex' && G.migrate({ ...JSON.parse(JSON.stringify(S)), hunterName: '<<>>' }).hunterName === 'Hunter', 'name survives backup round-trip; an invalid stored name falls back to "Hunter"');

console.log(errors.length ? `\n${errors.length} FAILED` : '\nencounter lock + hunter name: all checks passed');
process.exit(errors.length ? 1 : 0);
