// Dashboard data for /stats.html. POST /api/stats {key, days} -> Supabase RPC snap_stats (returns aggregates only when the
// key matches the hashed stats_key in snap_settings). The key is never logged or stored here.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../_lib/sub.js';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  let b = {}; try { b = await request.json(); } catch {}
  const key = String(b.key || '').trim(); const days = [7, 30].includes(+b.days) ? +b.days : 7;
  if (key.length < 20 || key.length > 200) return json({ error: 'Wrong key' }, 403);
  if (env.RATE_KV) { const ip = request.headers.get('cf-connecting-ip') || 'local'; const k = `stats:${ip}:${Math.floor(Date.now() / 36e5)}`; const n = +(await env.RATE_KV.get(k) || 0) + 1; await env.RATE_KV.put(k, String(n), { expirationTtl: 3700 }); if (n > 60) return json({ error: 'Too many tries' }, 429); }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/snap_stats`, { method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_key: key, p_days: days }) });
    if (r.status === 404) return json({ error: 'Stats are not set up yet (database migration pending).' }, 503);
    if (!r.ok) return json({ error: 'Stats are having a moment.' }, 502);
    const j = await r.json();
    if (j === null) return json({ error: 'Wrong key' }, 403);
    return json(j);
  } catch { return json({ error: 'Stats are having a moment.' }, 502); }
}
