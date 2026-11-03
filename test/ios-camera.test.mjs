// iPhone "Snap doesn't open the camera" (2026-11-02): no `multiple` with capture, no `hidden` file inputs, camera opened
// synchronously in the tap BEFORE any hash change, and first-run users are no longer detoured to the diet screen.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const rd = f => fs.readFileSync(new URL('../web/' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
test('camera input: capture without multiple; file inputs are offscreen, not hidden', () => {
  const h = rd('index.html'); const cam = /<input[^>]*id="snapCam"[^>]*>/.exec(h)[0];
  assert.match(cam, /capture="environment"/); assert.ok(!/multiple/.test(cam)); assert.ok(!/\shidden[\s>]/.test(cam));
  assert.match(/<input[^>]*id="snapLib"[^>]*>/.exec(h)[0], /multiple/);
  assert.ok(!/i\.hidden = true/.test(rd('dish.js'))); assert.ok(!/id="famFile"[^>]*\shidden[\s>]/.test(rd('more.js')));
});
test('Snap tap opens the camera first (sync), no first-run detour; diet screen buttons open it before the hash change', () => {
  const a = rd('app.js');
  const snap = a.split('\n').find(l => l.includes("t.closest('a.big-choice.snap')"));
  assert.ok(snap.indexOf('openSnap()') < snap.indexOf("location.hash = '#scan'")); assert.ok(!/location\.hash = '#settings'/.test(snap));
  const diet = a.split('\n').find(l => l.includes("t.closest('#dietSnap') || t.closest('#dietSkip')"));
  assert.ok(diet.indexOf('openSnap()') < diet.indexOf('location.hash')); assert.ok(!/await/.test(diet));
});
