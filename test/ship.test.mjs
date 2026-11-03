// 2026-11-02 ship batch: dish scan extras (daily gate, saved plates, make-at-home, carb diet view), checkout screenshot reader,
// delivery memberships + tip in the estimate, speed.js step text in hi/id/ar/ru/tr.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../web/money.js';
import '../web/dishcore.js';
import { onRequest, validateCheckout, readCheckout, FREE_CHECKOUT_PER_DAY, checkoutPrompt } from '../functions/api/checkout.js';
import { dishGate, FREE_DISH_PER_DAY } from '../functions/api/dish.js';
const M = globalThis.SC_MONEY; const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const IMG = 'data:image/png;base64,' + Buffer.from('fakepng').toString('base64');
const req = (body, h = {}) => new Request('https://snapcravings.pages.dev/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.1.0.' + Math.floor(Math.random() * 250), ...h }, body: JSON.stringify(body) });
const gem = d => async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(d) }] } }] }));
const good = { is_checkout: true, app: 'DemoEats', item: 'Chicken pad thai', currency: 'usd', lines: { food: 18.5, delivery: 3.99, service: 2.78, small_order: 0, tax: 1.65, tip: 3, discount: 0, total: 29.92 } };

test('ship strings: 9 languages x every key, same placeholders, nothing empty', () => {
  const ctx = {}; vm.createContext(ctx); vm.runInContext(rd('web/ship-i18n.js'), ctx);
  const D = ctx.SHIP_I18N, K = ctx.SHIP_KEYS; assert.ok(K.length >= 40);
  const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
  for (const l of ['es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr']) { assert.ok(D[l], l); for (const k of K) { assert.ok(typeof D[l][k] === 'string' && D[l][k].trim(), l + ' ' + k); assert.equal(ph(D[l][k]), ph(k), l + ' ' + k); } }
  for (const k of ['3/day', '♡ Save this plate', '👩‍🍳 Make it at home', 'Saved plates', '📸 Read my checkout', 'Reading your checkout…', 'Net carbs']) assert.ok(K.includes(k), k);
});
test('every English string the new screens use is in the ship dictionary', () => {
  const ctx = {}; vm.createContext(ctx); vm.runInContext(rd('web/ship-i18n.js'), ctx); const have = new Set(ctx.SHIP_KEYS);
  const old = new Set(Object.keys(ctx.SHIP_I18N.es));
  const src = rd('web/checkout.js') + rd('web/dish.js');
  for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) { const k = m[1].replace(/\\'/g, "'"); if (/Free dish scans used today|Free plan: 3 dish|Watching carbs|Net carbs|Saved plates|Plate |Make it at home|Save this plate|Reading your checkout|checkout|Totals don|We read it once|Compare with cooking|Pick a screenshot|Your order, line|Total you pay|Delivery fee|Service fee|Small-order|Discounts|You paid|Fees, tax|of 3 free/.test(k)) assert.ok(old.has(k) || have.has(k), 'missing: ' + k); }
});
test('dish scans: free = 3 a day, gate hashes are salted per UTC day and per feature, Pro skips it', async () => {
  assert.equal(FREE_DISH_PER_DAY, 3); assert.equal(FREE_CHECKOUT_PER_DAY, 3);
  const calls = []; const f0 = globalThis.fetch; globalThis.fetch = async (u, o) => { calls.push(JSON.parse(o.body)); return new Response(JSON.stringify({ allowed: true })); };
  try {
    const r = new Request('https://x/api/dish', { headers: { 'x-sc-dev': 'abc123' } });
    await dishGate({}, r, '1.2.3.4'); await dishGate({}, r, '1.2.3.4', 'checkout', 3, 15);
    assert.equal(calls.length, 2); assert.equal(calls[0].p_limit, 3); assert.notEqual(calls[0].p_device, calls[1].p_device); assert.match(calls[0].p_device, /^[0-9a-f]{32}$/);
    assert.ok(calls[0].p_scan.startsWith('dish') && calls[1].p_scan.startsWith('checkout'));
    const src = rd('functions/api/dish.js'); assert.match(src, /toISOString\(\)\.slice\(0, 10\)/);
    assert.equal((await dishGate({ __gate: () => ({ allowed: false }) }, r, 'x')).allowed, false);
  } finally { globalThis.fetch = f0; }
});
test('validateCheckout: cleans lines, flags a total that does not add up, rejects non-checkouts', () => {
  const v = validateCheckout(good); assert.ok(v.ok); assert.equal(v.order.currency, 'USD'); assert.equal(v.order.lines.total, 29.92); assert.equal(v.order.mismatch, false);
  assert.equal(v.order.extrasPct, Math.round((3.99 + 2.78 + 1.65 + 3) / 18.5 * 100));
  assert.equal(validateCheckout({ ...good, lines: { ...good.lines, total: 55 } }).order.mismatch, true);
  assert.equal(validateCheckout({ is_checkout: false, lines: { total: 5 } }).why, 'notcheckout');
  assert.equal(validateCheckout({ is_checkout: true, lines: { total: 0 } }).ok, false); assert.equal(validateCheckout({ is_checkout: true, lines: {} }).ok, false); assert.equal(validateCheckout(null).ok, false);
  const w = validateCheckout({ is_checkout: true, currency: 'dollars', item: '<b>Pizza</b>', lines: { food: '12,50', total: '€ 15,00', tip: -4, delivery: 9999 } });
  assert.ok(w.ok); assert.equal(w.order.currency, ''); assert.equal(w.order.item, 'b Pizza /b'); assert.equal(w.order.lines.total, 15); assert.equal(w.order.lines.food, 12.5); assert.equal(w.order.lines.tip, 0); assert.equal(w.order.lines.delivery, 0);
});
test('checkout prompt never asks for personal data and names the language', () => {
  assert.match(checkoutPrompt('es'), /Spanish/); assert.match(checkoutPrompt('de'), /German/); assert.match(checkoutPrompt('en'), /Do not copy any names, addresses, card or phone numbers/);
});
test('checkout API: gate 402 never calls the AI; allowed read returns a validated order; bad inputs 400; not a checkout 422', async () => {
  let called = 0; const deny = { GEMINI_API_KEY: 'k', __gate: () => ({ allowed: false }), __fetch: async () => { called++; return gem(good)(); } };
  const r = await onRequest({ request: req({ image: IMG }), env: deny }); assert.equal(r.status, 402); assert.equal((await r.json()).paywall, true); assert.equal(called, 0);
  const ok = { GEMINI_API_KEY: 'k', __gate: () => ({ allowed: true }), __fetch: gem(good) };
  const r2 = await onRequest({ request: req({ image: IMG }), env: ok }); assert.equal(r2.status, 200); const j = await r2.json(); assert.equal(j.order.lines.total, 29.92); assert.equal(j.order.app, 'DemoEats');
  assert.equal((await onRequest({ request: req({}), env: ok })).status, 400);
  assert.equal((await onRequest({ request: req({ image: 'data:image/gif;base64,AAAA' }), env: ok })).status, 400);
  assert.equal((await onRequest({ request: new Request('https://x/api/checkout'), env: ok })).status, 404);
  const nc = await onRequest({ request: req({ image: IMG }), env: { GEMINI_API_KEY: 'k', __gate: () => ({ allowed: true }), __fetch: gem({ is_checkout: false, lines: { total: 1 } }) } }); assert.equal(nc.status, 422);
  const es = await onRequest({ request: req({ image: IMG }, { 'x-sc-lang': 'es' }), env: deny }); assert.match((await es.json()).error, /3 lecturas de pago/);
});
test('checkout chain: an invalid first answer falls through to the next model and then Workers AI', async () => {
  let n = 0; const env = { GEMINI_API_KEY: 'k', __fetch: async () => { n++; return gem({ is_checkout: true, lines: { total: 'lots' } })(); }, AI: { run: async () => ({ response: good }) } };
  const r = await readCheckout(env, [{ text: 'x' }]); assert.equal(n, 2); assert.ok(r.order); assert.match(r.model, /llama-4-scout/); assert.equal(r.tries.length, 3);
});
test('memberships and tip change the delivery ESTIMATE only when chosen; no tip applied where tipping is not the norm', () => {
  const base = M.delivery(15, 2, 'US'), mem = M.delivery(15, 2, 'US', { mem: true });
  assert.ok(mem.lo < base.lo && mem.hi < base.hi && mem.mem === true && !base.mem);
  const tip5 = M.delivery(15, 2, 'US', { tip: 5 }), tip2 = M.delivery(15, 2, 'US', { tip: 2 }); assert.ok(tip5.lo > tip2.lo);
  assert.deepEqual(M.delivery(15, 2, 'AU', { tip: 5 }), M.delivery(15, 2, 'AU')); // AU tips 0: the flat tip is ignored
  assert.equal(M.delivery(0, 2, 'US', { mem: true }), null); assert.deepEqual(M.delivery(15, 2, 'DE'), M.delivery(15, 2, 'DE', {}));
});
test('crave UI: memberships + tip persist and feed the estimate; the screenshot card is live, not "Coming soon"', () => {
  const a = rd('web/app.js'), h = rd('web/index.html');
  assert.match(a, /M\.delivery\(menu, serv, cc, dOpts\(\)\)/); assert.match(a, /LS\.set\('mem'/); assert.match(a, /LS\.set\('tipUS'/); assert.match(a, /scOrderLine\(c\)/);
  assert.doesNotMatch(h, /Coming soon: upload a screenshot/); assert.doesNotMatch(h, /for the ordering comparison, coming soon/); assert.match(h, /id="chkBody"/);
  assert.match(h, /ship-i18n\.js\?v=/); assert.match(h, /checkout\.js\?v=/); assert.ok(h.indexOf('ship-i18n.js') < h.indexOf('dish.js?v='));
  const c = rd('web/checkout.js'); assert.match(c, /api\('checkout'/); assert.doesNotMatch(c, /fetch\(['"`]https?:/); // only our own API, never a delivery app
});
test('dish UI: save plate, saved plates in Favorites, make-it-at-home recipe, Crave it link, carb-diet view', () => {
  const d = rd('web/dish.js'), a = rd('web/app.js');
  for (const k of ['data-dish-save', 'data-dish-home', 'data-dish-open', 'data-dish-unsave', 'data-craveit', 'Net carbs', 'dishFavs', 'crave(nm)']) assert.ok(d.includes(k), k);
  assert.match(d, /#dish, #scan, #favs/); assert.match(a, /dishFavsHtml/); assert.doesNotMatch(d, /1 dish scan a week/);
  assert.match(d, /Math\.max\(0, Math\.round\(\(n\.carbs - n\.fiber\) \* 10\) \/ 10\)/);
});
test('speed.js: hi, id, ar, ru, tr have every step and tip line; checkout steps exist in all languages', () => {
  const src = rd('web/speed.js'); const doc = { createElement: () => ({}), head: { appendChild() {} }, querySelectorAll: () => [] };
  const win = { I18N: { lang: 'en' }, t: s => s }; const ctx = { window: win, I18N: win.I18N, document: doc, setInterval() {}, Date, Math, Set }; vm.createContext(ctx); vm.runInContext(src, ctx);
  const en = win.scLoading('Reading your checkout…', 'Reading your checkout…'); assert.match(en, /data-area="checkout"/); assert.match(en, /Finding the food and fees…/);
  const first = { hi: 'खाना और फीस ढूँढ रहे हैं…', id: 'Mencari makanan dan biayanya…', ar: 'نبحث عن الطعام والرسوم…', ru: 'Ищем еду и сборы…', tr: 'Yemeği ve ücretleri buluyoruz…', es: 'Buscando la comida y los cargos…', pt: 'Encontrando a comida e as taxas…', fr: 'On repère le repas et les frais…', de: 'Wir finden Essen und Gebühren…' };
  for (const [l, s] of Object.entries(first)) { win.I18N.lang = l; assert.ok(win.scLoading('Reading your checkout…', 'x').includes(s), l); }
  // all 28 lines present for the five languages (count the table in the source)
  const blk = src.slice(src.indexOf('const SPEED_EN'), src.indexOf('const tr = s'));
  const en28 = [...blk.slice(0, blk.indexOf('];')).matchAll(/'((?:[^'\\]|\\.)*)'/g)].length; assert.equal(en28, 28);
  for (const l of ['hi', 'id', 'ar', 'ru', 'tr']) { const m = blk.match(new RegExp(`\\n    ${l}: \\[(.*?)\\](?:,|\\n  \\};)`, 's')); assert.ok(m, l); assert.equal([...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].length, 28, l); }
  const planned = ['Spotting every item on the shelves…', 'Adding up calories and macros…', 'Reading the handwriting…']; for (const l of ['hi', 'id', 'ar', 'ru', 'tr']) { win.I18N.lang = l; assert.doesNotMatch(win.scLoading('Reading your plate…', 'x'), /Spotting what is on the plate/); }
  assert.ok(planned.length);
});
test('service worker caches the new files and the cache name was bumped', () => {
  const s = rd('web/sw.js'); assert.match(s, /ship-i18n\.js\?v=ui62/); assert.match(s, /checkout\.js\?v=ui62/); assert.match(s, /ui62/); assert.match(rd('web/index.html'), /SC_IV = 'ui62'/);
});
