#!/usr/bin/env node
// Builds lab/vocab-labels.json: the experimental lens's vocabulary (one entry per label → object id).
// Background concepts map to null so that walls, floors, people and scenery are rejected instead of becoming monsters.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, JSON }; vm.createContext(ctx);
vm.runInContext(['data.js', 'sprites.js', 'parts.js', 'objects.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n') + '\n;globalThis.R = { OBJECT_LIST };', ctx);
const BACKGROUND = ['a blank wall', 'a white wall', 'a wooden floor', 'a carpet', 'a tiled floor', 'a ceiling', 'the sky', 'clouds', 'grass', 'a lawn', 'a road', 'a pavement', 'a brick wall',
  'a person', 'a man', 'a woman', 'a child', 'a human face', 'a hand', 'a selfie', 'a crowd of people', 'a room interior', 'a kitchen interior', 'a living room', 'a bedroom', 'an office interior',
  'a landscape', 'a mountain', 'a beach', 'the sea', 'a forest', 'a city street', 'a building', 'a house exterior', 'a window view', 'a blurry photo', 'a dark photo', 'darkness', 'an empty table surface',
  'text on paper', 'a screenshot', 'a pattern', 'a texture', 'fabric texture', 'a shadow', 'bright light', 'nothing in particular'];
const seen = new Set(), labels = [];
const add = (l, o) => { const k = l.toLowerCase().trim(); if (!k || seen.has(k) || k.length > 40 || /[()]/.test(k)) return; seen.add(k); labels.push({ l: k, o }); };
for (const o of ctx.R.OBJECT_LIST) { if (o.vocab === false) continue; add(o.name, o.id); for (const a of o.al) add(a, o.id); }
for (const b of BACKGROUND) add(b, null);
fs.mkdirSync(path.join(__dirname, '../lab'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../lab/vocab-labels.json'), JSON.stringify(labels));
console.log(`vocabulary: ${labels.length} labels → ${new Set(labels.filter(x => x.o).map(x => x.o)).size} objects, ${labels.filter(x => !x.o).length} background concepts`);
