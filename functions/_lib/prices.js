// Real grocery prices (2026-11-02). Layered on top of functions/_lib/cost.js without changing it:
// 1) Kroger store prices by ZIP (only when KROGER_CLIENT_ID + KROGER_CLIENT_SECRET are set) -> tag 'store'
// 2) BLS CPI average prices, US + 4 Census regions (functions/_lib/bls-prices.json, rebuilt by scripts/bls/build.mjs) -> tag 'regional'
// 3) everything else keeps the anchor/AI price from cost.js -> 'estimate'.
// Prices here are US$ per the cost.js unit (kg | l | ea), the same rows cost.js uses, so linePrice math stays identical.
import BLS from './bls-prices.js';
import { find, amount } from './cost.js';
const NE = 'CT ME MA NH RI VT NJ NY PA', MW = 'IL IN MI OH WI IA KS MN MO NE ND SD', S = 'DE DC FL GA MD NC SC VA WV AL KY MS TN AR LA OK TX';
export const regionOf = st => { st = String(st || '').toUpperCase(); if (!/^[A-Z]{2}$/.test(st)) return 'US'; return NE.includes(st) ? 'NE' : MW.includes(st) ? 'MW' : S.includes(st) ? 'S' : 'AK AZ CA CO HI ID MT NV NM OR UT WA WY'.includes(st) ? 'W' : 'US'; };
// BLS price for a canonical ingredient (cost.js key) in a region; falls back to the US average.
export function blsPrice(key, region) { const it = BLS.items[key]; if (!it) return null; const p = it.p[region] ?? it.p.US; return p == null ? null : { p, u: it.u, region: it.p[region] != null ? region : 'US' }; }
export const BLS_PERIOD = BLS.period;

/* ---------- Kroger (off until the env vars exist) ---------- */
const KB = 'https://api.kroger.com/v1';
let tok = null; // { t, exp } per isolate
const cache = () => (typeof caches !== 'undefined' && caches.default) || null;
const CU = p => 'https://sc-cache.internal/kroger/' + p;
async function cget(p) { try { const r = await cache()?.match(CU(p)); return r ? await r.json() : null; } catch { return null; } }
async function cput(p, v, sec) { try { await cache()?.put(CU(p), new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + sec } })); } catch {} }
export const krogerOn = env => !!(env?.KROGER_CLIENT_ID && env?.KROGER_CLIENT_SECRET);
async function token(env, f) {
  if (tok && tok.exp > Date.now() + 60e3) return tok.t;
  const r = await f(KB + '/connect/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + btoa(env.KROGER_CLIENT_ID + ':' + env.KROGER_CLIENT_SECRET) }, body: 'grant_type=client_credentials&scope=product.compact' });
  if (!r.ok) throw new Error('kroger token ' + r.status); const j = await r.json(); tok = { t: j.access_token, exp: Date.now() + (+j.expires_in || 1800) * 1000 }; return tok.t;
}
async function kget(env, f, path) { const r = await f(KB + path, { headers: { accept: 'application/json', authorization: 'Bearer ' + await token(env, f) } }); if (!r.ok) throw new Error('kroger ' + r.status); return r.json(); }
// Nearest store for a ZIP (or lat/long), cached 7 days.
export async function krogerStore(env, { zip, lat, lon }, f = env.__fetch || fetch) {
  const q = /^\d{5}$/.test(zip || '') ? 'filter.zipCode.near=' + zip : lat && lon ? `filter.latLong.near=${(+lat).toFixed(2)},${(+lon).toFixed(2)}` : ''; if (!q) return null;
  const ck = 'loc/' + q.replace(/[^\w.,-]/g, '_'); const hit = await cget(ck); if (hit) return hit.id || null;
  const j = await kget(env, f, `/locations?${q}&filter.radiusInMiles=15&filter.limit=1`); const l = j?.data?.[0];
  const v = { id: l?.locationId || null, name: l?.name || '' }; await cput(ck, v, 604800); return v.id;
}
// "16 oz" / "1 gal" / "1 lb" / "12 ct" / "2.5 lb bag" -> amount in the cost.js unit (kg | l | ea).
export function sizeTo(size, u) {
  const m = String(size || '').toLowerCase().match(/(\d+(?:\.\d+)?)\s*(fl oz|oz|lb|lbs|g|kg|gal|qt|pt|l|ml|ct|count|pk|each|ea)\b/); if (!m) return 0; const n = +m[1], x = m[2];
  if (u === 'kg') return { oz: 0.02835, lb: 0.4536, lbs: 0.4536, g: 0.001, kg: 1 }[x] * n || 0;
  if (u === 'l') return { 'fl oz': 0.02957, gal: 3.7854, qt: 0.9464, pt: 0.4732, l: 1, ml: 0.001 }[x] * n || 0;
  return ['ct', 'count', 'pk', 'each', 'ea'].includes(x) ? n : 0;
}
// Cheapest per-unit regular (or promo) price among the top matches, cached 24 h per store + ingredient.
export async function krogerPrice(env, store, key, u, f = env.__fetch || fetch) {
  const ck = `p/${store}/${key.replace(/\W+/g, '_')}`; const hit = await cget(ck); if (hit) return hit.p ?? null;
  const j = await kget(env, f, `/products?filter.term=${encodeURIComponent(key)}&filter.locationId=${store}&filter.limit=8`); let best = null;
  for (const pr of j?.data || []) for (const it of pr.items || []) { const pz = +(it.price?.promo || 0) || +(it.price?.regular || 0), a = sizeTo(it.size, u); if (pz > 0 && a > 0) { const per = pz / a; if (!best || per < best) best = per; } }
  const v = { p: best ? Math.round(best * 1000) / 1000 : null }; await cput(ck, v, 86400); return v.p;
}

/* ---------- apply to a /api/crave answer (after steadyCost) ---------- */
// Recomputes the lines we have a real price for, moves est_cook_cost by the difference vs the anchor price, and tags sources.
// geo = { cc, state, zip, lat, lon }. Non-US countries pass through untouched (anchors from web/money.js stay).
export async function realPrices(env, data, geo, { budgetMs = 2500 } = {}) {
  const r = data?.recipe; if (!r || geo?.cc !== 'US') return data;
  const region = regionOf(geo.state), serv = Math.max(1, +r.servings || 2), t0 = Date.now(); let store = null;
  if (krogerOn(env)) { try { store = await Promise.race([krogerStore(env, geo), new Promise(res => setTimeout(() => res(null), budgetMs))]); } catch {} }
  const priceOf = async key => { // -> { p, u, src }
    const b = blsPrice(key, region), row = find(key)?.[1];
    if (store && row && Date.now() - t0 < budgetMs) { try { const kp = await Promise.race([krogerPrice(env, store, key, row[1]), new Promise(res => setTimeout(() => res(null), Math.max(200, budgetMs - (Date.now() - t0))))]); if (kp) return { p: kp, u: row[1], src: 'store' }; } catch {} }
    return b ? { p: b.p, u: b.u, src: 'regional', region: b.region } : null;
  };
  const memo = {}; const get = key => (memo[key] ||= priceOf(key));
  const line = async (i, pack) => { const f = find(i.en || i.item); if (!f) return null; const [key, row] = f; const rp = await get(key); if (!rp || rp.u !== row[1]) return null;
    const a = amount(i.qty, row); if (!a) return null; let units = row[1] === 'ea' ? a : a / 1000; if (pack) units = Math.max(units, row[3]);
    return { real: rp.p * units, anchor: row[0] * units, src: rp.src, key }; };
  const ings = (r.ingredients || []).filter(i => i && i.item); let delta = 0; const src = { store: 0, regional: 0 }, keys = [];
  // Only the cook cost from steadyCost may be cached for another serving count: scale the delta the same way.
  const ls = await Promise.all(ings.map(i => line(i, false)));
  ls.forEach((l, n) => { if (!l) return; delta += l.real - l.anchor; src[l.src]++; keys.push(l.key); ings[n] = { ...ings[n], priceSrc: l.src }; });
  const missing = await Promise.all((r.missing || []).map(async m => { const l = await line(m, true); return l ? { ...m, est_price: Math.round(l.real * 100) / 100, priceSrc: l.src } : m; }));
  const known = src.store + src.regional; if (!known && !missing.some(m => m.priceSrc)) return data;
  const total = Math.max(0.5 * serv, Math.round(((+data.est_cook_cost || 0) + delta) * 100) / 100);
  return { ...data, est_cook_cost: total, recipe: { ...r, ingredients: (r.ingredients || []).map(i => ings.find(x => x.item === i.item && x.qty === i.qty) || i), missing },
    priceSrc: { kind: src.store ? 'store' : 'regional', store: src.store, regional: src.regional, of: ings.length, region, period: BLS.period, keys } };
}
