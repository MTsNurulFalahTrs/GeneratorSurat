/* =============================================================
   storage.js — LocalStorage wrapper dengan TTL dan snapshot pemulihan
   ============================================================= */

const Storage = (() => {
  const STORAGE_KEY = 'surat-generator-v1';
  const RECOVERY_KEY = 'surat-generator-recovery-v1';
  const TTL_DURATION_MS = 2 * 60 * 60 * 1000;
  const RECOVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  const CHECK_INTERVAL_MS = 60 * 1000;
  const SCHEMA_VERSION = '1.0';

  let _checkIntervalId = null;
  let _onExpiredCallback = null;
  let _available = false;
  let _listenersBound = false;
  let _lastHandledExpiry = null;

  function _checkAvailability() {
    try {
      const testKey = '__generator_surat_storage_probe__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      _available = true;
    } catch {
      _available = false;
    }
    return _available;
  }

  function _isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function _readRaw() {
    if (!_available) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        !_isPlainObject(parsed)
        || parsed.version !== SCHEMA_VERSION
        || !Number.isFinite(parsed.lastSavedAt)
        || !Number.isFinite(parsed.expiresAt)
        || parsed.expiresAt < parsed.lastSavedAt
        || !_isPlainObject(parsed.data)
      ) {
        console.warn('[Storage] Record penyimpanan tidak valid; tidak akan dipakai.');
        return null;
      }
      return parsed;
    } catch (err) {
      console.warn('[Storage] Gagal membaca record penyimpanan:', err?.name || 'Error');
      return null;
    }
  }

  function _writeRaw(payload) {
    if (!_available) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn('[Storage] Gagal menulis ke localStorage:', err?.name || 'Error');
      return false;
    }
  }

  function _clearRaw() {
    if (!_available) return false;
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function _readRecoveryList() {
    if (!_available) return [];
    try {
      const raw = localStorage.getItem(RECOVERY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!_isPlainObject(parsed) || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.items)) {
        console.warn('[Storage] Indeks snapshot pemulihan tidak valid.');
        return [];
      }

      const now = Date.now();
      return parsed.items.filter(item =>
        _isPlainObject(item)
        && typeof item.id === 'string'
        && Number.isFinite(item.lastSavedAt)
        && Number.isFinite(item.archivedAt)
        && Number.isFinite(item.recoveryExpiresAt)
        && item.recoveryExpiresAt > now
        && _isPlainObject(item.data)
      ).slice(-1);
    } catch (err) {
      console.warn('[Storage] Gagal membaca snapshot pemulihan:', err?.name || 'Error');
      return [];
    }
  }

  function _writeRecoveryList(items) {
    if (!_available) return false;
    try {
      if (!items.length) {
        localStorage.removeItem(RECOVERY_KEY);
        return true;
      }
      localStorage.setItem(RECOVERY_KEY, JSON.stringify({
        version: SCHEMA_VERSION,
        items: items.slice(-1),
      }));
      return true;
    } catch (err) {
      console.warn('[Storage] Snapshot pemulihan belum dapat disimpan:', err?.name || 'Error');
      return false;
    }
  }

  function _archiveExpiredRecord(record) {
    if (!_isPlainObject(record) || !_isPlainObject(record.data)) return false;

    const existing = _readRecoveryList();
    const id = 'recovery-' + String(record.lastSavedAt);
    if (existing.some(item => item.id === id)) return true;

    const now = Date.now();
    const snapshot = {
      id,
      lastSavedAt: record.lastSavedAt,
      archivedAt: now,
      recoveryExpiresAt: now + RECOVERY_RETENTION_MS,
      data: record.data,
    };

    // Hanya simpan satu snapshot terakhir agar pemulihan tidak menghabiskan
    // kuota localStorage dan mengorbankan draft bernama pengguna.
    return _writeRecoveryList([snapshot]);
  }

  function _isExpired(record) {
    return !!record && Number.isFinite(record.expiresAt) && Date.now() >= record.expiresAt;
  }

  function getRecovery() {
    if (!_available) return null;

    const archived = _readRecoveryList();
    if (archived.length) {
      const item = archived[archived.length - 1];
      return { ...item, source: 'archive' };
    }

    // Bila kuota penuh membuat pengarsipan gagal, record TTL yang expired
    // tetap dibiarkan di key asal sehingga pengguna masih bisa memulihkannya.
    const raw = _readRaw();
    if (_isExpired(raw)) {
      return {
        id: 'expired-cache-' + String(raw.lastSavedAt),
        lastSavedAt: raw.lastSavedAt,
        archivedAt: null,
        recoveryExpiresAt: null,
        data: raw.data,
        source: 'expired-cache',
      };
    }
    return null;
  }

  function _handleExpiry(record) {
    if (!record) return false;
    const expiryId = String(record.lastSavedAt);
    if (_lastHandledExpiry === expiryId) return true;

    const archived = _archiveExpiredRecord(record);
    if (archived) _clearRaw();

    _lastHandledExpiry = expiryId;
    if (typeof _onExpiredCallback === 'function') {
      try {
        _onExpiredCallback({
          ...record,
          archived,
          recoveryAvailable: !!getRecovery(),
        });
      } catch (err) {
        console.warn('[Storage] Error di callback expiry:', err?.name || 'Error');
      }
    }

    return archived;
  }

  function checkExpiry() {
    if (!_available) return false;
    const record = _readRaw();
    if (!_isExpired(record)) return false;
    _handleExpiry(record);
    return true;
  }

  function _startIntervalCheck() {
    if (_checkIntervalId) return;
    _checkIntervalId = setInterval(checkExpiry, CHECK_INTERVAL_MS);
  }

  function _setupVisibilityListener() {
    if (_listenersBound) return;
    _listenersBound = true;

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkExpiry();
    });
    window.addEventListener('focus', checkExpiry);
    window.addEventListener('pageshow', event => {
      if (event.persisted) checkExpiry();
    });
  }

  function init(options = {}) {
    const { onExpired } = options;
    _checkAvailability();

    if (typeof onExpired === 'function') _onExpiredCallback = onExpired;
    if (!_available) {
      console.warn('[Storage] localStorage tidak tersedia.');
      return { available: false, hasData: false, expired: false, recoveryAvailable: false };
    }

    const record = _readRaw();
    const expired = _isExpired(record);
    if (expired) _handleExpiry(record);

    _startIntervalCheck();
    _setupVisibilityListener();

    return {
      available: true,
      hasData: record !== null && !expired,
      expired,
      record: record && !expired ? record : null,
      recoveryAvailable: !!getRecovery(),
    };
  }

  function load() {
    if (!_available) return null;
    const record = _readRaw();
    if (!record) return null;
    if (_isExpired(record)) {
      _handleExpiry(record);
      return null;
    }
    return record.data || null;
  }

  function save(data, options = {}) {
    if (!_available) return { success: false, reason: 'localStorage tidak tersedia' };
    if (!_isPlainObject(data)) {
      return { success: false, reason: 'Data yang akan disimpan tidak valid.' };
    }

    const existing = _readRaw();
    if (_isExpired(existing) && options.replaceExpired !== true) {
      // Jangan timpa data TTL yang expired sebelum snapshot pemulihannya aman.
      if (!_archiveExpiredRecord(existing)) {
        return {
          success: false,
          reason: 'Snapshot lama belum berhasil diamankan. Ekspor backup atau hapus data lama sebelum menyimpan ulang.',
        };
      }
      _clearRaw();
    }

    const now = Date.now();
    const expiresAt = now + TTL_DURATION_MS;
    const success = _writeRaw({
      version: SCHEMA_VERSION,
      lastSavedAt: now,
      expiresAt,
      data,
    });

    if (!success) {
      return { success: false, reason: 'Gagal menulis ke localStorage (mungkin penuh)' };
    }

    _lastHandledExpiry = null;
    return { success: true, lastSavedAt: now, expiresAt };
  }

  function removeRecovery(id) {
    if (!_available || !id) return false;
    const items = _readRecoveryList().filter(item => item.id !== id);
    return _writeRecoveryList(items);
  }

  function clearRecovery() {
    if (!_available) return false;
    try {
      localStorage.removeItem(RECOVERY_KEY);
      return true;
    } catch (err) {
      console.warn('[Storage] Gagal menghapus snapshot pemulihan:', err?.name || 'Error');
      return false;
    }
  }

  function clear() {
    _clearRaw();
    if (_available) {
      try { localStorage.removeItem(RECOVERY_KEY); } catch { /* no-op */ }
    }
    _lastHandledExpiry = null;
    return true;
  }

  function getMeta() {
    if (!_available) return null;
    const record = _readRaw();
    if (!record) return null;
    return {
      lastSavedAt: record.lastSavedAt,
      expiresAt: record.expiresAt,
      version: record.version,
      remaining: Utils.getRemainingTime(record.expiresAt),
      expired: _isExpired(record),
    };
  }

  function isAvailable() {
    return _available;
  }

  return {
    init,
    load,
    save,
    clear,
    getMeta,
    isAvailable,
    checkExpiry,
    getRecovery,
    removeRecovery,
    clearRecovery,
    TTL_DURATION_MS,
    RECOVERY_RETENTION_MS,
  };
})();
