/* Speckzettel service worker: keeps the app files on the device so it starts offline.
   For every release bump VERSION (and APP_VERSION in js/version.js); the app then shows "Neue Version da". */
const VERSION = 'speckzettel-2.3.1';

/* Everything the app needs offline. New files must be added here (tests/ is deliberately not cached). */
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './data/catalog.json',
  './js/actions.js',
  './js/app.js',
  './js/areas.js',
  './js/catalog.js',
  './js/clock.js',
  './js/main.js',
  './js/migrate.js',
  './js/pantry.js',
  './js/platform.js',
  './js/recipe-edit.js',
  './js/recipe-icons.js',
  './js/recipe-model.js',
  './js/recipe-text.js',
  './js/recipes.js',
  './js/render.js',
  './js/samples.js',
  './js/seed.js',
  './js/shopping.js',
  './js/starter-recipes.js',
  './js/store.js',
  './js/text.js',
  './js/units.js',
  './js/version.js',
  './js/receipt/history.js',
  './js/receipt/lines.js',
  './js/receipt/pdf.js',
  './js/receipt/pipeline.js',
  './js/receipt/templates.js',
  './vendor/pdfjs/pdf.min.mjs',
  './vendor/pdfjs/pdf.worker.min.mjs',
  './js/views/components.js',
  './js/views/cook-sheet-view.js',
  './js/views/cooking-view.js',
  './js/views/pantry-view.js',
  './js/views/receipt-view.js',
  './js/views/onboarding-view.js',
  './js/views/settings-view.js',
  './js/views/sheet-view.js',
  './js/views/shopping-view.js',
  './fonts/fonts.css',
  './fonts/bricolage-grotesque-latin-opsz-normal.woff2',
  './fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  './fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  './fonts/ibm-plex-mono-latin-400-normal.woff2',
  './fonts/ibm-plex-mono-latin-500-normal.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)));
  // No skipWaiting here: a new version waits until the user taps "Neu laden".
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('speckzettel-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: always the cached app shell, so it opens offline and stays on the installed version.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(hit => hit || fetch(req))
    );
    return;
  }

  // Everything else: cache first, then network (and remember it for next time).
  event.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then(cache => cache.put(req, copy));
      }
      return res;
    }))
  );
});
