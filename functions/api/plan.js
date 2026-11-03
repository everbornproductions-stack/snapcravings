// POST /api/plan  Weekly meal-prep planner. Body: {days, meals, servings, budget, fridge[], prefs, lang} or {swap:{day,slot}, plan:{names[]}, ...same}.
// Pro / owner token: full plan. Free: first 2 days (preview). Separate fair-use limit (Supabase snap_scan_gate with plan-only hashes), not the 3 free scans.
// Every meal is diet post-checked; offending meals are re-asked (up to 2 rounds) with the exact terms that broke the rules, then dropped.
import { verifyToken, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../_lib/sub.js';
import { langCode } from '../_lib/lang.js';
import { dietPrompt } from '../_lib/diet.js';
const dietPromptOf = p => (dietPrompt(p.diet) ? dietPrompt(p.diet) + '\n' : '');
import { PLAN_SCHEMA, MEALS_SCHEMA, MENU_SCHEMA, PREP_SCHEMA, menuPrompt, dayPrompt, prepPrompt, planInput, planPrompt, swapPrompt, checkPlan, groceryList, planCost, cleanTexts, offDays, dayGoal, scaleToGoal, proteinShort } from '../_lib/plan.js';
const VOICE = 'You write for SnapCravings, a fun, upbeat cooking app. Plain, friendly words. No em-dashes. Steps are specific (times, temperatures, amounts) and safe (cook meat through, cool food fast before the fridge).';
// Gemini free quotas are per model (3.8-flash has no free quota on this key, 2.5-flash-lite is closed: 404), so the chain uses the
// models that answer, then the same free OpenAI-style providers as /api/scan, then Workers AI, then one last Gemini try after a pause.
const MIN = { thinkingLevel: 'minimal' };
// Measured 2026-11-02 8:10 PM PT on this key (one-day MEALS call): 3.6-flash 3.2-4.6 s, 3.1-flash-lite 3.4-7.8 s, 3.5-flash-lite and
// 3-flash-preview 429 (quota used up), gemma-4 500/timeout. Order is re-ranked live by recentFail(): a model that just 429'd sinks.
const CHAIN = [['gemini-3.6-flash', 10000, MIN], ['gemini-3.1-flash-lite', 10000, MIN], ['gemini-3.5-flash-lite', 9000, MIN], ['gemini-3-flash-preview', 10000, MIN]];
const OAI = {
  cerebras: { key: 'CEREBRAS_API_KEY', url: 'https://api.cerebras.ai/v1/chat/completions', model: 'gpt-oss-120b' },
  groq: { key: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'openai/gpt-oss-120b' },
  mistral: { key: 'MISTRAL_API_KEY', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
  openrouter: { key: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'google/gemma-4-26b-a4b-it:free' }
};
const CF_TEXT = '@cf/qwen/qwen3-30b-a3b-fp8';
export const BUSY = "We're extra busy right now. Try again in a minute!";
const FAIR = { free: 3, pro: 25 }, IP_FAIR = 40; // plans per rolling 7 days
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const ERR_ES = { 'Bad request': 'Solicitud inválida', 'AI is not set up yet (missing GEMINI_API_KEY).': 'La IA todavía no está lista.',
  "You've used this week's meal plans. Try again in a few days!": 'Ya usaste los planes de comida de esta semana. ¡Intenta en unos días!',
  "We couldn't build a plan that fits your diet. Tap Retry!": 'No pudimos armar un plan que vaya con tu dieta. ¡Toca Reintentar!',
  "Couldn't find a swap that fits your diet. Try again!": 'No encontramos un cambio que vaya con tu dieta. ¡Intenta de nuevo!',
  'Our kitchen is busy. Tap Retry in a moment!': 'Nuestra cocina está llena. ¡Toca Reintentar en un momento!', "We're extra busy right now. Try again in a minute!": 'Estamos muy ocupados ahorita. ¡Intenta de nuevo en un minuto!', 'That took too long. Tap Retry!': 'Tardó demasiado. ¡Toca Reintentar!',
  'The recipe brain hiccuped. Tap Retry!': 'El cerebro de recetas tuvo un hipo. ¡Toca Reintentar!', 'Whoa, hungry! You hit the hourly limit. Try again soon.': '¡Uy, qué hambre! Llegaste al límite por hora. Intenta de nuevo pronto.' };
const mem = new Map();
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
// One answer must have every required top-level key, and meals/menu lists must not be empty.
export const okPlanShape = (schema, d) => !!d && typeof d === 'object' && !Array.isArray(d) && (schema.required || []).every(k => k in d && (schema.properties?.[k]?.type !== 'array' || Array.isArray(d[k])))
  && ['meals', 'menu'].every(k => !(schema.required || []).includes(k) || d[k].length > 0);
const parseLoose = s => { const t = String(s).replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^```(json)?|```$/g, '').trim(); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); };
const sysFor = schema => VOICE + ' Reply with ONE JSON object only, no prose, matching this JSON schema exactly (all required keys): ' + JSON.stringify(schema);
const fail = (st, busy) => Object.assign(new Error(st), { st, busy });
async function geminiCall(env, model, ms, thinking, schema, parts, maxOut) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const gc = { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.6, maxOutputTokens: maxOut }; if (thinking) gc.thinkingConfig = thinking;
    const r = await (env.__fetch || fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: VOICE }] }, contents: [{ role: 'user', parts }], generationConfig: gc }) });
    if (!r.ok) throw fail(String(r.status), r.status === 429 || r.status === 503);
    const j = await r.json(); const text = j.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '';
    let d; try { d = JSON.parse(text); } catch { throw fail('badjson'); } if (!okPlanShape(schema, d)) throw fail('badjson'); return d;
  } catch (e) { if (e.name === 'AbortError') throw fail('timeout'); throw e; } finally { clearTimeout(timer); }
}
async function oaiCall(env, name, schema, parts, maxOut, ms = 12000) {
  const P = OAI[name]; const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const model = env[name.toUpperCase() + '_PLAN_MODEL'] || P.model;
    const body = { model, messages: [{ role: 'system', content: sysFor(schema) }, { role: 'user', content: parts.map(p => p.text || '').join('\n') }], response_format: { type: 'json_object' }, temperature: 0.6, max_tokens: Math.min(maxOut, name === 'groq' ? 5000 : 12000) }; // Groq free tier: prompt + max_tokens must fit 8K tokens/min
    if (/gpt-oss/.test(model)) body.reasoning_effort = 'low';
    const r = await (env.__fetch || fetch)(P.url, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env[P.key], ...(name === 'openrouter' ? { 'HTTP-Referer': 'https://snapcravings.pages.dev', 'X-Title': 'SnapCravings' } : {}) }, body: JSON.stringify(body) });
    if (!r.ok) throw fail(String(r.status), r.status === 429 || r.status === 503);
    const j = await r.json(); let d; try { d = parseLoose(j.choices?.[0]?.message?.content || ''); } catch { throw fail('badjson'); }
    if (!okPlanShape(schema, d)) throw fail('badjson'); return d;
  } catch (e) { if (e.name === 'AbortError') throw fail('timeout'); throw e; } finally { clearTimeout(timer); }
}
async function cfCall(env, schema, parts, maxOut, ms = 15000) {
  if (!env.AI) throw fail('nobinding');
  const run = env.AI.run(CF_TEXT, { messages: [{ role: 'system', content: sysFor(schema) + ' /no_think' }, { role: 'user', content: parts.map(p => p.text || '').join('\n') }], response_format: { type: 'json_object' }, max_tokens: Math.min(maxOut, 8000), temperature: 0.6 });
  let tm; const out = await Promise.race([run, new Promise((_, rej) => { tm = setTimeout(() => rej(fail('timeout')), ms); })]).finally(() => clearTimeout(tm));
  let d = out?.response ?? out?.choices?.[0]?.message?.content; try { if (typeof d === 'string') d = parseLoose(d); } catch { throw fail('badjson'); }
  if (!okPlanShape(schema, d)) throw fail('badjson'); return d;
}
// Per-isolate health: when a model last failed with 429/503/timeout. Sick models drop to the end for 60 s.
const sick = new Map(); export const recentFail = (name, now = Date.now()) => now - (sick.get(name) || 0) < 60000;
const HEAD = 2500, DEADLINE = 28000; export const PLAN_BUDGET = 38000; // one plan request never runs past ~40 s // next racer starts after HEAD ms (or at once on a failure); whole call gives up at DEADLINE
// Every step of the plan engine: [kind, name/model, timeout ms, thinking]. Exported for tests.
export function planChain(env) {
  const L = [];
  if (env.GEMINI_MODEL) L.push(['gemini', env.GEMINI_MODEL, 10000, MIN]);
  if (env.GEMINI_API_KEY) L.push(...CHAIN.map(c => ['gemini', ...c]));
  for (const n of ['cerebras', 'groq', 'mistral', 'openrouter']) if (env[OAI[n].key]) L.push(['oai', n, 12000]);
  if (env.AI) L.push(['cf', 'workers-ai', 15000]);
  const ok = L.filter(x => !recentFail(x[1])), bad = L.filter(x => recentFail(x[1]));
  return [...ok, ...bad];
}
// Hedged race: entry 0 starts, the next one starts after HEAD ms or as soon as one fails; the first valid answer wins and the rest are ignored.
// Gemini errors with 429 get one quick retry later in the race (per-minute bursts from the parallel day calls).
export async function gemini(env, schema, parts, maxOut = 16000) {
  const chain = planChain(env); const q = chain.map(c => [...c, false]); const tries = [];
  let busy = 0, timeouts = 0;
  const call = ([kind, name, ms, thinking]) => kind === 'gemini' ? geminiCall(env, name, ms, thinking, schema, parts, maxOut) : kind === 'oai' ? oaiCall(env, name, schema, parts, maxOut, ms) : cfCall(env, schema, parts, maxOut, ms);
  return new Promise((resolve, reject) => {
    let running = 0, done = false, kick;
    const dl = setTimeout(() => end(), env.__noWait ? 60000 : Math.min(DEADLINE, env.__budget || DEADLINE));
    const end = v => { if (done) return; done = true; clearTimeout(kick); clearTimeout(dl);
      if (v) return resolve(v); const e = new Error(busy ? BUSY : timeouts ? 'That took too long. Tap Retry!' : 'The recipe brain hiccuped. Tap Retry!'); e.tries = tries; e.busy = busy > 0; reject(e); };
    const next = () => {
      clearTimeout(kick); if (done) return;
      if (!q.length) { if (!running) end(); return; }
      const e = q.shift(); running++;
      call(e).then(v => { running--; tries.push([e[1], 200]); end(v); }, err => { running--; const st = err.st || 'error'; tries.push([e[1], st]); console.log('plan ai fail', e[0], e[1], st);
        if (err.busy || st === 'timeout') sick.set(e[1], Date.now());
        if (err.busy) busy++; else if (st === 'timeout') timeouts++;
        if (err.busy && e[0] === 'gemini' && !e[4]) q.push([e[0], e[1], e[2], e[3], true]); // one late retry
        next(); });
      if (q.length) kick = setTimeout(next, env.__noWait ? 0 : HEAD);
    };
    next();
  });
}
async function fairUse(env, request, ip, pro, owner) {
  if (owner || env.ENFORCE_FREE === '0') return { allowed: true };
  const dev = String(request.headers.get('x-sc-dev') || '').replace(/[^\w-]/g, '').slice(0, 64);
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 4000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/snap_scan_gate`, { method: 'POST', signal: ac.signal, headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_device: await sha('snapcravings-plan-d:' + (dev || 'ip-' + ip)), p_ip: await sha('snapcravings-plan-ip:' + ip), p_scan: 'plan' + crypto.randomUUID().replace(/-/g, ''), p_limit: pro ? FAIR.pro : FAIR.free, p_ip_limit: pro ? 200 : IP_FAIR }) });
    if (!r.ok) return { allowed: true }; const j = await r.json(); return { allowed: j?.allowed !== false };
  } catch { return { allowed: true }; } finally { clearTimeout(t); }
}
import { hourly as rl } from '../_lib/limit.js';
export async function onRequest(ctx) {
  const res = await handle(ctx); const lang = String(ctx.request.headers.get('x-sc-lang') || '').toLowerCase();
  if (!lang.startsWith('es') || res.status < 400) return res;
  const j = await res.clone().json().catch(() => null); if (!j?.error) return res;
  return json({ ...j, error: ERR_ES[j.error] || j.error }, res.status);
}
// Ask the model to fix offending/missing cells, up to 2 rounds; returns the final checked plan meals.
export async function repair(env, p, first, lang, ask = gemini, base = planPrompt(p, lang)) {
  let { good, bad, missing } = checkPlan(p, first);
  const banned = new Set(bad.flatMap(b => b.why)); let rounds = 0;
  while ((bad.length || missing.length) && rounds < 3) { // refill: only the missing/dropped cells are asked again
    rounds++;
    const cells = missing.map(c => `day ${c.day} ${c.slot}`).join('; ');
    const txt = `${base}\n\nOnly return the meals for these cells: ${cells}. ${banned.size ? `IMPORTANT: earlier meals broke the user's rules by using: ${[...banned].slice(0, 15).join(', ')}. Never use these (or anything made with them), not as an ingredient, garnish, sauce or step.` : ''} Do not repeat these meals: ${good.map(m => m.name).join('; ')}. prep and storage can be empty lists.`;
    let more; try { more = await ask(env, MEALS_SCHEMA, [{ text: txt }], Math.min(16000, 2500 + 1500 * missing.length)); } catch { continue; }
    const c = checkPlan(p, [...good, ...(more.meals || [])]);
    c.bad.forEach(b => b.why.forEach(w => banned.add(w)));
    good = c.good; bad = c.bad; missing = c.missing;
  }
  return { meals: good, missing, banned: [...banned], rounds };
}
async function handle(ctx) {
  const { request, env } = ctx;
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  if (await rl(env, 'plan', ip, 40)) return json({ error: 'Whoa, hungry! You hit the hourly limit. Try again soon.' }, 429);
  if (!env.GEMINI_API_KEY && env.MOCK_AI !== '1') return json({ error: 'AI is not set up yet (missing GEMINI_API_KEY).' }, 503);
  const tok = await verifyToken(env, request.headers.get('x-sc-token')); const pro = !!tok; const owner = tok?.e === 'Code unlocked';
  const p = planInput(b, { pro }); const lang = langCode(b.lang || request.headers.get('x-sc-lang'));
  const ask = env.MOCK_AI === '1' ? mockAsk : gemini;
  try {
    if (b.swap) { // one-meal swap: hourly limit only
      const day = Math.min(p.days, Math.max(1, +b.swap.day || 1)); const slot = p.slots.includes(b.swap.slot) ? b.swap.slot : p.slots[0];
      if (!pro && day > p.genDays) return json({ error: 'Pro', paywall: true }, 402);
      const q = { ...p, genDays: Math.max(p.genDays, day) }; const avoid = (Array.isArray(b.avoid) ? b.avoid : []).map(s => String(s).slice(0, 80)).slice(0, 30);
      let banned = [];
      for (let i = 0; i < 3; i++) {
        const out = await ask(env, MEALS_SCHEMA, [{ text: swapPrompt(q, day, slot, avoid, lang) + (banned.length ? ` IMPORTANT: your last answer broke the user's rules by using: ${banned.join(', ')}. Never use these.` : '') }], 4000);
        const c = checkPlan(q, (out.meals || []).map(m => ({ ...m, day, slot })));
        if (c.good.length) return json({ meal: c.good[0] });
        banned = [...new Set([...banned, ...c.bad.flatMap(x => x.why)])];
      }
      return json({ error: "Couldn't find a swap that fits your diet. Try again!", why: banned }, 502);
    }
    if (!(await fairUse(env, request, ip, pro, owner)).allowed) return json({ error: "You've used this week's meal plans. Try again in a few days!", paywall: !pro }, 402);
    const meta = { fit: p.fit, days: p.days, genDays: p.genDays, preview: p.preview, slots: p.slots, servings: p.servings, budget: p.budget, lang };
    const stream = b.stream === true || /ndjson/.test(request.headers.get('accept') || '');
    if (!stream) { const out = await buildPlan(env, p, lang, ask, () => {}); return json(out.error ? { error: out.error, why: out.why, ...(out.busy ? { busy: true, retryAfter: 60 } : {}) } : out, out.error ? (out.busy ? 503 : 502) : 200); }
    const ts = new TransformStream(), w = ts.writable.getWriter(), enc = new TextEncoder(); const send = o => w.write(enc.encode(JSON.stringify(o) + '\n')).catch(() => {});
    const job = (async () => { send({ meta }); try { const out = await buildPlan(env, p, lang, ask, send); await send({ done: true, ...out }); } catch (e) { await send({ done: true, error: e.message || 'The recipe brain hiccuped. Tap Retry!' }); } await w.close().catch(() => {}); })();
    if (ctx.waitUntil) ctx.waitUntil(job);
    return new Response(ts.readable, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-accel-buffering': 'no' } });
  } catch (e) { return json({ error: e.message || 'The recipe brain hiccuped. Tap Retry!', ...(e.busy ? { busy: true, retryAfter: 60 } : {}) }, e.busy ? 503 : 502); }
}
async function mockAsk(env, schema, parts) {
  const txt = parts[0].text; const days = +(/(\d+)-day/.exec(txt) || [])[1] || 1; const slots = /Breakfast/.test(txt.split('\n')[0]) ? ['Breakfast', 'Lunch', 'Dinner'] : /Lunch/.test(txt.split('\n')[0]) ? ['Lunch', 'Dinner'] : ['Dinner'];
  const meals = []; for (let d = 1; d <= days; d++) for (const s of slots) meals.push({ day: d, slot: s, name: `Mock bowl ${d}${s[0]}`, emoji: '🍱', minutes: 15, servings: 2, ingredients: [{ item: 'Rice', qty: '1 cup', aisle: 'Bakery & Grains', have: false }, { item: 'Chicken thighs', qty: '1 lb', aisle: 'Meat & Seafood', have: false }], steps: ['Reheat.', 'Serve.'], est_cook_cost: 6.4, keeps_days: 4, kcal: 520, protein_g: 38, carbs_g: 55, fat_g: 14 });
  if (schema === MENU_SCHEMA) return { menu: meals.map(m => ({ day: m.day, slot: m.slot, name: m.name, protein: 'chicken' })) };
  return { meals, prep: [{ title: 'Cook rice', detail: 'Cook 3 cups rice, cool on a tray.', minutes: 25 }], storage: ['Rice keeps 4 days.'] };
}

const SLOT_ORDER = ['Breakfast', 'Lunch', 'Dinner'];
// Resize one day's portions toward the calorie target (same dishes), then re-check the diet rules.
async function fitDay(env, p, meals, lang, ask) {
  const off = offDays(p, meals); if (!off.length) return meals;
  try {
    const txt = `These meal-prep meals miss the user's daily target of about ${dayGoal(p)} kcal per day (one serving of each meal${p.fit.p ? `, about ${Math.round(p.fit.p * dayGoal(p) / p.fit.kcal)} g protein` : ''}). Off days: ${off.map(o => `day ${o.day} = ${o.kcal} kcal`).join('; ')}. Return ALL the meals again with the same day, slot, name and dishes, but adjust ingredient quantities (and add a simple side if needed) so each day lands within 10% of the target, and update kcal, protein_g, carbs_g, fat_g, est_cook_cost honestly. Keep every diet and allergy rule. Meals: ${JSON.stringify(meals.map(m => ({ day: m.day, slot: m.slot, name: m.name, emoji: m.emoji, minutes: m.minutes, servings: m.servings, ingredients: m.ingredients, steps: m.steps, keeps_days: m.keeps_days, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, est_cook_cost: m.est_cook_cost })))}\n${dietPromptOf(p)}${LANG_KEEP(lang)}`;
    const fixed = await ask(env, MEALS_SCHEMA, [{ text: txt }], meals.length > 3 ? 16000 : 6000); const c = checkPlan(p, fixed.meals || []);
    console.log('fit resize', off.length, '->', offDays(p, c.good).length, 'bad', c.bad.length);
    if (c.good.length === meals.length && offDays(p, c.good).length < off.length) return c.good;
  } catch {}
  return meals;
}
const LANG_KEEP = l => (l && l !== 'en' ? `Keep all text in the same language as the meals (${l}).` : '');
// Fast plan: tiny menu call, then every day (and the prep guide) in parallel. Each finished day is sent right away.
// Falls back to the original single big call if the menu call fails.
export async function buildPlan(env, p, lang, ask0 = gemini, send = () => {}) {
  const t0 = Date.now(); let menu = null, lastErr = null, okCalls = 0;
  // Server cause of the ~200 s "hang": menu + day + 3 repair rounds + fit resize could each wait a full 28 s race in a row.
  // Now the whole plan has one budget: no new AI call starts after PLAN_BUDGET, and each call only gets the time that is left.
  const ask = (env2, ...a) => { const left = PLAN_BUDGET - (Date.now() - t0); if (left < 3000) { const e = new Error("That took too long. Check your signal and tap Retry!"); lastErr = lastErr || e; return Promise.reject(e); }
    return ask0({ ...env2, __budget: left }, ...a).then(v => { okCalls++; return v; }, e => { lastErr = e; throw e; }); }; // remember why the AI failed, so an empty plan says "busy" and not "diet"

  // The menu round trip only pays off for the full week; a 2-day preview is faster as one call (measured 4.7 s vs 5.6 s).
  if (p.genDays > 2) try { const m = await ask(env, MENU_SCHEMA, [{ text: menuPrompt(p, lang) }], 4000); menu = checkMenu(p, m.menu); } catch {}
  let meals = [], open = [], prepOut = { prep: [], storage: [] }, banned = [];
  if (menu) {
    const prepJob = ask(env, PREP_SCHEMA, [{ text: prepPrompt(p, menu, lang) }], 4000).catch(() => ({ prep: [], storage: [] }));
    await Promise.all(Array.from({ length: p.genDays }, (_, i) => i + 1).map(async day => {
      const q = { ...p, onlyDay: day }; const base = dayPrompt(p, day, menu, lang);
      let first = []; try { first = (await ask(env, MEALS_SCHEMA, [{ text: base }], 6000)).meals || []; } catch {}
      const r = await repair(env, q, first, lang, ask, base + ` Do not reuse these names from other days: ${menu.filter(m => m.day !== day).map(m => m.name).join('; ')}.`);
      banned.push(...r.banned); open.push(...r.missing);
      let dm = q.fit ? scaleToGoal(q, await fitDay(env, q, r.meals, lang, ask)) : r.meals; dm = dm.sort(slotSort);
      meals.push(...dm); if (dm.length) send({ day, meals: dm, ms: Date.now() - t0 });
    }));
    prepOut = await prepJob;
  } else {
    let first; try { first = await ask(env, PLAN_SCHEMA, [{ text: planPrompt(p, lang) }]); } catch { first = { meals: [], prep: [], storage: [] }; } // repair() refills every cell
    const r = await repair(env, p, first.meals || [], lang, ask); banned = r.banned; open = r.missing;
    meals = p.fit ? scaleToGoal(p, await fitDay(env, p, r.meals, lang, ask)) : r.meals; prepOut = first;
    for (let d = 1; d <= p.genDays; d++) { const dm = meals.filter(m => m.day === d).sort(slotSort); if (dm.length) send({ day: d, meals: dm, ms: Date.now() - t0 }); }
  }
  console.log('plan', menu ? 'fast' : 'single', p.genDays, 'x', p.slots.length, 'ok', meals.length, 'ms', Date.now() - t0, 'banned', [...new Set(banned)].join('|'));
  if (!meals.length) return lastErr && !okCalls ? { error: lastErr.message || BUSY, busy: !!lastErr.busy } : lastErr?.busy && !banned.length ? { error: BUSY, busy: true } : { error: "We couldn't build a plan that fits your diet. Tap Retry!", why: [...new Set(banned)] };
  meals.sort((x, y) => x.day - y.day || slotSort(x, y)); open.sort((x, y) => x.day - y.day || slotSort(x, y));
  return { fit: p.fit, days: p.days, genDays: p.genDays, preview: p.preview, slots: p.slots, servings: p.servings, budget: p.budget, meals, open,
    grocery: groceryList(meals, p.fridge, p.diet), prep: cleanTexts(p.diet, (prepOut.prep || []).slice(0, 10), x => (x?.title || '') + '. ' + (x?.detail || '')), storage: cleanTexts(p.diet, (prepOut.storage || []).slice(0, 8).map(String)), total: planCost(meals), lowProtein: proteinShort(p, meals), lang, ...(env.MOCK_AI === '1' ? { mock: true } : {}) };
}
const slotSort = (x, y) => SLOT_ORDER.indexOf(x.slot) - SLOT_ORDER.indexOf(y.slot);
// A usable menu covers every (day, slot) with distinct names; otherwise use the single-call path.
export function checkMenu(p, menu) {
  const seen = new Map(), names = new Set();
  for (const m of menu || []) { const d = Math.round(+m?.day), k = d + '|' + m?.slot, n = String(m?.name || '').trim().slice(0, 90);
    if (d < 1 || d > p.genDays || !p.slots.includes(m?.slot) || !n || seen.has(k) || names.has(n.toLowerCase())) continue; seen.set(k, { day: d, slot: m.slot, name: n }); names.add(n.toLowerCase()); }
  return seen.size >= p.genDays * p.slots.length ? [...seen.values()] : null;
}
