// SnapCravings API (Cloudflare Pages Function). The AI key stays server-side in env.GEMINI_API_KEY.
// Routes: POST /api/scan {images:[dataURL]} | POST /api/recipes {ingredients, craving} | POST /api/crave {craving, ingredients}
// GET /api/health. Set MOCK_AI=1 (local only) to return canned results without a key.
import { libFind, libSave, libCount, libStats, pick as libPick, prefKey as libPrefKey } from '../_lib/recipelib.js';
import { verifyToken, safeEq, signScan, verifyScan, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../_lib/sub.js';
import { hourly } from '../_lib/limit.js';
import '../../web/holiday.js';
import '../../web/money.js';
import { costRecipe, costKey, costGet, costPut, linePrice } from '../_lib/cost.js'; // sets globalThis.SC_MONEY (local currency + price levels, shared with the web app) // sets globalThis.SC_HOLIDAY (holiday mode, shared with the web app)
import { trendHit } from '../_lib/trending.js';
import { INTL, langCode, intlNote, intlScanNote } from '../_lib/lang.js';
import { dietOf, dietPrompt, bad, hits, recipeBad, recipeHits, flagScan, staplesFor as dietStaples } from '../_lib/diet.js';
const FREE_SCANS_PER_WEEK = 3; const IP_SCANS_PER_WEEK = 30;

// Free-scan limit, kept in Supabase (snap_scan_gate RPC): 3 scans per device per rolling 7 days, 30 per IP.
// On by default (ENFORCE_FREE='0' turns it off). Paid/owner tokens skip it. Any RPC failure lets the scan through (fail open).
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
// When Supabase errors, free users are not let through blindly: a per-isolate count (same 3 per 7 days) decides.
const gateMem = new Map();
function memGate(dev, scan, ticket, why) {
  const now = Date.now(); const l = (gateMem.get(dev) || []).filter(x => now - x.t < 7 * 864e5);
  if (!l.some(x => x.s === scan)) { if (l.length >= FREE_SCANS_PER_WEEK) return { allowed: false, why: why + '-mem-limit' }; l.push({ s: scan, t: now }); }
  gateMem.set(dev, l); if (gateMem.size > 20000) gateMem.clear(); return { allowed: true, why: why + '-mem', ticket };
}
async function scanGate(env, request, ip) {
  if (env.ENFORCE_FREE === '0') return { allowed: true, why: 'off' };
  if (await verifyToken(env, request.headers.get('x-sc-token'))) return { allowed: true, why: 'pro' };
  const dev = String(request.headers.get('x-sc-dev') || '').replace(/[^\w-]/g, '').slice(0, 64);
  const devHash = await sha('snapcravings-scan-d:' + (dev || 'ip-' + ip));
  // The scan id comes from a server-signed ticket (10 minutes, bound to this device). Anything else starts a new scan.
  const tk = await verifyScan(env, String(request.headers.get('x-sc-scan') || '').slice(0, 400), devHash);
  const scan = tk ? tk.s : crypto.randomUUID().replace(/-/g, ''); const ticket = env.SUB_SECRET ? (tk ? String(request.headers.get('x-sc-scan')) : await signScan(env, devHash, scan)) : null;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 4000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/snap_scan_gate`, { method: 'POST', signal: ac.signal,
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_device: devHash, p_ip: await sha('snapcravings-scan-ip:' + ip), p_scan: scan.padEnd(4, '0'), p_limit: FREE_SCANS_PER_WEEK, p_ip_limit: IP_SCANS_PER_WEEK }) });
    if (!r.ok) return memGate(devHash, scan, ticket, 'rpc-' + r.status);
    const j = await r.json();
    return { allowed: j?.allowed !== false, why: j?.allowed === false ? 'limit' : 'ok', used: j?.used, ticket };
  } catch { return memGate(devHash, scan, ticket, 'error'); } finally { clearTimeout(t); }
}
const MODEL = 'gemini-3.5-flash-lite'; // gemini-2.5-flash is closed to new API users (404); see CHAIN for fallbacks
const MAX_IMAGES = 10, MAX_IMAGE_BYTES = 1_500_000, MAX_BODY = 9_000_000;
const LIMIT = { scan: 60, recipes: 30, crave: 30 }, WINDOW_S = 3600; // per IP per hour
const mem = new Map(); // fallback limiter when no KV binding (per isolate, best effort)

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

// Public view of the race log: provider/model, a short status (429, timeout, badjson...), ms. Never raw provider error text.
export const shortSt = st => { const s = String(st ?? ''); const m = /^(\d{3}|[a-z][a-z-]{0,20})\b/i.exec(s.trim()); return m ? m[1] : 'err'; };
export const publicTries = t => Array.isArray(t) ? t.map(x => [String(x[0]).slice(0, 60), shortSt(x[1]), +x[2] || 0]) : undefined;
const publicUsage = u => u && { ...u, tries: publicTries(u.tries) };
async function limited(env, ip, route) {
  const key = `rl:${route}:${ip}:${Math.floor(Date.now() / 1000 / WINDOW_S)}`;
  let n;
  if (env.RATE_KV) { n = +(await env.RATE_KV.get(key) || 0) + 1; await env.RATE_KV.put(key, String(n), { expirationTtl: WINDOW_S + 60 }); }
  else { n = (mem.get(key) || 0) + 1; mem.set(key, n); if (mem.size > 5000) mem.clear(); }
  return n > LIMIT[route];
}

const STAPLES = 'salt, pepper, cooking oil, water, sugar, flour, butter, common dried spices';
const RECIPE = { type: 'object', properties: {
  name: { type: 'string' }, emoji: { type: 'string' }, minutes: { type: 'integer' }, servings: { type: 'integer' }, level: { type: 'string', enum: ['Easy', 'Medium', 'Chef mode'] },
  ingredients: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, qty: { type: 'string' }, have: { type: 'boolean' }, en: { type: 'string' } }, required: ['item', 'qty', 'have'] } },
  missing: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, qty: { type: 'string' }, est_price: { type: 'number' }, en: { type: 'string' } }, required: ['item', 'qty', 'est_price'] } },
  steps: { type: 'array', items: { type: 'string' } }, kcal: { type: 'integer' }, protein_g: { type: 'integer' }, carbs_g: { type: 'integer' }, fat_g: { type: 'integer' } }, required: ['name', 'emoji', 'minutes', 'servings', 'level', 'ingredients', 'missing', 'steps', 'kcal', 'protein_g', 'carbs_g', 'fat_g'] };
const SCHEMAS = {
  scan: { type: 'object', properties: { ingredients: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'string' }, category: { type: 'string', enum: ['Produce', 'Proteins', 'Dairy', 'Pantry', 'Spices & Seasonings'] }, low: { type: 'boolean' }, en: { type: 'string' } }, required: ['name', 'qty', 'category', 'low'] } } }, required: ['ingredients'] },
  recipes: { type: 'object', properties: { recipes: { type: 'array', items: RECIPE } }, required: ['recipes'] },
  crave: { type: 'object', properties: { recipe: RECIPE, est_cook_cost: { type: 'number' }, est_menu_price: { type: 'number' } }, required: ['recipe', 'est_cook_cost', 'est_menu_price'] }
};
const VOICE = 'You write for SnapCravings, a fun, upbeat cooking app. Plain, friendly words. No em-dashes. Recipe steps are complete, specific (times, temperatures, amounts) and safe (cook meat through). For every recipe fill kcal, protein_g, carbs_g and fat_g as realistic PER SERVING estimates for the listed quantities.';

// AI engine: a hedged race over FREE providers, ordered by measured speed. Each keyed provider switches on by itself once its
// secret exists (GROQ_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY); Gemini (GEMINI_API_KEY) and the
// Workers AI binding (env.AI) are always in. The next entry starts when the previous one fails OR after its head start, and
// the first good answer wins. Gemini free quotas are per model, so several Gemini models are separate buckets.
// Measured 2026-11-02 (5 recipes streamed, minimal thinking): 3.5-flash-lite first recipe ~1.5 s, all ~6 s, steady; 3.1-flash-lite similar but stalls >4 s about 1 in 5; 3-flash-preview ~5 s,
// 3.6-flash often 503, 3.7/3.8-flash 429 (no free quota on this key), 2.5-flash* 404 (closed to new users), Gemma 4 ~60 s.
// Workers AI: Scout reads photos in ~5 s; Qwen3 30B (thinking off, plain JSON mode) ~15 s for recipes.
// Streaming: with a sink, each finished recipe is handed over as soon as its closing brace arrives (Gemini SSE and
// OpenAI-style SSE), so the first card can show while the rest are still being written.
const CF_MODEL = { scan: '@cf/meta/llama-4-scout-17b-16e-instruct', text: '@cf/qwen/qwen3-30b-a3b-fp8' };
const CF_MODE = { scan: 'schema', text: 'noschema-nothink' };
// OpenAI-compatible free providers. text = recipes/crave model, vision = scan model. Override with <NAME>_MODEL / <NAME>_VISION_MODEL.
const OAI = {
  cerebras: { key: 'CEREBRAS_API_KEY', url: 'https://api.cerebras.ai/v1/chat/completions', text: 'gpt-oss-120b', vision: 'qwen-3.8-27b' },
  groq: { key: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/chat/completions', text: 'openai/gpt-oss-20b', vision: 'qwen/qwen3.8-27b' },
  mistral: { key: 'MISTRAL_API_KEY', url: 'https://api.mistral.ai/v1/chat/completions', text: 'mistral-small-latest', vision: 'mistral-small-latest' },
  openrouter: { key: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai/api/v1/chat/completions', text: 'google/gemma-4-26b-a4b-it:free', vision: 'google/gemma-4-26b-a4b-it:free' }
};
const MIN = { thinkingLevel: 'minimal' };
// [provider, model, thinking, wait-before-start ms, head start ms]
function chainFor(env, route) {
  const L = [];
  if (env.GEMINI_MODEL) L.push(['gemini', env.GEMINI_MODEL, null]);
  const has = p => !!env[OAI[p].key];
  if (has('cerebras')) L.push(['cerebras', null, null, 0, 3500]);
  if (has('groq')) L.push(['groq', null, null, 0, 3500]);
  if (route === 'scan') L.push(['gemini', 'gemini-3.5-flash-lite', MIN, 0, 5000], ['gemini', 'gemini-3.1-flash-lite', MIN, 0, 6000]);
  else L.push(['gemini', 'gemini-3.5-flash-lite', MIN, 0, 3500], ['gemini', 'gemini-3.1-flash-lite', MIN, 0, 5000]);
  L.push(['gemini', 'gemini-3-flash-preview', MIN, 0, 7000]);
  if (has('mistral')) L.push(['mistral', null, null, 0, 7000]);
  if (has('openrouter')) L.push(['openrouter', null, null, 0, 8000]);
  L.push(['cf'], ['gemini', 'gemini-3.5-flash-lite', MIN, 3000], ['gemini', 'gemini-3.1-flash-lite', MIN, 5000], ['gemini', 'gemini-3.5-flash-lite', null]);
  return L;
}
const HEAD_START = 9000, PER_MODEL = 30000, DEADLINE = 45000, STALL = 7000; // STALL: max gap between streamed recipes
// Daily neuron guard for Workers AI (approximate: per-isolate memory + per-colo Cache API counter), priced with Scout's
// rates (24.5k / 77.3k neurons per M in/out tokens, the dearer of the two models), so the count errs high.
const CF_PRICE = { in: 24545 / 1e6, out: 77273 / 1e6 }; let cfMem = { day: '', n: 0 };
const cfDay = () => new Date().toISOString().slice(0, 10);
async function cfUsed(add = 0) {
  const day = cfDay(); if (cfMem.day !== day) cfMem = { day, n: 0 };
  let n = cfMem.n; const key = `https://cf-budget.internal/${day}`;
  try { const c = typeof caches !== 'undefined' && caches.default; if (c) { const r = await c.match(key); if (r) n = Math.max(n, +(await r.text()) || 0);
    if (add) await c.put(key, new Response(String(n + add), { headers: { 'cache-control': 'max-age=90000' } })); } } catch {}
  cfMem.n = n + add; return n + add;
}
// Compact answer shapes for providers without schema-constrained decoding (much shorter than the JSON schema).
const SHAPE = { // example values show the types; Qwen misread "int" placeholders as keys
  scan: '{"ingredients":[{"name":"smoked paprika","qty":"half a jar","category":"Spices & Seasonings","low":false}]} (category is one of Produce, Proteins, Dairy, Pantry, Spices & Seasonings)',
  recipe: '{"name":"...","emoji":"🍳","minutes":20,"servings":2,"level":"Easy","ingredients":[{"item":"eggs","qty":"2","have":true}],"missing":[{"item":"...","qty":"...","est_price":2.5}],"steps":["..."],"kcal":450,"protein_g":25,"carbs_g":40,"fat_g":18} (level is Easy, Medium or Chef mode)'
};
SHAPE.recipes = `{"recipes":[${SHAPE.recipe}]}`; SHAPE.crave = `{"recipe":${SHAPE.recipe},"est_cook_cost":number,"est_menu_price":number}`;
const okShape = (route, d) => !!d && typeof d === 'object' && (route === 'scan' ? Array.isArray(d.ingredients) : route === 'recipes' ? Array.isArray(d.recipes) && d.recipes.length > 0 && d.recipes.every(r => r && r.name && Array.isArray(r.steps) && Number.isFinite(+r.minutes)) : !!d.recipe);
const parseLoose = s => { const t = String(s).replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^```(json)?|```$/g, '').trim(); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); };
const sysFor = route => VOICE + ' Reply with ONE JSON object only, no prose, shaped exactly like: ' + SHAPE[route];
const err = (st, m) => Object.assign(new Error(m || st), { st });

// Pulls each complete object out of {"recipes":[{...},{...  while the text is still arriving.
function recipeTap(onObj) {
  let buf = '', pos = 0, depth = 0, inStr = false, esc = false, start = -1;
  return chunk => {
    buf += chunk;
    for (; pos < buf.length; pos++) {
      const c = buf[pos];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '{' || c === '[') { depth++; if (c === '{' && depth === 3) start = pos; }
      else if (c === '}' || c === ']') { if (c === '}' && depth === 3 && start >= 0) { try { onObj(JSON.parse(buf.slice(start, pos + 1))); } catch {} start = -1; } depth--; }
    }
  };
}
// Reads an SSE body and calls onData(parsedJson) per event.
async function readSSE(body, onData, signal) {
  const rd = body.getReader(); const dec = new TextDecoder(); let buf = '';
  const stop = () => { try { rd.cancel().catch(() => {}); } catch {} }; signal?.addEventListener('abort', stop);
  try {
    for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let k;
      while ((k = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
        if (!line.startsWith('data:')) continue; const d = line.slice(5).trim(); if (!d || d === '[DONE]') continue; try { onData(JSON.parse(d)); } catch {} } }
  } finally { signal?.removeEventListener('abort', stop); }
  if (signal?.aborted) throw Object.assign(new Error('timeout'), { name: 'AbortError' });
}

async function workersAI(env, route, parts, signal) {
  const budget = +(env.CF_BUDGET || 6000);
  if (!env.AI) throw err('nobinding');
  if (await cfUsed() >= budget) throw err('budget');
  const content = parts.map(p => p.inlineData ? { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } } : { type: 'text', text: p.text });
  const model = (env.__cfModel && env.__cfModel.startsWith('@cf/')) ? env.__cfModel : route === 'scan' ? CF_MODEL.scan : CF_MODEL.text;
  const mode = env.__cfMode || (route === 'scan' ? CF_MODE.scan : CF_MODE.text); const noSchema = mode.includes('noschema');
  const sys = noSchema ? sysFor(route) + (mode.includes('nothink') ? ' /no_think' : '') : VOICE + ' Reply with ONE JSON object only.';
  const run = env.AI.run(model, { messages: [{ role: 'system', content: sys }, { role: 'user', content }],
    ...(noSchema ? { response_format: { type: 'json_object' } } : { response_format: { type: 'json_schema', json_schema: SCHEMAS[route] } }), max_tokens: 6000, temperature: 0.6 });
  const out = await Promise.race([run, new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('timeout'), { name: 'AbortError' }))))]);
  const u = out?.usage || {}; await cfUsed(Math.ceil((u.prompt_tokens || 3000) * CF_PRICE.in + (u.completion_tokens || 3000) * CF_PRICE.out));
  let data = out?.response ?? out?.choices?.[0]?.message?.content; if (typeof data === 'string') data = parseLoose(data);
  if (!okShape(route, data)) throw err('badjson');
  return { data, model, in: u.prompt_tokens, out: u.completion_tokens };
}
// One OpenAI-compatible call (Groq, Cerebras, Mistral, OpenRouter), streamed when a tap is given.
async function openAI(env, name, route, parts, signal, tap) {
  const P = OAI[name]; const scan = route === 'scan'; const up = name.toUpperCase();
  const model = (scan ? env[up + '_VISION_MODEL'] : env[up + '_MODEL']) || (scan ? P.vision : P.text);
  const content = parts.map(p => p.inlineData ? { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } } : { type: 'text', text: p.text });
  const body = { model, messages: [{ role: 'system', content: sysFor(route) }, { role: 'user', content: scan ? content : content.map(c => c.text).join('\n') }],
    response_format: { type: 'json_object' }, temperature: 0.6, max_tokens: name === 'groq' ? (scan ? 2500 : 5000) : 6000, stream: !!tap }; // Groq free: prompt + max_tokens must fit its 8K tokens/min (6000 gave 429 'Request too large')
  if (/gpt-oss/.test(model)) body.reasoning_effort = 'low';
  const r = await (env.__fetch || fetch)(P.url, { method: 'POST', signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env[P.key], ...(name === 'openrouter' ? { 'HTTP-Referer': 'https://snapcravings.pages.dev', 'X-Title': 'SnapCravings' } : {}) }, body: JSON.stringify(body) });
  if (!r.ok) { const msg = (await r.text()).slice(0, 300); throw err(r.status + ' ' + (/"message":\s*"([^"]{0,140})/.exec(msg)?.[1] || ''), msg); }
  let text = '', u = {};
  if (tap) await readSSE(r.body, j => { const d = j.choices?.[0]?.delta?.content; if (d) { text += d; tap(d); } if (j.usage) u = j.usage; if (j.error) throw err('stream ' + (j.error.code || '')); }, signal);
  else { const j = await r.json(); text = j.choices?.[0]?.message?.content || ''; u = j.usage || {}; }
  let data; try { data = parseLoose(text); } catch { throw err('badjson'); }
  if (!okShape(route, data)) throw err('badjson');
  return { data, model, in: u.prompt_tokens, out: u.completion_tokens };
}
async function geminiOne(env, model, thinking, route, parts, signal, tap) {
  const gc = { responseMimeType: 'application/json', responseSchema: SCHEMAS[route], temperature: 0.6, maxOutputTokens: 8000 };
  if (thinking) gc.thinkingConfig = thinking;
  const r = await (env.__fetch || fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${tap ? 'streamGenerateContent?alt=sse' : 'generateContent'}`, { method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: VOICE }] }, contents: [{ role: 'user', parts }], generationConfig: gc }) });
  if (!r.ok) { const msg = (await r.text()).slice(0, 300); throw Object.assign(err(r.status + ' ' + (/"message":\s*"([^"]{0,140})/.exec(msg)?.[1] || ''), msg), { status: r.status }); }
  let text = '', u = {}, fin;
  const take = j => { const c = j.candidates?.[0]; const d = c?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || ''; if (d) { text += d; tap?.(d); } if (j.usageMetadata) u = j.usageMetadata; if (c?.finishReason) fin = c.finishReason; };
  if (tap) await readSSE(r.body, take, signal); else take(await r.json());
  let data; try { data = JSON.parse(text); } catch { throw err('badjson', 'bad json ' + fin); }
  if (!okShape(route, data)) throw err('badjson');
  return { data, model, in: u.promptTokenCount, out: u.candidatesTokenCount };
}
// The hedged race. opts.onRecipe (recipes route only) streams recipes: the first attempt to finish a recipe becomes the
// "owner" and the others are stopped; if the owner then fails, the race goes on and later recipes are de-duplicated by name.
async function gemini(env, route, parts, opts = {}) {
  const chain = chainFor(env, route);
  const tries = []; const ctls = new Map(); const T0 = Date.now();
  let last = 'The recipe brain hiccuped. Tap Retry!', owner = null, paused = false; let stall;
  const sent = new Set(); const stream = route === 'recipes' && opts.onRecipe;
  const emit = (id, r) => { if (!stream || !r?.name) return false; if (owner === null) { owner = id; paused = true; for (const [k, c] of ctls) if (k !== id) try { c.abort(); } catch {} }
    if (owner !== id) return false; clearTimeout(stall); stall = setTimeout(() => { try { ctls.get(id)?.abort(); } catch {} }, STALL); // owner went quiet mid-answer: drop it, the race goes on
    const k = String(r.name).toLowerCase(); if (sent.has(k)) return true; sent.add(k); opts.onRecipe(r); return true; };
  const one = async ([prov, model, thinking, wait], id) => {
    if (wait) await new Promise(r => setTimeout(r, wait));
    if (owner !== null && owner !== id) return null;
    const ctl = new AbortController(); ctls.set(id, ctl); const timer = setTimeout(() => ctl.abort(), prov === 'cf' ? 40000 : PER_MODEL); const t0 = Date.now();
    const label = prov === 'cf' ? (env.__cfModel || (route === 'scan' ? CF_MODEL.scan : CF_MODEL.text)) : prov === 'gemini' ? model : prov;
    const note = st => tries.push([label, shortSt(st), Date.now() - t0]); // status code or short word only: raw provider text can carry account ids
    const tap = stream && prov !== 'cf' ? recipeTap(r => emit(id, r)) : null;
    try {
      if (prov !== 'cf' && env.__forceGeminiFail) throw err('forced-fail');
      const v = prov === 'cf' ? await workersAI(env, route, parts, ctl.signal) : prov === 'gemini' ? await geminiOne(env, model, thinking, route, parts, ctl.signal, tap) : await openAI(env, prov, route, parts, ctl.signal, tap);
      if (route === 'scan' && prov !== 'gemini' && !v.data.ingredients.length) throw err('empty'); // a weaker fallback that sees nothing should not end the race
      if (stream) { if (owner !== null && owner !== id && ctls.has(owner)) { note('lost'); return null; } owner = id; v.data.recipes.forEach(r => emit(id, r)); }
      note(200); console.log('ok', route, v.model, Date.now() - t0, 'ms', v.in, v.out);
      return { data: v.data, usage: { model: v.model, provider: prov === 'cf' ? 'workers-ai' : prov, ms: Date.now() - t0, total: Date.now() - T0, in: v.in, out: v.out, tries } };
    } catch (e) {
      const st = e.st || (e.name === 'AbortError' ? (owner !== null && owner !== id ? 'stopped' : 'timeout') : 'err ' + String(e.message).slice(0, 100)); note(st); console.log('fail', label, st);
      if (/^429/.test(st)) last = 'Our kitchen is busy. Tap Retry in a moment!'; else if (st === 'timeout') last = 'That took too long. Tap Retry!';
      if (owner === id) { owner = null; paused = false; }
      return null;
    } finally { clearTimeout(timer); ctls.delete(id); }
  };
  const res = await new Promise(resolve => {
    let i = 0, running = 0, done = false, kick;
    const finish = v => { if (done) return; done = true; clearTimeout(kick); clearTimeout(dl); resolve(v); };
    const dl = setTimeout(() => finish(null), DEADLINE);
    const next = () => {
      clearTimeout(kick); if (done || paused) return;
      if (i >= chain.length) { if (!running) finish(null); return; }
      const e = chain[i], id = i++; running++;
      one(e, id).then(v => { running--; if (v) finish(v); else if (!(owner !== null && ctls.has(owner))) next(); });
      if (i < chain.length) kick = setTimeout(next, e[4] || HEAD_START);
    };
    next();
  });
  clearTimeout(stall); for (const c of ctls.values()) try { c.abort(); } catch {}
  if (res) return res;
  const e = new Error(last); e.tries = tries; throw e;
}


// Diet & allergy rules live in ../_lib/diet.js (prompt rules + per-phrase server check incl. steps).
const staplesFor = d => dietStaples(d, STAPLES);

// The craving itself may name a forbidden food ("shrimp scampi" with a shellfish allergy): say so, so the model adapts instead of repeating it.
const cravingNote = (d, craving) => { const h = d.hard ? [...new Set(hits(d, craving).map(x => x.toLowerCase()))] : []; return h.length ? `NOTE: the craving mentions ${h.join(', ')}, which the user must NEVER eat. Do not use ${h.join(' or ')} anywhere. Make a fully compliant dish inspired by the craving (for example swap in a safe main ingredient) and say what you swapped in the recipe name.\n` : ''; };
// Language: 'es' gets Spanish output (recipes, steps, ingredient names) and Spanish error messages. Enums stay English.
// More languages (pt, hi, id, fr, de, ar, ru, tr) come from _lib/lang.js: local names, metric units, plus an English `en` name per item for the diet checks.
const langOf = (b, request) => langCode(b?.lang || request?.headers.get('x-sc-lang'));
const LANG_NOTE = { es: '\nLANGUAGE: Write every user-facing text value in natural, friendly Latin American Spanish (Mexico-neutral): recipe names, ingredient item names, quantities (use metric or common Spanish units like taza, cucharada, cucharadita, pieza), missing items and every step. Use common Latin American food words (for example jitomate or tomate, frijoles, elote, camarón, cacahuate, aguacate). Keep the JSON keys and the enum values for level (Easy, Medium, Chef mode) and category exactly in English. Prices are plain numbers in the currency named under PRICES (USD if none). The diet and allergy rules above apply exactly the same in Spanish.', en: '' };
for (const l of Object.keys(INTL)) LANG_NOTE[l] = intlNote(l);
const ERR = {
  'Not found': 'No encontrado', 'Those photos are too big. Try fewer photos.': 'Esas fotos pesan mucho. Prueba con menos fotos.',
  'Whoa, hungry! You hit the hourly limit. Try again soon.': '¡Uy, qué hambre! Llegaste al límite por hora. Intenta de nuevo pronto.', 'Bad request': 'Solicitud inválida',
  'AI is not set up yet (missing GEMINI_API_KEY).': 'La IA todavía no está lista.', 'Add at least one photo!': '¡Agrega al menos una foto!',
  'Photos must be JPEG, PNG or WebP.': 'Las fotos deben ser JPEG, PNG o WebP.', 'One photo is too big (max 1.5 MB).': 'Una foto pesa demasiado (máx. 1.5 MB).',
  "You've used your 3 free scans this week.": 'Ya usaste tus 3 escaneos gratis de esta semana.',
  'None of your ingredients fit your diet. Add a few that do, or edit My diet!': 'Ninguno de tus ingredientes va con tu dieta. ¡Agrega algunos que sí, o cambia Mi dieta!',
  'Add some ingredients first!': '¡Primero agrega algunos ingredientes!', 'Name a craving first!': '¡Primero dinos qué se te antoja!',
  "We couldn't find recipes that fit your diet with these ingredients. Tap Retry or add a few more ingredients!": 'No encontramos recetas que vayan con tu dieta con estos ingredientes. ¡Toca Reintentar o agrega más ingredientes!',
  "Couldn't make that one fit your diet. Try a different craving!": 'No pudimos adaptar ese platillo a tu dieta. ¡Prueba otro antojo!',
  'Something went sideways. Try again!': 'Algo salió mal. ¡Intenta de nuevo!', 'The recipe brain hiccuped. Tap Retry!': 'El cerebro de recetas tuvo un hipo. ¡Toca Reintentar!',
  'Our kitchen is busy. Tap Retry in a moment!': 'Nuestra cocina está llena. ¡Toca Reintentar en un momento!', 'That took too long. Tap Retry!': 'Tardó demasiado. ¡Toca Reintentar!'
};
const clean = (a, n = 60) => (Array.isArray(a) ? a : []).map(s => String(s).slice(0, 80)).filter(Boolean).slice(0, n);

export async function onRequest(ctx) {
  const res = await handle(ctx);
  const lang = ctx.request.headers.get('x-sc-lang') || '';
  if (!String(lang).toLowerCase().startsWith('es') || res.status < 400) return res;
  const j = await res.clone().json().catch(() => null);
  if (!j || !j.error) return res;
  const e = ERR[j.error] || (/^Up to \d+ photos at a time\.$/.test(j.error) ? j.error.replace(/^Up to (\d+) photos at a time\./, 'Hasta $1 fotos a la vez.') : j.error);
  return json({ ...j, error: e }, res.status);
}
async function handle({ request, env, params, waitUntil }) { // env may be wrapped below for the fallback test hook
  const route = (params.path || [])[0];
  if (route === 'health') return json({ ok: true, library: await Promise.race([libStats(env).catch(() => null), new Promise(r => setTimeout(() => r({ timeout: true }), 2500))]), model: env.GEMINI_MODEL || MODEL, ai: !!env.GEMINI_API_KEY || env.MOCK_AI === '1' ? 'ready' : 'missing GEMINI_API_KEY' });
  if (route === 'geo') return json({ country: String(request.cf?.country || '').toUpperCase().slice(0, 2) || null }); // holiday mode: country from Cloudflare
  if (route === 'dietcheck' && request.method === 'POST') { // no AI: which of these names break the user's diet (used to clean the grocery list)
    let b = {}; try { b = await request.json(); } catch {}
    const d = dietOf(b.prefs); const items = clean(b.items, 200);
    return json({ bad: d.hard ? items.map((x, i) => bad(d, x) ? i : -1).filter(i => i >= 0) : [] });
  }
  if (request.method !== 'POST' || !SCHEMAS[route]) return json({ error: 'Not found' }, 404);
  const len = +request.headers.get('content-length') || 0;
  if (len > MAX_BODY) return json({ error: 'Those photos are too big. Try fewer photos.' }, 413);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (await hourly(env, route, ip, LIMIT[route])) return json({ error: 'Whoa, hungry! You hit the hourly limit. Try again soon.' }, 429);
  let body; try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  // Test hook: skip Gemini so the free Workers AI fallback answers. Owner code only (or '1' on a preview branch host).
  const ff = String(request.headers.get('x-sc-force-fallback') || '').trim().toLowerCase(), host = new URL(request.url).hostname;
  if (ff && ((env.OWNER_CODE && safeEq(ff, String(env.OWNER_CODE).trim().toLowerCase())) || (ff === '1' && (/\.snapcravings\.pages\.dev$/.test(host) || host === 'localhost' || host === '127.0.0.1')))) env = Object.assign(Object.create(env), { __forceGeminiFail: true, __cfModel: ff === '1' ? String(request.headers.get('x-sc-cf-model') || '').slice(0, 80) : '', __cfMode: ff === '1' ? String(request.headers.get('x-sc-cf-mode') || '') : '' });
  // Free plan: 3 scans (a scan = one Go, many photo batches share one scan id) per IP per week; Unlimited token skips it.
  if (!env.GEMINI_API_KEY && env.MOCK_AI !== '1') return json({ error: 'AI is not set up yet (missing GEMINI_API_KEY).' }, 503);

  let parts, rkey = null, lib = null, scanTicket = null; const lang = langOf(body, request); const LN0 = LANG_NOTE[lang];
  // Local currency: ?country / geo from the app (x-sc-country), else Cloudflare's country. All AI prices come back in that currency.
  const M = globalThis.SC_MONEY, cc = M.cc2(request.headers.get('x-sc-country')) || M.cc2(request.cf?.country) || 'US', CUR = M.cur(cc);
  const LN = (LN0 || '') + (route === 'scan' ? '' : '\n' + M.note(cc));
  if (route === 'scan') {
    const imgs = Array.isArray(body.images) ? body.images : [];
    if (!imgs.length) return json({ error: 'Add at least one photo!' }, 400);
    if (imgs.length > MAX_IMAGES) return json({ error: `Up to ${MAX_IMAGES} photos at a time.` }, 400);
    parts = [];
    const AREAS = ['fridge', 'freezer', 'pantry', 'spices', 'counter'];
    for (const [i, im] of imgs.entries()) {
      const d = typeof im === 'string' ? im : im?.data; const area = AREAS.includes(im?.area) ? im.area : 'kitchen';
      parts.push({ text: `Photo ${i + 1} (${area}):` });
      const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d));
      if (!m) return json({ error: 'Photos must be JPEG, PNG or WebP.' }, 400);
      if (m[3].length * 0.75 > MAX_IMAGE_BYTES) return json({ error: 'One photo is too big (max 1.5 MB).' }, 413);
      parts.push({ inlineData: { mimeType: m[1], data: m[3] } });
    }
    parts.push({ text: `These ${imgs.length} photos are all from ONE kitchen; each is labeled with its area (fridge, freezer, pantry, spices). Analyze ALL photos together and return ONE combined, de-duplicated inventory: if the same item appears in several photos, list it once. List every distinct food item you can see, explicitly including spices, dried herbs, seasonings and blends, salt and pepper, sauces, oils, vinegars and condiments (read jar and bottle labels). For each give a short common name (e.g. "smoked paprika", "soy sauce", "olive oil"), a rough quantity (e.g. "6 eggs", "half a jar", "about 1 lb"), a category (Produce, Proteins, Dairy, Pantry, Spices & Seasonings; sauces, oils and condiments go in Pantry; spices, dried herbs, salt, pepper and seasoning blends go in Spices & Seasonings), and low=true if it looks nearly empty or running low. Ignore non-food items. If no food is visible, return an empty list.${lang === 'es' ? ' LANGUAGE: write each name and qty in natural Latin American Spanish (for example "pimentón ahumado", "salsa de soya", "aceite de oliva", "6 huevos", "medio frasco"). Keep category values exactly in English as listed.' : intlScanNote(lang)}` });
    const g = await scanGate(env, request, ip);
    if (!g.allowed) return json({ error: "You've used your 3 free scans this week.", paywall: true }, 402);
    scanTicket = g.ticket || null;
  } else if (route === 'recipes') {
    const diet = dietOf(body.prefs); const ing = clean(body.ingredients, 80).filter(x => !bad(diet, x)); const craving = String(body.craving || 'Anything').slice(0, 60);
    const section = body.section === 'more' ? 'more' : 'ready';
    const avoid = clean(body.avoid, 40);
    if (!ing.length) return json({ error: diet.hard ? "None of your ingredients fit your diet. Add a few that do, or edit My diet!" : 'Add some ingredients first!' }, 400);
    // Trimmed prompt (2026-11-02): about 40% fewer prompt words. Still 5 recipes: with 4, de-duplication left 5 cards instead of 6.
    const ask = section === 'ready'
      ? 'Use ONLY on-hand items plus staples: missing is empty and every ingredient has have=true.' + (diet.hard ? ' Diet swaps must also come from on-hand items or staples, else pick another dish.' : '')
      : 'Each needs 1 to 4 extra items: list them in missing (est_price = local price of the smallest package) and mark them have=false.';
    // Holiday mode: craving 'holiday:<id>' (keeps cache + library buckets separate from normal cravings).
    const HOL = globalThis.SC_HOLIDAY, hol = HOL.isHoliday(craving) ? HOL.info(craving.slice(8), 'en') : null;
    const holNote = hol ? `HOLIDAY MODE: all 5 recipes are festive ${hol.nameEn} dishes. Mix classic ${hol.nameEn} dishes (${hol.dishes}) adapted to what is on hand with creative holiday-themed dishes from the on-hand items. Put the holiday feel in the names.\n` : '';
    parts = [{ text: `On hand ([spice] = spices the user owns, use them for flavor): ${ing.join('; ')}.\nStaples: ${staplesFor(diet)}.\nCraving: ${hol ? hol.nameEn + ' holiday food' : craving}.\n${holNote}${dietPrompt(diet) ? dietPrompt(diet) + '\n' : ''}${cravingNote(diet, craving)}Give exactly 5 clearly different recipes, 2 servings unless the dish needs more, in this order: 1 Easy (max 8 ingredients, 5 short steps), 1 Medium (max 10 ingredients, 7 steps), 1 Chef mode showstopper built around ${section === 'more' ? 'a special ingredient from missing (premium protein, seafood or specialty item, not chicken)' : 'an on-hand protein or vegetable'} (layered flavors, a pan sauce, glaze, marinade or crispy element, plating tip in the last step; max 14 ingredients, 10 steps), then 2 more (Easy, Medium or a 2nd Chef mode). ${ask} Use a handful of on-hand items per recipe. Steps are one or two sentences. One food emoji each.${avoid.length ? ' Do NOT repeat or closely copy these already-shown recipes; use different main ingredients and techniques: ' + avoid.join('; ') + '.' : ''}${LN}` }];
    rkey = !avoid.length && await recipeKey({ ing, craving, section, lang: lang + ':' + CUR, prefs: body.prefs });
    lib = { ing, craving, section, lang, avoid, diet };
  } else {
    const diet = dietOf(body.prefs); const craving = String(body.craving || '').slice(0, 80).trim(); const ing = clean(body.ingredients).filter(x => !bad(diet, x));
    if (!craving) return json({ error: 'Name a craving first!' }, 400);
    parts = [{ text: `Craving: ${craving}.\nIngredients the user has: ${ing.length ? ing.join('; ') : 'unknown, assume only staples'}.\nStaples: ${staplesFor(diet)}.\n${dietPrompt(diet) ? dietPrompt(diet) + '\n' : ''}${cravingNote(diet, craving)}Give one home recipe for this craving (2 servings)${diet.hard ? ', adapted so it fully follows the rules above (swap forbidden ingredients and name the swaps)' : ''}. Mark have=true for ingredients they have or staples. Give every ingredient and missing item en = its plain English name (e.g. "chicken breast") and a qty with a unit (g, ml, tbsp, tsp, cup or a count). List everything else in missing with a rough local grocery price for the smallest common package. est_cook_cost = estimated cost of ALL ingredients used in the recipe (portion actually used). est_menu_price = typical price of ONE serving of this dish at an ordinary local restaurant (menu price, before delivery fees).${LN}` }];
  }

  const dd = route === 'scan' ? null : dietOf(body.prefs); const sd = route === 'scan' ? dietOf(body.prefs) : null;
  if (env.MOCK_AI === '1') { const m = mock(route, body); return json({ ...(route === 'scan' ? flagScan(m, sd) : route === 'recipes' ? { recipes: m.recipes.filter(r => !recipeBad(dd, r)) } : m), mock: true }); }
  const local = /\.snapcravings\.pages\.dev$/.test(host) || host === 'localhost' || host === '127.0.0.1';
  if (rkey && body.nocache && local) rkey = null; // bench hook, previews only
  const stream = route === 'recipes' && (body.stream === true || /ndjson/.test(request.headers.get('accept') || ''));
  const hardDiet = route !== 'scan' && dd.hard;
  // Recipes: 24 h cache by normalized ingredient set + craving + section + diet + language (not for "more ideas").
  if (rkey) { const hit = await cacheGet(env, rkey); if (hit) { hit.usage = { ...(hit.usage || {}), cached: true }; return stream ? ndjson(async send => { hit.recipes.forEach(r => send({ recipe: r })); send({ done: true, ...hit }); }) : json(hit); } }
  // Shared recipe library (functions/_lib/recipelib.js): fill up to LIB_WANT cards from saved AI recipes that this user's
  // ingredients cover; the AI only makes the rest. "More ideas" (avoid list) always goes to the AI. Every valid AI recipe is saved.
  const T0 = Date.now(); let libHits = [], libMs = 0, libStore = 'off';
  if (lib && env.__fetch && !env.__libStore) lib = null; // unit tests with a fake fetch and no store: library off
  if (lib && env.LIB_OFF !== '1' && !(body.nolib && local)) {
    if (!lib.avoid.length) { const f = await Promise.race([libFind(env, lib).catch(() => null), new Promise(r => setTimeout(() => r(null), 1500))]);
      if (f) { libStore = f.store; libHits = libPick(f.cands, { ing: lib.ing, section: lib.section, diet: lib.diet, pkey: await libPrefKey(lib.diet), want: LIB_WANT }).map(h => ({ ...h, recipe: locRecipe(h.recipe, cc, M.fromUS) })); } }
    libMs = Date.now() - T0;
  }
  const bg = p => { try { waitUntil ? waitUntil(p) : p.catch(() => {}); } catch {} };
  const libDone = out => { if (!lib || env.LIB_OFF === '1') return; const ai = out.recipes.filter(r => !r.__lib); out.recipes.forEach(r => delete r.__lib);
    out.usage = { ...(out.usage || {}), library: { served: out.recipes.length - ai.length, ai: ai.length, ms: libMs, store: libStore } };
    bg(Promise.all([ai.length ? libSave(env, ai.map(r => locRecipe(r, cc, M.toUS)), lib) : null, /* library keeps US-equivalent US$ */ libCount(env, { lib: out.recipes.length - ai.length, ai: ai.length, ids: libHits.map(h => h.id) })]).catch(() => {})); };
  if (libHits.length >= LIB_WANT) {
    const out = { recipes: libHits.map(h => ({ ...h.recipe, __lib: 1 })), craving: body.craving, usage: { model: 'library', provider: 'library', ms: Date.now() - T0 } };
    if (stream) return ndjson(async send => { out.recipes.forEach(r => { const { __lib, ...x } = r; send({ recipe: x }); }); libDone(out); send({ done: true, ...out }); });
    libDone(out); return json(out);
  }
  if (libHits.length) parts = [...parts, { text: `The app already has these ${libHits.length} recipes for this user: ${libHits.map(h => h.recipe.name).join('; ')}. Do not repeat or closely copy them. Only ${Math.max(2, LIB_WANT - libHits.length)} new recipes are needed: return exactly that many (keep the level mix).${LN || ''}` }];
  const save = out => { if (rkey && out.recipes?.length) { const p = cachePut(env, rkey, out); try { waitUntil ? waitUntil(p) : p.catch(() => {}); } catch {} } };
  // Diet safety net: drop any recipe that still slips a forbidden ingredient through (names, missing items, steps).
  // If too few survive, ask again (up to 2 more times) and tell the model exactly which terms broke the rules.
  const recipes = async onKeep => {
    const keep = libHits.map(h => ({ ...h.recipe, __lib: 1 })), banned = new Set(); let tried = 0; keep.forEach(r => { const { __lib, ...x } = r; onKeep?.(x); });
    const take = r => { tried++; const h = hardDiet ? recipeHits(dd, r) : []; if (h.length) { h.forEach(x => banned.add(x)); return; } if (keep.some(k => k.name?.toLowerCase() === String(r.name).toLowerCase())) return; keep.push(r); onKeep?.(r); };
    const aiCount = () => keep.filter(r => !r.__lib).length;
    const first = await gemini(env, route, parts, onKeep ? { onRecipe: take } : {}).catch(e => { if (libHits.length) { console.log('ai failed, library only', libHits.length); return null; } throw e; });
    if (first && !onKeep) first.data.recipes.forEach(take);
    const t0 = Date.now();
    for (let i = 0; hardDiet && i < 2 && aiCount() < 3 && keep.length < LIB_WANT && Date.now() - t0 < 40000; i++) {
      const fb = banned.size ? [{ text: `IMPORTANT: your previous answer broke the user's rules by using: ${[...banned].slice(0, 12).join(', ')}. Never use these (or anything made with them), not as an ingredient, garnish or step. Give 5 NEW compliant dishes.${LN}` }] : [];
      try { (await gemini(env, route, [...parts, ...fb])).data.recipes.forEach(take); } catch { break; }
    }
    if (hardDiet) console.log('diet', dd.tags.join('+'), 'kept', keep.length, 'of', tried);
    if (!keep.length) throw Object.assign(new Error(hardDiet ? "We couldn't find recipes that fit your diet with these ingredients. Tap Retry or add a few more ingredients!" : 'The recipe brain hiccuped. Tap Retry!'), { why: [...banned].slice(0, 12), tries: first?.usage?.tries });
    return { recipes: keep.slice(0, 8), craving: body.craving, usage: first ? first.usage : { model: 'library', provider: 'library' } };
  };
  if (stream) return ndjson(async send => {
    try { const out = await recipes(r => send({ recipe: r })); libDone(out); send({ done: true, ...out }); save(out); }
    catch (e) { const m = e.message || 'Something went sideways. Try again!'; send({ done: true, error: lang === 'es' ? (ERR[m] || m) : m, why: e.why, tries: publicTries(e.tries) }); }
  });
  try {
    if (route === 'recipes') { const out = await recipes(); libDone(out); save(out); return json(out); }
    let { data, usage } = await gemini(env, route, parts);
    if (route === 'scan') data = flagScan(data, sd);
    if (route === 'crave' && dd.hard) {
      let h = recipeHits(dd, data.recipe);
      for (let i = 0; i < 2 && h.length; i++) {
        const again = await gemini(env, route, [...parts, { text: `IMPORTANT: your previous answer broke the user's rules by using: ${h.slice(0, 12).join(', ')}. Never use these (or anything made with them), not as an ingredient, garnish or step. If the craving normally needs them, make a compliant version and say so in the name.${LN}` }]);
        data = again.data; h = recipeHits(dd, data.recipe);
      }
      if (h.length) return json({ error: "Couldn't make that one fit your diet. Try a different craving!", why: h.slice(0, 12) }, 502);
    }
    if (route === 'crave' && data?.recipe) data = await steadyCost(env, data, body.craving, cc, dd, bg);
    if (route === 'crave' && data?.recipe?.name) bg(trendHit(env, { country: request.cf?.country, kind: 'crave', label: data.recipe.name, lang, device: String(request.headers.get('x-sc-dev') || '').replace(/[^\w-]/g, '').slice(0, 64) })); // trending Popular cravings
    return json({ ...data, ...(route === 'scan' ? {} : { cur: CUR, country: cc }), craving: body.craving, usage: publicUsage(usage), ...(scanTicket ? { scanTicket } : {}) });
  } catch (e) { return json({ error: e.message || 'Something went sideways. Try again!', tries: publicTries(e.tries), ...(scanTicket ? { scanTicket } : {}), ...(e.why?.length ? { why: e.why } : {}) }, e.why ? 502 : 502); }
}

// NDJSON stream: one JSON object per line ({recipe} ... then {done:true, recipes, craving, usage} or {done:true, error}).
function ndjson(run) {
  const { readable, writable } = new TransformStream(); const w = writable.getWriter(); const enc = new TextEncoder();
  const send = o => w.write(enc.encode(JSON.stringify(o) + '\n')).catch(() => {});
  (async () => { try { await run(send); } finally { try { await w.close(); } catch {} } })();
  return new Response(readable, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff' } });
}
// Cache key: sorted, de-duplicated, lower-cased ingredient names (quantities in parentheses dropped) + craving + section + diet + lang.
const normIng = s => String(s).toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}\[\] ]+/gu, ' ').replace(/\s+/g, ' ').trim();
// Same dish + country + diet => same cook cost and menu price (cached), computed from ingredient price anchors where known.
export async function steadyCost(env, data, craving, cc, dd, bg = p => p) {
  const M = globalThis.SC_MONEY, r = data.recipe, serv = Math.max(1, +r.servings || 2), key = await costKey(craving || r.name, cc, dd?.tags || []);
  const missing = (r.missing || []).map(m => { const p = linePrice(m.en || m.item, m.qty, cc, true); return { ...m, est_price: p != null ? M.round(p, M.cur(cc)) : m.est_price }; });
  let hit = await costGet(env, key, cc).catch(() => null); const wasCached = !!hit;
  if (!hit) { const c = costRecipe(r, data.est_cook_cost, cc); hit = { total: c.total, menu: M.menuFix(+data.est_menu_price > 0 ? +data.est_menu_price : M.menuGuess(c.total / serv, cc), cc), servings: serv, known: c.known, of: c.of }; bg(costPut(env, key, cc, hit)); }
  const total = M.round(hit.total * serv / Math.max(1, hit.servings || serv), M.cur(cc));
  return { ...data, recipe: { ...r, missing }, est_cook_cost: total, est_menu_price: hit.menu, costBasis: { known: hit.known, of: hit.of, cached: wasCached } };
}
// Library recipes store prices as US-equivalent US$; convert missing-item prices for the reader's country (and back on save).
export const locRecipe = (r, cc, f) => r && Array.isArray(r.missing) ? { ...r, missing: r.missing.map(m => ({ ...m, est_price: f(m.est_price, cc) })) } : r;
async function recipeKey({ ing, craving, section, lang, prefs }) {
  const p = prefs || {}; const set = [...new Set(ing.map(normIng).filter(Boolean))].sort();
  return 'rc3:' + await sha(JSON.stringify([set, String(craving).toLowerCase().trim(), section, lang, [...(Array.isArray(p.tags) ? p.tags : [])].map(String).sort(), String(p.other || '').toLowerCase().trim(), String(p.mood || '').toLowerCase().trim()]));
}
const CACHE_TTL = 86400;
const LIB_WANT = 5; // same count the AI is asked for
async function cacheGet(env, key) {
  try { const kv = env.RECIPE_KV || env.RATE_KV; if (kv) { const v = await kv.get(key, 'json'); if (v?.recipes?.length) return v; } } catch {}
  try { const c = typeof caches !== 'undefined' && caches.default; if (c) { const r = await c.match('https://sc-cache.internal/' + key); if (r) { const v = await r.json(); if (v?.recipes?.length) return v; } } } catch {}
  return null;
}
async function cachePut(env, key, out) {
  const v = JSON.stringify({ recipes: out.recipes, craving: out.craving, usage: { model: out.usage?.model, provider: out.usage?.provider } });
  try { const kv = env.RECIPE_KV || env.RATE_KV; if (kv) await kv.put(key, v, { expirationTtl: CACHE_TTL }); } catch {}
  try { const c = typeof caches !== 'undefined' && caches.default; if (c) await c.put('https://sc-cache.internal/' + key, new Response(v, { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + CACHE_TTL } })); } catch {}
}

function mock(route, body) {
  const r = (name, miss) => ({ name, emoji: '🍳', minutes: 15, servings: 2, level: 'Easy', ingredients: [{ item: 'Eggs', qty: '2', have: true }, ...miss.map(m => ({ item: m, qty: '1', have: false }))], missing: miss.map(m => ({ item: m, qty: '1', est_price: 2.5 })), steps: ['Mock step one.', 'Mock step two.'] });
  if (route === 'scan') return { ingredients: [{ name: 'Eggs', qty: '6', category: 'Proteins', low: false }, { name: 'Milk', qty: 'a little', category: 'Dairy', low: true }, { name: 'Peanut butter', qty: 'half a jar', category: 'Pantry', low: true }, { name: 'Smoked paprika', qty: 'half a jar', category: 'Spices & Seasonings', low: false }] };
  if (route === 'recipes') return { recipes: body.section === 'more' ? [r('Mock omelette', ['Cheese'])] : [r('Mock fried eggs', [])] };
  return { recipe: r('Mock ' + body.craving, ['Noodles']), est_cook_cost: 6.5 };
}
