// Dish scan (#dish): photo of a plated meal -> estimated calories + macros, portion/servings rescale live, fix + recalculate,
// optional daily log tied to Meal prep's calorie/protein targets. Uses app.js helpers (api, shrink, esc, t, el, toast, loading, LS, unlimited, subCfg, track).
(function () {
  // Strings live in web/dish-i18n.js (globalThis.DISH_I18N[lang]); merge them into the app dictionaries without overwriting keys
  // the app already has, now and whenever Settings loads another language file.
  const merge = l => { const src = (globalThis.DISH_I18N || {})[l], d = l === 'es' ? I18N.ES : I18N.D[l]; if (src && d) for (const k in src) if (!Object.prototype.hasOwnProperty.call(d, k)) d[k] = src[k]; };
  Object.keys(globalThis.DISH_I18N || {}).forEach(merge);
  const load0 = I18N.load; I18N.load = (l, cb) => load0(l, () => { merge(l); cb(); });
  const X = globalThis.SC_DISH;
  const S = { photo: null, dish: null, portion: 'regular', servings: 1, busy: false, err: null, paywall: false, edit: false, flash: '' };
  Object.assign(S, LS.get('dishLast', {}), { busy: false, err: null, paywall: false, edit: false, flash: '' });
  const save = () => LS.set('dishLast', { dish: S.dish, portion: S.portion, servings: S.servings, photo: S.photo && S.photo.length < 400000 ? S.photo : null });
  const mk = (id, cap) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.id = id; i.className = 'offscreen'; i.tabIndex = -1; i.setAttribute('aria-hidden', 'true'); /* not hidden: iOS */ if (cap) i.setAttribute('capture', 'environment'); document.body.appendChild(i); i.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) go(f); }); return i; };
  const cam = mk('dishCam', true), lib = mk('dishLib', false);
  const logGet = () => { const l = LS.get('dishLog', null); return l && l.day === X.dayKey() ? l : { day: X.dayKey(), entries: [] }; };
  const fmt = (v, u) => v == null ? '–' : `${v}${u}`;
  async function go(file) {
    location.hash = '#dish';
    try { S.photo = await shrink(file); } catch { return toast(t('That photo could not be read. Try another!')); }
    S.dish = null; S.portion = 'regular'; S.servings = 1; await run({ image: S.photo, lang: I18N.lang });
  }
  async function run(body) {
    S.busy = true; S.err = null; S.paywall = false; render();
    const t0 = Date.now();
    try {
      const j = await api('dish', body, 50000);
      S.dish = j.dish; S.edit = false; S.flash = body.fix ? t('Updated!') : '';
      track(body.fix ? 'dish_fix' : 'dish_scan', 'dish', { ms: Date.now() - t0, model: j.model });
    } catch (e) { S.err = e.message; S.paywall = !!e.paywall; }
    S.busy = false; save(); render();
  }
  function stat(label, v) { return `<div class="stat"><b>${esc(v)}</b><span>${esc(t(label))}</span></div>`; }
  function body() {
    const free = !unlimited();
    if (S.busy) return (S.photo ? `<div class="photo" style="display:flex;padding:6px"><img src="${S.photo}" alt="${esc(t('Your plate photo'))}"></div>` : '') + loading('Reading your plate…');
    const snapBtns = `<button class="btn primary" data-dish-cam>📸 ${t('Snap it')}</button><button class="btn ghost" data-dish-lib>${t('🖼 Pick a photo')}</button>`;
    if (S.paywall) return `<div class="kick">${t('Hungry for more?')}</div><h2>${t('Free dish scan used')}</h2><p class="sub">${esc(S.err)} ${t('Pro gets unlimited dish scans.')}</p><a class="btn primary" href="#pro">${subCfg.enabled ? t("Go Unlimited — let's get cooking!") : t('Go Pro')}</a>`;
    if (S.err) return `<div class="kick">${t('Oops, kitchen hiccup!')}</div><h2>${t("We couldn't read your plate")}</h2><p class="sub">${esc(S.err)}</p>${S.photo && !S.dish ? `<button class="btn primary" data-dish-retry>${t('Retry')}</button>` : ''}${snapBtns}`;
    if (!S.dish) return `<div class="kick">${t('Know your plate!')}</div><h2>${t('Snap your meal')}</h2><p class="sub">${t('One photo of your plate, from above. We estimate calories, protein, carbs and fat.')}</p>${free ? `<p class="pill g" style="display:inline-block;margin:0 0 10px;font-size:12px">🎟️ ${t('Free plan: 1 dish scan a week. Pro: unlimited.')}</p>` : ''}${snapBtns}${today()}`; /* limit shown BEFORE the free scan is used */
    const d = S.dish, n = X.scale(d.total, S.portion, S.servings);
    const conf = { high: ['g', 'High confidence'], medium: ['g', 'Medium confidence'], low: ['c', 'Low confidence'] }[d.confidence] || ['g', 'Medium confidence'];
    return `${S.photo ? `<div class="photo" style="display:flex;padding:6px"><img src="${S.photo}" alt="${esc(t('Your plate photo'))}"></div>` : ''}
      <div class="kick">${t('Know your plate!')}</div><h2>${esc(d.emoji)} ${esc(d.name)}</h2><span class="pill ${conf[0]}">${t(conf[1])}</span>${S.flash ? ` <span class="pill g">${esc(S.flash)}</span>` : ''}
      <h3>${t('Portion')}</h3>
      <div class="seg">${['small', 'regular', 'large'].map(p => `<button data-dish-portion="${p}" class="${S.portion === p ? 'on' : ''}">${t(p[0].toUpperCase() + p.slice(1))}</button>`).join('')}</div>
      <div style="display:flex;align-items:center;gap:8px"><b style="flex:1">${t('Servings')}</b><button class="chip" data-dish-srv="-1" style="cursor:pointer;font-family:var(--font)" aria-label="−">−</button><b id="dishSrv">${S.servings}</b><button class="chip" data-dish-srv="1" style="cursor:pointer;font-family:var(--font)" aria-label="+">+</button></div>
      <div class="card" style="text-align:center;margin-top:10px"><div style="font-size:34px;font-weight:800" id="dishKcal">${n.kcal}</div><div class="sub">${t('Calories')} · ${t('Per serving × {s}', { s: X.factor(S.portion, S.servings).toFixed(2).replace(/\.?0+$/, '') })}</div>
        <div class="stats">${stat('Protein', fmt(n.protein, 'g'))}${stat('Carbs', fmt(n.carbs, 'g'))}${stat('Fat', fmt(n.fat, 'g'))}</div>
        <div class="stats">${stat('Fiber', fmt(n.fiber, 'g'))}${stat('Sugar', fmt(n.sugar, 'g'))}${stat('Sodium', fmt(n.sodium, ' mg'))}</div>
        <p class="fine">${t('AI estimate, not medical advice.')}${d.note ? ' ' + esc(d.note) : ''}</p></div>
      <button class="btn primary" data-dish-log>${t('Add to today')}</button>
      ${S.edit ? editor() : `<button class="btn ghost" data-dish-edit>${t('Wrong dish or ingredients? Fix it')}</button>`}
      ${today()}
      <button class="btn ghost" data-dish-cam>${t('📸 New plate')}</button>${free ? `<p class="fine" style="text-align:center">${t('Free plan: 1 dish scan a week. Pro: unlimited.')}</p>` : ''}`;
  }
  function editor() {
    const d = S.dish;
    return `<div class="card"><h3 style="margin-top:0">${t('Dish name')}</h3><div class="input"><span>🍽️</span><input id="dishName" maxlength="80" value="${esc(d.name)}" aria-label="${esc(t('Dish name'))}"></div>
      <div id="dishItems">${d.items.map((i, k) => row(i, k)).join('')}</div>
      <button class="chip" data-dish-add style="cursor:pointer;font-family:var(--font)">${t('+ Add ingredient')}</button>
      <button class="btn primary" data-dish-recalc style="margin-top:10px">${t('Recalculate')}</button></div>`;
  }
  const row = (i, k) => `<div style="display:flex;gap:6px;align-items:center" data-dish-row><div class="input" style="flex:2;padding:10px;margin:4px 0"><input data-dn maxlength="60" placeholder="${esc(t('Ingredient'))}" aria-label="${esc(t('Ingredient'))}" value="${esc(i.name)}"></div><div class="input" style="flex:1;padding:10px;margin:4px 0"><input data-dg inputmode="numeric" maxlength="4" placeholder="${esc(t('grams'))}" aria-label="${esc(t('grams'))}" value="${i.grams || ''}"></div><button class="chip" data-dish-del style="cursor:pointer" aria-label="${esc(t('Remove'))}">✕</button></div>`;
  function today() {
    const l = logGet(); const tot = X.dayTotal(l.entries); const o = LS.get('prepOpts', {}); const tk = +o.kcal || 0, tp = +o.p || 0;
    if (!l.entries.length && !tk) return '';
    const pct = tk ? Math.min(100, Math.round(tot.kcal / tk * 100)) : 0, ok = tk && Math.abs(tot.kcal - tk) <= tk * 0.1;
    return `<h3>${t('Today')}</h3><div class="card"><b>${t('Today: {k} kcal · {p}g protein', { k: tot.kcal, p: tot.protein })}</b>
      ${tk ? `<div class="fine">${t('Meal prep target: {k} kcal · {p}g protein', { k: tk, p: tp || '–' })}</div><div class="bar" style="margin:8px 0 4px"><i style="width:${pct}%;background:var(${ok ? '--green' : '--coral'})"></i></div>` : `<a class="fine" href="#prep" style="display:block">${t('Set calorie and protein targets in Meal prep')}</a>`}
      ${l.entries.map(e => `<div class="fine">${esc(e.name)} · ${e.kcal} kcal · ${e.protein}g</div>`).join('')}
      ${l.entries.length ? `<button class="chip" data-dish-clear style="cursor:pointer;margin-top:8px;font-family:var(--font)">${t('Clear today')}</button>` : ''}</div>`;
  }
  function render() { const b = el('dishBody'); if (!b) return; b.innerHTML = body(); }
  function readEdit() {
    const name = (el('dishName')?.value || '').trim();
    const items = [...document.querySelectorAll('[data-dish-row]')].map(r => ({ name: r.querySelector('[data-dn]').value.trim(), grams: parseInt(r.querySelector('[data-dg]').value, 10) || 0 })).filter(i => i.name);
    return { name, items };
  }
  document.addEventListener('click', e => {
    const x = e.target.closest('[data-dish-cam],[data-dish-lib],[data-dish-retry],[data-dish-portion],[data-dish-srv],[data-dish-log],[data-dish-edit],[data-dish-add],[data-dish-del],[data-dish-recalc],[data-dish-clear]');
    if (!x || !x.closest('#dish, #scan')) return;
    const D = x.dataset;
    if ('dishCam' in D) return cam.click();
    if ('dishLib' in D) return lib.click();
    if ('dishRetry' in D) return run({ image: S.photo, lang: I18N.lang });
    if (D.dishPortion) { S.portion = D.dishPortion; S.flash = ''; save(); return render(); }
    if (D.dishSrv) { S.servings = Math.min(10, Math.max(1, S.servings + +D.dishSrv)); S.flash = ''; save(); return render(); }
    if ('dishLog' in D) { const n = X.scale(S.dish.total, S.portion, S.servings); const l = logGet(); l.entries.push({ name: S.dish.name, kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, at: Date.now() }); LS.set('dishLog', l); toast(t('Added to today!')); track('dish_log', 'dish'); return render(); }
    if ('dishEdit' in D) { S.edit = true; return render(); }
    if ('dishAdd' in D) { const f = readEdit(); S.dish = { ...S.dish, name: f.name || S.dish.name, items: [...f.items, { name: '', grams: 0 }] }; return render(); }
    if ('dishDel' in D) { x.closest('[data-dish-row]').remove(); return; }
    if ('dishRecalc' in D) { const f = readEdit(); if (!f.name) return toast(t('Dish name')); return run({ fix: f, lang: I18N.lang }); }
    if ('dishClear' in D) { LS.set('dishLog', null); return render(); }
  });
  window.renderDish = render;
  if (location.hash === '#scan' && !state.photos.length && !state.busy) renderScan(); else if (location.hash === '#dish') render();
  I18N.applyStatic(document.querySelector('.phone'));
})();
