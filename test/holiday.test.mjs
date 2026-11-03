import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/holiday.js';
const S = globalThis.SC_HOLIDAY, d = (y, m, x) => new Date(y, m - 1, x), on = (y, m, x, c) => S.active(d(y, m, x), c)?.id || null;
test('Thanksgiving 2026 is Nov 26, window starts Nov 19 (US)', () => {
  const w = S.windowOf('thanksgiving', 2026); assert.equal(w.end.getDate(), 26); assert.equal(w.start.getDate(), 19);
  assert.equal(on(2026, 11, 18, 'US'), null); assert.equal(on(2026, 11, 19, 'US'), 'thanksgiving'); assert.equal(on(2026, 11, 26, 'US'), 'thanksgiving'); assert.equal(on(2026, 11, 27, 'US'), 'hanukkah'); assert.equal(on(2026, 11, 27, 'GB'), null);
  assert.equal(S.windowOf('thanksgiving', 2027).end.getDate(), 25);
});
test('US fixed + computed dates', () => {
  assert.equal(on(2026, 7, 1, 'US'), 'july4'); assert.equal(on(2026, 10, 30, 'US'), 'halloween'); assert.equal(on(2026, 12, 25, 'US'), 'christmas'); assert.equal(on(2026, 12, 31, 'US'), 'newyear');
  assert.equal(S.easter(2026).toDateString(), d(2026, 4, 5).toDateString()); assert.equal(S.easter(2027).toDateString(), d(2027, 3, 28).toDateString());
  assert.equal(S.windowOf('mothersday', 2026).end.getDate(), 10); assert.equal(S.windowOf('memorialday', 2026).end.getDate(), 25); assert.equal(S.windowOf('fathersday', 2026).end.getDate(), 21); assert.equal(S.windowOf('laborday', 2026).end.getDate(), 7);
  assert.equal(on(2026, 6, 1, 'US'), null); assert.equal(on(2026, 3, 16, 'US'), 'stpatricks'); assert.equal(on(2026, 5, 3, 'US'), 'cincodemayo');
});
test('per-country sets', () => {
  assert.equal(on(2026, 11, 22, 'BR'), null); assert.equal(on(2026, 2, 15, 'BR'), 'carnaval'); assert.equal(on(2026, 6, 20, 'BR'), 'festajunina'); assert.equal(on(2026, 12, 24, 'BR'), 'christmas');
  assert.equal(on(2026, 11, 2, 'IN'), 'diwali'); assert.equal(on(2026, 3, 1, 'IN'), 'holi');
  assert.equal(on(2026, 3, 19, 'ID'), 'eid'); assert.equal(on(2026, 5, 25, 'ID'), 'eidadha');
  assert.equal(on(2026, 11, 1, 'MX'), 'muertos'); assert.equal(on(2026, 5, 3, 'MX'), null); assert.equal(on(2026, 12, 18, 'MX'), 'posadas'); assert.equal(on(2026, 11, 2, 'AR'), 'muertos');
  assert.equal(on(2026, 7, 10, 'FR'), 'bastille'); assert.equal(on(2027, 1, 4, 'FR'), 'reyes');
  assert.equal(on(2026, 9, 25, 'DE'), 'oktoberfest'); assert.equal(on(2026, 11, 26, 'DE'), null);
  assert.equal(on(2026, 3, 1, 'SA'), 'ramadan'); assert.equal(on(2026, 3, 20, 'EG'), 'eid'); assert.equal(on(2026, 5, 27, 'AE'), 'eidadha'); assert.equal(on(2026, 12, 20, 'SA'), null);
  assert.equal(on(2027, 1, 5, 'RU'), 'orthodoxxmas'); assert.equal(on(2027, 3, 10, 'RU'), 'maslenitsa'); assert.equal(on(2026, 12, 29, 'RU'), 'newyear');
  assert.equal(on(2026, 3, 18, 'TR'), 'eid'); assert.equal(on(2026, 11, 26, 'TR'), null);
  assert.equal(on(2026, 12, 25, 'JP'), 'christmas'); assert.equal(on(2026, 11, 26, 'JP'), null); assert.equal(on(2026, 11, 26, ''), null);
});
test('country fallback from locale, labels translated, craving check', () => {
  assert.equal(S.countryFromLocale('pt-BR', 'pt'), 'BR'); assert.equal(S.countryFromLocale('es', 'es'), 'MX'); assert.equal(S.countryFromLocale('ar', 'ar'), 'SA'); assert.equal(S.countryFromLocale('en-GB', 'en'), 'GB');
  assert.equal(S.info('thanksgiving', 'es').name, 'Día de Acción de Gracias'); assert.equal(S.info('christmas', 'de').name, 'Weihnachten'); assert.equal(S.info('eid', 'tr').name, 'Ramazan Bayramı'); assert.equal(S.info('diwali', 'hi').ui[0], 'त्योहार के पकवान');
  for (const id of S.ids) { assert.equal(S.L[id].length, 10, id); for (const y of [2025, 2026, 2027, 2028]) assert.ok(S.windowOf(id, y), id + y); }
  assert.ok(S.isHoliday('holiday:thanksgiving')); assert.ok(!S.isHoliday('holiday:nope')); assert.ok(!S.isHoliday('Anything'));
});
const { onRequest } = await import('../functions/api/[[path]].js');
test('API: holiday craving uses a holiday prompt; /api/geo returns cf.country', async () => {
  const R = n => ({ name: 'Turkey dish ' + n, emoji: '🦃', minutes: 10, servings: 2, level: 'Easy', ingredients: [{ item: 'Eggs', qty: '2', have: true }], missing: [], steps: ['Cook.'], kcal: 300, protein_g: 20, carbs_g: 10, fat_g: 10 });
  const prompts = [], text = JSON.stringify({ recipes: [0, 1, 2].map(R) });
  const __fetch = async (url, init) => { prompts.push(init.body); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })); };
  const request = new Request('http://localhost/api/recipes', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.' + Math.floor(Math.random() * 200) }, body: JSON.stringify({ ingredients: ['Eggs', 'Potatoes'], craving: 'holiday:thanksgiving', section: 'ready' }) });
  const res = await onRequest({ request, env: { GEMINI_API_KEY: 'x', __fetch }, params: { path: ['recipes'] }, waitUntil: p => p });
  const j = await res.json(); assert.ok(j.recipes.length, JSON.stringify(j)); assert.equal(j.craving, 'holiday:thanksgiving');
  assert.match(prompts[0], /HOLIDAY MODE: all 5 recipes are festive Thanksgiving dishes/); assert.match(prompts[0], /pumpkin pie/);
  const g = new Request('http://localhost/api/geo'); Object.defineProperty(g, 'cf', { value: { country: 'br' } });
  assert.deepEqual(await (await onRequest({ request: g, env: {}, params: { path: ['geo'] } })).json(), { country: 'BR' });
});
