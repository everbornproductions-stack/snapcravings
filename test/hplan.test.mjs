import test from 'node:test';
import assert from 'node:assert/strict';
import { hpInput, checkMenu, cleanTimeline, previewOf, menuPrompt, FREE_STEPS } from '../functions/_lib/hplan.js';
import '../web/hplan-i18n.js';
const { onRequest } = await import('../functions/api/holiday-plan.js');
const dish = (course, name, items) => ({ course, name, emoji: '🍽️', minutes: 60, serves: 8, note: 'Make ahead.', ingredients: items.map(item => ({ item, qty: '2 lb', aisle: 'Produce', have: false })) });
const MENU = [dish('Dessert', 'Pumpkin pie', ['pumpkin puree', 'pie crust']), dish('Main', 'Roast turkey', ['whole turkey', 'butter']), dish('Side', 'Pecan green beans', ['green beans', 'pecans']), dish('Drink', 'Apple cider', ['apple cider']), dish('Side', 'Mashed potatoes', ['potatoes', 'milk'])];
const TL = [{ before_min: 60, when: 'T-1h', task: 'Rest the turkey.', dish: 'Roast turkey' }, { before_min: 2880, when: '2 days before', task: 'Thaw the turkey in the fridge.', dish: 'Roast turkey' }, { before_min: 240, when: 'T-4h', task: 'Turkey in at 325°F.', dish: 'Roast turkey' }, { before_min: 30, when: 'T-30m', task: 'Mash potatoes.', dish: 'Mashed potatoes' }, { before_min: 0, when: 'Serve', task: 'Carve and serve.', dish: 'All' }];
test('input: holiday must exist, guests 2-30, time on the hour', () => {
  assert.equal(hpInput({ holiday: 'nope' }).holiday, null);
  const p = hpInput({ holiday: 'thanksgiving', guests: 99, time: '18:30', country: 'us' }); assert.equal(p.guests, 30); assert.equal(p.time, '18:00'); assert.equal(p.country, 'US');
  assert.equal(hpInput({ holiday: 'thanksgiving', guests: 1 }).guests, 2);
  assert.match(menuPrompt(hpInput({ holiday: 'thanksgiving', guests: 8 }), 'en'), /Thanksgiving meal for 8 guests in country US.*turkey/s); assert.match(menuPrompt(hpInput({ holiday: 'thanksgiving', guests: 8 }), 'en'), /°F/); assert.match(menuPrompt(hpInput({ holiday: 'christmas', country: 'DE' }), 'de'), /°C/);
});
test('menu: sorted by course, diet offenders dropped, serves = guests', () => {
  const p = hpInput({ holiday: 'thanksgiving', guests: 8, prefs: { tags: ['Nut allergy'] } });
  const { menu, banned } = checkMenu(p, MENU); const C = ['Main', 'Side', 'Dessert', 'Drink']; assert.ok(menu.every((d, i) => !i || C.indexOf(menu[i - 1].course) <= C.indexOf(d.course))); assert.equal(menu[0].name, 'Roast turkey');
  assert.ok(!menu.some(d => /pecan/i.test(d.name))); assert.ok(banned.length); assert.ok(menu.every(d => d.serves === 8));
});
test('timeline counts back (earliest first); free preview hides the rest + shopping', () => {
  const tl = cleanTimeline(TL); assert.deepEqual(tl.map(s => s.before_min), [2880, 240, 60, 30, 0]);
  const full = { menu: MENU, timeline: tl, shopping: [{ aisle: 'Produce', items: [{ item: 'a' }, { item: 'b' }] }] };
  const f = previewOf(full, false); assert.equal(f.preview, true); assert.equal(f.timeline.length, FREE_STEPS); assert.equal(f.locked, 2); assert.deepEqual(f.shopping, []); assert.equal(f.shoppingCount, 2); assert.equal(f.menu.length, 5);
  const p = previewOf(full, true); assert.equal(p.preview, false); assert.equal(p.timeline.length, 5); assert.equal(p.shopping.length, 1);
});
const env = pro => ({ __pro: pro, __ask: async kind => kind === 'menu' ? { menu: MENU } : { timeline: TL } });
const req = body => new Request('http://x/api/holiday-plan', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '7.7.7.' + Math.floor(Math.random() * 250) }, body: JSON.stringify(body) });
test('API streams the menu first, then the plan (free preview vs Pro, shopping scaled list)', async () => {
  const res = await onRequest({ request: req({ holiday: 'thanksgiving', country: 'US', guests: 8, stream: true }), env: env(false) });
  assert.match(res.headers.get('content-type'), /ndjson/);
  const L = (await res.text()).trim().split('\n').map(l => JSON.parse(l)); assert.ok(L[0].menu && !L[0].done); const done = L.at(-1);
  assert.equal(done.done, true); assert.equal(done.preview, true); assert.equal(done.timeline.length, 3); assert.equal(done.locked, 2); assert.ok(done.shoppingCount > 0); assert.deepEqual(done.shopping, []);
  const pro = await (await onRequest({ request: req({ holiday: 'thanksgiving', guests: 12, time: '13:00' }), env: env({ e: 'x' }) })).json();
  assert.equal(pro.preview, false); assert.equal(pro.guests, 12); assert.equal(pro.time, '13:00'); assert.equal(pro.timeline[0].when, '2 days before'); assert.ok(pro.shopping.flatMap(g => g.items).some(i => /turkey/.test(i.item)));
  assert.equal((await onRequest({ request: req({ holiday: 'x' }), env: env(false) })).status, 400);
});
test('planner strings exist in all 9 other languages with the same placeholders', () => {
  const D = globalThis.HP_I18N, keys = Object.keys(D.es); assert.ok(keys.length >= 30);
  for (const l of ['es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr']) for (const k of keys) { assert.ok(D[l]?.[k], l + ' ' + k); for (const ph of k.match(/\{\w+\}/g) || []) assert.ok(D[l][k].includes(ph), l + ' ' + k); }
});
test('thaw step is moved early enough for the bird size (1 day per 4 lb)', async () => {
  const { thawFix } = await import('../functions/_lib/hplan.js');
  const f = thawFix({ before_min: 2880, when: '2 days before', task: 'Thaw your frozen 16 lb turkey in the fridge.', dish: 'Turkey' }); assert.equal(f.before_min, 5760); assert.equal(f.when, '4 days before');
  assert.equal(thawFix({ before_min: 4320, when: '3 days before', task: 'Thaw the turkey.' }, [{ ingredients: [{ item: 'Whole turkey', qty: '5 kg' }] }]).before_min, 4320);
  assert.equal(thawFix({ before_min: 60, when: 'T-1h', task: 'Rest the turkey.' }).before_min, 60);
  const menu = [{ name: 'Roast turkey', ingredients: [{ item: 'Whole turkey', qty: '16 lb' }] }, { name: 'Pumpkin pie', ingredients: [{ item: 'Pumpkin', qty: '2 lb' }] }];
  assert.equal(thawFix({ before_min: 2880, when: '2 days before', task: 'Thaw the ham if needed and bake the pies.', dish: 'Pumpkin pie' }, menu).before_min, 2880);
  assert.equal(thawFix({ before_min: 2880, when: '2 days before', task: 'Thaw the turkey in the fridge.', dish: 'Roast turkey' }, menu).before_min, 5760);
});
