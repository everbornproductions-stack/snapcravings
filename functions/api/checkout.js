// POST /api/checkout  The user's OWN screenshot of a delivery-app cart or checkout -> line-by-line totals (food, delivery, service, small-order, tax, tip, discounts, total).
// Free = 3 reads per UTC day, Pro unlimited. The image is read once and never stored. No login to, scraping of or API use of any delivery app: only the pixels the user uploads.
// AI chain: Gemini 3.5-flash-lite -> 3.1-flash-lite -> Workers AI Llama 4 Scout, strict JSON, then validateCheckout (ranges + sum check).
import { langCode, INTL } from '../_lib/lang.js';
import { hourly as rl } from '../_lib/limit.js';
import { dishGate, geminiOne, scout, json } from './dish.js';
export const FREE_CHECKOUT_PER_DAY = 3, IP_CHECKOUT_PER_DAY = 15, MAX_IMAGE_BYTES = 1_500_000;
const NUM = { type: 'number' };
export const CHECKOUT_SCHEMA = { type: 'object', properties: {
  is_checkout: { type: 'boolean' }, app: { type: 'string' }, item: { type: 'string' }, currency: { type: 'string' },
  lines: { type: 'object', properties: { food: NUM, delivery: NUM, service: NUM, small_order: NUM, tax: NUM, tip: NUM, discount: NUM, total: NUM }, required: ['total'] },
  note: { type: 'string' } }, required: ['is_checkout', 'lines'] };
const SYS = 'You read screenshots of food-delivery or restaurant carts and checkout screens for the SnapCravings app. Reply with ONE JSON object only, no prose. Copy numbers exactly as shown; never invent them.';
export function checkoutPrompt(lang) {
  const l = lang === 'es' ? ' Write item and note in Latin American Spanish.' : INTL[lang] ? ` Write item and note in ${INTL[lang].name}.` : '';
  return 'This is a screenshot of a food order cart or checkout. Return: is_checkout (false if it is not a cart, checkout or receipt), app (the delivery app or restaurant name shown, else empty), item (the main dish or the first food item, short common name, else empty), currency (ISO 4217 code such as USD, EUR, GBP, from the symbols shown, else empty), '
    + 'lines: food (subtotal of the food), delivery (delivery fee, 0 if free), service (service or platform fee), small_order (small-order fee), tax, tip, discount (a positive number for the total of promos and credits), total (the final amount charged). Use 0 for lines that are not shown. Do not copy any names, addresses, card or phone numbers.' + l;
}
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = v => { const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : +v; return Number.isFinite(n) ? n : NaN; };
const LINES = ['food', 'delivery', 'service', 'small_order', 'tax', 'tip', 'discount'];
// Clean the model's JSON. { ok, order } or { ok:false, why }. `mismatch` flags totals that do not add up (shown to the user, never silently "fixed").
export function validateCheckout(d) {
  if (!d || typeof d !== 'object') return { ok: false, why: 'shape' };
  if (d.is_checkout === false) return { ok: false, why: 'notcheckout' };
  const L = d.lines || {}, total = num(L.total);
  if (!(total > 0) || total > 1e7) return { ok: false, why: 'total' };
  const lines = { total: Math.round(total * 100) / 100 };
  for (const k of LINES) { const n = num(L[k]); lines[k] = Number.isFinite(n) && n >= 0 && n <= total * 3 ? Math.round(n * 100) / 100 : 0; }
  const sum = lines.food + lines.delivery + lines.service + lines.small_order + lines.tax + lines.tip - lines.discount;
  const mismatch = lines.food > 0 && Math.abs(sum - lines.total) > Math.max(0.5, lines.total * 0.08);
  const extras = lines.delivery + lines.service + lines.small_order + lines.tax + lines.tip;
  const cur = String(d.currency || '').toUpperCase().replace(/[^A-Z]/g, '');
  return { ok: true, order: { app: txt(d.app, 40), item: txt(d.item, 80), currency: /^[A-Z]{3}$/.test(cur) ? cur : '', lines, mismatch, extrasPct: lines.food > 0 ? Math.round(extras / lines.food * 100) : null, note: txt(d.note, 160) } };
}
export async function readCheckout(env, parts) {
  const chain = [['gemini', 'gemini-3.5-flash-lite', 12000], ['gemini', 'gemini-3.1-flash-lite', 12000], ['cf', '@cf/meta/llama-4-scout-17b-16e-instruct', 20000]]
    .filter(([p]) => p === 'cf' ? !!env.AI : !!env.GEMINI_API_KEY);
  const tries = [];
  for (const [prov, model, ms] of chain) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms); const t0 = Date.now();
    try {
      const raw = prov === 'cf' ? await scout(env, parts, ctl.signal, CHECKOUT_SCHEMA, SYS) : await geminiOne(env, model, parts, ctl.signal, CHECKOUT_SCHEMA, SYS);
      const v = validateCheckout(raw); tries.push([model, v.ok ? 'ok' : 'invalid ' + v.why, Date.now() - t0]);
      if (v.ok) return { order: v.order, model, tries };
      if (v.why === 'notcheckout') return { notcheckout: true, model, tries };
    } catch (e) { tries.push([model, String(e.message || e).slice(0, 80), Date.now() - t0]); } finally { clearTimeout(tm); }
  }
  return { tries };
}
const ES = { "That doesn't look like a checkout screen. Try another screenshot!": '¡Eso no parece una pantalla de pago. Prueba con otra captura!', "You've used your 3 free checkout reads for today.": 'Ya usaste tus 3 lecturas de pago gratis de hoy.',
  "We couldn't read that screenshot. Try a clearer one!": '¡No pudimos leer esa captura. Prueba con una más clara!', 'Whoa, hungry! You hit the hourly limit. Try again soon.': '¡Uy, qué hambre! Llegaste al límite por hora. Intenta de nuevo pronto.',
  'Add a screenshot first!': '¡Primero agrega una captura!', 'Screenshots must be JPEG, PNG or WebP.': 'Las capturas deben ser JPEG, PNG o WebP.', 'That screenshot is too big (max 1.5 MB).': 'Esa captura es muy grande (máx. 1.5 MB).', 'Bad request': 'Solicitud inválida' };
export async function onRequest(ctx) {
  const res = await handle(ctx); if (res.status < 400) return res;
  const l = langCode(ctx.request.headers.get('x-sc-lang')); const j = await res.clone().json().catch(() => null); if (!j?.error) return res;
  return json({ ...j, error_en: j.error, error: l === 'es' ? ES[j.error] || j.error : j.error }, res.status);
}
async function handle({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  if ((+request.headers.get('content-length') || 0) > 2_500_000) return json({ error: 'That screenshot is too big (max 1.5 MB).' }, 413);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  let body; try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const lang = langCode(body.lang || request.headers.get('x-sc-lang'));
  if (!body.image) return json({ error: 'Add a screenshot first!' }, 400);
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image));
  if (!m) return json({ error: 'Screenshots must be JPEG, PNG or WebP.' }, 400);
  if (m[3].length * 0.75 > MAX_IMAGE_BYTES) return json({ error: 'That screenshot is too big (max 1.5 MB).' }, 413);
  if (await rl(env, 'checkout', ip, 20)) return json({ error: 'Whoa, hungry! You hit the hourly limit. Try again soon.' }, 429);
  const g = await dishGate(env, request, ip, 'checkout', FREE_CHECKOUT_PER_DAY, IP_CHECKOUT_PER_DAY);
  if (!g.allowed) return json({ error: "You've used your 3 free checkout reads for today.", paywall: true }, 402);
  if (env.MOCK_AI === '1') { const v = validateCheckout({ is_checkout: true, app: 'DemoEats', item: 'Chicken pad thai', currency: 'USD', lines: { food: 18.5, delivery: 3.99, service: 2.78, small_order: 0, tax: 1.65, tip: 3, discount: 0, total: 29.92 } }); return json({ order: v.order, model: 'mock' }); }
  const t0 = Date.now(); const r = await readCheckout(env, [{ inlineData: { mimeType: m[1], data: m[3] } }, { text: checkoutPrompt(lang) }]);
  console.log('checkout', r.model, Date.now() - t0, 'ms', JSON.stringify(r.tries));
  if (r.notcheckout) return json({ error: "That doesn't look like a checkout screen. Try another screenshot!", notcheckout: true }, 422);
  if (!r.order) return json({ error: "We couldn't read that screenshot. Try a clearer one!" }, 502);
  return json({ order: r.order, model: r.model, ms: Date.now() - t0 });
}
