// 2026-11-02: steady cook cost from ingredient price anchors, cached per dish + country; prep delivery estimate card.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { costRecipe, linePrice, amount, find, P, costKey } from '../functions/_lib/cost.js';
import { steadyCost } from '../functions/api/[[path]].js';
const padThai = (aiCost, extra = []) => ({ name: 'Pad Thai', servings: 2, ingredients: [{ item: 'rice noodles', qty: '200g' }, { item: 'shrimp', qty: '200 g' }, { item: 'eggs', qty: '2' }, { item: 'bean sprouts', qty: '1 cup' }, { item: 'fish sauce', qty: '2 tbsp' }, { item: 'peanuts', qty: '30g' }, { item: 'lime', qty: '1' }, { item: 'green onions', qty: '2' }, { item: 'tamarind paste', qty: '1 tbsp' }, ...extra], missing: [{ item: 'shrimp', qty: '200g', est_price: 9 }] });
test('anchors: lookup, quantities and local prices', () => {
  assert.equal(find('Rice Noodles')[0], 'rice noodle'); assert.equal(find('large eggs')[0], 'egg'); assert.equal(find('xyzzy root'), null);
  assert.equal(amount('200g', P.shrimp), 200); assert.equal(amount('2 tbsp', P['fish sauce']), 30); assert.equal(amount('2', P.egg), 2); assert.equal(amount('1 1/2 lb', P.beef) > 0, true);
  assert.ok(Math.abs(linePrice('shrimp', '200g', 'US') - 4) < 0.01); assert.ok(linePrice('shrimp', '200g', 'IN') < linePrice('shrimp', '200g', 'US') * 84);
  assert.ok(linePrice('shrimp', '100g', 'US', true) >= 6.8, 'store price is at least the smallest pack');
});
test('same recipe -> same cost whatever the AI guessed (only unknowns use the AI share), clamped', () => {
  const a = costRecipe(padThai(4.3), 4.3, 'US').total, b = costRecipe(padThai(10), 10, 'US').total; assert.ok(Math.abs(a - b) < 0.6, a + ' vs ' + b);
  assert.ok(a >= 3 && a <= 24, 'believable for 2 servings: ' + a);
  assert.ok(costRecipe({ servings: 2, ingredients: [{ item: 'caviar', qty: '1 kg' }] }, 900, 'US').total <= 24, 'clamped high');
  assert.ok(costRecipe({ servings: 2, ingredients: [] }, 0, 'US').total >= 3, 'clamped low');
});
test('cache: first answer is stored per dish + country, repeats return the same numbers', async () => {
  const store = new Map(); const env = { __libKey: 'k', __libStore: { rpc: async (fn, b) => { if (fn === 'snap_lib_save') { b.p_rows.forEach(r => store.set(r.craving + r.lang, r.recipe)); return { data: 1 }; } if (fn === 'snap_lib_find') { const v = store.get(b.p_craving + b.p_lang); return { data: v ? [{ recipe: v }] : [] }; } return { data: null }; } } };
  const one = await steadyCost(env, { recipe: padThai(4.3), est_cook_cost: 4.3, est_menu_price: 12 }, 'pad thai', 'US', { tags: [] }, p => p);
  await new Promise(r => setTimeout(r, 10));
  const two = await steadyCost(env, { recipe: padThai(10, [{ item: 'tofu', qty: '200g' }]), est_cook_cost: 10, est_menu_price: 20 }, 'Pad Thai', 'US', { tags: [] }, p => p);
  assert.equal(two.est_cook_cost, one.est_cook_cost); assert.equal(two.est_menu_price, one.est_menu_price); assert.equal(two.costBasis.cached, true);
  const de = await steadyCost(env, { recipe: padThai(4.3), est_cook_cost: 4.3, est_menu_price: 12 }, 'pad thai', 'DE', { tags: [] }, p => p); assert.equal(de.costBasis.cached, false, 'country is part of the key');
  assert.notEqual(await costKey('pad thai', 'US', ['vegan']), await costKey('pad thai', 'US', []));
  assert.ok(Math.abs(one.recipe.missing[0].est_price - 6.8) < 0.01, 'missing shrimp priced from the anchor pack');
});
test('meal-prep cards show the delivery ESTIMATE instead of Coming soon', () => {
  const p = fs.readFileSync(new URL('../web/prep.js', import.meta.url), 'utf8');
  assert.doesNotMatch(p, /\$\{t\('Order it out: comparison coming soon'\)\}/); assert.match(p, /M\.delivery\(M\.menuFix\(M\.menuGuess\(per, cc\), cc\), s, cc\)/); assert.match(p, /Estimate, not a quote\. Check the app\./);
});
