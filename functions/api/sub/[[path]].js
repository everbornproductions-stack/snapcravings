// SnapCravings Unlimited via Square: plan + variation in Catalog, Square-hosted payment link, status check by email.
// Secrets: SQUARE_ACCESS_TOKEN, SUB_SECRET. Vars: SQUARE_ENV ('production' | 'sandbox', default production), SQUARE_LOCATION_ID (optional).
import { signToken, verifyToken } from '../../_lib/sub.js';
export const PRICE_CENTS = 499; // $4.99 / month (change here)
export const PLAN_NAME = 'SnapCravings Unlimited';
const VERSION = '2025-01-23';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const base = env => env.SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
async function sq(env, path, method = 'GET', body) {
  const r = await fetch(base(env) + path, { method, headers: { authorization: 'Bearer ' + env.SQUARE_ACCESS_TOKEN, 'square-version': VERSION, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log('square', path, r.status, JSON.stringify(j.errors || j).slice(0, 300)); throw new Error(j.errors?.[0]?.detail || 'Square error'); }
  return j;
}
const validEmail = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e || '');
let cache = {};
async function location(env) {
  if (env.SQUARE_LOCATION_ID) return env.SQUARE_LOCATION_ID;
  if (cache.loc) return cache.loc;
  const j = await sq(env, '/v2/locations'); const l = (j.locations || []).find(x => x.status === 'ACTIVE');
  if (!l) throw new Error('No active Square location'); return (cache.loc = l.id);
}
// Find or create the plan + monthly variation (idempotent by name).
async function planVariation(env) {
  if (env.SQUARE_PLAN_VARIATION_ID) return env.SQUARE_PLAN_VARIATION_ID;
  if (cache.pv) return cache.pv;
  const s = await sq(env, '/v2/catalog/search', 'POST', { object_types: ['SUBSCRIPTION_PLAN'], include_related_objects: true, query: { exact_query: { attribute_name: 'name', attribute_value: PLAN_NAME } } });
  const plan = (s.objects || []).find(o => !o.is_deleted);
  const vs = plan ? await sq(env, '/v2/catalog/search', 'POST', { object_types: ['SUBSCRIPTION_PLAN_VARIATION'] }) : {};
  const vars = (vs.objects || []).filter(o => !o.is_deleted);
  const want = v => v.subscription_plan_variation_data?.phases?.[0]?.pricing?.price_money?.amount === PRICE_CENTS || v.subscription_plan_variation_data?.phases?.[0]?.recurring_price_money?.amount === PRICE_CENTS;
  let pv = plan && vars.find(v => v.subscription_plan_variation_data?.subscription_plan_id === plan.id && want(v));
  if (pv) return (cache.pv = pv.id);
  let planId = plan?.id;
  if (!planId) {
    const p = await sq(env, '/v2/catalog/object', 'POST', { idempotency_key: crypto.randomUUID(), object: { type: 'SUBSCRIPTION_PLAN', id: '#plan', subscription_plan_data: { name: PLAN_NAME } } });
    planId = p.catalog_object.id;
  }
  const v = await sq(env, '/v2/catalog/object', 'POST', { idempotency_key: crypto.randomUUID(), object: { type: 'SUBSCRIPTION_PLAN_VARIATION', id: '#var', subscription_plan_variation_data: {
    name: `${PLAN_NAME} Monthly`, subscription_plan_id: planId,
    phases: [{ cadence: 'MONTHLY', ordinal: 0, pricing: { type: 'STATIC', price_money: { amount: PRICE_CENTS, currency: 'USD' } } }] } } });
  return (cache.pv = v.catalog_object.id);
}
async function activeSub(env, email) {
  const c = await sq(env, '/v2/customers/search', 'POST', { query: { filter: { email_address: { exact: email } } }, limit: 10 });
  const ids = (c.customers || []).map(x => x.id); if (!ids.length) return null;
  const s = await sq(env, '/v2/subscriptions/search', 'POST', { query: { filter: { customer_ids: ids, location_ids: [await location(env)] } } });
  return (s.subscriptions || []).find(x => x.status === 'ACTIVE') || null;
}

export async function onRequest({ request, env, params }) {
  const route = (params.path || [])[0];
  const on = !!(env.SQUARE_ACCESS_TOKEN && env.SUB_SECRET);
  if (route === 'config') return json({ enabled: on && env.PAYWALL !== 'off', price: PRICE_CENTS / 100, plan: PLAN_NAME, sandbox: env.SQUARE_ENV === 'sandbox', freePerWeek: 3 });
  if (!on || env.PAYWALL === 'off') return json({ error: 'Go Unlimited is coming soon!' }, 503);
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  let body = {}; try { body = await request.json(); } catch {}
  const email = String(body.email || '').trim().toLowerCase();
  try {
    if (route === 'checkout') {
      if (!validEmail(email)) return json({ error: 'Pop in a real email so we can find your plan later!' }, 400);
      const [loc, pv] = await Promise.all([location(env), planVariation(env)]);
      const origin = new URL(request.url).origin;
      const j = await sq(env, '/v2/online-checkout/payment-links', 'POST', { idempotency_key: crypto.randomUUID(),
        quick_pay: { name: `${PLAN_NAME} (monthly)`, price_money: { amount: PRICE_CENTS, currency: 'USD' }, location_id: loc },
        checkout_options: { subscription_plan_id: pv, redirect_url: `${origin}/?paid=1#pro`, ask_for_shipping_address: false },
        pre_populated_data: { buyer_email: email } });
      return json({ url: j.payment_link.url, id: j.payment_link.id });
    }
    if (route === 'status') {
      if (body.token) { const p = await verifyToken(env, body.token); if (p) return json({ active: true, email: p.e, token: body.token }); }
      if (!validEmail(email)) return json({ error: 'Pop in the email you used at checkout!' }, 400);
      const s = await activeSub(env, email);
      if (!s) return json({ active: false });
      return json({ active: true, email, token: await signToken(env, email), since: s.start_date });
    }
  } catch (e) { return json({ error: 'Square is having a moment. Try again!' }, 502); }
  return json({ error: 'Not found' }, 404);
}
