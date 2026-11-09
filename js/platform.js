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

  const APP_VERSION = '2026.11.09';
  const UPDATE_MESSAGE = 'Versi baru Generator Surat tersedia.';
  const OFFLINE_MESSAGE = 'Mode offline aktif. Data lokal dan fitur yang sudah tersimpan tetap dapat digunakan.';
  const ONLINE_MESSAGE = 'Koneksi internet kembali tersedia.';

  let _initialized = false;
  let _deferredInstallPrompt = null;
  let _registration = null;
  let _refreshingAfterUpdate = false;
  let _hadControllerAtRegistration = false;
  let _notifiedWaitingWorker = null;
  let _updateCheckPromise = null;

  function init() {
    if (_initialized) return;
    _initialized = true;

    _bindInstallPrompt();
    _bindNetworkStatus();
    _bindUpdateControls();
    _bindKeyboardShortcuts();
    _syncPlatformState();

    if ('serviceWorker' in navigator) {
      document.documentElement.dataset.sw = navigator.serviceWorker.controller
        ? 'controlled'
        : 'registering';
      window.addEventListener('load', _registerServiceWorker, { once: true });
    } else {
      document.documentElement.dataset.sw = 'unsupported';
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
      _checkForUpdate();
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
    if (status && label) {
      status.dataset.state = online ? 'online' : 'offline';
      label.textContent = online ? 'Online' : 'Offline';
      status.title = online
        ? 'Koneksi internet tersedia'
        : OFFLINE_MESSAGE;
    }

    const mobileStatus = document.getElementById('platform-status-mobile');
    const mobileLabel = mobileStatus?.querySelector('.platform-status-mobile__label');
    if (mobileStatus) mobileStatus.dataset.state = online ? 'online' : 'offline';
    if (mobileLabel) mobileLabel.textContent = online ? 'Online' : 'Offline';
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
      _syncPlatformState();
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
      document.documentElement.dataset.sw = 'controlled';

      // Initial takeover does not require a reload. A later controller change
      // means the user accepted an update, so reload exactly once.
      if (_refreshingAfterUpdate) return;
      if (!_hadControllerAtRegistration) {
        _hadControllerAtRegistration = true;
        return;
      }
      _refreshingAfterUpdate = true;
      window.location.reload();
    });

    const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');
    standaloneQuery?.addEventListener?.('change', _syncPlatformState);
  }

  async function _registerServiceWorker() {
    if (!('serviceWorker' in navigator) || window.isSecureContext === false) {
      document.documentElement.dataset.sw = 'unavailable';
      return;
    }

    try {
      _hadControllerAtRegistration = !!navigator.serviceWorker.controller;
      _registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
        updateViaCache: 'none',
      });
      document.documentElement.dataset.sw = navigator.serviceWorker.controller
        ? 'controlled'
        : 'registered';

      const showWaitingUpdate = () => {
        const waiting = _registration?.waiting;
        if (!navigator.serviceWorker.controller || !waiting) return;

        _showUpdateButton(true);
        if (_notifiedWaitingWorker !== waiting) {
          _notifiedWaitingWorker = waiting;
          if (typeof UI !== 'undefined') UI.toast(UPDATE_MESSAGE, 'info', 6000);
        }
      };

      _registration.addEventListener('updatefound', () => {
        const worker = _registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') {
            showWaitingUpdate();
          } else if (worker.state === 'redundant') {
            _showUpdateButton(false);
          }
        });
      });

      // Also handle an update that was already waiting when this page opened.
      showWaitingUpdate();

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) _checkForUpdate();
      });

      console.info('[Platform] Service worker registered:', _registration.scope);
    } catch (error) {
      document.documentElement.dataset.sw = 'unavailable';
      console.warn('[Platform] Service worker tidak dapat didaftarkan:', error);
    }
  }

  function _checkForUpdate() {
    if (!_registration || navigator.onLine === false) return Promise.resolve(null);
    if (_updateCheckPromise) return _updateCheckPromise;

    _updateCheckPromise = _registration.update()
      .catch(error => {
        console.warn('[Platform] Pemeriksaan pembaruan gagal:', error);
        return null;
      })
      .finally(() => {
        _updateCheckPromise = null;
      });

    return _updateCheckPromise;
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
      _checkForUpdate();
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
      || /** @type {any} */ (window.navigator).standalone === true;
  }

  function getDiagnostics() {
    return {
      version: APP_VERSION,
      online: navigator.onLine !== false,
      standalone: _isStandalone(),
      serviceWorker: 'serviceWorker' in navigator,
      controlled: !!navigator.serviceWorker?.controller,
      installPromptReady: !!_deferredInstallPrompt,
      updateWaiting: !!_registration?.waiting,
      serviceWorkerState: _registration?.active?.state || null,
      serviceWorkerScope: _registration?.scope || null,
      userAgent: navigator.userAgent,
    };
  }

  return {
    init,
    installApp,
    updateApp,
    getDiagnostics,
  };

})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Platform.init(), { once: true });
} else {
  Platform.init();
}
