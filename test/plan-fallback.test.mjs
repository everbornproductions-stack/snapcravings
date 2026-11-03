// P0 2026-11-02: /api/plan failed 5 of 6 live runs when every Gemini model answered 429. The plan engine now falls back to
// the other free providers and Workers AI, and a plan that still cannot be made says "busy, try again in a minute".
import test from 'node:test'; import assert from 'node:assert/strict';
import { gemini, planChain, okPlanShape, BUSY, onRequest } from '../functions/api/plan.js';
import { MEALS_SCHEMA, PLAN_SCHEMA } from '../functions/_lib/plan.js';
const meal = { day: 1, slot: 'Dinner', name: 'Lemon chicken bowl', emoji: '🍋', minutes: 20, servings: 2, ingredients: [{ item: 'Chicken', qty: '1 lb', aisle: 'Meat & Seafood', have: false }], steps: ['Cook.'], est_cook_cost: 6, keeps_days: 3, kcal: 500, protein_g: 40, carbs_g: 40, fat_g: 12 };
const res = (s, o) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
test('chain: no dead Gemini models, then keyed providers, then Workers AI, then a last Gemini try', () => {
  const c = planChain({ GEMINI_API_KEY: 'k', GROQ_API_KEY: 'g', AI: {} });
  const names = c.map(x => x[0] + ':' + (typeof x[1] === 'string' ? x[1] : ''));
  assert.ok(!names.some(n => /3\.8-flash|2\.5-flash/.test(n)), names.join());
  assert.deepEqual(names.slice(3), ['oai:groq', 'cf:', 'wait:', 'gemini:gemini-3.5-flash-lite']);
});
test('every Gemini 429 -> Groq answers the plan', async () => {
  const seen = [];
  const env = { GEMINI_API_KEY: 'k', GROQ_API_KEY: 'g', __noWait: true, __fetch: async (url) => { seen.push(String(url)); return /googleapis/.test(url) ? res(429, { error: { message: 'quota' } }) : res(200, { choices: [{ message: { content: JSON.stringify({ meals: [meal] }) } }] }); } };
  const out = await gemini(env, MEALS_SCHEMA, [{ text: 'x' }]);
  assert.equal(out.meals[0].name, 'Lemon chicken bowl'); assert.ok(seen.some(u => /groq/.test(u)));
  assert.equal(seen.filter(u => /googleapis/.test(u)).length, 6, 'each Gemini model is retried once after a 429');
});
test('Workers AI answers when every keyed provider is out', async () => {
  const env = { GEMINI_API_KEY: 'k', __noWait: true, __fetch: async () => res(429, {}), AI: { run: async () => ({ response: { meals: [meal] } }) } };
  assert.equal((await gemini(env, MEALS_SCHEMA, [{ text: 'x' }])).meals.length, 1);
});
test('all providers busy -> friendly busy message, 503 with retryAfter, translated in Spanish', async () => {
  const env = { GEMINI_API_KEY: 'k', __noWait: true, __fetch: async () => res(429, {}) };
  await assert.rejects(gemini(env, MEALS_SCHEMA, [{ text: 'x' }]), e => e.message === BUSY && e.busy);
  const r = await onRequest({ request: new Request('http://x/api/plan', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '7.7.7.' + Math.floor(Math.random() * 200) }, body: JSON.stringify({ days: 2 }) }), env: { ...env, ENFORCE_FREE: '0' }, waitUntil: () => {} });
  const j = await r.json(); assert.equal(r.status, 503); assert.equal(j.error, BUSY); assert.equal(j.retryAfter, 60);
  const r2 = await onRequest({ request: new Request('http://x/api/plan', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sc-lang': 'es', 'cf-connecting-ip': '7.7.8.' + Math.floor(Math.random() * 200) }, body: JSON.stringify({ days: 2 }) }), env: { ...env, ENFORCE_FREE: '0' }, waitUntil: () => {} });
  assert.match((await r2.json()).error, /ocupados/);
});
test('shape check rejects empty or partial answers so the chain moves on', () => {
  assert.equal(okPlanShape(MEALS_SCHEMA, { meals: [] }), false); assert.equal(okPlanShape(PLAN_SCHEMA, { meals: [meal] }), false);
  assert.equal(okPlanShape(PLAN_SCHEMA, { meals: [meal], prep: [], storage: [] }), true);
});
