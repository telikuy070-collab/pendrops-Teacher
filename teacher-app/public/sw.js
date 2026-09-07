/**
 * PenDrops Мугалим — Service Worker (Template)
 *
 * This template is processed during build by the teacherSwConfigInjector plugin
 * in vite.teacher.config.js, which replaces https://bnzcfhtmzvxxiwfkdryn.supabase.co,
 * eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuemNmaHRvenZ4eGl3ZmtkcnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTAzNzgsImV4cCI6MjEwNDI4NjM3OH0.aGrhaK5G7rM-p_bMDUZyGm-uvWSosvpe7GjfuWHXHX8, and teacher_homework placeholders with actual
 * environment values and writes the result to teacher-app/public/sw.js.
 */

const CACHE_NAME = 'teacher-app-v1';
const DATA_CACHE_NAME = 'teacher-data-v1';
const OFFLINE_PAGE = '/index.html';

const STATIC_URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.teacher.json',
  '/sw.js',
  '/assets/icons/icon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

const API_URL_PATTERNS = [
  '/rest/v1/',      // Supabase REST API
  '/storage/v1/object/', // Storage
  '/auth/v1/',      // Auth
  '/realtime/v1/',  // Realtime
];

/**
 * Check if a URL is a Supabase API call.
 */
function isApiUrl(url) {
  try {
    const urlObj = new URL(url);
    return API_URL_PATTERNS.some((p) => urlObj.pathname.includes(p));
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a static asset (CSS, JS, images, fonts).
 */
function isStaticAsset(url) {
  try {
    const urlObj = new URL(url);
    const ext = urlObj.pathname.split('.').pop()?.toLowerCase();
    return ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'woff', 'woff2', 'ttf', 'ico'].includes(
      ext || ''
    );
  } catch {
    return false;
  }
}

/**
 * Install event — cache static assets.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS_TO_CACHE)),
      self.skipWaiting(),
    ])
  );
});

/**
 * Activate event — clean up old caches.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

/**
 * Fetch event — implement caching strategies.
 *
 * Strategies:
 * - Static assets: Cache First (with network fallback)
 * - API calls: Stale While Revalidate (cache 5 min, then revalidate)
 * - Other: Network First (with offline fallback)
 */
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip if it's a cross-origin request to a different domain
  try {
    const urlObj = new URL(url);
    const origin = self.location.origin;
    if (urlObj.origin !== origin && !urlObj.hostname.includes('supabase.co')) {
      return;
    }
  } catch {
    return;
  }

  // Skip API auth/signup endpoints (always network)
  if (url.includes('/auth/v1/signup') || url.includes('/auth/v1/token')) {
    return;
  }

  event.respondWith(handleFetch(event.request));
});

async function handleFetch(request) {
  const url = request.url;

  // Strategy 1: Static assets — Cache First
  if (isStaticAsset(url)) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      // Offline — return a minimal cached version or placeholder
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  }

  // Strategy 2: API calls — Stale While Revalidate
  if (isApiUrl(url)) {
    const cache = await caches.open(DATA_CACHE_NAME);
    const cached = await cache.match(request);

    // Fetch from network in background
    const networkResponsePromise = fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    });

    // Return cached response immediately if available
    if (cached) {
      // Trigger network update in background
      networkResponsePromise.catch(() => {});
      return cached;
    }

    // Wait for network if no cache
    try {
      return await networkResponsePromise;
    } catch {
      return cached || new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Strategy 3: Navigation — Network First with offline fallback
  if (request.mode === 'navigate') {
    try {
      return await fetch(request);
    } catch {
      // Offline — return the app shell
      const offlineResponse = await caches.match(OFFLINE_PAGE);
      if (offlineResponse) return offlineResponse;

      return new Response(
        `<!doctype html>
<html lang="ru">
<head><meta charset="UTF-8"><title>PenDrops Мугалим — Оффлайн</title></head>
<body style="background:#0f172a;color:#f1f5f9;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;">
<h1>📚</h1><p>Вы оффлайн. Подключитесь к интернету для доступа к данным.</p>
</body>
</html>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }
  }

  // Default: network first
  return fetch(request);
}

/**
 * Message handler for runtime configuration and commands.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  switch (data.type) {
    case 'set-supabase-config':
      // Store config for API caching decisions
      self.__supabaseConfig = data;
      break;

    case 'clear-cache':
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => caches.delete(key)))
      );
      self.clients.matchAll().then((clients) =>
        clients.forEach((client) =>
          client.postMessage({ type: 'cache-cleared' })
        )
      );
      break;

    case 'force-update':
      self.skipWaiting();
      self.clients.matchAll().then((clients) =>
        clients.forEach((client) =>
          client.postMessage({ type: 'force-update' })
        )
      );
      break;
  }
});
