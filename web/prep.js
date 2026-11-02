// Weekly meal-prep planner (#prep). Uses app.js helpers (api, esc, $, t, el, toast, loading, LS, prefs, state, unlimited, addToList, track).
(function () {
  Object.assign(I18N.ES, {
    'Meal prep': 'Plan semanal', 'Plan your week, prep once': 'Planea tu semana, cocina una vez', 'A week of meals, one grocery list and a prep-day guide.': 'Una semana de comidas, una sola lista del súper y una guía para el día de preparación.',
    'Cook once, eat all week.': 'Cocina una vez, come toda la semana.', 'Your week, prepped': 'Tu semana, lista', 'Days': 'Días', 'Meals per day': 'Comidas por día',
    'Dinner only': 'Solo cena', 'Lunch + dinner': 'Comida + cena', 'All 3': 'Las 3', 'Servings per meal': 'Porciones por comida', 'Budget for the week (optional)': 'Presupuesto de la semana (opcional)',
    'Budget in USD, like 80': 'Presupuesto en USD, como 80', 'Use my fridge scan ({n} items)': 'Usar mi escaneo del refri ({n} ingredientes)', 'No fridge scan yet. Snap it first to use what you have.': 'Aún no hay escaneo del refri. Tómale foto primero para usar lo que tienes.',
    'Build my week': 'Armar mi semana', 'Building your week…': 'Armando tu semana…', 'New plan': 'Nuevo plan', 'Day {n}': 'Día {n}', 'Breakfast': 'Desayuno', 'Lunch': 'Comida', 'Dinner': 'Cena',
    '{m} min · keeps {k} days': '{m} min · dura {k} días', 'Swap this meal': 'Cambiar esta comida', 'Swapping…': 'Cambiando…', 'Swapped! Grocery list updated.': '¡Listo! Lista del súper actualizada.',
    'Make it: ~{a} (~{b} per serving, estimate)': 'Prepararlo: ~{a} (~{b} por porción, estimado)', 'Order it out: comparison coming soon': 'Pedirlo: comparación muy pronto',
    'Meals': 'Comidas', 'Est. cook cost': 'Costo est.', 'Per serving': 'Por porción', 'Grocery list for the week': 'Lista del súper de la semana', '· minus what is in your fridge': '· sin lo que ya tienes en el refri',
    'Copy list': 'Copiar lista', 'Share list': 'Compartir lista', 'Add to my grocery list': 'Agregar a mi lista del súper', 'Copied! Paste it anywhere.': '¡Copiada! Pégala donde quieras.',
    'Added {n} items to your grocery list.': 'Agregamos {n} artículos a tu lista del súper.', 'Prep day guide': 'Guía del día de preparación', '· batch it all at once': '· todo de una vez', 'Storage times': 'Cuánto dura',
    'Unlock days {a} to {b}': 'Desbloquea los días {a} a {b}', 'Free preview shows the first {n} days. Go Pro for the full week, grocery list and prep guide for every day.': 'La vista gratis muestra los primeros {n} días. Hazte Pro para la semana completa, la lista y la guía de todos los días.',
    'Go Pro': 'Hazte Pro', 'Costs are AI estimates of grocery prices, not quotes. We never invent restaurant prices.': 'Los costos son estimaciones de IA de precios del súper, no cotizaciones. Nunca inventamos precios de restaurantes.',
    'AI-generated plan. Check doneness, storage and allergens yourself.': 'Plan generado por IA. Revisa la cocción, el almacenamiento y los alérgenos tú mismo.', 'Nothing to buy. Pantry power!': 'Nada que comprar. ¡Poder de alacena!',
    'Produce': 'Frutas y verduras', 'Meat & Seafood': 'Carnes y mariscos', 'Dairy & Eggs': 'Lácteos y huevos', 'Bakery & Grains': 'Panadería y granos', 'Pantry': 'Alacena', 'Canned & Jarred': 'Latas y frascos', 'Frozen': 'Congelados', 'Spices': 'Especias', 'Other': 'Otros',
    'Ingredients': 'Ingredientes', 'Steps': 'Pasos', 'SnapCravings meal prep grocery list': 'Lista del súper de SnapCravings (plan semanal)', 'used in {n} meals': 'en {n} comidas', 'Plan your week': 'Planea tu semana', 'Edit': 'Editar', 'Tap Retry': 'Reintentar'
  });
  const opts = Object.assign({ days: 7, meals: 'dinner', servings: 2, budget: '', fridge: true }, LS.get('prepOpts', {}));
  let plan = LS.get('plan', null), busy = false;
  const save = () => { LS.set('prepOpts', opts); };
  const seg = (k, list) => `<div class="seg">${list.map(([v, l]) => `<button data-po="${k}" data-v="${v}" class="${String(opts[k]) === String(v) ? 'on' : ''}">${esc(t(l))}</button>`).join('')}</div>`;
  const fridge = () => (state.ingredients || []).filter(i => !i.conflict).map(i => i.name);
  function form() {
    const n = fridge().length;
    return `<div class="kick">${t('Cook once, eat all week.')}</div><h2>${t('Plan your week, prep once')}</h2><p class="sub">${t('A week of meals, one grocery list and a prep-day guide.')}</p>
    <h3>${t('Days')}</h3>${seg('days', [[5, '5'], [7, '7']])}
    <h3>${t('Meals per day')}</h3>${seg('meals', [['dinner', 'Dinner only'], ['lunch_dinner', 'Lunch + dinner'], ['all', 'All 3']])}
    <h3>${t('Servings per meal')}</h3><div class="card"><div class="row" style="padding:0"><b>${t('Servings per meal')}</b><span class="qty"><button data-psv="-1">−</button>${opts.servings}<button data-psv="1">+</button></span></div></div>
    <h3>${t('Budget for the week (optional)')}</h3><div class="input"><span>$</span><input id="prepBudget" inputmode="numeric" placeholder="${esc(t('Budget in USD, like 80'))}" value="${esc(opts.budget)}" aria-label="${esc(t('Budget for the week (optional)'))}"></div>
    <div class="card">${n ? `<div class="toggle">${t('Use my fridge scan ({n} items)', { n })}<button class="sw ${opts.fridge ? 'on' : ''}" id="prepFridge" aria-label="${esc(t('Use my fridge scan ({n} items)', { n }))}"></button></div>` : `<div class="fine" style="margin:0">${t('No fridge scan yet. Snap it first to use what you have.')}</div>`}
    ${dietOn() && dietLine() ? `<div class="fine">${t('🥗 Cooking for: {d} · ', { d: esc(dietLine()) })}<a href="#settings" style="color:var(--coral);font-weight:700">${t('Edit')}</a></div>` : ''}</div>
    <button class="btn primary" id="prepGo">${t('Build my week')}</button>`;
  }
  const slotT = s => t(s);
  function mealCard(m, i) {
    const per = m.est_cook_cost / Math.max(1, m.servings || 1);
    return `<details class="opt"><summary><span class="badge" style="background:var(--green-soft);font-size:18px">${esc(m.emoji)}</span><span class="nm">${esc(m.name)}<small>${esc(slotT(m.slot))} · ${t('{m} min · keeps {k} days', { m: m.minutes, k: m.keeps_days })}</small></span><span class="amt">~${$(m.est_cook_cost)}</span></summary>
      <div class="bd" style="padding-left:14px"><div class="chips">${m.ingredients.map(g => `<span class="chip ${g.have ? 'have' : ''}">${g.have ? '✓ ' : ''}${esc(g.item)}${g.qty ? ', ' + esc(g.qty) : ''}</span>`).join('')}</div>
      <ol class="steps">${m.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="row"><span>${t('Make it: ~{a} (~{b} per serving, estimate)', { a: $(m.est_cook_cost), b: $(per) })}</span></div>
      <div class="row"><span class="m">${t('Order it out: comparison coming soon')}</span><span class="pill c" style="margin:0">${t('Coming soon')}</span></div>
      <button class="btn ghost" data-pswap="${i}" style="padding:10px">${plan.swapping === i ? '<span class="spin"></span> ' + t('Swapping…') : '🔄 ' + t('Swap this meal')}</button></div></details>`;
  }
  function listText() { return t('SnapCravings meal prep grocery list') + '\n' + plan.grocery.map(g => '\n' + t(g.aisle) + ':\n' + g.items.map(i => '- ' + i.item + (i.qty ? ' (' + i.qty + ')' : '')).join('\n')).join('\n'); }
  function result() {
    const p = plan, n = p.meals.length, serv = p.meals.reduce((s, m) => s + (m.servings || 0), 0);
    let h = `<div class="kick">${t('Cook once, eat all week.')}</div><h2>${t('Your week, prepped')}</h2>
      <div class="stats"><div class="stat"><b>${n}</b><span>${t('Meals')}</span></div><div class="stat"><b>~${$(p.total)}</b><span>${t('Est. cook cost')}</span></div><div class="stat"><b>~${$(p.total / Math.max(1, serv))}</b><span>${t('Per serving')}</span></div></div>`;
    for (let d = 1; d <= p.genDays; d++) { const ms = p.meals.map((m, i) => [m, i]).filter(([m]) => m.day === d); h += `<h3>${t('Day {n}', { n: d })}</h3>` + ms.map(([m, i]) => mealCard(m, i)).join(''); }
    if (p.preview && p.days > p.genDays) h += `<div class="card" style="background:var(--dark);color:#fff;border:0;margin-top:14px"><div class="kick dk" style="margin:0 0 2px">Pro</div><b>${t('Unlock days {a} to {b}', { a: p.genDays + 1, b: p.days })}</b><p style="font-size:13px;opacity:.8;margin-top:3px">${t('Free preview shows the first {n} days. Go Pro for the full week, grocery list and prep guide for every day.', { n: p.genDays })}</p><a class="btn primary" href="#pro" style="padding:11px">${t('Go Pro')}</a></div>`;
    h += `<h3>${t('Grocery list for the week')} <span style="color:var(--coral)">${t('· minus what is in your fridge')}</span></h3><div class="card">${p.grocery.length ? p.grocery.map(g => `<div class="fine" style="margin:6px 0 2px;font-weight:700;color:var(--ink)">${esc(t(g.aisle))}</div>` + g.items.map(i => `<div class="row"><span>○ ${esc(i.item)}</span><span class="fine" style="margin:0">${esc(i.qty)}${i.meals > 1 ? ' · ' + t('used in {n} meals', { n: i.meals }) : ''}</span></div>`).join('')).join('') : `<b>${t('Nothing to buy. Pantry power!')}</b>`}
      <button class="btn ghost" id="prepCopy" style="padding:11px">📋 ${t('Copy list')}</button>${navigator.share ? `<button class="btn ghost" id="prepShare" style="padding:11px">📤 ${t('Share list')}</button>` : ''}<button class="btn insta" id="prepAdd" style="padding:12px">🛒 ${t('Add to my grocery list')}</button></div>`;
    if (p.prep.length) h += `<h3>${t('Prep day guide')} <span style="color:var(--coral)">${t('· batch it all at once')}</span></h3><ol class="steps">${p.prep.map(s => `<li><b>${esc(s.title)}</b> (${esc(s.minutes)} min). ${esc(s.detail)}</li>`).join('')}</ol>`;
    if (p.storage.length) h += `<h3>${t('Storage times')}</h3><div class="card">${p.storage.map(s => `<div class="row"><span>🧊 ${esc(s)}</span></div>`).join('')}</div>`;
    h += `<p class="fine">${t('Costs are AI estimates of grocery prices, not quotes. We never invent restaurant prices.')} ${t('AI-generated plan. Check doneness, storage and allergens yourself.')}</p><button class="btn ghost" id="prepNew">${t('New plan')}</button>`;
    return h;
  }
  function render() { const b = el('prepBody'); if (!b || busy) return; b.innerHTML = plan && plan.meals ? result() : form(); }
  async function build() {
    opts.budget = (el('prepBudget')?.value || '').replace(/[^\d.]/g, ''); save(); busy = true; el('prepBody').innerHTML = loading('Building your week…');
    try { const j = await api('plan', { days: opts.days, meals: opts.meals, servings: opts.servings, budget: +opts.budget || 0, fridge: opts.fridge ? fridge() : [], prefs: prefs(), lang: I18N.lang }, 150000); plan = j; LS.set('plan', plan); track('plan_built', 'prep', { days: j.genDays, n: j.meals.length }); busy = false; render(); }
    catch (e) { busy = false; el('prepBody').innerHTML = `<p class="sub">${esc(e.message)}</p>${e.paywall ? `<a class="btn primary" href="#pro">${t('Go Pro')}</a>` : ''}<button class="btn ghost" id="prepRetry">${t('Tap Retry')}</button>`; }
  }
  async function swap(i) {
    const m = plan.meals[i]; if (!m || plan.swapping != null) return; plan.swapping = i; render();
    try { const j = await api('plan', { swap: { day: m.day, slot: m.slot }, avoid: plan.meals.map(x => x.name), days: plan.days, meals: opts.meals, servings: plan.servings, fridge: opts.fridge ? fridge() : [], prefs: prefs(), lang: I18N.lang }, 60000);
      plan.meals[i] = j.meal; plan.grocery = regroup(); plan.total = Math.round(plan.meals.reduce((s, x) => s + (x.est_cook_cost || 0), 0) * 100) / 100; toast(t('Swapped! Grocery list updated.')); }
    catch (e) { toast(e.message); }
    plan.swapping = null; LS.set('plan', plan); render(); const d = document.querySelectorAll('#prepBody details')[i]; if (d) d.open = true;
  }
  // Client copy of the server grocery merge (for swaps): same rules, simpler matching.
  const AIS = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery & Grains', 'Pantry', 'Canned & Jarred', 'Frozen', 'Spices', 'Other'];
  function regroup() {
    const fr = (opts.fridge ? fridge() : []).map(s => s.toLowerCase()); const map = new Map();
    for (const m of plan.meals) for (const g of m.ingredients) { const k = g.item.toLowerCase().trim().replace(/s$/, ''); if (g.have || /^(salt|pepper|water|oil|cooking oil|sal|pimienta|agua|aceite)$/.test(k) || fr.some(f => f.replace(/s$/, '') === k)) continue;
      const e = map.get(k) || { item: g.item, aisle: g.aisle, qty: [], meals: 0 }; if (g.qty && !e.qty.includes(g.qty)) e.qty.push(g.qty); e.meals++; map.set(k, e); }
    return AIS.map(a => ({ aisle: a, items: [...map.values()].filter(x => x.aisle === a).map(x => ({ item: x.item, qty: x.qty.join(' + '), meals: x.meals })) })).filter(g => g.items.length);
  }
  document.addEventListener('click', e => {
    const x = e.target; if (!x.closest || !x.closest('#prep')) return;
    const po = x.closest('[data-po]'); if (po) { opts[po.dataset.po] = po.dataset.po === 'days' ? +po.dataset.v : po.dataset.v; opts.budget = el('prepBudget')?.value || opts.budget; save(); return render(); }
    const sv = x.closest('[data-psv]'); if (sv) { opts.servings = Math.min(8, Math.max(1, opts.servings + +sv.dataset.psv)); opts.budget = el('prepBudget')?.value || opts.budget; save(); return render(); }
    if (x.closest('#prepFridge')) { opts.fridge = !opts.fridge; opts.budget = el('prepBudget')?.value || opts.budget; save(); return render(); }
    if (x.closest('#prepGo') || x.closest('#prepRetry')) return build();
    if (x.closest('#prepNew')) { plan = null; LS.set('plan', null); return render(); }
    const sw = x.closest('[data-pswap]'); if (sw) { e.preventDefault(); return swap(+sw.dataset.pswap); }
    if (x.closest('#prepCopy')) { (navigator.clipboard ? navigator.clipboard.writeText(listText()) : Promise.reject()).then(() => toast(t('Copied! Paste it anywhere.'))).catch(() => prompt('', listText())); return; }
    if (x.closest('#prepShare')) { navigator.share({ title: t('Grocery list for the week'), text: listText() }).catch(() => {}); return; }
    if (x.closest('#prepAdd')) { let n = 0; plan.grocery.forEach(g => g.items.forEach(i => { addToList(i.item + (i.qty ? ', ' + i.qty : ''), 'miss', 0, t('Meal prep'), true); n++; })); LS.set('glist', glist); toast(t('Added {n} items to your grocery list.', { n })); }
  });
  window.renderPrep = render; I18N.applyStatic(document.querySelector('.phone'));
  if (location.hash === '#prep') render();
})();
