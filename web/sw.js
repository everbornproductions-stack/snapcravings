// Versioned assets (?v=) and icons: cache-first (the URL changes on every version bump). HTML: network-first with a 3.5 s cutoff to the cached shell on slow signal.
const VERSION = 'sc-2026-11-03a-ui62';
const SHELL = ['./', './index.html', './money.js?v=ui62', './config.js?v=ui62', './i18n.js?v=ui62', './speed.js?v=ui62', './app.js?v=ui62', './prep.js?v=ui62', './more.js?v=ui62', './grow.js?v=ui62', './holiday.js?v=ui62', './hplan-i18n.js?v=ui62', './hplan.js?v=ui62', './dishcore.js?v=ui62', './dish-i18n.js?v=ui62', './dish.js?v=ui62', './ship-i18n.js?v=ui62', './checkout.js?v=ui62', './fixes.js?v=ui62', './prices.js?v=ui62', './feat-i18n.js?v=ui62', './feat.js?v=ui62', './i18n/pt.js?v=ui62', './i18n/hi.js?v=ui62', './i18n/id.js?v=ui62', './i18n/fr.js?v=ui62', './i18n/de.js?v=ui62', './i18n/ar.js?v=ui62', './i18n/ru.js?v=ui62', './i18n/tr.js?v=ui62', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const put = r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; };
  if (url.searchParams.has('v') || url.pathname.startsWith('/icons/')) { e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(put))); return; }
  const net = fetch(e.request, { cache: 'no-store' }).then(put);
  e.respondWith(new Promise(res => { let done = false; const fb = () => caches.match(e.request).then(m => m || caches.match('./')).then(m => { if (m && !done) { done = true; res(m); } return m; });
    const tm = setTimeout(fb, 3500); net.then(r => { clearTimeout(tm); if (!done) { done = true; res(r); } }).catch(() => { clearTimeout(tm); fb().then(m => { if (!done) { done = true; res(m || Response.error()); } }); }); }));
});
