/**
 * ============================================================================
 * SERVICE WORKER — AkashPriyadarshii Starred Repos Dashboard
 * Strategy: Cache-First for static assets, Network-First for HTML/JSON
 * ============================================================================
 */

const CACHE_VERSION = 'v202605260550';
const STATIC_CACHE  = `starred-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `starred-dynamic-${CACHE_VERSION}`;

// App shell — pre-cached on SW install
const APP_SHELL = [
  '/My-Starred-Repos/dashboard/index.html',
  '/My-Starred-Repos/dashboard/style.css',
  '/My-Starred-Repos/dashboard/app.js',
  '/My-Starred-Repos/dashboard/offline.html',
  '/My-Starred-Repos/dashboard/manifest.json',
  '/My-Starred-Repos/dashboard/icons/icon-192.png',
  '/My-Starred-Repos/dashboard/icons/icon-512.png',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn('[SW] Some shell assets failed to cache (ok locally):', err.message);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating, cleaning old caches');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== 'GET') return;

  // Skip chrome-extension and non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // Bypass cache entirely on localhost/127.0.0.1 for seamless local development
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (isLocalhost) {
    event.respondWith(fetch(request));
    return;
  }

  // Strategy A: Cache-First — CSS, JS, images, fonts
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|woff2|ico)(\?.*)?$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy B: Stale-While-Revalidate — JSON data (repos_output)
  if (url.pathname.endsWith('.json') || url.pathname.endsWith('CHANGELOG.md')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Strategy C: Network-First — HTML navigation
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }
});

// ─── Strategy: Cache-First ──────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

// ─── Strategy: Network-First ────────────────────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('./offline.html');
  }
}

// ─── Strategy: Stale-While-Revalidate ───────────────────────────────────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('Data unavailable offline', { status: 503 });
}
