// Network-first for everything (HTML/JS/CSS always fresh when online); cache only as offline fallback.
const VERSION = 'sc-2026-11-02r-ui49';
const SHELL = ['./', './index.html', './config.js?v=ui49', './i18n.js?v=ui49', './app.js?v=ui49', './prep.js?v=ui49', './more.js?v=ui49', './grow.js?v=ui49', './holiday.js?v=ui49', './hplan-i18n.js?v=ui49', './hplan.js?v=ui49', './dishcore.js?v=ui49', './dish-i18n.js?v=ui49', './dish.js?v=ui49', './fixes.js?v=ui49', './i18n/pt.js?v=ui49', './i18n/hi.js?v=ui49', './i18n/id.js?v=ui49', './i18n/fr.js?v=ui49', './i18n/de.js?v=ui49', './i18n/ar.js?v=ui49', './i18n/ru.js?v=ui49', './i18n/tr.js?v=ui49', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
});
