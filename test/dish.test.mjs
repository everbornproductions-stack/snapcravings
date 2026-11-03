// Dish scan for macros: validation, portion math, gating (402), AI fallback chain, translations.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../web/dishcore.js';
import { onRequest, estimate, FREE_DISH_PER_DAY } from '../functions/api/dish.js';
const X = globalThis.SC_DISH;
const good = { is_food: true, dish: 'Chicken, rice and broccoli', emoji: '🍗', confidence: 'high', items: [{ name: 'Chicken', grams: 150 }, { name: 'Rice', grams: '180' }], total: { kcal: 560, protein: 52, carbs: 62, fat: 11, fiber: 4, sugar: 2, sodium: 520 } };
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fakejpeg').toString('base64');
const req = (body, h = {}) => new Request('https://snapcravings.pages.dev/api/dish', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.0.0.' + Math.floor(Math.random() * 250), ...h }, body: JSON.stringify(body) });
const gem = d => async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(d) }] } }] }));

test('validate keeps a sane answer and cleans fields', () => {
  const v = X.validate(good); assert.ok(v.ok);
  assert.equal(v.dish.items[1].grams, 180); assert.equal(v.dish.total.kcal, 560); assert.equal(v.dish.kcalFixed, false);
});
test('validate rejects not-food, missing macros, negative and out-of-range numbers', () => {
  assert.equal(X.validate({ ...good, is_food: false }).why, 'notfood');
  assert.equal(X.validate({ ...good, dish: '' }).ok, false);
  assert.equal(X.validate({ ...good, total: { ...good.total, protein: undefined } }).ok, false);
  assert.equal(X.validate({ ...good, total: { ...good.total, fat: -3 } }).ok, false);
  assert.match(X.validate({ ...good, total: { ...good.total, kcal: 25000 } }).why, /range kcal/);
  assert.match(X.validate({ ...good, total: { ...good.total, sodium: 99999 } }).why, /range sodium/);
  assert.equal(X.validate(null).ok, false);
});
test('validate fixes kcal that does not match 4P+4C+9F, keeps optional nulls', () => {
  const v = X.validate({ ...good, total: { kcal: 150, protein: 52, carbs: 62, fat: 11, fiber: 'n/a' } });
  assert.ok(v.ok); assert.equal(v.dish.total.kcal, 4 * 52 + 4 * 62 + 9 * 11); assert.equal(v.dish.kcalFixed, true); assert.equal(v.dish.total.fiber, null);
});
test('portion math: small/regular/large, slider number, servings, clamps', () => {
  const t = X.validate(good).dish.total;
  assert.equal(X.scale(t, 'regular', 1).kcal, 560);
  assert.equal(X.scale(t, 'small', 1).kcal, 392);
  assert.equal(X.scale(t, 'large', 2).kcal, 1568);
  assert.equal(X.scale(t, 'large', 2).protein, 145.6);
  assert.equal(X.scale(t, 0.5, 3).kcal, 840);
  assert.equal(X.factor(9, 99), 30); assert.equal(X.factor(0, 0), 0.25);
  assert.equal(X.scale({ ...t, fiber: null }, 'regular', 1).fiber, null);
});
test('daily total adds logged entries', () => {
  assert.deepEqual(X.dayTotal([{ kcal: 500.4, protein: 30, carbs: 50, fat: 10 }, { kcal: 300, protein: 20.6 }]), { kcal: 800, protein: 51, carbs: 50, fat: 10 });
  assert.match(X.dayKey(new Date(2026, 10, 2)), /^2026-11-02$/);
});
test('free users get 3 dish scans a day: a denied gate returns 402 paywall, AI is never called', async () => {
  assert.equal(FREE_DISH_PER_DAY, 3);
  let called = 0; const env = { GEMINI_API_KEY: 'k', __gate: () => ({ allowed: false }), __fetch: async () => { called++; return gem(good)(); } };
  const r = await onRequest({ request: req({ image: IMG }), env });
  assert.equal(r.status, 402); const j = await r.json(); assert.equal(j.paywall, true); assert.equal(called, 0);
});
test('allowed scan returns a validated dish; recalculating a correction skips the daily gate', async () => {
  let gates = 0; const env = { GEMINI_API_KEY: 'k', __gate: () => { gates++; return { allowed: true }; }, __fetch: gem(good) };
  const r = await onRequest({ request: req({ image: IMG }), env }); assert.equal(r.status, 200);
  const j = await r.json(); assert.equal(j.dish.name, good.dish); assert.equal(gates, 1);
  const r2 = await onRequest({ request: req({ fix: { name: 'Salmon bowl', items: [{ name: 'Salmon', grams: 140 }] } }), env });
  assert.equal(r2.status, 200); assert.equal(gates, 1); assert.equal((await r2.json()).dish.name, 'Salmon bowl');
});
test('bad inputs: no photo, wrong type, empty fix name', async () => {
  const env = { GEMINI_API_KEY: 'k', __gate: () => ({ allowed: true }), __fetch: gem(good) };
  assert.equal((await onRequest({ request: req({}), env })).status, 400);
  assert.equal((await onRequest({ request: req({ image: 'data:image/gif;base64,AAAA' }), env })).status, 400);
  assert.equal((await onRequest({ request: req({ fix: { name: ' ' } }), env })).status, 400);
});
test('chain: an invalid Gemini answer falls through to the next model, then Workers AI', async () => {
  let n = 0; const env = { GEMINI_API_KEY: 'k', __fetch: async () => { n++; return gem({ ...good, total: { kcal: 'lots' } })(); }, AI: { run: async () => ({ response: good }) } };
  const r = await estimate(env, [{ text: 'x' }]);
  assert.equal(n, 2); assert.ok(r.dish); assert.match(r.model, /llama-4-scout/); assert.equal(r.tries.length, 3);
});
test('not food is reported, not retried', async () => {
  const env = { GEMINI_API_KEY: 'k', __gate: () => ({ allowed: true }), __fetch: gem({ ...good, is_food: false }) };
  const r = await onRequest({ request: req({ image: IMG }), env }); assert.equal(r.status, 422);
});
test('every dish string is translated into all 9 other languages with the same placeholders', () => {
  const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(new URL('../web/dish-i18n.js', import.meta.url), 'utf8'), ctx);
  const D = ctx.DISH_I18N; const keys = Object.keys(D.es); assert.ok(keys.length > 40);
  const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
  for (const l of ['es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr']) { assert.ok(D[l], l); for (const k of keys) { assert.ok(typeof D[l][k] === 'string' && D[l][k].trim(), l + ' ' + k); assert.equal(ph(D[l][k]), ph(k), l + ' ' + k); } }
  // the Pro screen's new lines must be covered too
  for (const k of ['Dish scans for macros', 'Unlimited dish scans with estimated calories and macros', 'Dish scans', '1/week', 'Scan my plate']) assert.ok(keys.includes(k), k);
});
