// POST /api/holiday-plan {holiday, country, guests, time:'18:00', fridge[], prefs, lang, stream} -> holiday menu + scaled shopping list + cooking timeline.
// Streams NDJSON when asked: {menu} first, then {done:true, ...plan}. Same free AI chain as /api/recipes (Gemini lite models by quota bucket,
// then Workers AI). Full plans are cached 24 h by holiday + country + guests + time + diet + lang + fridge. Free = menu + 3 timeline steps.
import { verifyToken } from '../_lib/sub.js';
import { langCode } from '../_lib/lang.js';
import { sha } from '../_lib/extras.js';
import { hpInput, menuPrompt, timelinePrompt, checkMenu, cleanTimeline, shoppingFor, previewOf, MENU_SCHEMA, TIMELINE_SCHEMA, SHAPE } from '../_lib/hplan.js';
const VOICE = 'You write for SnapCravings, a fun, upbeat cooking app. Plain, friendly words. No em-dashes. Specific and food-safe (cook meat through, thaw in the fridge, keep hot food hot).';
const CHAIN = [['gemini-3.5-flash-lite', { thinkingLevel: 'minimal' }], ['gemini-3.1-flash-lite', { thinkingLevel: 'minimal' }], ['gemini-3-flash-preview', { thinkingLevel: 'minimal' }]];
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const mem = new Map();
const hourly = (ip, n) => { const k = `hp:${ip}:${Math.floor(Date.now() / 36e5)}`; const c = (mem.get(k) || 0) + 1; mem.set(k, c); if (mem.size > 5000) mem.clear(); return c > n; };
export async function ask(env, kind, schema, text) {
  if (env.__ask) return env.__ask(kind, text);
  let last = 'The recipe brain hiccuped. Tap Retry!';
  for (const [model, thinking] of CHAIN) {
    if (!env.GEMINI_API_KEY) break;
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 40000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: VOICE }] }, contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.6, maxOutputTokens: 12000, thinkingConfig: thinking } }) });
      if (!r.ok) { console.log('hp gemini', model, r.status); if (r.status === 429) last = 'Our kitchen is busy. Tap Retry in a moment!'; continue; }
      const j = await r.json(); const out = JSON.parse(j.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || 'null');
      if (out && Array.isArray(out[kind])) return out;
    } catch (e) { last = 'That took too long. Tap Retry!'; } finally { clearTimeout(timer); }
  }
  if (env.AI) { try { // Workers AI free backup (Qwen3, JSON mode, schema in the prompt)
    const r = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', { messages: [{ role: 'system', content: VOICE + ' Reply with ONE JSON object only, shaped like: ' + SHAPE[kind] + ' /no_think' }, { role: 'user', content: text }], response_format: { type: 'json_object' }, max_tokens: 6000, temperature: 0.6 });
    const raw = r?.response; const out = typeof raw === 'string' ? JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) : raw;
    if (out && Array.isArray(out[kind])) return out; } catch (e) { console.log('hp cf', e.message); } }
  throw new Error(last);
}
async function cacheGet(k) { try { const c = caches.default; const r = await c.match('https://sc-cache.internal/' + k); return r ? await r.json() : null; } catch { return null; } }
async function cachePut(k, v) { try { await caches.default.put('https://sc-cache.internal/' + k, new Response(JSON.stringify(v), { headers: { 'cache-control': 'max-age=86400' } })); } catch {} }
export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const p = hpInput(b); if (!p.holiday) return json({ error: 'Bad request' }, 400);
  if (hourly(ip, 20)) return json({ error: 'Whoa, hungry! You hit the hourly limit. Try again soon.' }, 429);
  const tok = env.__pro !== undefined ? env.__pro : await verifyToken(env, request.headers.get('x-sc-token')); const pro = !!tok;
  const lang = langCode(b.lang || request.headers.get('x-sc-lang'));
  const key = 'hp5:' + await sha(JSON.stringify([p.holiday, p.country, p.guests, p.time, lang, p.diet.tags, p.diet.other || '', [...p.fridge].map(s => s.toLowerCase()).sort()]));
  const stream = b.stream === true;
  const bg = x => { try { waitUntil ? waitUntil(x) : null; } catch {} };
  const build = async send => {
    const hit = env.__ask ? null : await cacheGet(key);
    if (hit) { send?.({ menu: hit.menu }); return { ...previewOf(hit, pro), cached: true }; }
    let { menu, banned } = checkMenu(p, (await ask(env, 'menu', MENU_SCHEMA, menuPrompt(p, lang))).menu);
    if (menu.length < 5 && banned.length) { const again = checkMenu(p, (await ask(env, 'menu', MENU_SCHEMA, menuPrompt(p, lang) + `\nIMPORTANT: never use ${banned.join(', ')} or anything made with them.`)).menu); if (again.menu.length > menu.length) menu = again.menu; }
    if (!menu.length) throw new Error("We couldn't build a menu that fits your diet. Tap Retry!");
    send?.({ menu });
    const timeline = cleanTimeline((await ask(env, 'timeline', TIMELINE_SCHEMA, timelinePrompt(p, menu, lang))).timeline, menu);
    const full = { holiday: p.holiday, country: p.country, guests: p.guests, time: p.time, menu, timeline, shopping: shoppingFor(p, menu) };
    if (!env.__ask) bg(cachePut(key, full));
    return previewOf(full, pro);
  };
  if (stream) {
    const { readable, writable } = new TransformStream(); const w = writable.getWriter(), enc = new TextEncoder(); const send = o => w.write(enc.encode(JSON.stringify(o) + '\n'));
    const run = (async () => { try { send({ done: true, ...(await build(send)) }); } catch (e) { send({ done: true, error: e.message || 'Something went sideways. Try again!' }); } finally { w.close(); } })();
    bg(run);
    return new Response(readable, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
  }
  try { return json(await build(null)); } catch (e) { return json({ error: e.message || 'Something went sideways. Try again!' }, 502); }
}
