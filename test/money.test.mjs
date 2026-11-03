// 2026-11-02 features A+B: local currency + realistic local prices, delivery ESTIMATE range in Crave it.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import '../web/money.js';
import { planInput, planPrompt } from '../functions/_lib/plan.js';
import { locRecipe } from '../functions/api/[[path]].js';
const M = globalThis.SC_MONEY; const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('country -> currency, formatting per locale, no cents for INR', () => {
  assert.equal(M.cur('US'), 'USD'); assert.equal(M.cur('DE'), 'EUR'); assert.equal(M.cur('BR'), 'BRL'); assert.equal(M.cur('IN'), 'INR'); assert.equal(M.cur('zz'), 'USD');
  assert.match(M.fmt(12.5, 'EUR', 'de'), /12,50\s?€/); assert.match(M.fmt(12.5, 'BRL', 'pt'), /R\$\s?12,50/); assert.equal(M.fmt(1234, 'INR', 'en'), '₹1,234'); assert.equal(M.fmt(3, 'USD', 'en'), '$3.00');
});
test('prompt names the country, currency and a local price anchor', () => {
  const n = M.note('DE'); assert.match(n, /Germany/); assert.match(n, /EUR/); assert.match(n, /not US prices converted/); assert.match(n, /1 kg chicken breast costs about 11 EUR/);
  const p = planInput({ days: 5, budget: 5000, country: 'IN' }, { pro: true }); assert.equal(p.cur, 'INR'); assert.equal(p.budget, 5000);
  const t = planPrompt(p); assert.match(t, /about 5000 INR/); assert.match(t, /India/); assert.doesNotMatch(t, /USD/);
});
test('delivery estimate: range, local money, sane vs home cost (DE schnitzel)', () => {
  const d = M.delivery(15, 2, 'DE'); assert.equal(d.c, 'EUR'); assert.ok(d.lo > 30 && d.hi < 60 && d.lo < d.hi, JSON.stringify(d));
  const u = M.delivery(16, 2, 'US'); assert.ok(u.lo > 30 && u.hi < 75); assert.equal(M.delivery(0, 2, 'US'), null);
  assert.ok(M.menuGuess(1, 'DE') >= 6, 'cheap home cost still gives a real local menu price');
  assert.ok(M.fromUS(5, 'IN') > 50 && M.fromUS(5, 'IN') < 200); assert.ok(Math.abs(M.toUS(M.fromUS(10, 'BR'), 'BR') - 10) < 0.2);
});
test('library recipes convert US-equivalent prices to the reader currency and back', () => {
  const r = { name: 'x', missing: [{ item: 'cheese', est_price: 4 }] };
  assert.ok(locRecipe(r, 'IN', M.fromUS).missing[0].est_price > 40); assert.equal(locRecipe(r, 'US', M.fromUS).missing[0].est_price, 4);
});
test('crave UI: estimate card replaces Coming soon, labelled, with savings verdict; no fake app prices', () => {
  const a = rd('web/app.js'); assert.doesNotMatch(a, /\['DoorDash', '#EB1700'\]/); assert.doesNotMatch(a, /Live all-in prices/);
  assert.match(a, /Estimate, not a quote\. Check the app\./); assert.match(a, /Delivery usually ~\{lo\}-\{hi\} with fees/); assert.match(a, /Cooking saves about \{s\} vs delivery \(estimate\)/);
  assert.doesNotMatch(rd('web/prep.js').split('\n').filter(l => !/': '/.test(l)).join('\n'), /We never invent restaurant prices/);
  const s = rd('functions/api/[[path]].js'); assert.match(s, /est_menu_price/); assert.doesNotMatch(s, /rough US grocery price estimate in USD/); assert.match(s, /recipeKey\(\{ ing, craving, section, lang: lang \+ ':' \+ CUR/);
  assert.match(rd('web/index.html'), /money\.js\?v=/); assert.match(rd('web/sw.js'), /money\.js\?v=/);
});
test('new money copy translated in all 9 languages with placeholders kept', () => {
  const fix = JSON.parse(rd('web/fixes.js').match(/globalThis\.FIX_I18N = (\{.*?\});\n/s)[1]);
  for (const k of ['Budget in {cur}, like {n}', 'Order it delivered', 'Estimate, not a quote. Check the app.', 'Delivery usually ~{lo}-{hi} with fees', 'Cooking saves about {s} vs delivery (estimate).', 'Costs are AI estimates of local grocery prices, not quotes.'])
    for (const l of ['es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr']) { assert.ok(fix[l][k], l + k); (k.match(/\{\w+\}/g) || []).forEach(p => assert.ok(fix[l][k].includes(p), l + p)); }
});
