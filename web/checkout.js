// Checkout screenshot reader (Crave it): the user uploads a screenshot of THEIR OWN cart/checkout; /api/checkout reads the totals.
// No login to or scraping of any delivery app. Strings live in web/ship-i18n.js. Uses app.js helpers (api, shrink, esc, t, el, toast, loading, LS, unlimited, subCfg, track).
(function () {
  const merge = l => { const src = (globalThis.SHIP_I18N || {})[l], d = l === 'es' ? I18N.ES : I18N.D[l]; if (src && d) for (const k in src) if (!Object.prototype.hasOwnProperty.call(d, k)) d[k] = src[k]; };
  Object.keys(globalThis.SHIP_I18N || {}).forEach(merge);
  const load0 = I18N.load; I18N.load = (l, cb) => load0(l, () => { merge(l); cb(); });
  const S = { busy: false, err: null, paywall: false, order: null, photo: null };
  { const o0 = LS.get('chkLast', null); if (o0 && Date.now() - (o0.at || 0) < 864e5) S.order = o0; }
  const M = window.SC_MONEY;
  const mk = (id, cap) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.id = id; i.className = 'offscreen'; i.tabIndex = -1; i.setAttribute('aria-hidden', 'true'); document.body.appendChild(i); i.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) go(f); }); return i; };
  const lib = mk('chkLib');
  const usedToday = () => LS.get('chkScans', []).filter(x => Date.now() - x < 864e5).length;
  const cur = o => (o && o.currency) || M.cur(scCountry());
  const money = (n, o) => M.fmt(n, cur(o), I18N.lang);
  async function go(file) {
    let img; try { img = await shrink(file); } catch { return toast(t('That photo could not be read. Try another!')); }
    S.busy = true; S.err = null; S.paywall = false; render(); const t0 = Date.now();
    try {
      const j = await api('checkout', { image: img, lang: I18N.lang }, 50000);
      S.order = j.order; LS.set('chkLast', { ...j.order, at: Date.now() });
      if (!unlimited()) { const a = LS.get('chkScans', []).filter(x => Date.now() - x < 864e5); a.push(Date.now()); LS.set('chkScans', a); }
      track('checkout_read', 'crave', { ms: Date.now() - t0, model: j.model });
    } catch (e) { S.err = e.message; S.paywall = !!e.paywall; }
    S.busy = false; render();
  }
  function row(label, v, o, minus) { return v > 0 ? `<div class="row"><span class="m">${esc(t(label))}</span><span>${minus ? '−' : ''}${esc(money(v, o))}</span></div>` : ''; }
  function body() {
    const free = !unlimited(), left = Math.max(0, 3 - usedToday());
    const pick = `<button class="btn ghost" data-chk-pick style="padding:11px">${t('🖼 Pick a screenshot')}</button>`;
    if (S.busy) return loading('Reading your checkout…');
    if (S.paywall) return `<h3 style="margin-top:0">${t('Free checkout reads used today')}</h3><p class="sub" style="font-size:12px">${esc(S.err)} ${t('Pro gets unlimited checkout reads.')}</p><a class="btn primary" href="#pro">${subCfg.enabled ? t("Go Unlimited — let's get cooking!") : t('Go Pro')}</a>`;
    const intro = `<b style="font-size:13px">${t("📸 Have a checkout screen? Fees? We see 'em.")}</b><p class="sub" style="font-size:12px;margin-top:3px">${t("Upload a screenshot of your own cart or checkout and we'll read the real total. We never log in to or scrape delivery apps.")}</p>`;
    const o = S.order; const fine = `<p class="fine" style="margin:6px 0 0">${t("We read it once and don't keep it.")}${free ? ' ' + t('{n} of 3 free checkout reads left today', { n: left }) : ''}</p>`;
    if (S.err) return `${intro}<p class="sub" style="color:var(--coral)">${esc(S.err)}</p>${pick}${fine}`;
    if (!o) return `${intro}${pick}${fine}`;
    const L = o.lines;
    return `<b style="font-size:13px">${t('Your order, line by line')}${o.app ? ' · ' + esc(o.app) : ''}</b>${o.item ? `<p class="sub" style="font-size:12px;margin:2px 0 6px">${esc(o.item)}</p>` : ''}
      <div class="bd" style="padding:0">${row('Food', L.food, o)}${row('Delivery fee', L.delivery, o)}${row('Service fee', L.service, o)}${row('Small-order fee', L.small_order, o)}${row('Tax', L.tax, o)}${row('Tip', L.tip, o)}${row('Discounts', L.discount, o, true)}
      <div class="row"><b>${t('Total you pay')}</b><b>${esc(money(L.total, o))}</b></div></div>
      ${o.extrasPct != null && o.extrasPct > 0 ? `<p class="fine" style="margin:6px 0 0"><b>${t('Fees, tax and tip add {p}% on top of the food.', { p: o.extrasPct })}</b></p>` : ''}${o.mismatch ? `<p class="fine" style="margin:4px 0 0">⚠ ${t("Totals don't add up. Check them against your screenshot.")}</p>` : ''}
      ${o.item ? `<a class="btn primary" href="#crave" data-crave="${esc(o.item)}" style="padding:11px;margin-top:8px">${t('Compare with cooking →')}</a>` : ''}${pick}${fine}`;
  }
  function render() { const b = el('chkBody'); if (b) b.innerHTML = body(); }
  document.addEventListener('click', e => { const x = e.target.closest('[data-chk-pick]'); if (x) lib.click(); });
  // Compare screen hook: when the craving matches the last screenshot, say what the user paid vs the home cost (same currency only).
  window.scOrderLine = c => {
    const o = LS.get('chkLast', null); if (!o || !c || !o.item || Date.now() - (o.at || 0) > 36e5) return '';
    const a = String(c.craving || '').toLowerCase(), b = o.item.toLowerCase(); if (!a || !(a.includes(b) || b.includes(a))) return '';
    const cu = c.cur || 'USD'; if (o.currency && o.currency !== cu) return '';
    const cook = +c.est_cook_cost || 0, paid = o.lines.total, save = Math.round((paid - cook) * 100) / 100; if (!(cook > 0) || save <= 0) return '';
    return `<p class="fine" style="margin:6px 0 0"><b>📸 ${t('You paid about {o} for this order. Cooking it costs about {c}, so you would save about {s} (estimate).', { o: M.fmt(paid, cu, I18N.lang), c: M.fmt(cook, cu, I18N.lang), s: M.fmt(save, cu, I18N.lang) })}</b></p>`;
  };
  window.renderCheckout = render; render();
})();
