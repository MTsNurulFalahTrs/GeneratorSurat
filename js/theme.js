/* =============================================================
   theme.js — Manajemen tema tampilan (light / dark / auto)
   =============================================================
   Tema disimpan di localStorage dengan key 'ui-theme'.
   Nilai: 'light' | 'dark' | 'auto' (default)

   Urutan prioritas:
   1. Pilihan eksplisit pengguna (tersimpan di localStorage)
   2. System preference via prefers-color-scheme
   3. Default: 'auto' (mengikuti sistem)
*/

const Theme = (() => {

  const STORAGE_KEY = 'ui-theme';
  const BUTTON_ID   = 'btn-theme-toggle';

  /** @type {'light'|'dark'|'auto'} */
  let _current = 'auto';

  /* ── Baca preferensi tersimpan ── */
  function _loadSaved() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (['light', 'dark', 'auto'].includes(saved)) return saved;
    } catch {
      /* localStorage tidak tersedia */
    }
    return 'auto';
  }

  /* ── Simpan preferensi ── */
  function _save(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* silent */ }
  }

  /* ── Terapkan tema ke <html> ── */
  function _apply(theme) {
    const html = document.documentElement;

    // Hapus semua class tema sebelumnya
    html.classList.remove('light-mode', 'dark-mode');

    if (theme === 'dark') {
      html.classList.add('dark-mode');
    } else if (theme === 'light') {
      html.classList.add('light-mode');
    }
    // 'auto' — tidak ada class, CSS media query yang berlaku

    // Update button state
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.dataset.theme = theme;
      const labels = {
        light: 'Mode Terang',
        dark:  'Mode Gelap',
        auto:  'Tema Otomatis (mengikuti sistem)',
      };
      btn.setAttribute('title',      labels[theme] || 'Ganti tema');
      btn.setAttribute('aria-label', labels[theme] || 'Ganti tema');
    }
  }

  /* ── Rotasi: auto → light → dark → auto ── */
  function _nextTheme(current) {
    const cycle = { auto: 'light', light: 'dark', dark: 'auto' };
    return cycle[current] || 'auto';
  }

  /* ── Toggle: klik tombol merotasi tema ── */
  function toggle() {
    const next = _nextTheme(_current);
    set(next);
  }

  /* ── Set tema secara eksplisit ── */
  function set(theme) {
    if (!['light', 'dark', 'auto'].includes(theme)) return;
    _current = theme;
    _save(theme);
    _apply(theme);
  }

  /* ── Getter tema aktif ── */
  function get() {
    return _current;
  }

  /* ── Apakah saat ini tampil gelap? (actual, bukan setting) ── */
  function isDark() {
    if (_current === 'dark') return true;
    if (_current === 'light') return false;
    // 'auto' — cek system preference
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
  }

  /* ── Init ── */
  function init() {
    // Terapkan tema seawal mungkin untuk menghindari FOUC (flash of unstyled content)
    _current = _loadSaved();
    _apply(_current);

    // Bind tombol toggle
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.addEventListener('click', toggle);
    }

    // Respons perubahan system preference saat tema 'auto'
    try {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (_current === 'auto') _apply('auto');
        });
    } catch { /* browser lama tidak mendukung addEventListener pada matchMedia */ }
  }

  return { init, set, get, toggle, isDark };

})();
