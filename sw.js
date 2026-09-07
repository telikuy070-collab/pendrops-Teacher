const CACHE = 'schedule-pwa-v17';
const RUNTIME_CACHE = 'schedule-runtime-v17';
const SHARED_CACHE = 'shared-files';
const REMOTE_SCHEDULE_CACHE = 'remote-schedule-v2';

/**
 * Supabase configuration.
 *
 * These values are injected at build time by Vite (see vite.config.js `define`).
 * If the placeholders are not replaced (e.g., during dev), the SW will log a
 * warning and skip background sync. Runtime config can be injected via
 * postMessage ("set-supabase-config").
 */
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';
const SUPABASE_BUCKET = 'schedule';
/** Runtime config injected by app.js (preferred over build-time placeholders in dev). */
let _runtimeConfig = null;

const ASSETS = [
  './',
  './index.html',
  './share-handler.html',
  './styles.css',
  './manifest.json',
  './xlsx.full.min.js',
  './src/app.js',
  './src/sheet.js',
  './src/cell.js',
  './src/day.js',
  './src/timing.js',
  './src/text.js',
  './src/store.js',
  './src/admin.js',
  './src/supabaseClient.js',
  './src/utils/crypto.js',
  './src/utils/requestDedupe.js',
  './src/constants.js',
  './src/config/admin.js',
  './src/view/scheduleView.js',
  './src/view/toast.js',
  './src/view/dom.js',
  './src/view/adminView.js',
  './src/view/errorBoundary.js',
  './src/view/templateEngine.js',
  './src/view/templates/card.html',
  './src/view/templates/hero.html',
  './src/view/templates/day.html',
  './src/view/templates/hero-before.html',
  './src/view/templates/hero-break.html',
  './src/view/templates/hero-after.html',
  './src/view/templates/empty.html',
  './src/view/templates/admin.html',
  './src/view/templates/tomorrow.html',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await Promise.allSettled(ASSETS.map((u) => c.add(u).catch(() => null)));
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (k) =>
                  k !== CACHE &&
                  k !== RUNTIME_CACHE &&
                  k !== SHARED_CACHE &&
                  k !== REMOTE_SCHEDULE_CACHE
              )
              .map((k) => caches.delete(k))
          )
        ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.method === 'POST' && url.pathname.endsWith('/share-handler.html')) {
    e.respondWith(handleShare(req));
    return;
  }

  // Supabase Storage / REST API requests — network-first with cache fallback
  if (
    url.origin === SUPABASE_URL ||
    url.pathname.startsWith('/storage/v1/object/public/') ||
    url.pathname.startsWith('/rest/v1/')
  ) {
    e.respondWith(networkFirstWithCache(req));
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

async function networkFirstWithCache(req) {
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res && res.status === 200) {
      const copy = res.clone();
      caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw err;
  }
}

async function handleShare(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (file && typeof file === 'object' && 'stream' in file) {
      const name = file.name || 'shared.xls';
      const lower = name.toLowerCase();
      let type = file.type;
      if (!type || type === 'application/octet-stream') {
        if (lower.endsWith('.xlsx'))
          type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (lower.endsWith('.xls')) type = 'application/vnd.ms-excel';
        else if (lower.endsWith('.csv')) type = 'text/csv';
      }
      const headers = new Headers();
      headers.set('Content-Type', type);
      headers.set('X-File-Name', encodeURIComponent(name));
      const response = new Response(file.stream(), { status: 200, headers });
      const cache = await caches.open(SHARED_CACHE);
      await cache.put('/__shared__', response);
    }
    return Response.redirect(new URL('./share-handler.html', req.url).href, 303);
  } catch (err) {
    console.error('[SW] share error:', err);
    return Response.redirect(new URL('./index.html', req.url).href, 303);
  }
}

/**
 * Периодическая фоновая синхронизация (Chrome/Edge/Opera).
 * Регистрируется клиентом через registration.periodicSync.register('check-schedule', {minInterval: 5*60*1000}).
 * ВАЖНО: periodicSync требует user gesture для permission. Fallback: клиент сам тикает по 5 мин пока PWA открыта.
 */
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'check-schedule') {
    e.waitUntil(checkScheduleUpdate());
  }
});

/**
 * Клиент шлёт сообщения:
 * - "check-schedule": проверяем обновления (fallback если periodicSync не поддерживается)
 * - "set-supabase-config": инъекция runtime конфигурации (url, anon key)
 */
self.addEventListener('message', (e) => {
  const data = e.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'check-schedule') {
    e.waitUntil(checkScheduleUpdate());
  } else if (data.type === 'set-supabase-config') {
    if (data.url && data.anonKey) {
      _runtimeConfig = { url: data.url, anonKey: data.anonKey };
    }
  } else if (data.type === 'skip-waiting') {
    self.skipWaiting();
  }
});

/**
 * Checks for schedule updates via the Supabase REST API.
 *
 * Fetches the latest row from the `app_version` table. If the `updated_at`
 * timestamp differs from the last cached value, downloads the new `schedule.xls`
 * and caches it, then notifies all clients that the schedule has been updated.
 *
 * Configuration (Supabase URL + anon key) may come from build-time placeholders
 * or be injected at runtime via postMessage ("set-supabase-config").
 */
async function checkScheduleUpdate() {
  const config = getEffectiveConfig();
  if (!config) {
    console.warn('[SW] No Supabase config available — skipping update check');
    return;
  }

  const headers = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
  };

  try {
    // 1. Fetch latest version info from app_version table
    const verUrl = `${config.url}/rest/v1/app_version?select=version,updated_at,file_name,size,uuid&order=updated_at.desc&limit=1`;
    const verRes = await fetch(verUrl + '?t=' + Date.now(), {
      cache: 'no-store',
      headers,
    });
    if (!verRes.ok) return;
    const versions = await verRes.json();
    if (!Array.isArray(versions) || !versions.length) return;
    const latest = versions[0];
    const newStamp = latest.updated_at;
    if (!newStamp) return;

    // 2. Check if we already have this version cached (keyed by uuid)
    const cache = await caches.open(REMOTE_SCHEDULE_CACHE);
    const alreadyCached = await cache.match(latest.uuid);
    if (alreadyCached) return;

    // 3. Download the new schedule.xls
    const fileUrl = `${config.url}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(latest.file_name)}`;
    const xlsRes = await fetch(fileUrl, { cache: 'no-store', headers });
    if (!xlsRes.ok) return;
    const xlsBuf = await xlsRes.arrayBuffer();

    // 4. Cache the schedule keyed by uuid
    await cache.put(
      latest.uuid,
      new Response(xlsBuf.slice(0), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.ms-excel' },
      })
    );

    // 5. Notify all clients
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((c) =>
      c.postMessage({
        type: 'schedule-updated',
        version: latest.version || '',
        updated: newStamp,
        file_name: latest.file_name,
        uuid: latest.uuid,
      })
    );
  } catch (err) {
    console.warn('[SW] checkScheduleUpdate:', err);
  }
}

/**
 * Returns the effective Supabase configuration, preferring runtime config
 * injected by the app, falling back to build-time placeholders.
 */
function getEffectiveConfig() {
  if (_runtimeConfig) return _runtimeConfig;
  if (SUPABASE_URL && SUPABASE_URL !== '__SUPABASE_URL__') {
    return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
  }
  return null;
}
