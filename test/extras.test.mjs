import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRecipe, filterLibrary, collectionsFor, recipeKey } from '../functions/_lib/extras.js';
import { dietOf } from '../functions/_lib/diet.js';
const R = (name, items, extra = {}) => ({ recipe: cleanRecipe({ name, emoji: '🍳', minutes: 20, servings: 2, level: 'Easy', ingredients: items.map(item => ({ item, qty: '1', have: true })), missing: [], steps: ['Cook.'], ...extra }), up: 3, down: 0 });
const LIB = [R('Shrimp tacos', ['shrimp', 'corn tortillas']), R('Tacos de camarón', ['camarón', 'tortillas de maíz']), R('Chicken tacos', ['chicken', 'corn tortillas'], { minutes: 12, kcal: 450, protein_g: 40 }), R('Pad thai', ['rice noodles', 'peanuts']), R('Bean chili', ['beans', 'tomato'], { level: 'Medium' })];
test('library hides recipes that break the diet (EN + ES)', () => {
  const names = filterLibrary(LIB, dietOf({ tags: ['Shellfish allergy', 'Nut allergy'] })).map(x => x.recipe.name);
  assert.deepEqual(names, ['Chicken tacos', 'Bean chili']);
  assert.equal(filterLibrary(LIB, dietOf({})).length, 5);
});
test('library search and filters', () => {
  const d = dietOf({});
  assert.deepEqual(filterLibrary(LIB, d, { q: 'TACOS' }).length, 3); assert.equal(filterLibrary(LIB, d, { q: 'camaron' }).length, 1);
  assert.deepEqual(filterLibrary(LIB, d, { quick: true }).map(x => x.recipe.name), ['Chicken tacos']);
  assert.deepEqual(filterLibrary(LIB, d, { minProtein: 30 }).map(x => x.recipe.name), ['Chicken tacos']);
  assert.deepEqual(filterLibrary(LIB, d, { level: 'Medium' }).map(x => x.recipe.name), ['Bean chili']);
});
test('cleanRecipe trims junk and rejects empty', () => {
  assert.equal(cleanRecipe({}), null); const r = cleanRecipe({ name: 'X', emoji: 'pizza', minutes: 9999, evil: 1, steps: ['a'] });
  assert.equal(r.emoji, '🍕'); assert.equal(r.minutes, 600); assert.equal(r.evil, undefined);
  assert.equal(recipeKey({ name: 'Tacos  Ñ', ingredients: [{ item: 'Chicken' }] }), 'tacos n|chicken');
});
test('seasonal collections', () => {
  const nov = collectionsFor(new Date('2026-11-15')).map(c => c.key); assert.ok(nov.includes('thanksgiving') && nov.includes('gameday') && nov.includes('weeknight'));
  assert.ok(collectionsFor(new Date('2026-07-01')).some(c => c.key === 'grill')); assert.ok(collectionsFor().every(c => c.es && c.name && c.emoji));
});
