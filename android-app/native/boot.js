/* SnapMon — Android app boot script (Capacitor). Runs BEFORE any game script, only inside the APK.

   1. Saves: restores this app's own saved progress from app-private files (native SaveStore plugin, atomic writes)
      into localStorage, then sets window.SNAPMON_NATIVE so src/platform.js mirrors every later write back to those
      files. A fresh install has no files and no localStorage: the game starts as a brand-new player. Nothing is ever
      imported from the Chrome website (a different app and origin; it is never read).
   2. Loads the game scripts in their original order (the list comes from the website's index.html at build time).
   3. Hardware Back → window.SnapmonNav.back(); 'exit' waits for pending save copies, then closes the app.
      Pause → save now and stop the camera; Resume → re-check the recognition engine.

   Rule: localStorage is the synchronous copy the game reads; the files are the durable copy. Each write carries a
   revision number; at start-up the newer copy of each key wins, so neither a lost WebView storage nor an
   interrupted file write can roll progress back. See docs/ANDROID.md → "Saves in the Android app". */
(function () {
  'use strict';
  var build = window.SNAPMON_BUILD || {};
  var scripts = window.SNAPMON_SCRIPTS || [];
  var Cap = window.Capacitor;
  var onDevice = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var Store = onDevice && Cap.registerPlugin ? Cap.registerPlugin('SnapmonSaveStore') : null;
  var App = onDevice && Cap.registerPlugin ? Cap.registerPlugin('App') : null;

  var META = 'snapmon-native.';            // bookkeeping keys (never mirrored, never part of a save)
  var REV = META + 'rev', REVK = META + 'rev:';
  var ls = null; try { ls = window.localStorage; } catch (e) { ls = null; }
  function lget(k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } }
  function lset(k, v) { try { if (!ls) return false; ls.setItem(k, v); return true; } catch (e) { return false; } }
  function ldel(k) { try { if (ls) ls.removeItem(k); } catch (e) {} }

  var counter = +(lget(REV) || 0) || 0;
  var queued = {};                         // key → latest value waiting to be written (writes to one key coalesce)
  var chain = Promise.resolve();
  var stats = { pending: 0, written: 0, failures: 0, lastError: '', restored: 0, pushed: 0, nativeKeys: 0, hydrateError: '', backPresses: 0, lastBack: '' };

  function nextRev() { counter += 1; lset(REV, String(counter)); return counter; }
  function enqueue(key, task) {
    stats.pending++;
    chain = chain.then(task).then(function () { stats.written++; }, function (e) {
      stats.failures++; stats.lastError = String((e && (e.message || e)) || 'unknown');
      try { console.error('[SnapMon] native save copy failed for ' + key + ': ' + stats.lastError); } catch (er) {}
    }).then(function () { stats.pending--; });
    return chain;
  }
  var storage = {
    // called synchronously by Platform.storage.set after localStorage was written; returns true when a copy is queued
    mirror: function (key, value) {
      if (!Store || String(key).indexOf(META) === 0) return false;
      var rev = nextRev(); lset(REVK + key, String(rev));
      var first = !(key in queued);
      queued[key] = { value: String(value), rev: rev };
      if (first) enqueue(key, function () {
        var q = queued[key]; delete queued[key];
        if (!q) return null;
        return Store.set({ key: key, value: q.value, rev: q.rev });
      });
      return true;
    },
    remove: function (key) {
      if (!Store || String(key).indexOf(META) === 0) return;
      nextRev(); ldel(REVK + key); delete queued[key];
      enqueue(key, function () { return Store.remove({ key: key }); });
    },
    // resolves once every copy queued so far reached the files (or failed); never rejects
    flush: function (timeoutMs) {
      var done = chain.then(function () { return Object.keys(queued).length ? chain : null; });
      return Promise.race([done, new Promise(function (r) { setTimeout(r, timeoutMs || 4000); })]);
    },
    status: function () { var s = {}; for (var k in stats) s[k] = stats[k]; s.pending = stats.pending; return s; },
  };

  function hydrate() {
    if (!Store) return Promise.resolve();
    return Store.getAll().then(function (res) {
      var entries = (res && res.entries) || {}, keys = Object.keys(entries), maxRev = 0;
      stats.nativeKeys = keys.length;
      keys.forEach(function (k) {
        var e = entries[k] || {}, rev = +e.rev || 0;
        if (rev > maxRev) maxRev = rev;
        var localRev = +(lget(REVK + k) || 0) || 0;
        if (lget(k) === null || rev > localRev) { if (lset(k, String(e.value))) { lset(REVK + k, String(rev)); stats.restored++; } }
      });
      if (maxRev > counter) { counter = maxRev; lset(REV, String(counter)); }
      // values that only localStorage has (or has newer): copy them to the files now
      var push = [];
      if (ls) for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i); if (!k || k.indexOf(META) === 0) continue;
        var e = entries[k], localRev = +(lget(REVK + k) || 0) || 0;
        if (!e || localRev > (+e.rev || 0)) push.push(k);
      }
      push.forEach(function (k) { var v = lget(k); if (v !== null && storage.mirror(k, v)) stats.pushed++; });
    }).catch(function (e) {
      stats.hydrateError = String((e && (e.message || e)) || 'unknown');
      try { console.error('[SnapMon] could not read saved progress files: ' + stats.hydrateError); } catch (er) {}
    });
  }

  function fatal(msg) {
    document.body.innerHTML = '<div style="padding:24px;font:16px sans-serif;color:#eee;background:#110d1b;min-height:100vh">' +
      '<h2>SnapMon could not start</h2><p>' + String(msg).replace(/[<&]/g, '') + '</p><p>Close the app and open it again. Your saved progress is not touched.</p></div>';
  }
  function loadScripts() {
    return new Promise(function (resolve) {
      var left = scripts.length;
      if (!left) return resolve();
      scripts.forEach(function (src) {
        var s = document.createElement('script');
        s.src = src; s.async = false;          // dynamic scripts with async=false execute in insertion order
        s.onload = function () { if (--left === 0) resolve(); };
        s.onerror = function () { fatal('A game file is missing from the app: ' + src); };
        document.body.appendChild(s);
      });
    });
  }
  function call(name) { try { var f = window[name]; if (typeof f === 'function') return f.apply(null, [].slice.call(arguments, 1)); } catch (e) {} }

  function wireNative() {
    if (!App) return;
    var exiting = false;
    App.addListener('backButton', function () {
      if (exiting) return;
      var r = window.SnapmonNav ? window.SnapmonNav.back() : 'exit';
      stats.backPresses++; stats.lastBack = r;              // diagnostics (emulator test, Settings)
      if (r === 'exit') { exiting = true; storage.flush(4000).then(function () { App.exitApp(); }); }
    });
    App.addListener('pause', function () {
      call('persist', true);
      // Platform is a top-level const of src/platform.js (global scope, but not a window property)
      try { if (typeof Platform !== 'undefined' && Platform.camera.isOpen()) call('closeCamera'); } catch (e) {}
    });
    App.addListener('resume', function () { call('resumeEngine'); });
  }

  window.SNAPMON_NATIVE = { platform: onDevice ? 'android' : 'android-preview', build: build, storage: storage };
  hydrate().then(loadScripts).then(wireNative);
})();
