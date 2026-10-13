/* =============================================================
   utils.js — Helper functions yang digunakan di seluruh aplikasi
   ============================================================= */

const Utils = (() => {

  /* ── 1. ID Generator ── */
  /**
   * Generate ID unik dengan prefix.
   * @param {string} [prefix='id']
   * @returns {string}
   */
  function generateId(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /* ── 2. Deep Clone ── */
  /**
   * Buat salinan dalam (deep clone) dari sebuah nilai.
   * @template T
   * @param {T} obj
   * @returns {T}
   */
  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  }

  /* ── 3. Deep Merge (target ← source, tidak mutate target) ── */
  /**
   * Merge rekursif source ke dalam target tanpa mutasi.
   * @template T
   * @param {T} target
   * @param {Partial<T>} source
   * @returns {T}
   */
  function deepMerge(target, source) {
    const result = deepClone(target);
    if (!source || typeof source !== 'object') return result;
    for (const key of Object.keys(source)) {
      // Jangan izinkan key prototype masuk ke recursive merge; data restore/import
      // adalah input yang dapat berasal dari file eksternal.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        result[key] !== null &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = deepClone(source[key]);
      }
    }
    return result;
  }

  /* ── 4. Tanggal & Waktu ── */

  /**
   * Format timestamp ke string DD/MM/YYYY HH:MM
   * @param {number} timestamp - Unix timestamp dalam ms
   * @returns {string}
   */
  function formatDateTime(timestamp) {
    const d = new Date(timestamp);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  /**
   * Format ms ke string "X jam Y menit" atau "Y menit"
   * @param {number} ms
   * @returns {string}
   */
  function formatDuration(ms) {
    if (ms <= 0) return '0 menit';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`;
    if (hours > 0) return `${hours} jam`;
    return `${minutes} menit`;
  }

  /**
   * Format tanggal ISO ke DD Mon YYYY (e.g. "14 Feb 2012")
   * @param {string} isoDate - Tanggal dalam format YYYY-MM-DD
   * @returns {string}
   */
  function formatDateShort(isoDate) {
    if (!isoDate) return '';
    const bulan = [
      'Jan','Feb','Mar','Apr','Mei','Jun',
      'Jul','Agu','Sep','Okt','Nov','Des'
    ];
    const parts = isoDate.split('-');
    if (parts.length < 3) return isoDate;
    const [yyyy, mm, dd] = parts;
    const monthIdx = parseInt(mm, 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) return isoDate;
    return `${parseInt(dd, 10)} ${bulan[monthIdx]} ${yyyy}`;
  }

  /* ── 5. String Helpers ── */

  /**
   * Truncate string dengan ellipsis
   * @param {string} str
   * @param {number} [maxLen=40]
   * @returns {string}
   */
  function truncate(str, maxLen = 40) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  /**
   * Escape HTML entities untuk mencegah XSS.
   * @param {*} str - Nilai yang akan di-escape (dikonversi ke string jika bukan string)
   * @returns {string}
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }


  /* ── 6. File / Image Helpers ── */

  /**
   * Baca file gambar sebagai Data URL (base64).
   * @param {File} file
   * @returns {Promise<string>}
   */
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('File tidak ditemukan.'));
        return;
      }
      if (!file.type.startsWith('image/')) {
        reject(new Error('File harus berupa gambar (PNG, JPG, GIF, WebP, dll).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Hitung ukuran base64 dalam bytes (approx)
   * @param {string} dataUrl
   * @returns {number}
   */
  function base64SizeBytes(dataUrl) {
    if (!dataUrl) return 0;
    const base64 = dataUrl.split(',')[1] || '';
    return Math.ceil((base64.length * 3) / 4);
  }

  /**
   * Format bytes ke string yang mudah dibaca (B, KB, MB)
   * @param {number} bytes
   * @returns {string}
   */
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Kompres gambar ke max lebar/tinggi & kualitas tertentu.
   * @param {string} dataUrl - Data URL gambar sumber
   * @param {number} [maxWidth=200]
   * @param {number} [maxHeight=200]
   * @param {number} [quality=0.85]
   * @returns {Promise<string>} Data URL hasil kompresi
   */
  function compressImage(dataUrl, maxWidth = 200, maxHeight = 200, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', quality));
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi.'));
      img.src = dataUrl;
    });
  }

  /* ── 7. Debounce ── */
  const _pendingDebounces = new Set();

  /**
   * Buat fungsi debounced — hanya dipanggil setelah `delay` ms tanpa invokasi baru.
   * @template {(...args: any[]) => any} F
   * @param {F} fn
   * @param {number} [delay=300]
   * @returns {F & { cancel: () => void, flush: () => ReturnType<F> | undefined }}
   */
  function debounce(fn, delay = 300) {
    let timer = null;
    let lastArgs = [];
    let lastThis = null;

    const invoke = () => {
      timer = null;
      _pendingDebounces.delete(debounced);

      const args = lastArgs;
      const context = lastThis;
      lastArgs = [];
      lastThis = null;

      return fn.apply(context, args);
    };

    function debounced(...args) {
      clearTimeout(timer);
      lastArgs = args;
      lastThis = this;
      _pendingDebounces.add(debounced);
      timer = setTimeout(invoke, delay);
    }

    debounced.cancel = () => {
      clearTimeout(timer);
      timer = null;
      lastArgs = [];
      lastThis = null;
      _pendingDebounces.delete(debounced);
    };

    debounced.flush = () => {
      if (timer === null) return undefined;
      clearTimeout(timer);
      return invoke();
    };

    return debounced;
  }

  /** Flush semua debounce yang sedang pending */
  function flushDebounces() {
    // Salin snapshot supaya callback yang dijalankan tidak mengubah iterator.
    Array.from(_pendingDebounces).forEach(fn => {
      try {
        fn.flush?.();
      } catch (err) {
        console.warn('[Utils] Gagal flush debounce:', err);
      }
    });
  }

  /* ── 8. Number Helpers ── */

  /**
   * Clamp value dalam rentang min–max
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Parse integer aman, return fallback jika gagal
   * @param {*} value
   * @param {number} [fallback=0]
   * @returns {number}
   */
  function safeInt(value, fallback = 0) {
    const n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
  }

  /**
   * Parse float aman, return fallback jika gagal
   * @param {*} value
   * @param {number} [fallback=0]
   * @returns {number}
   */
  function safeFloat(value, fallback = 0) {
    const n = parseFloat(value);
    return isNaN(n) ? fallback : n;
  }


  /* ── 9. Hitung sisa waktu TTL ── */
  /**
   * Hitung sisa waktu dalam ms hingga expiresAt.
   * @param {number} expiresAt - Unix timestamp ms
   * @returns {number} Sisa ms, minimum 0
   */
  function getRemainingTime(expiresAt) {
    const remaining = expiresAt - Date.now();
    return Math.max(0, remaining);
  }

  /* ── 10. Buat style string dari object ── */
  /**
   * Konversi object CSS ke string style inline.
   * @param {Record<string, string|number|null|undefined>} styleObj
   * @returns {string}
   */
  function buildStyleString(styleObj) {
    return Object.entries(styleObj)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => {
        // camelCase → kebab-case
        const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${prop}: ${v}`;
      })
      .join('; ');
  }

  /* ── Public API ── */
  return {
    generateId,
    deepClone,
    deepMerge,
    formatDateTime,
    formatDuration,
    formatDateShort,
    truncate,
    escapeHtml,
    readFileAsDataUrl,
    base64SizeBytes,
    formatBytes,
    compressImage,
    debounce,
    flushDebounces,
    clamp,
    safeInt,
    safeFloat,
    getRemainingTime,
    buildStyleString,
  };

})();
