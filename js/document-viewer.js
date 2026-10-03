/* =============================================================
   document-viewer.js — Professional document viewer controls
   =============================================================
   Layer UI-only: mengontrol navigasi halaman, fullscreen/focus mode,
   shortcut keyboard, dan sinkronisasi status viewer.
   Tidak mengubah ukuran fisik dokumen atau output cetak.
   ============================================================= */

const DocumentViewer = (() => {

  let _viewport = null;
  let _preview = null;
  let _initialized = false;
  let _scrollRaf = null;
  let _fullscreenFallback = false;

  function init() {
    if (_initialized) return;

    _viewport = document.getElementById('preview-viewport');
    _preview = document.getElementById('surat-preview');
    if (!_viewport || !_preview) return;

    _initialized = true;

    _bindNavigation();
    _bindFullscreen();
    _bindKeyboard();
    _bindScrollTracking();

    State.on('template:change', () => requestAnimationFrame(_sync));
    State.on('state:reset', () => requestAnimationFrame(_sync));

    _sync();
  }

  function _bindNavigation() {
    document.getElementById('viewer-page-first')?.addEventListener('click', () => _goToPage(1));
    document.getElementById('viewer-page-prev')?.addEventListener('click', () => _goToPage(_getCurrentPage() - 1));
    document.getElementById('viewer-page-next')?.addEventListener('click', () => _goToPage(_getCurrentPage() + 1));
    document.getElementById('viewer-page-last')?.addEventListener('click', () => _goToPage(_getPageCount()));

    document.getElementById('viewer-page-current')?.addEventListener('change', (event) => {
      const value = parseInt(event.target.value, 10);
      if (Number.isFinite(value)) _goToPage(value);
      else _sync();
    });

    document.getElementById('viewer-focus-toggle')?.addEventListener('click', _toggleFocusMode);
  }

  function _bindFullscreen() {
    document.getElementById('viewer-focus-toggle')?.setAttribute(
      'aria-pressed',
      'false'
    );

    document.addEventListener('fullscreenchange', () => {
      const active = document.fullscreenElement === document.getElementById('preview-panel');
      _syncFocusButton(active);
    });
  }

  function _bindKeyboard() {
    document.addEventListener('keydown', (event) => {
      if (!_isViewerKeyboardContext(event)) return;

      if (event.key === 'PageDown' || event.key === 'ArrowRight') {
        if (event.key === 'ArrowRight' && event.ctrlKey) return;
        event.preventDefault();
        _goToPage(_getCurrentPage() + 1);
        return;
      }

      if (event.key === 'PageUp' || event.key === 'ArrowLeft') {
        if (event.key === 'ArrowLeft' && event.ctrlKey) return;
        event.preventDefault();
        _goToPage(_getCurrentPage() - 1);
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        _goToPage(1);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        _goToPage(_getPageCount());
        return;
      }

      if (event.key === '+' || event.key === '=') {
        if (typeof PreviewRenderer?.setZoomMode !== 'function') return;
        event.preventDefault();
        const current = State.getUi().previewZoom || 1;
        State.setZoom(Math.min(2.5, Number((current + 0.1).toFixed(2))));
        return;
      }

      if (event.key === '-' || event.key === '_') {
        if (typeof PreviewRenderer?.setZoomMode !== 'function') return;
        event.preventDefault();
        const current = State.getUi().previewZoom || 1;
        State.setZoom(Math.max(0.3, Number((current - 0.1).toFixed(2))));
        return;
      }

      if (event.key === '0') {
        event.preventDefault();
        PreviewRenderer.setZoomMode('actual');
      }
    });
  }

  function _bindScrollTracking() {
    _viewport.addEventListener('scroll', () => {
      if (_scrollRaf) return;
      _scrollRaf = requestAnimationFrame(() => {
        _scrollRaf = null;
        _syncCurrentPage();
      });
    }, { passive: true });
  }

  function _getPages() {
    const pages = Array.from(_preview.querySelectorAll(':scope > .surat-page'));

    // Pada dokumen multi-halaman, jangan pernah menganggap .doc-content
    // sementara sebagai satu halaman. Renderer akan memberi sinyal refresh
    // setelah semua .surat-page selesai dibentuk.
    if (_preview.classList.contains('surat-preview--document')) {
      return pages;
    }

    if (pages.length) return pages;

    // DPU menggunakan satu halaman langsung di #surat-preview.
    if (_preview.querySelector(':scope > .doc-content')) return [_preview];
    return [];
  }

  function _getPageCount() {
    const pages = _getPages();
    if (pages.length) return pages.length;

    const count = parseInt(_preview.dataset.pageCount || '0', 10);
    return Number.isFinite(count) ? Math.max(0, count) : 0;
  }

  function _getCurrentPage() {
    const pages = _getPages();
    if (!pages.length) return 0;

    const viewportRect = _viewport.getBoundingClientRect();
    const anchor = viewportRect.top + Math.min(64, viewportRect.height * 0.18);

    let bestIndex = 0;
    let bestDistance = Infinity;

    pages.forEach((page, index) => {
      const rect = page.getBoundingClientRect();
      const distance = Math.abs(rect.top - anchor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex + 1;
  }

  function _goToPage(pageNumber) {
    const pages = _getPages();
    if (!pages.length) {
      _sync();
      return;
    }

    const safePage = Math.max(1, Math.min(pageNumber, pages.length));
    pages[safePage - 1]?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
      inline: 'center',
    });

    _setCurrentPageField(safePage);
    _updateNavigationButtons(safePage, pages.length);
  }

  function _syncCurrentPage() {
    const count = _getPageCount();
    if (!count) {
      _setCurrentPageField(0);
      _updateNavigationButtons(0, 0);
      _syncTemplateLabel();
      return;
    }

    const current = _getCurrentPage();
    _setCurrentPageField(current);
    _updateNavigationButtons(current, count);
    _syncTemplateLabel();
  }

  function _setCurrentPageField(page) {
    const input = document.getElementById('viewer-page-current');
    if (!input) return;
    input.value = page > 0 ? String(page) : '';
    input.max = page > 0 ? String(_getPageCount()) : '1';
  }

  function _updateNavigationButtons(current, total) {
    const disabled = total <= 1;
    const first = document.getElementById('viewer-page-first');
    const prev = document.getElementById('viewer-page-prev');
    const next = document.getElementById('viewer-page-next');
    const last = document.getElementById('viewer-page-last');

    if (first) first.disabled = disabled || current <= 1;
    if (prev) prev.disabled = disabled || current <= 1;
    if (next) next.disabled = disabled || current >= total;
    if (last) last.disabled = disabled || current >= total;

    const totalEl = document.getElementById('viewer-page-total');
    if (totalEl) totalEl.textContent = total > 0 ? String(total) : '—';

    const status = document.getElementById('viewer-page-status');
    if (status) status.textContent = total > 0 ? `Halaman ${current} dari ${total}` : 'Belum ada halaman';
  }

  function _syncTemplateLabel() {
    const label = document.getElementById('viewer-template-label');
    if (!label) return;

    const templateId = State.getActiveTemplate();
    const tpl = templateId && typeof TemplateRegistry !== 'undefined'
      ? TemplateRegistry.get(templateId)
      : null;

    label.textContent = tpl?.meta?.name || 'Belum ada dokumen';
    label.title = tpl?.meta?.name || 'Belum ada dokumen';
  }

  function refresh() {
    if (!_initialized) return;
    requestAnimationFrame(_sync);
  }

  function _sync() {
    if (!_initialized) return;
    _syncCurrentPage();
    _syncTemplateLabel();

    const hasDocument = Boolean(State.getActiveTemplate());
    const controls = document.querySelectorAll('#preview-panel .viewer-document-control');
    controls.forEach(control => {
      control.disabled = !hasDocument;
    });
  }

  function _isViewerKeyboardContext(event) {
    if (!document.getElementById('preview-panel')) return false;
    if (event.defaultPrevented) return false;

    const target = event.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return false;
      if (target.isContentEditable) return false;
    }

    const panel = document.getElementById('preview-panel');
    if (!panel || panel.hidden) return false;

    // Saat preview disembunyikan di mobile, panel dibuat inert oleh UI.
    // Shortcut viewer tidak boleh mengambil alih keyboard di editor.
    if (panel.inert || panel.getAttribute('aria-hidden') === 'true') return false;

    return true;
  }

  async function _toggleFocusMode() {
    const panel = document.getElementById('preview-panel');
    if (!panel) return;

    if (document.fullscreenElement === panel) {
      if (document.exitFullscreen) await document.exitFullscreen();
      return;
    }

    if (panel.requestFullscreen) {
      try {
        await panel.requestFullscreen();
        return;
      } catch (error) {
        console.warn('[DocumentViewer] Fullscreen tidak tersedia:', error);
      }
    }

    _fullscreenFallback = !_fullscreenFallback;
    panel.classList.toggle('viewer-focus-mode', _fullscreenFallback);
    _syncFocusButton(_fullscreenFallback);
  }

  function _syncFocusButton(active) {
    const button = document.getElementById('viewer-focus-toggle');
    if (!button) return;

    button.setAttribute('aria-pressed', String(active));
    button.title = active ? 'Keluar dari mode fokus' : 'Mode fokus preview';
    button.setAttribute('aria-label', active ? 'Keluar dari mode fokus preview' : 'Buka preview dalam mode fokus');
    const label = button.querySelector('.viewer-focus-label');
    if (label) label.textContent = active ? 'Keluar Fokus' : 'Fokus';
  }

  return {
    init,
    refresh,
    goToPage: _goToPage,
  };

})();
