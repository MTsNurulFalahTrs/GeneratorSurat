/* =============================================================
   sw.js — PWA app shell, offline fallback, and safe asset caching
   ============================================================= */

const CACHE_PREFIX = 'generator-surat-platform-';
const CACHE_NAME = CACHE_PREFIX + 'v9';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/main.css',
  './css/components.css',
  './css/kop-editor.css',
  './css/preview.css',
  './css/ui-modern.css',
  './css/responsive.css',
  './css/workflow.css',
  './css/data-manager.css',
  './css/about.css',
  './css/dark-mode.css',
  './css/platform.css',
  './css/document-viewer.css',
  './css/print.css',
  './js/theme-init.js',
  './js/utils.js',
  './js/storage.js',
  './js/state.js',
  './js/validation.js',
  './templates/dpu.js',
  './templates/mutasi-masuk.js',
  './templates/siswa-baru.js',
  './templates/ijop-permohonan.js',
  './templates/ijop-sptjm-satpen.js',
  './templates/ijop-rekomendasi-pengawas.js',
  './templates/ijop-rekomendasi-kankemenag.js',
  './templates/ijop-sptjm-kankemenag.js',
  './templates/rekap-nilai.js',
  './templates/surat-izin.js',
  './js/template-registry.js',
  './js/ui.js',
  './js/kop-editor.js',
  './js/excel-import.js',
  './js/form-renderer.js',
  './js/table-renderer.js',
  './js/table-config.js',
  './js/table-config-ui.js',
  './js/preview-renderer.js',
  './js/print.js',
  './js/pdf-export.js',
  './js/data-manager.js',
  './js/settings.js',
  './js/workflow.js',
  './js/document-viewer.js',
  './js/platform.js',
  './js/about.js',
  './js/theme.js',
  './js/data-io.js',
  './js/app.js',
  './js/vendor/xlsx.full.min.js',
  './assets/icons/logo.svg',
  './assets/icons/favicon.svg',
];

const STATIC_DESTINATIONS = new Set([
  'style',
  'script',
  'image',
  'font',
  'manifest',
  'worker',
  'sharedworker',
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      // A release is installed as one unit. Never activate with a partial shell.
      const assets = await Promise.all(APP_SHELL.map(async asset => {
        const url = new URL(asset, self.registration.scope).href;
        const response = await fetch(url, { cache: 'reload' });

        if (!response.ok || response.type === 'opaque') {
          throw new Error('App shell asset unavailable (' + response.status + '): ' + asset);
        }

        return { url, response };
      }));

      await Promise.all(assets.map(({ url, response }) => cache.put(url, response)));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      console.error('[SW] Instalasi dibatalkan karena app shell tidak lengkap:', error);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isStaticAsset(request) {
  if (!isSameOrigin(request)) return false;
  if (STATIC_DESTINATIONS.has(request.destination)) return true;

  const pathname = new URL(request.url).pathname;
  return /\.(?:css|mjs|js|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|webmanifest)$/i.test(pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedPage = await cache.match(request);
    const appShell = await cache.match(new URL('./index.html', self.registration.scope).href);
    return cachedPage || appShell || Response.error();
  }
}

async function staleWhileRevalidate(request, event) {
  // Schedule cache lookup and refresh first; register waitUntil before awaiting.
  const cachePromise = caches.open(CACHE_NAME);
  const cachedPromise = cachePromise.then(cache => cache.match(request));

  const refresh = fetch(request, { cache: 'no-cache' })
    .then(async response => {
      const cacheControl = String(response.headers?.get('cache-control') || '').toLowerCase();
      const isPrivate = /(?:private|no-store)/.test(cacheControl);
      const cache = await cachePromise;

      if (response.ok && !isPrivate && response.type !== 'opaque') {
        await cache.put(request, response.clone());
      } else if (isPrivate) {
        await cache.delete(request);
      }
      return response;
    })
    .catch(() => null);

  // Extend the worker lifetime synchronously while the FetchEvent is dispatching.
  event.waitUntil(refresh.then(() => undefined));

  const cached = await cachedPromise;
  if (cached) return cached;
  return (await refresh) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !isSameOrigin(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // API/dynamic routes and cross-origin resources are never cached by this worker.
  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
