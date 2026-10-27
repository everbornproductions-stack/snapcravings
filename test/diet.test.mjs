import test from 'node:test';
import assert from 'node:assert/strict';
import { dietOf, bad, recipeHits, flagScan, dietPrompt } from '../functions/_lib/diet.js';
const D = (...tags) => dietOf({ tags });
const R = (name, ings, steps = ['Cook it.']) => ({ name, ingredients: ings.map(item => ({ item, qty: '1', have: true })), missing: [], steps });
const flagged = (d, ...items) => items.forEach(t => assert.equal(bad(d, t), true, 'should flag: ' + t));
const fine = (d, ...items) => items.forEach(t => assert.equal(bad(d, t), false, 'should allow: ' + t));

test('nut allergy incl. hidden sources', () => {
  const d = D('Nut allergy');
  flagged(d, 'almonds', 'Pesto', 'peanut butter', 'pine nuts', 'granola', 'Nutella', 'cashew cream', 'butternut squash and walnuts', 'Pad Thai', 'marzipan');
  fine(d, 'butternut squash', 'nutmeg', 'coconut milk', 'water chestnuts', 'nut-free pesto', 'olive oil', 'tahini');
});
test('soy allergy', () => {
  const d = D('Soy allergy');
  flagged(d, 'soy sauce', 'tofu', 'edamame', 'miso paste', 'tamari', 'teriyaki sauce', 'hoisin', 'soy milk', 'gochujang', 'tempeh');
  fine(d, 'coconut aminos', 'soy-free tamari alternative', 'chicken', 'rice vinegar', 'sesame oil');
  assert.equal(dietOf({ tags: ['Soy allergy'] }).hard, true);
});
test('shellfish allergy', () => {
  const d = D('Shellfish allergy');
  flagged(d, 'shrimp', 'Garlic Shrimp Scampi', 'oyster sauce', 'imitation crab', 'jambalaya', 'seafood mix', 'crab cakes', 'shrimp oyster mushroom stir fry');
  fine(d, 'oyster mushrooms', 'salmon fillet', 'chicken breast', 'fish sauce', 'cod');
});
test('gluten-free', () => {
  const d = D('Gluten-free');
  flagged(d, 'soy sauce', 'spaghetti', 'all-purpose flour', 'breadcrumbs', 'flour tortillas', 'teriyaki', 'Worcestershire sauce', 'beer', 'couscous', 'panko', 'pasta with rice', 'udon noodles');
  fine(d, 'gluten-free pasta', 'rice noodles', 'corn tortillas', 'rice flour', 'cornstarch', 'tamari', 'soy sauce (gluten-free)', 'potato', 'chicken', 'almond flour');
});
test('vegan and vegetarian', () => {
  const v = D('Vegan'), g = D('Vegetarian');
  flagged(v, 'chicken stock', 'Worcestershire sauce', 'honey', 'mayonnaise', 'parmesan', 'butter', 'eggs', 'fish sauce', 'Caesar dressing', 'cheese and rice', 'bacon', 'gelatin', 'beef broth', 'milk', 'chicken & mushroom pie');
  fine(v, 'vegan butter', 'oat milk', 'coconut cream', 'vegetable broth', 'mushroom stock', 'tofu', 'peanut butter', 'maple syrup', 'agave', 'cashew cheese', 'eggplant', 'vegan mayo', 'nutritional yeast', 'oyster mushrooms', 'cauliflower steak');
  flagged(g, 'chicken', 'anchovies', 'fish sauce', 'oyster sauce', 'beef stock', 'gelatin', 'kimchi', 'bacon', 'salmon');
  fine(g, 'cheese', 'eggs', 'butter', 'milk', 'vegetable broth', 'honey', 'tofu', 'vegan kimchi');
});
test('dairy-free and egg-free', () => {
  const d = D('Dairy-free'), e = D('Egg-free');
  flagged(d, 'butter', 'cheddar cheese', 'sour cream', 'ghee', 'whey protein', 'cheese rice bake', 'ice cream', 'caramel', 'ranch dressing');
  fine(d, 'coconut milk', 'almond milk', 'dairy-free cheese', 'cream of tartar', 'peanut butter', 'butternut squash', 'olive oil', 'cocoa butter', 'oat cream');
  flagged(e, 'eggs', 'mayonnaise', 'egg yolks', 'pancakes', 'brioche buns', 'aioli', 'hollandaise');
  fine(e, 'eggplant', 'egg-free mayo', 'flax egg', 'crab cakes' && 'rice cakes');
});
test('keto', () => {
  const d = D('Keto/low-carb');
  flagged(d, 'rice', 'pasta', 'potatoes', 'sugar', 'honey', 'bread', 'black beans', 'ketchup', 'banana', 'oats', 'tortillas', 'teriyaki sauce', 'sweet potato', 'corn');
  fine(d, 'cauliflower rice', 'zucchini noodles', 'almond flour', 'chicken thighs', 'avocado', 'butter', 'cheddar', 'spinach', 'green beans', 'rice vinegar', 'shirataki noodles', 'sugar-free syrup', 'lemon juice', 'eggs');
});
test('halal', () => {
  const d = D('Halal');
  flagged(d, 'pork chops', 'bacon', 'white wine', 'mirin', 'beer', 'gelatin', 'sausage', 'pepperoni', 'rum', 'cooking wine');
  fine(d, 'halal chicken', 'chicken sausage', 'rice vinegar', 'red wine vinegar', 'lamb', 'beef', 'non-alcoholic vanilla');
});
test('other foods (plain list or phrases)', () => {
  const d = dietOf({ other: 'sesame, Cilantro; no olives and allergic to kiwi' });
  assert.deepEqual(d.terms.sort(), ['cilantro', 'kiwi', 'olives', 'sesame']);
  flagged(d, 'sesame oil', 'fresh cilantro', 'Kalamata olives', 'kiwis', 'sesame seeds');
  fine(d, 'chicken', 'olive oil'.replace('olive', 'canola'), 'sesame-free crackers');
  assert.equal(dietOf({ other: 'allergies' }).hard, false);
});
test('recipe check covers steps (optional garnish) and missing items', () => {
  const d = D('Nut allergy', 'Vegan');
  const r = R('Veggie bowl', ['rice', 'broccoli'], ['Cook rice.', 'Top with chopped almonds if you like.', 'Serve.']);
  assert.ok(recipeHits(d, r).includes('almonds'));
  assert.equal(recipeHits(d, R('Veggie bowl', ['rice', 'broccoli'], ['Cook the rice.', 'Skip the cheese.', 'Swap the butter for olive oil.'])).length, 0);
  const m = { ...R('x', ['rice']), missing: [{ item: 'parmesan', qty: '1', est_price: 3 }] };
  assert.ok(recipeHits(d, m).includes('parmesan'));
  assert.equal(recipeHits(D('Vegetarian'), R('Soup', ['onion'], ['Heat a stock pot over medium heat.', 'Mince the garlic.', 'Add vegetable broth.'])).length, 0);
  assert.equal(recipeHits(D('Gluten-free'), R('Bowl', ['rice'], ['Roll the meat in cornstarch.', 'Wrap in foil.'])).length, 0);
});
test('scan flags conflicting items; no diet means no flags; prompt names every tag', () => {
  const out = flagScan({ ingredients: [{ name: 'Soy sauce' }, { name: 'Milk' }, { name: 'Carrots' }] }, D('Soy allergy', 'Vegan'));
  assert.deepEqual(out.ingredients.map(i => !!i.conflict), [true, true, false]);
  assert.equal(flagScan({ ingredients: [{ name: 'Milk' }] }, dietOf({})).ingredients[0].conflict, undefined);
  for (const t of ['Soy allergy', 'Nut allergy', 'Shellfish allergy', 'Keto/low-carb', 'Halal', 'Vegan']) assert.match(dietPrompt(D(t)), new RegExp(t.split('/')[0].toUpperCase().replace(' ALLERGY', ' ALLERGY')));
});
test('dish-style words are fine in a recipe name when ingredients are clean', () => {
  const d = D('Shellfish allergy');
  assert.equal(recipeHits(d, R('Chicken Scampi', ['chicken', 'garlic', 'lemon'])).length, 0);
  assert.ok(recipeHits(d, R('Chicken Scampi', ['chicken', 'shrimp'])).includes('shrimp'));
  assert.ok(recipeHits(D('Soy allergy'), R('Teriyaki Chicken', ['chicken', 'soy sauce'])).length > 0);
});
