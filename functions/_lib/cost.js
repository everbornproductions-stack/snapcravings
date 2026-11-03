// Consistent cook cost (2026-11-02). The AI's own cost guess swung a lot for the same dish (pad thai $4.30 vs $10), so:
// 1) each ingredient with a known anchor price (US$ per kg / l / each at US price levels, scaled to the country by
//    web/money.js fx x grocery level) is priced from its quantity; 2) only unknown items use the AI's share;
// 3) the per-serving result is clamped to a believable local range; 4) the answer is cached per dish + country + diet
//    (Cloudflare cache, then the Supabase recipe library under lang 'cost:CC'), so the same dish gives the same number.
import '../../web/money.js';
import { normIngredient, rpc, libKey } from './recipelib.js';
import { sha } from './extras.js';
import INTL from './intl-prices.js';
// Real local prices (scripts/intl/build.mjs: Open Prices, ONS, DIEESE, ...) in the country's own currency per row unit.
// Lookup order: country data first, then the US table scaled by money.js, then the AI share for unknown items.
export function localPrice(key, cc) { const c = INTL.c[String(cc || '').toUpperCase()], it = c && c.i[key]; if (!it || c.cur !== globalThis.SC_MONEY.of(cc).c || !P[key] || it.u !== P[key][1]) return null; return it; }
// name: [US$ per unit, unit ('kg' | 'l' | 'ea'), grams (or ml) per "each" piece, smallest pack in the unit]
export const P = {
  'chicken breast': [9, 'kg', 200, 0.5], chicken: [7, 'kg', 200, 0.5], 'chicken thigh': [6.5, 'kg', 120, 0.5], 'ground beef': [11, 'kg', 0, 0.45], beef: [16, 'kg', 0, 0.45], steak: [22, 'kg', 250, 0.3],
  pork: [9, 'kg', 0, 0.5], 'pork chop': [9, 'kg', 200, 0.5], bacon: [13, 'kg', 25, 0.34], ham: [12, 'kg', 30, 0.2], sausage: [10, 'kg', 75, 0.4], 'ground pork': [9, 'kg', 0, 0.45], lamb: [20, 'kg', 0, 0.45],
  shrimp: [20, 'kg', 15, 0.34], salmon: [24, 'kg', 150, 0.3], 'white fish': [16, 'kg', 150, 0.4], tuna: [12, 'kg', 0, 0.14], tofu: [5, 'kg', 0, 0.4], egg: [0.35, 'ea', 50, 12],
  milk: [1.1, 'l', 0, 1], butter: [10, 'kg', 0, 0.25], cheese: [12, 'kg', 0, 0.2], parmesan: [25, 'kg', 0, 0.15], mozzarella: [11, 'kg', 0, 0.2], cream: [5, 'l', 0, 0.25], 'heavy cream': [5, 'l', 0, 0.25],
  yogurt: [4.5, 'kg', 0, 0.5], 'sour cream': [5, 'kg', 0, 0.25], rice: [3, 'kg', 0, 1], pasta: [3.5, 'kg', 0, 0.45], spaghetti: [3.5, 'kg', 0, 0.45], noodle: [5, 'kg', 0, 0.4], 'rice noodle': [6, 'kg', 0, 0.4],
  flour: [1.5, 'kg', 0, 1], bread: [5, 'kg', 30, 0.5], tortilla: [0.3, 'ea', 40, 10], potato: [2.2, 'kg', 200, 1], 'sweet potato': [3, 'kg', 250, 0.5], onion: [2.2, 'kg', 150, 0.5], 'red onion': [3, 'kg', 150, 0.5],
  garlic: [10, 'kg', 5, 0.1], ginger: [9, 'kg', 0, 0.1], tomato: [4.5, 'kg', 120, 0.5], 'canned tomato': [3, 'kg', 0, 0.4], 'tomato paste': [6, 'kg', 0, 0.17], 'tomato sauce': [3.5, 'kg', 0, 0.4], carrot: [2.2, 'kg', 70, 0.5],
  'bell pepper': [6, 'kg', 150, 0.3], cucumber: [3, 'kg', 300, 0.3], lettuce: [5, 'kg', 300, 0.3], spinach: [9, 'kg', 0, 0.15], broccoli: [5, 'kg', 300, 0.4], cabbage: [2, 'kg', 900, 0.5], mushroom: [8, 'kg', 15, 0.2],
  zucchini: [4, 'kg', 200, 0.4], 'green onion': [12, 'kg', 15, 0.1], cilantro: [15, 'kg', 0, 0.05], parsley: [15, 'kg', 0, 0.05], basil: [30, 'kg', 0, 0.03], lime: [0.4, 'ea', 60, 3], lemon: [0.6, 'ea', 100, 3],
  avocado: [1.2, 'ea', 170, 1], 'bean sprout': [6, 'kg', 0, 0.2], peanut: [9, 'kg', 0, 0.2], 'peanut butter': [7, 'kg', 0, 0.45], 'black bean': [3, 'kg', 0, 0.43], bean: [3, 'kg', 0, 0.43], chickpea: [3, 'kg', 0, 0.43], lentil: [4, 'kg', 0, 0.45],
  corn: [4, 'kg', 0, 0.4], pea: [4, 'kg', 0, 0.4], 'coconut milk': [5, 'l', 0, 0.4], 'soy sauce': [8, 'l', 0, 0.15], 'fish sauce': [10, 'l', 0, 0.2], 'oyster sauce': [12, 'l', 0, 0.25], 'sesame oil': [18, 'l', 0, 0.15],
  'olive oil': [12, 'l', 0, 0.5], vinegar: [4, 'l', 0, 0.5], honey: [14, 'kg', 0, 0.34], sugar: [2, 'kg', 0, 1], 'brown sugar': [3, 'kg', 0, 0.9], tamarind: [12, 'kg', 0, 0.2], 'chili sauce': [10, 'l', 0, 0.25], sriracha: [10, 'l', 0, 0.25],
  'curry paste': [20, 'kg', 0, 0.11], 'curry powder': [30, 'kg', 0, 0.05], 'garam masala': [35, 'kg', 0, 0.05], cumin: [30, 'kg', 0, 0.05], paprika: [30, 'kg', 0, 0.05], 'chili powder': [25, 'kg', 0, 0.05], breadcrumb: [6, 'kg', 0, 0.25],
  'chicken broth': [3, 'l', 0, 1], broth: [3, 'l', 0, 1], stock: [3, 'l', 0, 1], wine: [10, 'l', 0, 0.75], apple: [4.5, 'kg', 180, 1], banana: [1.6, 'kg', 120, 1], 'black pepper': [40, 'kg', 0, 0.05]
};
const U = { g: 1, gram: 1, grams: 1, kg: 1000, mg: 0.001, ml: 1, l: 1000, litre: 1000, liter: 1000, oz: 28, ounce: 28, lb: 454, lbs: 454, pound: 454, cup: 240, cups: 240, tbsp: 15, tablespoon: 15, tablespoons: 15, tsp: 5, teaspoon: 5, teaspoons: 5, clove: 5, cloves: 5, can: 400, cans: 400, pinch: 0.5, handful: 30, bunch: 80, slice: 25, slices: 25 };
const num = s => { const m = String(s || '').replace(',', '.').match(/(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?|([½¼¾])/); if (!m) return 0; if (m[3]) return { '½': 0.5, '¼': 0.25, '¾': 0.75 }[m[3]]; return m[2] ? +m[1] / +m[2] : +m[1]; };
const simple = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\([^)]*\)/g, ' ').replace(/,.*$/, '').replace(/[^a-z ]+/g, ' ').trim().split(/\s+/).map(w => w.length > 3 ? w.replace(/(oes|ches|shes)$/, m => m.slice(0, -2)).replace(/ies$/, 'y').replace(/([^s])s$/, '$1') : w).join(' ');
const sfx = n => { const w = n.split(' '); for (let k = Math.min(3, w.length); k >= 1; k--) { const t = w.slice(-k).join(' '); if (P[t]) return [t, P[t]]; } return null; };
export function find(name) { const s0 = simple(name); const hit = s0 && sfx(s0); if (hit) return hit; const n = normIngredient(name); if (!n) return null; if (P[n]) return [n, P[n]]; const w = n.split(' '); for (let k = w.length - 1; k >= 1; k--) { const t = w.slice(-k).join(' '); if (P[t]) return [t, P[t]]; } for (const x of w) if (P[x]) return [x, P[x]]; return null; }
// Short source name for the UI label, e.g. 'ONS Jan 2026', 'DIEESE 09/2026', 'Open Prices'.
const SRCN = { ons: 'ONS', dieese: 'DIEESE', openprices: 'Open Prices', profeco: 'PROFECO', dca: 'DCA' };
export function srcLabel(it) { if (!it) return ''; const n = SRCN[it.src] || it.src, per = String(it.period || ''); if (it.src === 'openprices' || !per) return n; const m = per.match(/^([a-z]{3})[a-z]*\s+(\d{4})$/i); return n + ' ' + (m ? m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] : per); }
// Which ingredient lines are priced from local country data, and from which sources (for the label).
export function localUse(items, cc) { const srcs = new Set(); let n = 0; for (const i of items || []) { const f = i && find(i.en || i.item); const it = f && localPrice(f[0], cc); if (it) { n++; srcs.add(srcLabel(it)); } } return { n, srcs: [...srcs] }; }
// Grams/ml (or pieces for 'ea' items) of one ingredient line; 0 when unparseable.
export function amount(qty, row) {
  const q = String(qty || '').toLowerCase(); const n = num(q); if (!n) return 0;
  const u = (q.match(/(\d|\s|^)(kg|mg|g|grams?|ml|l|litre|liter|oz|ounces?|lbs?|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?|cloves?|cans?|pinch|handful|bunch|slices?)\b/) || [])[2];
  if (row[1] === 'ea') return u && U[u] && row[2] ? n * U[u] / row[2] : n;
  if (u) return n * U[u]; return row[2] ? n * row[2] : 0; // bare count: pieces x weight per piece
}
// Local price of one ingredient line (or null if unknown). pack=true: what you pay at the store (at least the smallest pack).
export function linePrice(item, qty, cc, pack = false) {
  const f = find(item); if (!f) return null; const row = f[1], k = globalThis.SC_MONEY.of(cc); const a = amount(qty, row); if (!a) return null;
  let units = row[1] === 'ea' ? a : a / 1000; if (pack) units = Math.max(units, row[3]);
  const loc = localPrice(f[0], cc); return (loc ? loc.p : row[0] * k.fx * k.g) * units;
}
// Cook cost for a recipe (what it uses) + store prices for the missing items, all in local money.
export function costRecipe(r, aiCost, cc) {
  const M = globalThis.SC_MONEY, k = M.of(cc), serv = Math.max(1, +r.servings || 2);
  const ings = (r.ingredients || []).filter(i => i && i.item); let known = 0, nKnown = 0, nLocal = 0;
  ings.forEach(i => { const p = linePrice(i.en || i.item, i.qty, cc); if (p != null) { known += p; nKnown++; const f = find(i.en || i.item); if (f && localPrice(f[0], cc)) nLocal++; } });
  const unknown = ings.length - nKnown, ai = Math.max(0, +aiCost || 0);
  // Unknown items: their share of the AI total (staples like salt/oil are cheap, so cap each at 1.5 US$-equivalent).
  const unk = ings.length ? Math.min(ai * unknown / ings.length, unknown * 1.5 * k.fx * k.g) : ai;
  const lo = 1.5 * k.fx * k.g * serv, hi = 12 * k.fx * k.g * serv; // believable: 1.5 to 12 US$-equivalent per serving
  const total = M.round(Math.min(hi, Math.max(lo, known + unk)), k.c);
  const missing = (r.missing || []).map(m => { const p = linePrice(m.en || m.item, m.qty, cc, true); return { ...m, est_price: p != null ? M.round(p, k.c) : m.est_price }; });
  return { total, missing, known: nKnown, of: ings.length, local: nLocal };
}
// Cache per dish + country + diet tags: Cloudflare cache (per colo, 30 days) then the Supabase library (global).
export const costKey = async (dish, cc, tags = []) => sha('cost2|' + String(dish || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + '|' + cc + '|' + [...tags].sort().join(','), 32);
const CK = k => 'https://sc-cache.internal/cost/' + k;
export async function costGet(env, key, cc) {
  try { const c = typeof caches !== 'undefined' && caches.default; if (c) { const r = await c.match(CK(key)); if (r) return await r.json(); } } catch {}
  const s = await rpc(env, 'snap_lib_find', { p_lang: 'cost:' + cc, p_section: 'more', p_craving: 'c:' + key, p_ings: ['cost'], p_limit: 1 }, 1200).catch(() => ({}));
  const v = Array.isArray(s?.data) && s.data[0]?.recipe; if (v && v.total > 0) { costPutLocal(key, v); return v; } return null;
}
const costPutLocal = async (key, v) => { try { const c = typeof caches !== 'undefined' && caches.default; if (c) await c.put(CK(key), new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=2592000' } })); } catch {} };
export async function costPut(env, key, cc, v) {
  await costPutLocal(key, v);
  const lk = await libKey(env); if (!lk) return;
  await rpc(env, 'snap_lib_save', { p_key: lk, p_rows: [{ id: key, lang: 'cost:' + cc, section: 'more', craving: 'c:' + key, diet_tags: [], pref_key: '', level: 'cost', recipe: { name: 'cost', ...v }, ings: ['cost'], extras: [] }] }, 3000).catch(() => {});
}
