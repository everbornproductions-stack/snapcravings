// GET /api/trending?lang=xx[&country=XX] -> {source, country, items:[{label, emoji, n?, holiday?}]}. Cached ~1 h per country+lang+day.
// POST /api/trending {made: '<recipe name>'} records a favorited ("made") dish. See functions/_lib/trending.js.
import '../../web/holiday.js';
import { rpc } from '../_lib/recipelib.js';
import { mergePopular, trendHit, popularFor } from '../_lib/trending.js';
import { langCode } from '../_lib/lang.js';
const json = (o, s = 200, cache = 'no-store') => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': cache } });
export async function onRequest({ request, env, waitUntil }) {
  const url = new URL(request.url), cfc = String(request.cf?.country || '').toUpperCase();
  if (request.method === 'POST') {
    let b = {}; try { b = await request.json(); } catch {}
    const dev = String(request.headers.get('x-sc-dev') || '').replace(/[^\w-]/g, '').slice(0, 64);
    const p = trendHit(env, { country: cfc, kind: 'made', label: b.made, lang: langCode(b.lang || request.headers.get('x-sc-lang')), device: dev });
    try { waitUntil ? waitUntil(p) : await p; } catch {}
    return new Response(null, { status: 204 });
  }
  const lang = langCode(url.searchParams.get('lang')); const country = (url.searchParams.get('country') || cfc || globalThis.SC_HOLIDAY.LANG_COUNTRY[lang] || 'XX').toUpperCase().slice(0, 2);
  const S = globalThis.SC_HOLIDAY, now = new Date(Date.now() + (+url.searchParams.get('tz') || 0) * -60000); // tz = client getTimezoneOffset()
  const hq = url.searchParams.get('holiday'), hid = hq === 'off' ? null : S.H[hq] && S.setFor(country).includes(hq) ? hq : S.active(new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()), country)?.id;
  const ck = `https://sc-cache.internal/trend3/${country}/${lang}/${hid || '-'}/${new Date().toISOString().slice(0, 13)}`;
  const c = typeof caches !== 'undefined' && caches.default;
  if (c && !env.__fetch && !env.__libStore) { const hit = await c.match(ck).catch(() => null); if (hit) return new Response(hit.body, hit); }
  const top = async p => { const s = await rpc(env, 'snap_trend_top', { p_country: p, p_lang: lang, p_days: 7, p_min: 3, p_limit: 10 }, 2000); return Array.isArray(s.data) ? s.data : []; };
  const local = country === 'XX' ? [] : await top(country), all = []; // per country only (Chris: each country shows its own popular dishes)
  const h = hid ? S.info(hid, lang) : null;
  const holiday = h ? { id: hid, emoji: h.emoji, dishes: lang === 'en' ? h.dishes.split(/,\s*|\s+and\s+/).map(d => d.replace(/^(iftar dishes|eid feast|sweets like|party bites)\s*:?\s*/i, '').trim()).filter(Boolean).map(d => d[0].toUpperCase() + d.slice(1)) : [h.name] } : null;
  const out = { ...mergePopular({ local, all, holiday, statics: popularFor(country, lang) }), country };
  const res = json(out, 200, 'public, max-age=3600');
  if (c && !env.__fetch && !env.__libStore) { const p = c.put(ck, res.clone()).catch(() => {}); try { waitUntil ? waitUntil(p) : null; } catch {} }
  return res;
}
