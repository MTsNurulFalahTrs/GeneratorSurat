/* =============================================================
   app.js — Entry point, inisialisasi seluruh aplikasi
   ============================================================= */

const App = (() => {

  let _initialized = false;

  /* ── Boot sequence ── */
  function init() {
    if (_initialized) return;
    _initialized = true;

    try {
      _boot();
    } catch (err) {
      console.error('[App] Fatal error saat init:', err);
      _showFatalError(err);
    }
  }

  function _boot() {

    /* 1. Inisialisasi template registry */
    TemplateRegistry.init();

    /* 2. Inisialisasi storage dan cek TTL */
    const storageResult = Storage.init({
      onExpired: _handleDataExpired,
    });

    State.setStorageMeta({ available: storageResult.available });

    /* 3. Restore data dari storage (jika ada dan belum expired) */
    let wasRestored = false;
    if (storageResult.available && storageResult.hasData && !storageResult.expired) {
      const saved = Storage.load();
      if (saved) {
        State.restore(saved);
        wasRestored = true;

        // Sync storage meta ke state
        const meta = Storage.getMeta();
        if (meta) {
          State.setStorageMeta({
            lastSavedAt: meta.lastSavedAt,
            expiresAt:   meta.expiresAt,
            available:   true,
          });
        }
      }
    }

    /* 4. Init UI components */
    UI.initTabs();
    UI.initPanelResizer();
    UI.initMobilePreviewToggle();

    // Beri peringatan saat aplikasi dibuka pada viewport mobile.
    _showMobileWarning();

    /* 5. Render template list */
    TemplateRegistry.renderTemplateList(
      document.getElementById('template-list'),
      State.getActiveTemplate(),
      _handleTemplateSelect
    );

    /* 6. Init KOP Editor */
    KopEditor.init();

    /* 7. Init Form Renderer */
    FormRenderer.init();

    /* 8. Init Preview Renderer */
    PreviewRenderer.init();

    /* 9. Init Document Viewer */
    if (typeof DocumentViewer !== 'undefined') {
      DocumentViewer.init();
    }

    /* 10. Init Settings */
    if (typeof Settings !== 'undefined') {
      Settings.init();
    } else {
      console.warn('[App] Settings module tidak tersedia.');
    }

    /* 11. Init UX workflow controller */
    if (typeof Workflow !== "undefined") {
      Workflow.init();
    }

    /* 12. Bind header action buttons */
    _bindHeaderButtons();

    /* 13. Update storage info display */
    if (wasRestored) {
      const meta = Storage.getMeta();
      UI.updateStorageInfo(meta);
      if (typeof Settings !== 'undefined') Settings.updateStorageStatus();
    }
    UI.startStorageInfoRefresh();

    /* 14. Jika template sudah terpilih (restore), render form dan switch ke tab form */
    if (wasRestored && State.getActiveTemplate()) {
      const activeId = State.getActiveTemplate();

      // Update kartu template aktif
      TemplateRegistry.updateActiveCard(
        document.getElementById('template-list'),
        activeId
      );

      // Render form
      FormRenderer.render(activeId);

      // Jika ada data form, pindah ke tab form
      UI.switchTab('form');

      UI.toast('Data sebelumnya berhasil dimuat kembali.', 'success');
    }

    /* 15. Subscribe state changes untuk auto-save peringatan */
    State.on('state:change', _onStateChange);

    /* 16. Warn sebelum user menutup halaman kalau ada data belum disimpan */
    window.addEventListener('beforeunload', (e) => {
      if (State.isDirty()) {
        e.preventDefault();
        e.returnValue = 'Ada perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
      }
    });

    console.info('[App] Aplikasi siap.');
  }

  /* ── Peringatan untuk perangkat mobile ── */
  function _isMobileViewport() {
    return window.matchMedia?.('(max-width: 767px)').matches === true;
  }

  function _showMobileWarning() {
    if (!_isMobileViewport()) return;

    // Mobile tetap didukung; berikan konteks tanpa menghalangi pekerjaan pengguna.
    UI.toast(
      'Aplikasi tetap dapat digunakan di perangkat mobile. Untuk pengeditan data dan tabel yang sangat padat, layar yang lebih lebar akan lebih nyaman.',
      'info',
      5500
    );
  }

  /* ── Handle template dipilih ── */
  function _handleTemplateSelect(templateId) {
    if (State.getActiveTemplate() === templateId) {
      // Template sudah aktif; tetap arahkan ke langkah KOP.
      UI.switchTab('kop');
      return;
    }

    State.setActiveTemplate(templateId);

    // Terapkan orientasi/ukuran bawaan template sebagai titik awal dokumen.
    // DPU secara spesifik mendefinisikan A4 Landscape, sehingga pagination
    // tidak lagi dihitung pada layout portrait default aplikasi.
    const selectedTemplate = TemplateRegistry.get(templateId);
    const templateOrientation = selectedTemplate?.meta?.orientation;
    const templatePaperSize = selectedTemplate?.meta?.paperSize;
    const settingsPatch = {};
    if (templateOrientation === 'portrait' || templateOrientation === 'landscape') {
      settingsPatch.orientation = templateOrientation;
    }
    if (typeof templatePaperSize === 'string' && templatePaperSize.trim()) {
      settingsPatch.paper = { size: templatePaperSize, unit: 'mm' };
    }
    if (Object.keys(settingsPatch).length) {
      State.setSettings(settingsPatch);
    }

    // Update kartu aktif
    TemplateRegistry.updateActiveCard(
      document.getElementById('template-list'),
      templateId
    );

    // Setelah memilih template, pengguna melanjutkan ke konfigurasi KOP.
    UI.switchTab('kop');

    UI.toast(`Template "${TemplateRegistry.get(templateId)?.meta?.name}" dipilih.`, 'info', 2500);
  }

  /* ── Bind tombol header ── */
  function _bindHeaderButtons() {
    // Simpan
    document.getElementById('btn-save')?.addEventListener('click', _handleSave);

    // Cetak
    document.getElementById('btn-print')?.addEventListener('click', () => {
      if (typeof Workflow !== "undefined" && typeof Workflow.preparePrint === "function") {
        Workflow.preparePrint();
      } else {
        Print.printDocument();
      }
    });

    // Reset
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      UI.confirm(
        'Reset Data',
        'Semua data yang belum disimpan akan dihapus. Data di penyimpanan lokal juga akan dihapus. Lanjutkan?',
        _handleReset
      );
    });
  }

  /* ── Handler Simpan ── */
  function _handleSave() {
    if (!Storage.isAvailable()) {
      UI.toast('Penyimpanan lokal tidak tersedia di browser ini.', 'error');
      return;
    }

    const serialized = State.serialize();
    const result = Storage.save(serialized);

    if (result.success) {
      State.markSaved(result);
      const meta = Storage.getMeta();
      UI.updateStorageInfo(meta);
      if (typeof Settings !== 'undefined') Settings.updateStorageStatus();
      UI.toast('Data berhasil disimpan.', 'success');
    } else {
      UI.toast(`Gagal menyimpan: ${result.reason}`, 'error');
    }
  }

  /* ── Handler Reset ── */
  function _handleReset() {
    Storage.clear();
    if (typeof DataManager !== 'undefined' && typeof DataManager.clearAllDrafts === 'function') {
      DataManager.clearAllDrafts();
    }
    State.reset();

    // Re-render template list tanpa active
    TemplateRegistry.renderTemplateList(
      document.getElementById('template-list'),
      null,
      _handleTemplateSelect
    );

    // Kembali ke tab template
    UI.switchTab('template');

    // Reset storage info
    UI.updateStorageInfo(null);
    UI.hideExpiredBanner();
    if (typeof Settings !== 'undefined') Settings.updateStorageStatus();

    UI.toast('Data berhasil direset.', 'info');
  }

  /* ── Handler data expired ── */
  function _handleDataExpired() {
    State.reset();

    TemplateRegistry.renderTemplateList(
      document.getElementById('template-list'),
      null,
      _handleTemplateSelect
    );

    UI.switchTab('template');
    UI.updateStorageInfo(null);
    UI.showExpiredBanner(
      'Data lokal telah kedaluwarsa (lebih dari 2 jam sejak penyimpanan terakhir) dan dihapus otomatis.'
    );
    if (typeof Settings !== 'undefined') Settings.updateStorageStatus();
  }

  /* ── On state change (auto-save indicator) ── */
  let _autoSaveTimer = null;
  function _onStateChange() {
    // Feedback persistence tetap non-blocking: pengguna diberi tahu bahwa
    // perubahan belum tersimpan tanpa memicu penyimpanan otomatis.
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => {
      const saveBtn = document.getElementById('btn-save');
      if (saveBtn) {
        saveBtn.title = State.isDirty()
          ? 'Ada perubahan yang belum disimpan'
          : 'Simpan data ke penyimpanan lokal';
      }

      if (State.isDirty()) {
        UI.markStorageDirty();
      } else {
        const meta = Storage.getMeta();
        UI.updateStorageInfo(meta);
      }
    }, 250);
  }

  /* ── Fatal error fallback ── */
  function _showFatalError(err) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;
        min-height:100vh;padding:2rem;font-family:system-ui,sans-serif;">
        <div style="max-width:480px;text-align:center;">
          <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
          <h1 style="margin-bottom:.5rem;font-size:1.25rem;">Aplikasi tidak dapat dimuat</h1>
          <p style="color:#64748b;margin-bottom:1.5rem;">
            Terjadi kesalahan saat memulai aplikasi. Coba muat ulang halaman.
          </p>
          <button onclick="location.reload()"
            style="padding:.5rem 1.5rem;background:#2563eb;color:white;
              border:none;border-radius:6px;cursor:pointer;font-size:1rem;">
            Muat Ulang
          </button>
          <details style="margin-top:1.5rem;text-align:left;">
            <summary style="cursor:pointer;color:#94a3b8;font-size:.8rem;">Detail error</summary>
            <pre style="font-size:.75rem;color:#dc2626;background:#fef2f2;
              padding:.75rem;border-radius:4px;margin-top:.5rem;overflow:auto;">
${Utils.escapeHtml(err?.stack || err?.message || String(err))}
            </pre>
          </details>
        </div>
      </div>`;
  }

  /* ── Public API ── */
  function switchTab(tabId) {
    UI.switchTab(tabId);
  }

  /* ── DOMContentLoaded ── */
  // Selalu gunakan event listener agar semua script dipastikan sudah di-parse
  // sebelum init() dipanggil, menghindari ReferenceError pada modul yang
  // di-load tepat sebelum app.js (mis. Settings, PreviewRenderer).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM sudah siap, tapi tunda 1 tick agar semua const/IIFE di script
    // sebelumnya selesai didefinisikan di scope global
    setTimeout(init, 0);
  }

  return {
    init,
    switchTab,
    selectTemplate: _handleTemplateSelect,
    save:  _handleSave,
    reset: _handleReset,
  };
})();

// Expose ke window agar bisa dipanggil dari HTML attribute onclick dan modul lain
window.App = App;
