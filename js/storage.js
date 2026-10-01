/* =============================================================
   storage.js — LocalStorage wrapper dengan TTL 2 jam yang robust
   =============================================================
   Mekanisme expiry:
   - TTL dihitung dari `lastSavedAt` (waktu penyimpanan terakhir)
   - expiresAt = lastSavedAt + TTL_DURATION_MS
   - Pengecekan dilakukan:
     1. Saat initialization (page load/hard refresh)
     2. Setiap EXPIRY_CHECK_INTERVAL_MS (1 menit) via setInterval
     3. Saat tab kembali visible (visibilitychange event)
     4. Saat tab mendapat focus (window focus event)
   - Refresh/hard-refresh TIDAK mereset TTL
   - TTL hanya diperbarui saat benar-benar ada penyimpanan data baru
*/

const Storage = (() => {

  /* ── Konstanta ── */
  const STORAGE_KEY        = 'surat-generator-v1';
  const TTL_DURATION_MS    = 2 * 60 * 60 * 1000; // 2 jam
  const CHECK_INTERVAL_MS  = 60 * 1000;           // cek tiap 1 menit
  const SCHEMA_VERSION     = '1.0';

  /* ── Internal state ── */
  let _checkIntervalId = null;
  let _onExpiredCallback = null;
  let _available = false;

  /* ── 1. Cek ketersediaan localStorage ── */
  function _checkAvailability() {
    _available = Utils.isLocalStorageAvailable();
    return _available;
  }

  /* ── 2. Baca raw data dari localStorage ── */
  function _readRaw() {
    if (!_available) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Validasi schema version
      if (!parsed || parsed.version !== SCHEMA_VERSION) return null;
      return parsed;
    } catch {
      // Data corrupt → hapus
      _clearRaw();
      return null;
    }
  }

  /* ── 3. Tulis raw data ke localStorage ── */
  function _writeRaw(payload) {
    if (!_available) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      // QuotaExceededError atau error lain
      console.warn('[Storage] Gagal menulis ke localStorage:', err.message);
      return false;
    }
  }

  /* ── 4. Hapus data dari localStorage ── */
  function _clearRaw() {
    if (!_available) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* silent */
    }
  }

  /* ── 5. Cek apakah data sudah expired ── */
  function _isExpired(record) {
    if (!record) return false;
    if (!record.expiresAt || typeof record.expiresAt !== 'number') return false;
    return Date.now() >= record.expiresAt;
  }

  /* ── 6. Hapus data expired dan panggil callback ── */
  function _handleExpiry(record) {
    console.info('[Storage] Data kedaluwarsa, menghapus...');
    _clearRaw();
    if (typeof _onExpiredCallback === 'function') {
      try {
        _onExpiredCallback(record);
      } catch (err) {
        console.warn('[Storage] Error di onExpired callback:', err);
      }
    }
  }

  /* ── 7. Pengecekan expiry (dipanggil dari berbagai trigger) ── */
  function checkExpiry() {
    if (!_available) return false;
    const record = _readRaw();
    if (!record) return false; // Tidak ada data, tidak perlu expire
    if (_isExpired(record)) {
      _handleExpiry(record);
      return true; // true = sudah expired dan dihapus
    }
    return false; // false = belum expired
  }

  /* ── 8. Start interval checker ── */
  function _startIntervalCheck() {
    if (_checkIntervalId) return;
    _checkIntervalId = setInterval(() => {
      checkExpiry();
    }, CHECK_INTERVAL_MS);
  }

  /* ── 9. Stop interval checker ── */
  function _stopIntervalCheck() {
    if (_checkIntervalId) {
      clearInterval(_checkIntervalId);
      _checkIntervalId = null;
    }
  }

  /* ── 10. Setup page visibility listener ── */
  function _setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // Tab kembali visible → cek expiry
        checkExpiry();
      }
    });

    window.addEventListener('focus', () => {
      // Window mendapat focus → cek expiry
      checkExpiry();
    });

    // Page show event (saat tab dipulihkan dari bfcache)
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        // Halaman dipulihkan dari back-forward cache
        checkExpiry();
      }
    });
  }

  /* ── 11. Initialize storage ── */
  function init(options = {}) {
    const { onExpired } = options;

    _checkAvailability();

    if (typeof onExpired === 'function') {
      _onExpiredCallback = onExpired;
    }

    if (!_available) {
      console.warn('[Storage] localStorage tidak tersedia.');
      return { available: false, hasData: false, expired: false };
    }

    // Cek expiry saat init (page load / hard refresh)
    const record = _readRaw();
    const expired = _isExpired(record);

    if (expired) {
      _handleExpiry(record);
      _startIntervalCheck();
      _setupVisibilityListener();
      return { available: true, hasData: false, expired: true };
    }

    _startIntervalCheck();
    _setupVisibilityListener();

    return {
      available: true,
      hasData: record !== null,
      expired: false,
      record: record || null,
    };
  }

  /* ── 12. Load data dari storage ── */
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

  /* ── 13. Simpan data ke storage (update lastSavedAt & expiresAt) ── */
  function save(data) {
    if (!_available) return { success: false, reason: 'localStorage tidak tersedia' };

    const now = Date.now();
    const payload = {
      version: SCHEMA_VERSION,
      lastSavedAt: now,
      expiresAt: now + TTL_DURATION_MS,
      data: data,
    };

    const success = _writeRaw(payload);
    if (!success) {
      return { success: false, reason: 'Gagal menulis ke localStorage (mungkin penuh)' };
    }

    return {
      success: true,
      lastSavedAt: now,
      expiresAt: now + TTL_DURATION_MS,
    };
  }

  /* ── 14. Update sebagian data (partial update) ── */
  function update(partialData) {
    if (!_available) return { success: false, reason: 'localStorage tidak tersedia' };

    const existing = load();
    if (!existing) {
      // Tidak ada data sebelumnya → simpan baru
      return save(partialData);
    }

    const merged = Utils.deepMerge(existing, partialData);
    return save(merged);
  }

  /* ── 15. Hapus semua data ── */
  function clear() {
    _clearRaw();
    return true;
  }

  /* ── 16. Ambil info metadata storage ── */
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

  /* ── 17. Estimasi ukuran data tersimpan ── */
  function getStorageSize() {
    if (!_available) return 0;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 0;
      // Perkiraan: 2 bytes per karakter (UTF-16)
      return raw.length * 2;
    } catch {
      return 0;
    }
  }

  /* ── 18. Cek apakah storage tersedia ── */
  function isAvailable() {
    return _available;
  }

  /* ── 19. Destroy (cleanup, untuk testing) ── */
  function destroy() {
    _stopIntervalCheck();
    _onExpiredCallback = null;
  }

  /* ── Public API ── */
  return {
    init,
    load,
    save,
    update,
    clear,
    getMeta,
    getStorageSize,
    isAvailable,
    checkExpiry,
    destroy,
    TTL_DURATION_MS,
  };

})();
