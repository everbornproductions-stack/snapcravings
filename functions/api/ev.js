// Privacy-light usage events. POST /api/ev {event, screen, plan, dev, meta} -> Supabase RPC snap_log_event (publishable key).
// No cookies, no IP, no email, no user agent is stored. The anonymous device id from the app is hashed HERE (salted SHA-256,
// first 32 hex chars) so the database only ever sees the hash. Always answers 204 and never throws: tracking must never
// affect the app, and it is a quiet no-op while the RPC does not exist yet (PGRST202).
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../_lib/sub.js';
const EVENTS = new Set(['page_view', 'scan', 'recipes_shown', 'more_ideas', 'favorite', 'upgrade_click', 'checkout_return', 'diet_saved', 'install']);
const done = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function send(b) {
  const dev = String(b.dev || '');
  if (!EVENTS.has(b.event) || !['free', 'paid', 'owner'].includes(b.plan) || dev.length < 8 || dev.length > 100) return;
  const screen = b.screen == null ? null : String(b.screen);
  if (screen !== null && !/^[a-z_]{1,24}$/.test(screen)) return;
  let meta = {};
  if (b.meta && typeof b.meta === 'object' && !Array.isArray(b.meta)) { // counts / short labels only
    for (const [k, v] of Object.entries(b.meta).slice(0, 6)) if (/^[a-z_]{1,16}$/.test(k) && (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 24))) meta[k] = v;
  }
  const device_hash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('snapcravings-ev:' + dev))).slice(0, 32);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/snap_log_event`, { method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ p_event: b.event, p_screen: screen, p_plan: b.plan, p_device: device_hash, p_meta: meta }) });
  if (!r.ok && r.status !== 404) console.log('ev rpc', r.status); // 404 = RPC not installed yet: stay quiet
}
export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') return done();
  try {
    const text = await request.text();
    if (text.length > 1200) return done();
    const p = send(JSON.parse(text)).catch(() => {});
    if (typeof context.waitUntil === 'function') context.waitUntil(p);
  } catch {}
  return done();
}
