// Dish scan (plate photo -> estimated nutrition). Shared by the browser (web/dish.js) and the API (functions/api/dish.js),
// so validation and portion math never drift. Plain script: sets globalThis.SC_DISH.
(function () {
  const LIM = { kcal: 3000, protein: 250, carbs: 400, fat: 250, fiber: 80, sugar: 250, sodium: 8000 }; // per serving, generous
  const KEYS = Object.keys(LIM);
  const PORTIONS = { small: 0.7, regular: 1, large: 1.4 };
  const num = v => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : +v; return Number.isFinite(n) ? n : NaN; };
  const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  // Validate and clean the model's JSON. Returns { ok, dish } or { ok:false, why }.
  function validate(d) {
    if (!d || typeof d !== 'object') return { ok: false, why: 'shape' };
    if (d.is_food === false) return { ok: false, why: 'notfood' };
    const name = txt(d.dish, 80); if (!name) return { ok: false, why: 'noname' };
    const t = d.total || {}; const total = {};
    for (const k of KEYS) { const n = num(t[k]); if (Number.isNaN(n) || n < 0) { if (k === 'kcal' || k === 'protein' || k === 'carbs' || k === 'fat') return { ok: false, why: 'missing ' + k }; total[k] = null; continue; } if (n > LIM[k]) return { ok: false, why: 'range ' + k }; total[k] = Math.round(n * 10) / 10; }
    // Energy check: kcal should be close to 4P + 4C + 9F. If far off, trust the macros.
    const fromMacros = 4 * total.protein + 4 * total.carbs + 9 * total.fat;
    let fixed = false;
    if (fromMacros > 0 && (total.kcal < fromMacros * 0.7 || total.kcal > fromMacros * 1.35)) { total.kcal = Math.round(fromMacros); fixed = true; }
    if (total.kcal <= 0) return { ok: false, why: 'zero' };
    const items = (Array.isArray(d.items) ? d.items : []).slice(0, 15).map(i => ({ name: txt(i?.name, 60), grams: Math.max(0, Math.min(2000, Math.round(num(i?.grams) || 0))) })).filter(i => i.name);
    const conf = ['high', 'medium', 'low'].includes(d.confidence) ? d.confidence : 'medium';
    return { ok: true, dish: { name, emoji: txt(d.emoji, 4) || '🍽️', confidence: conf, items, total, kcalFixed: fixed, note: txt(d.note, 160) } };
  }
  // Rescale per-serving totals: portion (small/regular/large or a number 0.25-3) times servings (1-10).
  function factor(portion, servings) {
    const p = typeof portion === 'number' ? portion : PORTIONS[portion] ?? 1;
    const s = Math.round(num(servings)) || 1;
    return Math.min(3, Math.max(0.25, p)) * Math.min(10, Math.max(1, s));
  }
  function scale(total, portion, servings) {
    const f = factor(portion, servings); const o = {};
    for (const k of KEYS) o[k] = total?.[k] == null ? null : k === 'kcal' || k === 'sodium' ? Math.round(total[k] * f) : Math.round(total[k] * f * 10) / 10;
    return o;
  }
  // Daily log helpers (pure): add an entry, total a day.
  const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function dayTotal(entries) { const o = { kcal: 0, protein: 0, carbs: 0, fat: 0 }; for (const e of entries || []) for (const k in o) o[k] += +e[k] || 0; for (const k in o) o[k] = Math.round(o[k]); return o; }
  globalThis.SC_DISH = { LIM, KEYS, PORTIONS, validate, factor, scale, dayKey, dayTotal };
})();
