// Dashboard data for /stats.html. POST /api/stats {key, days} -> Supabase RPC snap_stats (returns aggregates only when the
// key matches the hashed stats_key in snap_settings). Also accepts the owner code (env.OWNER_CODE, constant-time compare), which
// is swapped for the real stats key server-side. Nothing secret is logged or returned.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../_lib/sub.js';
import { STATS_KEY } from '../_lib/stats_key.js'; // gitignored module
const same = (a, b) => { const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b); let d = x.length ^ y.length; for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0); return d === 0; };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  let b = {}; try { b = await request.json(); } catch {}
  let key = String(b.key || '').trim(); const days = [7, 30].includes(+b.days) ? +b.days : 7; const real = b.real !== false; // real people only unless the dashboard asks for all traffic
  if (!key || key.length > 200) { await new Promise(r => setTimeout(r, 400)); return json({ error: 'Wrong key' }, 403); }
  const owner = String(env.OWNER_CODE || '').trim();
  if (owner && STATS_KEY && same(key.toLowerCase(), owner.toLowerCase())) key = STATS_KEY;
  else if (key.length < 20) { await new Promise(r => setTimeout(r, 400)); return json({ error: 'Wrong key' }, 403); } // slow guessing (the RPC also waits on a wrong key)
  if (env.RATE_KV) { const ip = request.headers.get('cf-connecting-ip') || 'local'; const k = `stats:${ip}:${Math.floor(Date.now() / 36e5)}`; const n = +(await env.RATE_KV.get(k) || 0) + 1; await env.RATE_KV.put(k, String(n), { expirationTtl: 3700 }); if (n > 60) return json({ error: 'Too many tries' }, 429); }
  try {
    const call = args => fetch(`${SUPABASE_URL}/rest/v1/rpc/snap_stats`, { method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    let r = await call({ p_key: key, p_days: days, p_real: real }), legacy = false;
    if (r.status === 404) { r = await call({ p_key: key, p_days: days }); legacy = true; } // new migration (20261103) not applied yet: old function, all traffic
    if (r.status === 404) return json({ error: 'Stats are not set up yet (database migration pending).' }, 503);
    if (!r.ok) return json({ error: 'Stats are having a moment.' }, 502);
    const j = await r.json();
    if (j === null) return json({ error: 'Wrong key' }, 403);
    if (legacy) { j.legacy = true; j.real_only = false; }
    return json(j);
  } catch { return json({ error: 'Stats are having a moment.' }, 502); }
}
