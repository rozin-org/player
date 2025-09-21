
const urlsToCache = [
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'favicon.ico'
];

// ===========================================================
async function cleanupOldCaches() {
  let version = 'v0';
  try {
    const res = await fetch('https://rozin-org.github.io/player/version.json', { cache: 'no-store' });
    const data = await res.json();
    version = 'v' + (data.version || '0');
  } catch (err) {
    // fallback if fetch fails
  }
  const dynamicCacheName = 'play-it-now-' + version;
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== dynamicCacheName).map(k => caches.delete(k)));
  return dynamicCacheName;
}

// ===========================================================
self.addEventListener('install', event => {
  //self.skipWaiting(); // activate immediately
  event.waitUntil(
    (async () => {
      const dynamicCacheName = await cleanupOldCaches();
      const cache = await caches.open(dynamicCacheName);
      await cache.addAll(urlsToCache);
    })()
  );
});
// ===========================================================
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// ===========================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    cleanupOldCaches()
  );
  event.waitUntil(clients.claim());

});

// ===========================================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});


