// Library (top-rated community recipes + seasonal collections), recipe thumbs up/down (Supabase via /api/library), My family recipes (/api/adapt).
(function () {
  Object.assign(I18N.ES, {
    'SnapCravings Library': 'Biblioteca SnapCravings', 'Top-rated recipes and seasonal collections.': 'Recetas mejor calificadas y colecciones de temporada.',
    'My family recipes': 'Mis recetas de familia', 'Save your own recipes and adapt them to your diet.': 'Guarda tus propias recetas y adáptalas a tu dieta.',
    'Rate this recipe': 'Califica esta receta', 'Thanks! Your rating helps the Library.': '¡Gracias! Tu calificación ayuda a la Biblioteca.', 'Rating cleared.': 'Calificación quitada.',
    'Loved recipes from the SnapCravings community.': 'Recetas favoritas de la comunidad SnapCravings.', 'Collections': 'Colecciones', 'This season': 'De temporada', 'Top rated': 'Mejor calificadas',
    'Search recipes': 'Buscar recetas', 'Quick (15 min)': 'Rápidas (15 min)', 'High protein (30g+)': 'Alta proteína (30g+)', 'Under 500 kcal': 'Menos de 500 kcal', 'Easy': 'Fácil',
    'Filtered for your diet: {n} hidden.': 'Filtrado para tu dieta: {n} ocultas.', 'No rated recipes match yet. Rate recipes with 👍 to grow the Library!': 'Aún no hay recetas calificadas que coincidan. ¡Califica recetas con 👍 para hacer crecer la Biblioteca!',
    'Loading…': 'Cargando…', 'Back to Library': 'Volver a la Biblioteca', '{n} 👍': '{n} 👍',
    'Paste your recipe or snap a photo of the card. We tidy it up, save it here and can adapt it to your diet.': 'Pega tu receta o tómale foto a la tarjeta. La ordenamos, la guardamos aquí y podemos adaptarla a tu dieta.',
    'Paste your recipe here (name, ingredients, steps)': 'Pega tu receta aquí (nombre, ingredientes, pasos)', '📸 Photo of the recipe': '📸 Foto de la receta', 'Photo added.': 'Foto agregada.',
    'Save my recipe': 'Guardar mi receta', 'Save and adapt to my diet': 'Guardar y adaptar a mi dieta', 'Reading your recipe…': 'Leyendo tu receta…', 'Saved to your family recipes!': '¡Guardada en tus recetas de familia!',
    'Your saved recipes': 'Tus recetas guardadas', 'Nothing saved yet.': 'Aún no hay nada guardado.', 'Adapted: {c}': 'Adaptada: {c}', 'Remove': 'Quitar', 'Removed.': 'Quitada.',
    'Saved on this device only.': 'Guardadas solo en este dispositivo.', 'Paste your recipe or add a photo first!': '¡Pega tu receta o agrega una foto primero!', 'AI-adapted. Check allergens yourself.': 'Adaptada con IA. Revisa los alérgenos tú mismo.'
  });
  const POST = async (path, body, ms = 90000) => { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), ms); try { const r = await fetch('/api/' + path, { method: 'POST', signal: ac.signal, headers: { 'content-type': 'application/json', 'x-sc-lang': I18N.lang, 'x-sc-country': scCountry(), 'x-sc-token': sub.token || '', 'x-sc-dev': DEV }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(t(j.error || 'Something went sideways. Try again!')); return j; } finally { clearTimeout(tm); } };
  const card = (r, i, src, extra = '') => `<a class="card recipe" href="#recipe" data-ext="${src}:${i}"><div class="thumb" style="background:${THUMBS[i % 4]}">${esc(r.emoji || '🍳')}</div><div style="flex:1"><b>${esc(r.name)}</b><div class="meta">${t('{n} min · {s} servings', { n: esc(r.minutes), s: esc(r.servings) })}${r.kcal ? ' · ' + esc(r.kcal) + ' kcal' : ''}</div>${extra}</div></a>`;
  // ---- thumbs on the recipe screen
  const votes = LS.get('votes', {}); const vkey = r => (r.name + '|' + (r.ingredients || []).map(i => i.item).join('|')).toLowerCase();
  function thumbs() {
    const r = state.recipe; if (!r || el('rateRow')) return; const v = votes[vkey(r)] || 0; const b = el('recipeBody'); const h2 = b.querySelector('h2'); if (!h2) return;
    const btn = (n, ic) => `<button class="chip" data-vote="${n}" aria-pressed="${v === n}" style="cursor:pointer;font-family:var(--font);${v === n ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${ic}</button>`;
    h2.insertAdjacentHTML('afterend', `<div class="chips" id="rateRow" style="align-items:center"><span class="fine" style="margin:0">${t('Rate this recipe')}</span>${btn(1, '👍')}${btn(-1, '👎')}</div>`);
  }
  const _rr = RENDER.recipe; RENDER.recipe = () => { _rr(); thumbs(); };
  async function vote(n) { const r = state.recipe; if (!r) return; const k = vkey(r); const nv = votes[k] === n ? 0 : n; votes[k] = nv; LS.set('votes', votes); el('rateRow')?.remove(); thumbs(); track('rate', 'recipe', { v: nv });
    try { await POST('library', { action: 'rate', recipe: r, vote: nv, lang: I18N.lang }, 15000); toast(nv ? t('Thanks! Your rating helps the Library.') : t('Rating cleared.')); } catch (e) { toast(e.message); } }
  // ---- Library + collections
  const L = { q: '', f: '', list: null, cols: null, col: null, colData: {}, busy: false, hidden: 0 };
  async function loadLib() { try { const j = await POST('library', { action: 'list', q: L.q, quick: L.f === 'quick', level: L.f === 'easy' ? 'Easy' : '', maxKcal: L.f === 'light' ? 500 : 0, minProtein: L.f === 'protein' ? 30 : 0, prefs: prefs(), lang: I18N.lang }, 20000); L.list = j.recipes; L.hidden = j.hidden; if (!L.q && !L.f) LS.set('libc.' + I18N.lang, { sig: JSON.stringify(prefs()), recipes: (j.recipes || []).slice(0, 30), hidden: j.hidden }); } catch (e) { if (!L.list || !L.list.length) { L.list = []; L.err = e.message; } } renderLib(); }
  async function loadCols() { try { L.cols = (await POST('collections', { lang: I18N.lang }, 15000)).collections; LS.set('colc.' + I18N.lang, L.cols); } catch { L.cols = L.cols || []; } renderLib(); }
  async function openCol(k) { L.col = k; renderLib(); if (L.colData[k + I18N.lang]) return; try { L.colData[k + I18N.lang] = await POST('collections', { key: k, prefs: prefs(), lang: I18N.lang }, 90000); } catch (e) { L.colData[k + I18N.lang] = { error: e.message }; } renderLib(); }
  setTimeout(() => { if (L.list === null && !L.loading && !(navigator.connection && navigator.connection.saveData)) renderLib(); }, 5000); /* warm the Library while you look at home */
  function renderLib() {
    const b = el('libBody'); if (!b) return; if (L.list === null && !L.loading) { L.loading = true; /* show the last list instantly, refresh behind it */ const c = !L.q && !L.f && LS.get('libc.' + I18N.lang, null); if (c && c.sig === JSON.stringify(prefs()) && (c.recipes || []).length) { L.list = c.recipes; L.hidden = c.hidden; } L.cols = L.cols || LS.get('colc.' + I18N.lang, null); loadLib(); loadCols(); }
    const F = [['', 'Top rated'], ['quick', 'Quick (15 min)'], ['protein', 'High protein (30g+)'], ['light', 'Under 500 kcal'], ['easy', 'Easy']];
    const cd = L.col && L.colData[L.col + I18N.lang];
    b.innerHTML = `<div class="kick">${t('Crave smarter, not harder.')}</div><h2>${t('SnapCravings Library')}</h2><p class="sub">${t('Loved recipes from the SnapCravings community.')}</p>
      ${dietOn() && dietLine() ? `<p class="fine" style="margin-top:2px">${t('🥗 Cooking for: {d} · ', { d: esc(dietLine()) })}<a href="#settings" style="color:var(--coral);font-weight:700">${t('Edit')}</a></p>` : ''}
      <h3>${t('This season')}</h3><div class="chips">${(L.cols || []).map(c => `<button class="chip" data-col="${esc(c.key)}" style="cursor:pointer;font-family:var(--font);${L.col === c.key ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${esc(c.emoji)} ${esc(c.name)}</button>`).join('') || `<span class="fine">${t('Loading…')}</span>`}</div>
      ${L.col ? (cd ? (cd.error ? `<p class="sub">${esc(cd.error)}</p>` : cd.recipes.map((r, i) => card(r, i, 'col')).join('')) : loading('Loading…')) : ''}
      <h3>${t('Top rated')}</h3><div class="input"><span>🔍</span><input id="libQ" placeholder="${esc(t('Search recipes'))}" value="${esc(L.q)}" aria-label="${esc(t('Search recipes'))}"></div>
      <div class="chips">${F.map(([k, l]) => `<button class="chip" data-libf="${k}" style="cursor:pointer;font-family:var(--font);${L.f === k ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${esc(t(l))}</button>`).join('')}</div>
      ${L.list === null ? loading('Loading…') : L.list.length ? L.list.map((r, i) => card(r, i, 'lib', `<span class="pill g">${t('{n} 👍', { n: r.up })}</span>`)).join('') : `<div class="card"><p class="sub" style="margin:0">${esc(L.err || t('No rated recipes match yet. Rate recipes with 👍 to grow the Library!'))}</p></div>`}
      ${L.hidden ? `<p class="fine">${t('Filtered for your diet: {n} hidden.', { n: L.hidden })}</p>` : ''}<p class="fine">${t('AI-generated recipe. Check doneness and allergens yourself.')}</p>`;
  }
  // ---- Family recipes (saved on this device)
  let fam = LS.get('family', []), famImg = null, famBusy = false;
  function renderFamily() {
    const b = el('familyBody'); if (!b || famBusy) return;
    b.innerHTML = `<div class="kick">${t('Saved for later!')}</div><h2>${t('My family recipes')}</h2><p class="sub">${t('Paste your recipe or snap a photo of the card. We tidy it up, save it here and can adapt it to your diet.')}</p>
      <div class="card"><textarea id="famText" rows="6" placeholder="${esc(t('Paste your recipe here (name, ingredients, steps)'))}" aria-label="${esc(t('Paste your recipe here (name, ingredients, steps)'))}" style="width:100%;border:0;outline:0;resize:vertical;font:500 14px var(--font);background:transparent;color:var(--ink)"></textarea></div>
      <button class="btn ghost" id="famPhoto" style="padding:11px">${famImg ? '✓ ' + t('Photo added.') : t('📸 Photo of the recipe')}</button><input type="file" id="famFile" accept="image/*" class="offscreen" tabindex="-1" aria-hidden="true">
      <button class="btn primary" id="famGo">${dietOn() ? t('Save and adapt to my diet') : t('Save my recipe')}</button>
      <h3>${t('Your saved recipes')}</h3>${fam.length ? fam.map((r, i) => card(r, i, 'fam', `${r.changes?.length ? `<span class="pill c">${t('Adapted: {c}', { c: esc(r.changes.slice(0, 2).join('; ')) })}</span>` : ''}<button class="chip" data-famrm="${i}" style="cursor:pointer;margin-top:4px">${t('Remove')}</button>`)).join('') : `<p class="fine">${t('Nothing saved yet.')}</p>`}
      <p class="fine">${t('Saved on this device only.')} ${t('AI-adapted. Check allergens yourself.')}</p>`;
  }
  async function famSave() {
    const text = (el('famText')?.value || '').trim(); if (!text && !famImg) return toast(t('Paste your recipe or add a photo first!'));
    famBusy = true; el('familyBody').innerHTML = loading('Reading your recipe…');
    try { const j = await POST('adapt', { text, image: famImg, prefs: prefs(), lang: I18N.lang }, 120000); fam.unshift({ ...j.recipe, changes: j.changes, savedAt: Date.now() }); LS.set('family', fam); famImg = null; toast(t('Saved to your family recipes!')); track('family_saved', 'family', { adapted: (j.changes || []).length }); }
    catch (e) { toast(e.message, 6000); }
    famBusy = false; renderFamily();
  }
  document.addEventListener('click', e => {
    const x = e.target; if (!x.closest) return;
    const v = x.closest('[data-vote]'); if (v) return vote(+v.dataset.vote);
    const ex = x.closest('[data-ext]'); if (ex) { const [src, i] = ex.dataset.ext.split(':'); state.ext = src === 'lib' ? L.list[+i] : src === 'col' ? L.colData[L.col + I18N.lang].recipes[+i] : fam[+i]; state.extFrom = src === 'fam' ? 'family' : 'lib'; state.recipe = state.ext; state.from = state.extFrom; if (x.closest('[data-famrm]')) { e.preventDefault(); fam.splice(+i, 1); LS.set('family', fam); toast(t('Removed.')); return renderFamily(); } return; }
    const c = x.closest('[data-col]'); if (c) return openCol(c.dataset.col === L.col ? null : c.dataset.col);
    const f = x.closest('[data-libf]'); if (f) { L.f = f.dataset.libf; L.list = null; L.loading = true; renderLib(); return loadLib(); }
    if (x.closest('#famPhoto')) return el('famFile').click();
    if (x.closest('#famGo')) return famSave();
  });
  document.addEventListener('change', async e => { if (e.target.id !== 'famFile' || !e.target.files[0]) return; try { famImg = await shrink(e.target.files[0]); } catch { famImg = null; } const txt = el('famText')?.value; renderFamily(); if (txt) el('famText').value = txt; });
  document.addEventListener('keydown', e => { if (e.target.id === 'libQ' && e.key === 'Enter') { L.q = e.target.value.trim(); L.list = null; L.loading = true; renderLib(); loadLib(); } });
  window.renderLib = renderLib; window.renderFamily = renderFamily; I18N.applyStatic(document.querySelector('.phone'));
  if (location.hash === '#lib') renderLib(); if (location.hash === '#family') renderFamily(); if (location.hash === '#recipe') RENDER.recipe();
})();
