// Trending "Popular cravings" (2026-11-02). Dishes people picked (/api/crave answers) or made (favorited) in the last 7 days,
// per country when there is enough data, else across all countries, else the built-in list. Holiday dishes are blended in
// during a holiday window. Storage: Supabase snap_trend_hits (supabase/migrations/20261102_snapcravings_trending.sql).
import { rpc, libKey } from './recipelib.js';
import { sha } from './extras.js';
export const MIN_DEVICES = 3, MIN_ITEMS = 3, SHOW = 5;
export const STATIC = [['Pad thai', '🍜'], ['Pizza', '🍕'], ['Tacos', '🌮'], ['Burger', '🍔'], ['Sushi', '🍣']];
const BAD = /\b(fuck|shit|cunt|nigg|fag|rape|porn|sex|nazi|kill|drug|weed|cocaine|piss|dick|cock|pussy|bitch|whore)/i;
export const normDish = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 48);
export const okDish = s => { const n = normDish(s); return n.length >= 2 && n.length <= 48 && !BAD.test(n) && !/https?|www|\d{4,}/.test(String(s)); };
const cc = c => /^[A-Z]{2}$/.test(String(c || '').toUpperCase()) ? String(c).toUpperCase() : 'XX';
// Record one pick/make. Fire-and-forget from the server; never throws.
export async function trendHit(env, { country, kind, label, lang, device }) {
  try { if (!okDish(label) || !device) return false; const c = cc(country); if (c === 'XX') return false;
    const s = await rpc(env, 'snap_trend_hit', { p_key: await libKey(env), p_country: c, p_kind: kind === 'made' ? 'made' : 'crave', p_name: normDish(label), p_label: String(label).trim().slice(0, 48), p_lang: lang || 'en', p_device: await sha('snap-trend:' + device, 32) }, 2500);
    return s.data === true; } catch { return false; }
}
// Pure merge: trending rows (country first, then ALL) + optional holiday dishes, else the static list. Always SHOW items, no duplicates.
export function mergePopular({ local = [], all = [], holiday = null, min = MIN_DEVICES, minItems = MIN_ITEMS, show = SHOW } = {}) {
  const good = rows => (rows || []).filter(r => r && r.n >= min && okDish(r.label));
  const L = good(local), A = good(all); let src = 'static', base = [];
  if (L.length >= minItems) { src = 'country'; base = L; } else if (A.length >= minItems) { src = 'global'; base = A; }
  const out = [], seen = new Set(); const push = (label, emoji, extra = {}) => { const k = normDish(label); if (!k || seen.has(k) || out.length >= show) return; seen.add(k); out.push({ label, emoji, ...extra }); };
  if (holiday) (holiday.dishes || []).slice(0, 2).forEach(d => push(d, holiday.emoji, { holiday: holiday.id }));
  if (src !== 'static') base.forEach(r => push(r.label, '🔥', { n: r.n }));
  STATIC.forEach(([l, e]) => push(l, e));
  return { source: src, items: out };
}
