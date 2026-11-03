// Rebuilds functions/_lib/intl-prices.js: real local grocery prices per country, as overrides for the cost.js rows.
// Run: node scripts/intl/build.mjs   (node fetch-op.mjs first refreshes the Open Prices cache op-raw.json)
// Every number comes from a downloaded official/open dataset. A source that is unreachable is skipped, never guessed.
// Prices are stored in the country's own currency per cost.js unit (kg | l | ea) with a source tag and sample size.
import fs from 'node:fs';
import '../../web/money.js';
import { P } from '../../functions/_lib/cost.js';
const H = { 'user-agent': 'Mozilla/5.0 (SnapCravings price refresh; bot@local)' };
const med = a => { a = [...a].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const r3 = v => Math.round(v * 1000) / 1000;
const out = { generated: new Date().toISOString().slice(0, 10), sources: {}, c: {} };
const put = (cc, key, p, n, src, period) => { if (!P[key] || !(p > 0)) return; const c = (out.c[cc] ||= { cur: globalThis.SC_MONEY.of(cc).c, i: {} }); const old = c.i[key]; if (old && old.src !== 'openprices' ) return; c.i[key] = { p: r3(p), u: P[key][1], n, src, period }; };
const log = [];

/* 1) Open Prices (Open Food Facts), ODbL: raw-food (category) prices, per-country median, >=3 prices in the last 18 months */
const OP = { 'en:tomatoes': 'tomato', 'en:potatoes': 'potato', 'en:onions': 'onion', 'en:yellow-onions': 'onion', 'en:red-onions': 'red onion', 'en:carrots': 'carrot',
  'en:cucumbers': 'cucumber', 'en:zucchini': 'zucchini', 'en:avocados': 'avocado', 'en:lemons': 'lemon', 'en:limes': 'lime', 'en:garlic': 'garlic', 'en:ginger': 'ginger',
  'en:mushrooms': 'mushroom', 'en:broccoli': 'broccoli', 'en:cabbages': 'cabbage', 'en:lettuces': 'lettuce', 'en:spinachs': 'spinach', 'en:spinach': 'spinach',
  'en:red-bell-peppers': 'bell pepper', 'en:bell-peppers': 'bell pepper', 'en:peppers': 'bell pepper', 'en:sweet-potatoes': 'sweet potato', 'en:apples': 'apple',
  'en:bananas': 'banana', 'en:scallions': 'green onion', 'en:parsley': 'parsley', 'en:basil': 'basil', 'en:corianders': 'cilantro' };
try {
  const f = new URL('./op-raw.json', import.meta.url); if (!fs.existsSync(f)) await import('./fetch-op.mjs');
  const raw = JSON.parse(fs.readFileSync(f)); const since = new Date(Date.now() - 548 * 864e5).toISOString().slice(0, 10); const g = {};
  for (const x of raw) { const key = OP[x.tag]; if (!key || !x.cc || x.cc === 'US' || !(x.price > 0) || (x.date || '') < since) continue;
    const row = P[key]; if (x.cur !== globalThis.SC_MONEY.of(x.cc).c) continue; // country not in money.js (falls back to USD) or a foreign currency
    let v = null; if (row[1] === 'kg' && x.per === 'KILOGRAM') v = x.price; else if (row[1] === 'ea' && x.per === 'UNIT') v = x.price; else if (row[1] === 'ea' && x.per === 'KILOGRAM' && row[2]) v = x.price * row[2] / 1000;
    if (v != null) ((g[x.cc] ||= {})[key] ||= []).push(v); }
  for (const [cc, ks] of Object.entries(g)) for (const [k, a] of Object.entries(ks)) if (a.length >= 3) put(cc, k, med(a), a.length, 'openprices', 'last 18 months');
  out.sources.openprices = { name: 'Open Prices (Open Food Facts)', url: 'https://prices.openfoodfacts.org', license: 'ODbL', note: 'median of crowd-sourced shelf/receipt prices, raw foods, >=3 prices' };
} catch (e) { log.push('openprices skipped: ' + e.message); }

/* 2) UK ONS CPI price quotes, OGL v3. Latest month that still has food items (food moved to scanner data in 2026). */
const ONS = { '210403': ['ground beef', 1], '210406': ['steak', 1], '210416': ['beef', 1], '210506': ['lamb', 1], '210707': ['pork chop', 1], '210808': ['bacon', 1],
  '210905': ['chicken', 1], '210910': ['chicken breast', 1], '211014': ['sausage', 1], '211101': ['white fish', 1], '211105': ['salmon', 1], '211106': ['shrimp', 1],
  '211501': ['cheese', 1], '211510': ['parmesan', 1], '211604': ['egg', 1 / 12], '211710': ['milk', 1 / 1.136], '212101': ['sugar', 1], '210201': ['flour', 1 / 1.5],
  '210204': ['pasta', 2], '212310': ['potato', 1], '212515': ['tomato', 1], '212516': ['cabbage', 1], '212518': ['carrot', 1], '212519': ['onion', 1],
  '212520': ['mushroom', 1], '212530': ['broccoli', 1], '212531': ['zucchini', 1], '212717': ['apple', 1], '212719': ['banana', 1], '212732': ['lemon', 1],
  '212710': ['avocado', 1], '212601': ['canned tomato', 1 / 0.4] };
const csvRow = l => { const o = []; let s = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(s); s = ''; } else s += ch; } o.push(s); return o; };
const MON = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
try {
  let done = false;
  for (let back = 0; back < 24 && !done; back++) {
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back); const y = d.getUTCFullYear(), m = d.getUTCMonth(), ym = y + String(m + 1).padStart(2, '0');
    const u = `https://www.ons.gov.uk/file?uri=/economy/inflationandpriceindices/datasets/consumerpriceindicescpiandretailpricesindexrpiitemindicesandpricequotes/pricequotes${MON[m]}${y}/upload-pricequotes${ym}.csv`;
    const r = await fetch(u, { headers: H }); if (!r.ok) continue; const t = await r.text(); const L = t.split(/\r?\n/); const h = csvRow(L[0]);
    const iI = h.indexOf('ITEM_ID'), iV = h.indexOf('VALIDITY'), iP = h.indexOf('PRICE'); if (iI < 0) continue; // no item-level food quotes this month
    const g = {}; for (const l of L.slice(1)) { if (!l) continue; const c = csvRow(l); if (String(c[iV]).toLowerCase() !== 'true' || !ONS[c[iI]] || !(+c[iP] > 0)) continue; (g[c[iI]] ||= []).push(+c[iP]); }
    if (!g['212515']) continue;
    for (const [id, a] of Object.entries(g)) if (a.length >= 20) put('GB', ONS[id][0], med(a) * ONS[id][1], a.length, 'ons', MON[m] + ' ' + y);
    out.sources.ons = { name: 'ONS consumer price inflation item price quotes', url: u, license: 'Open Government Licence v3.0', note: 'median of valid local price quotes, ' + MON[m] + ' ' + y }; done = true;
  }
  if (!done) log.push('ons skipped: no month with food quotes');
} catch (e) { log.push('ons skipped: ' + e.message); }

/* 3) Brazil DIEESE Cesta Basica: average price per capital city, national median of the cities. */
try {
  let done = false;
  for (let back = 0; back < 6 && !done; back++) {
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back); const mm = String(d.getUTCMonth() + 1).padStart(2, '0') + d.getUTCFullYear();
    const r = await fetch('https://www.dieese.org.br/cesta/data', { method: 'POST', headers: { ...H, 'content-type': 'application/x-www-form-urlencoded' }, body: `farinha=true&data=${mm}&tipoDado=4&cidades=0&produtos=0` });
    if (!r.ok) continue; const t = new TextDecoder('utf-8').decode(await r.arrayBuffer());
    const rows = [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => c[1].replace(/<[^>]+>/g, '').trim()));
    const head = rows[0] || []; const cities = rows.slice(1).filter(r => r.length === head.length && /\d,\d/.test(r[2] || ''));
    if (cities.length < 5) continue;
    // cost.js key, DIEESE column, unit factor. Farinha: wheat only outside the N/NE (cassava there), so only the centre-south cities.
    const CS = /Bras|Campo Grande|Cuiab|Goi|Belo Horizonte|Rio de Janeiro|S.o Paulo|Vit|Curitiba|Florian|Porto Alegre|Maca/;
    const COL = [['beef', 'Carne'], ['milk', 'Leite'], ['bean', 'Feij'], ['black bean', 'Feij'], ['rice', 'Arroz'], ['flour', 'Farinha', CS], ['potato', 'Batata'], ['tomato', 'Tomate'], ['bread', 'P'], ['sugar', 'Açúcar'], ['butter', 'Manteiga']];
    for (const [k, col, only] of COL) { const j = head.findIndex(h => new RegExp('^' + col).test(h) && (col !== 'P' || /^P.o$/.test(h))); if (j < 0) continue;
      const a = cities.filter(r => !only || only.test(r[0])).map(r => +r[j].replace('.', '').replace(',', '.')).filter(v => v > 0); if (a.length >= 5) put('BR', k, med(a), a.length, 'dieese', mm.slice(0, 2) + '/' + mm.slice(2)); }
    out.sources.dieese = { name: 'DIEESE Pesquisa Nacional da Cesta Basica de Alimentos', url: 'https://www.dieese.org.br/cesta/', note: 'median of capital-city average prices, ' + mm.slice(0, 2) + '/' + mm.slice(2) }; done = true;
  }
  if (!done) log.push('dieese skipped: no recent month');
} catch (e) { log.push('dieese skipped: ' + e.message); }

const numv = v => { const x = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.')); return x > 0 ? x : null; };
const toUnit = (key, perKg) => P[key][1] === 'ea' ? (P[key][2] ? perKg * P[key][2] / 1000 : null) : perKg;

/* 4) India: DCA price monitoring (fcainfoweb.nic.in) needs a CAPTCHA, and api.data.gov.in needs a registered key and
   refuses Cloudflare (521) and this box (timeout). No cloud route works, so India keeps the last data (none yet). */
log.push('india skipped: fcainfoweb.nic.in is behind a CAPTCHA; api.data.gov.in needs an API key and is unreachable from the box and Cloudflare');

/* 5) Mexico PROFECO Quien es Quien en los Precios (datos.gob.mx, CC-BY-4.0): national median per product.
   Newest file on datos.gob.mx; the repodatos CSV host (Akamai) returns 403 to this box and to Cloudflare, so MX usually keeps the last data. */
const MXM = [[/^jitomate/i, 'tomato'], [/^cebolla/i, 'onion'], [/^papa\b/i, 'potato'], [/^zanahoria/i, 'carrot'], [/^aguacate/i, 'avocado'], [/^lim[oó]n/i, 'lime'], [/^pl[aá]tano/i, 'banana'],
  [/^manzana/i, 'apple'], [/^huevo/i, 'egg'], [/^tortilla/i, 'tortilla'], [/^frijol/i, 'bean'], [/^arroz/i, 'rice'], [/^az[uú]car/i, 'sugar'], [/^chile poblano|^pimiento/i, 'bell pepper'], [/^calabacita/i, 'zucchini'],
  [/^leche/i, 'milk'], [/^pechuga/i, 'chicken breast'], [/^pollo/i, 'chicken'], [/^carne molida|^molida de res/i, 'ground beef'], [/^ajo/i, 'garlic']];
// Presentacion -> kg (or litre) per package; null when it is not a weight/volume we can trust (e.g. 'PIEZA').
const mxSize = s => { s = String(s).toUpperCase(); if (/\bGRANEL\b|\b1 ?KG\b|\bKG\.?$|POR KILO/.test(s) && !/\d+ ?(GR|G)\b/.test(s)) return 1; let m = s.match(/(\d+(?:[.,]\d+)?) ?(KG|KILO)/); if (m) return +m[1].replace(',', '.');
  m = s.match(/(\d+(?:[.,]\d+)?) ?(GR|G|GRS)\b/); if (m) return +m[1].replace(',', '.') / 1000; m = s.match(/(\d+(?:[.,]\d+)?) ?(L|LT|LTS|LITRO|LITROS)\b/); if (m) return +m[1].replace(',', '.'); m = s.match(/(\d+) ?ML\b/); if (m) return +m[1] / 1000; return null; };
function mxParse(rows, label) {
  let h = rows[0].map(c => c.toLowerCase()), body = rows.slice(1); let iP = h.findIndex(c => /^producto/.test(c)), iR = h.findIndex(c => /presentaci/.test(c)), iV = h.findIndex(c => /^precio/.test(c));
  if (iP < 0 || iV < 0) { iP = 0; iR = 1; iV = 5; body = rows; } // headerless files: producto, presentacion, marca, categoria, catalogo, precio, fecha, ...
  const g = {}; for (const c of body) { const m = MXM.find(([re]) => re.test(c[iP] || '')); if (!m) continue; const k = m[1], v = numv(c[iV]); if (!v) continue;
    const egg = k === 'egg' && String(c[iR]).toUpperCase().match(/(\d+) ?(PZAS?|PIEZAS)/);
    if (egg) { (g[k] ||= []).push(v / +egg[1]); continue; } const sz = mxSize(c[iR]); if (!sz) continue; const u = toUnit(k, v / sz); if (u) (g[k] ||= []).push(u); }
  let n = 0; for (const [k, a] of Object.entries(g)) if (a.length >= 20) { put('MX', k, med(a), a.length, 'profeco', label); n++; } return n;
}
try {
  let n = 0, used = '';
  const pr = await fetch('https://datos.gob.mx/api/3/action/package_show?id=programa_quien_es_quien_precios_' + new Date().getUTCFullYear(), { headers: H }); const pt = await pr.text(); if (!pr.ok || /Access Denied/.test(pt.slice(0, 300))) throw new Error('datos.gob.mx blocked (' + pr.status + ', Akamai Access Denied)'); const pk = JSON.parse(pt);
  const url = pk.result.resources.map(r => r.url).sort().pop(); const r = await fetch(url, { headers: H }); const t = await r.text();
  if (!r.ok || /Access Denied/.test(t.slice(0, 300))) throw new Error('download blocked (' + r.status + ') ' + url); used = url.split('/').pop(); n = mxParse(t.split(/\r?\n/).filter(Boolean).map(csvRow), used);
  if (!n) throw new Error('no PROFECO products recognised in ' + used);
  out.sources.profeco = { name: 'PROFECO Quien es Quien en los Precios', url: 'https://datos.gob.mx/dataset/programa_quien_es_quien_precios_2026', license: 'CC-BY-4.0', note: 'national median of store prices; ' + used };
} catch (e) { log.push('profeco skipped: ' + e.message); }

// Keep the last data for any source that could not be refreshed this run (never drop real numbers because a site is down).
try { const prev = (await import('../../functions/_lib/intl-prices.js?' + Date.now())).default;
  for (const [cc, c] of Object.entries(prev.c || {})) for (const [k, it] of Object.entries(c.i)) if (!out.sources[it.src] && P[k]) { (out.c[cc] ||= { cur: c.cur, i: {} }).i[k] ||= { ...it, kept: prev.generated }; if (prev.sources[it.src]) out.sources[it.src] = { ...prev.sources[it.src], kept: prev.generated }; }
} catch {}
out.skipped = log;
fs.writeFileSync(process.env.OUT || new URL('../../functions/_lib/intl-prices.js', import.meta.url), '// Generated by scripts/intl/build.mjs from Open Prices, ONS, DIEESE (and PROFECO when reachable). Do not edit by hand.\nexport default ' + JSON.stringify(out, null, 1) + ';\n');
for (const [cc, c] of Object.entries(out.c)) console.log(cc, c.cur, Object.keys(c.i).length, Object.entries(c.i).map(([k, v]) => k + '=' + v.p + '/' + v.u + '(' + v.src[0] + v.n + ')').join(' '));
console.log(log.join('\n'));
