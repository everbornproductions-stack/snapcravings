// POST /api/dish  Plate photo -> dish name + estimated nutrition per serving (Pro feature; free = 1 dish scan per rolling 7 days).
// Body: { image: dataURL, lang } for a scan, or { fix: { name, items:[{name, grams}] }, lang } to recalculate after the user corrects it (text only, no scan used).
// AI chain: Gemini 3.5-flash-lite -> 3.1-flash-lite (vision, strict JSON schema, minimal thinking) -> Workers AI Llama 4 Scout (json_schema).
// Every answer goes through SC_DISH.validate (ranges + 4P+4C+9F energy check) before it reaches the app.
import '../../web/dishcore.js';
import { verifyToken, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../_lib/sub.js';
import { INTL, langCode } from '../_lib/lang.js';
const D = globalThis.SC_DISH;
export const FREE_DISH_PER_WEEK = 1, IP_DISH_PER_WEEK = 10, MAX_IMAGE_BYTES = 1_500_000;
const NUM = { type: 'number' };
export const DISH_SCHEMA = { type: 'object', properties: {
  is_food: { type: 'boolean' }, dish: { type: 'string' }, emoji: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, grams: NUM }, required: ['name', 'grams'] } },
  total: { type: 'object', properties: { kcal: NUM, protein: NUM, carbs: NUM, fat: NUM, fiber: NUM, sugar: NUM, sodium: NUM }, required: ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] },
  note: { type: 'string' } }, required: ['is_food', 'dish', 'confidence', 'items', 'total'] };
const SYS = 'You are a careful registered-dietitian-style nutrition estimator for the SnapCravings app. Reply with ONE JSON object only, no prose.';
const langLine = l => l === 'es' ? ' Write dish, item names and note in natural Latin American Spanish.' : INTL[l] ? ` Write dish, item names and note in natural ${INTL[l].name}, using local food names.` : '';
export function dishPrompt(lang, fix) {
  const shape = 'Return: is_food (false if the photo is not a plate or bowl of food), dish (short common name), emoji (one food emoji), confidence (high/medium/low), items (each visible component with estimated grams as served), total for ONE serving = everything on the plate as shown: kcal, protein g, carbs g, fat g, fiber g, sugar g, sodium mg, and note (one short sentence on what drives the estimate, e.g. hidden oil or sauce). Use standard nutrition data (USDA-style). Count cooking oil, butter and sauces you can reasonably infer. kcal must match 4*protein + 4*carbs + 9*fat within about 10%. Never return zeros for a real meal.';
  if (fix) return `The user corrected the dish. Dish: "${fix.name}". Components and grams: ${fix.items.map(i => `${i.name} ${i.grams ? i.grams + ' g' : '(typical portion)'}`).join('; ') || '(typical portion)'}. Estimate nutrition for exactly this, as one serving. is_food is true. ` + shape + langLine(lang);
  return 'Identify the plated meal in this photo and estimate its nutrition. ' + shape + langLine(lang);
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
const mem = new Map();
function hourly(ip, n) { const k = `dish:${ip}:${Math.floor(Date.now() / 36e5)}`; const c = (mem.get(k) || 0) + 1; mem.set(k, c); if (mem.size > 5000) mem.clear(); return c > n; }
// Weekly gate: Pro/owner token skips it; free devices get FREE_DISH_PER_WEEK. Same Supabase RPC as the fridge scan, separate hashes. Fails open.
export async function dishGate(env, request, ip) {
  if (env.__gate) return env.__gate();
  if (await verifyToken(env, request.headers.get('x-sc-token'))) return { allowed: true, why: 'pro' };
  if (env.ENFORCE_FREE === '0') return { allowed: true, why: 'off' };
  const dev = String(request.headers.get('x-sc-dev') || '').replace(/[^\w-]/g, '').slice(0, 64);
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 4000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/snap_scan_gate`, { method: 'POST', signal: ac.signal, headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_device: await sha('snapcravings-dish-d:' + (dev || 'ip-' + ip)), p_ip: await sha('snapcravings-dish-ip:' + ip), p_scan: 'dish' + crypto.randomUUID().replace(/-/g, ''), p_limit: FREE_DISH_PER_WEEK, p_ip_limit: IP_DISH_PER_WEEK }) });
    if (!r.ok) return { allowed: true, why: 'rpc-' + r.status };
    const j = await r.json(); return { allowed: j?.allowed !== false, why: j?.allowed === false ? 'limit' : 'ok' };
  } catch { return { allowed: true, why: 'error' }; } finally { clearTimeout(t); }
}
const err = (m, s) => Object.assign(new Error(m), { status: s });
async function geminiOne(env, model, parts, signal) {
  const r = await (env.__fetch || fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: DISH_SCHEMA, temperature: 0.2, maxOutputTokens: 2000, thinkingConfig: { thinkingLevel: 'minimal' } } }) });
  if (!r.ok) throw err('gemini ' + r.status, r.status);
  const j = await r.json(); const text = j.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '';
  return JSON.parse(text);
}
async function scout(env, parts, signal) {
  if (!env.AI) throw err('nobinding');
  const content = parts.map(p => p.inlineData ? { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } } : { type: 'text', text: p.text });
  const run = env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', { messages: [{ role: 'system', content: SYS }, { role: 'user', content }], response_format: { type: 'json_schema', json_schema: DISH_SCHEMA }, max_tokens: 1500, temperature: 0.2 });
  const out = await Promise.race([run, new Promise((_, rej) => signal.addEventListener('abort', () => rej(err('timeout'))))]);
  let d = out?.response ?? out?.choices?.[0]?.message?.content; if (typeof d === 'string') d = JSON.parse(d.slice(d.indexOf('{'), d.lastIndexOf('}') + 1));
  return d;
}
// Try each model in turn (each with its own timeout); first answer that passes validation wins. Returns { dish, model, tries }.
export async function estimate(env, parts) {
  const chain = [['gemini', 'gemini-3.5-flash-lite', 12000], ['gemini', 'gemini-3.1-flash-lite', 12000], ['cf', '@cf/meta/llama-4-scout-17b-16e-instruct', 20000]]
    .filter(([p]) => p === 'cf' ? !!env.AI : !!env.GEMINI_API_KEY && !env.__forceGeminiFail);
  const tries = [];
  for (const [prov, model, ms] of chain) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms); const t0 = Date.now();
    try {
      const raw = prov === 'cf' ? await scout(env, parts, ctl.signal) : await geminiOne(env, model, parts, ctl.signal);
      const v = D.validate(raw); tries.push([model, v.ok ? 'ok' : 'invalid ' + v.why, Date.now() - t0]);
      if (v.ok) return { dish: v.dish, model, tries };
      if (v.why === 'notfood') return { notfood: true, model, tries };
    } catch (e) { tries.push([model, String(e.message || e).slice(0, 80), Date.now() - t0]); } finally { clearTimeout(tm); }
  }
  return { tries };
}
const ES = { "That doesn't look like a plate of food. Try another photo!": '¡Eso no parece un plato de comida! Prueba con otra foto.', "You've used your free dish scan this week.": 'Ya usaste tu escaneo de platillo gratis de esta semana.',
  'Add a photo of your plate first!': '¡Primero agrega una foto de tu plato!', 'Photos must be JPEG, PNG or WebP.': 'Las fotos deben ser JPEG, PNG o WebP.', 'That photo is too big (max 1.5 MB).': 'Esa foto es muy grande (máx. 1.5 MB).',
  "We couldn't read that plate. Tap Retry!": 'No pudimos leer ese plato. ¡Toca Reintentar!', 'Whoa, hungry! You hit the hourly limit. Try again soon.': '¡Uy, qué hambre! Llegaste al límite por hora. Intenta de nuevo pronto.', 'Bad request': 'Solicitud inválida' };
export async function onRequest(ctx) {
  const res = await handle(ctx); if (res.status < 400) return res;
  const l = langCode(ctx.request.headers.get('x-sc-lang')); const j = await res.clone().json().catch(() => null); if (!j?.error) return res;
  return json({ ...j, error_en: j.error, error: l === 'es' ? ES[j.error] || j.error : j.error }, res.status); // client translates error_en for other languages
}
async function handle({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  if ((+request.headers.get('content-length') || 0) > 2_500_000) return json({ error: 'That photo is too big (max 1.5 MB).' }, 413);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  let body; try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const ff = String(request.headers.get('x-sc-force-fallback') || '').trim().toLowerCase(), host = new URL(request.url).hostname;
  if (ff && ((env.OWNER_CODE && ff === String(env.OWNER_CODE).trim().toLowerCase()) || (ff === '1' && /\.snapcravings\.pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(host)))) env = Object.assign(Object.create(env), { __forceGeminiFail: true });
  const lang = langCode(body.lang || request.headers.get('x-sc-lang'));
  let parts, fix = null;
  if (body.fix) {
    const name = String(body.fix.name || '').replace(/[\u0000-\u001f"<>]/g, ' ').trim().slice(0, 80);
    const items = (Array.isArray(body.fix.items) ? body.fix.items : []).slice(0, 15).map(i => ({ name: String(i?.name || '').replace(/[\u0000-\u001f"<>;]/g, ' ').trim().slice(0, 60), grams: Math.max(0, Math.min(2000, Math.round(+i?.grams || 0))) })).filter(i => i.name);
    if (!name) return json({ error: 'Bad request' }, 400);
    if (hourly(ip, 30)) return json({ error: 'Whoa, hungry! You hit the hourly limit. Try again soon.' }, 429);
    fix = { name, items }; parts = [{ text: dishPrompt(lang, fix) }];
  } else {
    const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
    if (!body.image) return json({ error: 'Add a photo of your plate first!' }, 400);
    if (!m) return json({ error: 'Photos must be JPEG, PNG or WebP.' }, 400);
    if (m[3].length * 0.75 > MAX_IMAGE_BYTES) return json({ error: 'That photo is too big (max 1.5 MB).' }, 413);
    if (hourly(ip, 20)) return json({ error: 'Whoa, hungry! You hit the hourly limit. Try again soon.' }, 429);
    const g = await dishGate(env, request, ip);
    if (!g.allowed) return json({ error: "You've used your free dish scan this week.", paywall: true }, 402);
    parts = [{ inlineData: { mimeType: m[1], data: m[3] } }, { text: dishPrompt(lang) }];
  }
  if (env.MOCK_AI === '1') { const v = D.validate({ is_food: true, dish: fix?.name || 'Grilled chicken with rice and broccoli', emoji: '🍗', confidence: 'medium', items: fix?.items?.length ? fix.items : [{ name: 'Chicken breast', grams: 150 }, { name: 'White rice', grams: 180 }, { name: 'Broccoli', grams: 90 }], total: { kcal: 560, protein: 52, carbs: 62, fat: 11, fiber: 4, sugar: 2, sodium: 520 } }); return json({ dish: v.dish, model: 'mock' }); }
  const t0 = Date.now(); const r = await estimate(env, parts);
  console.log('dish', fix ? 'fix' : 'scan', r.model, Date.now() - t0, 'ms', JSON.stringify(r.tries));
  if (r.notfood) return json({ error: "That doesn't look like a plate of food. Try another photo!", notfood: true, tries: r.tries }, 422);
  if (!r.dish) return json({ error: "We couldn't read that plate. Tap Retry!", tries: r.tries }, 502);
  if (fix) r.dish.name = fix.name; // the user's correction wins over the model's renaming
  return json({ dish: r.dish, model: r.model, ms: Date.now() - t0, tries: r.tries });
}
