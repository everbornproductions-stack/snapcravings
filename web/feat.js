// SnapCravings 2026-11-02 features, kept in one file so app.js / prep.js only carry tiny hooks:
// (1) first-use setup after the first photo (diet + allergies + household size, one screen, skippable), (2) household size in Settings,
// (3) low-carb / diabetic-friendly: diet badges, carbs per serving, lowest-carb first, "not medical advice" note,
// (4) solo cooking: recipes scaled to the household size + "cook once, eat twice" tips, (5) tablet two-column helpers (CSS in index.html).
// Strings: web/feat-i18n.js (globalThis.FEAT_I18N), merged into the app dictionaries without overwriting keys.
(function () {
  if (typeof I18N === 'undefined' || typeof LS === 'undefined') return;
  const merge = l => { const src = (globalThis.FEAT_I18N || {})[l], d = l === 'es' ? I18N.ES : I18N.D[l]; if (src && d) for (const k in src) if (!Object.prototype.hasOwnProperty.call(d, k)) d[k] = src[k]; };
  Object.keys(globalThis.FEAT_I18N || {}).forEach(merge);
  const load0 = I18N.load; I18N.load = (l, cb) => load0(l, () => { merge(l); cb(); });
  const T = (s, v) => I18N.t(s, v);
  const CARB = ['Low-carb', 'Diabetic-friendly', 'Keto/low-carb'];
  const tags = () => (typeof diet !== 'undefined' && diet.tags) || [];
  const carbDiet = () => tags().some(x => CARB.includes(x));
  const diabetic = () => tags().includes('Diabetic-friendly');
  const hh = () => +LS.get('household', 0) || 0;
  const ICON = { 'Diabetic-friendly': '🩺', 'Low-carb': '🥬', 'Keto/low-carb': '🥑', Vegan: '🌱', Vegetarian: '🥕', Halal: '☪️' };
  const main = () => { const t0 = tags().filter(x => !/allergy/i.test(x)); return CARB.find(x => t0.includes(x)) || t0[0] || tags()[0]; };
  // Visible diet badge: the user's main diet (+n more). Same pill styling as the rest of the app.
  window.dietBadge = function (small) {
    const m = main(); if (!m) return ''; const n = tags().length - 1;
    return `<span class="pill g dbadge" style="display:inline-block;${small ? 'margin:4px 0 0' : 'margin:0 0 8px'}">${ICON[m] || '🥗'} ${esc(T(m))}${n > 0 ? ' +' + n : ''}</span>`;
  };
  const carbPill = r => carbDiet() && Number.isFinite(+r?.carbs_g) && r.carbs_g !== '' && r.carbs_g != null ? `<span class="pill dcarb" style="display:inline-block;margin:4px 0 0 4px;background:var(--coral-soft);color:var(--ink)">${T('~{c} g carbs per serving', { c: Math.round(+r.carbs_g) })}</span>` : '';
  const medNote = () => diabetic() ? `<p class="fine dmed">🩺 ${T('Diabetic-friendly ideas, not medical advice. Carbs are AI estimates. Follow the plan from your doctor or dietitian.')}</p>` : '';
  const soloTip = () => hh() === 1 ? `<div class="card dsolo" style="background:var(--green-soft);border-color:#BFE3CC;margin-top:12px"><b>🍱 ${T('Cook once, eat twice')}</b><div class="fine" style="margin-top:2px">${T('Make a double batch, eat one serving now and keep the second in the fridge for tomorrow (up to 3 days), or freeze it.')}</div></div>` : '';
  // Scale a recipe to the household size (leading numbers in each qty: "1 1/2 cups", "2", "½ tsp", "200 g").
  const FR = { '½': .5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': .25, '¾': .75 };
  const fmt = v => { if (v >= 10) return String(Math.round(v)); const w = Math.floor(v), f = v - w; const opts = [[0, ''], [.25, '1/4'], [1 / 3, '1/3'], [.5, '1/2'], [2 / 3, '2/3'], [.75, '3/4'], [1, '']];
    let best = opts[0]; for (const o of opts) if (Math.abs(f - o[0]) < Math.abs(f - best[0])) best = o; const W = w + (best[0] === 1 ? 1 : 0); return (W ? W + (best[1] ? ' ' : '') : '') + best[1] || '0'; };
  function scaleQty(q, f) {
    const m = /^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½⅓⅔¼¾])(\s*[½⅓⅔¼¾])?/.exec(String(q || '')); if (!m) return q;
    let v = 0, a = m[1]; if (FR[a]) v = FR[a]; else if (/\s/.test(a)) { const [w, fr] = a.split(/\s+/); const [x, y] = fr.split('/'); v = +w + x / y; } else if (a.includes('/')) { const [x, y] = a.split('/'); v = x / y; } else v = +a.replace(',', '.');
    if (m[2]) v += FR[m[2].trim()] || 0; if (!v) return q;
    const n = v * f; const big = /^\s*\d+(?:[.,]\d+)?\s*(g|ml|gr|gram|grams)\b/i.test(q) ? String(Math.max(5, Math.round(n / 5) * 5)) : fmt(n);
    return big + String(q).slice(m[0].length);
  }
  window.scaleRecipe = function (r, n) {
    const s = +r.servings || 0; if (!n || !s || s === n || r._from) return r;
    const f = n / s, sc = i => ({ ...i, qty: scaleQty(i.qty, f) });
    return { ...r, servings: n, _from: s, ingredients: (r.ingredients || []).map(sc), missing: (r.missing || []).map(sc) };
  };
  window.scaleQty = scaleQty;
  // Wrap a global render function (and the route table entry that points at it).
  // grow.js / more.js already chain RENDER.recipe, so the route entry (rkey) is wrapped as the OUTERMOST layer too. Hooks are idempotent.
  const hook = (o, before, after) => function () { try { before && before(); } catch (e) { console.warn(e); } const r = o.apply(this, arguments); try { after && after(); } catch (e) { console.warn(e); } return r; };
  const wrap = (name, before, after, rkey) => { const o = window[name]; if (typeof o !== 'function') return; const f = hook(o, before, after); window[name] = f;
    try { if (rkey && typeof RENDER[rkey] === 'function' && RENDER[rkey] !== o) RENDER[rkey] = hook(RENDER[rkey], before, after); else for (const k in RENDER) if (RENDER[k] === o) RENDER[k] = f; } catch {} };
  const byCarbs = (a, b) => (Number.isFinite(+a?.carbs_g) && a.carbs_g != null ? +a.carbs_g : 999) - (Number.isFinite(+b?.carbs_g) && b.carbs_g != null ? +b.carbs_g : 999);
  // Recipes list: lowest carbs first for carb-aware diets, plus a diet badge and carbs on every card.
  wrap('renderRecipes', () => { const R = state.recipes; if (R && carbDiet()) { (R.ready || []).sort(byCarbs); (R.more || []).sort(byCarbs); } }, () => decorate(el('recipesBody')));
  function decorate(root) {
    if (!root || !tags().length) return;
    root.querySelectorAll('[data-rec]').forEach(a => { const box = a.querySelector('div[style*="flex:1"]'); if (!box || box.querySelector('.dbadge')) return; let r = null; try { r = pick(a.dataset.rec); } catch {}
      box.insertAdjacentHTML('beforeend', '<div>' + window.dietBadge(true) + carbPill(r) + '</div>'); });
    const h2 = root.querySelector('h2'); if (h2 && diabetic() && !root.querySelector('.dmed')) h2.insertAdjacentHTML('afterend', medNote());
  }
  wrap('renderFavs', null, () => decorate(el('favsBody')));
  // Recipe page: scale to the household, badge, carbs, medical note, solo tip.
  wrap('renderRecipe', () => { const n = hh(); if (n && state.recipe && state.from !== 'crave') state.recipe = window.scaleRecipe(state.recipe, n); }, () => {
    const b = el('recipeBody'), r = state.recipe; if (!b || !r) return; const h2 = b.querySelector('h2'); if (!h2 || b.querySelector('.dfeat')) return;
    let x = '<div class="dfeat">' + (tags().length ? window.dietBadge(true) + carbPill(r) : '') + '</div>';
    if (r._from) x += `<p class="fine" style="margin-top:4px">⚖️ ${T('Scaled from {a} to {b} servings for your household.', { a: r._from, b: r.servings })}</p>`;
    h2.insertAdjacentHTML('afterend', x);
    const st = [...b.querySelectorAll('h3')].find(h => h.nextElementSibling && h.nextElementSibling.matches('ol.steps')); if (st) st.insertAdjacentHTML('beforebegin', soloTip());
    if (diabetic()) b.insertAdjacentHTML('beforeend', medNote());
  }, 'recipe');
  // Crave it: badge + carbs + note on the compare screen.
  wrap('renderCompare', null, () => { const b = el('compareBody'), r = state.crave?.recipe; if (!b || !r || !tags().length) return; const h2 = b.querySelector('h2'); if (!h2 || b.querySelector('.dbadge')) return;
    h2.insertAdjacentHTML('afterend', '<div>' + window.dietBadge(true) + carbPill(r) + '</div>' + medNote()); });
  // Meal prep: badge + note on the result, and each day wrapped in .pday so tablets can lay the days out in two columns.
  function prepDecor() {
    const b = el('prepBody'); if (!b || b.querySelector('.pdays') || !b.querySelector('details.opt')) return;
    const kids = [...b.children], groups = []; let g = null;
    for (const k of kids) {
      if (k.tagName === 'H3' && k.nextElementSibling && (k.nextElementSibling.matches('details.opt') || (k.nextElementSibling.matches('.card') && k.nextElementSibling.nextElementSibling?.matches('details.opt')))) { g = [k]; groups.push(g); continue; }
      if (g && (k.matches('details.opt') || (k.matches('.card') && g.length === 1))) { g.push(k); continue; }
      if (groups.length && g) g = null; if (groups.length && !g && k.tagName === 'H3') break;
    }
    if (!groups.length) return;
    const wrapEl = document.createElement('div'); wrapEl.className = 'pdays'; groups[0][0].before(wrapEl);
    for (const gr of groups) { const d = document.createElement('div'); d.className = 'pday'; gr.forEach(n => d.appendChild(n)); wrapEl.appendChild(d); }
    const h2 = b.querySelector('h2'); if (h2 && !b.querySelector('.dbadge') && tags().length) h2.insertAdjacentHTML('afterend', window.dietBadge() + medNote());
    if (h2 && hh() === 1 && !b.querySelector('.dsolo')) wrapEl.insertAdjacentHTML('beforebegin', soloTip());
  }
  const pb = el('prepBody'); if (pb && window.MutationObserver) new MutationObserver(() => prepDecor()).observe(pb, { childList: true });

  // Household size (1, 2, 4 or custom) and the planners' defaults that follow it.
  function setHousehold(n) {
    n = Math.max(1, Math.min(12, Math.round(+n) || 0)); if (!n) return; LS.set('household', n);
    const po = window.PREP_OPTS || LS.get('prepOpts', {}); po.servings = Math.min(8, n); if (!window.PREP_OPTS) LS.set('prepOpts', po); else LS.set('prepOpts', Object.assign(LS.get('prepOpts', {}), { servings: po.servings }));
    const ho = window.HP_OPTS || LS.get('hpOpts', {}); ho.guests = Math.min(30, n); LS.set('hpOpts', Object.assign(LS.get('hpOpts', {}), { guests: ho.guests }));
    if (state.recipes || state.crave) { state.recipes = null; state.crave = null; LS.set('recipes', null); LS.set('crave', null); }
  }
  const hhChips = (cur, attr) => [1, 2, 4].map(v => `<button class="chip" ${attr}="${v}" aria-pressed="${cur === v}" style="cursor:pointer;font-family:var(--font);${cur === v ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${cur === v ? '✓ ' : ''}${v === 1 ? T('Just me') : T('{n} people', { n: v })}</button>`).join('')
    + `<button class="chip" ${attr}="c" aria-pressed="${!!cur && ![1, 2, 4].includes(cur)}" style="cursor:pointer;font-family:var(--font);${cur && ![1, 2, 4].includes(cur) ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${cur && ![1, 2, 4].includes(cur) ? '✓ ' + T('{n} people', { n: cur }) : T('Custom')}</button>`;
  const hhBlock = (cur, attr, inId) => `<h3>${T('Household size')}</h3><p class="sub" style="margin-top:0">${T('Recipes, meal prep and the holiday planner start with this many servings.')}</p><div class="chips">${hhChips(cur, attr)}</div>
    <div class="input" id="${inId}Box" style="display:none"><span>👥</span><input id="${inId}" type="number" min="1" max="12" inputmode="numeric" placeholder="${T('How many people?')}" aria-label="${T('How many people?')}" value="${cur || ''}"></div>`;
  wrap('renderSettings', null, () => { const b = el('settingsBody'); if (!b || b.querySelector('#hhSet')) return; const at = [...b.querySelectorAll('h3')].find(h => h.nextElementSibling && h.nextElementSibling.querySelector?.('#dietOther')) || b.querySelector('#dietOther')?.closest('.input')?.previousElementSibling;
    const d = document.createElement('div'); d.id = 'hhSet'; d.innerHTML = hhBlock(hh(), 'data-hhs', 'hhIn'); if (at) at.before(d); else b.appendChild(d); });

  // First-use setup: one screen right after the first photo (the camera opens first, as before). Skippable; never shown again.
  function showSetup() {
    if (document.getElementById('setupSheet') || LS.get('setupDone', false) || LS.get('dietSeen', false)) return;
    const sel = new Set(tags()); let n = hh();
    const chip = x => { const on = sel.has(x); return `<button class="chip" data-stag="${esc(x)}" aria-pressed="${on}" style="cursor:pointer;font-family:var(--font);${on ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${on ? '✓ ' : ''}${esc(T(x))}</button>`; };
    const host = document.querySelector('.phone') || document.body, o = document.createElement('div'); o.id = 'setupSheet'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'setupH');
    o.style.cssText = 'position:absolute;inset:0;z-index:60;background:rgba(30,27,24,.45);display:flex;align-items:flex-end;justify-content:center';
    const draw = () => { o.innerHTML = `<div class="sheet" style="background:var(--bg);width:100%;max-width:640px;max-height:92%;overflow-y:auto;border-radius:24px 24px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.2)">
      <div class="kick">${T('Quick setup · 10 seconds')}</div><h2 id="setupH" style="margin-top:4px">${T('Any food rules?')}</h2><p class="sub">${T('Optional. Every recipe, meal prep and holiday plan will fit. Change it anytime in ⚙️.')}</p>
      <h3>${T('My diet')}</h3><div class="chips">${DIET_TAGS.filter(x => !/allergy/i.test(x)).map(chip).join('')}</div>
      <h3>${T('My allergies')}</h3><div class="chips">${DIET_TAGS.filter(x => /allergy/i.test(x)).map(chip).join('')}</div>
      ${hhBlock(n, 'data-shh', 'setupHh')}
      <button class="btn primary" id="setupSave">${T('Save')}</button><button class="btn ghost" id="setupSkip">${T('Skip for now')}</button></div>`; };
    draw(); host.appendChild(o);
    o.addEventListener('click', e => { const x = e.target;
      const tg = x.closest('[data-stag]'); if (tg) { const v = tg.dataset.stag; sel.has(v) ? sel.delete(v) : sel.add(v); if (v === 'Vegan' && sel.has(v)) sel.delete('Vegetarian'); if (v === 'Vegetarian' && sel.has(v)) sel.delete('Vegan'); const y = o.firstChild.scrollTop; draw(); o.firstChild.scrollTop = y; return; }
      const hc = x.closest('[data-shh]'); if (hc) { if (hc.dataset.shh === 'c') { const y = o.firstChild.scrollTop; draw(); o.firstChild.scrollTop = y; const bx = o.querySelector('#setupHhBox'); bx.style.display = 'flex'; o.querySelector('#setupHh').focus(); return; } n = +hc.dataset.shh; const y = o.firstChild.scrollTop; draw(); o.firstChild.scrollTop = y; return; }
      if (x.closest('#setupSave')) { const c = +(o.querySelector('#setupHh')?.value || 0); if (o.querySelector('#setupHhBox')?.style.display === 'flex' && c) n = c;
        diet.tags = DIET_TAGS.filter(v => sel.has(v)); saveDiet(); if (n) setHousehold(n); LS.set('setupDone', true); o.remove(); track('diet_saved', 'setup'); toast(T('Saved! Every recipe will fit.')); return; }
      if (x.closest('#setupSkip') || x === o) { LS.set('setupDone', true); LS.set('dietSeen', true); o.remove(); }
    });
    o.addEventListener('keydown', e => { if (e.key === 'Escape') { LS.set('setupDone', true); LS.set('dietSeen', true); o.remove(); } });
    setTimeout(() => o.querySelector('#setupSave')?.focus({ preventScroll: true }), 50);
  }
  ['snapCam', 'snapLib'].forEach(id => el(id)?.addEventListener('change', () => setTimeout(() => { if (state.photos && state.photos.length) showSetup(); }, 700))); /* app.js clears the input value first */
  window.showSetup = showSetup;
  // Settings household chips.
  document.addEventListener('click', e => { const x = e.target.closest && e.target.closest('[data-hhs]'); if (!x) return;
    if (x.dataset.hhs === 'c') { const bx = el('hhInBox'); if (bx) { bx.style.display = 'flex'; el('hhIn').focus(); } return; }
    setHousehold(+x.dataset.hhs); renderSettings(); toast(T('Household size saved.')); });
  document.addEventListener('change', e => { if (e.target.id === 'hhIn' && +e.target.value) { setHousehold(+e.target.value); renderSettings(); toast(T('Household size saved.')); } });
  if (I18N.lang !== 'en') { try { I18N.applyStatic(document.querySelector('.phone')); } catch {} }
  // Re-render the current screen so the wrappers apply on first paint.
  try { const id = location.hash.slice(1); if (['recipes', 'recipe', 'favs', 'settings', 'compare'].includes(id)) RENDER[id]?.(); } catch {}
})();
