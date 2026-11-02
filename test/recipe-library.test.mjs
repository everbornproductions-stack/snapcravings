// Shared recipe library: normalization, matching rules, quality guard, and the /api/recipes flow (library first, AI for the rest).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normIngredient, isStaple, covers, matchOne, pick, validRecipe, requiredOf } from '../functions/_lib/recipelib.js';
import { dietOf } from '../functions/_lib/diet.js';
const { onRequest } = await import('../functions/api/[[path]].js');

const R = (name, items, level = 'Easy', extra = {}) => ({ name, emoji: '🍳', minutes: 15, servings: 2, level, ingredients: items.map(i => ({ item: i, qty: '1', have: true })), missing: [], steps: ['Heat the pan over medium heat.', 'Cook everything for 5 minutes, then serve.'], kcal: 400, protein_g: 20, carbs_g: 30, fat_g: 12, ...extra });
const E = (r, o = {}) => ({ id: r.name, r, req: requiredOf(r), tags: [], pk: '', created: new Date().toISOString(), up: 0, down: 0, ...o });
const none = dietOf({});

test('normalize: lowercase, singular, synonyms, quantities and descriptors dropped', () => {
  assert.equal(normIngredient('Chicken breasts (2)'), 'chicken');
  assert.equal(normIngredient('2 cloves garlic, minced'), 'garlic');
  assert.equal(normIngredient('Tomatoes'), 'tomato');
  assert.equal(normIngredient('Scallions'), 'green onion');
  assert.equal(normIngredient('Huevos'), 'egg');
  assert.equal(normIngredient('[spice] Smoked paprika'), 'smoked paprika');
  for (const s of ['Salt', 'extra virgin olive oil', 'water', 'Black pepper', 'aceite']) assert.ok(isStaple(normIngredient(s)), s);
  assert.ok(!isStaple(normIngredient('sesame oil')));
});
test('covers: subset rules avoid false matches', () => {
  const u = new Set(['chicken', 'rice', 'cheddar cheese']);
  assert.ok(covers(u, 'chicken')); assert.ok(covers(u, 'cheese')); assert.ok(!covers(u, 'rice vinegar')); assert.ok(!covers(u, 'soy sauce'));
});
test('matchOne: ready needs full coverage, more allows 80% and at most 2 missing', () => {
  const u = new Set(['egg', 'spinach', 'feta cheese', 'onion', 'tomato']);
  assert.ok(matchOne(u, ['egg', 'spinach', 'feta cheese'], 'ready'));
  assert.equal(matchOne(u, ['egg', 'spinach', 'mushroom'], 'ready'), null);
  assert.ok(matchOne(u, ['egg', 'spinach', 'onion', 'tomato', 'mushroom'], 'more')); // 80%, 1 missing
  assert.equal(matchOne(u, ['egg', 'spinach', 'mushroom', 'bacon'], 'more'), null); // 50%
});
test('pick: diet, prefs, rating and variety', () => {
  const ing = ['Eggs', 'Spinach', 'Feta', 'Onion', 'Shrimp', 'Rice'];
  const c = [E(R('Spinach omelette', ['eggs', 'spinach', 'feta', 'salt'])), E(R('Shrimp fried rice', ['shrimp', 'rice', 'eggs', 'onion'], 'Medium')),
    E(R('Onion rice', ['onion', 'rice']), { pk: 'abc' }), E(R('Bad eggs', ['eggs', 'onion']), { down: 5 }), E(R('Bacon eggs', ['eggs', 'bacon']))];
  const all = pick(c, { ing, section: 'ready', diet: none, want: 5 }).map(x => x.recipe.name).sort();
  assert.deepEqual(all, ['Shrimp fried rice', 'Spinach omelette']); // pref mismatch, thumbs-down and uncovered bacon are out
  const shell = pick(c, { ing, section: 'ready', diet: dietOf({ tags: ['Shellfish allergy'] }), want: 5 });
  assert.equal(shell.length, 0); // stored without that diet tag -> never served to a diet user
  const tagged = [E(R('Spinach omelette', ['eggs', 'spinach', 'feta'])), E(R('Shrimp fried rice', ['shrimp', 'rice', 'eggs']))].map(e => ({ ...e, tags: ['Shellfish allergy'] }));
  assert.deepEqual(pick(tagged, { ing, section: 'ready', diet: dietOf({ tags: ['Shellfish allergy'] }) }).map(x => x.recipe.name), ['Spinach omelette']); // safety net still runs
  const many = Array.from({ length: 20 }, (_, i) => E(R('Egg dish ' + i, ['eggs', 'spinach'])));
  const sets = new Set(Array.from({ length: 8 }, () => pick(many, { ing, section: 'ready', diet: none, want: 5 }).map(x => x.id).sort().join()));
  assert.ok(sets.size > 1, 'rotates');
});
test('pick (more): uncovered items move to missing, have flags follow the user', () => {
  const r = R('Spinach mushroom frittata', ['eggs', 'spinach', 'onion', 'feta', 'mushrooms'], 'Medium');
  const [x] = pick([E(r)], { ing: ['Eggs', 'Spinach', 'Onion', 'Feta'], section: 'more', diet: none });
  assert.ok(x); assert.equal(x.recipe.ingredients.find(i => i.item === 'mushrooms').have, false); assert.ok(x.recipe.missing.some(m => m.item === 'mushrooms'));
});
test('validRecipe: rejects bad shape, personal data, wrong section/diet', () => {
  assert.ok(validRecipe(R('Spinach omelette', ['eggs', 'spinach']), { section: 'ready', diet: none, lang: 'en' }));
  assert.equal(validRecipe({ name: 'x' }, {}), null);
  assert.equal(validRecipe(R('Call 555-123-4567 omelette', ['eggs', 'spinach']), { section: 'ready', diet: none }), null);
  assert.equal(validRecipe(R('Omelette', ['eggs', 'spinach'], 'Easy', { steps: ['Email me at a@b.com for more.', 'Cook the eggs well.'] }), {}), null);
  assert.equal(validRecipe(R('Omelette', ['eggs', 'spinach'], 'Easy', { missing: [{ item: 'ham', qty: '1', est_price: 3 }] }), { section: 'ready' }), null);
  assert.equal(validRecipe(R('Shrimp rice', ['shrimp', 'rice']), { section: 'ready', diet: dietOf({ tags: ['Shellfish allergy'] }) }), null);
  assert.ok(validRecipe(R('Bake at 400 degrees chicken', ['chicken', 'rice'], 'Easy', { steps: ['Bake at 400 degrees F for 25 minutes.', 'Rest 5 minutes and serve.'] }), { section: 'ready' }));
});

// ---------- integration: in-memory store standing in for the Supabase RPCs ----------
function memStore() {
  const rows = [], metrics = { lib: 0, ai: 0, req: 0 };
  return { rows, metrics, async rpc(fn, b) {
    if (fn === 'snap_lib_find') return { data: rows.filter(r => r.lang === b.p_lang && r.section === b.p_section && r.craving === b.p_craving && r.ings.some(i => b.p_ings.includes(i))).map(r => ({ ...r, created: new Date().toISOString(), up: 0, down: 0 })) };
    if (fn === 'snap_lib_save') { let n = 0; for (const x of b.p_rows) if (!rows.some(r => r.id === x.id)) { rows.push(x); n++; } return { data: n }; }
    if (fn === 'snap_lib_served') { metrics.lib += b.p_lib; metrics.ai += b.p_ai; metrics.req++; return { data: true }; }
    if (fn === 'snap_lib_stats') return { data: { recipes: rows.length, last7: { ...metrics, share_library: metrics.lib / Math.max(1, metrics.lib + metrics.ai) } } };
    return { missing: true };
  } };
}
const ING = ['Eggs', 'Spinach', 'Feta', 'Onion', 'Rice', 'Chicken', 'Tomatoes'];
const AI5 = (tag) => ({ recipes: [R(tag + ' omelette', ['eggs', 'spinach', 'feta']), R(tag + ' chicken rice', ['chicken', 'rice', 'onion'], 'Medium'), R(tag + ' shakshuka', ['eggs', 'tomatoes', 'onion'], 'Chef mode'), R(tag + ' egg fried rice', ['eggs', 'rice', 'onion']), R(tag + ' tomato rice', ['rice', 'tomatoes'], 'Medium')] });
const gem = o => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] }));
const req = body => new Request('http://localhost/api/recipes', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.' + Math.floor(Math.random() * 200) }, body: JSON.stringify({ ingredients: ING, craving: 'Anything', section: 'ready', nocache: true, ...body }) });
const flush = [];
const call = (env, body) => onRequest({ request: req(body), env, params: { path: ['recipes'] }, waitUntil: p => flush.push(p) });
const settle = async () => { await Promise.all(flush.splice(0)); };

test('integration: AI answer is saved, the next request is served from the library with no AI call', async () => {
  const store = memStore(); let aiCalls = 0; const env = { GEMINI_API_KEY: 'x', __libStore: store, __fetch: async () => { aiCalls++; return gem(AI5('A')); } };
  let j = await (await call(env, {})).json();
  assert.equal(j.recipes.length, 5); assert.equal(j.usage.library.ai, 5); assert.equal(j.usage.library.served, 0); await settle();
  assert.equal(store.rows.length, 5); assert.ok(store.rows.every(r => !JSON.stringify(r).includes('Tomatoes'.toUpperCase())));
  const t = Date.now(); j = await (await call(env, {})).json();
  assert.equal(aiCalls, 1, 'no second AI call'); assert.equal(j.usage.provider, 'library'); assert.equal(j.recipes.length, 5); assert.equal(j.usage.library.served, 5);
  assert.ok(Date.now() - t < 200); assert.deepEqual(Object.keys(j).sort(), ['craving', 'recipes', 'usage']); assert.ok(j.recipes.every(r => !('__lib' in r)));
  await settle(); assert.deepEqual([store.metrics.lib, store.metrics.ai], [5, 5]);
  const h = await (await onRequest({ request: new Request('http://localhost/api/health'), env, params: { path: ['health'] } })).json();
  assert.equal(h.library.last7.share_library, 0.5);
});
test('integration: streaming sends library cards first, then AI fills the rest; other languages and "more ideas" go to AI', async () => {
  const store = memStore(); let aiCalls = 0; const env = { GEMINI_API_KEY: 'x', __libStore: store, __fetch: async (u) => { aiCalls++; return u.includes('stream') ? new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(AI5('B')) }] } }] }) + '\n\n')); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } }) : gem(AI5('B')); } };
  store.rows.push(...(await Promise.all(AI5('Lib').recipes.slice(0, 2).map(async r => ({ id: r.name.replace(/\W/g, '').toLowerCase().padEnd(16, '0').slice(0, 16), lang: 'en', section: 'ready', craving: 'anything', diet_tags: [], pref_key: '', level: r.level, recipe: r, ings: requiredOf(r) })))));
  const L = (await (await call(env, { stream: true })).text()).trim().split('\n').map(l => JSON.parse(l));
  const names = L.filter(l => l.recipe).map(l => l.recipe.name);
  assert.deepEqual(names.slice(0, 2).sort(), ['Lib chicken rice', 'Lib omelette']); assert.ok(names.length >= 5); assert.equal(aiCalls, 1);
  const done = L.at(-1); assert.equal(done.done, true); assert.equal(done.usage.library.served, 2); assert.ok(done.usage.library.ai >= 3);
  aiCalls = 0; await call(env, { lang: 'es' }).then(r => r.json()); assert.equal(aiCalls, 1, 'es never gets English library recipes');
  aiCalls = 0; await settle(); for (let i = 0; i < 2; i++) await call(env, {}).then(r => r.json()); const before = aiCalls;
  const m = await (await call(env, { avoid: ['Lib omelette'] })).json(); assert.equal(aiCalls, before + 1, 'more ideas always calls the AI'); assert.equal(m.usage.library.served, 0);
});
test('integration: AI down but library has some -> library cards still answer', async () => {
  const store = memStore(); const env = { GEMINI_API_KEY: 'x', __libStore: store, __forceGeminiFail: true, __fetch: async () => new Response('{}', { status: 500 }) };
  const r = AI5('C').recipes[0]; store.rows.push({ id: 'c0ffee0000000000', lang: 'en', section: 'ready', craving: 'anything', diet_tags: [], pref_key: '', level: r.level, recipe: r, ings: requiredOf(r) });
  const j = await (await call(env, {})).json(); assert.equal(j.recipes.length, 1); assert.equal(j.recipes[0].name, 'C omelette');
});
