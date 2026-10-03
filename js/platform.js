/* =============================================================
   platform.js — Phase 5 Platform capabilities
   =============================================================
   - PWA/service worker registration
   - Install prompt
   - Online/offline status
   - Update lifecycle
   - Standalone detection
   - Keyboard shortcuts
   - Lightweight platform diagnostics
   ============================================================= */

const Platform = (() => {

  const APP_VERSION = '2026.10.03';
  const UPDATE_MESSAGE = 'Versi baru Generator Surat tersedia.';
  const OFFLINE_MESSAGE = 'Mode offline aktif. Data lokal dan fitur yang sudah tersimpan tetap dapat digunakan.';
  const ONLINE_MESSAGE = 'Koneksi internet kembali tersedia.';

  let _initialized = false;
  let _deferredInstallPrompt = null;
  let _registration = null;
  let _refreshingAfterUpdate = false;

  function init() {
    if (_initialized) return;
    _initialized = true;

    _bindInstallPrompt();
    _bindNetworkStatus();
    _bindUpdateControls();
    _bindKeyboardShortcuts();
    _syncPlatformState();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', _registerServiceWorker, { once: true });
    }

    console.info('[Platform] Platform layer ready:', APP_VERSION);
  }

  function _syncPlatformState() {
    const standalone = _isStandalone();
    document.documentElement.classList.toggle('platform-standalone', standalone);
    document.documentElement.dataset.platform = standalone ? 'standalone' : 'browser';
    document.documentElement.dataset.appVersion = APP_VERSION;

    _updateNetworkUi(navigator.onLine !== false);
  }

  function _bindNetworkStatus() {
    window.addEventListener('online', () => {
      _updateNetworkUi(true);
      if (typeof UI !== 'undefined') UI.toast(ONLINE_MESSAGE, 'success', 3500);
    });

    window.addEventListener('offline', () => {
      _updateNetworkUi(false);
      if (typeof UI !== 'undefined') UI.toast(OFFLINE_MESSAGE, 'warning', 5500);
    });
  }

  function _updateNetworkUi(online) {
    document.documentElement.classList.toggle('platform-offline', !online);

    const status = document.getElementById('platform-status');
    const label = document.getElementById('platform-status-label');
    if (!status || !label) return;

    status.dataset.state = online ? 'online' : 'offline';
    label.textContent = online ? 'Online' : 'Offline';
    status.title = online
      ? 'Koneksi internet tersedia'
      : OFFLINE_MESSAGE;
  }

  function _bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      _deferredInstallPrompt = event;
      _showInstallButton(true);
    });

    window.addEventListener('appinstalled', () => {
      _deferredInstallPrompt = null;
      _showInstallButton(false);
      if (typeof UI !== 'undefined') {
        UI.toast('Generator Surat berhasil dipasang sebagai aplikasi.', 'success', 4500);
      }
    });
  }

  function _showInstallButton(visible) {
    const button = document.getElementById('btn-install-app');
    if (!button) return;
    button.hidden = !visible;
    button.setAttribute('aria-hidden', String(!visible));
  }

  async function installApp() {
    if (!_deferredInstallPrompt) return false;

    try {
      const prompt = _deferredInstallPrompt;
      _deferredInstallPrompt = null;
      _showInstallButton(false);
      await prompt.prompt();

      const result = await prompt.userChoice;
      console.info('[Platform] Install prompt:', result?.outcome || 'unknown');
      return result?.outcome === 'accepted';
    } catch (error) {
      console.warn('[Platform] Install prompt gagal:', error);
      _deferredInstallPrompt = null;
      _showInstallButton(false);
      return false;
    }
  }

  function _bindUpdateControls() {
    document.getElementById('btn-install-app')?.addEventListener('click', installApp);
    document.getElementById('btn-update-app')?.addEventListener('click', updateApp);

    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      if (_refreshingAfterUpdate) return;
      _refreshingAfterUpdate = true;
      window.location.reload();
    });
  }

  async function _registerServiceWorker() {
    try {
      _registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
        updateViaCache: 'none',
      });

      _registration.addEventListener('updatefound', () => {
        const worker = _registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            _showUpdateButton(true);
            if (typeof UI !== 'undefined') {
              UI.toast(UPDATE_MESSAGE, 'info', 6000);
            }
          }
        });
      });

      // Cek pembaruan setiap kali aplikasi kembali ke foreground.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) _registration?.update().catch(() => {});
      });

      console.info('[Platform] Service worker registered:', _registration.scope);
    } catch (error) {
      console.warn('[Platform] Service worker tidak dapat didaftarkan:', error);
      document.documentElement.dataset.sw = 'unavailable';
    }
  }

  function _showUpdateButton(visible) {
    const button = document.getElementById('btn-update-app');
    if (!button) return;
    button.hidden = !visible;
    button.setAttribute('aria-hidden', String(!visible));
  }

  function updateApp() {
    const waiting = _registration?.waiting;
    if (!waiting) {
      _showUpdateButton(false);
      _registration?.update().catch(() => {});
      return;
    }

    _showUpdateButton(false);
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  function _bindKeyboardShortcuts() {
    document.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.altKey) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 's') {
        event.preventDefault();
        if (typeof App !== 'undefined' && typeof App.save === 'function') {
          App.save();
        }
      } else if (key === 'p') {
        event.preventDefault();
        if (typeof Workflow !== 'undefined' && typeof Workflow.preparePrint === 'function') {
          Workflow.preparePrint();
        } else if (typeof Print !== 'undefined') {
          Print.printDocument();
        }
      }
    });
  }

  function _isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches === true
      || window.navigator.standalone === true;
  }

  function getDiagnostics() {
    return {
      version: APP_VERSION,
      online: navigator.onLine !== false,
      standalone: _isStandalone(),
      serviceWorker: 'serviceWorker' in navigator,
      controlled: !!navigator.serviceWorker?.controller,
      installPromptReady: !!_deferredInstallPrompt,
      serviceWorkerScope: _registration?.scope || null,
      userAgent: navigator.userAgent,
    };
  }

  return {
    init,
    installApp,
    updateApp,
    getDiagnostics,
    version: APP_VERSION,
  };

})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Platform.init(), { once: true });
} else {
  Platform.init();
}
