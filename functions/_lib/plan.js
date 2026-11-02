// Weekly meal-prep planner: pure helpers (prompt, schema, diet post-check, combined grocery list). Used by functions/api/plan.js and tests.
import { dietOf, dietPrompt, bad, hits, recipeHits, staplesFor as dietStaples } from './diet.js';
export const AISLES = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery & Grains', 'Pantry', 'Canned & Jarred', 'Frozen', 'Spices', 'Other'];
export const SLOTS = { dinner: ['Dinner'], lunch_dinner: ['Lunch', 'Dinner'], all: ['Breakfast', 'Lunch', 'Dinner'] };
export const FREE_PREVIEW_DAYS = 2;
const STAPLES = 'salt, pepper, cooking oil, water, sugar, flour, butter, common dried spices';
const MEAL = { type: 'object', properties: {
  day: { type: 'integer' }, slot: { type: 'string', enum: ['Breakfast', 'Lunch', 'Dinner'] },
  name: { type: 'string' }, emoji: { type: 'string' }, minutes: { type: 'integer' }, servings: { type: 'integer' },
  ingredients: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, qty: { type: 'string' }, aisle: { type: 'string', enum: AISLES }, have: { type: 'boolean' } }, required: ['item', 'qty', 'aisle', 'have'] } },
  steps: { type: 'array', items: { type: 'string' } }, est_cook_cost: { type: 'number' }, keeps_days: { type: 'integer' }, kcal: { type: 'integer' }, protein_g: { type: 'integer' }, carbs_g: { type: 'integer' }, fat_g: { type: 'integer' } },
  required: ['day', 'slot', 'name', 'emoji', 'minutes', 'servings', 'ingredients', 'steps', 'est_cook_cost', 'keeps_days', 'kcal', 'protein_g', 'carbs_g', 'fat_g'] };
export const PLAN_SCHEMA = { type: 'object', properties: {
  meals: { type: 'array', items: MEAL },
  prep: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' }, minutes: { type: 'integer' } }, required: ['title', 'detail', 'minutes'] } },
  storage: { type: 'array', items: { type: 'string' } } }, required: ['meals', 'prep', 'storage'] };
export const MEALS_SCHEMA = { type: 'object', properties: { meals: { type: 'array', items: MEAL } }, required: ['meals'] };

const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
// Normalize the request. Free users get only the first FREE_PREVIEW_DAYS days generated (preview); pro/owner get all.
export function planInput(b, { pro = false } = {}) {
  b = b && typeof b === 'object' ? b : {};
  const days = Number(b.days) === 5 ? 5 : 7;
  const meals = SLOTS[b.meals] ? b.meals : 'dinner';
  const servings = clampInt(b.servings, 1, 8, 2);
  const budget = Number(b.budget) > 0 ? Math.min(1000, Math.round(Number(b.budget))) : 0;
  const diet = dietOf(b.prefs);
  const fridge = (Array.isArray(b.fridge) ? b.fridge : []).map(s => String(s).slice(0, 60).trim()).filter(Boolean).slice(0, 60).filter(x => !bad(diet, x));
  const GOALS = ['high_protein', 'cut', 'bulk', 'maintain', 'low_carb'];
  const f = b.fit && typeof b.fit === 'object' ? b.fit : {};
  const fit = GOALS.includes(f.goal) || Number(f.kcal) > 0 ? { goal: GOALS.includes(f.goal) ? f.goal : 'maintain', kcal: clampInt(f.kcal, 0, 6000, 0), p: clampInt(f.p, 0, 500, 0), c: clampInt(f.c, 0, 900, 0), f: clampInt(f.f, 0, 400, 0) } : null;
  return { fit, days, genDays: pro ? days : Math.min(days, FREE_PREVIEW_DAYS), preview: !pro, meals, slots: SLOTS[meals], servings, budget, diet, fridge };
}
const LANG = { es: '\nLANGUAGE: Write every user-facing text value with correct Spanish accents and ñ (meal names, ingredient items and quantities, steps, prep titles and details, storage tips) in natural, friendly Latin American Spanish (Mexico-neutral, metric or taza/cucharada units). Keep JSON keys and the enum values for slot and aisle exactly in English. Prices stay in USD. The diet and allergy rules apply exactly the same in Spanish.', en: '' };
const GOAL_TXT = { high_protein: 'high protein (lean proteins, beans, Greek yogurt or other options that fit the rules, in every meal)', cut: 'cutting / losing weight (calorie deficit, high protein, lots of vegetables, filling and low in added fat and sugar)', bulk: 'bulking / gaining muscle (calorie surplus, high protein, generous carbs)', maintain: 'maintaining weight (balanced meals)', low_carb: 'low carb (mostly protein, vegetables and healthy fats; few grains, sugar or starchy sides)' };
// Fitness goals are optional; the default is easy, budget-friendly food for regular people.
export function fitNote(p) {
  if (!p.fit) return 'Default audience: regular people. Keep meals easy, familiar and budget-friendly. Still fill kcal, protein_g, carbs_g and fat_g per serving as honest estimates.\n';
  const f = p.fit, per = p.slots.length; const t = [f.kcal && `${f.kcal} kcal`, f.p && `${f.p} g protein`, f.c && `${f.c} g carbs`, f.f && `${f.f} g fat`].filter(Boolean).join(', ');
  return `FITNESS GOAL: ${GOAL_TXT[f.goal]}.${t ? ` Daily targets for ONE person: ${t}. The ${per} meal(s) of each day (one serving each) are ${per < 3 ? 'the main meals; aim for about ' + Math.round(per === 1 ? 40 : 75) + '% of the daily targets from them (snacks cover the rest)' : 'the whole day; aim to hit the daily targets'} within about 10%. That means each day's meals should add up to about ${Math.round(f.kcal * (per === 1 ? 0.4 : per === 2 ? 0.75 : 1))} kcal${f.p ? ' and ' + Math.round(f.p * (per === 1 ? 0.4 : per === 2 ? 0.75 : 1)) + ' g protein' : ''} (roughly ${Math.round(f.kcal * (per === 1 ? 0.4 : per === 2 ? 0.75 : 1) / per)} kcal per meal); size portions to hit it, do not undershoot.` : ''} kcal, protein_g, carbs_g and fat_g are PER SERVING estimates; make them realistic for the listed quantities.\n`;
}
export function planPrompt(p, lang = 'en') {
  const per = p.slots.join(' + ');
  return `Make a ${p.genDays}-day meal-prep plan (days 1 to ${p.genDays}), ${p.slots.length} meal(s) per day: ${per}. Each meal makes ${p.servings} serving(s).
Ingredients already in the user's fridge/pantry (use them early in the week, mark have=true): ${p.fridge.length ? p.fridge.join('; ') : 'none known'}.
Always available staples (have=true): ${dietStaples(p.diet, STAPLES)}.
${p.budget ? `Grocery budget for the whole plan: about $${p.budget} USD. Keep the total of est_cook_cost under it with cheap, batch-friendly ingredients.\n` : ''}${dietPrompt(p.diet) ? dietPrompt(p.diet) + '\n' : ''}${fitNote(p)}This is for MEAL PREP: reuse ingredients across meals so the grocery list stays short (one protein cooked in bulk used 2 to 3 ways, one or two grains, shared vegetables), favor dishes that store and reheat well, and put the most perishable meals (fish, delicate greens) early in the week. But keep the week interesting: use 2 or 3 different proteins (no single protein in more than 3 meals), at least 4 different cuisines or flavor styles (for example Mexican, Asian, Mediterranean, American comfort), different formats (bowls, tacos or wraps, soups or stews, sheet-pan dinners, salads, pasta or noodles that fit the rules), and fresh produce beyond what the user already has. No meal name twice. The fridge items are a head start, not the whole menu. For each meal: day, slot, name, one food emoji, minutes (active cooking on the day, after prep), servings, ingredients with qty for this meal and the grocery aisle (${AISLES.join(', ')}), have=true only for fridge items or staples, 3 to 5 short steps that assume the prep day was done, est_cook_cost = estimated USD cost of the ingredients this meal actually uses (all servings), keeps_days = how many days it keeps in the fridge after cooking.
prep: 5 to 9 batch steps for ONE prep day, in order (cook grains, roast or cook proteins, chop vegetables, marinate, make sauces, cool and portion into containers), each with a short title, a specific detail (amounts, times, temperatures) and minutes.
storage: 3 to 6 short tips on how long each prepped item keeps in the fridge or freezer and what to freeze for the later days.${LANG[lang] || ''}`;
}
export const swapPrompt = (p, day, slot, avoid, lang = 'en') => `Give ONE replacement meal for a meal-prep plan: day ${day}, slot ${slot}, ${p.servings} serving(s). Ingredients the user has: ${p.fridge.length ? p.fridge.join('; ') : 'none known'}. Staples: ${dietStaples(p.diet, STAPLES)}.
${dietPrompt(p.diet) ? dietPrompt(p.diet) + '\n' : ''}${fitNote(p)}It must be different from these meals already in the plan: ${avoid.slice(0, 30).join('; ') || 'none'}. Make it prep-friendly (keeps and reheats well). Same fields as before (kcal, protein_g, carbs_g, fat_g per serving estimates too): day, slot, name, emoji, minutes, servings, ingredients (item, qty, aisle from ${AISLES.join(', ')}, have), 3 to 5 steps, est_cook_cost (USD estimate of ingredients used), keeps_days. Return {"meals":[that one meal]}.${LANG[lang] || ''}`;

// Diet check for a planner meal (reuses the recipe check: name, every ingredient, steps).
export const mealHits = (d, m) => recipeHits(d, { name: m?.name, ingredients: m?.ingredients || [], missing: [], steps: m?.steps || [] });
// Models sometimes send the code point as text ("1f95f" or "U+1F35D"): turn it into the emoji, else a bento box.
export function emojiOf(e) { const s = String(e || '').trim(); const h = /^(?:u\+)?([0-9a-f]{4,6})$/i.exec(s); if (h) { try { return String.fromCodePoint(parseInt(h[1], 16)); } catch {} } return s && !/[A-Za-z0-9]/.test(s) ? s.slice(0, 8) : '🍱'; }
export function cleanMeal(m, p) {
  const day = clampInt(m?.day, 1, p.genDays, 1); const slot = p.slots.includes(m?.slot) ? m.slot : p.slots[p.slots.length - 1];
  return { day, slot, name: String(m?.name || '').slice(0, 90), emoji: emojiOf(m?.emoji), minutes: clampInt(m?.minutes, 1, 240, 20), servings: clampInt(m?.servings, 1, 12, p.servings),
    ingredients: (m?.ingredients || []).slice(0, 20).map(i => ({ item: String(i?.item || '').slice(0, 80), qty: String(i?.qty || '').slice(0, 40), aisle: AISLES.includes(i?.aisle) ? i.aisle : 'Other', have: !!i?.have })).filter(i => i.item),
    steps: (m?.steps || []).slice(0, 8).map(s => String(s).slice(0, 300)), est_cook_cost: Math.max(0, Math.round(Number(m?.est_cook_cost || 0) * 100) / 100), keeps_days: clampInt(m?.keeps_days, 0, 30, 3), kcal: clampInt(m?.kcal, 0, 3000, 0), protein_g: clampInt(m?.protein_g, 0, 300, 0), carbs_g: clampInt(m?.carbs_g, 0, 400, 0), fat_g: clampInt(m?.fat_g, 0, 300, 0) };
}
// Split meals into good / offending (with the terms that broke the rules). Also flags missing (day, slot) cells.
export function checkPlan(p, meals) {
  const good = [], badOnes = [], seen = new Set();
  for (const raw of meals || []) {
    const m = cleanMeal(raw, p); const key = m.day + '|' + m.slot;
    if (!m.name || seen.has(key)) continue;
    const h = p.diet.hard ? mealHits(p.diet, m) : [];
    if (h.length) badOnes.push({ ...m, why: h }); else { good.push(m); seen.add(key); }
  }
  const missing = [];
  for (let d = 1; d <= p.genDays; d++) for (const s of p.slots) if (!seen.has(d + '|' + s)) missing.push({ day: d, slot: s });
  return { good, bad: badOnes, missing };
}
const STAPLE_RE = /^(salt|pepper|black pepper|salt and pepper|water|ice|cooking oil|oil|vegetable oil|sal|pimienta|agua|aceite)$/i;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const sing = w => w.replace(/(ies)$/, 'y').replace(/(oes|ses|xes|ches|shes)$/, m => m.slice(0, -2)).replace(/([^s])s$/, '$1');
const key = s => norm(s).split(' ').map(sing).join(' ');
// Is this grocery item already in the fridge? (whole-word containment either way: "chicken breast" vs "chicken")
export function inFridge(item, fridge) {
  const k = key(item); if (!k) return false;
  return fridge.some(f => { const fk = key(f); if (!fk) return false; const re = x => new RegExp('(^| )' + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)'); return re(fk).test(k) || re(k).test(fk); });
}
// ONE combined grocery list across all meals: merged by item, grouped by aisle, minus fridge items, staples and have=true.
export function groceryList(meals, fridge = [], diet = null) {
  const map = new Map();
  for (const m of meals) for (const i of m.ingredients || []) {
    if (i.have || STAPLE_RE.test(norm(i.item)) || inFridge(i.item, fridge)) continue;
    if (diet && diet.hard && hits(diet, i.item).length) continue; // belt and braces; meals were already checked
    const k = key(i.item); const e = map.get(k) || { item: i.item.trim(), aisle: i.aisle || 'Other', qty: [], meals: [] };
    if (i.qty && !e.qty.includes(i.qty)) e.qty.push(i.qty); if (!e.meals.includes(m.name)) e.meals.push(m.name); map.set(k, e);
  }
  const groups = AISLES.map(a => ({ aisle: a, items: [...map.values()].filter(x => x.aisle === a).map(x => ({ item: x.item, qty: x.qty.join(' + '), meals: x.meals.length })).sort((x, y) => x.item.localeCompare(y.item)) })).filter(g => g.items.length);
  return groups;
}
export const planCost = meals => Math.round(meals.reduce((s, m) => s + (m.est_cook_cost || 0), 0) * 100) / 100;
// Prep-guide and storage text must follow the rules too (a storage tip once mentioned shrimp for a shellfish allergy).
export const cleanTexts = (d, list, f = x => x) => (list || []).filter(x => !d.hard || !recipeHits(d, { name: '', ingredients: [], missing: [], steps: [f(x)] }).length);
// Day targets (one serving of each meal) and which days miss them by more than 10%.
export const dayGoal = p => p.fit && p.fit.kcal ? Math.round(p.fit.kcal * (p.slots.length === 1 ? 0.4 : p.slots.length === 2 ? 0.75 : 1)) : 0;
export function offDays(p, meals) { const g = dayGoal(p); if (!g) return []; const t = {}; meals.forEach(m => t[m.day] = (t[m.day] || 0) + (m.kcal || 0)); return Object.entries(t).filter(([, k]) => Math.abs(k - g) > g * 0.1).map(([d, k]) => ({ day: +d, kcal: k, goal: g })); }
