// Service Worker — serwuje kafle mapy offline z Cache Storage.
// Przechwytuje żądania kafli (CARTO / Esri / OpenFreeMap): najpierw cache,
// potem sieć (i dogrywa do cache). Offline = kafle z pamięci urządzenia.
const CACHE = 'jajek-tiles';
const TILE_HOSTS = ['basemaps.cartocdn.com', 'server.arcgisonline.com', 'tiles.openfreemap.org'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (!TILE_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request, { ignoreVary: true });
      if (hit) return hit;
      try {
        const res = await fetch(event.request);
        cache.put(event.request, res.clone()).catch(() => {});
        return res;
      } catch {
        const again = await cache.match(event.request, { ignoreVary: true });
        if (again) return again;
        return Response.error();
      }
    })(),
  );
});
