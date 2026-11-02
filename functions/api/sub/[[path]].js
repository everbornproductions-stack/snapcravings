// SnapCravings Unlimited via Stripe: a Stripe Payment Link (opened by the app) + a Supabase Edge Function webhook that records
// the subscription. This function never talks to Stripe and holds no Stripe key. It asks Supabase (RPC snap_check_sub, anon-callable,
// returns only {active, period_end, email}) and, when active, issues the signed unlock token (SUB_SECRET).
// Constants (PAYMENT_LINK_URL, PORTAL_URL, ...) live in ../../_lib/sub.js. Secret: SUB_SECRET. Var: PAYWALL=off hides it.
import { signToken, verifyToken, PAYWALL_ON, PAYMENT_LINK_URL, YEARLY_LINK_URL, YEARLY_CENTS, PORTAL_URL, PRICE_CENTS, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../_lib/sub.js';
export { PRICE_CENTS };
export const PLAN_NAME = 'SnapCravings Unlimited';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const validEmail = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e || '');
const validSid = s => /^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(s || '');
async function check(email, sid) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/snap_check_sub`, { method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ p_email: email || '', p_session: sid || '' }) });
  if (!r.ok) { console.log('snap_check_sub', r.status); throw new Error('check failed'); }
  const j = await r.json(); return Array.isArray(j) ? j[0] : j;
}

export async function onRequest({ request, env, params }) {
  const route = (params.path || [])[0];
  const on = PAYWALL_ON(env);
  if (route === 'config') return json({ enabled: on, price: PRICE_CENTS / 100, plan: PLAN_NAME, freePerWeek: 3, link: on ? PAYMENT_LINK_URL : '', linkYearly: on ? YEARLY_LINK_URL : '', yearly: YEARLY_CENTS / 100, list: 4.99, portal: on ? PORTAL_URL : '' });
  if (route === 'redeem' && request.method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if (env.RATE_KV) { const k = `redeem:${ip}:${Math.floor(Date.now() / 36e5)}`; const n = +(await env.RATE_KV.get(k) || 0) + 1; await env.RATE_KV.put(k, String(n), { expirationTtl: 3700 }); if (n > 8) return json({ error: 'Too many tries. Take a snack break and try later!' }, 429); }
    let b = {}; try { b = await request.json(); } catch {}
    const code = String(b.code || '').trim().toLowerCase(); const want = String(env.OWNER_CODE || '').trim().toLowerCase();
    if (!want || !env.SUB_SECRET || !code || code.length !== want.length) return json({ error: "Hmm, that code didn't work." }, 400);
    let d = 0; for (let i = 0; i < code.length; i++) d |= code.charCodeAt(i) ^ want.charCodeAt(i);
    if (d) return json({ error: "Hmm, that code didn't work." }, 400);
    return json({ active: true, email: 'Code unlocked', token: await signToken(env, 'Code unlocked', 400) });
  }
  if (!on) return json({ error: 'Unlimited is coming soon!' }, 503);
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  let body = {}; try { body = await request.json(); } catch {}
  const email = String(body.email || '').trim().toLowerCase();
  const sid = String(body.sid || '').trim();
  try {
    if (route === 'status') {
      if (body.token) { const p = await verifyToken(env, body.token); if (p) return json({ active: true, email: p.e, token: body.token }); }
      if (sid && !validSid(sid)) return json({ error: "That checkout link didn't look right. Try Restore purchase!" }, 400);
      if (!sid && !validEmail(email)) return json({ error: 'Pop in the email you used at checkout!' }, 400);
      const s = await check(email, sid);
      if (!s || !s.active) return json({ active: false });
      const who = String(s.email || email).toLowerCase();
      // Token lasts through the paid period (+1 day), at most 35 days, so a cancel or refund stops unlocking soon after.
      const left = s.period_end ? (Date.parse(s.period_end) - Date.now()) / 864e5 + 1 : 35;
      return json({ active: true, email: who, token: await signToken(env, who, Math.max(0.1, Math.min(35, left))), until: s.period_end || null });
    }
  } catch (e) { console.log('sub route error', route, e.message); return json({ error: 'We hit a hiccup checking your plan. Try again!' }, 502); }
  return json({ error: 'Not found' }, 404);
}
