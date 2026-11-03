// Privacy-light usage events. POST /api/ev {event, screen, plan, dev, meta} -> Supabase RPC snap_log_event (publishable key).
// No cookies, no IP, no email, no user agent is stored. The anonymous device id from the app is hashed HERE (salted SHA-256,
// first 32 hex chars) so the database only ever sees the hash. Always answers 204 and never throws: tracking must never
// affect the app, and it is a quiet no-op while the RPC does not exist yet (PGRST202).
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../_lib/sub.js';
const EVENTS = new Set(['page_view', 'scan', 'recipes_shown', 'more_ideas', 'favorite', 'upgrade_click', 'checkout_return', 'diet_saved', 'install', 'review_card', 'review_go', 'share_recipe', 'play_banner', 'play_go']);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
// Real people only: bots, automation, owner devices and test runs are still recorded but flagged meta.kind, so the dashboard can hide them.
export const BOT_RE = /headless|playwright|puppeteer|phantomjs|selenium|webdriver|lighthouse|pagespeed|gtmetrix|bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|uptime|curl\/|wget|python-requests|node-fetch|axios|go-http|java\/|okhttp|httpclient|scrapy/i;
export const kindOf = (ua, b) => (!ua || BOT_RE.test(ua)) ? 'bot' : (b.test === 1 || b.test === true || b.test === '1') ? 'test' : b.plan === 'owner' ? 'owner' : '';
// Where a first visit came from: utm_source wins over the referrer domain. Returns one of the dashboard groups.
export function sourceGroup(utm, ref) {
  const u = String(utm || '').toLowerCase(), r = String(ref || '').toLowerCase();
  const pick = h => /instagram|(^|[^a-z])ig([^a-z]|$)/.test(h) ? 'instagram' : /tiktok/.test(h) ? 'tiktok' : /facebook|(^|[^a-z])fb([^a-z]|$)|fb\.me|messenger/.test(h) ? 'facebook' : /youtube|youtu\.be/.test(h) ? 'youtube'
    : /google|bing|duckduckgo|yahoo|ecosia|search/.test(h) ? 'google' : /mail|newsletter|email|outlook|mailchimp|klaviyo|beehiiv|substack/.test(h) ? 'email' : '';
  return (u && (pick(u) || 'other')) || (r && (pick(r) || 'other')) || 'direct';
}
const cleanTag = v => String(v || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24);
async function send(b, ua) { // resolves to a short result string (returned in the x-ev header for debugging; never any user data)
  const dev = String(b.dev || '');
  if (!EVENTS.has(b.event) || !['free', 'paid', 'owner'].includes(b.plan) || dev.length < 8 || dev.length > 100) return 'rejected-fields';
  const screen = b.screen == null ? null : String(b.screen);
  if (screen !== null && !/^[a-z_]{1,24}$/.test(screen)) return 'rejected-screen';
  let meta = {};
  if (b.meta && typeof b.meta === 'object' && !Array.isArray(b.meta)) { // counts / short labels only
    for (const [k, v] of Object.entries(b.meta).slice(0, 6)) if (/^[a-z_]{1,16}$/.test(k) && (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 24))) meta[k] = v;
  }
  const kind = kindOf(ua, b); if (kind) meta.kind = kind;
  if (b.src && typeof b.src === 'object' && b.event === 'page_view') { // first visit only (the app sends it once per device)
    const ref = cleanTag(b.src.ref), um = cleanTag(b.src.utm_source);
    meta.first = 1; meta.src = sourceGroup(um, ref); if (ref) meta.ref = ref; if (um) meta.utm = um;
    const med = cleanTag(b.src.utm_medium), cmp = cleanTag(b.src.utm_campaign); if (med) meta.med = med; if (cmp) meta.cmp = cmp;
  }
  const device_hash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('snapcravings-ev:' + dev))).slice(0, 32);
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/snap_log_event`, { method: 'POST', signal: ctl.signal,
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_event: b.event, p_screen: screen, p_plan: b.plan, p_device: device_hash, p_meta: meta }) });
    if (!r.ok) { console.log('ev rpc', r.status); return 'rpc-' + r.status; }
    return (await r.json()) === true ? 'ok' : 'rpc-rejected'; // false = validation or rate limit in the database
  } finally { clearTimeout(timer); }
}
export async function onRequest(context) {
  const { request } = context;
  const done = r => new Response(null, { status: 204, headers: { 'cache-control': 'no-store', 'x-ev': r } });
  if (request.method !== 'POST') return done('method');
  try {
    const text = await request.text();
    if (text.length > 1200) return done('too-big');
    // Awaited (not waitUntil): the database write finishes before we answer, so nothing is dropped when the isolate is recycled.
    return done(await send(JSON.parse(text), request.headers.get('user-agent') || ''));
  } catch (e) { console.log('ev err', e.name); return done('error'); }
}
