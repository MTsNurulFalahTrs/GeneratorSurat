/* =============================================================
   ui.js — Komponen UI: Modal, Toast, Konfirmasi, Storage Info
   ============================================================= */

const UI = (() => {

  /* ── Toast ── */
  const TOAST_DURATION = 4000;

  const TOAST_CONFIG = {
    success: { icon: '✅', title: 'Berhasil'    },
    error:   { icon: '❌', title: 'Error'       },
    warning: { icon: '⚠️', title: 'Perhatian'  },
    info:    { icon: 'ℹ️', title: 'Informasi'  },
  };

  function toast(message, type = 'info', duration = TOAST_DURATION) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const cfg    = TOAST_CONFIG[type] || TOAST_CONFIG.info;
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast--${type}`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');

    toastEl.innerHTML = `
      <span class="toast__icon">${cfg.icon}</span>
      <div class="toast__body">
        <div class="toast__title">${Utils.escapeHtml(cfg.title)}</div>
        <div class="toast__message">${Utils.escapeHtml(message)}</div>
      </div>
      <button class="toast__close" aria-label="Tutup notifikasi">&times;</button>`;

    container.appendChild(toastEl);

    // Close button
    toastEl.querySelector('.toast__close').addEventListener('click', () => _removeToast(toastEl));

    // Auto remove
    const timer = setTimeout(() => _removeToast(toastEl), duration);

    // Pause on hover
    toastEl.addEventListener('mouseenter', () => clearTimeout(timer));
    toastEl.addEventListener('mouseleave', () => {
      setTimeout(() => _removeToast(toastEl), 1500);
    });
  }

  function _removeToast(el) {
    if (!el || el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // fallback
  }

  /* ── Modal ── */
  let _modalEscHandler = null;
  let _modalPreviousFocus = null;

  function _getModalEls() {
    return {
      overlay:  document.getElementById('modal-overlay'),
      title:    document.getElementById('modal-title'),
      body:     document.getElementById('modal-body'),
      footer:   document.getElementById('modal-footer'),
      closeBtn: document.getElementById('modal-close-btn'),
    };
  }

  function showModal({
    title,
    body,
    footer,
    onClose,
    closeOnBackdrop = true,
    closeOnEscape = true,
    showCloseButton = true,
    initialFocusSelector = null,
  }) {
    const { overlay, title: titleEl, body: bodyEl, footer: footerEl, closeBtn } = _getModalEls();
    if (!overlay) return;

    // Simpan fokus sebelum dialog dibuka agar dikembalikan setelah ditutup.
    _modalPreviousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    // Hapus listener ESC lama jika ada dialog yang digantikan.
    if (_modalEscHandler) {
      document.removeEventListener('keydown', _modalEscHandler);
      _modalEscHandler = null;
    }

    titleEl.textContent  = title || '';
    bodyEl.innerHTML     = typeof body === 'string' ? body : '';
    footerEl.innerHTML   = '';

    closeBtn.hidden = !showCloseButton;
    closeBtn.tabIndex = showCloseButton ? 0 : -1;
    closeBtn.setAttribute('aria-hidden', String(!showCloseButton));

    if (footer && Array.isArray(footer)) {
      footer.forEach(btnConfig => {
        const btn = document.createElement('button');
        btn.className   = `btn ${btnConfig.class || 'btn--secondary'}`;
        btn.textContent = btnConfig.label || '';
        if (btnConfig.disabled === true) btn.disabled = true;
        btn.addEventListener('click', () => {
          if (typeof btnConfig.onClick === 'function') btnConfig.onClick();
          if (btnConfig.closeOnClick !== false) hideModal();
        });
        footerEl.appendChild(btn);
      });
    }

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');

    // Close handlers
    const handleClose = () => {
      hideModal();
      if (typeof onClose === 'function') onClose();
    };

    closeBtn.onclick = handleClose;
    overlay.onclick  = (e) => {
      if (e.target === overlay && closeOnBackdrop) handleClose();
    };

    // ESC key
    if (closeOnEscape) {
      const escHandler = (e) => {
        if (e.key === 'Escape') handleClose();
      };
      _modalEscHandler = escHandler;
      document.addEventListener('keydown', escHandler);
    }

    // Fokus ke elemen yang relevan pada modal.
    setTimeout(() => {
      const initial = initialFocusSelector
        ? bodyEl.querySelector(initialFocusSelector)
        : null;
      if (initial && typeof initial.focus === 'function') {
        initial.focus();
        return;
      }
      const fallback = showCloseButton
        ? closeBtn
        : footerEl.querySelector('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
      if (fallback && typeof fallback.focus === 'function') fallback.focus();
    }, 50);
  }

  function hideModal() {
    const { overlay } = _getModalEls();
    if (!overlay) return;

    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');

    if (_modalEscHandler) {
      document.removeEventListener('keydown', _modalEscHandler);
      _modalEscHandler = null;
    }


    const restore = _modalPreviousFocus;
    _modalPreviousFocus = null;
    if (restore && document.contains(restore)) {
      requestAnimationFrame(() => restore.focus());
    }
  }

  /* ── Konfirmasi Dialog ── */
  function confirm(title, message, onConfirm, onCancel) {
    showModal({
      title,
      body: `<p>${Utils.escapeHtml(message)}</p>`,
      footer: [
        {
          label: 'Batal',
          class: 'btn--secondary',
          onClick: () => { if (typeof onCancel === 'function') onCancel(); },
        },
        {
          label: 'Ya, Lanjutkan',
          class: 'btn--danger',
          onClick: () => { if (typeof onConfirm === 'function') onConfirm(); },
        },
      ],
    });
  }

  /* ── Expired Banner ── */
  function showExpiredBanner(message) {
    const banner  = document.getElementById('expired-banner');
    const textEl  = document.getElementById('expired-banner-text');
    const closeEl = document.getElementById('expired-banner-close');

    if (!banner) return;
    if (textEl) textEl.textContent = message || 'Data lokal telah kedaluwarsa dan dihapus otomatis.';
    banner.classList.remove('hidden');

    if (closeEl) {
      closeEl.onclick = () => banner.classList.add('hidden');
    }

    // Auto hide setelah 8 detik
    setTimeout(() => banner.classList.add('hidden'), 8000);
  }

  function hideExpiredBanner() {
    document.getElementById('expired-banner')?.classList.add('hidden');
  }

  /* ── Storage Info (header) ── */
  function updateStorageInfo(meta) {
    const wrap   = document.getElementById('storage-info');
    const textEl = document.getElementById('storage-info-text');

    if (!wrap || !textEl) return;

    if (!meta || !meta.lastSavedAt) {
      wrap.classList.remove('storage-info--dirty');
      wrap.classList.add('hidden');
      return;
    }

    wrap.classList.remove('storage-info--dirty');

    const remaining = Utils.getRemainingTime(meta.expiresAt);
    const savedAt   = Utils.formatDateTime(meta.lastSavedAt);
    const remStr    = Utils.formatDuration(remaining);

    if (remaining <= 0) {
      wrap.classList.add('hidden');
      return;
    }

    textEl.textContent = `Tersimpan ${savedAt} · Kedaluwarsa dalam ${remStr}`;
    wrap.classList.remove('hidden');
    wrap.title = `Data tersimpan di perangkat ini dan akan dihapus otomatis setelah 2 jam sejak penyimpanan terakhir.\nPenyimpanan terakhir: ${savedAt}`;
  }

  /* ── Tandai ada perubahan yang belum disimpan ── */
  function markStorageDirty() {
    const wrap = document.getElementById('storage-info');
    const textEl = document.getElementById('storage-info-text');
    if (!wrap || !textEl) return;

    const meta = Storage.getMeta();
    const savedAt = meta?.lastSavedAt ? Utils.formatDateTime(meta.lastSavedAt) : null;

    wrap.classList.add('storage-info--dirty');
    wrap.classList.remove('hidden');
    textEl.textContent = savedAt
      ? 'Belum disimpan · Terakhir disimpan ' + savedAt
      : 'Belum disimpan';
    wrap.title = savedAt
      ? 'Ada perubahan yang belum disimpan. Penyimpanan terakhir: ' + savedAt
      : 'Ada perubahan yang belum disimpan. Klik Simpan untuk menyimpan data.';
  }

  /* ── Refresh storage info setiap menit ── */
  function startStorageInfoRefresh() {
    setInterval(() => {
      const meta = Storage.getMeta();
      if (meta) updateStorageInfo(meta);
    }, 30000); // update setiap 30 detik
  }

  /* ── Tab navigation ── */
  function initTabs() {
    const tabs    = document.querySelectorAll('.editor-tab');
    const contents = document.querySelectorAll('.editor-tab-content');

    tabs.forEach(tab => {
      tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        switchTab(target, tabs, contents);
      });

      // Navigasi tab berbasis keyboard sesuai pola tablist ARIA.
      tab.addEventListener('keydown', (e) => {
        const list = Array.from(tabs);
        const current = list.indexOf(tab);
        if (current === -1) return;

        let nextIndex = current;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (current + 1) % list.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = (current - 1 + list.length) % list.length;
        else if (e.key === 'Home') nextIndex = 0;
        else if (e.key === 'End') nextIndex = list.length - 1;
        else return;

        e.preventDefault();
        const next = list[nextIndex];
        switchTab(next.dataset.tab, tabs, contents);
        next.focus();
      });
    });
  }

  function switchTab(tabId, tabs, contents) {
    const allTabs     = tabs     || document.querySelectorAll('.editor-tab');
    const allContents = contents || document.querySelectorAll('.editor-tab-content');

    allTabs.forEach(t => {
      const isActive = t.dataset.tab === tabId;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', String(isActive));
      t.tabIndex = isActive ? 0 : -1;
    });

    allContents.forEach(c => {
      const isActive = c.id === `tab-${tabId}`;
      c.classList.toggle('active', isActive);
    });

    State.setActiveTab(tabId);

    // Refresh storage status setiap kali tab Settings dibuka
    if (tabId === 'settings' && typeof Settings !== 'undefined') {
      Settings.updateStorageStatus();
    }
  }


  /* ── Mobile: tampil/sembunyikan preview ── */
  let _mobilePreviewVisible = true;

  function initMobilePreviewToggle() {
    const btn      = document.getElementById('mobile-preview-toggle');
    const appBody  = document.querySelector('.app-body');
    const preview  = document.getElementById('preview-panel');
    if (!btn || !appBody || !preview) return;

    const media = window.matchMedia?.('(max-width: 767px)');
    const isMobile = () => media?.matches === true;

    const setVisible = (visible) => {
      _mobilePreviewVisible = !!visible;

      // Di luar viewport mobile, preview selalu tampil.
      if (!isMobile()) {
        appBody.classList.remove('is-mobile-preview-hidden');
        preview.removeAttribute('aria-hidden');
        preview.inert = false;
        btn.setAttribute('aria-expanded', 'true');
        btn.title = 'Sembunyikan preview surat';
        btn.querySelector('.mobile-preview-toggle__label')?.replaceChildren(
          document.createTextNode('Sembunyikan Preview')
        );
        return;
      }

      appBody.classList.toggle('is-mobile-preview-hidden', !visible);
      preview.setAttribute('aria-hidden', String(!visible));
      preview.inert = !visible;
      btn.setAttribute('aria-expanded', String(visible));
      btn.title = visible ? 'Sembunyikan preview surat' : 'Tampilkan preview surat';

      const label = btn.querySelector('.mobile-preview-toggle__label');
      if (label) {
        label.textContent = visible ? 'Sembunyikan Preview' : 'Tampilkan Preview';
      }
    };

    btn.addEventListener('click', () => setVisible(!_mobilePreviewVisible));

    if (media) {
      const handleViewportChange = (e) => {
        if (!e.matches) {
          // Saat kembali ke desktop/tablet, preview wajib terlihat kembali.
          setVisible(true);
        } else {
          setVisible(_mobilePreviewVisible);
        }
      };

      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', handleViewportChange);
      } else if (typeof media.addListener === 'function') {
        media.addListener(handleViewportChange);
      }
    }

    setVisible(true);
  }

  /* ── Panel Resizer (drag to resize editor panel) ── */
  function initPanelResizer() {
    const resizer   = document.getElementById('panel-resizer');
    const panel     = document.getElementById('editor-panel');
    if (!resizer || !panel) return;

    let startX = 0;
    let startW = 0;
    let dragging = false;

    const MIN_W = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--editor-panel-min') || '320');
    const MAX_W = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--editor-panel-max') || '600');

    resizer.addEventListener('mousedown', (e) => {
      dragging  = true;
      startX    = e.clientX;
      startW    = panel.offsetWidth;
      resizer.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const delta  = e.clientX - startX;
      const newW   = Utils.clamp(startW + delta, MIN_W, MAX_W);
      panel.style.width = `${newW}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      resizer.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });

    // Touch support
    resizer.addEventListener('touchstart', (e) => {
      dragging = true;
      startX   = e.touches[0].clientX;
      startW   = panel.offsetWidth;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const delta = e.touches[0].clientX - startX;
      const newW  = Utils.clamp(startW + delta, MIN_W, MAX_W);
      panel.style.width = `${newW}px`;
    }, { passive: true });

    document.addEventListener('touchend', () => { dragging = false; });
  }

  /* ── Aksesibilitas: focus trap di modal ── */
  document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (e.key !== 'Tab') return;

    const focusable = Array.from(overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled && !el.hidden && el.offsetParent !== null);
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (!first || !last) return;

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });

  /* ── Public API ── */
  return {
    toast,
    showModal,
    hideModal,
    confirm,
    showExpiredBanner,
    hideExpiredBanner,
    updateStorageInfo,
    markStorageDirty,
    startStorageInfoRefresh,
    initTabs,
    switchTab,
    initPanelResizer,
    initMobilePreviewToggle,
  };

})();
