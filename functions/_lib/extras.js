// Shared helpers for Library, collections and family recipes.
import { recipeHits } from './diet.js';
export const RECIPE = { type: 'object', properties: {
  name: { type: 'string' }, emoji: { type: 'string' }, minutes: { type: 'integer' }, servings: { type: 'integer' }, level: { type: 'string', enum: ['Easy', 'Medium', 'Chef mode'] },
  ingredients: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, qty: { type: 'string' }, have: { type: 'boolean' }, en: { type: 'string' } }, required: ['item', 'qty', 'have'] } },
  missing: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, qty: { type: 'string' }, est_price: { type: 'number' }, en: { type: 'string' } }, required: ['item', 'qty', 'est_price'] } },
  steps: { type: 'array', items: { type: 'string' } }, kcal: { type: 'integer' }, protein_g: { type: 'integer' }, carbs_g: { type: 'integer' }, fat_g: { type: 'integer' } },
  required: ['name', 'emoji', 'minutes', 'servings', 'level', 'ingredients', 'missing', 'steps', 'kcal', 'protein_g', 'carbs_g', 'fat_g'] };
export const RECIPES_SCHEMA = { type: 'object', properties: { recipes: { type: 'array', items: RECIPE } }, required: ['recipes'] };
export const ADAPT_SCHEMA = { type: 'object', properties: { recipe: RECIPE, changes: { type: 'array', items: { type: 'string' } } }, required: ['recipe', 'changes'] };
const n = (v, lo, hi, d) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const s = (v, k) => String(v ?? '').slice(0, k);
// Keep only known fields with sane sizes (stored in Supabase and shown to other users).
export function cleanRecipe(r) {
  if (!r || typeof r !== 'object' || !s(r.name, 120).trim()) return null;
  return { name: s(r.name, 120).trim(), emoji: /[A-Za-z0-9]/.test(s(r.emoji, 8)) || !r.emoji ? '🍳' : s(r.emoji, 8), minutes: n(r.minutes, 1, 600, 20), servings: n(r.servings, 1, 20, 2), level: ['Easy', 'Medium', 'Chef mode'].includes(r.level) ? r.level : 'Easy',
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).slice(0, 30).map(i => ({ item: s(i?.item, 80), qty: s(i?.qty, 40), have: !!i?.have, ...(i?.en ? { en: s(i.en, 80) } : {}) })).filter(i => i.item),
    missing: (Array.isArray(r.missing) ? r.missing : []).slice(0, 15).map(i => ({ item: s(i?.item, 80), qty: s(i?.qty, 40), est_price: Math.max(0, Math.min(200, Number(i?.est_price) || 0)), ...(i?.en ? { en: s(i.en, 80) } : {}) })).filter(i => i.item),
    steps: (Array.isArray(r.steps) ? r.steps : []).slice(0, 16).map(x => s(x, 400)).filter(Boolean),
    kcal: n(r.kcal, 0, 3000, 0), protein_g: n(r.protein_g, 0, 300, 0), carbs_g: n(r.carbs_g, 0, 400, 0), fat_g: n(r.fat_g, 0, 300, 0) };
}
export const recipeKey = r => [r.name, ...(r.ingredients || []).map(i => i.item)].join('|').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9|]+/g, ' ').trim();
export async function sha(x, len = 32) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, len); }
// Library filter: diet hard rules first, then optional search text and style filters.
export function filterLibrary(list, diet, { q = '', quick = false, level = '', maxKcal = 0, minProtein = 0 } = {}) {
  const qq = String(q || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return list.filter(x => x && x.recipe && !(diet.hard && recipeHits(diet, x.recipe).length))
    .filter(x => !qq || (x.recipe.name + ' ' + (x.recipe.ingredients || []).map(i => i.item).join(' ')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qq))
    .filter(x => !quick || (x.recipe.minutes || 99) <= 15).filter(x => !level || x.recipe.level === level)
    .filter(x => !maxKcal || (x.recipe.kcal && x.recipe.kcal <= maxKcal)).filter(x => !minProtein || (x.recipe.protein_g || 0) >= minProtein);
}
// Seasonal / trending collections by date (month is 1-12).
export function collectionsFor(date = new Date()) {
  const m = date.getUTCMonth() + 1; const out = [];
  if (m === 11) out.push({ key: 'thanksgiving', name: 'Thanksgiving & Friendsgiving', es: 'Acción de Gracias y Friendsgiving', emoji: '🦃', brief: 'Thanksgiving and Friendsgiving: sides, a main, leftovers ideas, one dessert' });
  if (m === 12 || m === 11) out.push({ key: 'holiday', name: 'Holiday table', es: 'Mesa navideña', emoji: '🎄', brief: 'Holiday season dishes, including Latin American favorites like tamales-style or ponche-inspired options, cookies and a crowd main' });
  if (m >= 9 || m <= 2) out.push({ key: 'gameday', name: 'Game day', es: 'Día de partido', emoji: '🏈', brief: 'Game day snacks and finger food for a crowd: wings-style, dips, sliders, nachos' });
  if (m >= 10 || m <= 3) out.push({ key: 'cozy', name: 'Cozy soups & stews', es: 'Sopas y guisos calientitos', emoji: '🍲', brief: 'Cozy cold-weather soups, stews and chili' });
  if (m >= 5 && m <= 9) out.push({ key: 'grill', name: 'Summer grill', es: 'Asador de verano', emoji: '🔥', brief: 'Summer grilling and no-cook sides' });
  if (m === 1) out.push({ key: 'reset', name: 'New year reset', es: 'Arranque de año', emoji: '🥗', brief: 'Light, high-protein new-year meals' });
  out.push({ key: 'weeknight', name: '15-minute weeknights', es: 'Entre semana en 15 minutos', emoji: '⚡', brief: 'Weeknight dinners ready in 15 minutes or less' });
  out.push({ key: 'budget', name: 'Feed 4 under $15', es: 'Para 4 por menos de $15', emoji: '💵', brief: 'Budget family dinners for 4 people under 15 USD total' });
  return out;
}
