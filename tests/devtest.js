// Quick Monster Test Mode (developer): off by default, boosted test-only odds, no effect on the real save, isolated
// test roster outside the save and the backup code. UI flows are covered by tests/e2e-v044.js.
const G = require('./load')();
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const S = G.freshState();
ok(!S.settings.quickTest, 'Quick Monster Test Mode is off in a new save');
// boosted, documented test odds; the real odds are untouched
let seed = 3; G.setRNG(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
const before = JSON.stringify(S), counts = {};
for (let i = 0; i < 4000; i++) { const m = G.createTestMonster(S, 'x_light_switch', { hue: 0, sat: 0, lit: .8 }, { label: 'light switch' }); counts[m.rarity] = (counts[m.rarity] || 0) + 1; }
const pct = r => Math.round((counts[r] || 0) / 40);
console.log('   test rarity distribution %:', JSON.stringify(Object.fromEntries(Object.keys(G.TEST_RARITY_WEIGHTS).map(r => [r, pct(r)]))));
ok(pct('legendary') >= 12 && pct('epic') >= 17 && pct('rare') >= 22, 'Rare, Epic and Legendary are easy to get in test mode (~25/20/15 %)');
ok(JSON.stringify(S) === before, 'making test monsters changes nothing in the save (no photos, pity, encyclopedia, rewards)');
const real = G.RARITY; ok(real.common.weight === 46 && real.legendary.weight === 1, 'real rarity weights unchanged (46/28/20/5/1)');
// the real generator is used: same object identity, design, lore and stats system
const t = G.createTestMonster(S, 'x_security_camera', { hue: 0, sat: 0, lit: .8 }, { label: 'security camera' });
ok(t.test === true && /^test-/.test(t.id) && t.obj === 'x_security_camera' && t.dna.shape === 'obj' && /Camera/.test(t.name) && typeof t.lore === 'string', `test monsters come from the normal generator (${t.name}) and are marked test`);
// isolated roster: separate storage key, not in the save or the backup code
G.TestRoster.clear(); G.TestRoster.add(t);
ok(G.TestRoster.list().length === 1 && G.TestRoster.list()[0].test === true, 'test monsters are stored in the separate test roster');
ok(!G.exportSave(S).includes('test-') && S.monsters.length === 0 && !Object.keys(S.dex).length, 'the save and the backup code contain no test monster');
G.TestRoster.remove(t.id); ok(G.TestRoster.list().length === 0, 'single test monsters can be deleted');
G.TestRoster.add(t); G.TestRoster.clear(); ok(G.TestRoster.list().length === 0, 'the test collection can be cleared');
ok(G.DEV_TOOLS === true, 'developer tools are compiled in for this web test build (set DEV_TOOLS=false for a release build)');
console.log(bad ? `\n${bad} PROBLEM(S)` : '\nALL TEST-MODE CHECKS PASSED');
process.exit(bad ? 1 : 0);
