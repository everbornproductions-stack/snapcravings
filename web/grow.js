// Growth bits: Play review card (Android app only), Share this recipe, Get it on Google Play banner (Android web, behind SC_CONFIG.PLAY_LIVE).
(function () {
  const C = window.SC_CONFIG || {};
  Object.assign(I18N.ES, {
    'Enjoying SnapCravings?': '¿Te gusta SnapCravings?', 'A quick rating on Google Play helps other cooks find us.': 'Una calificación rápida en Google Play ayuda a otros cocineros a encontrarnos.',
    'Rate us on Google Play': 'Califícanos en Google Play', 'Not now': 'Ahora no', '📤 Share this recipe': '📤 Compartir esta receta',
    'Recipe copied! Paste it anywhere.': '¡Receta copiada! Pégala donde quieras.', 'Made with SnapCravings: snap your fridge, get recipes for your cravings. Try it free:': 'Hecha con SnapCravings: tómale foto a tu refri y recibe recetas para tus antojos. Pruébala gratis:',
    'Ingredients': 'Ingredientes', 'Get SnapCravings on Google Play': 'Consigue SnapCravings en Google Play', 'The Android app: faster snaps, one tap away.': 'La app de Android: fotos más rápidas, a un toque.', 'Get it': 'Obtener'
  });
  // Android app (TWA) detection: Play's referrer on first launch, or Play Billing present. Remembered on the device.
  const isTWA = () => { try { if (document.referrer.startsWith('android-app://app.snapcravings.twa')) LS.set('twa', 1); } catch {} return !!LS.get('twa', 0) || (typeof inPlay === 'function' && inPlay()); };
  isTWA(); window.isTWA = isTWA;
  try { const ic = document.getElementById('installCard'); if (ic && isTWA()) { ic.hidden = true; ic.style.display = 'none'; } } catch {}
  const DAY = 864e5;
  function reviewCard(trigger) {
    if (!isTWA() || el('reviewCard') || reviewCard.shown) return;
    if (Date.now() - (LS.get('reviewAskedAt', 0) || 0) < 30 * DAY) return;
    reviewCard.shown = true; LS.set('reviewAskedAt', Date.now()); track('review_card', trigger);
    setTimeout(() => {
      const s = document.querySelector('.screen.active'); if (!s) return;
      s.insertAdjacentHTML('beforeend', `<div class="card" id="reviewCard" style="margin-top:14px;display:flex;align-items:center;gap:10px"><div style="font-size:22px">⭐</div><div style="flex:1;font-size:13px"><b>${t('Enjoying SnapCravings?')}</b><br><span class="sub" style="font-size:12px">${t('A quick rating on Google Play helps other cooks find us.')}</span>
        <div style="display:flex;gap:8px;margin-top:8px"><a class="chip" id="reviewGo" href="${C.PLAY_MARKET}" style="background:var(--coral);color:#fff;border:0">${t('Rate us on Google Play')}</a><button class="chip" id="reviewNo" style="cursor:pointer;font-family:var(--font)">${t('Not now')}</button></div></div></div>`);
      el('reviewCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 1500);
  }
  window.reviewCard = reviewCard;
  const _tf = toggleFav; toggleFav = function (r) { const was = r && isFav(r); _tf(r); if (r && !was && isFav(r)) reviewCard('fav'); };
  // Share this recipe
  async function share() {
    const r = state.recipe; if (!r) return;
    const text = `${r.emoji || '🍳'} ${r.name}\n${t('Ingredients')}: ${(r.ingredients || []).map(g => g.item).join(', ')}\n\n${t('Made with SnapCravings: snap your fridge, get recipes for your cravings. Try it free:')} ${C.SHARE_URL}`;
    track('share_recipe', 'recipe');
    if (navigator.share) { try { await navigator.share({ title: r.name, text }); } catch {} return; }
    try { await navigator.clipboard.writeText(text); toast(t('Recipe copied! Paste it anywhere.')); } catch { toast(text, 8000); }
  }
  const _rr = RENDER.recipe; RENDER.recipe = () => { _rr(); const b = el('recipeBody'); if (state.recipe && b && !el('shareRecipe')) { const c = b.querySelector('[data-craveit]'); const h = `<button class="btn ghost" id="shareRecipe">${t('📤 Share this recipe')}</button>`; c ? c.insertAdjacentHTML('afterend', h) : b.insertAdjacentHTML('beforeend', h); } };
  // Get it on Google Play banner: Android browsers only, not inside the app, only when PLAY_LIVE.
  function playBanner() {
    if (!C.PLAY_LIVE || isTWA() || !/Android/i.test(navigator.userAgent) || LS.get('playBannerNo', 0) || el('playBanner')) return;
    const h = el('home'); const k = h && h.querySelector('.kick'); if (!k) return;
    k.insertAdjacentHTML('beforebegin', `<div class="card" id="playBanner" style="display:flex;align-items:center;gap:10px"><div style="font-size:22px">▶️</div><div style="flex:1;font-size:13px"><b>${t('Get SnapCravings on Google Play')}</b><br><span class="sub" style="font-size:12px">${t('The Android app: faster snaps, one tap away.')}</span></div><a class="chip" id="playGo" href="${C.PLAY_URL}" style="background:var(--coral);color:#fff;border:0">${t('Get it')}</a><button id="playNo" aria-label="Close" style="background:none;border:0;cursor:pointer;font-size:16px;color:var(--ink)">✕</button></div>`);
    track('play_banner', 'home');
  }
  playBanner();
  document.addEventListener('click', e => {
    const x = e.target; if (!x.closest) return;
    if (x.closest('[data-vote="1"]')) reviewCard('thumbs');
    if (x.closest('#shareRecipe')) return share();
    if (x.closest('#reviewGo')) { track('review_go', 'card'); setTimeout(() => el('reviewCard')?.remove(), 300); }
    if (x.closest('#reviewNo')) el('reviewCard')?.remove();
    if (x.closest('#playGo')) track('play_go', 'home');
    if (x.closest('#playNo')) { LS.set('playBannerNo', 1); el('playBanner')?.remove(); }
  });
  if (location.hash === '#recipe') RENDER.recipe();
})();
