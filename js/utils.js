/* =============================================================
   utils.js — Helper functions yang digunakan di seluruh aplikasi
   ============================================================= */

const Utils = (() => {

  /* ── 1. ID Generator ── */
  function generateId(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /* ── 2. Deep Clone ── */
  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  }

  /* ── 3. Deep Merge (target ← source, tidak mutate target) ── */
  function deepMerge(target, source) {
    const result = deepClone(target);
    if (!source || typeof source !== 'object') return result;
    for (const key of Object.keys(source)) {
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

  /** Format timestamp ke string HH:MM WIB */
  /** Format timestamp ke string DD/MM/YYYY HH:MM */
  function formatDateTime(timestamp) {
    const d = new Date(timestamp);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  /** Format ms ke string "X jam Y menit" atau "Y menit" */
  function formatDuration(ms) {
    if (ms <= 0) return '0 menit';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`;
    if (hours > 0) return `${hours} jam`;
    return `${minutes} menit`;
  }

  /** Format tanggal ISO (YYYY-MM-DD) ke tampilan Indonesia (DD Bulan YYYY) */
  /** Format tanggal ISO ke DD Mon YYYY (e.g. "14 Feb 2012") */
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

  /** Ambil tahun dari ISO date string */
  /* ── 5. String Helpers ── */

  /** Truncate string dengan ellipsis */
  function truncate(str, maxLen = 40) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  /** Capitalize huruf pertama setiap kata */
  /** Escape HTML entities untuk mencegah XSS */
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /** Strip HTML tags */
  /** Pad angka ke jumlah digit */

  /** Query selector wrapper */
  function qs(selector, parent = document) {
    return parent.querySelector(selector);
  }

  /** Query selector all wrapper */
  function qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }

  /** Buat elemen dengan atribut & anak */
  /** Toggle class dengan kondisi opsional */
  /** Set display hidden/visible */
  /* ── 7. File / Image Helpers ── */

  /**
   * Baca file gambar sebagai Data URL (base64).
   * Return Promise<string> atau reject dengan error.
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

  /** Hitung ukuran base64 dalam bytes (approx) */
  function base64SizeBytes(dataUrl) {
    if (!dataUrl) return 0;
    const base64 = dataUrl.split(',')[1] || '';
    return Math.ceil((base64.length * 3) / 4);
  }

  /** Format bytes ke string yang mudah dibaca */
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Kompres gambar ke max lebar/tinggi & kualitas tertentu.
   * Return Promise<string> dataUrl
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

  /* ── 8. Debounce ── */
  const _pendingDebounces = new Set();

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

  /* ── 10. Number Helpers ── */

  /** Clamp value dalam rentang min–max */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /** Parse integer aman, return fallback jika gagal */
  function safeInt(value, fallback = 0) {
    const n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
  }

  /** Parse float aman, return fallback jika gagal */
  function safeFloat(value, fallback = 0) {
    const n = parseFloat(value);
    return isNaN(n) ? fallback : n;
  }


  function isLocalStorageAvailable() {
    try {
      const key = '__storage_test__';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function pxToPt(px) {
    return px / PT_TO_PX;
  }


  /* ── 15. Hitung sisa waktu TTL ── */
  function getRemainingTime(expiresAt) {
    const remaining = expiresAt - Date.now();
    return Math.max(0, remaining);
  }

  /* ── 16. Buat style string dari object ── */
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
    isLocalStorageAvailable,
    getRemainingTime,
    buildStyleString,
  };

})();
