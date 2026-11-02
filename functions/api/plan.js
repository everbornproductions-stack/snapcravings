// POST /api/plan  Weekly meal-prep planner. Body: {days, meals, servings, budget, fridge[], prefs, lang} or {swap:{day,slot}, plan:{names[]}, ...same}.
// Pro / owner token: full plan. Free: first 2 days (preview). Separate fair-use limit (Supabase snap_scan_gate with plan-only hashes), not the 3 free scans.
// Every meal is diet post-checked; offending meals are re-asked (up to 2 rounds) with the exact terms that broke the rules, then dropped.
import { verifyToken, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../_lib/sub.js';
import { dietPrompt } from '../_lib/diet.js';
const dietPromptOf = p => (dietPrompt(p.diet) ? dietPrompt(p.diet) + '\n' : '');
import { PLAN_SCHEMA, MEALS_SCHEMA, planInput, planPrompt, swapPrompt, checkPlan, groceryList, planCost, cleanTexts, offDays, dayGoal } from '../_lib/plan.js';
const VOICE = 'You write for SnapCravings, a fun, upbeat cooking app. Plain, friendly words. No em-dashes. Steps are specific (times, temperatures, amounts) and safe (cook meat through, cool food fast before the fridge).';
const CHAIN = [['gemini-3.8-flash', 50000, { thinkingBudget: 0 }], ['gemini-3.5-flash-lite', 45000, null], ['gemini-2.5-flash-lite', 40000, { thinkingBudget: 0 }]];
const FAIR = { free: 3, pro: 25 }, IP_FAIR = 40; // plans per rolling 7 days
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const ERR_ES = { 'Bad request': 'Solicitud inválida', 'AI is not set up yet (missing GEMINI_API_KEY).': 'La IA todavía no está lista.',
  "You've used this week's meal plans. Try again in a few days!": 'Ya usaste los planes de comida de esta semana. ¡Intenta en unos días!',
  "We couldn't build a plan that fits your diet. Tap Retry!": 'No pudimos armar un plan que vaya con tu dieta. ¡Toca Reintentar!',
  "Couldn't find a swap that fits your diet. Try again!": 'No encontramos un cambio que vaya con tu dieta. ¡Intenta de nuevo!',
  'Our kitchen is busy. Tap Retry in a moment!': 'Nuestra cocina está llena. ¡Toca Reintentar en un momento!', 'That took too long. Tap Retry!': 'Tardó demasiado. ¡Toca Reintentar!',
  'The recipe brain hiccuped. Tap Retry!': 'El cerebro de recetas tuvo un hipo. ¡Toca Reintentar!', 'Whoa, hungry! You hit the hourly limit. Try again soon.': '¡Uy, qué hambre! Llegaste al límite por hora. Intenta de nuevo pronto.' };
const mem = new Map();
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
export async function gemini(env, schema, parts, maxOut = 16000) {
  const chain = env.GEMINI_MODEL ? [[env.GEMINI_MODEL, 50000, null], ...CHAIN] : CHAIN;
  let last = 'The recipe brain hiccuped. Tap Retry!';
  for (const [model, ms, thinking] of chain) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), ms);
    try {
      const gc = { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.6, maxOutputTokens: maxOut }; if (thinking) gc.thinkingConfig = thinking;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: VOICE }] }, contents: [{ role: 'user', parts }], generationConfig: gc }) });
      if (!r.ok) { console.log('plan gemini', model, r.status); if (r.status === 429) last = 'Our kitchen is busy. Tap Retry in a moment!'; continue; }
      const j = await r.json(); const text = j.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '';
      try { return JSON.parse(text); } catch { console.log('plan bad json', model, j.candidates?.[0]?.finishReason); continue; }
    } catch (e) { last = 'That took too long. Tap Retry!'; } finally { clearTimeout(timer); }
  }
  throw new Error(last);
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
function hourly(ip, n) { const k = `plan:${ip}:${Math.floor(Date.now() / 36e5)}`; const c = (mem.get(k) || 0) + 1; mem.set(k, c); if (mem.size > 5000) mem.clear(); return c > n; }
export async function onRequest(ctx) {
  const res = await handle(ctx); const lang = String(ctx.request.headers.get('x-sc-lang') || '').toLowerCase();
  if (!lang.startsWith('es') || res.status < 400) return res;
  const j = await res.clone().json().catch(() => null); if (!j?.error) return res;
  return json({ ...j, error: ERR_ES[j.error] || j.error }, res.status);
}
// Ask the model to fix offending/missing cells, up to 2 rounds; returns the final checked plan meals.
export async function repair(env, p, first, lang, ask = gemini) {
  let { good, bad, missing } = checkPlan(p, first);
  const banned = new Set(bad.flatMap(b => b.why)); let rounds = 0;
  while ((bad.length || missing.length) && rounds < 2) {
    rounds++;
    const cells = missing.map(c => `day ${c.day} ${c.slot}`).join('; ');
    const txt = `${planPrompt(p, lang)}\n\nOnly return the meals for these cells: ${cells}. ${banned.size ? `IMPORTANT: earlier meals broke the user's rules by using: ${[...banned].slice(0, 15).join(', ')}. Never use these (or anything made with them), not as an ingredient, garnish, sauce or step.` : ''} Do not repeat these meals: ${good.map(m => m.name).join('; ')}. prep and storage can be empty lists.`;
    let more; try { more = await ask(env, PLAN_SCHEMA, [{ text: txt }]); } catch { break; }
    const c = checkPlan(p, [...good, ...(more.meals || [])]);
    c.bad.forEach(b => b.why.forEach(w => banned.add(w)));
    good = c.good; bad = c.bad; missing = c.missing;
  }
  return { meals: good, missing, banned: [...banned], rounds };
}
async function handle({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  if (hourly(ip, 40)) return json({ error: 'Whoa, hungry! You hit the hourly limit. Try again soon.' }, 429);
  if (!env.GEMINI_API_KEY && env.MOCK_AI !== '1') return json({ error: 'AI is not set up yet (missing GEMINI_API_KEY).' }, 503);
  const tok = await verifyToken(env, request.headers.get('x-sc-token')); const pro = !!tok; const owner = tok?.e === 'Code unlocked';
  const p = planInput(b, { pro }); const lang = String(b.lang || request.headers.get('x-sc-lang') || '').toLowerCase().startsWith('es') ? 'es' : 'en';
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
    const first = await ask(env, PLAN_SCHEMA, [{ text: planPrompt(p, lang) }]);
    const r = await repair(env, p, first.meals || [], lang, ask);
    console.log('plan', p.genDays, 'x', p.slots.length, 'ok', r.meals.length, 'rounds', r.rounds, 'banned', r.banned.join('|'));
    if (!r.meals.length) return json({ error: "We couldn't build a plan that fits your diet. Tap Retry!", why: r.banned }, 502);
    // Fitness targets: if days miss the calorie goal by >10%, ask once to resize portions (same dishes), then re-check the diet rules.
    const off = offDays(p, r.meals);
    if (off.length) {
      try {
        const txt = `These meal-prep meals miss the user's daily target of about ${dayGoal(p)} kcal per day (one serving of each meal${p.fit.p ? `, about ${Math.round(p.fit.p * dayGoal(p) / p.fit.kcal)} g protein` : ''}). Off days: ${off.map(o => `day ${o.day} = ${o.kcal} kcal`).join('; ')}. Return ALL the meals again with the same day, slot, name and dishes, but adjust ingredient quantities (and add a simple side if needed) so each day lands within 10% of the target, and update kcal, protein_g, carbs_g, fat_g, est_cook_cost honestly. Keep every diet and allergy rule. Meals: ${JSON.stringify(r.meals.map(m => ({ day: m.day, slot: m.slot, name: m.name, emoji: m.emoji, minutes: m.minutes, servings: m.servings, ingredients: m.ingredients, steps: m.steps, keeps_days: m.keeps_days, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, est_cook_cost: m.est_cook_cost })))}\n${dietPromptOf(p)}${lang === 'es' ? 'Keep all text in Spanish.' : ''}`;
        const fixed = await ask(env, MEALS_SCHEMA, [{ text: txt }], 16000); const c = checkPlan(p, fixed.meals || []);
        if (c.good.length === r.meals.length && offDays(p, c.good).length < off.length) r.meals = c.good;
        console.log('fit resize', off.length, '->', offDays(p, c.good).length, 'bad', c.bad.length);
      } catch {}
    }
    const meals = r.meals.sort((x, y) => x.day - y.day || ['Breakfast', 'Lunch', 'Dinner'].indexOf(x.slot) - ['Breakfast', 'Lunch', 'Dinner'].indexOf(y.slot));
    return json({ fit: p.fit, days: p.days, genDays: p.genDays, preview: p.preview, slots: p.slots, servings: p.servings, budget: p.budget, meals, open: r.missing,
      grocery: groceryList(meals, p.fridge, p.diet), prep: cleanTexts(p.diet, (first.prep || []).slice(0, 10), x => (x?.title || '') + '. ' + (x?.detail || '')), storage: cleanTexts(p.diet, (first.storage || []).slice(0, 8).map(String)), total: planCost(meals), lang, ...(env.MOCK_AI === '1' ? { mock: true } : {}) });
  } catch (e) { return json({ error: e.message || 'The recipe brain hiccuped. Tap Retry!' }, 502); }
}
async function mockAsk(env, schema, parts) {
  const txt = parts[0].text; const days = +(/(\d+)-day/.exec(txt) || [])[1] || 1; const slots = /Breakfast/.test(txt.split('\n')[0]) ? ['Breakfast', 'Lunch', 'Dinner'] : /Lunch/.test(txt.split('\n')[0]) ? ['Lunch', 'Dinner'] : ['Dinner'];
  const meals = []; for (let d = 1; d <= days; d++) for (const s of slots) meals.push({ day: d, slot: s, name: `Mock bowl ${d}${s[0]}`, emoji: '🍱', minutes: 15, servings: 2, ingredients: [{ item: 'Rice', qty: '1 cup', aisle: 'Bakery & Grains', have: false }, { item: 'Chicken thighs', qty: '1 lb', aisle: 'Meat & Seafood', have: false }], steps: ['Reheat.', 'Serve.'], est_cook_cost: 6.4, keeps_days: 4, kcal: 520, protein_g: 38, carbs_g: 55, fat_g: 14 });
  return { meals, prep: [{ title: 'Cook rice', detail: 'Cook 3 cups rice, cool on a tray.', minutes: 25 }], storage: ['Rice keeps 4 days.'] };
}
