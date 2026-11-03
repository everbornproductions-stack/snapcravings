// Fast meal-prep path: tiny menu call, per-day calls in parallel, days streamed as NDJSON, single-call fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planInput, MENU_SCHEMA, PREP_SCHEMA, MEALS_SCHEMA, PLAN_SCHEMA } from '../functions/_lib/plan.js';
import { buildPlan, checkMenu, onRequest } from '../functions/api/plan.js';
const meal = (day, slot, name, item = 'chicken') => ({ day, slot, name, emoji: '🍱', minutes: 15, servings: 2, ingredients: [{ item, qty: '1 lb', aisle: 'Meat & Seafood', have: false }], steps: ['Reheat.'], est_cook_cost: 5, keeps_days: 4, kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 10 });
function fakeAsk(log, { menuFails = false, shrimpDay = 0 } = {}) {
  return async (env, schema, parts) => {
    const txt = parts[0].text; log.push(schema === MENU_SCHEMA ? 'menu' : schema === PREP_SCHEMA ? 'prep' : schema === PLAN_SCHEMA ? 'plan' : 'day');
    if (schema === MENU_SCHEMA) { if (menuFails) throw new Error('x'); const out = []; for (let d = 1; d <= 7; d++) out.push({ day: d, slot: 'Dinner', name: 'Dish ' + d, protein: 'chicken' }); return { menu: out }; }
    if (schema === PREP_SCHEMA) return { prep: [{ title: 'Cook rice', detail: '3 cups', minutes: 20 }], storage: ['Rice keeps 4 days.'] };
    if (schema === PLAN_SCHEMA) return { meals: [1, 2, 3, 4, 5, 6, 7].map(d => meal(d, 'Dinner', 'Single ' + d)), prep: [], storage: [] };
    const d = +/ONLY the meals for day (\d+)/.exec(txt)?.[1] || +/day (\d+) Dinner/.exec(txt.split('Only return the meals for these cells:')[1] || '')?.[1];
    await new Promise(r => setTimeout(r, 5 * (8 - d)));
    if (d === shrimpDay && !/Only return the meals/.test(txt)) return { meals: [meal(d, 'Dinner', 'Shrimp pasta', 'shrimp')] };
    return { meals: [meal(d, 'Dinner', 'Dish ' + d)] };
  };
}
test('pro week: menu first, then 7 day calls + prep in parallel, every day streamed', async () => {
  const log = [], sent = []; const p = planInput({ days: 7 }, { pro: true });
  const out = await buildPlan({}, p, 'en', fakeAsk(log), o => sent.push(o));
  assert.equal(log[0], 'menu'); assert.equal(log.filter(x => x === 'day').length, 7); assert.equal(log.filter(x => x === 'prep').length, 1);
  assert.equal(out.meals.length, 7); assert.deepEqual(out.meals.map(m => m.day), [1, 2, 3, 4, 5, 6, 7]); assert.equal(out.prep.length, 1); assert.equal(out.storage.length, 1);
  assert.equal(sent.length, 7); assert.equal(sent[0].day, 7); // fastest day arrives first, not in order
  assert.ok(out.grocery.length); assert.equal(out.total, 35);
});
test('free preview: only 2 days generated, one call', async () => {
  const log = []; const out = await buildPlan({}, planInput({ days: 7 }), 'en', fakeAsk(log));
  assert.equal(out.meals.length, 2); assert.equal(out.genDays, 2); assert.equal(out.preview, true); assert.deepEqual(log, ['plan']);
});
test('diet check still repairs a single day (shellfish allergy)', async () => {
  const log = []; const p = planInput({ days: 7, prefs: { tags: ['Shellfish allergy'] } }, { pro: true });
  const out = await buildPlan({}, p, 'en', fakeAsk(log, { shrimpDay: 3 }));
  assert.equal(out.meals.length, 7); assert.ok(!out.meals.some(m => /shrimp/i.test(m.name))); assert.equal(log.filter(x => x === 'day').length, 8);
});
test('menu failure falls back to the single big call', async () => {
  const log = []; const out = await buildPlan({}, planInput({ days: 7 }, { pro: true }), 'en', fakeAsk(log, { menuFails: true }));
  assert.deepEqual(log, ['menu', 'plan']); assert.equal(out.meals.length, 7);
});
test('checkMenu rejects menus with holes or duplicate names', () => {
  const p = planInput({ days: 7 }); assert.equal(checkMenu(p, [{ day: 1, slot: 'Dinner', name: 'A' }]), null);
  assert.equal(checkMenu(p, [{ day: 1, slot: 'Dinner', name: 'A' }, { day: 2, slot: 'Dinner', name: 'a' }]), null);
  assert.equal(checkMenu(p, [{ day: 1, slot: 'Dinner', name: 'A' }, { day: 2, slot: 'Dinner', name: 'B' }]).length, 2);
});
test('HTTP: stream=true gives NDJSON meta, days, done; plain JSON unchanged (mock AI)', async () => {
  const req = (body, h = {}) => new Request('http://x/api/plan', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.' + Math.floor(Math.random() * 200), ...h }, body: JSON.stringify(body) });
  const env = { MOCK_AI: '1', ENFORCE_FREE: '0' };
  const res = await onRequest({ request: req({ days: 7, meals: 'lunch_dinner', stream: true }), env, waitUntil: () => {} });
  assert.match(res.headers.get('content-type'), /ndjson/); const L = (await res.text()).trim().split('\n').map(l => JSON.parse(l));
  assert.ok(L[0].meta); assert.equal(L[0].meta.genDays, 2); const done = L.at(-1); assert.ok(done.done); assert.equal(done.meals.length, 4); assert.ok(done.grocery);
  const j = await (await onRequest({ request: req({ days: 7 }), env, waitUntil: () => {} })).json(); assert.equal(j.meals.length, 2); assert.ok(j.mock);
});
test('Pro gate: owner code, Stripe and Play tokens (all signed sub tokens) get the full week; none/forged get the preview', async () => {
  const { signToken } = await import('../functions/_lib/sub.js');
  const env = { MOCK_AI: '1', ENFORCE_FREE: '0', SUB_SECRET: 'test-secret' };
  const go = async tok => (await (await onRequest({ request: new Request('http://x/api/plan', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.8.' + Math.floor(Math.random() * 200), 'x-sc-token': tok }, body: JSON.stringify({ days: 7 }) }), env, waitUntil: () => {} })).json());
  for (const who of ['Code unlocked', 'chris@example.com', 'Google Play']) { const j = await go(await signToken(env, who)); assert.equal(j.preview, false, who); assert.equal(j.genDays, 7, who); assert.equal(j.meals.length, 7, who); }
  const none = await go(''); assert.equal(none.preview, true); assert.equal(none.genDays, 2);
  const forged = await go('eyJlIjoieCIsIngiOjk5OTk5OTk5OTk5OTl9.bad'); assert.equal(forged.preview, true);
});
test('meal prep UI explains a plan with no fridge scan in all 10 languages, and drops a stale preview after going Pro', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../web/prep.js', import.meta.url), 'utf8');
  for (const l of ['en', 'es', 'fr', 'de', 'pt', 'id', 'tr', 'ru', 'hi', 'ar']) assert.match(src, new RegExp(`\\b${l}: '`), l);
  assert.match(src, /plan\.preview && typeof unlimited === 'function' && unlimited\(\)/);
});
