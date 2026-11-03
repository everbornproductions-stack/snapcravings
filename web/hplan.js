// Holiday planner (#hplan): shows only during a holiday window (web/holiday.js). Guests + meal time (+ diet from settings, optional fridge scan)
// -> /api/holiday-plan (streamed): menu, shopping list scaled to the guests, cooking timeline counted back from the meal. Free = menu + 3 steps.
// Uses app.js globals (esc, el, toast, loading, LS, prefs, state, sub, DEV, addToList, glist, HOLI, holInfo, track). Own strings: HP_I18N below.
(function () {
  const L = window.HP_I18N || {};
  const T = (s, v) => { let o = (L[I18N.lang] || {})[s] || s; if (v) for (const k in v) o = o.split('{' + k + '}').join(v[k]); return o; };
  const opts = Object.assign({ guests: 8, time: '18:00', fridge: true }, LS.get('hpOpts', {}));
  let plan = LS.get('hplan', null), busy = false;
  const fridge = () => (state.ingredients || []).filter(i => !i.conflict).map(i => i.name);
  const COURSE = { Main: 'Mains', Side: 'Sides', Dessert: 'Dessert', Drink: 'Drinks' };
  const TIMES = [['13:00', 'Lunch (1 PM)'], ['15:00', 'Afternoon (3 PM)'], ['18:00', 'Dinner (6 PM)']];
  function form(h) {
    const n = fridge().length;
    return `<div class="kick">${h.emoji} ${esc(h.name)}</div><h2>${T('Plan the whole {h} meal', { h: esc(h.name) })}</h2><p class="sub">${T('Menu, shopping list and cooking timeline for your guests.')}</p>
    <h3>${T('Guests')}</h3><div class="card"><div class="row" style="padding:0"><b>${T('Guests')}</b><span class="qty"><button data-hpg="-1" aria-label="${T('Less')}">−</button>${opts.guests}<button data-hpg="1" aria-label="${T('More')}">+</button></span></div></div>
    <h3>${T('Meal time')}</h3><div class="seg">${TIMES.map(([v, l]) => `<button data-hpt="${v}" class="${opts.time === v ? 'on' : ''}">${esc(T(l))}</button>`).join('')}</div>
    <div class="card">${n ? `<div class="toggle">${T('Use my fridge scan ({n} items)', { n })}<button class="sw ${opts.fridge ? 'on' : ''}" id="hpFridge" aria-label="${esc(T('Use my fridge scan ({n} items)', { n }))}"></button></div>` : `<div class="fine" style="margin:0">${T('No fridge scan yet. Snap it first to use what you have.')}</div>`}
    ${typeof dietOn === 'function' && dietOn() && dietLine() ? `<div class="fine">${t('🥗 Cooking for: {d} · ', { d: esc(dietLine()) })}<a href="#settings" style="color:var(--coral);font-weight:700">${t('Edit')}</a></div>` : ''}</div>
    <button class="btn primary" id="hpGo">${h.emoji} ${T('Plan my {h} menu', { h: esc(h.name) })}</button>`;
  }
  const whenLabel = s => s.when || (s.before_min >= 1440 ? Math.round(s.before_min / 1440) + 'd' : s.before_min >= 60 ? 'T-' + Math.round(s.before_min / 60) + 'h' : 'T-' + s.before_min + 'm');
  function result(h) {
    const p = plan; let x = `<div class="kick">${h.emoji} ${esc(h.name)} · ${T('{n} guests', { n: p.guests })}</div><h2>${T('Your {h} menu', { h: esc(h.name) })}</h2>`;
    for (const c of ['Main', 'Side', 'Dessert', 'Drink']) { const ds = (p.menu || []).filter(d => d.course === c); if (!ds.length) continue;
      x += `<h3>${T(COURSE[c])}</h3>` + ds.map(d => `<details class="opt"><summary><span class="badge" style="background:var(--coral-soft);font-size:18px">${esc(d.emoji)}</span><span class="nm">${esc(d.name)}<small>${T('{m} min · serves {n}', { m: d.minutes, n: d.serves })}</small></span></summary>
        <div class="bd" style="padding-left:14px"><div class="chips">${d.ingredients.map(g => `<span class="chip ${g.have ? 'have' : ''}">${g.have ? '✓ ' : ''}${esc(g.item)}${g.qty ? ', ' + esc(g.qty) : ''}</span>`).join('')}</div>${d.note ? `<p class="fine">💡 ${esc(d.note)}</p>` : ''}</div></details>`).join(''); }
    if (busy) return x + `<div class="card"><span class="spin"></span> ${T('Writing your cooking timeline…')}</div>`;
    x += `<h3 id="hpTimeline">${T('Cooking timeline')} <span style="color:var(--coral)">${T('· counts back from {t}', { t: esc(TIMES.find(z => z[0] === p.time)?.[1] ? T(TIMES.find(z => z[0] === p.time)[1]) : p.time) })}</span></h3>
      <ol class="steps">${(p.timeline || []).map(s => `<li><span><b>${esc(whenLabel(s))}</b> · ${esc(s.task)}${s.dish && s.dish !== 'All' ? ` <span style="color:var(--muted)">(${esc(s.dish)})</span>` : ''}</span></li>`).join('')}</ol>`;
    if (p.preview) x += `<div class="card" style="background:var(--dark);color:#fff;border:0;margin-top:14px"><div class="kick dk" style="margin:0 0 2px">Pro</div><b>${T('{n} more timeline steps and the shopping list for {g} guests', { n: p.locked, g: p.guests })}</b><p style="font-size:13px;opacity:.8;margin-top:3px">${T('Free preview shows the menu and the first steps. Go Pro for the full timeline and shopping list.')}</p><a class="btn primary" href="#pro" style="margin-top:10px">${t('Go Pro')}</a></div>`;
    else if (p.shopping?.length) x += `<h3>${T('Shopping list for {n} guests', { n: p.guests })}</h3><div class="card">${p.shopping.map(g => `<div class="fine" style="margin:6px 0 2px;font-weight:700;color:var(--ink)">${esc(t(g.aisle))}</div>${g.items.map(i => `<div class="row"><span>${esc(i.item)}</span><span class="m">${esc(i.qty || '')}</span></div>`).join('')}`).join('')}
      <button class="btn insta" id="hpAdd" style="padding:11px">🛒 ${T('Add to my grocery list')}</button></div>`;
    return x + `<p class="fine">${T('AI-generated plan. Check doneness, food safety and allergens yourself.')}</p><button class="btn ghost" id="hpNew">${T('New plan')}</button>`;
  }
  function render() { const b = el('hplanBody'); if (!b) return; const tt = document.querySelector('#hplan .topbar .t'); if (tt) tt.textContent = T('Holiday planner'); const h = holInfo(); if (!h) { b.innerHTML = `<p class="sub">${T('The holiday planner opens about a week before each holiday.')}</p>`; return; }
    if (plan && plan.holiday !== h.id) plan = null; b.innerHTML = plan && plan.menu ? result(h) : busy ? loading(T('Planning your feast…')) : form(h); }
  async function build() {
    const h = holInfo(); if (!h || busy) return; busy = true; plan = null; LS.set('hpOpts', opts); render();
    const body = { holiday: h.id, country: HOLI.country, guests: opts.guests, time: opts.time, fridge: opts.fridge ? fridge() : [], prefs: prefs(), lang: I18N.lang, stream: true };
    try {
      const r = await fetch('/api/holiday-plan', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', 'x-sc-lang': I18N.lang, 'x-sc-token': sub.token || '', 'x-sc-dev': DEV }, body: JSON.stringify(body) });
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || t('The recipe brain hiccuped. Tap Retry!')); }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', done = null;
      for (;;) { const { value, done: end } = await rd.read(); if (end) break; buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; const o = JSON.parse(line);
          if (o.done) done = o; else if (o.menu) { plan = { holiday: h.id, guests: opts.guests, time: opts.time, menu: o.menu }; render(); } } }
      if (!done || done.error) throw new Error(done?.error || t('The recipe brain hiccuped. Tap Retry!'));
      busy = false; plan = done; LS.set('hplan', plan); track('recipes_shown', 'hplan'); render();
    } catch (e) { busy = false; plan = null; el('hplanBody').innerHTML = `<p class="sub">${esc(t(e.message))}</p><button class="btn ghost" id="hpGo">${t('Tap Retry')}</button>`; }
  }
  // Card on home next to the holiday banner (only during a window).
  window.hplanCard = function () {
    const h = holInfo(), ban = document.getElementById('holBanner'); let c = document.getElementById('hplanCard');
    if (!h || !ban) { if (c) c.style.display = 'none'; return; }
    if (!c) { c = document.createElement('a'); c.id = 'hplanCard'; c.className = 'card'; c.href = '#hplan'; c.style.cssText = 'display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);margin:-4px 0 12px'; ban.after(c); }
    c.style.display = 'flex'; c.innerHTML = `<div style="font-size:22px">📋</div><div style="flex:1;font-size:13px"><b>${T('Holiday planner')}</b><br><span class="sub" style="font-size:12px">${T('Menu, shopping list and timeline for {h}', { h: esc(h.name) })}</span></div><span>›</span>`;
  };
  document.addEventListener('click', e => {
    const x = e.target; if (!x.closest || !x.closest('#hplan')) return;
    const g = x.closest('[data-hpg]'); if (g) { opts.guests = Math.min(30, Math.max(2, opts.guests + +g.dataset.hpg)); LS.set('hpOpts', opts); return render(); }
    const tm = x.closest('[data-hpt]'); if (tm) { opts.time = tm.dataset.hpt; LS.set('hpOpts', opts); return render(); }
    if (x.closest('#hpFridge')) { opts.fridge = !opts.fridge; LS.set('hpOpts', opts); return render(); }
    if (x.closest('#hpGo')) return build();
    if (x.closest('#hpNew')) { plan = null; LS.set('hplan', null); return render(); }
    if (x.closest('#hpAdd')) { let n = 0; plan.shopping.forEach(gr => gr.items.forEach(i => { addToList(i.item + (i.qty ? ', ' + i.qty : ''), 'miss', 0, T('Holiday planner'), true); n++; })); LS.set('glist', glist); toast(T('Added {n} items to your grocery list.', { n })); }
  });
  window.renderHplan = render; window.HP_T = T;
  setTimeout(() => window.hplanCard(), 0);
  if (location.hash === '#hplan') render();
})();
