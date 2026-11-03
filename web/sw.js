// Network-first for everything (HTML/JS/CSS always fresh when online); cache only as offline fallback.
const VERSION = 'sc-2026-11-02r-ui52';
const SHELL = ['./', './index.html', './money.js?v=ui52', './config.js?v=ui52', './i18n.js?v=ui52', './app.js?v=ui52', './prep.js?v=ui52', './more.js?v=ui52', './grow.js?v=ui52', './holiday.js?v=ui52', './hplan-i18n.js?v=ui52', './hplan.js?v=ui52', './dishcore.js?v=ui52', './dish-i18n.js?v=ui52', './dish.js?v=ui52', './fixes.js?v=ui52', './i18n/pt.js?v=ui52', './i18n/hi.js?v=ui52', './i18n/id.js?v=ui52', './i18n/fr.js?v=ui52', './i18n/de.js?v=ui52', './i18n/ar.js?v=ui52', './i18n/ru.js?v=ui52', './i18n/tr.js?v=ui52', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
});
