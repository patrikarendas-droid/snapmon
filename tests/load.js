// Loads the browser source files into a Node VM context for logic tests.
const fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function load() {
  const ctx = { console, Math, Date, JSON, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'), escape, unescape, localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } } };
  vm.createContext(ctx);
  const src = ['data.js', 'sprites.js', 'parts.js', 'objects.js', 'labels.js', 'game.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
  vm.runInContext(src + '\n;globalThis.__api = { makeDNA, buildGrid, buildPalette, migrate, OBJECTS, objectForLabel, freshState, resolvePhoto, recordSighting, newBattle, heroStrike, enemyTurn, heroTurnStart, attemptCapture, captureChance, attemptFlee, useItem, finishBattle, hunterStats, matchCategory, exportSave, importSave, saveState, loadState, CATEGORIES, RARITY, WEAPONS, buyResearch, unlockWeapon, upgradeWeapon, claimQuest, activeQuests, setRNG: f => { RNG = f; } };', ctx);
  return ctx.__api;
};
