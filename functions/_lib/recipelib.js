// Shared recipe library: every AI recipe that passes validation is kept, and new /api/recipes requests are filled from it
// first so AI use drops as usage grows. Storage: Supabase (snap_ai_recipes, RPCs in supabase/migrations/20261102_snapcravings_recipe_library.sql);
// until that SQL is applied (RPC 404) a small KV fallback (env.RECIPE_KV || env.RATE_KV, one bucket per lang+section+craving) keeps it working.
// Nothing personal is stored: only the recipe itself, its OWN ingredient names, diet tags, hashed free-text prefs and a craving key.
import { cleanRecipe, recipeKey, sha } from './extras.js';
import { recipeHits } from './diet.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './sub.js';

// ---------- normalization ----------
export const PANTRY = new Set(['salt', 'pepper', 'black pepper', 'white pepper', 'sea salt', 'kosher salt', 'oil', 'olive oil', 'extra virgin olive oil', 'vegetable oil', 'cooking oil', 'canola oil', 'neutral oil', 'sunflower oil', 'cooking spray', 'water', 'ice', 'sugar', 'flour', 'butter', 'salt and pepper',
  'sal', 'pimienta', 'pimienta negra', 'aceite', 'aceite de oliva', 'aceite vegetal', 'agua', 'azucar', 'harina', 'mantequilla', 'sal y pimienta', 'hielo',
  'cumin', 'ground cumin', 'paprika', 'smoked paprika', 'oregano', 'dried oregano', 'chili powder', 'garlic powder', 'onion powder', 'cinnamon', 'ground cinnamon', 'thyme', 'dried thyme', 'dried basil', 'red pepper flake', 'chili flake', 'italian seasoning', 'bay leaf', 'nutmeg', 'turmeric', 'curry powder', 'cayenne', 'cayenne pepper', 'baking soda', 'baking powder', 'comino', 'oregano seco', 'canela', 'chile en polvo', 'ajo en polvo', 'cebolla en polvo', 'laurel', 'hoja de laurel']);
const DESCR = /\b(fresh|freshly|chopped|minced|diced|sliced|grated|shredded|large|small|medium|ripe|boneless|skinless|raw|cooked|leftover|frozen|dried|ground black|finely|roughly|thinly|optional|to taste|for garnish|organic|whole|plain|unsalted|salted|extra|virgin|cold|warm|hot water|picado|picada|fresco|fresca|grande|pequeno|pequena|rallado|rallada|en cubos|al gusto|opcional)\b/g;
export const SYN = { scallion: 'green onion', 'spring onion': 'green onion', cebollin: 'green onion', 'cebolla verde': 'green onion', cilantro: 'cilantro', coriander: 'cilantro', 'garbanzo bean': 'chickpea', garbanzo: 'chickpea',
  courgette: 'zucchini', aubergine: 'eggplant', capsicum: 'bell pepper', 'red pepper': 'bell pepper', 'green pepper': 'bell pepper', 'yellow pepper': 'bell pepper', 'bell pepper': 'bell pepper', prawn: 'shrimp', mince: 'ground beef', 'minced beef': 'ground beef', 'beef mince': 'ground beef',
  cheddar: 'cheddar cheese', parmesan: 'parmesan cheese', parmigiano: 'parmesan cheese', mozzarella: 'mozzarella cheese', feta: 'feta cheese', 'heavy whipping cream': 'heavy cream', 'whipping cream': 'heavy cream', 'double cream': 'heavy cream', yoghurt: 'yogurt', 'greek yoghurt': 'greek yogurt',
  'egg yolk': 'egg', 'egg white': 'egg', 'large egg': 'egg', 'garlic clove': 'garlic', clove: 'garlic', 'clove garlic': 'garlic', 'garlic cloves': 'garlic', 'yellow onion': 'onion', 'white onion': 'onion', 'red onion': 'onion', 'brown onion': 'onion', 'soy': 'soy sauce', 'soya sauce': 'soy sauce', 'tamari': 'soy sauce',
  'chicken breast': 'chicken', 'chicken thigh': 'chicken', 'chicken breast fillet': 'chicken', 'chicken tender': 'chicken', 'chicken leg': 'chicken', 'chicken drumstick': 'chicken', 'rotisserie chicken': 'chicken', spaghetti: 'pasta', penne: 'pasta', fusilli: 'pasta', macaroni: 'pasta', linguine: 'pasta', fettuccine: 'pasta', rigatoni: 'pasta', noodle: 'noodle',
  'jasmine rice': 'rice', 'basmati rice': 'rice', 'white rice': 'rice', 'brown rice': 'rice', 'long grain rice': 'rice', 'cooked rice': 'rice', 'russet potato': 'potato', 'yukon gold potato': 'potato', 'baby spinach': 'spinach', 'cherry tomato': 'tomato', 'roma tomato': 'tomato', 'grape tomato': 'tomato', 'lemon juice': 'lemon', 'lime juice': 'lime',
  huevo: 'egg', pollo: 'chicken', 'pechuga de pollo': 'chicken', arroz: 'rice', cebolla: 'onion', ajo: 'garlic', tomate: 'tomato', jitomate: 'tomato', papa: 'potato', patata: 'potato', queso: 'cheese', leche: 'milk', frijol: 'bean', limon: 'lime', zanahoria: 'carrot', 'carne molida': 'ground beef', res: 'beef', cerdo: 'pork', tortilla: 'tortilla', pasta: 'pasta', espinaca: 'spinach', aguacate: 'avocado', camaron: 'shrimp', atun: 'tuna', chile: 'chili', pimiento: 'bell pepper' };
const CUT = new Set(['breast', 'thigh', 'fillet', 'filet', 'leg', 'wing', 'drumstick', 'tender', 'loin', 'chop', 'steak', 'clove', 'juice', 'zest', 'leaf', 'stalk', 'floret', 'can', 'cube', 'slice', 'strip']);
const deacc = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const singular = w => w.length <= 3 || /(ss|us|is)$/.test(w) ? w : /ies$/.test(w) ? w.slice(0, -3) + 'y' : /(oes|ches|shes|xes|zes|ses)$/.test(w) ? w.slice(0, -2) : /es$/.test(w) && /[aeiou]es$/.test(w) === false && /[lnrd]es$/.test(w) ? w.slice(0, -2) : /s$/.test(w) ? w.slice(0, -1) : w;
export function normIngredient(s) {
  let x = deacc(String(s ?? '')).toLowerCase().replace(/^\s*\[spice\]\s*/, '').replace(/\([^)]*\)/g, ' ').replace(/,.*$/, '').replace(/^[\d\s./½¼¾-]+(g|kg|ml|l|oz|lb|lbs|cups?|tbsp|tsp|tablespoons?|teaspoons?|pieces?|cans?|x)?\b/, ' ')
    .replace(DESCR, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!x) return '';
  x = x.split(' ').map(singular).join(' ');
  if (SYN[x]) return SYN[x];
  const last = x.split(' ').slice(-2).join(' '); if (SYN[last] && x.split(' ').length > 2) return SYN[last];
  return x;
}
export const isStaple = n => !n || PANTRY.has(n) || /\b(salt|water|oil|pepper flake|cooking spray)$/.test(n) && !/\b(sesame oil|chili oil|truffle oil)\b/.test(n) && n.split(' ').length <= 3;
// Does the user's set of normalized items cover one recipe item?
export function covers(userSet, item) {
  if (!item || userSet.has(item)) return true;
  const it = item.split(' ');
  for (const u of userSet) {
    const ut = u.split(' ');
    if (ut.every(w => it.includes(w)) && (ut.includes(it.at(-1)) || CUT.has(it.at(-1)))) return true; // "chicken" covers "chicken breast", not "rice" -> "rice vinegar"
    if (it.every(w => ut.includes(w)) && it.includes(ut.at(-1))) return true; // "cheddar cheese" covers "cheese"
  }
  return false;
}
// Required = the recipe's own on-hand ingredients (have=true) minus pantry staples. Extras (missing) are what a "more" recipe asks to buy.
export const requiredOf = r => [...new Set((r.ingredients || []).filter(i => i && i.have !== false).map(i => normIngredient(i.item)).filter(n => n && !isStaple(n)))];
export const CRAVINGS = ['anything', 'noodles', 'something quick', 'comfort food', 'spicy'];
export async function cravingKey(c) { const n = deacc(String(c || 'Anything')).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() || 'anything'; return CRAVINGS.includes(n) ? n : 'h:' + await sha('craving:' + n, 16); }
export async function prefKey(d) { const t = [d?.other, d?.mood].map(x => deacc(String(x || '')).toLowerCase().trim()).join('|'); return t === '|' ? '' : await sha('prefs:' + t, 16); }

// ---------- matching ----------
export const RULES = { ready: { cover: 1, miss: 0 }, more: { cover: 0.8, miss: 2 } };
// One candidate against the user's items. Returns null (no match) or {coverage, uncovered}.
export function matchOne(userSet, req, section) {
  const R = RULES[section] || RULES.ready; if (!req.length) return null;
  const uncovered = req.filter(n => !covers(userSet, n)); const coverage = (req.length - uncovered.length) / req.length;
  return coverage >= R.cover && uncovered.length <= R.miss ? { coverage, uncovered } : null;
}
const dietOk = (entry, diet) => { const tags = entry.tags || []; return (diet.tags || []).every(t => tags.includes(t)) && !(diet.hard && recipeHits(diet, entry.r).length); };
// Rank by coverage, rating, recency + jitter (rotation), prefer a level mix, return up to `want` recipes rewritten for this user.
export function pick(cands, { ing, section, diet, pkey = '', want = 5, now = Date.now(), rand = Math.random, exclude = [] }) {
  const userSet = new Set(ing.map(normIngredient).filter(Boolean)); const ex = new Set(exclude.map(x => String(x).toLowerCase().trim()));
  const seen = new Set(); const scored = [];
  for (const e of cands) {
    if (!e?.r?.name || (e.pk || '') !== pkey || !dietOk(e, diet)) continue;
    const nm = e.r.name.toLowerCase().trim(); if (seen.has(nm) || ex.has(nm)) continue;
    const m = matchOne(userSet, e.req || requiredOf(e.r), section); if (!m) continue; seen.add(nm);
    const up = +e.up || 0, down = +e.down || 0, rating = (up + 1) / (up + down + 2), age = Math.max(0, (now - (+new Date(e.created) || now)) / 864e5);
    if (down >= 3 && down > up * 2) continue; // community thumbs-down
    scored.push({ e, m, s: m.coverage * 0.55 + rating * 0.25 + Math.exp(-age / 30) * 0.1 + rand() * 0.3 });
  }
  scored.sort((a, b) => b.s - a.s);
  const out = [], lv = new Set();
  for (const pass of [0, 1]) for (const x of scored) { if (out.length >= want) break; if (out.includes(x)) continue; if (pass === 0 && lv.has(x.e.r.level)) continue; lv.add(x.e.r.level); out.push(x); }
  return out.map(({ e, m }) => ({ id: e.id, recipe: personalize(e.r, userSet, m.uncovered) }));
}
// Same JSON shape as an AI recipe: have=true when the user has it (or a staple); uncovered required items move to missing.
function personalize(r, userSet, uncovered) {
  const unc = new Set(uncovered); const miss = [...(r.missing || [])];
  const ingredients = (r.ingredients || []).map(i => { const n = normIngredient(i.item); const have = isStaple(n) || (i.have !== false && !unc.has(n)) || (i.have === false && covers(userSet, n)); return { ...i, have }; });
  for (const i of ingredients) if (!i.have && !miss.some(m => normIngredient(m.item) === normIngredient(i.item))) miss.push({ item: i.item, qty: i.qty || '', est_price: 3 });
  return { ...r, ingredients, missing: miss.filter(m => !covers(userSet, normIngredient(m.item))) };
}

// ---------- quality guard ----------
const PII = /(https?:\/\/|www\.|[\w.+-]+@[\w-]+\.[a-z]{2,}|@[a-z0-9_]{3,}|\+?\d[\d\s().-]{7,}\d|\b(my name is|call me|address|street|avenue|apt\.?|phone|email)\b)/i;
export function validRecipe(raw, { section, diet, lang } = {}) {
  const r = cleanRecipe(raw); if (!r) return null;
  if (r.name.length < 3 || r.ingredients.length < 2 || r.steps.length < 2 || r.steps.some(s => s.length < 8)) return null;
  if (!r.kcal || r.kcal < 50 || !r.minutes || r.minutes > 600 || !raw.level || r.level !== raw.level) return null;
  const text = [r.name, ...r.ingredients.map(i => i.item + ' ' + i.qty), ...r.missing.map(i => i.item), ...r.steps].join(' \n ');
  if (PII.test(text.replace(/\b\d{1,3}\s?(°|degrees|grados|f|c)\b/gi, ''))) return null;
  if (section === 'ready' && (r.missing.length || r.ingredients.some(i => !i.have))) return null;
  if (diet?.hard && recipeHits(diet, r).length) return null;
  if (lang === 'en' && /\b(cucharada|cucharadita|taza|minutos|agrega|añade|sartén)\b/i.test(text)) return null;
  if (!requiredOf(r).length) return null;
  return r;
}

// ---------- storage ----------
const kvOf = env => env.RECIPE_KV || env.RATE_KV || null;
const bucket = (lang, section, ck) => `lib1:${lang}:${section}:${ck}`;
const BUCKET_MAX = 150;
let sbDown = 0; // per-isolate: Supabase RPCs missing (migration not applied) -> KV fallback for 10 min
async function rpc(env, fn, body, ms = 1500) {
  if (env.__libStore) return env.__libStore.rpc(fn, body);
  if (Date.now() < sbDown) return { missing: true };
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { const r = await (env.__fetch || fetch)(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', signal: ac.signal, headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 404) { sbDown = Date.now() + 600000; return { missing: true }; }
    if (!r.ok) return { error: r.status }; return { data: await r.json() };
  } catch (e) { return { error: e.name }; } finally { clearTimeout(t); }
}
const libKey = async env => env.__libKey || (await import('./stats_key.js').then(m => m.STATS_KEY ? sha('snap-lib:' + m.STATS_KEY, 64) : '').catch(() => ''));
// Candidates for one lang + section + craving that share at least one required item with the user.
export async function libFind(env, { lang, section, craving, ing }) {
  const ck = await cravingKey(craving); const norm = [...new Set(ing.map(normIngredient).filter(Boolean))];
  const s = await rpc(env, 'snap_lib_find', { p_lang: lang, p_section: section, p_craving: ck, p_ings: norm, p_limit: 300 });
  if (Array.isArray(s.data)) return { store: 'supabase', cands: s.data.map(x => ({ id: x.id, r: x.recipe, req: x.ings, tags: x.diet_tags, pk: x.pref_key || '', created: x.created, up: x.up, down: x.down })) };
  if (!s.missing) return { store: 'supabase', cands: [], error: s.error };
  const kv = kvOf(env); if (!kv) return { store: 'none', cands: [] };
  try { return { store: 'kv', cands: (await kv.get(bucket(lang, section, ck), 'json')) || [] }; } catch { return { store: 'kv', cands: [] }; }
}
// Save validated AI recipes (ids = same hash the ratings use, so thumbs flow into ranking).
export async function libSave(env, recipes, { lang, section, craving, diet }) {
  const ck = await cravingKey(craving), pk = await prefKey(diet), tags = [...(diet?.tags || [])].sort();
  const rows = [];
  for (const raw of recipes) { const r = validRecipe(raw, { section, diet, lang }); if (!r) continue; rows.push({ id: await sha(recipeKey(r)), r, req: requiredOf(r), ext: r.missing.map(m => normIngredient(m.item)).filter(Boolean), tags, pk, level: r.level }); }
  if (!rows.length) return { saved: 0 };
  const s = await rpc(env, 'snap_lib_save', { p_key: await libKey(env), p_rows: rows.map(x => ({ id: x.id, lang, section, craving: ck, diet_tags: x.tags, pref_key: x.pk, level: x.level, recipe: x.r, ings: x.req, extras: x.ext })) }, 4000);
  if (!s.missing) return { saved: s.data ?? 0, store: 'supabase' };
  const kv = kvOf(env); if (!kv) return { saved: 0 };
  try { const k = bucket(lang, section, ck); const cur = (await kv.get(k, 'json')) || []; const ids = new Set(cur.map(e => e.id)); const now = new Date().toISOString();
    const add = rows.filter(x => !ids.has(x.id)).map(x => ({ id: x.id, r: x.r, req: x.req, tags: x.tags, pk: x.pk, created: now, up: 0, down: 0 }));
    if (add.length) await kv.put(k, JSON.stringify([...add, ...cur].slice(0, BUCKET_MAX)));
    return { saved: add.length, store: 'kv' }; } catch { return { saved: 0 }; }
}
// Metrics: recipes served from the library vs AI (Supabase daily table; KV daily counter as fallback, approximate).
const day = () => new Date().toISOString().slice(0, 10);
export async function libCount(env, { lib = 0, ai = 0, ids = [] }) {
  if (!lib && !ai) return;
  const s = await rpc(env, 'snap_lib_served', { p_key: await libKey(env), p_ids: ids.slice(0, 10), p_lib: lib, p_ai: ai }, 3000);
  if (!s.missing) return;
  const kv = kvOf(env); if (!kv) return;
  try { const k = 'libm:' + day(); const c = (await kv.get(k, 'json')) || { lib: 0, ai: 0, req: 0, full: 0 }; c.lib += lib; c.ai += ai; c.req++; if (!ai) c.full++; await kv.put(k, JSON.stringify(c), { expirationTtl: 86400 * 40 }); } catch {}
}
export async function libStats(env) {
  const s = await rpc(env, 'snap_lib_stats', {}, 2000);
  if (s.data && !s.missing) return { store: 'supabase', ...s.data };
  const kv = kvOf(env); if (!kv) return { store: 'none' };
  const d = new Date(); const days = []; for (let i = 0; i < 7; i++) days.push(new Date(d - i * 864e5).toISOString().slice(0, 10));
  const rows = await Promise.all(days.map(x => kv.get('libm:' + x, 'json').catch(() => null)));
  const t = rows.reduce((a, c) => c ? { lib: a.lib + c.lib, ai: a.ai + c.ai, req: a.req + c.req, full: a.full + c.full } : a, { lib: 0, ai: 0, req: 0, full: 0 });
  return { store: 'kv', last7: { ...t, share_library: t.lib + t.ai ? Math.round(1000 * t.lib / (t.lib + t.ai)) / 1000 : 0 }, today: rows[0] || { lib: 0, ai: 0, req: 0, full: 0 } };
}
