// 2026-11-02 features: low-carb / diabetic-friendly diets, household size, early holiday planning (per country), tablet grid, strings.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { dietOf, dietPrompt, recipeHits, bad, DIET_TAGS } from '../functions/_lib/diet.js';
import '../web/holiday.js';
import { hpInput } from '../functions/_lib/hplan.js';
import { planInput } from '../functions/_lib/plan.js';
const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const S = globalThis.SC_HOLIDAY;

test('new diet tags exist on server and client', () => {
  for (const t of ['Low-carb', 'Diabetic-friendly']) { assert.ok(DIET_TAGS.includes(t)); assert.match(rd('web/app.js'), new RegExp("'" + t + "'")); }
});
test('diabetic-friendly: no sugary drinks or added sugar; lemon juice, sugar-free and snap peas are fine', () => {
  const d = dietOf({ tags: ['Diabetic-friendly'] });
  for (const x of ['orange juice', 'cola', 'sweet tea', 'brown sugar', 'maple syrup', 'honey', 'refresco de cola', 'jugo de naranja']) assert.ok(bad(d, x), x);
  for (const x of ['lemon juice', 'juice of 1 lime', 'sugar-free syrup', 'unsweetened almond milk', 'sugar snap peas', 'jugo de limón', 'chicken breast']) assert.ok(!bad(d, x), x);
  assert.deepEqual(recipeHits(d, { name: 'Lemon chicken', ingredients: [{ item: 'chicken' }, { item: 'lemon juice' }], steps: ['Squeeze the lemon juice over the chicken.'] }), []);
  assert.ok(recipeHits(d, { name: 'Chicken plate', ingredients: [{ item: 'chicken' }], steps: ['Serve with a glass of orange juice.'] }).length);
  const p = dietPrompt(d); assert.match(p, /DIABETIC-FRIENDLY/); assert.match(p, /low-glycemic|low glycemic/i); assert.match(p, /sugary drinks/i); assert.match(p, /fewest carbs per serving first/);
});
test('low-carb is moderate (30 g), keto stays strict; both rank by carbs', () => {
  const p = dietPrompt(dietOf({ tags: ['Low-carb'] })); assert.match(p, /30 g carbs/); assert.doesNotMatch(p, /10 g net carbs/); assert.match(p, /Rank by carbs/);
  assert.ok(bad(dietOf({ tags: ['Low-carb'] }), 'soda')); assert.ok(!bad(dietOf({ tags: ['Low-carb'] }), 'brown rice'));
});
test('household size: prompt asks for that many servings; solo gets cook once, eat twice; planners keep their own setting', () => {
  assert.equal(dietOf({ serves: 1 }).serves, 1); assert.equal(dietOf({ serves: 99 }).serves, 12); assert.equal(dietOf({ serves: 'x' }).serves, 0); assert.equal(dietOf({}).serves, 0);
  assert.match(dietPrompt(dietOf({ serves: 1 })), /ONE person.*servings = 1.*cook once, eat twice/s);
  assert.match(dietPrompt(dietOf({ serves: 4 })), /servings = 4/);
  assert.equal(dietPrompt(dietOf({})), '');
  assert.doesNotMatch(dietPrompt(planInput({ servings: 3, prefs: { serves: 1 } }).diet), /HOUSEHOLD/);
  assert.doesNotMatch(dietPrompt(hpInput({ holiday: 'thanksgiving', prefs: { serves: 1 } }).diet), /HOUSEHOLD/);
  assert.equal(hpInput({ holiday: 'thanksgiving', guests: 1 }).guests, 1);
});
test('holiday planner works any time with the country\'s own holidays only', () => {
  const day = new Date(2026, 10, 2);
  for (const c of ['US', 'IN', 'SA', 'BR', 'MX', 'DE', 'ID', 'TR', 'RU', 'FR']) {
    const u = S.upcoming(day, c); assert.ok(u.length >= 2, c); const own = S.setFor(c);
    assert.ok(u.every(x => own.includes(x.id)), c); assert.ok(u.every((x, i) => !i || u[i - 1].day <= x.day), c + ' sorted');
    assert.ok(u.every(x => x.end >= day), c + ' upcoming');
  }
  const us = S.upcoming(day, 'US').map(x => x.id); assert.equal(us[0], 'thanksgiving'); assert.ok(!us.includes('diwali'));
  assert.ok(S.upcoming(day, 'US').find(x => x.id === 'thanksgiving').open === false); // theme window still ~1 week before
  assert.ok(S.upcoming(day, 'IN').find(x => x.id === 'diwali').open === true);
  assert.equal(hpInput({ holiday: 'diwali', country: 'US' }).holiday, null);
  assert.equal(hpInput({ holiday: 'diwali', country: 'IN' }).holiday, 'diwali');
  assert.equal(hpInput({ holiday: 'thanksgiving', country: 'US' }).holiday, 'thanksgiving');
});
// feat.js in a tiny fake browser.
function loadFeat() {
  const ls = {}; const ctx = { console, setTimeout, Set, Math, Number, String, Object, JSON };
  Object.assign(ctx, { window: ctx, globalThis: ctx, I18N: { t: (s, v) => { let o = s; if (v) for (const k in v) o = o.split('{' + k + '}').join(v[k]); return o; }, load: (l, cb) => cb(), ES: {}, D: {}, lang: 'en' },
    LS: { get: (k, d) => k in ls ? ls[k] : d, set: (k, v) => { ls[k] = v; } }, el: () => null, esc: s => String(s), document: { addEventListener() {}, querySelector: () => null, getElementById: () => null }, RENDER: {}, state: {}, location: { hash: '' }, diet: { tags: ['Diabetic-friendly'], other: '', mood: '' } });
  vm.createContext(ctx); vm.runInContext(rd('web/feat-i18n.js'), ctx); vm.runInContext(rd('web/feat.js'), ctx); return { ctx, ls };
}
test('recipes scale to the household (fractions, grams, no number)', () => {
  const { ctx } = loadFeat(); const q = ctx.scaleQty;
  assert.equal(q('2 cups', 0.5), '1 cups'); assert.equal(q('1 1/2 cups rice', 0.5), '3/4 cups rice'); assert.equal(q('400 g', 0.25), '100 g'); assert.equal(q('½ tsp', 2), '1 tsp'); assert.equal(q('to taste', 0.5), 'to taste'); assert.equal(q('3', 1 / 3), '1');
  const r = ctx.scaleRecipe({ name: 'x', servings: 4, ingredients: [{ item: 'eggs', qty: '4' }], missing: [{ item: 'milk', qty: '2 cups' }] }, 1);
  assert.equal(r.servings, 1); assert.equal(r._from, 4); assert.equal(r.ingredients[0].qty, '1'); assert.equal(r.missing[0].qty, '1/2 cups');
  assert.equal(ctx.scaleRecipe(r, 2), r, 'never scales twice');
  assert.match(ctx.dietBadge(), /Diabetic-friendly/);
});
test('every new string is translated in all 9 languages with placeholders intact', () => {
  const ctx = {}; ctx.globalThis = ctx; vm.runInNewContext(rd('web/feat-i18n.js') + rd('web/hplan-i18n.js'), ctx);
  const F = ctx.FEAT_I18N, H = ctx.HP_I18N; const keys = new Set();
  for (const f of ['web/feat.js', 'web/hplan.js']) for (const m of rd(f).matchAll(/\bT\((['"])((?:(?!\1).)+)\1/g)) keys.add(m[2].replace(/\\'/g, "'"));
  for (const l of ['es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr']) for (const k of keys) {
    const v = (H[l] || {})[k] || (F[l] || {})[k]; const main = l === 'es' ? null : rd('web/i18n/' + l + '.js');
    assert.ok(v || (main && main.includes(JSON.stringify(k))) || (l === 'es' && rd('web/i18n.js').includes("'" + k.replace(/'/g, "\\'") + "'")), l + ': ' + k);
    if (v) for (const p of k.match(/\{\w+\}/g) || []) assert.ok(v.includes(p), l + ' placeholder ' + p + ' in ' + k);
  }
  for (const l of ['es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr']) for (const k of ['Low-carb', 'Diabetic-friendly']) assert.ok(F[l][k], l + ' ' + k);
});
test('tablet grid at 768px+ on touch/app; feat.js loads after fixes.js and is cached offline', () => {
  const h = rd('web/index.html'); assert.match(h, /@media \(min-width:768px\) and \(pointer:coarse\),\(min-width:768px\) and \(display-mode:standalone\)\{[^\n]*\n#home\.active,#recipesBody,#favsBody,\.pdays\{display:grid;grid-template-columns:repeat\(2/);
  assert.ok(h.indexOf('src="feat.js') > h.indexOf('src="fixes.js')); assert.ok(h.indexOf('src="feat-i18n.js') < h.indexOf('src="feat.js'));
  const sw = rd('web/sw.js'); assert.match(sw, /feat\.js/); assert.match(sw, /feat-i18n\.js/);
});
