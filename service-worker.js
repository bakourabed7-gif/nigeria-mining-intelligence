const CACHE = 'nmi-shell-v1';
const SHELL = ['/', '/index.html', '/styles.css', '/dashboard-cards.css', '/auth-shell.css', '/mobile.css', '/admin.css', '/app.js', '/admin-ui.js', '/gps-ui.js', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; })));
});
