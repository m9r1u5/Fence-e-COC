/* Fence E-COC service worker – keeps the app working offline.
   When you upload a new version, change VERSION here, in config.js and in version.json. */
const VERSION = '1.0.1';
const CACHE = 'fence-ecoc-' + VERSION;
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'disclaimer.js', 'pdf-lib.min.js', 'manifest.json',
  'coc-template.pdf', 'test-report-template.pdf', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fence-ecoc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('version.json')) return; // always from the network
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
