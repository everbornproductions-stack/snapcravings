// POST /api/play/verify {purchaseToken} -> same signed unlock token as Stripe subs (SUB_SECRET), valid through the paid period, capped at 35 days (the app re-checks Play after that).
import { signToken } from '../../_lib/sub.js';
import { saKey, checkPlaySub } from '../../_lib/play.js';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  let b = {}; try { b = await request.json(); } catch {}
  const tok = String(b.purchaseToken || '');
  if (!/^[A-Za-z0-9._\-]{20,600}$/.test(tok)) return json({ error: "That purchase didn't look right. Try Restore purchase!" }, 400);
  const sa = saKey(env);
  if (!sa || !sa.private_key || !env.SUB_SECRET) return json({ error: 'We hit a hiccup checking your plan. Try again!' }, 503);
  try {
    const s = await checkPlaySub(sa, tok, env.__fetch || fetch);
    if (!s.active) return json({ active: false });
    const days = Math.max(0.1, Math.min(35, (s.until - Date.now()) / 864e5 + 1));
    return json({ active: true, email: 'Google Play', token: await signToken(env, 'play:' + (s.orderId || 'sub'), days), until: new Date(s.until).toISOString() });
  } catch (e) { console.log('play verify', e.message); return json({ error: 'We hit a hiccup checking your plan. Try again!' }, 502); }
}
