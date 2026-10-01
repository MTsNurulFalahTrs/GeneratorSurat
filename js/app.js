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

    /* 9. Bind header action buttons */
    _bindHeaderButtons();

    /* 10. Update storage info display */
    if (wasRestored) {
      const meta = Storage.getMeta();
      UI.updateStorageInfo(meta);
    }
    UI.startStorageInfoRefresh();

    /* 11. Jika template sudah terpilih (restore), render form dan switch ke tab form */
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

    /* 12. Subscribe state changes untuk auto-save peringatan */
    State.on('state:change', _onStateChange);

    /* 13. Warn sebelum user menutup halaman kalau ada data belum disimpan */
    window.addEventListener('beforeunload', (e) => {
      if (State.isDirty()) {
        e.preventDefault();
        e.returnValue = 'Ada perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
      }
    });

    console.info('[App] Aplikasi siap.');
  }

  /* ── Handle template dipilih ── */
  function _handleTemplateSelect(templateId) {
    if (State.getActiveTemplate() === templateId) {
      // Sudah aktif, langsung ke tab form
      UI.switchTab('form');
      return;
    }

    State.setActiveTemplate(templateId);

    // Update kartu aktif
    TemplateRegistry.updateActiveCard(
      document.getElementById('template-list'),
      templateId
    );

    // Pindah ke tab form
    UI.switchTab('form');

    UI.toast(`Template "${TemplateRegistry.get(templateId)?.meta?.name}" dipilih.`, 'info', 2500);
  }

  /* ── Bind tombol header ── */
  function _bindHeaderButtons() {
    // Simpan
    document.getElementById('btn-save')?.addEventListener('click', _handleSave);

    // Cetak
    document.getElementById('btn-print')?.addEventListener('click', () => {
      Print.printDocument();
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
      UI.updateStorageInfo(Storage.getMeta());
      UI.toast('Data berhasil disimpan.', 'success');
    } else {
      UI.toast(`Gagal menyimpan: ${result.reason}`, 'error');
    }
  }

  /* ── Handler Reset ── */
  function _handleReset() {
    Storage.clear();
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

    UI.toast('Data berhasil direset.', 'info');
  }

  /* ── Handler data expired ── */
  function _handleDataExpired() {
    State.reset();

    // Re-render template list
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
  }

  /* ── On state change (auto-save indicator) ── */
  let _autoSaveTimer = null;
  function _onStateChange() {
    // Debounced indicator: tampilkan tanda "belum tersimpan" setelah 1 detik idle
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => {
      if (State.isDirty()) {
        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) saveBtn.title = 'Ada perubahan yang belum disimpan';
      }
    }, 1000);
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM sudah siap
    init();
  }

  return {
    init,
    switchTab,
    save: _handleSave,
    reset: _handleReset,
  };

})();

// Expose ke window agar bisa dipanggil dari HTML attribute onclick
window.App = App;
