// Holiday planner (2026-11-02): pure helpers for functions/api/holiday-plan.js (input, prompts, schema, diet check, timeline, free preview).
import '../../web/holiday.js';
import { intlNote, INTL } from './lang.js';
import { dietOf, dietPrompt, recipeHits } from './diet.js';
import { AISLES, groceryList } from './plan.js';
export const COURSES = ['Main', 'Side', 'Dessert', 'Drink'];
export const FREE_STEPS = 3;
const ING = { type: 'object', properties: { item: { type: 'string' }, qty: { type: 'string' }, aisle: { type: 'string', enum: AISLES }, have: { type: 'boolean' } }, required: ['item', 'qty', 'aisle', 'have'] };
const DISH = { type: 'object', properties: { course: { type: 'string', enum: COURSES }, name: { type: 'string' }, emoji: { type: 'string' }, minutes: { type: 'integer' }, serves: { type: 'integer' }, note: { type: 'string' }, ingredients: { type: 'array', items: ING } }, required: ['course', 'name', 'emoji', 'minutes', 'serves', 'note', 'ingredients'] };
export const MENU_SCHEMA = { type: 'object', properties: { menu: { type: 'array', items: DISH } }, required: ['menu'] };
const STEP = { type: 'object', properties: { before_min: { type: 'integer' }, when: { type: 'string' }, task: { type: 'string' }, dish: { type: 'string' } }, required: ['before_min', 'when', 'task', 'dish'] };
export const TIMELINE_SCHEMA = { type: 'object', properties: { timeline: { type: 'array', items: STEP } }, required: ['timeline'] };
export const SHAPE = { menu: '{"menu":[{"course":"Main|Side|Dessert|Drink","name":"","emoji":"","minutes":90,"serves":8,"note":"","ingredients":[{"item":"","qty":"","aisle":"Produce","have":false}]}]}',
  timeline: '{"timeline":[{"before_min":2880,"when":"2 days before","task":"","dish":""}]}' };
export const unitsFor = c => ['US', 'LR', 'MM'].includes(c) ? 'US units (lb, oz, cups, tablespoons) and oven temperatures in °F' : 'metric units (g, kg, ml, L) and oven temperatures in °C';
const clamp = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
export function hpInput(b = {}) {
  const S = globalThis.SC_HOLIDAY; b = b && typeof b === 'object' ? b : {};
  const country = /^[A-Z]{2}$/.test(String(b.country || '').toUpperCase()) ? String(b.country).toUpperCase() : 'US';
  const holiday = S.H[b.holiday] && S.setFor(country).includes(b.holiday) ? b.holiday : null; // each country plans only its own holidays
  const time = /^([01]\d|2[0-3]):00$/.test(b.time) ? b.time : '18:00';
  const fridge = (Array.isArray(b.fridge) ? b.fridge : []).map(x => String(x).slice(0, 60)).filter(Boolean).slice(0, 60);
  return { holiday, country, guests: clamp(b.guests, 1, 30, 8), time, fridge, diet: dietOf({ ...(b.prefs || {}), serves: 0 }) };
}
export function menuPrompt(p, lang) {
  const h = globalThis.SC_HOLIDAY.info(p.holiday, 'en');
  return `Plan a complete ${h.nameEn} meal for ${p.guests} guests in country ${p.country}, served at ${p.time}. Use dishes people in that country really make for ${h.nameEn} (classics like ${h.dishes}).
Return 8 to 10 dishes: 2 Main, 3 or 4 Side, 2 Dessert, 1 or 2 Drink (at least one non-alcoholic). Every ingredient qty is the TOTAL amount for ${p.guests} guests (scale it), in ${unitsFor(p.country)}. serves = ${p.guests}. note = one short serving or make-ahead tip.
${p.fridge.length ? `The user already has: ${p.fridge.join('; ')}. Use some of them and mark those ingredients have=true.\n` : ''}${dietPrompt(p.diet) ? dietPrompt(p.diet) + ' Every dish must follow these rules (swap and say so in the note).\n' : ''}${INTL[lang] ? intlNote(lang) : lang === 'es' ? '\nWrite every user-facing text in Latin American Spanish.' : ''}`;
}
export function timelinePrompt(p, menu, lang) {
  const h = globalThis.SC_HOLIDAY.info(p.holiday, 'en');
  return `Write a cooking timeline for this ${h.nameEn} meal for ${p.guests} guests, served at ${p.time}: ${menu.map(d => `${d.name} (${d.minutes} min)`).join('; ')}.
Count back from the meal time. 10 to 16 steps, earliest first: shopping and make-ahead days before (thawing a frozen turkey or roast in the fridge takes 1 day per 4 lb / 1.8 kg, so a 16 lb turkey starts thawing 4 days before: before_min 5760), the day before, the morning of, then T-3h, T-2h, T-1h, T-30m, serve. before_min = minutes before the meal (2 days = 2880). when = short label like "2 days before", "Morning of", "T-1h". task = one or two specific sentences in ${unitsFor(p.country)}, with oven temps and food-safety notes. dish = the dish name or "All".${INTL[lang] ? intlNote(lang) : lang === 'es' ? '\nWrite when and task in Latin American Spanish.' : ''}`;
}
export function checkMenu(p, menu) {
  const good = [], banned = new Set();
  for (const d of Array.isArray(menu) ? menu : []) {
    if (!d || !d.name || !COURSES.includes(d.course) || !Array.isArray(d.ingredients)) continue;
    const h = p.diet.hard ? recipeHits(p.diet, { name: d.name, ingredients: d.ingredients, steps: [d.note || ''] }) : [];
    if (h.length) { h.forEach(x => banned.add(x)); continue; }
    good.push({ course: d.course, name: String(d.name).slice(0, 80), emoji: String(d.emoji || '🍽️').slice(0, 8), minutes: clamp(d.minutes, 5, 2880, 60), serves: p.guests, note: String(d.note || '').split(/(?<=[.!?。])\s+/).filter(x => !/thaw|descongel|décongel|auftau|разморо|çöz/i.test(x)).join(' ').slice(0, 200), // thawing lives in the timeline (thawFix)
      ingredients: d.ingredients.filter(i => i && i.item).slice(0, 25).map(i => ({ item: String(i.item).slice(0, 60), qty: String(i.qty || '').slice(0, 40), aisle: AISLES.includes(i.aisle) ? i.aisle : 'Other', have: !!i.have })) });
  }
  good.sort((a, b) => COURSES.indexOf(a.course) - COURSES.indexOf(b.course));
  return { menu: good, banned: [...banned] };
}
// Food safety: fridge-thawing needs about 1 day per 4 lb (1.8 kg). Models often schedule it too late, so fix the start time from the weight.
export function thawFix(s, menu = []) {
  if (!/thaw|descongel|décongel|auftau|разморо|çöz|cair|डीफ्रॉस्ट|पिघला|إذابة/i.test(s.task)) return s;
  // Weight from the step itself, else from its own dish (never from other dishes, and never when the step also does other work).
  const own = menu.find(d => d.name && s.dish && d.name.toLowerCase() === s.dish.toLowerCase());
  const txt = /\d\s*(lb|pound|kg|kilo)/i.test(s.task) ? s.task : own ? own.ingredients.filter(i => /turkey|ham|roast|goose|duck|lamb|beef|pork|pavo|peru|dinde|pute|индейк|hindi|kalkun|ديك|टर्की/i.test(i.item)).map(i => i.item + ' ' + i.qty).join(' ') : '';
  const lb = +(/(\d+(?:\.\d+)?)\s*(?:lb|pound)/i.exec(txt) || [])[1] || 0, kg = +(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/i.exec(txt) || [])[1] || 0;
  const days = lb ? Math.ceil(lb / 4) : kg ? Math.ceil(kg / 1.8) : 0; if (!days || s.before_min >= days * 1440) return s;
  return { ...s, before_min: days * 1440, when: days + (days === 1 ? ' day before' : ' days before'), fixed: true };
}
export function cleanTimeline(tl, menu = []) {
  return (Array.isArray(tl) ? tl : []).filter(s => s && s.task).map(s => thawFix({ before_min: clamp(s.before_min, 0, 10080, 0), when: String(s.when || '').slice(0, 40), task: String(s.task).slice(0, 300), dish: String(s.dish || '').slice(0, 80) }, menu))
    .sort((a, b) => b.before_min - a.before_min).slice(0, 20);
}
export const shoppingFor = (p, menu) => groceryList(menu.map(d => ({ ...d, ingredients: d.ingredients })), p.fridge, p.diet);
// Free: menu + first FREE_STEPS timeline steps; shopping list and the rest are Pro.
export function previewOf(full, pro) {
  if (pro) return { ...full, preview: false };
  const n = full.timeline?.length || 0;
  return { ...full, preview: true, timeline: (full.timeline || []).slice(0, FREE_STEPS), locked: Math.max(0, n - FREE_STEPS), shopping: [], shoppingCount: (full.shopping || []).reduce((s, g) => s + g.items.length, 0) };
}
