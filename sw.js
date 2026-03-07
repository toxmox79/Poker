// ⚠️ WICHTIG: Bei jeder Aktualisierung diese Versionsnummer erhöhen!
// Das zwingt alle Browser, den alten Cache zu löschen und neu zu laden.
const CACHE_VERSION = 'v5';
const CACHE_NAME = `poker-night-${CACHE_VERSION}`;

// Allow the update banner to trigger skipWaiting via postMessage
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './webrtc.js',
  './qr.js',
  './cards.js',
  './cardmeister.js',
  './manifest.json',
  './assets/svg-cards.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
  'https://unpkg.com/html5-qrcode'
];

// INSTALL: Cache alle Dateien und aktiviere sofort
self.addEventListener('install', event => {
  console.log(`[SW] Installing cache: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // Neuer SW übernimmt sofort
  );
});

// ACTIVATE: Alle alten Caches löschen
self.addEventListener('activate', event => {
  console.log(`[SW] Activating new cache: ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('poker-night-') && name !== CACHE_NAME)
          .map(oldCache => {
            console.log(`[SW] Deleting old cache: ${oldCache}`);
            return caches.delete(oldCache);
          })
      );
    }).then(() => self.clients.claim()) // Alle offenen Tabs übernehmen
  );
});

// FETCH: Cache-First für eigene Dateien, Network-First für externe
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isExternal = url.origin !== self.location.origin;

  if (isExternal) {
    // Externe CDN-Libs: Cache-First (sie ändern sich selten)
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  } else {
    // Eigene Dateien: Network-First → frische Version, Fallback auf Cache
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
  }
});
