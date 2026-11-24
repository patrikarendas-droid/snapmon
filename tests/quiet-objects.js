// Quiet objects (game.js quietUntil / resolvePhoto): after an unsuccessful hunt of a confirmed object, that object (its
// canonical registry id = the object TYPE) cannot produce a monster for 20 minutes of real time. Deterministic: fake
// clock + fake RNG. Usage: node tests/quiet-objects.js
'use strict';
const G = require('./load')();
const errors = [];
const ok = (c, msg) => { if (!c) { errors.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const MIN = 60 * 1000, Q = G.QUIET_MS;
let now = Date.UTC(2026, 10, 24, 9, 0, 0);
G.setClock(() => now);
let rngCalls = 0, rngValue = 0.999;          // 0.999 = the roll misses; 0 = the luckiest possible roll
const rng = () => { rngCalls++; return rngValue; };
G.setRNG(rng);
const photo = h => ({ hue: 10, sat: .5, lit: .5, hash: h });
const veteran = () => { const S = G.freshState(); S.stats.photos = 5; S.stats.encounters = 2; return S; }; // past the first-hunt guarantee
const scan = (S, obj, h, label = 'thing') => G.resolvePhoto(S, obj, photo(h), { label, conf: .9 }, rng);
const snapshot = S => JSON.stringify(S);

ok(Q === 20 * 60 * 1000, 'the quiet period is 20 minutes of wall-clock time');

// 1. a real miss makes the object quiet; existing pressure/pity behaviour kept
let S = veteran(); const missBefore = S.enc.miss;
let r = scan(S, 'monitor', '0000000000000001');
ok(!r.encounter && !r.quiet, 'first scan of the object rolls normally and misses ("All quiet")');
ok(S.enc.quiet.monitor === now + Q, 'the miss makes the object quiet until now + 20 min');
ok(S.enc.miss === missBefore + 1, 'the miss still builds spirit pressure (enc.miss +1) as before');

// 2. blocked: other photo hash (new angle), luckiest RNG, maximum pity — nothing changes, nothing is rolled
now += 5 * MIN; rngValue = 0; S.enc.miss = 99;
let before = snapshot(S); rngCalls = 0;
r = scan(S, 'monitor', 'ffffffffffffffff');
ok(!r.encounter && r.quiet === true && /monitor|thing/.test(r.line), 'same object from a new angle (different hash), lucky RNG, max pity: blocked, no monster');
ok(rngCalls === 0, 'a blocked scan makes no RNG roll at all');
ok(snapshot(S) === before, 'a blocked scan changes nothing in the save (no photo/pressure/pity/quest progress, expiry not extended)');
ok(!/\d\s*(min|minute|sec|s\b)|20/.test(r.line), 'the blocked message contains no timer or duration');
for (let i = 0; i < 20; i++) scan(S, 'monitor', i.toString(16).padStart(16, '0'));
ok(snapshot(S) === before, '20 more blocked scans still change nothing');

// 3. other objects keep their normal odds
r = scan(S, 'mug', 'aaaaaaaaaaaaaaaa');
ok(r.encounter === true, 'a different object rolls normally meanwhile (lucky roll → monster)');
ok(!S.enc.quiet.mug, 'a successful hunt never makes the object quiet');

// 4. expiry boundary
const until = S.enc.quiet.monitor;
now = until - 1; before = snapshot(S); r = scan(S, 'monitor', 'bbbbbbbbbbbbbbbb');
ok(r.quiet && snapshot(S) === before, '1 ms before the end: still blocked');
now = until; rngValue = 0; r = scan(S, 'monitor', 'cccccccccccccccc');
ok(!r.quiet && r.encounter, 'at the end of the period the object rolls again (lucky roll → monster)');
rngValue = 0.999; S = veteran(); scan(S, 'monitor', '1111111111111111'); now += Q + 1; r = scan(S, 'monitor', '2222222222222222');
ok(!r.quiet && !r.encounter && S.enc.quiet.monitor === now + Q, 'after the period a new miss starts a new quiet period (normal odds, nothing guaranteed)');

// 5. first-ever hunt is still guaranteed and creates no quiet entry
S = G.freshState(); rngValue = 0.999;
r = scan(S, 'apple', '3333333333333333');
ok(r.encounter && r.first && !Object.keys(S.enc.quiet).length, 'the very first hunt is still a guaranteed encounter and leaves nothing quiet');

// 6. aliases: a bare category id resolves to its canonical object — both lock the same object
S = veteran(); rngValue = 0.999;
const cat = 'shoe'; // a category id whose canonical object is "sneaker"
r = G.resolvePhoto(S, cat, photo('4444444444444444'), { label: '' }, rng);
const key = Object.keys(S.enc.quiet)[0];
ok(key === 'sneaker' && !!G.OBJECTS[key] && !G.OBJECTS[cat], `a category alias ("${cat}") locks its canonical object id ("${key}")`);
rngValue = 0; r = scan(S, key, '5555555555555555');
ok(r.quiet, 'scanning the canonical object directly is blocked too');

// 7. a duplicate photo (same hash) that misses also makes the object quiet, without adding pressure (as before)
S = veteran(); rngValue = 0.5; S.enc.recentHashes = ['6666666666666666']; const m0 = S.enc.miss;
r = scan(S, 'sneaker', '6666666666666666');
ok(r.dup && !r.encounter && S.enc.quiet.sneaker && S.enc.miss === m0, 'duplicate-photo miss: "Already scanned", object quiet, pressure unchanged (existing rule)');

// 8. persistence: backup code round-trip, save reload, migration of old saves, corrupt and excessive data
S = veteran(); rngValue = 0.999; scan(S, 'monitor', '7777777777777777');
const back = G.importSave(G.exportSave(S));
const S2 = back && (back.state || back.S || back);
ok(S2 && S2.enc && S2.enc.quiet && S2.enc.quiet.monitor === S.enc.quiet.monitor, 'backup code export → import keeps the quiet object');
const re = G.migrate(JSON.parse(JSON.stringify(S)));
ok(re.enc.quiet.monitor === S.enc.quiet.monitor, 'save reload (migrate) keeps it');
const old = JSON.parse(JSON.stringify(S)); delete old.enc.quiet;
ok(JSON.stringify(G.migrate(old).enc.quiet) === '{}', 'older saves without the field load with no quiet objects');
const bad = JSON.parse(JSON.stringify(S));
bad.enc.quiet = { monitor: now + 5 * MIN, a: 'x', b: NaN, c: -5, d: now - 1, e: null, f: now + 5 * 60 * MIN, '': now + MIN };
const fixed = G.migrate(JSON.parse(JSON.stringify(bad))).enc.quiet;
ok(Object.keys(fixed).sort().join() === 'f,monitor' && fixed.f === now + Q, `corrupt/expired entries dropped, a far-future expiry capped at 20 min (${Object.keys(fixed).join(',')})`);
ok(JSON.stringify(G.migrate({ ...JSON.parse(JSON.stringify(S)), enc: { ...S.enc, quiet: 'garbage' } }).enc.quiet) === '{}', 'a non-object quiet field does not break the save');
const many = {}; for (let i = 0; i < 1000; i++) many['o' + i] = now + 1 + i;
ok(Object.keys(G.quietClean(many, now)).length === 300 && G.quietClean(many, now).o999, 'more than 300 entries are pruned, keeping the latest');
S = veteran(); S.enc.quiet = { old: now - 1, live: now + MIN }; rngValue = 0.999; scan(S, 'lamp', '8888888888888888');
ok(!('old' in S.enc.quiet) && S.enc.quiet.live && S.enc.quiet.lamp, 'expired entries are pruned when a new one is added');

// 9. clock turned back: the object stays quiet, but never longer than 20 minutes from the new time
S = veteran(); rngValue = 0.999; scan(S, 'clock', '9999999999999999');
now -= 3 * 60 * MIN; rngValue = 0; r = scan(S, 'clock', '9999999999999990');
ok(r.quiet && S.enc.quiet.clock === now + Q, 'after the phone clock goes back 3 h: still quiet, capped at 20 minutes from now');
now += Q; r = scan(S, 'clock', '9999999999999991');
ok(!r.quiet, '…and it rolls again 20 minutes later');

console.log(errors.length ? `\n${errors.length} FAILED` : '\nquiet-object rule: all checks passed');
process.exit(errors.length ? 1 : 0);
