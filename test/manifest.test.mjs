// Web manifest: shortcuts deep-link to real screens, icons exist (any, maskable, monochrome).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const m = JSON.parse(readFileSync('web/manifest.webmanifest', 'utf8'));
const screens = JSON.parse(readFileSync('web/app.js', 'utf8').match(/const SCREENS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
test('shortcuts route to existing screens and have icons', () => {
  assert.deepEqual(m.shortcuts.map(s => s.url.split('#')[1]), ['scan', 'dish', 'crave', 'prep', 'hplan']);
  for (const s of m.shortcuts) {
    assert.ok(screens.includes(s.url.split('#')[1]), s.url);
    assert.ok(s.short_name.length <= 12, s.short_name);
    for (const i of s.icons) assert.ok(existsSync('web/' + i.src), i.src);
  }
});
test('icons: any + maskable + monochrome, all files exist; orientation unlocked for large screens', () => {
  for (const p of ['maskable', 'monochrome']) assert.ok(m.icons.some(i => i.purpose === p), p);
  for (const i of m.icons) assert.ok(existsSync('web/' + i.src), i.src);
  assert.equal(m.orientation, 'any');
});
