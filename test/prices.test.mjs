import test from 'node:test'; import assert from 'node:assert/strict';
import { realPrices, regionOf, sizeTo, blsPrice, krogerOn, krogerStore, krogerPrice } from '../functions/_lib/prices.js';
import BLS from '../functions/_lib/bls-prices.js';
import '../web/prices.js';
const pad = () => ({ est_cook_cost: 9, recipe: { servings: 2, ingredients: [{ item: 'Rice noodles', en: 'rice noodle', qty: '200 g' }, { item: 'Chicken breast', en: 'chicken breast', qty: '300 g' }, { item: 'Eggs', en: 'egg', qty: '2' }], missing: [{ item: 'Chicken breast', en: 'chicken breast', qty: '300 g', est_price: 6 }] } });
test('regions', () => { assert.equal(regionOf('CA'), 'W'); assert.equal(regionOf('NY'), 'NE'); assert.equal(regionOf('TX'), 'S'); assert.equal(regionOf('OH'), 'MW'); assert.equal(regionOf(''), 'US'); });
test('BLS data is real and recent', () => { assert.match(BLS.period, /20\d\d/); assert.ok(Object.keys(BLS.items).length >= 15); assert.ok(blsPrice('egg', 'W').p > 0); assert.equal(blsPrice('egg', 'W').region, blsPrice('egg', 'W').region); });
test('US pad thai uses BLS regional prices', async () => {
  const d = await realPrices({}, pad(), { cc: 'US', state: 'CA' });
  assert.equal(d.priceSrc.kind, 'regional'); assert.equal(d.priceSrc.regional, 2); assert.equal(d.priceSrc.region, 'W');
  const eggs = 2 * BLS.items.egg.p.US, chick = 0.3 * BLS.items['chicken breast'].p.W; // West has no egg series -> US
  assert.ok(Math.abs(d.est_cook_cost - (9 + eggs + chick - 2 * 0.35 - 0.3 * 9)) < 0.02);
  assert.equal(d.recipe.missing[0].priceSrc, 'regional');
});
test('non-US untouched, Kroger off without keys', async () => { const p = pad(); assert.equal(await realPrices({}, p, { cc: 'DE' }), p); assert.equal(krogerOn({}), false); });
test('size parsing', () => { assert.equal(sizeTo('16 oz', 'kg').toFixed(3), '0.454'); assert.equal(sizeTo('1 gal', 'l').toFixed(2), '3.79'); assert.equal(sizeTo('12 ct', 'ea'), 12); });
test('Kroger path with a mocked API', async () => {
  const calls = []; const env = { KROGER_CLIENT_ID: 'id', KROGER_CLIENT_SECRET: 's' };
  env.__fetch = async (u) => { calls.push(u); const j = u.includes('token') ? { access_token: 't', expires_in: 1800 } : u.includes('/locations') ? { data: [{ locationId: '70100123' }] } : { data: [{ items: [{ size: '1 lb', price: { regular: 4.99, promo: 3.99 } }] }] }; return new Response(JSON.stringify(j)); };
  assert.equal(await krogerStore(env, { zip: '45202' }), '70100123');
  assert.ok(Math.abs(await krogerPrice(env, '70100123', 'chicken breast', 'kg') - 3.99 / 0.4536) < 0.01);
  const d = await realPrices(env, pad(), { cc: 'US', state: 'OH', zip: '45202' });
  assert.equal(d.priceSrc.kind, 'store'); assert.ok(calls.some(u => u.includes('filter.locationId=70100123')));
});
test('UI label in 10 languages', () => { const ps = { store: 0, regional: 2, of: 5, region: 'W', period: 'September 2026' };
  for (const l of ['en', 'es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr']) { const s = globalThis.SC_PRICES.label(ps, l); assert.ok(s.includes('2') && s.includes('5') && s.includes('BLS'), l); assert.ok(globalThis.SC_PRICES.tag('regional', l)); } });
