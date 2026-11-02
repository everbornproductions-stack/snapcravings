// POST /api/library {action:'rate', recipe, vote(1|-1|0)} | {action:'list', q, quick, level, maxKcal, minProtein, prefs, lang}
// Ratings and the community Library live in Supabase (snap_rate / snap_library RPCs, publishable key). Diet rules filter every list.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../_lib/sub.js';
import { dietOf, recipeHits } from '../_lib/diet.js';
import { cleanRecipe, recipeKey, sha, filterLibrary } from '../_lib/extras.js';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
async function rpc(fn, body) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000);
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', signal: ac.signal, headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { console.log(fn, r.status, (await r.text()).slice(0, 200)); return null; } return await r.json(); } catch (e) { console.log(fn, e.name); return null; } finally { clearTimeout(t); }
}
const ES = { "Ratings are taking a break. Try again soon!": '¡Las calificaciones están en pausa! Intenta pronto.', 'Bad request': 'Solicitud inválida' };
export async function onRequestPost({ request }) {
  const es = String(request.headers.get('x-sc-lang') || '').startsWith('es'); const E = (m, s) => json({ error: es ? ES[m] || m : m }, s);
  let b; try { b = await request.json(); } catch { return E('Bad request', 400); }
  const lang = String(b.lang || '').startsWith('es') ? 'es' : 'en';
  if (b.action === 'rate') {
    const r = cleanRecipe(b.recipe); const v = [1, -1, 0].includes(+b.vote) ? +b.vote : null; if (!r || v === null) return E('Bad request', 400);
    const dev = String(request.headers.get('x-sc-dev') || '').replace(/[^\w-]/g, '').slice(0, 64) || 'ip-' + (request.headers.get('cf-connecting-ip') || '');
    const out = await rpc('snap_rate', { p_hash: await sha(recipeKey(r)), p_device: await sha('snapcravings-vote:' + dev), p_vote: v, p_recipe: r, p_lang: lang });
    if (!out || out.error) return E('Ratings are taking a break. Try again soon!', 502);
    return json(out);
  }
  if (b.action === 'list') {
    const raw = await rpc('snap_library', { p_lang: lang, p_q: '', p_limit: 300 }); if (!Array.isArray(raw)) return E('Ratings are taking a break. Try again soon!', 502);
    const diet = dietOf(b.prefs); const seen = new Set(); const list = filterLibrary(raw, diet, b).filter(x => { const k = String(x.recipe.name).toLowerCase().trim(); if (seen.has(k)) return false; seen.add(k); return true; });
    return json({ total: raw.length, hidden: raw.length - filterLibrary(raw, diet, {}).length, recipes: list.slice(0, 60).map(x => ({ ...x.recipe, up: x.up, down: x.down })) });
  }
  return E('Bad request', 400);
}
