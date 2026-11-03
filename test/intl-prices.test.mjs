import test from 'node:test'; import assert from 'node:assert/strict';
import '../web/money.js';
import INTL from '../functions/_lib/intl-prices.js';
import { P, linePrice, localPrice, costRecipe } from '../functions/_lib/cost.js';
test('country data is real, tagged and in the local currency', () => {
  for (const [cc, c] of Object.entries(INTL.c)) { assert.equal(c.cur, globalThis.SC_MONEY.of(cc).c, cc);
    for (const [k, it] of Object.entries(c.i)) { assert.ok(P[k], k); assert.equal(it.u, P[k][1]); assert.ok(it.p > 0 && it.n >= 3 && INTL.sources[it.src], cc + ' ' + k); } }
  assert.ok(Object.keys(INTL.c.GB.i).length >= 20); assert.ok(Object.keys(INTL.c.BR.i).length >= 8); assert.ok(Object.keys(INTL.c.DE.i).length >= 5);
});
test('lookup: country data first, then the scaled US table', () => {
  const t = INTL.c.GB.i.tomato.p; assert.ok(Math.abs(linePrice('tomatoes', '500 g', 'GB') - t * 0.5) < 1e-9);
  const k = globalThis.SC_MONEY.of('GB'); assert.ok(Math.abs(linePrice('rice noodles', '200 g', 'GB') - P['rice noodle'][0] * 0.2 * k.fx * k.g) < 1e-9);
  assert.equal(localPrice('tomato', 'US'), null); assert.equal(localPrice('tomato', 'ZZ'), null);
  const mx = globalThis.SC_MONEY.of('MX'); assert.equal(mx.c, 'MXN'); assert.ok(Math.abs(linePrice('rice', '1 kg', 'MX') - (localPrice('rice', 'MX')?.p ?? P.rice[0] * mx.fx * mx.g)) < 1e-9);
  const r = costRecipe({ servings: 2, ingredients: [{ item: 'Kartoffeln', en: 'potato', qty: '500 g' }, { item: 'Tomaten', en: 'tomato', qty: '300 g' }, { item: 'Reis', en: 'rice', qty: '200 g' }] }, 5, 'DE');
  assert.equal(r.known, 3); assert.equal(r.local, INTL.c.DE.i.potato ? 2 : 1);
});
