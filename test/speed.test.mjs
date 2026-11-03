import test from 'node:test'; import assert from 'node:assert'; import fs from 'fs';
const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('waiting states: speed.js loads before app.js, is precached, and loading() delegates to it', () => {
  const h = rd('web/index.html'); assert.ok(h.indexOf('speed.js?v=') > 0 && h.indexOf('speed.js?v=') < h.indexOf('app.js?v='));
  assert.ok(rd('web/sw.js').includes('./speed.js?v=')); assert.match(rd('web/app.js'), /window\.scLoading \? scLoading\(/);
  const s = rd('web/speed.js'); for (const k of ['ldBar', 'ldStep', 'skel', 'prefers-reduced-motion']) assert.ok(s.includes(k), k);
});
test('service worker: versioned assets cache-first, HTML has a timeout fallback', () => {
  const s = rd('web/sw.js'); assert.match(s, /searchParams\.has\('v'\)/); assert.match(s, /setTimeout\(fb, \d+\)/);
});
