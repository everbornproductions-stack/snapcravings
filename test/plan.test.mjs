import test from 'node:test';
import assert from 'node:assert/strict';
import { emojiOf, planInput, checkPlan, groceryList, inFridge, planPrompt, mealHits } from '../functions/_lib/plan.js';
import { repair } from '../functions/api/plan.js';
const M = (day, slot, name, items, steps = ['Reheat and serve.']) => ({ day, slot, name, emoji: '🍱', minutes: 15, servings: 2, ingredients: items.map(([item, aisle = 'Produce', have = false]) => ({ item, qty: '1', aisle, have })), steps, est_cook_cost: 5, keeps_days: 3 });
const week = (bad, lang) => { const out = []; for (let d = 1; d <= 7; d++) out.push(d === 3 ? bad : M(d, 'Dinner', (lang === 'es' ? 'Tazón de pollo ' : 'Chicken bowl ') + d, [[lang === 'es' ? 'muslos de pollo' : 'chicken thighs', 'Meat & Seafood'], [lang === 'es' ? 'arroz' : 'rice', 'Bakery & Grains']])); return out; };

test('free users get a 2-day preview, pro the full week', () => {
  assert.equal(planInput({ days: 7 }).genDays, 2); assert.equal(planInput({ days: 7 }, { pro: true }).genDays, 7);
  assert.equal(planInput({ days: 5, meals: 'all' }, { pro: true }).slots.length, 3);
  assert.equal(planInput({ days: 99, servings: 50 }).days, 7); assert.equal(planInput({ servings: 50 }).servings, 8);
});
test('fridge items that break the diet are dropped before prompting', () => {
  const p = planInput({ fridge: ['shrimp', 'eggs', 'spinach'], prefs: { tags: ['Shellfish allergy'] } }, { pro: true });
  assert.deepEqual(p.fridge, ['eggs', 'spinach']); assert.match(planPrompt(p), /shellfish/i);
});
for (const lang of ['en', 'es']) test(`7-day plan: shellfish allergy meal is replaced (${lang})`, async () => {
  const p = planInput({ days: 7, meals: 'dinner', prefs: { tags: ['Shellfish allergy'] } }, { pro: true });
  const shrimp = lang === 'es' ? M(3, 'Dinner', 'Tacos de camarón', [['camarón', 'Meat & Seafood'], ['tortillas de maíz', 'Bakery & Grains']]) : M(3, 'Dinner', 'Garlic shrimp pasta', [['shrimp', 'Meat & Seafood'], ['pasta', 'Pantry']]);
  const c0 = checkPlan(p, week(shrimp, lang)); assert.equal(c0.good.length, 6); assert.equal(c0.bad.length, 1); assert.deepEqual(c0.missing, [{ day: 3, slot: 'Dinner' }]);
  let calls = 0, prompts = [];
  const ask = async (env, schema, parts) => { calls++; prompts.push(parts[0].text); return calls === 1 ? { meals: [shrimp] } : { meals: [M(3, 'Dinner', lang === 'es' ? 'Tacos de pollo' : 'Lemon chicken', [[lang === 'es' ? 'pollo' : 'chicken', 'Meat & Seafood']])] }; };
  const r = await repair({}, p, week(shrimp, lang), lang, ask);
  assert.equal(r.meals.length, 7); assert.equal(r.missing.length, 0); assert.equal(calls, 2);
  assert.match(prompts[0], lang === 'es' ? /camar/ : /shrimp/); // tells the model which terms broke the rules
  if (lang === 'es') assert.match(prompts[0], /Spanish/);
  for (const m of r.meals) assert.deepEqual(mealHits(p.diet, m), [], m.name);
  assert.ok(!groceryList(r.meals, [], p.diet).some(g => g.items.some(i => /shrimp|camar/i.test(i.item))));
});
test('allergen hidden in a step is caught (nut allergy, ES)', () => {
  const p = planInput({ days: 7, prefs: { tags: ['Nut allergy'] } }, { pro: true });
  const c = checkPlan(p, [M(1, 'Dinner', 'Ensalada', [['lechuga']], ['Decora con almendras tostadas.'])]); assert.equal(c.bad.length, 1);
});
test('grocery list: merged, grouped by aisle, minus fridge and staples', () => {
  const meals = [M(1, 'Dinner', 'A', [['Chicken thighs', 'Meat & Seafood'], ['Rice', 'Bakery & Grains'], ['salt', 'Spices'], ['Spinach']]), M(2, 'Dinner', 'B', [['chicken thigh', 'Meat & Seafood'], ['Bell peppers'], ['Eggs', 'Dairy & Eggs', true]])];
  const g = groceryList(meals, ['spinach', 'rice']);
  const items = g.flatMap(x => x.items.map(i => i.item.toLowerCase()));
  assert.deepEqual(items.sort(), ['bell peppers', 'chicken thighs']);
  assert.equal(g.find(x => x.aisle === 'Meat & Seafood').items[0].meals, 2);
  assert.ok(inFridge('baby spinach', ['spinach'])); assert.ok(!inFridge('peanut butter', ['butter lettuce']));
});
test('emoji text code points are fixed', () => { assert.equal(emojiOf('1f35d'), '🍝'); assert.equal(emojiOf('U+1F35D'), '🍝'); assert.equal(emojiOf('pasta'), '🍝'); assert.equal(emojiOf('qq'), '🍽️'); assert.equal(emojiOf('🌮'), '🌮'); });
test('fitness goals: optional, targets in prompt, macros kept per meal', async () => {
  const { fitNote } = await import('../functions/_lib/plan.js');
  const reg = planInput({}); assert.equal(reg.fit, null); assert.match(planPrompt(reg), /regular people/);
  const p = planInput({ meals: 'all', fit: { goal: 'cut', kcal: 1800, p: 150, c: 150, f: 60 }, prefs: { tags: ['Shellfish allergy'] } }, { pro: true });
  assert.match(fitNote(p), /1800 kcal.*150 g protein/); assert.match(planPrompt(p), /shellfish/i);
  assert.equal(planInput({ fit: { goal: 'nope' } }).fit, null);
  const m = checkPlan(p, [{ ...M(1, 'Dinner', 'Chicken bowl', [['chicken']]), kcal: 600, protein_g: 45, carbs_g: 50, fat_g: 18 }]).good[0];
  assert.deepEqual([m.kcal, m.protein_g, m.carbs_g, m.fat_g], [600, 45, 50, 18]);
});
test('prep and storage text that mentions an allergen is dropped', async () => {
  const { cleanTexts } = await import('../functions/_lib/plan.js'); const d = planInput({ prefs: { tags: ['Shellfish allergy'] } }).diet;
  assert.deepEqual(cleanTexts(d, ['Rice keeps 4 days.', 'Cook shrimp fresh on day 2.', 'El camarón dura 1 día.']), ['Rice keeps 4 days.']);
  assert.equal(cleanTexts(d, [{ title: 'Marinate', detail: 'Toss shrimp in lime.' }], x => x.title + '. ' + x.detail).length, 0);
});
test('days off the calorie target by >10% are flagged', async () => {
  const { offDays, dayGoal } = await import('../functions/_lib/plan.js');
  const p = planInput({ meals: 'lunch_dinner', fit: { goal: 'bulk', kcal: 3000 } }, { pro: true }); assert.equal(dayGoal(p), 2250);
  const ms = [{ day: 1, kcal: 1100 }, { day: 1, kcal: 1100 }, { day: 2, kcal: 800 }, { day: 2, kcal: 900 }];
  assert.deepEqual(offDays(p, ms).map(o => o.day), [2]); assert.deepEqual(offDays(planInput({}), ms), []);
});
