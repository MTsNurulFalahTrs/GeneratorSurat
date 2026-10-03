/* =============================================================
   data-manager.js — Phase 4: Advanced Data Management
   =============================================================
   Menyediakan workspace data lokal tingkat lanjut tanpa mengganti
   storage legacy yang sudah dipakai untuk pemulihan cepat.

   Fitur:
   - Draft bernama dengan penyimpanan persisten tanpa TTL.
   - Daftar, muat, dan hapus draft.
   - Export/import backup JSON.
   - Ringkasan data aktif dan ukuran backup.
   - Proteksi validasi sebelum restore data eksternal.
*/

const DataManager = (() => {

  const DRAFTS_KEY = 'surat-generator-drafts-v1';
  const ACTIVE_DRAFT_KEY = 'surat-generator-active-draft-v1';
  const BACKUP_FORMAT = 'GeneratorSuratBackup';
  const BACKUP_VERSION = '1.0';
  const MAX_DRAFTS = 20;
  const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

  let _rootEl = null;
  let _initialized = false;
  let _activeDraftId = null;
  let _fileInput = null;

  function init() {
    if (_initialized) return;
    _activeDraftId = _readActiveDraftId();
    _initialized = true;
    State.on('state:restore', () => refresh());
    State.on('state:reset', () => {
      _activeDraftId = null;
      _writeActiveDraftId(null);
      refresh();
    });
    State.on('template:change', () => refresh());
    State.on('form:change', () => refresh());
    State.on('kop:change', () => refresh());
    State.on('settings:change', () => refresh());
  }

  function mount(rootEl) {
    init();
    _rootEl = rootEl || document.getElementById('data-manager-root');
    if (!_rootEl) return;
    _renderShell();
    refresh();
  }

  function _renderShell() {
    _rootEl.innerHTML = `
      <div class="data-manager">

        <div class="data-manager__summary" id="data-manager-summary" aria-live="polite"></div>

        <div class="data-manager__toolbar">
          <button type="button" class="btn btn--primary btn--sm" id="dm-save-draft">
            <span aria-hidden="true">＋</span>
            Simpan Draft
          </button>
          <button type="button" class="btn btn--secondary btn--sm" id="dm-manage-drafts">
            Kelola Draft
          </button>
        </div>

        <div class="data-manager__divider"></div>

        <div class="data-manager__actions">
          <button type="button" class="data-manager-action" id="dm-export">
            <span class="data-manager-action__icon" aria-hidden="true">⇩</span>
            <span>
              <strong>Export Backup</strong>
              <small>Simpan seluruh data aktif sebagai file JSON.</small>
            </span>
          </button>

          <button type="button" class="data-manager-action" id="dm-import">
            <span class="data-manager-action__icon" aria-hidden="true">⇧</span>
            <span>
              <strong>Import Backup</strong>
              <small>Restore data dari file backup Generator Surat.</small>
            </span>
          </button>

          <input type="file" id="dm-import-input" accept="application/json,.json" hidden />
        </div>

        <div class="data-manager__hint">
          <span aria-hidden="true">ⓘ</span>
          <span>Draft tersimpan di perangkat ini dan tidak mengikuti TTL 2 jam pada penyimpanan cepat.</span>
        </div>

        <div class="data-manager__drafts" id="data-manager-drafts"></div>
      </div>
    `;

    _fileInput = _rootEl.querySelector('#dm-import-input');

    _rootEl.querySelector('#dm-save-draft')?.addEventListener('click', openSaveDraftDialog);
    _rootEl.querySelector('#dm-manage-drafts')?.addEventListener('click', openDraftManager);
    _rootEl.querySelector('#dm-export')?.addEventListener('click', exportBackup);
    _rootEl.querySelector('#dm-import')?.addEventListener('click', () => _fileInput?.click());

    _fileInput?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) await importBackup(file);
    });
  }

  function refresh() {
    if (!_rootEl) return;
    const summary = _rootEl.querySelector('#data-manager-summary');
    const draftsEl = _rootEl.querySelector('#data-manager-drafts');
    if (summary) summary.innerHTML = _buildSummary();
    if (draftsEl) draftsEl.innerHTML = _buildDraftPreview();
    _wireDraftButtons(draftsEl);
  }

  function _buildSummary() {
    const state = State.getState();
    const template = state.activeTemplate
      ? TemplateRegistry.get(state.activeTemplate)?.meta?.name || state.activeTemplate
      : 'Belum dipilih';
    const rows = _countRows(state);
    const draftCount = listDrafts().length;
    const size = _formatBytes(_jsonSize(State.serialize()));

    return `
      <div class="data-manager-stat">
        <span class="data-manager-stat__label">Dokumen aktif</span>
        <strong class="data-manager-stat__value">${Utils.escapeHtml(template)}</strong>
      </div>
      <div class="data-manager-stat">
        <span class="data-manager-stat__label">Data siswa</span>
        <strong class="data-manager-stat__value">${rows}</strong>
      </div>
      <div class="data-manager-stat">
        <span class="data-manager-stat__label">Ukuran data</span>
        <strong class="data-manager-stat__value">${size}</strong>
      </div>
      <div class="data-manager-stat">
        <span class="data-manager-stat__label">Draft tersimpan</span>
        <strong class="data-manager-stat__value">${draftCount}/${MAX_DRAFTS}</strong>
      </div>
    `;
  }

  function _buildDraftPreview() {
    const drafts = listDrafts().slice(0, 3);
    if (!drafts.length) {
      return `
        <div class="data-manager__empty">
          <strong>Belum ada draft bernama.</strong>
          <span>Simpan dokumen sebagai draft agar dapat dibuka kembali tanpa menunggu TTL penyimpanan cepat.</span>
        </div>`;
    }

    const items = drafts.map(draft => `
      <article class="data-manager-draft" data-draft-id="${Utils.escapeHtml(draft.id)}">
        <div class="data-manager-draft__main">
          <strong>${Utils.escapeHtml(draft.name)}</strong>
          <span>${Utils.escapeHtml(draft.templateName || 'Tanpa template')} · ${Utils.escapeHtml(Utils.formatDateTime(draft.updatedAt))}</span>
        </div>
        <div class="data-manager-draft__actions">
          <button type="button" class="btn btn--secondary btn--sm dm-load-preview" data-draft-id="${Utils.escapeHtml(draft.id)}">Buka</button>
          <button type="button" class="btn-icon dm-delete-preview" data-draft-id="${Utils.escapeHtml(draft.id)}" title="Hapus draft" aria-label="Hapus draft">×</button>
        </div>
      </article>`).join('');

    const more = listDrafts().length > 3
      ? `<button type="button" class="data-manager__more" id="dm-open-all-drafts">Lihat semua ${listDrafts().length} draft →</button>`
      : '';

    return items + more;
  }

  function _wireDraftButtons(scope) {
    if (!scope) return;
    scope.querySelectorAll('.dm-load-preview').forEach(btn => {
      btn.addEventListener('click', () => loadDraft(btn.dataset.draftId));
    });
    scope.querySelectorAll('.dm-delete-preview').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteDraft(btn.dataset.draftId));
    });
    scope.querySelector('#dm-open-all-drafts')?.addEventListener('click', openDraftManager);
  }

  function listDrafts() {
    const drafts = _readDrafts();
    return drafts
      .filter(Boolean)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }

  function saveDraft(name, draftId = null) {
    if (!Storage.isAvailable()) {
      return { success: false, reason: 'Penyimpanan lokal tidak tersedia di browser ini.' };
    }

    const safeName = _normalizeDraftName(name);
    if (!safeName) {
      return { success: false, reason: 'Nama draft belum diisi.' };
    }

    const data = State.serialize();
    const now = Date.now();
    const drafts = _readDrafts();
    const existingIndex = draftId ? drafts.findIndex(item => item.id === draftId) : -1;
    const current = existingIndex >= 0 ? drafts[existingIndex] : null;

    if (!current && drafts.length >= MAX_DRAFTS) {
      return {
        success: false,
        reason: `Batas ${MAX_DRAFTS} draft tercapai. Hapus salah satu draft lama terlebih dahulu.`,
      };
    }

    const record = {
      id: current?.id || Utils.generateId('draft'),
      name: safeName,
      templateId: data.activeTemplate || null,
      templateName: data.activeTemplate
        ? (TemplateRegistry.get(data.activeTemplate)?.meta?.name || data.activeTemplate)
        : 'Tanpa template',
      createdAt: current?.createdAt || now,
      updatedAt: now,
      sizeBytes: _jsonSize(data),
      data,
    };

    if (existingIndex >= 0) drafts[existingIndex] = record;
    else drafts.push(record);

    const write = _writeDrafts(drafts);
    if (!write.success) return write;

    _activeDraftId = record.id;
    _writeActiveDraftId(record.id);
    refresh();

    return { success: true, draft: record };
  }

  function openSaveDraftDialog() {
    const current = _activeDraftId ? listDrafts().find(d => d.id === _activeDraftId) : null;
    const suggested = current?.name || _suggestDraftName();

    UI.showModal({
      title: current ? 'Simpan Perubahan Draft' : 'Simpan sebagai Draft',
      body: `
        <div class="data-manager-dialog">
          <label class="settings-label" for="dm-draft-name">Nama Draft</label>
          <input id="dm-draft-name" class="form-input" type="text" maxlength="80"
            value="${Utils.escapeHtml(suggested)}" placeholder="Contoh: Data Siswa Baru 2026" />
          <p class="settings-hint">Gunakan nama yang mudah dikenali agar dokumen dapat ditemukan kembali.</p>
        </div>`,
      footer: [
        {
          label: 'Batal',
          class: 'btn--secondary',
        },
        {
          label: current ? 'Perbarui Draft' : 'Simpan Draft',
          class: 'btn--primary',
          onClick: () => {
            const input = document.getElementById('dm-draft-name');
            const result = saveDraft(input?.value || '', current?.id || null);
            if (!result.success) UI.toast(result.reason, 'error', 5000);
            else UI.toast(`Draft "${result.draft.name}" berhasil disimpan.`, 'success');
          },
        },
      ],
    });

    setTimeout(() => {
      const input = document.getElementById('dm-draft-name');
      input?.focus();
      input?.select();
      input?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          document.querySelector('#modal-footer .btn--primary')?.click();
        }
      });
    }, 60);
  }

  function openDraftManager() {
    const drafts = listDrafts();
    const listHtml = drafts.length
      ? drafts.map(draft => `
        <article class="data-manager-dialog-draft">
          <div class="data-manager-dialog-draft__info">
            <strong>${Utils.escapeHtml(draft.name)}</strong>
            <span>${Utils.escapeHtml(draft.templateName || 'Tanpa template')} · diperbarui ${Utils.escapeHtml(Utils.formatDateTime(draft.updatedAt))}</span>
            <small>${_formatBytes(draft.sizeBytes || _jsonSize(draft.data))}</small>
          </div>
          <div class="data-manager-dialog-draft__actions">
            <button type="button" class="btn btn--secondary btn--sm" data-dm-load="${Utils.escapeHtml(draft.id)}">Buka</button>
            <button type="button" class="btn btn--danger btn--sm" data-dm-delete="${Utils.escapeHtml(draft.id)}">Hapus</button>
          </div>
        </article>`).join('')
      : '<div class="data-manager__empty"><strong>Belum ada draft.</strong><span>Simpan dokumen pertama Anda sebagai draft.</span></div>';

    UI.showModal({
      title: `Draft Tersimpan · ${drafts.length}/${MAX_DRAFTS}`,
      body: `<div class="data-manager-dialog-list">${listHtml}</div>`,
      footer: [
        { label: 'Tutup', class: 'btn--secondary' },
        {
          label: 'Simpan Draft Baru',
          class: 'btn--primary',
          onClick: () => setTimeout(openSaveDraftDialog, 50),
        },
      ],
    });

    setTimeout(() => {
      document.querySelectorAll('[data-dm-load]').forEach(btn => {
        btn.addEventListener('click', () => {
          UI.hideModal();
          loadDraft(btn.dataset.dmLoad);
        });
      });
      document.querySelectorAll('[data-dm-delete]').forEach(btn => {
        btn.addEventListener('click', () => {
          UI.hideModal();
          confirmDeleteDraft(btn.dataset.dmDelete);
        });
      });
    }, 50);
  }

  function loadDraft(draftId) {
    const draft = listDrafts().find(item => item.id === draftId);
    if (!draft) {
      UI.toast('Draft tidak ditemukan.', 'error');
      return;
    }

    UI.confirm(
      'Muat Draft',
      `Draft "${draft.name}" akan menggantikan data yang sedang aktif. Perubahan yang belum disimpan akan hilang. Lanjutkan?`,
      () => {
        const validation = _validatePayload(draft.data);
        if (!validation.valid) {
          UI.toast(`Draft tidak dapat dimuat: ${validation.reason}`, 'error', 6000);
          return;
        }

        if (typeof Utils.flushDebounces === 'function') Utils.flushDebounces();
        State.restore(draft.data);
        _activeDraftId = draft.id;
        _writeActiveDraftId(draft.id);
        _refreshApplicationViews();
        UI.toast(`Draft "${draft.name}" berhasil dimuat.`, 'success');
      }
    );
  }

  function confirmDeleteDraft(draftId) {
    const draft = listDrafts().find(item => item.id === draftId);
    if (!draft) return;

    UI.confirm(
      'Hapus Draft',
      `Draft "${draft.name}" akan dihapus permanen dari perangkat ini.`,
      () => {
        const drafts = _readDrafts().filter(item => item.id !== draftId);
        const result = _writeDrafts(drafts);
        if (!result.success) {
          UI.toast(result.reason, 'error');
          return;
        }
        if (_activeDraftId === draftId) {
          _activeDraftId = null;
          _writeActiveDraftId(null);
        }
        refresh();
        UI.toast(`Draft "${draft.name}" berhasil dihapus.`, 'info');
      }
    );
  }

  function exportBackup() {
    const data = State.serialize();
    const templateName = data.activeTemplate
      ? TemplateRegistry.get(data.activeTemplate)?.meta?.name || data.activeTemplate
      : 'Dokumen';

    const payload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      application: 'Generator Surat Madrasah',
      templateId: data.activeTemplate || null,
      templateName,
      data,
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `generator-surat-backup-${stamp}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    UI.toast(`Backup berhasil diekspor (${_formatBytes(blob.size)}).`, 'success', 5000);
  }

  async function importBackup(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      UI.toast('File backup terlalu besar. Maksimal 10 MB.', 'error', 5000);
      return;
    }

    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const validation = _validateBackup(payload);
      if (!validation.valid) {
        UI.toast(`Backup tidak valid: ${validation.reason}`, 'error', 6000);
        return;
      }

      UI.confirm(
        'Import Backup',
        'Backup akan menggantikan seluruh data dokumen aktif. Perubahan yang belum disimpan akan hilang. Lanjutkan?',
        () => {
          if (typeof Utils.flushDebounces === 'function') Utils.flushDebounces();
          State.restore(validation.data);
          _activeDraftId = null;
          _writeActiveDraftId(null);
          _refreshApplicationViews();
          UI.toast('Backup berhasil diimpor dan data aktif telah dipulihkan.', 'success', 5000);
        }
      );
    } catch (err) {
      console.error('[DataManager] Gagal membaca backup:', err);
      UI.toast('File backup tidak dapat dibaca. Pastikan file JSON berasal dari Generator Surat Madrasah.', 'error', 6000);
    }
  }

  function clearAllDrafts() {
    const result = _writeDrafts([]);
    if (result.success) {
      _activeDraftId = null;
      _writeActiveDraftId(null);
    }
    refresh();
    return result;
  }

  function _refreshApplicationViews() {
    const activeId = State.getActiveTemplate();

    if (activeId) {
      TemplateRegistry.updateActiveCard(
        document.getElementById('template-list'),
        activeId
      );
      FormRenderer.render(activeId);
      UI.switchTab('form');
    } else {
      TemplateRegistry.renderTemplateList(
        document.getElementById('template-list'),
        null,
        (templateId) => {
          if (typeof App !== 'undefined' && typeof App.selectTemplate === 'function') {
            App.selectTemplate(templateId);
          }
        }
      );
      UI.switchTab('template');
    }

    if (typeof Settings !== 'undefined') {
      Settings.updateStorageStatus();
    }
  }

  function _validateBackup(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, reason: 'Struktur JSON tidak valid.' };
    }
    if (payload.format !== BACKUP_FORMAT) {
      return { valid: false, reason: 'Format backup tidak dikenali.' };
    }
    if (String(payload.version) !== BACKUP_VERSION) {
      return { valid: false, reason: `Versi backup ${payload.version || 'tidak diketahui'} tidak didukung.` };
    }
    return _validatePayload(payload.data);
  }

  function _validatePayload(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { valid: false, reason: 'Data utama tidak berbentuk object.' };
    }

    const allowedTemplates = new Set(['dpu', 'mutasi-masuk', 'siswa-baru']);
    if (data.activeTemplate !== null && data.activeTemplate !== undefined && !allowedTemplates.has(data.activeTemplate)) {
      return { valid: false, reason: 'Template aktif tidak dikenali.' };
    }

    if (data.kop !== undefined && (!data.kop || typeof data.kop !== 'object' || Array.isArray(data.kop))) {
      return { valid: false, reason: 'Konfigurasi KOP tidak valid.' };
    }
    if (data.settings !== undefined && (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings))) {
      return { valid: false, reason: 'Pengaturan dokumen tidak valid.' };
    }
    if (data.forms !== undefined && (!data.forms || typeof data.forms !== 'object' || Array.isArray(data.forms))) {
      return { valid: false, reason: 'Data form tidak valid.' };
    }
    if (data.forms && typeof data.forms === 'object') {
      for (const [templateId, form] of Object.entries(data.forms)) {
        if (!allowedTemplates.has(templateId)) continue;
        if (!form || typeof form !== 'object' || Array.isArray(form)) {
          return { valid: false, reason: 'Struktur form template ' + templateId + ' tidak valid.' };
        }
        for (const key of ['siswa', 'peserta']) {
          if (key in form && form[key] !== undefined && !Array.isArray(form[key])) {
            return { valid: false, reason: 'Daftar ' + key + ' pada template ' + templateId + ' harus berupa array.' };
          }
        }
      }
    }
    if (data.tables !== undefined && (!data.tables || typeof data.tables !== 'object' || Array.isArray(data.tables))) {
      return { valid: false, reason: 'Konfigurasi tabel tidak valid.' };
    }
    if (data.kop?.rows !== undefined && !Array.isArray(data.kop.rows)) {
      return { valid: false, reason: 'Daftar baris KOP harus berupa array.' };
    }

    return { valid: true, data };
  }

  function _readDrafts() {
    if (!Storage.isAvailable()) return [];
    try {
      const raw = localStorage.getItem(DRAFTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(draft => _isDraftRecordValid(draft));
    } catch (err) {
      console.warn('[DataManager] Gagal membaca drafts:', err);
      return [];
    }
  }

  function _writeDrafts(drafts) {
    if (!Storage.isAvailable()) {
      return { success: false, reason: 'Penyimpanan lokal tidak tersedia di browser ini.' };
    }
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
      return { success: true };
    } catch (err) {
      console.warn('[DataManager] Gagal menulis drafts:', err);
      return { success: false, reason: 'Penyimpanan draft gagal. Ruang penyimpanan browser mungkin penuh.' };
    }
  }

  function _isDraftRecordValid(draft) {
    return !!draft
      && typeof draft === 'object'
      && typeof draft.id === 'string'
      && typeof draft.name === 'string'
      && draft.data
      && typeof draft.data === 'object';
  }

  function _readActiveDraftId() {
    if (!Storage.isAvailable()) return null;
    try {
      return localStorage.getItem(ACTIVE_DRAFT_KEY) || null;
    } catch {
      return null;
    }
  }

  function _writeActiveDraftId(id) {
    if (!Storage.isAvailable()) return;
    try {
      if (id) localStorage.setItem(ACTIVE_DRAFT_KEY, id);
      else localStorage.removeItem(ACTIVE_DRAFT_KEY);
    } catch {
      /* silent */
    }
  }

  function _normalizeDraftName(name) {
    return String(name ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  function _suggestDraftName() {
    const activeId = State.getActiveTemplate();
    const template = activeId ? TemplateRegistry.get(activeId)?.meta?.name : null;
    const stamp = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return template ? `${template} · ${stamp}` : `Dokumen · ${stamp}`;
  }

  function _countRows(state) {
    const forms = state.forms || {};
    return Object.values(forms).reduce((total, form) => {
      if (!form || typeof form !== 'object') return total;
      return total + Object.values(form).reduce((subtotal, value) => {
        if (!Array.isArray(value)) return subtotal;
        return subtotal + value.filter(item => item && typeof item === 'object').length;
      }, 0);
    }, 0);
  }

  function _jsonSize(data) {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 0;
    }
  }

  function _formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '0 B';
    if (n < 1024) return `${Math.round(n)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  return {
    init,
    mount,
    refresh,
    listDrafts,
    saveDraft,
    loadDraft,
    confirmDeleteDraft,
    openSaveDraftDialog,
    openDraftManager,
    exportBackup,
    importBackup,
    clearAllDrafts,
    getActiveDraftId: () => _activeDraftId,
  };

})();