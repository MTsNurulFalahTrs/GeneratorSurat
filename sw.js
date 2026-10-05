/* =============================================================
   sw.js — Phase 5 Platform Service Worker
   ============================================================= */

const CACHE_NAME = 'generator-surat-platform-v1';
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
  './css/platform.css',
  './css/document-viewer.css',
  './css/print.css',
  './js/utils.js',
  './js/storage.js',
  './js/state.js',
  './js/validation.js',
  './templates/dpu.js',
  './templates/mutasi-masuk.js',
  './templates/siswa-baru.js',
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
  './js/data-manager.js',
  './js/settings.js',
  './js/workflow.js',
  './js/document-viewer.js',
  './js/platform.js',
  './js/app.js',
  './assets/icons/logo.svg',
  './assets/icons/favicon.svg',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url => {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response.ok || response.type === 'opaque') {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn('[SW] Gagal menyimpan asset:', url, error);
      }
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith('generator-surat-platform-') && key !== CACHE_NAME)
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

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request) || caches.match('./index.html');
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  // Jika cache tersedia, kembalikan segera. Revalidasi berjalan di belakang
  // agar koneksi lambat tidak membuat asset cached ikut menunggu network.
  const refresh = fetch(request)
    .then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  return (await refresh)
    || await caches.match('./index.html')
    || Response.error();
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isSameOrigin(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
