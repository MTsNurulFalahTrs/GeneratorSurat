import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const root = new URL('../', import.meta.url);

function keyOf(request) {
  return new URL(typeof request === 'string' ? request : request.url, 'https://app.example/').href;
}

function createCacheStorage() {
  const stores = new Map();
  class MemoryCache {
    constructor() { this.entries = new Map(); }
    async put(request, response) { this.entries.set(keyOf(request), response.clone()); }
    async match(request) {
      const response = this.entries.get(keyOf(request));
      return response ? response.clone() : undefined;
    }
    async delete(request) { return this.entries.delete(keyOf(request)); }
    async keys() { return [...this.entries.keys()]; }
  }
  return {
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, new MemoryCache());
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
}

function createWorker(fetchImpl = vi.fn(async () => new Response('asset', { status: 200 }))) {
  const handlers = new Map();
  const cacheStorage = createCacheStorage();
  const self = {
    location: new URL('https://app.example/sw.js'),
    registration: { scope: 'https://app.example/' },
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type, handler) => handlers.set(type, handler)),
  };
  runInNewContext(source, {
    self, caches: cacheStorage, fetch: fetchImpl, URL, Response, Promise, Set,
    console: { warn: vi.fn(), error: vi.fn() },
  });
  return { handlers, caches: cacheStorage, fetch: fetchImpl, self };
}

function lifecycle(extra = {}) {
  const waits = [];
  const event = {
    ...extra,
    waitUntil(promise) { waits.push(Promise.resolve(promise)); },
    respondWith(promise) { event.responsePromise = Promise.resolve(promise); },
  };
  return { event, waits };
}

describe('PWA Service Worker', () => {
  it('declares only existing local app-shell assets', () => {
    const start = source.indexOf('const APP_SHELL = [');
    const end = source.indexOf('];', start);
    const assets = [...source.slice(start, end).matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);
    expect(assets.length).toBeGreaterThan(45);
    for (const asset of assets) {
      if (asset === './') continue;
      expect(existsSync(resolve(root.pathname, asset.slice(2))), asset).toBe(true);
    }
  });

  it('keeps every script, stylesheet and manifest declared in index.html in the offline app shell', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const start = source.indexOf('const APP_SHELL = [');
    const end = source.indexOf('];', start);
    const shell = [...source.slice(start, end).matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);
    const required = [
      ...[...html.matchAll(/<script\\b[^>]*\\bsrc=["']([^"']+)["']/gi)].map(match => match[1]),
      ...[...html.matchAll(/<link\\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)].map(match => match[1]),
      ...[...html.matchAll(/<link\\b[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/gi)].map(match => match[1]),
    ];

    expect(new Set(shell).size).toBe(shell.length);
    expect(required.length).toBeGreaterThan(40);
    for (const path of required) {
      expect(shell, 'Required offline asset missing from app shell: ' + path).toContain('./' + path);
    }
    expect(shell).toContain('./templates/rekap-nilai.js');
    expect(shell).toContain('./templates/surat-izin.js');
  });

  it('serves both new templates from the installed cache while offline', async () => {
    const online = createWorker();
    const { event: installEvent, waits: installWaits } = lifecycle();
    online.handlers.get('install')(installEvent);
    await Promise.all(installWaits);

    const keys = await (await online.caches.open('generator-surat-platform-v9')).keys();
    for (const name of ['rekap-nilai.js', 'surat-izin.js']) {
      expect(keys).toContain('https://app.example/templates/' + name);
    }

    const offline = createWorker(vi.fn().mockRejectedValue(new Error('offline')));
    // Share the successfully installed cache with the offline worker to simulate restart.
    const offlineCache = await offline.caches.open('generator-surat-platform-v9');
    const installedCache = await online.caches.open('generator-surat-platform-v9');
    for (const name of ['rekap-nilai.js', 'surat-izin.js']) {
      const url = 'https://app.example/templates/' + name;
      await offlineCache.put(url, await installedCache.match(url));
      const { event, waits } = lifecycle({
        request: { method: 'GET', mode: 'no-cors', destination: 'script', url },
      });
      offline.handlers.get('fetch')(event);
      expect(await (await event.responsePromise).text()).toBe('asset');
      expect((await offlineCache.match(url)).status).toBe(200);
      await Promise.all(waits);
    }
  });

  it('rejects installation and removes the new cache when one critical asset fails', async () => {
    const sw = createWorker(vi.fn(async url => (
      String(url).endsWith('/js/app.js')
        ? new Response('missing', { status: 404 })
        : new Response('ok', { status: 200 })
    )));
    const { event, waits } = lifecycle();
    sw.handlers.get('install')(event);
    await expect(Promise.all(waits)).rejects.toThrow(/app shell asset unavailable/i);
    expect(await sw.caches.keys()).toEqual([]);
  });

  it('pre-caches the complete app shell when every required request succeeds', async () => {
    const sw = createWorker();
    const { event, waits } = lifecycle();
    sw.handlers.get('install')(event);
    await Promise.all(waits);
    const cache = await sw.caches.open('generator-surat-platform-v9');
    const keys = await cache.keys();
    expect(keys.length).toBeGreaterThan(45);
    expect(await cache.match('https://app.example/index.html')).toBeInstanceOf(Response);
    expect(await cache.match('https://app.example/js/app.js')).toBeInstanceOf(Response);
  });

  it('removes obsolete app cache versions and claims clients on activation', async () => {
    const sw = createWorker();
    await sw.caches.open('generator-surat-platform-v8');
    await sw.caches.open('generator-surat-platform-v9');
    await sw.caches.open('unrelated-cache');
    const { event, waits } = lifecycle();
    sw.handlers.get('activate')(event);
    await Promise.all(waits);
    expect(await sw.caches.keys()).toEqual(['generator-surat-platform-v9', 'unrelated-cache']);
    expect(sw.self.clients.claim).toHaveBeenCalledOnce();
  });

  it('honours the explicit user-confirmed skip-waiting message', () => {
    const sw = createWorker();
    sw.handlers.get('message')({ data: { type: 'SKIP_WAITING' } });
    sw.handlers.get('message')({ data: { type: 'OTHER' } });
    expect(sw.self.skipWaiting).toHaveBeenCalledOnce();
  });

  it('falls back to the cached app shell when an offline navigation misses cache', async () => {
    const sw = createWorker(vi.fn().mockRejectedValue(new Error('offline')));
    const cache = await sw.caches.open('generator-surat-platform-v9');
    await cache.put('https://app.example/index.html', new Response('<main>shell</main>'));
    const { event } = lifecycle({
      request: { method: 'GET', mode: 'navigate', destination: 'document', url: 'https://app.example/forms/new' },
    });
    sw.handlers.get('fetch')(event);
    expect(await (await event.responsePromise).text()).toContain('shell');
  });

  it('serves cached static assets immediately and waits for background revalidation', async () => {
    const sw = createWorker(vi.fn().mockResolvedValue(new Response('fresh-css', {
      status: 200, headers: { 'Content-Type': 'text/css' },
    })));
    const cache = await sw.caches.open('generator-surat-platform-v9');
    const url = 'https://app.example/css/main.css';
    await cache.put(url, new Response('cached-css'));
    const { event, waits } = lifecycle({
      request: { method: 'GET', mode: 'no-cors', destination: 'style', url },
    });

    sw.handlers.get('fetch')(event);
    expect(waits).toHaveLength(1);
    expect(await (await event.responsePromise).text()).toBe('cached-css');
    await Promise.all(waits);
    expect(await (await cache.match(url)).text()).toBe('fresh-css');
  });

  it('purges a prior cache entry when a response becomes private or no-store', async () => {
    const sw = createWorker(vi.fn().mockResolvedValue(new Response('private', {
      status: 200, headers: { 'Cache-Control': 'private, no-store' },
    })));
    const cache = await sw.caches.open('generator-surat-platform-v9');
    const url = 'https://app.example/js/private-config.js';
    await cache.put(url, new Response('previous-public-asset'));
    const { event, waits } = lifecycle({
      request: { method: 'GET', mode: 'no-cors', destination: 'script', url },
    });
    sw.handlers.get('fetch')(event);
    await event.responsePromise;
    await Promise.all(waits);
    expect(await cache.match(url)).toBeUndefined();
  });

  it('does not intercept API, cross-origin, or non-GET requests', () => {
    const sw = createWorker();
    const requests = [
      { method: 'GET', mode: 'cors', destination: '', url: 'https://app.example/api/status' },
      { method: 'GET', mode: 'no-cors', destination: 'image', url: 'https://cdn.example.test/logo.png' },
      { method: 'POST', mode: 'cors', destination: '', url: 'https://app.example/api/export-pdf' },
    ];
    for (const request of requests) {
      const { event } = lifecycle({ request });
      sw.handlers.get('fetch')(event);
      expect(event.responsePromise).toBeUndefined();
    }
  });

  it('does not return HTML shell content for a missing offline JavaScript asset', async () => {
    const sw = createWorker(vi.fn().mockRejectedValue(new Error('offline')));
    const { event } = lifecycle({
      request: { method: 'GET', mode: 'no-cors', destination: 'script', url: 'https://app.example/js/new.js' },
    });
    sw.handlers.get('fetch')(event);
    expect((await event.responsePromise).type).toBe('error');
  });
});
