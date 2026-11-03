// SnapCravings Unlimited via Stripe: a Stripe Payment Link (opened by the app) + a Supabase Edge Function webhook that records
// the subscription. This function never talks to Stripe and holds no Stripe key. It asks Supabase (RPC snap_check_sub, anon-callable,
// returns only {active, period_end, email}) and, when active, issues the signed unlock token (SUB_SECRET).
// Constants (PAYMENT_LINK_URL, PORTAL_URL, ...) live in ../../_lib/sub.js. Secret: SUB_SECRET. Var: PAYWALL=off hides it.
import { signToken, verifyToken, PAYWALL_ON, PAYMENT_LINK_URL, YEARLY_LINK_URL, YEARLY_CENTS, PORTAL_URL, PRICE_CENTS, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../_lib/sub.js';
export { PRICE_CENTS };
export const PLAN_NAME = 'SnapCravings Unlimited';
import { hourly } from '../../_lib/limit.js';
// IPv6 users get a fresh address per request (seen live from WARP), so count the /48 network, not the single address.
export const ipKey = ip => ip.includes(':') ? ip.split(':').slice(0, 3).join(':') + '::/48' : ip;
export const REDEEM_HOURLY = 8, REDEEM_WEEKLY = 20;
const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('');
// true = allowed. Fails open on a Supabase error (the per-instance cap still applies).
export async function redeemGate(env, ip, f = (env && env.__fetch) || ((...a) => fetch(...a))) { /* bare `fetch` reference throws Illegal invocation on Workers */
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 3000);
  try { const h = await sha('snapcravings-redeem:' + ip);
    const r = await f(`${SUPABASE_URL}/rest/v1/rpc/snap_scan_gate`, { method: 'POST', signal: ac.signal, headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_device: h, p_ip: h, p_scan: 'rdm-' + crypto.randomUUID().replace(/-/g, '').slice(0, 20), p_limit: REDEEM_WEEKLY, p_ip_limit: REDEEM_WEEKLY }) });
    if (!r.ok) return true; const j = await r.json(); return j?.allowed !== false;
  } catch { return true; } finally { clearTimeout(t); }
}
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
    const ip = ipKey(request.headers.get('cf-connecting-ip') || 'local');
    // Code guessing guard: 8 tries per IP per hour in this instance (shared via RATE_KV when bound), plus a Supabase-backed
    // 20 tries per IP per rolling week that holds across every isolate and colo (reuses the hashed snap_scan_gate counter
    // with its own salt and an 'rdm-' id, so it never touches real scan counts).
    if (await hourly(env, 'redeem', ip, REDEEM_HOURLY)) return json({ error: 'Too many tries. Take a snack break and try later!' }, 429);
    if (!(await redeemGate(env, ip))) return json({ error: 'Too many tries. Take a snack break and try later!' }, 429);
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
  const REISSUE_MS = 7 * 864e5;
  const email = String(body.email || '').trim().toLowerCase();
  const sid = String(body.sid || '').trim();
  try {
    if (route === 'status') {
      // A still-valid token is reused only while it has 7+ days left; near expiry we re-check Stripe and issue a fresh one,
      // so paying members don't hit the paywall when their token quietly runs out. Code/Play tokens are returned as-is.
      let oldTok = null;
      if (body.token) { const p = await verifyToken(env, body.token); if (p) { if (!validEmail(p.e) || p.x - Date.now() > REISSUE_MS) return json({ active: true, email: p.e, token: body.token }); oldTok = p; } }
      if (oldTok && !sid && !validEmail(email)) { try { const s0 = await check(oldTok.e, ''); if (s0 && s0.active) { const left = s0.period_end ? (Date.parse(s0.period_end) - Date.now()) / 864e5 + 1 : 35; return json({ active: true, email: oldTok.e, token: await signToken(env, oldTok.e, Math.max(0.1, Math.min(35, left))), until: s0.period_end || null }); } return json({ active: false }); } catch { return json({ active: true, email: oldTok.e, token: body.token }); } }
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
