import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePopular, okDish, normDish, trendHit, STATIC } from '../functions/_lib/trending.js';
const { onRequest } = await import('../functions/api/trending.js');
const row = (label, n) => ({ name: normDish(label), label, n });
test('little data -> static list; threshold per device count', () => {
  const r = mergePopular({ local: [row('Ramen', 2), row('Pho', 9)], all: [] });
  assert.equal(r.source, 'static'); assert.deepEqual(r.items.map(i => i.label), STATIC.map(s => s[0]));
});
test('country data wins, then global; static fills up to 5; no duplicates', () => {
  const local = [row('Birria tacos', 12), row('Pozole', 5), row('Tacos', 4)];
  const r = mergePopular({ local, all: [row('Ramen', 50), row('Pho', 40), row('Curry', 30)] });
  assert.equal(r.source, 'country'); assert.deepEqual(r.items.map(i => i.label), ['Birria tacos', 'Pozole', 'Tacos', 'Pad thai', 'Pizza']);
  const g = mergePopular({ local: [row('Pozole', 5)], all: [row('Ramen', 50), row('Pho', 40), row('Curry', 30)] });
  assert.equal(g.source, 'global'); assert.equal(g.items[0].label, 'Ramen'); assert.equal(g.items[0].emoji, '🔥');
});
test('holiday dishes are blended in first during the window', () => {
  const r = mergePopular({ local: [], all: [], holiday: { id: 'thanksgiving', emoji: '🦃', dishes: ['Roast turkey', 'Stuffing', 'Pie'] } });
  assert.deepEqual(r.items.slice(0, 3).map(i => i.label), ['Roast turkey', 'Stuffing', 'Pad thai']); assert.equal(r.items[0].holiday, 'thanksgiving'); assert.equal(r.items.length, 5);
});
test('unsafe or junk names never trend', () => {
  assert.ok(okDish('Chicken tikka masala')); assert.ok(okDish('Tacos de camarón'));
  for (const b of ['x', 'http://spam.com', 'call 5551234567', 'fuck tacos']) assert.ok(!okDish(b), b);
  const r = mergePopular({ all: [row('Ramen', 9), row('Porn pie', 99), row('Pho', 9), row('Curry', 9)] }); assert.ok(!r.items.some(i => /porn/i.test(i.label)));
});
function store(rows = {}) { const calls = []; return { calls, rpc: async (fn, body) => { calls.push([fn, body]); return fn === 'snap_trend_top' ? { data: rows[body.p_country] || [] } : { data: true }; } }; }
test('trendHit hashes the device and needs a real country', async () => {
  const s = store(); const env = { __libStore: s, __libKey: 'k' };
  assert.equal(await trendHit(env, { country: 'us', kind: 'crave', label: 'Birria Tacos!', lang: 'en', device: 'dev-123456789' }), true);
  const b = s.calls[0][1]; assert.equal(b.p_country, 'US'); assert.equal(b.p_name, 'birria tacos'); assert.notEqual(b.p_device, 'dev-123456789'); assert.equal(b.p_device.length, 32);
  assert.equal(await trendHit(env, { country: '', kind: 'crave', label: 'Tacos', device: 'dev-123456789' }), false);
});
test('GET /api/trending: per country, 1 h cache header, holiday blend; POST records a made dish', async () => {
  const s = store({ MX: [row('Birria tacos', 8), row('Pozole', 6), row('Enchiladas', 3)] }); const env = { __libStore: s, __libKey: 'k' };
  const get = async q => (await onRequest({ request: new Request('http://x/api/trending?' + q), env })).json();
  const res = await onRequest({ request: new Request('http://x/api/trending?country=MX&lang=es&holiday=off'), env });
  assert.match(res.headers.get('cache-control'), /max-age=3600/); const j = await res.json(); assert.equal(j.source, 'country'); assert.equal(j.items[0].label, 'Birria tacos');
  const h = await get('country=US&lang=en&holiday=thanksgiving'); assert.equal(h.source, 'static'); assert.equal(h.items[0].holiday, 'thanksgiving'); assert.equal(h.items[0].label, 'Roast turkey');
  const p = new Request('http://x/api/trending', { method: 'POST', headers: { 'x-sc-dev': 'dev-abcdefghij' }, body: JSON.stringify({ made: 'Pozole rojo' }) }); Object.defineProperty(p, 'cf', { value: { country: 'MX' } });
  assert.equal((await onRequest({ request: p, env })).status, 204); const hit = s.calls.find(c => c[0] === 'snap_trend_hit'); assert.equal(hit[1].p_kind, 'made'); assert.equal(hit[1].p_country, 'MX');
});
