// Holiday planner (#hplan): works any time. Lists the country's upcoming holidays (web/holiday.js upcoming()); pick one and plan it now.
// Holiday MODE (theme) still only turns on about a week before. Optional in-app reminder: a nudge card on home when the window opens.
// Guests + meal time (+ diet from settings, optional fridge scan)
// -> /api/holiday-plan (streamed): menu, shopping list scaled to the guests, cooking timeline counted back from the meal. Free = menu + 3 steps.
// Uses app.js globals (esc, el, toast, loading, LS, prefs, state, sub, DEV, addToList, glist, HOLI, holInfo, track). Own strings: HP_I18N below.
(function () {
  const L = window.HP_I18N || {};
  const T = (s, v) => { let o = (L[I18N.lang] || {})[s] || ((window.FEAT_I18N || {})[I18N.lang] || {})[s] || s; if (v) for (const k in v) o = o.split('{' + k + '}').join(v[k]); return o; };
  const opts = Object.assign({ guests: LS.get('household', 0) || 8, time: '18:00', fridge: true }, LS.get('hpOpts', {})); window.HP_OPTS = opts;
  const S = window.SC_HOLIDAY; let pickId = LS.get('hpPick', null), listMode = false;
  const ups = () => S.upcoming(new Date(), HOLI.country, 10);
  const reminders = () => LS.get('hpRemind', []);
  const dateOf = d => { try { return new Intl.DateTimeFormat(I18N.lang, { month: 'long', day: 'numeric' }).format(d); } catch { return d.toDateString(); } };
  // The holiday being planned: the one the user picked (if it is still upcoming for their country), else the active one.
  function cur() { const u = ups(); if (pickId && u.some(x => x.id === pickId)) { const i = S.info(pickId, I18N.lang); i.when = u.find(x => x.id === pickId); return i; } const a = holInfo(); if (a) a.when = u.find(x => x.id === a.id); return a || null; }
  const badge = () => typeof window.dietBadge === 'function' ? window.dietBadge() : '';
  let plan = LS.get('hplan', null), busy = false;
  const fridge = () => (state.ingredients || []).filter(i => !i.conflict).map(i => i.name);
  const COURSE = { Main: 'Mains', Side: 'Sides', Dessert: 'Dessert', Drink: 'Drinks' };
  const TIMES = [['13:00', 'Lunch (1 PM)'], ['15:00', 'Afternoon (3 PM)'], ['18:00', 'Dinner (6 PM)']];
  function form(h) {
    const n = fridge().length;
    return `<a href="#hplan" data-hpchange="1" class="fine" style="display:inline-block;color:var(--coral);font-weight:700;text-decoration:none;margin:0 0 6px">‹ ${T('All holidays')}</a><div class="kick">${h.emoji} ${esc(h.name)}${h.when ? ' · ' + esc(dateOf(h.when.day)) : ''}</div>${badge()}<h2>${T('Plan the whole {h} meal', { h: esc(h.name) })}</h2><p class="sub">${T('Menu, shopping list and cooking timeline for your guests.')}</p>
    <h3>${T('Guests')}</h3><div class="card"><div class="row" style="padding:0"><b>${T('Guests')}</b><span class="qty"><button data-hpg="-1" aria-label="${T('Less')}">−</button>${opts.guests}<button data-hpg="1" aria-label="${T('More')}">+</button></span></div></div>
    <h3>${T('Meal time')}</h3><div class="seg">${TIMES.map(([v, l]) => `<button data-hpt="${v}" class="${opts.time === v ? 'on' : ''}">${esc(T(l))}</button>`).join('')}</div>
    <div class="card">${n ? `<div class="toggle">${T('Use my fridge scan ({n} items)', { n })}<button class="sw ${opts.fridge ? 'on' : ''}" id="hpFridge" aria-label="${esc(T('Use my fridge scan ({n} items)', { n }))}"></button></div>` : `<div class="fine" style="margin:0">${T('No fridge scan yet. Snap it first to use what you have.')}</div>`}
    ${typeof dietOn === 'function' && dietOn() && dietLine() ? `<div class="fine">${t('🥗 Cooking for: {d} · ', { d: esc(dietLine()) })}<a href="#settings" style="color:var(--coral);font-weight:700">${t('Edit')}</a></div>` : ''}</div>
    <button class="btn primary" id="hpGo">${h.emoji} ${T('Plan my {h} menu', { h: esc(h.name) })}</button>`;
  }
  const whenLabel = s => s.when || (s.before_min >= 1440 ? Math.round(s.before_min / 1440) + 'd' : s.before_min >= 60 ? 'T-' + Math.round(s.before_min / 60) + 'h' : 'T-' + s.before_min + 'm');
  function result(h) {
    const p = plan; let x = `<a href="#hplan" data-hpchange="1" class="fine" style="display:inline-block;color:var(--coral);font-weight:700;text-decoration:none;margin:0 0 6px">‹ ${T('All holidays')}</a><div class="kick">${h.emoji} ${esc(h.name)} · ${T('{n} guests', { n: p.guests })}</div>${badge()}<h2>${T('Your {h} menu', { h: esc(h.name) })}</h2>`;
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
  function picker() {
    const u = ups(), rem = reminders(), a = holInfo();
    return `<div class="kick">📋 ${T('Holiday planner')}</div><h2>${T('Plan a holiday early')}</h2><p class="sub">${T('Pick a holiday and plan the menu, shopping list and timeline now. Holiday mode turns on about a week before.')}</p>${badge()}
      ${u.length ? u.map(x => { const i = S.info(x.id, I18N.lang), on = rem.includes(x.id); return `<div class="card" style="display:flex;align-items:center;gap:10px"><div style="font-size:28px">${i.emoji}</div><div style="flex:1;min-width:0"><b>${esc(i.name)}</b><div class="fine" style="margin:2px 0 0">${esc(dateOf(x.day))}${a && a.id === x.id ? ' · ' + T('Holiday mode is on') : ''}</div>
        <button class="chip" data-hpr="${x.id}" aria-pressed="${on}" style="cursor:pointer;font-family:var(--font);margin-top:6px;${on ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${on ? '🔔 ' + T('Reminder on') : '🔕 ' + T('Remind me')}</button></div>
        <button class="chip" data-hpp="${x.id}" style="cursor:pointer;font-family:var(--font);background:var(--coral);color:#fff;border:0;white-space:nowrap">${T('Plan now')} ›</button></div>`; }).join('') : `<p class="sub">${T('No upcoming holidays found for your country.')}</p>`}
      <p class="fine">${T("Reminders show up here in the app when the holiday is about a week away. We don't send notifications.")}</p>`;
  }
  function render() { const b = el('hplanBody'); if (!b) return; const tt = document.querySelector('#hplan .topbar .t'); if (tt) tt.textContent = T('Holiday planner'); const h = cur();
    if (!h || listMode) { b.innerHTML = picker(); return; }
    if (plan && plan.holiday !== h.id) plan = null; b.innerHTML = plan && plan.menu ? result(h) : busy ? loading(T('Planning your feast…')) : form(h); }
  async function build() {
    const h = cur(); if (!h || busy) return; busy = true; plan = null; LS.set('hpOpts', opts); render();
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
  // Card on home: next to the holiday banner during a window, otherwise under Meal prep ("plan {next} early"). Plus the reminder nudge.
  window.hplanCard = function () {
    const h = holInfo(), ban = document.getElementById('holBanner'), prep = document.querySelector('#home a.card[href="#prep"]'); let c = document.getElementById('hplanCard');
    const nx = ups()[0], ni = nx && S.info(nx.id, I18N.lang);
    if (!(h && ban) && !(ni && prep)) { if (c) c.style.display = 'none'; return; }
    if (!c) { c = document.createElement('a'); c.id = 'hplanCard'; c.className = 'card'; c.href = '#hplan'; }
    if (h && ban) { if (c.previousElementSibling !== ban) ban.after(c); c.style.cssText = 'display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);margin:-4px 0 12px'; }
    else { if (c.previousElementSibling !== prep) prep.after(c); c.style.cssText = 'display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink)'; }
    c.innerHTML = `<div style="font-size:22px">📋</div><div style="flex:1;font-size:13px"><b>${T('Holiday planner')}</b><br><span class="sub" style="font-size:12px">${h ? T('Menu, shopping list and timeline for {h}', { h: esc(h.name) }) : T('Plan {h} early · {d}', { h: esc(ni.name), d: esc(dateOf(nx.day)) })}</span></div><span>›</span>`;
    nudge();
  };
  // In-app reminder: when a reminded holiday's window is open, show a nudge card at the top of home (once per holiday per year, until dismissed or opened).
  function nudge() {
    let n = document.getElementById('hpNudge'); const h = holInfo(), key = h && h.id + ':' + new Date().getFullYear(), done = LS.get('hpNudged', {});
    if (!h || !reminders().includes(h.id) || done[key]) { if (n) n.remove(); return; }
    const kick = document.querySelector('#home .kick'); if (!kick) return;
    if (!n) { n = document.createElement('div'); n.id = 'hpNudge'; n.className = 'card'; n.setAttribute('role', 'status'); } const top = document.getElementById('holBanner') || kick; if (n.nextElementSibling !== top) top.before(n);
    n.style.cssText = 'display:flex;align-items:center;gap:10px;background:var(--dark);color:#fff;border:0;margin:0 0 12px';
    n.innerHTML = `<div style="font-size:22px">🔔</div><a href="#hplan" data-hpnudge="go" style="flex:1;font-size:13px;color:#fff;text-decoration:none"><b>${T('Your {h} planner is open!', { h: esc(h.name) })}</b><br><span style="font-size:12px;opacity:.85">${T('You asked us to remind you. Plan the menu now.')}</span></a><button data-hpnudge="x" aria-label="${T('Dismiss')}" style="background:none;border:0;color:#fff;font-size:20px;cursor:pointer">×</button>`;
  }
  document.addEventListener('click', e => { const x = e.target.closest && e.target.closest('[data-hpnudge]'); if (!x) return; const h = holInfo(); if (!h) return;
    const d = LS.get('hpNudged', {}); d[h.id + ':' + new Date().getFullYear()] = 1; LS.set('hpNudged', d); if (x.dataset.hpnudge === 'go') { pickId = h.id; LS.set('hpPick', h.id); } document.getElementById('hpNudge')?.remove(); });
  document.addEventListener('click', e => {
    const x = e.target; if (!x.closest || !x.closest('#hplan')) return;
    const g = x.closest('[data-hpg]'); if (g) { opts.guests = Math.min(30, Math.max(1, opts.guests + +g.dataset.hpg)); LS.set('hpOpts', opts); return render(); }
    const tm = x.closest('[data-hpt]'); if (tm) { opts.time = tm.dataset.hpt; LS.set('hpOpts', opts); return render(); }
    if (x.closest('#hpFridge')) { opts.fridge = !opts.fridge; LS.set('hpOpts', opts); return render(); }
    const pp = x.closest('[data-hpp]'); if (pp) { pickId = pp.dataset.hpp; listMode = false; LS.set('hpPick', pickId); plan = plan && plan.holiday === pickId ? plan : null; el('hplan').scrollTop = 0; return render(); }
    const pr = x.closest('[data-hpr]'); if (pr) { const id = pr.dataset.hpr, r = reminders(), on = !r.includes(id); LS.set('hpRemind', on ? [...r, id] : r.filter(z => z !== id)); const u = ups().find(z => z.id === id);
      if (on) toast(u && u.open ? T('Reminder set. The planner is open now!') : T("Reminder set. We'll nudge you here about a week before.")); render(); return window.hplanCard(); }
    if (x.closest('[data-hpchange]')) { e.preventDefault(); pickId = null; LS.set('hpPick', null); listMode = true; return render(); }
    if (x.closest('#hpGo')) return build();
    if (x.closest('#hpNew')) { plan = null; LS.set('hplan', null); return render(); }
    if (x.closest('#hpAdd')) { let n = 0; plan.shopping.forEach(gr => gr.items.forEach(i => { addToList(i.item + (i.qty ? ', ' + i.qty : ''), 'miss', 0, T('Holiday planner'), true); n++; })); LS.set('glist', glist); toast(T('Added {n} items to your grocery list.', { n })); }
  });
  window.renderHplan = render; window.HP_T = T;
  setTimeout(() => window.hplanCard(), 0);
  if (location.hash === '#hplan') render();
})();
