// SnapCravings API (Cloudflare Pages Function). The AI key stays server-side in env.GEMINI_API_KEY.
// Routes: POST /api/scan {images:[dataURL]} | POST /api/recipes {ingredients, craving} | POST /api/crave {craving, ingredients}
// GET /api/health. Set MOCK_AI=1 (local only) to return canned results without a key.
const MODEL = 'gemini-3.8-flash'; // gemini-2.5-flash is closed to new API users (404); see CHAIN for fallbacks
const MAX_IMAGES = 10, MAX_IMAGE_BYTES = 1_500_000, MAX_BODY = 9_000_000;
const LIMIT = { scan: 60, recipes: 30, crave: 30 }, WINDOW_S = 3600; // per IP per hour
const mem = new Map(); // fallback limiter when no KV binding (per isolate, best effort)

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

async function limited(env, ip, route) {
  const key = `rl:${route}:${ip}:${Math.floor(Date.now() / 1000 / WINDOW_S)}`;
  let n;
  if (env.RATE_KV) { n = +(await env.RATE_KV.get(key) || 0) + 1; await env.RATE_KV.put(key, String(n), { expirationTtl: WINDOW_S + 60 }); }
  else { n = (mem.get(key) || 0) + 1; mem.set(key, n); if (mem.size > 5000) mem.clear(); }
  return n > LIMIT[route];
}

const STAPLES = 'salt, pepper, cooking oil, water, sugar, flour, butter, common dried spices';
const RECIPE = { type: 'object', properties: {
  name: { type: 'string' }, emoji: { type: 'string' }, minutes: { type: 'integer' }, servings: { type: 'integer' }, level: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
  ingredients: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, qty: { type: 'string' }, have: { type: 'boolean' } }, required: ['item', 'qty', 'have'] } },
  missing: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, qty: { type: 'string' }, est_price: { type: 'number' } }, required: ['item', 'qty', 'est_price'] } },
  steps: { type: 'array', items: { type: 'string' } } }, required: ['name', 'emoji', 'minutes', 'servings', 'level', 'ingredients', 'missing', 'steps'] };
const SCHEMAS = {
  scan: { type: 'object', properties: { ingredients: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'string' }, category: { type: 'string', enum: ['Produce', 'Proteins', 'Dairy', 'Pantry', 'Spices & Seasonings'] }, low: { type: 'boolean' } }, required: ['name', 'qty', 'category', 'low'] } } }, required: ['ingredients'] },
  recipes: { type: 'object', properties: { recipes: { type: 'array', items: RECIPE } }, required: ['recipes'] },
  crave: { type: 'object', properties: { recipe: RECIPE, est_cook_cost: { type: 'number' } }, required: ['recipe', 'est_cook_cost'] }
};
const VOICE = 'You write for SnapCravings, a fun, upbeat cooking app. Plain, friendly words. No em-dashes. Recipe steps are complete, specific (times, temperatures, amounts) and safe (cook meat through).';

// Model chain: Google's 3.8 Flash is often overloaded (429/503 "high demand") and slow; fall back fast.
const CHAIN = [['gemini-3.8-flash', 22000, { thinkingBudget: 0 }], ['gemini-3.5-flash-lite', 18000, null], ['gemini-2.5-flash-lite', 15000, { thinkingBudget: 0 }]];
async function gemini(env, route, parts) {
  const chain = env.GEMINI_MODEL ? [[env.GEMINI_MODEL, 25000, null], ...CHAIN] : CHAIN;
  let last = 'The recipe brain hiccuped. Tap Retry!';
  for (const [model, ms, thinking] of chain) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), ms); const t0 = Date.now();
    try {
      const gc = { responseMimeType: 'application/json', responseSchema: SCHEMAS[route], temperature: 0.6, maxOutputTokens: 6000 };
      if (thinking) gc.thinkingConfig = thinking;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: VOICE }] }, contents: [{ role: 'user', parts }], generationConfig: gc }) });
      if (!r.ok) { console.log('gemini', model, r.status, (await r.text()).slice(0, 200)); if (r.status === 429) last = 'Our kitchen is busy. Tap Retry in a moment!'; continue; }
      const j = await r.json();
      const text = j.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '';
      let data; try { data = JSON.parse(text); } catch { console.log('bad json', model, j.candidates?.[0]?.finishReason); continue; }
      const u = j.usageMetadata || {};
      console.log('ok', route, model, Date.now() - t0, 'ms', u.promptTokenCount, u.candidatesTokenCount);
      return { data, usage: { model, ms: Date.now() - t0, in: u.promptTokenCount, out: u.candidatesTokenCount } };
    } catch (e) { console.log('timeout/err', model, Date.now() - t0, e.name); last = 'That took too long. Tap Retry!'; }
    finally { clearTimeout(timer); }
  }
  throw new Error(last);
}

const clean = (a, n = 60) => (Array.isArray(a) ? a : []).map(s => String(s).slice(0, 80)).filter(Boolean).slice(0, n);

export async function onRequest({ request, env, params }) {
  const route = (params.path || [])[0];
  if (route === 'health') return json({ ok: true, model: env.GEMINI_MODEL || MODEL, ai: !!env.GEMINI_API_KEY || env.MOCK_AI === '1' ? 'ready' : 'missing GEMINI_API_KEY' });
  if (request.method !== 'POST' || !SCHEMAS[route]) return json({ error: 'Not found' }, 404);
  const len = +request.headers.get('content-length') || 0;
  if (len > MAX_BODY) return json({ error: 'Those photos are too big. Try fewer photos.' }, 413);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (await limited(env, ip, route)) return json({ error: 'Whoa, hungry! You hit the hourly limit. Try again soon.' }, 429);
  let body; try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  if (!env.GEMINI_API_KEY && env.MOCK_AI !== '1') return json({ error: 'AI is not set up yet (missing GEMINI_API_KEY).' }, 503);

  let parts;
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
    parts.push({ text: `These ${imgs.length} photos are all from ONE kitchen; each is labeled with its area (fridge, freezer, pantry, spices). Analyze ALL photos together and return ONE combined, de-duplicated inventory: if the same item appears in several photos, list it once. List every distinct food item you can see, explicitly including spices, dried herbs, seasonings and blends, salt and pepper, sauces, oils, vinegars and condiments (read jar and bottle labels). For each give a short common name (e.g. "smoked paprika", "soy sauce", "olive oil"), a rough quantity (e.g. "6 eggs", "half a jar", "about 1 lb"), a category (Produce, Proteins, Dairy, Pantry, Spices & Seasonings; sauces, oils and condiments go in Pantry; spices, dried herbs, salt, pepper and seasoning blends go in Spices & Seasonings), and low=true if it looks nearly empty or running low. Ignore non-food items. If no food is visible, return an empty list.` });
  } else if (route === 'recipes') {
    const ing = clean(body.ingredients, 80); const craving = String(body.craving || 'Anything').slice(0, 60);
    const section = body.section === 'more' ? 'more' : 'ready';
    const avoid = clean(body.avoid, 40);
    if (!ing.length) return json({ error: 'Add some ingredients first!' }, 400);
    const ask = section === 'ready'
      ? 'Give exactly 3 recipes that use ONLY the ingredients on hand plus staples. missing must be an empty list and every ingredient have=true.'
      : 'Give exactly 3 recipes matching the craving that need 1 to 4 extra items. List those in missing with a rough US grocery price in USD (est_price) for the smallest common package, and mark them have=false in ingredients.';
    parts = [{ text: `Ingredients on hand (items marked [spice] are spices/seasonings the user owns; use them to flavor the recipes): ${ing.join('; ')}.\nAlways available staples: ${STAPLES}.\nCraving: ${craving}.\n${ask} Use a handful of the on-hand items per recipe, not all of them. Keep it concise: at most 10 ingredients and 6 short steps per recipe. Sort by fewest missing items, then shortest time.${avoid.length ? ' Do NOT repeat or closely copy these already-shown recipes: ' + avoid.join('; ') + '. Give new, different dishes.' : ''} One food emoji per recipe. 2 servings unless the dish needs more.` }];
  } else {
    const craving = String(body.craving || '').slice(0, 80).trim(); const ing = clean(body.ingredients);
    if (!craving) return json({ error: 'Name a craving first!' }, 400);
    parts = [{ text: `Craving: ${craving}.\nIngredients the user has: ${ing.length ? ing.join('; ') : 'unknown, assume only staples'}.\nStaples: ${STAPLES}.\nGive one home recipe for this craving (2 servings). Mark have=true for ingredients they have or staples. List everything else in missing with a rough US grocery price estimate in USD for the smallest common package. est_cook_cost = estimated cost of ALL ingredients used in the recipe (portion actually used), USD.` }];
  }

  if (env.MOCK_AI === '1') return json({ ...mock(route, body), mock: true });
  try { const { data, usage } = await gemini(env, route, parts); return json({ ...data, craving: body.craving, usage }); }
  catch (e) { return json({ error: e.message || 'Something went sideways. Try again!' }, 502); }
}

function mock(route, body) {
  const r = (name, miss) => ({ name, emoji: '🍳', minutes: 15, servings: 2, level: 'Easy', ingredients: [{ item: 'Eggs', qty: '2', have: true }, ...miss.map(m => ({ item: m, qty: '1', have: false }))], missing: miss.map(m => ({ item: m, qty: '1', est_price: 2.5 })), steps: ['Mock step one.', 'Mock step two.'] });
  if (route === 'scan') return { ingredients: [{ name: 'Eggs', qty: '6', category: 'Proteins', low: false }, { name: 'Milk', qty: 'a little', category: 'Dairy', low: true }, { name: 'Smoked paprika', qty: 'half a jar', category: 'Spices & Seasonings', low: false }] };
  if (route === 'recipes') return { recipes: body.section === 'more' ? [r('Mock omelette', ['Cheese'])] : [r('Mock fried eggs', [])] };
  return { recipe: r('Mock ' + body.craving, ['Noodles']), est_cook_cost: 6.5 };
}
