// 2026-11-02 Round 2 bug fixes: crave retry/replace, prep timeout + plan budget, TWA detection, badge spacing, hero wrap,
// free preview note, calorie-goal scaling, Play localized prices, token reissue + paywall recheck, redeem limits, P2s.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { scaleToGoal, proteinShort } from '../functions/_lib/plan.js';
import { PLAN_BUDGET } from '../functions/api/plan.js';
import { redeemGate, REDEEM_HOURLY, REDEEM_WEEKLY, onRequest as subReq } from '../functions/api/sub/[[path]].js';
import { signToken } from '../functions/_lib/sub.js';
const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = rd('web/app.js'), prep = rd('web/prep.js');
const fix = (() => { const s = rd('web/fixes.js'); return JSON.parse(s.match(/globalThis\.FIX_I18N = (\{.*?\});\n/s)[1]); })();

test('#1 crave error has a real Retry button wired to crave()', () => {
  assert.match(app, /id="craveRetry"/); assert.match(app, /closest\('#craveRetry'\)[^;]*;\s*if \(cr2\) return crave\(/);
});
test('#2 prep client timeout is 45 s and the server plan has one ~38 s budget', () => {
  assert.match(prep, /planStream\(body, onMeta, onDay, ms = 45000\)/); assert.match(prep, /async function build\(\) \{\n\s*if \(busy\) return;/);
  assert.ok(PLAN_BUDGET <= 40000 && PLAN_BUDGET >= 30000);
});
test('#3 crave input replaces old text and chips run at once', () => {
  assert.match(app, /craveInput[\s\S]{0,200}select\(\)/); assert.match(app, /data-crave[\s\S]{0,300}crave\(/);
});
test('#4 TWA detected by Digital Goods at any size; #5 level badge spaced; #6 hero wraps balanced', () => {
  assert.match(app, /'getDigitalGoodsService' in window\) LS\.set\('twa', 1\)/); assert.match(rd('web/grow.js'), /getDigitalGoodsService/);
  assert.match(app, /LEVEL_PILL[\s\S]{0,120}' ' \+/); assert.match(rd('web/index.html'), /text-wrap:balance/);
});
test('#7 free preview note shows on the form, in all 9 non-English languages', () => {
  assert.match(prep, /Free preview: 2 of \{n\} days\. Pro unlocks all\./);
  for (const l of ['es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr']) for (const k of ['Free preview: 2 of {n} days. Pro unlocks all.', 'Portion ×{x} to fit your goal', 'Or go yearly: {y}/year', '{m}/mo or {y}/year. Secure checkout by Google Play. Cancel anytime in Google Play.']) {
    assert.ok(fix[l][k], l + ' ' + k); (k.match(/\{\w\}/g) || []).forEach(p => assert.ok(fix[l][k].includes(p), l + ' keeps ' + p)); }
});
test('#8 a 2600 kcal goal scales 450 kcal dinners up and flags low protein', () => {
  const p = { fit: { goal: 'maintain', kcal: 2600, p: 160 }, slots: ['dinner'] };
  const meals = [{ day: 1, slot: 'dinner', kcal: 450, protein_g: 30, carbs_g: 40, fat_g: 15, ingredients: [{ item: 'rice', qty: '1 cup' }, { item: 'chicken', qty: '200 g' }, { item: 'salt', qty: 'to taste' }] }];
  const out = scaleToGoal(p, meals)[0];
  assert.ok(Math.abs(out.kcal - 1040) <= 104, 'within 10% of 40% of 2600: ' + out.kcal); assert.ok(out.portion > 2);
  assert.equal(out.ingredients[0].qty, '2.25 cup'); assert.equal(out.ingredients[1].qty, '462 g'); assert.equal(out.ingredients[2].qty, 'to taste');
  assert.deepEqual(scaleToGoal(p, [{ ...meals[0], kcal: 1000 }])[0].portion, undefined, 'already close: untouched');
  assert.deepEqual(proteinShort(p, [out]), []); assert.deepEqual(proteinShort({ ...p, fit: { ...p.fit, p: 300 } }, [out]), [1]); assert.deepEqual(scaleToGoal({ fit: null, slots: ['dinner'] }, meals), meals);
  assert.match(prep, /m\.portion \?/);
});
test('#9 Play mode reads localized prices from getDetails with text fallback', () => {
  assert.match(app, /playDG\.getDetails\(PLAY_SKUS\)/); assert.match(app, /Intl\.NumberFormat/); assert.match(app, /playPricesLoad\(\)/);
});
test('#10 token near expiry is reissued; far from expiry reused; paywall rechecks once', async () => {
  const env = { SUB_SECRET: 's' }; const ctx = tok => ({ request: new Request('https://x/api/sub/status', { method: 'POST', body: JSON.stringify({ token: tok }) }), env, params: { path: ['status'] } });
  const old = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ active: true, email: 'a@b.co', period_end: new Date(Date.now() + 20 * 864e5).toISOString() })); };
  try {
    const far = await signToken(env, 'a@b.co', 20); const j1 = await (await subReq(ctx(far))).json(); assert.equal(j1.token, far); assert.equal(calls, 0);
    const near = await signToken(env, 'a@b.co', 3); const j2 = await (await subReq(ctx(near))).json(); assert.equal(j2.active, true); assert.notEqual(j2.token, near); assert.equal(calls, 1);
    const code = await signToken(env, 'Code unlocked', 3); assert.equal((await (await subReq(ctx(code))).json()).token, code);
  } finally { globalThis.fetch = old; }
  assert.match(app, /e\.paywall && !rechecked && looksSubbed\(\)/); assert.match(app, /tokLeft\(\) < 7 \* 864e5/);
});
test('#11 redeem: per-instance hourly cap + Supabase weekly counter (fails open on error)', async () => {
  assert.equal(REDEEM_HOURLY, 8); assert.equal(REDEEM_WEEKLY, 20);
  let body; assert.equal(await redeemGate({}, '1.2.3.4', async (u, o) => { body = JSON.parse(o.body); return new Response('{"allowed":false}'); }), false);
  assert.match(body.p_device, /^[0-9a-f]{64}$/); assert.match(body.p_scan, /^rdm-/); assert.equal(body.p_limit, 20);
  assert.equal(await redeemGate({}, '1.2.3.4', async () => { throw new Error('down'); }), true);
  const env = { SUB_SECRET: 's', OWNER_CODE: 'right-code' }; let last;
  for (let i = 0; i < 10; i++) last = await subReq({ request: new Request('https://x/api/sub/redeem', { method: 'POST', headers: { 'cf-connecting-ip': '9.9.9.' + 7 }, body: '{"code":"wrong-code"}' }), env: { ...env, __fetch: async () => new Response('{"allowed":true}') }, params: { path: ['redeem'] } });
  assert.equal(last.status, 429);
});
test('P2: 404 page, frame-ancestors, privacy coral + description', () => {
  assert.match(rd('web/404.html'), /Back to SnapCravings/); const h = rd('web/_headers');
  assert.match(h, /frame-ancestors 'none'/); assert.match(h, /X-Frame-Options: DENY/); assert.match(h, /X-Robots-Tag: noindex/);
  const pv = rd('web/privacy.html'); assert.match(pv, /--coral:#CC4018/); assert.match(pv, /name="description"/);
});
test('#11 IPv6 rotation inside one /48 shares one redeem counter', async () => {
  const { ipKey } = await import('../functions/api/sub/[[path]].js');
  assert.equal(ipKey('2a09:bac5:64fc:2828::400:f'), ipKey('2a09:bac5:64fc:1678::23d:42')); assert.equal(ipKey('1.2.3.4'), '1.2.3.4');
});
