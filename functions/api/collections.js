// POST /api/collections {key?, prefs, lang}. No key: list this season's collections. With key: 6 recipes, generated once and cached
// server-side (Cloudflare Cache API, 7 days) per collection + language + diet; every recipe diet post-checked.
import { dietOf, dietPrompt, recipeHits } from '../_lib/diet.js';
import { RECIPES_SCHEMA, cleanRecipe, collectionsFor, sha } from '../_lib/extras.js';
import { gemini } from './plan.js';
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...h } });
export async function onRequestPost({ request, env, waitUntil }) {
  let b = {}; try { b = await request.json(); } catch {}
  const lang = String(b.lang || '').startsWith('es') ? 'es' : 'en'; const cols = collectionsFor();
  if (!b.key) return json({ collections: cols.map(c => ({ key: c.key, name: lang === 'es' ? c.es : c.name, emoji: c.emoji })) });
  const c = cols.find(x => x.key === b.key); if (!c) return json({ error: lang === 'es' ? 'Esa colección ya no está.' : 'That collection is gone.' }, 404);
  const diet = dietOf(b.prefs); const week = Math.floor(Date.now() / 6048e5);
  const ck = new Request(`https://cache.snapcravings/${c.key}/${lang}/${week}/${await sha(JSON.stringify([diet.tags.slice().sort(), diet.terms.slice().sort()]), 16)}`);
  const cache = caches.default; const hit = await cache.match(ck);
  if (hit) { const j = await hit.json(); return json({ ...j, cached: true }); }
  if (env.MOCK_AI === '1') return json({ name: c.name, recipes: [cleanRecipe({ name: 'Mock ' + c.key, emoji: c.emoji, steps: ['Mock.'] })] });
  const text = `Create a SnapCravings recipe collection: "${lang === 'es' ? c.es : c.name}" (${c.brief}). Give exactly 6 different, crowd-pleasing home recipes that fit it. Mix levels (Easy, Medium, one Chef mode). All ingredients have=true, missing is an empty list. ${dietPrompt(diet) ? dietPrompt(diet) + '\n' : ''}Fill kcal, protein_g, carbs_g, fat_g as per-serving estimates.${lang === 'es' ? ' LANGUAGE: write all text in natural Latin American Spanish with correct accents. Keep level enum values in English.' : ''}`;
  let keep = [], banned = new Set();
  try {
    for (let i = 0; i < 2 && keep.length < 4; i++) {
      const out = await gemini(env, RECIPES_SCHEMA, [{ text: text + (banned.size ? ` IMPORTANT: never use ${[...banned].join(', ')}.` : '') }], 12000);
      for (const r0 of out.recipes || []) { const r = cleanRecipe(r0); if (!r) continue; const h = recipeHits(diet, r); if (h.length) h.forEach(x => banned.add(x)); else if (!keep.some(k => k.name === r.name)) keep.push(r); }
    }
  } catch (e) { return json({ error: e.message }, 502); }
  if (!keep.length) return json({ error: lang === 'es' ? 'No pudimos armar esta colección para tu dieta.' : "We couldn't build this collection for your diet." }, 502);
  const body = { name: lang === 'es' ? c.es : c.name, emoji: c.emoji, recipes: keep.slice(0, 6) };
  const put = cache.put(ck, new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=604800' } }));
  if (waitUntil) waitUntil(put); else await put;
  return json(body);
}
