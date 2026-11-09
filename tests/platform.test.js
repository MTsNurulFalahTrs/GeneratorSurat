import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../js/platform.js', import.meta.url), 'utf8');

function target() {
  const listeners = new Map();
  return {
    addEventListener: vi.fn((type, callback) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    }),
    async dispatch(type, event = {}) {
      return Promise.all((listeners.get(type) || []).map(callback => callback(event)));
    },
  };
}

function element() {
  const el = target();
  el.hidden = false;
  el.title = '';
  el.textContent = '';
  el.dataset = {};
  el.attributes = {};
  el.setAttribute = vi.fn((name, value) => { el.attributes[name] = value; });
  el.querySelector = vi.fn(selector => selector === '.platform-status-mobile__label' ? el.mobileLabel : null);
  return el;
}

function createPlatform({ online = true, controller = null, secureContext = true, standalone = false } = {}) {
  const window = target();
  const document = target();
  const serviceWorker = target();
  const reload = vi.fn();
  const toast = vi.fn();
  const ids = ['btn-install-app', 'btn-update-app', 'platform-status', 'platform-status-label', 'platform-status-mobile'];
  const elements = new Map(ids.map(id => [id, element()]));
  const mobileLabel = element();
  elements.get('platform-status-mobile').mobileLabel = mobileLabel;

  const registration = target();
  const waitingWorker = { postMessage: vi.fn() };
  const installingWorker = target();
  installingWorker.state = 'installing';
  registration.scope = 'https://app.example/';
  registration.waiting = null;
  registration.installing = null;
  registration.active = { state: 'activated' };
  registration.update = vi.fn().mockResolvedValue(undefined);
  serviceWorker.controller = controller;
  serviceWorker.register = vi.fn().mockResolvedValue(registration);

  const navigator = { onLine: online, userAgent: 'Vitest Platform Test', standalone, serviceWorker };
  window.location = { reload };
  window.navigator = navigator;
  window.isSecureContext = secureContext;
  window.matchMedia = vi.fn(() => ({ matches: standalone, addEventListener: vi.fn() }));
  document.readyState = 'complete';
  document.hidden = false;
  document.documentElement = { dataset: {}, classList: { toggle: vi.fn() } };
  document.getElementById = vi.fn(id => elements.get(id) || null);

  const context = { window, document, navigator, UI: { toast }, console };
  runInNewContext(source, context);
  return {
    Platform: runInNewContext('Platform', context),
    window, document, navigator, serviceWorker, registration, waitingWorker,
    elements, mobileLabel, reload, toast,
  };
}

describe('PWA platform lifecycle', () => {
  it('registers service worker after page load on a secure context', async () => {
    const p = createPlatform();
    expect(p.serviceWorker.register).not.toHaveBeenCalled();
    await p.window.dispatch('load');
    expect(p.serviceWorker.register).toHaveBeenCalledWith('./sw.js', {
      scope: './', updateViaCache: 'none',
    });
    expect(p.document.documentElement.dataset.sw).toBe('registered');
  });

  it('does not register service worker in an insecure context', async () => {
    const p = createPlatform({ secureContext: false });
    await p.window.dispatch('load');
    expect(p.serviceWorker.register).not.toHaveBeenCalled();
    expect(p.document.documentElement.dataset.sw).toBe('unavailable');
  });

  it('keeps desktop and mobile network indicators synchronized', async () => {
    const p = createPlatform();
    await p.window.dispatch('offline');
    expect(p.elements.get('platform-status').dataset.state).toBe('offline');
    expect(p.elements.get('platform-status-label').textContent).toBe('Offline');
    expect(p.elements.get('platform-status-mobile').dataset.state).toBe('offline');
    expect(p.mobileLabel.textContent).toBe('Offline');
    await p.window.dispatch('online');
    expect(p.elements.get('platform-status').dataset.state).toBe('online');
    expect(p.mobileLabel.textContent).toBe('Online');
  });

  it('captures and consumes the install prompt once', async () => {
    const p = createPlatform();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = { preventDefault: vi.fn(), prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) };
    await p.window.dispatch('beforeinstallprompt', event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(p.elements.get('btn-install-app').hidden).toBe(false);
    expect(await p.Platform.installApp()).toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
    expect(await p.Platform.installApp()).toBe(false);
  });

  it('hides install action after appinstalled', async () => {
    const p = createPlatform();
    await p.window.dispatch('appinstalled');
    expect(p.elements.get('btn-install-app').hidden).toBe(true);
    expect(p.toast).toHaveBeenCalled();
  });

  it('notifies once for a waiting worker already present at registration', async () => {
    const p = createPlatform({ controller: { state: 'activated' } });
    p.registration.waiting = p.waitingWorker;
    await p.window.dispatch('load');
    expect(p.elements.get('btn-update-app').hidden).toBe(false);
    const updateMessages = p.toast.mock.calls.filter(([message]) => message === 'Versi baru Generator Surat tersedia.');
    expect(updateMessages).toHaveLength(1);
    await p.document.dispatch('visibilitychange');
    await p.window.dispatch('online');
    expect(p.toast.mock.calls.filter(([message]) => message === 'Versi baru Generator Surat tersedia.')).toHaveLength(1);
  });

  it('sends skip-waiting only after the user selects update', async () => {
    const p = createPlatform({ controller: { state: 'activated' } });
    p.registration.waiting = p.waitingWorker;
    await p.window.dispatch('load');
    p.Platform.updateApp();
    expect(p.waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(p.elements.get('btn-update-app').hidden).toBe(true);
  });

  it('does not reload on first takeover but reloads once after an update', async () => {
    const first = createPlatform();
    await first.window.dispatch('load');
    first.serviceWorker.controller = { state: 'activated' };
    await first.serviceWorker.dispatch('controllerchange');
    expect(first.reload).not.toHaveBeenCalled();

    const update = createPlatform({ controller: { state: 'activated' } });
    await update.window.dispatch('load');
    await update.serviceWorker.dispatch('controllerchange');
    await update.serviceWorker.dispatch('controllerchange');
    expect(update.reload).toHaveBeenCalledOnce();
  });

  it('checks for updates when connectivity returns', async () => {
    const p = createPlatform({ online: false });
    await p.window.dispatch('load');
    p.navigator.onLine = true;
    await p.window.dispatch('online');
    expect(p.registration.update).toHaveBeenCalledOnce();
  });

  it('exposes standalone, worker and pending-update state in diagnostics', async () => {
    const p = createPlatform({ standalone: true, controller: { state: 'activated' } });
    p.registration.waiting = p.waitingWorker;
    await p.window.dispatch('load');
    expect(p.Platform.getDiagnostics()).toMatchObject({
      version: '2026.11.09',
      standalone: true,
      controlled: true,
      updateWaiting: true,
      serviceWorkerState: 'activated',
      serviceWorkerScope: 'https://app.example/',
    });
  });
});
