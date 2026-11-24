// sw.js — permite instalar la web como app (PWA) y abrirla aunque falle la conexión.
const SHELL_CACHE = 'surtidor-shell-v1';
const DATA_CACHE = 'surtidor-data';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'core.js', 'config.js', 'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Precios: primero la red (siempre frescos); si no hay conexión, la última copia guardada.
  if (url.origin === location.origin && url.pathname.includes('/data/')) {
    const key = url.origin + url.pathname; // sin ?v= para no acumular versiones
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(DATA_CACHE).then((c) => c.put(key, copy)); }
          return res;
        })
        .catch(() => caches.match(key)),
    );
    return;
  }

  // App y librería del mapa: respuesta inmediata desde caché y actualización en segundo plano.
  if (url.origin === location.origin || url.hostname === 'unpkg.com') {
    e.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
