// SnapCravings web app. All AI calls go to /api/* (Cloudflare Pages Function); no keys in the client.
// Money in the user's local currency (web/money.js). c = the currency a saved result was priced in (old saves: US$).
const curNow = () => window.SC_MONEY ? SC_MONEY.cur(scCountry()) : 'USD';
const $ = (n, c) => window.SC_MONEY ? SC_MONEY.fmt(n, c || curNow(), I18N.lang) : '$' + (Number(n) || 0).toFixed(2);
const r2 = n => Math.round(n * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = id => document.getElementById(id);
let sub = {};
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('sc.' + k)) ?? d; } catch { return d; } }, set: (k, v) => localStorage.setItem('sc.' + k, JSON.stringify(v)) };
const state = { photos: [], ingredients: LS.get('ingredients', []), low: LS.get('low', []), craving: 'Anything', recipes: LS.get('recipes', null), recipe: null, from: 'recipes', crave: LS.get('crave', null), busy: false };
let glist = LS.get('glist', []);
sub = LS.get('sub', {});
const DEV = LS.get('dev', null) || (() => { const d = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)); LS.set('dev', d); return d; })();
/* Usage events: anonymous, fire-and-forget (no cookies, no IP/email). Hashed server-side by /api/ev. */
const planNow = () => sub.code ? 'owner' : (sub.token && sub.active) ? 'paid' : 'free';
const IS_TEST = (() => { try { if (/[?&]test=1\b/.test(location.search)) localStorage.setItem('sc_test', '1'); return !!(localStorage.getItem('sc_test') || localStorage.getItem('sc.test') || navigator.webdriver); } catch { return !!navigator.webdriver; } })();
/* Where this device came from: captured once on the first visit (referrer domain + utm_*), sent with the first page_view only. */
function firstSource() {
  try {
    if (localStorage.getItem('sc.srcSent')) return null;
    localStorage.setItem('sc.srcSent', '1');
    const q = new URLSearchParams(location.search); let ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; if (ref === location.hostname) ref = ''; } catch {}
    return { ref, utm_source: q.get('utm_source') || '', utm_medium: q.get('utm_medium') || '', utm_campaign: q.get('utm_campaign') || '' };
  } catch { return null; }
}
function track(event, screen, meta) {
  try {
    if (localStorage.getItem('sc.noTrack')) return; // opt-out switch (no personal data is collected anyway)
    const o = { event, screen: screen || null, plan: planNow(), dev: DEV, meta: meta || {} };
    if (IS_TEST) o.test = 1;
    if (event === 'page_view') { const src = firstSource(); if (src) o.src = src; }
    const body = JSON.stringify(o);
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/ev', new Blob([body], { type: 'application/json' })))) fetch('/api/ev', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
  } catch {}
}
async function redeem() { const c = (el('proCode')?.value || '').trim(); if (!c) return toast(t('Pop in your code first!')); try { const j = await subCall('redeem', { code: c }); sub = { email: j.email, token: j.token, active: true, checked: Date.now(), code: true }; LS.set('sub', sub); renderLeft(); renderPro(); toast(t("Code unlocked! You're Unlimited! 🎉")); } catch (e) { toast(e.message); } }
let subCfg = { enabled: false, price: 3.99 };
const unlimited = () => !!sub.token && sub.active;
async function subCall(path, body) { const r = await fetch('/api/sub/' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sc-lang': I18N.lang }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(t(j.error || "Hmm, that didn't work. Try again!")); return j; }
const tokLeft = () => { try { return JSON.parse(atob(String(sub.token || '').split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).x - Date.now(); } catch { return 0; } };
const looksSubbed = () => !!(sub && (sub.active || sub.token || sub.play || sub.code) && (sub.email || sub.token));
async function recheckSub() { try { if (sub.play && inPlay()) { await playRestore(true); return unlimited(); } if (sub.code && !sub.email) return false; return await checkSub(sub.email || '', true); } catch { return false; } }
async function checkSub(email, quiet) {
  try { const sid = sub.sid && (!email || !sub.email || sub.email === email) ? sub.sid : ''; const j = await subCall('status', { email, token: sub.token, sid }); sub = j.active ? { email: j.email || email, token: j.token, active: true, sid: sid || undefined, checked: Date.now() } : { email, sid: sid || undefined, active: false, checked: Date.now() }; LS.set('sub', sub); renderLeft(); renderPro(); if (!quiet) toast(j.active ? t("You're Unlimited! Let's get cooking! 🎉") : t("No active plan for that email yet.")); return j.active; }
  catch (e) { if (!quiet) toast(e.message); return false; }
}
function renderPro() {
  if (!el('proBody')) return;
  el('proPrice').textContent = 'US$' + Number(subCfg.price).toFixed(2); /* Stripe charges USD in every country, whatever the UI language */
  if (unlimited()) { el('proBody').innerHTML = `<div class="card" style="background:var(--green-soft);border-color:#BFE3CC;text-align:center;margin-top:12px"><b style="color:#1F6B42">${t("You're Unlimited! 🎉")}</b><div class="fine" style="color:#1F6B42">${t("{email} · unlimited photo scans. Let's get cooking!", { email: esc(sub.email) })}</div></div><a class="btn primary" href="#scan">${t('📸 Snap it')}</a><p class="fine" style="text-align:center">${sub.code ? t('Your food preferences live in') : t('Manage or cancel anytime in')} <a href="#settings" style="color:var(--coral);font-weight:700">${t('Settings')}</a>.</p>`; return; }
  if (sub.email && !el('proEmail').value) el('proEmail').value = sub.email;
  if (!subCfg.enabled) { el('proGo').textContent = t('Unlimited · coming soon!'); el('proGo').style.opacity = '.6'; el('proGo').setAttribute('aria-disabled', 'true'); el('proEmail').parentNode.style.display = 'none'; el('proRestore').style.display = 'none'; }
  else { if (!el('proGo').querySelector('.spin')) el('proGo').textContent = t("Go Unlimited — let's get cooking!"); el('proGo').style.opacity = ''; el('proGo').removeAttribute('aria-disabled'); el('proEmail').parentNode.style.display = ''; el('proRestore').style.display = ''; }
  if (inPlay()) { if (el('proYrSub')) el('proYrSub').textContent = t('About 16% less than 12 monthly payments'); el('proEmail').parentNode.style.display = 'none'; el('proRestore').style.display = ''; el('proGo').style.opacity = ''; el('proGo').removeAttribute('aria-disabled'); if (!el('proGo').querySelector('.spin')) el('proGo').textContent = t("Go Unlimited — let's get cooking!"); if (!el('proYearly')) { const y = document.createElement('button'); y.className = 'btn ghost'; y.id = 'proYearly'; el('proGo').after(y); } if (!el('proYearly').querySelector('.spin')) el('proYearly').textContent = t('Or go yearly: $39.99/year'); el('proFine').textContent = t('${price}/mo or $39.99/year. Secure checkout by Google Play. Cancel anytime in Google Play.', { price: Number(subCfg.price).toFixed(2) });
    /* Real localized Play prices when getDetails answered; the text above stays as the fallback. */
    const pm = playPrices[PLAY_SKU], py = playPrices[PLAY_YEARLY]; if (pm) el('proPrice').textContent = pm; if (pm && py) { if (!el('proYearly').querySelector('.spin')) el('proYearly').textContent = t('Or go yearly: {y}/year', { y: py }); el('proFine').textContent = t('{m}/mo or {y}/year. Secure checkout by Google Play. Cancel anytime in Google Play.', { m: pm, y: py }); if (el('proYrSub')) el('proYrSub').textContent = ''; }
    return; }
  if (el('proYrSub')) el('proYrSub').textContent = subCfg.linkYearly ? t('US$39.99/yr (about US$3.33/mo), 16% less than 12 months at US$3.99') : t('Coming soon · about US$3.33/mo');
  if (yearlyPicked()) { el('proFine').textContent = t('US$39.99 billed once a year. Secure checkout by Stripe. We use your email only to find your plan.'); return; }
  el('proFine').textContent = subCfg.enabled ? t('US${price}/mo founders price, first 100 members, locked in. Secure checkout by Stripe. We use your email only to find your plan.', { price: Number(subCfg.price).toFixed(2) }) : t('Unlimited is coming soon. Free scans and codes still work!');
}
// Google Play Billing (Android TWA only): Digital Goods API + PaymentRequest. The website keeps Stripe.
const PLAY_SKU = 'snapcravings_pro_monthly', PLAY_YEARLY = 'snapcravings_pro_yearly', PLAY_SKUS = [PLAY_SKU, PLAY_YEARLY], PLAY_METHOD = 'https://play.google.com/billing';
let playDG = null, playPrices = {}; const inPlay = () => !!playDG;
const fmtPlay = v => { try { return new Intl.NumberFormat(I18N.lang || undefined, { style: 'currency', currency: v.currency }).format(+v.value); } catch { return v ? v.currency + ' ' + v.value : ''; } };
async function playPricesLoad() { try { const d = await playDG.getDetails(PLAY_SKUS); (d || []).forEach(x => { if (x && x.itemId && x.price && x.price.value) playPrices[x.itemId] = fmtPlay(x.price); }); if (Object.keys(playPrices).length) renderPro(); } catch {} }
async function playInit() {
  if (!('getDigitalGoodsService' in window)) return;
  try { playDG = await window.getDigitalGoodsService(PLAY_METHOD); } catch { playDG = null; return; }
  try { const ic = document.getElementById('installCard'); if (playDG && ic) { ic.hidden = true; ic.style.display = 'none'; } } catch {}
  renderPro(); playPricesLoad(); if (!sub.code) playRestore(true);
}
async function playVerify(purchaseToken, quiet, productId = PLAY_SKU) {
  const j = await subCall('../play/verify', { purchaseToken, productId });
  if (j.active) { sub = { email: j.email || 'Google Play', token: j.token, active: true, play: productId, checked: Date.now() }; LS.set('sub', sub); renderLeft(); renderPro(); if (!quiet) toast(t("You're Unlimited! Let's get cooking! 🎉")); }
  return !!j.active;
}
async function playRestore(quiet) {
  try { const list = await playDG.listPurchases(); const p = (list || []).find(x => PLAY_SKUS.includes(x.itemId));
    if (p) return await playVerify(p.purchaseToken, quiet, p.itemId);
    if (sub.play) { sub = { active: false, checked: Date.now() }; LS.set('sub', sub); renderLeft(); renderPro(); }
    if (!quiet) toast(t('No active plan for that email yet.')); }
  catch (e) { if (!quiet) toast(e.message); }
  return false;
}
async function playBuy(sku = PLAY_SKU) {
  const btn = el(sku === PLAY_YEARLY ? 'proYearly' : 'proGo'); const old = btn.textContent; btn.innerHTML = '<span class="spin" style="border-top-color:#fff"></span> ' + t('Heading to checkout…');
  track('upgrade_click', 'play');
  try {
    const req = new PaymentRequest([{ supportedMethods: PLAY_METHOD, data: { sku } }], { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } });
    const res = await req.show(); const tok = res.details && res.details.purchaseToken;
    let ok = false; try { ok = await playVerify(tok, false, sku); } finally { await res.complete(ok ? 'success' : 'fail'); }
  } catch (e) { if (e && e.name !== 'AbortError') toast(e.message || t("Hmm, that didn't work. Try again!")); }
  btn.textContent = old; renderPro();
}
playInit();
const yearlyPicked = () => !(typeof inPlay === 'function' && inPlay()) && !!subCfg.linkYearly && !!document.querySelector('.plan.on[data-plan="yr"]');
async function goUnlimited() {
  if (inPlay()) return playBuy();
  if (!subCfg.enabled || !subCfg.link) return toast(t('Unlimited is coming soon!'));
  const email = el('proEmail').value.trim(); if (!email) return toast(t('Pop in your email first!'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast(t('Pop in a real email so we can find your plan later!'));
  el('proGo').innerHTML = '<span class="spin" style="border-top-color:#fff"></span> ' + t('Heading to checkout…');
  const cid = 'sc' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('');
  sub = { email: email.toLowerCase(), active: false, cid }; LS.set('sub', sub);
  track('upgrade_click', 'pro');
  const link = yearlyPicked() ? subCfg.linkYearly : subCfg.link; track('plan_pick', 'pro', { plan: yearlyPicked() ? 'yr' : 'mo' });
  location.href = link + (link.includes('?') ? '&' : '?') + 'prefilled_email=' + encodeURIComponent(email) + '&client_reference_id=' + cid;
}
fetch('/api/sub/config').then(r => r.json()).then(c => { subCfg = c; renderPro();
  if (!c.enabled || sub.code || sub.play) return;
  const sid = (/[?&]sid=(cs_[A-Za-z0-9_]+)/.exec(location.search) || [])[1];
  if (/[?&]paid=1/.test(location.search) && (sid || sub.email)) { history.replaceState(null, '', '/#pro'); track('checkout_return', 'pro'); if (sid) { sub = { ...sub, sid }; LS.set('sub', sub); } let n = 0; const poll = async () => { if (await checkSub(sub.email || '', n < 10) || ++n > 11) return; setTimeout(poll, 3000); }; toast(t('Thanks! Checking your plan…')); poll(); }
  else if (!sub.email) return;
  else if (!sub.checked || Date.now() - sub.checked > 3 * 864e5 || (sub.token && tokLeft() < 7 * 864e5)) checkSub(sub.email, true); /* token under 7 days left: get a fresh one */
}).catch(() => {});
let favs = LS.get('favs', []);
const isFav = r => !!r && favs.some(f => f.name.toLowerCase() === r.name.toLowerCase());
function toggleFav(r) { if (!r) return; if (isFav(r)) { favs = favs.filter(f => f.name.toLowerCase() !== r.name.toLowerCase()); toast(t('Removed from favorites.')); } else { favs.unshift({ ...r, savedAt: Date.now() }); try { fetch('/api/trending', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sc-dev': DEV }, body: JSON.stringify({ made: r.name, lang: I18N.lang }) }).catch(() => {}); } catch {} toast(t('Saved to favorites! ❤️')); track('favorite', 'recipe'); } LS.set('favs', favs); renderFavCount(); }
const heart = (key, r) => `<button data-fav="${key}" aria-label="${isFav(r) ? t('Unsave') : t('Save')}" style="background:none;border:0;font-size:20px;cursor:pointer;color:var(--coral);padding:4px;flex-shrink:0">${isFav(r) ? '♥' : '♡'}</button>`;
function renderFavCount() { const n = favs.length; el('favCount').textContent = n ? t(n === 1 ? '{n} saved recipe. Pantry power!' : '{n} saved recipes. Pantry power!', { n }) : t('Tap ♡ on any recipe to save it'); }
function renderFavs() {
  el('favsBody').innerHTML = favs.length ? favs.map((r, i) => `<div class="card recipe"><a href="#recipe" data-rec="fav:${i}" style="display:flex;gap:12px;align-items:center;flex:1;color:inherit;text-decoration:none"><div class="thumb" style="background:${THUMBS[i % 4]}">${esc(r.emoji || '🍳')}</div><div style="flex:1"><b>${esc(r.name)}</b><div class="meta">${t('{n} min · {s} servings', { n: esc(r.minutes), s: esc(r.servings) })}</div>${(r.missing || []).length ? `<span class="pill c">${t('Missing {n}: {items}', { n: r.missing.length, items: esc(r.missing.map(m => m.item).join(', ')) })}</span>` : `<span class="pill g">${t('Pantry power! You have everything')}</span>`}</div></a>${heart('fav:' + i, r)}</div>`).join('')
    : `<div class="card" style="text-align:center;padding:22px"><div style="font-size:30px">♡</div><b>${t('No favorites yet')}</b><p class="sub" style="font-size:13px;margin-top:4px">${t('Tap ♡ on any recipe and it lands here.')}</p><a class="btn primary" href="#scan">${t('📸 Snap it')}</a></div>`;
  if (!favs.length && LS.get('dishFavs', []).length) el('favsBody').firstElementChild.remove(); /* only plates saved: no empty-state card */
  if (window.dishFavsHtml) el('favsBody').insertAdjacentHTML('beforeend', dishFavsHtml()); /* saved plates (web/dish.js) */
}
const CRAVINGS_BASE = ['Anything', 'Noodles', 'Something quick', 'Comfort food', 'Spicy'];
/* HOLIDAY MODE (web/holiday.js): ~7 days before a country's major holiday through the day itself. Accent colors,
   a header emoji, a small home banner and a 'Holiday foods' craving chip (craving 'holiday:<id>'). Dev: ?holiday=<id>&country=XX */
const HOLI = { cur: null, country: '' };
function holidayNow() {
  const S = window.SC_HOLIDAY; if (!S) return null; const q = new URLSearchParams(location.search);
  const qc = (q.get('country') || '').toUpperCase().slice(0, 2); let geo = ''; try { geo = sessionStorage.getItem('sc.geo') || ''; } catch {}
  HOLI.country = qc || geo || S.countryFromLocale((navigator.languages || [])[0] || navigator.language, I18N.lang);
  const force = (q.get('holiday') || '').toLowerCase(); if (force === 'off' || force === 'none') return null;
  return S.H[force] ? { id: force } : S.active(new Date(), HOLI.country);
}
const holInfo = () => HOLI.cur && window.SC_HOLIDAY.info(HOLI.cur.id, I18N.lang);
const cravLabel = c => { const h = window.SC_HOLIDAY; return h && h.isHoliday(c) ? (h.info(c.slice(8), I18N.lang).emoji + ' ' + h.info(c.slice(8), I18N.lang).name) : t(c); };
function applyHoliday() {
  HOLI.cur = holidayNow(); const h = holInfo(), r = document.documentElement.style, brand = document.querySelector('#home .brand b');
  const V = ['--bg', '--coral-soft', '--coral', '--h-acc2', '--dark', '--h-dark2', '--gold'];
  if (h) { h.pal.forEach((c, i) => r.setProperty(V[i], c)); r.setProperty('--line', h.pal[1]); r.setProperty('--muted', window.SC_HOLIDAY.MUTED); } else [...V, '--line', '--muted'].forEach(v => r.removeProperty(v));
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', h ? h.pal[0] : '#FBF6EF');
  document.documentElement.toggleAttribute('data-holiday', !!h); if (h) document.documentElement.dataset.holiday = h.id;
  let tag = document.getElementById('holEmoji'); if (brand && !tag) { tag = document.createElement('span'); tag.id = 'holEmoji'; tag.style.marginLeft = '6px'; brand.after(tag); }
  if (tag) tag.textContent = h ? h.emoji : '';
  let ban = document.getElementById('holBanner'); const kick = document.querySelector('#home .kick');
  if (h && !ban && kick) { ban = document.createElement('a'); ban.id = 'holBanner'; ban.className = 'card'; ban.href = '#scan'; ban.style.cssText = 'display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);background:var(--coral-soft);border-color:var(--coral);margin:0 0 12px'; kick.before(ban); }
  if (ban) { ban.hidden = !h; ban.style.display = h ? 'flex' : 'none'; if (h) ban.innerHTML = `<div style="font-size:22px">${h.emoji}</div><div style="flex:1;font-size:13px"><b>${esc(h.ui[1].replace('{h}', h.name))}</b><br><span class="sub" style="font-size:12px">${esc(h.ui[2].replace('{h}', h.name))}</span></div><span>›</span>`; }
  if (!h && window.SC_HOLIDAY?.isHoliday(state.craving)) state.craving = 'Anything';
  window.hplanCard?.(); // Holiday planner card (web/hplan.js)
}
// One short holiday animation (~4.5 s, pointer-events none, skipped for reduced motion). Once per session on home; ?holianim=1 replays.
function holidayAnim(force) {
  const h = holInfo(); if (!h || !h.anim || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const k = 'sc.holAnim.' + h.id; let seen = false; try { seen = sessionStorage.getItem(k); sessionStorage.setItem(k, '1'); } catch {}
  if (seen && !force && !/[?&]holianim=1/.test(location.search)) return;
  document.getElementById('holAnim')?.remove(); const box = document.createElement('div'); box.id = 'holAnim'; box.setAttribute('aria-hidden', 'true');
  const [kind, spr] = h.anim, parts = [...new Intl.Segmenter().segment(spr)].map(x => x.segment), R = (a, b) => a + Math.random() * (b - a);
  const add = (cls, html, style) => { const i = document.createElement('i'); i.className = cls; i.innerHTML = html; if (style) i.style.cssText = style; box.appendChild(i); };
  // Every holiday: the main character flies in, swoops toward the viewer (2.6x near the center with a wiggle/bounce), then flies out.
  const star = kind === 'fly' ? spr : kind === 'bats' ? '👻' : parts[0], inner = kind === 'walk' || kind === 'hop' ? 'hop' : 'wig';
  add('hsw hsw-' + kind, `<b class="${inner}">${star}</b>${kind === 'fly' ? '<s>✨✨</s>' : ''}`);
  if (kind === 'fireworks') for (let n = 0; n < 6; n++) add('fw', parts[1 + n % (parts.length - 1)], `left:${R(5, 70)}%;top:${R(6, 50)}%;animation-delay:${(n * .55).toFixed(2)}s`);
  else if (kind === 'bats') for (let n = 0; n < 3; n++) add('bat', '🦇', `top:${12 + n * 10}%;animation-delay:${n * .4}s`);
  else if (kind !== 'fly') for (let n = 0; n < 6; n++) add(kind === 'glow' ? 'glow' : 'float', parts[n % parts.length], `left:${R(4, 86)}%;animation-delay:${R(.3, 1.8).toFixed(2)}s`);
  document.querySelector('.phone').appendChild(box); setTimeout(() => box.remove(), 7500);
}
Object.defineProperty(window, 'CRAVINGS_LIST', { get: () => HOLI.cur ? ['holiday:' + HOLI.cur.id, ...CRAVINGS_BASE] : CRAVINGS_BASE });

const MAX_PHOTOS = 10;
const STEPS = [
  { area: 'fridge', kick: 'Your fridge has ideas!', h: 'Snap your fridge', d: 'Open it wide. Every shelf counts!' },
  { area: 'freezer', kick: 'Brrr, nice!', h: 'Now your freezer', d: 'Frozen treasure counts too.' },
  { area: 'pantry', kick: 'Pantry power!', h: 'Now your pantry', d: 'Cans, pasta, rice, sauces, oils. Show us the goods.' },
  { area: 'spices', kick: 'Spice it up!', h: 'Last one: your spices!', d: 'Spice rack, drawer or cabinet. Labels facing out if you can.' }
];
state.step = 0;
const GROUPS = ['Produce', 'Proteins', 'Dairy', 'Pantry', 'Spices & Seasonings'];

function toast(msg, ms = 3500) { const b = el('toast'); b.textContent = msg; b.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => b.style.display = 'none', ms); }
async function api(path, body, ms = 60000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  let r;
  try { r = await fetch('/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sc-lang': I18N.lang, 'x-sc-country': scCountry(), 'x-sc-token': sub.token || '', 'x-sc-scan': state.scanId || '', 'x-sc-dev': DEV }, body: JSON.stringify(path === 'scan' || path === 'recipes' || path === 'crave' ? { ...body, prefs: prefs(), lang: I18N.lang } : body), signal: ctl.signal }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? t('That took too long. Check your signal and tap Retry!') : t('Lost the connection for a sec. Tap Retry!')); }
  finally { clearTimeout(tm); }
  const j = await r.json().catch(() => ({ error: 'Something went sideways. Try again!' }));
  if (path === 'scan' && j.scanTicket) state.scanId = j.scanTicket;
  if (!r.ok) { const er = new Error(t(j.error || 'Something went sideways. Try again!')); er.paywall = !!j.paywall; throw er; }
  return j;
}
// Streamed recipes: the server sends one {recipe} line per finished recipe, then {done, recipes|error}. Old/plain JSON answers still work.
async function apiStream(path, body, onRecipe, ms = 65000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try {
    let r;
    try { r = await fetch('/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', 'x-sc-lang': I18N.lang, 'x-sc-country': scCountry(), 'x-sc-token': sub.token || '', 'x-sc-scan': state.scanId || '', 'x-sc-dev': DEV }, body: JSON.stringify({ ...body, prefs: prefs(), lang: I18N.lang, stream: true }), signal: ctl.signal }); }
    catch (e) { throw new Error(e.name === 'AbortError' ? t('That took too long. Check your signal and tap Retry!') : t('Lost the connection for a sec. Tap Retry!')); }
    if (!r.ok || !/ndjson/.test(r.headers.get('content-type') || '') || !r.body) {
      const j = await r.json().catch(() => ({ error: 'Something went sideways. Try again!' }));
      if (!r.ok || j.error) { const er = new Error(t(j.error || 'Something went sideways. Try again!')); er.paywall = !!j.paywall; throw er; }
      (j.recipes || []).forEach(x => onRecipe(x)); return j;
    }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', fin = null, n = 0;
    try {
      for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let k;
        while ((k = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, k); buf = buf.slice(k + 1); if (!line.trim()) continue; let j; try { j = JSON.parse(line); } catch { continue; }
          if (j.recipe) { n++; onRecipe(j.recipe); } if (j.done) fin = j; } }
    } catch (e) { if (!n) throw new Error(e.name === 'AbortError' ? t('That took too long. Check your signal and tap Retry!') : t('Lost the connection for a sec. Tap Retry!')); }
    if (fin && fin.error && !n) throw new Error(t(fin.error));
    if (!fin && !n) throw new Error(t('Something went sideways. Try again!'));
    return fin && !fin.error ? fin : { recipes: null };
  } finally { clearTimeout(tm); }
}
// One recipe job per section. Started speculatively right after a scan (and when the craving changes), then reused by
// "Let's get cooking" if nothing changed, so the recipes are often already there (or arriving) when the screen opens.
const recipeJobs = {};
const recipeIngs = () => state.ingredients.slice(0, 80).map(i => (i.cat === 'Spices & Seasonings' ? '[spice] ' : '') + i.name + (i.qty ? ' (' + i.qty + ')' : ''));
function recipeJob(section) {
  const ingredients = recipeIngs(), craving = state.craving, sig = JSON.stringify([ingredients, craving, section, prefs(), I18N.lang]);
  let j = recipeJobs[section]; if (j && j.sig === sig && !j.failed && Date.now() - j.t < 15 * 60000) return j;
  j = recipeJobs[section] = { sig, t: Date.now(), list: [], subs: new Set() };
  const push = r => { if (!r?.name) return; j.list.push(r); j.subs.forEach(f => f()); };
  j.p = (async () => { for (let a = 0; a < 2; a++) { try { const out = await apiStream('recipes', { ingredients, craving, section }, push); return out.recipes || j.list; } catch (e) { if (j.list.length) return j.list; if (a) { j.failed = true; throw e; } } } })();
  j.p.catch(() => {});
  return j;
}
function prefetchRecipes(delay = 0) { clearTimeout(prefetchRecipes.t); if (!state.ingredients.length) return; prefetchRecipes.t = setTimeout(() => { recipeJob('ready'); recipeJob('more'); }, delay); }
// Resize on device: max 1024px JPEG, quality stepped down until <= ~350 KB. Handles EXIF rotation and big camera files.
async function decode(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {} }
  return new Promise((res, rej) => { const img = new Image(); const url = URL.createObjectURL(file); img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); }; img.onerror = () => rej(new Error(t('That photo could not be read. Try another!'))); img.src = url; });
}
async function shrink(file) {
  const img = await decode(file); const w = img.width, h = img.height;
  const sc = Math.min(1, 1024 / Math.max(w, h)); const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); img.close?.();
  let q = 0.72, out = c.toDataURL('image/jpeg', q);
  while (out.length * 0.75 > 350000 && q > 0.35) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
  c.width = c.height = 0; return out;
}
const loading = (msg, opt) => window.scLoading ? scLoading(msg, t(msg), opt) : `<div class="card" style="text-align:center;padding:26px"><span class="spin"></span><div style="margin-top:10px;font-weight:700">${esc(t(msg))}</div></div>`;

/* MY DIET + SETTINGS */
const DIET_TAGS = ['Gluten-free', 'Dairy-free', 'Vegetarian', 'Vegan', 'Nut allergy', 'Shellfish allergy', 'Egg-free', 'Soy allergy', 'Keto/low-carb', 'Low-carb', 'Diabetic-friendly', 'Halal'];
const MOODS = ['Mexican', 'Asian', 'Italian', 'Southern', 'Comfort food', 'Mediterranean', 'Indian', 'Quick 15-min', 'High-protein', 'Budget', 'Kid-friendly'];
let diet = Object.assign({ tags: [], other: '', mood: '' }, LS.get('diet', {}));
const dietOn = () => !!(diet.tags.length || diet.other.trim() || diet.mood.trim());
const prefs = () => ({ tags: diet.tags, other: diet.other.trim(), mood: diet.mood.trim(), serves: LS.get('household', 0) || undefined }); /* serves = household size (web/feat.js) */
const dietLine = () => [...diet.tags.map(x => t(x)), diet.other.trim()].filter(Boolean).join(', ');
function renderDietCount() { if (el('dietCount')) el('dietCount').textContent = dietOn() ? (dietLine() || t('Mood: ') + diet.mood.trim()) : t('Gluten-free, vegan, allergies and more'); }
function saveDiet() { // changing the diet makes old recipes stale (they may not fit), so clear them
  LS.set('diet', diet); LS.set('dietSeen', true); renderDietCount();
  if (state.recipes || state.crave) { state.recipes = null; state.crave = null; LS.set('recipes', null); LS.set('crave', null); state.dietReset = true; }
}
const canCancel = () => unlimited() && !sub.code;
const planInner = () => `<div class="card"><b>${t("You're Unlimited! 🎉")}</b><div class="fine" style="margin-top:2px">${esc(sub.email)} · $${Number(subCfg.price).toFixed(2)}${t('/month')}</div>${sub.play ? `<button class="btn ghost" id="subCancel" style="padding:12px">${t('Cancel subscription')}</button><div class="fine">${t("Opens Google Play subscriptions. You keep Unlimited until the end of the period you've already paid for.")}</div>` : subCfg.portal ? `<button class="btn ghost" id="subCancel" style="padding:12px">${t('Cancel subscription')}</button><div class="fine">${t("Opens Stripe's secure page. Use the email you paid with. You keep Unlimited until the end of the period you've already paid for.")}</div>` : `<div class="fine">${t("To cancel, use the link in your Stripe receipt email. You keep Unlimited until the end of the period you've already paid for.")}</div>`}</div>`;
const planCard = () => canCancel() ? `<h3>${t('Your plan')}</h3><div id="planBox">${planInner()}</div>` : '';
function renderSettings() {
  const first = !!state.dietFirst, y = el('settings').scrollTop;
  const tag = t => { const on = diet.tags.includes(t); return `<button class="chip" data-dtag="${esc(t)}" aria-pressed="${on}" style="cursor:pointer;font-family:var(--font);${on ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${on ? '✓ ' : ''}${esc(I18N.t(t))}</button>`; };
  const moods = diet.mood.toLowerCase();
  el('settingsBody').innerHTML = `<div class="kick">${first ? t('Before we snap!') : t('Your kitchen, your rules!')}</div>
    <h2>${first ? t('Any food rules?') : t('My diet &amp; allergies')}</h2>
    <p class="sub">${first ? t("Totally optional. Pick your diet and allergies, and every recipe will fit. You can change it anytime from the ⚙️ on Home.") : t("Tap what applies. We'll keep every recipe and grocery list in line.")}</p>
    <h3>${t('My diet')}</h3>
    <div class="chips">${DIET_TAGS.filter(t=>!/allergy/i.test(t)).map(tag).join('')}</div>
    <h3>${t('My allergies')}</h3>
    <div class="chips">${DIET_TAGS.filter(t=>/allergy/i.test(t)).map(tag).join('')}</div>
    <p class="fine">${t('Allergies are treated as hard rules. Still, always double-check labels yourself.')}</p>
    <h3>${t("Other allergies or foods I don't eat")}</h3>
    <div class="input"><span>🚫</span><input id="dietOther" maxlength="200" autocomplete="off" placeholder="${t('Like soy, sesame, or cilantro')}" aria-label="${t('Other foods to skip')}" value="${esc(diet.other)}"></div>
    <h3>${t("Foods I'm in the mood for")} <span style="color:var(--muted);font-weight:600">${t('· optional')}</span></h3>
    <div class="input"><span>😋</span><input id="dietMood" maxlength="120" autocomplete="off" placeholder="${t('Like Mexican, Asian, comfort food')}" aria-label="${t("Foods I'm in the mood for")}" value="${esc(diet.mood)}"></div>
    <div class="chips">${MOODS.map(m0 => { const m = t(m0); const on = moods.includes(m.toLowerCase()); return `<button class="chip" data-dmood="${esc(m)}" style="cursor:pointer;font-family:var(--font);${on ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${esc(m)}</button>`; }).join('')}</div>
    ${first ? `<button class="btn primary" id="dietSnap">${t('Save &amp; snap it 📸')}</button><button class="btn ghost" id="dietSkip">${t('Skip for now')}</button>`
      : `<button class="btn primary" id="dietDone">${t("Done. Let's get cooking!")}</button>`}
    ${first ? '' : planCard()}
    <h3>${t('Language')} <span style="color:var(--muted);font-weight:600">· ${I18N.lang === 'en' ? 'Idioma · Langue · Sprache · भाषा' : 'Language'}</span></h3>
    <div class="chips">${I18N.LANGS.map(([k, n]) => { const on = I18N.lang === k; return `<button class="chip" data-lang="${k}" aria-pressed="${on}" style="cursor:pointer;font-family:var(--font);${on ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${on ? '✓ ' : ''}${n}</button>`; }).join('')}</div>`;
  el('settings').scrollTop = y;
}
function cancelSub() { if (sub.play) return void window.open('https://play.google.com/store/account/subscriptions?sku=' + (typeof sub.play === 'string' ? sub.play : PLAY_SKU) + '&package=app.snapcravings.twa', '_blank'); if (!subCfg.portal) return; window.open(subCfg.portal, '_blank', 'noopener'); }

/* SNAP */
function openSnap(lib) { el(lib ? 'snapLib' : 'snapCam').click(); }
async function onPhotos(files) {
  const room = MAX_PHOTOS - state.photos.length;
  if (room <= 0) return toast(t("That's {n} photos, the max. Hit Go!", { n: MAX_PHOTOS }));
  files = [...files].slice(0, room);
  if (!files.length) return;
  location.hash = '#scan';
  const area = (STEPS[state.step] || STEPS[3]).area;
  state.scanId = ''; for (const f of files) { try { state.photos.push({ src: await shrink(f), area }); } catch (e) { toast(t('One photo could not be read. Try another!')); } }
  state.ingredients = []; state.low = []; renderScan();
}
function renderPhotos() {
  el('scanPhotos').innerHTML = state.photos.length ? state.photos.map((p, i) => `<span style="position:relative;height:100%;flex-shrink:0"><img src="${p.src}" alt="${t('Your {area} photo', { area: t(p.area) })}"><span class="pill g" style="position:absolute;left:4px;bottom:4px;margin:0;text-transform:capitalize">${esc(t(p.area))}</span><button data-rmp="${i}" aria-label="${t('Remove photo')}" style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:0;background:rgba(30,27,24,.75);color:#fff;font-weight:800;cursor:pointer">×</button></span>`).join('') + (state.photos.length < MAX_PHOTOS ? `<span style="align-self:center;display:flex;flex-direction:column;gap:6px;flex-shrink:0"></span>` : '')
    : `<div style="margin:auto;text-align:center;font-size:44px">📸</div>`;
}
const BATCH = 2;
function mergeInv(lists) {
  const m = new Map();
  for (const it of lists.flat()) { const k = it.name.trim().toLowerCase().replace(/s$/, ''); const ex = m.get(k); if (!ex) m.set(k, { ...it }); else { ex.low = ex.low && it.low; if (!ex.qty && it.qty) ex.qty = it.qty; } }
  return [...m.values()];
}
async function scan() {
  if (!state.photos.length) return toast(t('Snap a photo first!'));
  if (state.busy) return; /* a second Go while a scan runs used to start a second race */
  state.busy = true; const n = state.photos.length; const run = state.scanRun = (state.scanRun || 0) + 1; /* state.scanId = the server's signed scan ticket (10 min); a Retry of the same photos reuses it, new photos clear it */
  const batches = []; for (let i = 0; i < n; i += BATCH) batches.push(state.photos.slice(i, i + BATCH));
  let done = 0; const prog = () => el('scanBody').innerHTML = loading(t(n === 1 ? 'Peeking at {n} photo… spices too! ({d}/{n})' : 'Peeking at {n} photos… spices too! ({d}/{n})', { n, d: Math.min(done * BATCH, n) }), { area: 'scan', exp: 6 + 5 * Math.ceil(n / BATCH), skel: 0 });
  prog();
  let rechecked = false; /* paywall for someone who looks subscribed: refresh the plan once, then retry */
  const one = async b => { for (let a = 0; a < 2; a++) { try { const j = await api('scan', { images: b.map(p => ({ data: p.src, area: p.area })) }, 60000); done++; prog(); return j.ingredients; } catch (e) { if (e.paywall && !rechecked && looksSubbed()) { rechecked = true; if (await recheckSub()) { a--; continue; } } if (a || e.paywall) throw e; } } };
  const dog = setTimeout(() => { if (state.scanRun === run && state.busy) { state.scanRun++; state.busy = false; scanFail(new Error(t('That took too long. Check your signal and tap Retry!')), n); } }, 150000); /* watchdog: never leave a spinner or a silent reset */
  try {
    const results = []; // two batches at a time
    results.push(await one(batches[0])); /* first batch alone: its ticket makes the other batches part of the same free scan */
    for (let i = 1; i < batches.length; i += 2) results.push(...await Promise.all(batches.slice(i, i + 2).map(one)));
    clearTimeout(dog); if (state.scanRun !== run) return; /* the watchdog already gave up on this run */
    const found = mergeInv(results.filter(Array.isArray));
    if (!found.length) throw new Error(t("We couldn't spot any food in those photos. Try a brighter, closer photo!")); /* a 200 with an empty list used to drop back to step 1 with no message */
    state.ingredients = found.map(i => ({ name: i.name, qty: i.qty || '', cat: i.category, low: !!i.low, bad: !!i.conflict }));
    state.low = state.ingredients.filter(i => i.low && !i.bad); // items that break your diet stay off the restock list // running-low items still count as "have" for cooking
    LS.set('ingredients', state.ingredients); LS.set('low', state.low);
    const wk = LS.get('scans', []).filter(t => Date.now() - t < 7 * 864e5); wk.push(Date.now()); LS.set('scans', wk); renderLeft();
    state.low.forEach(l => addToList(l.name, 'low', 0, null, true));
    track('scan', 'scan', { photos: n, items: state.ingredients.length });
    state.busy = false; renderScan(); prefetchRecipes();
  } catch (e) {
    clearTimeout(dog); if (state.scanRun !== run) return;
    state.busy = false; scanFail(e, n);
  }
}
function scanFail(e, n) {
  {
    if (e.paywall) { el('scanBody').innerHTML = `<div class="kick">${t('Hungry for more?')}</div><h2>${t('Free scans used up')}</h2><p class="sub">${esc(e.message)} ${t(n === 1 ? 'Your {n} photo is still here.' : 'Your {n} photos are still here.', { n })}</p><a class="btn primary" href="#pro">${subCfg.enabled ? t("Go Unlimited — let's get cooking!") : t('Go Unlimited (coming soon) · Have a code?')}</a>`; return; }
    el('scanBody').innerHTML = `<div class="kick">${t('Oops, kitchen hiccup!')}</div><h2>${t("We couldn't read your photos")}</h2><p class="sub">${esc(e.message)} ${t(n === 1 ? 'Your {n} photo is still here.' : 'Your {n} photos are still here.', { n })}</p><button class="btn primary" id="scanGo" style="font-size:20px;padding:20px">${t('Retry 🔄')}</button>`;
  }
}
function renderScan() {
  renderPhotos();
  const rs = el('scanRestart'); if (rs) rs.innerHTML = '';
  if (!state.ingredients.length) {
    const n = state.photos.length, st = STEPS[state.step];
    const dots = STEPS.map((x, i) => `<span style="flex:1;height:6px;border-radius:3px;background:${i < state.step ? 'var(--green)' : i === state.step ? 'var(--coral)' : 'var(--line)'}"></span>`).join('');
    const here = st ? state.photos.filter(p => p.area === st.area).length : 0;
    el('scanBody').innerHTML = `<div style="display:flex;gap:5px;margin:2px 0 6px">${dots}</div>
      ${st ? `<div class="fine" style="margin:0">${t('Step {a} of {b} · {n}/{m} photos', { a: state.step + 1, b: STEPS.length, n, m: MAX_PHOTOS })}</div>
      <div class="kick">${t(st.kick)}</div><h2>${t(st.h)}</h2><p class="sub">${t(st.d)}</p>
      <button class="btn primary" data-addphoto>📸 ${here ? t('Add another') : t('Snap it')}</button>
      <div style="display:flex;gap:8px"><button class="btn ghost" data-addlib style="flex:1">${t('🖼 Pick photos')}</button><button class="btn ghost" data-next style="flex:1">${here ? t('Next →') : t('Skip')}</button></div>${!n && state.step === 0 && window.renderDish ? `<a class="card" href="#dish" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);margin-top:12px"><div style="font-size:22px">🍽️</div><div style="flex:1;font-size:13px"><b>${t('Scan my plate')}</b><br><span class="sub" style="font-size:12px">${t('Snap a plated meal for estimated calories and macros.')}</span></div><span>›</span></a>` : ''}`
      : `<div class="kick">${t('Fridge to fabulous!')}</div><h2>${t(n === 1 ? '{n} photo ready!' : '{n} photos ready!', { n })}</h2><p class="sub">${t("We'll look at all of them together: one list, spices and sauces too.")}</p>${n < MAX_PHOTOS ? `<button class="chip" data-back style="cursor:pointer;margin-top:8px">${t('‹ Add more photos')}</button>` : ''}`}
      ${n && !LS.get('dietSeen', false) ? `<a class="chip" href="#settings" data-dietfirst style="display:inline-block;margin:10px 0 0;text-decoration:none">🥗 ${t('My diet & allergies')}</a>` : ''}
      ${n ? `<button class="btn primary" id="scanGo" style="font-size:20px;padding:20px">${t('Go! 🚀')}</button>` : ''}`;
    return;
  }
  const n = state.ingredients.length;
  if (rs) rs.innerHTML = `<button class="chip" data-rescan aria-label="${t('🔄 Start over with new photos')}" title="${t('🔄 Start over with new photos')}" style="cursor:pointer;margin:0;white-space:nowrap">${t('🔄 Start over')}</button>`;
  el('scanBody').innerHTML = `<h3 style="margin-top:6px">${t('What are you craving?')}</h3>
    <div class="chips">${CRAVINGS_LIST.map(c => { const hc = c.startsWith('holiday:'); return `<span class="chip" data-cr="${esc(c)}" style="cursor:pointer;${c === state.craving ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : hc ? 'background:var(--coral);color:#fff;border-color:var(--coral)' : ''}">${esc(hc ? holInfo().emoji + ' ' + holInfo().ui[0] : t(c))}</span>`; }).join('')}</div>
    <button class="btn primary" id="goRecipes" ${n ? '' : 'disabled style="opacity:.5"'}>${t("Let's get cooking! Show recipes →")}</button>
    <div style="height:14px"></div>
    <div class="kick">${t('Fridge to fabulous!')}</div>
    <h2>${t(n === 1 ? 'We found {n} ingredient' : 'We found {n} ingredients', { n })}</h2>
    <p class="sub">${t('Tap to remove anything we got wrong, or add what we missed.')}</p><div style="height:10px"></div>
    ${GROUPS.map(G => { const items = state.ingredients.map((g, i) => [g, i]).filter(([g]) => (GROUPS.includes(g.cat) ? g.cat : 'Pantry') === G); return `<h3 style="margin:14px 0 6px">${G === 'Spices & Seasonings' ? '🧂 ' : ''}${t(G)} <span style="color:var(--muted);font-weight:600">· ${items.length}</span></h3><div class="chips">${items.map(([g, i]) => `<span class="chip ${g.low ? 'miss' : 'have'}" data-rmi="${i}" style="cursor:pointer">${esc(g.name)}${g.qty ? ' · ' + esc(g.qty) : ''}${g.bad ? ' 🚫' : ''}<span class="x">×</span></span>`).join('')}<span class="chip" data-addi="${G}" style="cursor:pointer">${t('+ Add')}</span></div>`; }).join('')}
    ${state.ingredients.some(i => i.bad) ? `<p class="fine">${t("🚫 doesn't fit your diet, so we'll leave it out of recipes and your grocery list.")}</p>` : ''}
    ${state.low.length ? `<p class="fine">${t(state.low.length === 1 ? 'Coral = running low. We added it to your grocery list.' : 'Coral = running low. We added them to your grocery list.')}</p>` : ''}
    <a class="btn ghost" href="#list">${t('🛒 Restock time! Build my grocery list')}</a>`;
}

/* RECIPES */
async function moreIdeas() {
  if (state.moreBusy || state.recipesLoading || !state.recipes) return; state.moreBusy = true; track('more_ideas', 'recipes'); renderRecipes();
  const R = state.recipes; const avoid = [...(R.ready || []), ...(R.more || [])].map(r => r.name).slice(-40);
  const ingredients = state.ingredients.slice(0, 80).map(i => (i.cat === 'Spices & Seasonings' ? '[spice] ' : '') + i.name + (i.qty ? ' (' + i.qty + ')' : ''));
  const seen = new Set(avoid.map(n => n.toLowerCase()));
  const fresh = list => (list || []).filter(r => r?.name && !seen.has(r.name.toLowerCase()) && seen.add(r.name.toLowerCase()));
  const call = section => api('recipes', { ingredients, craving: state.craving, section, avoid }, 65000).then(j => j.recipes).catch(() => []);
  const [ready, more] = await Promise.all([call('ready'), call('more')]);
  const a = pick3(dedupe(fresh(ready), avoid), fresh(ready), avoid), b = pick3(dedupe(fresh(more), avoid.concat(a.map(r => r.name))), fresh(more), avoid.concat(a.map(r => r.name)));
  R.ready = (R.ready || []).concat(a); R.more = (R.more || []).concat(b); LS.set('recipes', R);
  state.moreBusy = false;
  if (location.hash === '#recipes') { const y = el('recipes').scrollTop; renderRecipes(); el('recipes').scrollTop = y; }
  toast(a.length + b.length ? t(a.length + b.length === 1 ? "{n} new idea! Let's get cooking!" : "{n} new ideas! Let's get cooking!", { n: a.length + b.length }) : t('Kitchen hiccup. Tap again for more ideas!'));
}
async function getRecipes() {
  location.hash = '#recipes'; el('recipesBody').innerHTML = loading('Cooking up ideas…');
  state.moreBusy = false; clearTimeout(prefetchRecipes.t);
  const A = recipeJob('ready'), B = recipeJob('more'), craving = state.craving, L = ['Easy', 'Medium', 'Chef mode'];
  // While recipes stream in, show at most one card per level in level order, so cards only get added, never swapped.
  const one = l => L.map(x => l.find(r => r.level === x)).filter(Boolean);
  const partial = () => { const ready = one(dedupe(A.list, [])), more = one(dedupe(B.list, ready.map(r => r.name))); if (!ready.length && !more.length) return; state.recipes = { craving, ready, more }; state.recipesLoading = true; if (location.hash === '#recipes') { const y = el('recipes').scrollTop; renderRecipes(); el('recipes').scrollTop = y; } };
  A.subs.add(partial); B.subs.add(partial); partial();
  try { const [ready0, more0] = await Promise.all([A.p, B.p]); const ready = pick3(dedupe(ready0, []), ready0, []); const more = pick3(dedupe(more0, ready.map(r => r.name)), more0, ready.map(r => r.name)); state.recipes = { craving, ready, more }; LS.set('recipes', state.recipes); }
  catch (e) { state.recipesLoading = false; state.recipes = LS.get('recipes', null); el('recipesBody').innerHTML = `<div class="kick">${t('Oops, kitchen hiccup!')}</div><h2>${t("Recipes didn't come through")}</h2><p class="sub">${esc(e.message)} ${t('Your ingredients are saved.')}</p><button class="btn primary" id="goRecipes">${t('Retry 🔄')}</button>`; return; }
  finally { A.subs.delete(partial); B.subs.delete(partial); }
  state.recipesLoading = false;
  track('recipes_shown', 'recipes', { n: (state.recipes?.ready?.length || 0) + (state.recipes?.more?.length || 0) });
  if (location.hash === '#recipes') { const y = el('recipes').scrollTop; renderRecipes(); el('recipes').scrollTop = y; }
}
const STOP = new Set(['and', 'with', 'the', 'a', 'of', 'in', 'on', 'style', 'quick', 'easy', 'simple', 'classic', 'homemade', 'savory', 'creamy', 'crispy', 'cheesy', 'spicy', 'garlic', 'butter', 'herb', 'herbed']);
const words = n => new Set(n.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.replace(/(ed|es|s|ing)$/, '').replace(/e$/, '')));
function similar(a, b, t = 0.6) { const A = words(a), B = words(b); if (!A.size || !B.size) return a.toLowerCase() === b.toLowerCase(); let k = 0; A.forEach(w => B.has(w) && k++); return k / Math.min(A.size, B.size) >= t; }
function pick3(list, raw = [], seen = []) { const L = ['Easy', 'Medium', 'Chef mode']; list = list.slice(); if (!list.some(x => x.level === 'Chef mode')) { const c = (raw || []).find(x => x?.name && x.level === 'Chef mode' && !seen.some(n => similar(n, x.name, 0.75))); if (c) list.push(c); } const out = []; for (const l of L) { const r = list.find(x => x.level === l && !out.includes(x)); if (r) out.push(r); } for (const r of list) { if (out.length >= 3) break; if (!out.includes(r)) out.push(r); } return out.slice(0, 3).sort((a, b) => L.indexOf(a.level) - L.indexOf(b.level)); }
function dedupe(list, seenNames) { const out = []; for (const r of list || []) { if (!r?.name) continue; if ([...seenNames, ...out.map(x => x.name)].some(n => similar(n, r.name))) continue; out.push(r); } return out; }
const LEVEL_PILL = l => ' ' + (l === 'Chef mode' ? '<span class="pill" style="background:var(--dark);color:#fff;margin-left:4px">👨‍🍳 ' + t('Chef mode') + '</span>' : l === 'Medium' ? '<span class="pill" style="background:#FFF1C9;color:#7A5300;margin-left:4px">' + t('Medium') + '</span>' : '<span class="pill g" style="margin-left:4px">' + t('Easy') + '</span>'); /* leading space: badges no longer read as one word (everythingEasy) */
const THUMBS = ['#FFF1C9', '#E3F3E9', '#EDE6F7', '#FDE9E0'];
function renderRecipes() {
  const R = state.recipes;
  if (!R) { el('recipesBody').innerHTML = `<div class="kick">${t('Craving unlocked!')}</div><h2>${t('No recipes yet')}</h2><p class="sub">${t("Snap your fridge first and we'll match recipes to what you have.")}</p><a class="btn primary" href="#scan">${t('📸 Snap it')}</a>`; return; }
  const ready = (R.ready || []).map((r, i) => `<a class="card recipe" href="#recipe" data-rec="ready:${i}"><div class="thumb" style="background:${THUMBS[i % 4]}">${esc(r.emoji || '🍳')}</div><div style="flex:1"><b>${esc(r.name)}</b><div class="meta">${t('{n} min · {s} servings', { n: esc(r.minutes), s: esc(r.servings) })}</div><span class="pill g">${t('Pantry power! You have everything')}</span>${LEVEL_PILL(r.level)}</div>${heart('ready:' + i, r)}</a>`).join('') || (state.recipesLoading ? ((R.more || []).length ? `<p class="fine">${t('Still checking what you can make right now…')}</p>` : loading('Cooking up ideas…')) : `<p class="sub">${t('Nothing makes the cut with only what you have. Check the ideas below!')}</p>`);
  const more = (R.more || []).map((r, i) => `<div class="card recipe"><a href="#recipe" data-rec="more:${i}" style="display:flex;gap:12px;align-items:center;flex:1;color:inherit;text-decoration:none"><div class="thumb" style="background:${THUMBS[(i + 1) % 4]}">${esc(r.emoji || '🍜')}</div><div style="flex:1"><b>${esc(r.name)}</b><div class="meta">${t('{n} min · {s} servings', { n: esc(r.minutes), s: esc(r.servings) })}</div>${(r.missing || []).length ? `<span class="pill c">${t('Missing {n}: {items}', { n: r.missing.length, items: esc(r.missing.map(m => m.item).join(', ')) })}</span>` : `<span class="pill g">${t('Pantry power! You have everything')}</span>`}${LEVEL_PILL(r.level)}</div></a><span style="display:flex;flex-direction:column;align-items:center;gap:4px">${heart('more:' + i, r)}<a class="chip" href="#list" data-addmiss="more:${i}" style="white-space:nowrap">${t('🛒 + List')}</a></span></div>`).join('');
  el('recipesBody').innerHTML = `<div class="kick">${t('Craving unlocked!')}</div><h2>${t('Matched to “{c}”', { c: esc(cravLabel(R.craving || state.craving)) })}</h2>${dietOn() && dietLine() ? `<p class="fine" style="margin-top:2px">${t('🥗 Cooking for: {d} · ', { d: esc(dietLine()) })}<a href="#settings" style="color:var(--coral);font-weight:700">${t('Change')}</a></p>` : ''}
    <h3>${t("Ready now: let's get cooking!")}</h3><p class="sub">${t('You already have everything for these. Pantry power!')}</p><div style="height:8px"></div>${ready}
    ${more || state.recipesLoading ? `<h3>${t('Make it with a few more things')}</h3><p class="sub">${t('Just a few items away. Add them to your grocery list and restock time is done!')}</p><div style="height:8px"></div>${more || loading('Cooking up ideas…')}${state.recipesLoading ? '' : `<a class="btn ghost" href="#list" data-addmiss="all">${t('🛒 Restock time! Build my grocery list')}</a>`}` : ''}
    <button class="btn primary" id="moreIdeas" ${state.moreBusy || state.recipesLoading ? 'disabled style="opacity:.7"' : ''}>${state.moreBusy ? '<span class="spin" style="border-top-color:#fff"></span> ' + t('Cooking up more…') : t('Hungry for more? Tap for more ideas!')}</button>`;
}
const pick = key => { if (key === 'crave') return state.crave?.recipe; if (key === 'x') return state.ext; if (key.startsWith('fav:')) return favs[+key.slice(4)]; const [k, i] = key.split(':'); return state.recipes?.[k]?.[+i]; };

/* RECIPE */
function renderRecipe() {
  const r = state.recipe;
  if (!r) { el('recipeBody').innerHTML = `<p class="sub">${t('Pick a recipe first!')}</p><a class="btn primary" href="#recipes">${t('See recipes')}</a>`; return; }
  el('recipeBack').href = state.from === 'crave' ? '#compare' : state.from === 'favs' ? '#favs' : state.from === 'lib' ? '#lib' : state.from === 'family' ? '#family' : '#recipes';
  el('recipeFav').textContent = isFav(r) ? '♥' : '♡';
  const miss = r.missing || []; const cost = r2(miss.reduce((s, m) => s + (+m.est_price || 0), 0));
  el('recipeBody').innerHTML = `<div class="hero">${esc(r.emoji || '🍳')}</div><div class="kick">${t('Craving unlocked!')}</div><h2>${esc(r.name)}</h2>
    <div class="stats"><div class="stat"><b>${esc(r.minutes)} min</b><span>${t('Total')}</span></div><div class="stat"><b>${esc(r.servings)}</b><span>${t('Servings')}</span></div><div class="stat"><b>${esc(t(r.level || 'Easy'))}</b><span>${t('Level')}</span></div></div>
    ${r.kcal ? `<p class="fine" style="margin-top:6px">${t('{k} kcal · {p}g protein · {c}g carbs · {f}g fat per serving (estimate)', { k: esc(r.kcal), p: esc(r.protein_g), c: esc(r.carbs_g), f: esc(r.fat_g) })}</p>` : ''}
    <h3>${t('Ingredients')}</h3><div class="chips">${(r.ingredients || []).map(g => `<span class="chip ${g.have ? 'have' : 'miss'}">${g.have ? '✓' : '✕'} ${esc(g.item)}${g.qty ? ', ' + esc(g.qty) : ''}</span>`).join('')}</div>
    ${miss.length ? `<div class="card" style="margin-top:12px;background:var(--coral-soft);border-color:#F6C6B3">
      <div class="row" style="padding-top:0"><b>${t(miss.length === 1 ? 'Missing {n} item' : 'Missing {n} items', { n: miss.length })}</b><b>~${$(cost)}</b></div>
      <div class="fine" style="margin-top:0">${t('Estimated grocery cost (AI estimate), before delivery and service fees.')}</div>
      <a class="btn insta" href="#list" data-addmiss="cur" style="padding:12px">${t('🛒 Add missing items to Instacart cart')}</a>
      <a class="btn ghost" href="#list" data-addmiss="cur" style="padding:11px">${t('＋ Add to my grocery list')}</a></div>` : `<div class="card" style="margin-top:12px;background:var(--green-soft);border-color:#BFE3CC"><b style="color:#1F6B42">${t('Pantry power! You have everything.')}</b></div>`}
    <h3>${t('Steps')} <span style="color:var(--coral)">${t("· Let's get cooking!")}</span></h3>
    <ol class="steps">${(r.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <a class="btn ghost" href="#crave" data-craveit="${esc(r.name)}">${t('Make it or take it? Compare with ordering →')}</a>
    <p class="fine">${t('AI-generated recipe. Check doneness and allergens yourself.')}</p>`;
}

/* CRAVE + COMPARE */
/* Delivery memberships + tip picked on the Crave screen feed the delivery ESTIMATE (never a quote). */
const dOpts = () => { const m = LS.get('mem', {}); return { mem: !!(m.dashpass || m.uberone), tip: LS.get('tipUS', 3) }; };
{ const m = LS.get('mem', {}); document.querySelectorAll('[data-mem]').forEach(b => b.classList.toggle('on', !!m[b.dataset.mem])); const tp = LS.get('tipUS', 3); document.querySelectorAll('#tipSeg button').forEach(b => b.classList.toggle('on', +b.dataset.tip === tp)); }
async function crave(text) {
  text = (text || '').trim(); if (!text) return toast(t('Name a craving first!'));
  location.hash = '#compare'; el('compareBody').innerHTML = loading('Crunching the numbers…');
  try { state.crave = await api('crave', { craving: text, ingredients: state.ingredients.map(i => i.name) }); state.crave.craving = text; LS.set('crave', state.crave); }
  catch (e) { el('compareBody').innerHTML = `<p class="sub">${esc(e.message)}</p><button class="btn primary" id="craveRetry" data-text="${esc(text)}">${t('Retry 🔄')}</button><a class="btn ghost" href="#crave">${t('Crave it')}</a>`; return; }
  renderCompare();
}
function renderCompare() {
  const c = state.crave; if (!c) { el('compareBody').innerHTML = `<p class="sub">${t("Tell us what you're craving first!")}</p><a class="btn primary" href="#crave">${t('Crave it')}</a>`; return; }
  const r = c.recipe; const miss = r.missing || []; const groc = r2(miss.reduce((s, m) => s + (+m.est_price || 0), 0));
  const cu = c.cur || (c.recipe && c.cur) || 'USD', cc = c.country || scCountry(), serv = Math.max(1, +r.servings || 1);
  /* Delivery = ESTIMATE range (typical local menu price x servings + app markup + delivery, service fee, tip). Never a quote, never app data. */
  const M = window.SC_MONEY, menu = M.menuFix(+c.est_menu_price > 0 ? +c.est_menu_price : M.menuGuess((+c.est_cook_cost || 0) / serv, cc), cc), dl = M.delivery(menu, serv, cc, dOpts());
  const homeAll = r2(+groc + 0), save = dl ? Math.max(0, r2(dl.lo - Math.max(homeAll, +c.est_cook_cost || 0))) : 0;
  el('compareBody').innerHTML = `<span class="example">${t('⚠ Cook cost is an estimate')}</span><div class="kick">${t('Make it or take it?')}</div><h2>${esc(c.craving)}</h2>
    <p class="sub" style="font-size:13px">${t('{s} servings · {name}', { s: esc(r.servings), name: esc(r.name) })}</p>
    <div class="verdict"><div class="k">${t('Make it at home')}</div><div class="v">${miss.length ? t('~{p} at the store', { p: $(groc, cu) }) : t('You have everything!')}</div><div class="s">${miss.length ? t(miss.length === 1 ? '{n} item to buy (full packages). ' : '{n} items to buy (full packages). ', { n: miss.length }) : ''}${t('What this meal uses: ~{a}, about ~{b} per serving.', { a: $(c.est_cook_cost, cu), b: $(c.est_cook_cost / serv, cu) })}${dl && save > 0 ? ' <b>' + t('Cooking saves about {s} vs delivery (estimate).', { s: $(save, cu) }) + '</b>' : ''}</div></div>${window.SC_PRICES && c.priceSrc ? `<p class="fine" style="margin:6px 0 0">${esc(SC_PRICES.label(c.priceSrc, I18N.lang))}</p>` : ''}
    <details class="opt best" open><summary><span class="badge" style="background:#2F8F5B">M</span><span class="nm">${t('Make it')} <small>${t('{n} min cook · estimate', { n: esc(r.minutes) })}</small></span><span class="amt">~${$(groc, cu)}</span></summary>
      <div class="bd">${miss.map(m => `<div class="row"><span class="m">${esc(m.item)}${m.qty ? ', ' + esc(m.qty) : ''}${m.priceSrc && window.SC_PRICES ? ` <small style="color:var(--muted);font-size:11px">· ${esc(SC_PRICES.tag(m.priceSrc, I18N.lang))}</small>` : ''}</span><span>~${$(m.est_price, cu)}</span></div>`).join('') || `<div class="row"><span class="m">${t('Nothing to buy')}</span><span>${$(0, cu)}</span></div>`}</div></details>
    ${dl ? `<details class="opt" id="dlEst"><summary><span class="badge" style="background:#1E1B18">🛵</span><span class="nm">${t('Order it delivered')}<small>${t('Estimate, not a quote. Check the app.')}</small></span><span class="amt">~${$(dl.lo, cu)}–${$(dl.hi, cu)}</span></summary>
      <div class="bd"><div class="row"><span class="m">${t('Delivery usually ~{lo}-{hi} with fees', { lo: $(dl.lo, cu), hi: $(dl.hi, cu) })}</span></div><div class="row"><span class="m">${t('Typical menu price ~{p} per serving × {n}, plus delivery, service fee and tip', { p: $(menu, cu), n: serv })}</span></div>${dl.mem ? `<div class="row"><span class="m">${t('With your membership: delivery fee waived and lower service fees (estimate).')}</span></div>` : ''}</div></details>` : ''}${window.scOrderLine ? scOrderLine(c) : ''}
    <p class="fine"><b>${t("Fees? We see 'em.")}</b> ${t('The delivery range is our rough estimate from typical local menu prices plus usual delivery, service fees and tip. It is not a quote and not from any delivery app; check the app for the real price. Cook cost is an AI estimate of local grocery prices.')}</p>
    <a class="btn primary" href="#recipe" data-rec="crave">${t("Let's get cooking! See the recipe →")}</a>
    ${miss.length ? `<a class="btn ghost" href="#list" data-addmiss="crave">${t('🛒 Restock time! Add missing items to my list')}</a>` : ''}`;
}

/* GROCERY LIST */
// Drop grocery items that break the saved diet/allergies (server does the matching; no AI call).
async function cleanGlist() {
  if (!dietOn() || !glist.length) return;
  try {
    const r = await fetch('/api/dietcheck', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefs: prefs(), items: glist.map(g => g.name) }) }); if (!r.ok) return;
    const rm = new Set((await r.json()).bad || []); if (!rm.size) return;
    glist = glist.filter((g, i) => !rm.has(i)); LS.set('glist', glist); if (location.hash === '#list') renderList();
    toast(t(rm.size === 1 ? "Removed {n} grocery item that don't fit your diet." : "Removed {n} grocery items that don't fit your diet.", { n: rm.size }), 5000);
  } catch {}
}
function addToList(name, src, price, recipe, quiet) {
  const k = name.trim().toLowerCase(); if (!k) return;
  const ex = glist.find(g => g.name.toLowerCase() === k);
  if (ex) { if (ex.done) ex.done = false; } else glist.push({ name: name.trim(), price: +price || 0, qty: 1, src, recipe, done: false });
  LS.set('glist', glist); if (!quiet) renderList();
}
function addMissing(r) { (r?.missing || []).forEach(m => addToList(m.item + (m.qty ? ', ' + m.qty : ''), 'miss', m.est_price, r.name, true)); LS.set('glist', glist); toast(t('Added to your grocery list. Restock time!')); }
function renderList() {
  const row = (g, i) => `<div class="row"><span data-gdone="${i}" style="cursor:pointer;flex:1;${g.done ? 'text-decoration:line-through;opacity:.5' : ''}">${g.done ? '✓' : '○'} ${esc(g.name)}</span><span class="qty"><button data-gq="${i}" data-d="-1" aria-label="${t('Less')}">−</button>${g.qty}<button data-gq="${i}" data-d="1" aria-label="${t('More')}">+</button><b style="width:52px;text-align:right">${g.price ? '~' + $(r2(g.price * g.qty)) : '—'}</b></span></div>`;
  const part = f => glist.map((g, i) => f(g) ? row(g, i) : '').join('') || `<div class="fine" style="margin:0">${t('Nothing here yet!')}</div>`;
  el('listMissing').innerHTML = part(g => g.src === 'miss');
  el('listLow').innerHTML = part(g => g.src !== 'miss');
  const open = glist.filter(g => !g.done && g.qty > 0);
  el('listCount').textContent = t(open.length === 1 ? '{n} item to grab' : '{n} items to grab', { n: open.length });
  { const tot = r2(open.reduce((s, g) => s + (+g.price || 0) * g.qty, 0)); el('listTotal').textContent = tot > 0 ? '~' + $(tot) : ''; } /* no prices (scan restock items) = no fake $0.00 */
}
const instaUrl = n => 'https://www.instacart.com/store/s?k=' + encodeURIComponent(n.replace(/,.*$/, ''));
function sendList() {
  const open = glist.filter(g => !g.done && g.qty > 0);
  if (!open.length) return toast(t('Your list is empty. Add something first!'));
  el('listLinks').innerHTML = `<div class="fine">${t('Tap each item to find it on Instacart:')}</div>` + open.map(g => `<a class="row" style="color:inherit" target="_blank" rel="noopener" href="${instaUrl(g.name)}"><span>🛒 ${esc(g.name)} × ${g.qty}</span><span>›</span></a>`).join('');
  window.open(instaUrl(open[0].name), '_blank', 'noopener');
}

/* EVENTS */
document.addEventListener('click', e => {
  const t = e.target;
  const fv = t.closest('[data-fav]'); if (fv) { e.preventDefault(); e.stopPropagation(); toggleFav(pick(fv.dataset.fav)); const y = document.querySelector('.screen.active').scrollTop; if (location.hash === '#favs') renderFavs(); else renderRecipes(); document.querySelector('.screen.active').scrollTop = y; return; }
  if (t.closest('#recipeFav')) { toggleFav(state.recipe); el('recipeFav').textContent = isFav(state.recipe) ? '♥' : '♡'; return; }
  if (t.closest('a.big-choice.snap') || t.closest('a.tab[href="#scan"]')) { if (!state.photos.length && !state.ingredients.length) { e.preventDefault(); openSnap(); /* camera FIRST, synchronously in the tap (iOS drops a file-input click after a hash change); the optional diet prompt now sits on the scan screen */ state.step = 0; location.hash = '#scan'; } return; }
  const dt = t.closest('[data-dtag]'); if (dt) { const k = dt.dataset.dtag; diet.tags = diet.tags.includes(k) ? diet.tags.filter(x => x !== k) : [...diet.tags, k]; saveDiet(); return renderSettings(); }
  const dm = t.closest('[data-dmood]'); if (dm) { const k = dm.dataset.dmood; const parts = diet.mood.split(/[,;]/).map(x => x.trim()).filter(Boolean); const has = parts.some(x => x.toLowerCase() === k.toLowerCase()); diet.mood = (has ? parts.filter(x => x.toLowerCase() !== k.toLowerCase()) : [...parts, k]).join(', '); saveDiet(); return renderSettings(); }
  if (t.closest('#dietSnap') || t.closest('#dietDone') || t.closest('#dietSkip')) cleanGlist();
  if (t.closest('#dietSnap') || t.closest('#dietDone')) track('diet_saved', 'settings', { n: (diet.tags || []).length });
  if (t.closest('#dietSnap') || t.closest('#dietSkip')) { const cam = !state.photos.length && !state.ingredients.length; if (cam) openSnap(); /* synchronous, before the hash change */ LS.set('dietSeen', true); state.dietFirst = false; if (cam) state.step = 0; location.hash = '#scan'; if (t.closest('#dietSnap') && dietOn()) toast(I18N.t("Saved! Let's get cooking!")); return; }
  if (t.closest('#dietDone')) { toast(state.dietReset ? I18N.t('Saved! Hit Show recipes for fresh ideas that fit.') : I18N.t("Saved! Let's get cooking!")); state.dietReset = false; location.hash = '#home'; return; }
  const lg = t.closest('[data-lang]'); if (lg) { setLang(lg.dataset.lang); return; }
  if (t.closest('#subCancel')) return cancelSub();
  if (t.closest('[data-dietfirst]')) state.dietFirst = true;
  if (t.closest('[data-addphoto]')) return openSnap();
  if (t.closest('[data-addlib]')) return openSnap(true);
  const rm = t.closest('[data-rmi]'); if (rm) { state.ingredients.splice(+rm.dataset.rmi, 1); LS.set('ingredients', state.ingredients); return renderScan(); }
  const rp = t.closest('[data-rmp]'); if (rp) { state.photos.splice(+rp.dataset.rmp, 1); return renderScan(); }
  if (t.closest('[data-next]')) { state.step++; return renderScan(); }
  if (t.closest('[data-back]')) { state.step = STEPS.length - 1; return renderScan(); }
  if (t.closest('[data-rescan]')) { state.ingredients = []; state.low = []; state.step = 0; state.scanId = ''; return renderScan(); }
  if (t.closest('#scanGo')) return scan();
  const ai = t.closest('[data-addi]'); if (ai) { const n = prompt(I18N.t('Add an ingredient')); if (n && n.trim()) { state.ingredients.push({ name: n.trim(), qty: '', cat: ai.dataset.addi }); LS.set('ingredients', state.ingredients); renderScan(); } return; }
  const cr = t.closest('[data-cr]'); if (cr) { state.craving = cr.dataset.cr; if (cr.dataset.cr.startsWith('holiday:')) holidayAnim(true); prefetchRecipes(900); return renderScan(); }
  if (t.closest('#goRecipes')) return getRecipes();
  if (t.closest('#moreIdeas')) return moreIdeas();
  const am = t.closest('[data-addmiss]'); if (am) { const k = am.dataset.addmiss; if (k === 'all') (state.recipes?.more || []).forEach(addMissing); else addMissing(k === 'cur' ? state.recipe : pick(k)); }
  const rc = t.closest('[data-rec]'); if (rc) { state.recipe = pick(rc.dataset.rec); state.from = rc.dataset.rec === 'crave' ? 'crave' : rc.dataset.rec === 'x' ? (state.extFrom || 'lib') : rc.dataset.rec.startsWith('fav:') ? 'favs' : 'recipes'; }
  const ci = t.closest('[data-craveit]'); if (ci) { el('craveInput').value = ci.dataset.craveit; try { el('craveInput').select(); } catch {} }
  const hc = t.closest('[data-crave]'); if (hc) { e.preventDefault(); el('craveInput').value = hc.dataset.crave; return crave(hc.dataset.crave); } /* popular chip = run the comparison at once */ /* selected, so typing replaces the chip text instead of appending */
  if (t.closest('#craveGo')) return crave(el('craveInput').value);
  const cr2 = t.closest('#craveRetry'); if (cr2) return crave(cr2.dataset.text);
  const d = t.closest('[data-gdone]'); if (d) { const g = glist[+d.dataset.gdone]; g.done = !g.done; LS.set('glist', glist); return renderList(); }
  const q = t.closest('[data-gq]'); if (q) { const g = glist[+q.dataset.gq]; g.qty = Math.max(0, g.qty + +q.dataset.d); LS.set('glist', glist); return renderList(); }
  if (t.closest('#listAddBtn')) { addToList(el('listAdd').value, 'manual', 0); el('listAdd').value = ''; return; }
  if (t.closest('#listSend')) return sendList();
  if (t.closest('#listClear')) { glist = glist.filter(g => !g.done); LS.set('glist', glist); el('listLinks').innerHTML = ''; return renderList(); }
  const tip = t.closest('[data-tip]'); if (tip) { document.querySelectorAll('#tipSeg button').forEach(b => b.classList.toggle('on', b === tip)); LS.set('tipUS', +tip.dataset.tip); }
  const s = t.closest('[data-mem]'); if (s) { s.classList.toggle('on'); LS.set('mem', { ...LS.get('mem', {}), [s.dataset.mem]: s.classList.contains('on') }); }
  const p = t.closest('.plan'); if (p) { if (p.dataset.plan === 'yr' && !subCfg.linkYearly && !(typeof inPlay === 'function' && inPlay())) toast(I18N.t('Yearly is coming soon! Monthly is ready now.')); else { document.querySelectorAll('.plan').forEach(x => x.classList.toggle('on', x === p)); renderPro(); } }
  if (t.closest('#proGo')) return goUnlimited();
  if (t.closest('#proCodeGo')) return redeem();
  if (t.closest('#proCodeShow')) { el('proCodeBox').style.display = 'block'; el('proCode').focus(); return; }
  if (t.closest('#proRestore') && inPlay()) return playRestore();
  if (t.closest('#proYearly') && inPlay()) return playBuy(PLAY_YEARLY);
  if (t.closest('#proRestore')) { const em = el('proEmail').value.trim() || sub.email; if (!em) return toast(I18N.t('Pop in the email you used at checkout!')); return checkSub(em.toLowerCase()); }
});
document.addEventListener('input', e => { if (e.target.id === 'dietOther') { diet.other = e.target.value; saveDiet(); } else if (e.target.id === 'dietMood') { diet.mood = e.target.value; saveDiet(); } });
el('listAdd').addEventListener('keydown', e => { if (e.key === 'Enter') el('listAddBtn').click(); });
{ let justFocused = false; const ci = el('craveInput'); /* select synchronously: a deferred select() ate the first typed letter ('ad thai') */
  ci.addEventListener('focus', () => { if (ci.value) { try { ci.select(); } catch {} justFocused = true; } });
  ci.addEventListener('mouseup', e => { if (justFocused) { e.preventDefault(); justFocused = false; } }); ci.addEventListener('keydown', () => { justFocused = false; }); } /* new typing replaces the old craving instead of appending (sushipizza) */
el('craveInput').addEventListener('keydown', e => { if (e.key === 'Enter') crave(el('craveInput').value); });
['snapCam', 'snapLib'].forEach(id => el(id).addEventListener('change', e => { onPhotos(e.target.files); e.target.value = ''; }));

function renderLeft() { if (unlimited()) { el('scanLeft').textContent = t("Unlimited scans. Let's get cooking!"); return; } const n = LS.get('scans', []).filter(t => Date.now() - t < 7 * 864e5).length; el('scanLeft').textContent = n < 3 ? t('{n} of 3 free scans left this week', { n: 3 - n }) : t('Free scans used up. Beta bonus: keep snapping!'); }
renderLeft();
const SCREENS = ['home', 'scan', 'recipes', 'recipe', 'crave', 'compare', 'cart', 'list', 'favs', 'pro', 'settings', 'prep', 'lib', 'family', 'hplan', 'dish'];
const RENDER = { dish: () => window.renderDish?.(), hplan: () => window.renderHplan?.(), scan: () => state.busy || renderScan(), recipes: () => el('recipesBody').querySelector('.spin, #goRecipes') || renderRecipes(), recipe: renderRecipe, favs: renderFavs, home: () => { renderFavCount(); renderDietCount(); }, settings: renderSettings, pro: renderPro, compare: () => el('compareBody').querySelector('.spin') || renderCompare(), list: renderList, prep: () => window.renderPrep?.(), lib: () => window.renderLib?.(), family: () => window.renderFamily?.() };
let lastView = '', hiddenAt = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000) { hiddenAt = 0; track('page_view', lastView || 'home'); } }); // reopened installed app = a new visit
function route() {
  const id = SCREENS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  if (id !== 'settings') state.dietFirst = false;
  if (id === 'hplan' || id === 'prep' || id === 'pro') document.getElementById('holAnim')?.remove(); /* the swoop must not cover the planner cards */
  RENDER[id]?.();
  if (id !== lastView) { lastView = id; track('page_view', id); }
  document.querySelectorAll('.screen').forEach(s => { s.classList.toggle('active', s.id === id); if (s.id === id) s.scrollTop = 0; });
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.for.split(' ').includes(id)));
}
window.addEventListener('hashchange', () => { route(); const a = document.querySelector('.screen.active'); a.classList.remove('anim'); void a.offsetWidth; a.classList.add('anim'); });
function setLang(l) { if (l === I18N.lang) return; I18N.load(l, () => setLang2(l)); }
function setLang2(l) { I18N.set(l); I18N.applyStatic(document.querySelector('.phone')); renderLeft(); renderPro(); renderFavCount(); renderDietCount(); applyHoliday(); route(); toast(I18N.t('Done: the app is in English.'), 1800); }
I18N.applyStatic(document.querySelector('.phone')); renderLeft(); applyHoliday();
route(); if (!location.hash || location.hash === '#home') setTimeout(() => holidayAnim(), 400);
/* TRENDING Popular cravings: /api/trending (7-day picks + favorites per country, holiday dishes blended in), cached 1 h. Static list stays when there is little data. */
function popular() {
  const q = new URLSearchParams(location.search), qs = new URLSearchParams({ lang: I18N.lang, tz: new Date().getTimezoneOffset() });
  if (q.get('country')) qs.set('country', q.get('country')); qs.set('holiday', HOLI.cur ? HOLI.cur.id : 'off');
  const key = 'sc.pop2.' + qs; let c = null; try { c = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {}
  const show = j => { if (!j || !j.items?.length) return; /* static = that country's own popular dishes, already in the UI language */ el('popChips').innerHTML = j.items.map(i => `<a class="chip" href="#crave" data-crave="${esc(i.label)}">${esc(i.emoji || '🔥')} ${esc(i.holiday || i.n ? i.label : t(i.label))}</a>`).join(''); };
  if (c && Date.now() - c.t < 3600e3) return show(c.j);
  fetch('/api/trending?' + qs).then(r => r.json()).then(j => { try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), j })); } catch {} show(j); }).catch(() => {});
}
setTimeout(popular, 600);
if (!new URLSearchParams(location.search).get('country')) { let g = null; try { g = sessionStorage.getItem('sc.geo'); } catch {} if (!g) fetch('/api/geo').then(r => r.json()).then(j => { if (j.country) { try { sessionStorage.setItem('sc.geo', j.country); } catch {} const before = HOLI.cur?.id; applyHoliday(); if (HOLI.cur?.id !== before) route(); } }).catch(() => {}); } setTimeout(cleanGlist, 2500);
/* INSTALL */
const standalone = () => ['standalone', 'fullscreen', 'minimal-ui'].some(m => matchMedia(`(display-mode: ${m})`).matches) || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let deferredInstall = null;
// Android app (TWA from Play): already installed, so never offer Install. Same check as grow.js isTWA; safe in any load order.
const inTWA = () => { try { if (document.referrer.startsWith('android-app://app.snapcravings.twa')) LS.set('twa', 1); } catch {} try { if ('getDigitalGoodsService' in window) LS.set('twa', 1); /* only the Play TWA exposes Digital Goods; works at any screen size, no referrer needed */ return !!LS.get('twa', 0) || (typeof inPlay === 'function' && inPlay()) || (typeof window.isTWA === 'function' && !!window.isTWA()); } catch { return false; } };
function showInstall(sub, btn) { const c = el('installCard'); if (!c) return; if (standalone() || inTWA()) { c.hidden = true; c.style.display = 'none'; return; } c.hidden = false; c.style.display = 'flex'; if (sub) el('installSub').textContent = t(sub); el('installBtn').style.display = btn === false ? 'none' : ''; }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; showInstall(null, true); });
window.addEventListener('appinstalled', () => { track('install', 'home'); deferredInstall = null; el('installCard').style.display = 'none'; toast(t('Installed! Find SnapCravings on your home screen.')); });
const isAndroid = /android/i.test(navigator.userAgent), isMobile = isIOS || isAndroid || /mobi/i.test(navigator.userAgent);
const isSafariMac = !isMobile && /safari/i.test(navigator.userAgent) && !/chrome|crios|edg|android/i.test(navigator.userAgent);
const isFirefox = /firefox|fxios/i.test(navigator.userAgent);
function installHint() { return t(installHintEn()); }
function installHintEn() {
  if (isIOS) return /crios|fxios|edgios/i.test(navigator.userAgent) ? 'Tap Share (⬆️), then Add to Home Screen' : 'In Safari: tap Share (⬆️), then Add to Home Screen';
  if (isAndroid) return isFirefox ? 'Open the ⋮ menu, then tap Install' : 'Open the Chrome ⋮ menu, then tap Install app (or Add to Home screen)';
  if (isSafariMac) return 'In Safari: File menu, then Add to Dock';
  if (isFirefox) return 'Firefox can’t install apps. Open this page in Chrome or Edge to install';
  return 'Click the install icon (⊕) at the right end of the address bar, or ⋮ menu, then Install SnapCravings';
}
el('installBtn').addEventListener('click', async () => {
  if (deferredInstall) { deferredInstall.prompt(); const r = await deferredInstall.userChoice; deferredInstall = null; if (r.outcome === 'accepted') el('installCard').style.display = 'none'; return; }
  toast(installHint(), 8000);
});
el('installCard').style.display = 'none';
if (!standalone()) showInstall(deferredInstall ? null : installHint(), !isIOS);
window.addEventListener('beforeinstallprompt', () => showInstall('Snap from your home screen, one tap away.', true));

if ('serviceWorker' in navigator) window.addEventListener('load', () => {
  const had = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
});
