import test from 'node:test';
import assert from 'node:assert/strict';
import { dietOf, bad, recipeHits } from '../functions/_lib/diet.js';
import { recipeEmoji } from '../functions/_lib/emoji.js';
const R = (name, ings) => ({ name, ingredients: ings.map(item => ({ item, qty: '1', have: true })), missing: [], steps: ['Cook it.'] });
for (const tag of ['Diabetic-friendly', 'Low-carb']) test(tag + ' blocks starchy staples unless a low-carb swap', () => {
  const d = dietOf({ tags: [tag] });
  for (const t of ['all-purpose flour', 'flour pancakes', 'spaghetti', 'white rice', 'jasmine rice', 'bread', 'flour tortillas', 'harina', 'arroz blanco', 'pan blanco']) assert.equal(bad(d, t), true, t);
  for (const t of ['almond flour', 'coconut flour', 'cauliflower rice', 'zucchini noodles', 'low-carb tortillas', 'brown rice', 'rice vinegar', 'chicken breast', 'arroz de coliflor', 'nonstick pan', 'sheet pan']) assert.equal(bad(d, t), false, t);
  assert.ok(recipeHits(d, R('Fluffy Pancakes', ['flour', 'eggs', 'milk'])).length);
  assert.deepEqual(recipeHits(d, R('Almond Flour Pancakes', ['almond flour', 'eggs', 'milk'])), []);
});
test('recipe icon validation', () => {
  assert.equal(recipeEmoji('peppers'), '🌶️');
  assert.equal(recipeEmoji('🥗'), '🥗');
  assert.equal(recipeEmoji('1f35d'), '🍝');
  assert.equal(recipeEmoji('xyz'), '🍽️');
  assert.equal(recipeEmoji('', 'Chicken Tacos'), '🌮');
  assert.equal(recipeEmoji(undefined), '🍽️');
});
