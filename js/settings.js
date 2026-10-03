/* =============================================================
   settings.js — Tab Pengaturan: UI, binding, dan integrasi state
   =============================================================
   Bertanggung jawab untuk:
   - Render UI tab Pengaturan
   - Mengikat setiap kontrol ke State.setSettings / applyDocumentPreset
   - Merespons perubahan state dari luar (restore, reset)
   - Menyediakan helper konversi satuan untuk tampilan
*/

const Settings = (() => {

  /* ── Konstanta validasi ── */
  const MARGIN_MIN_MM  =  0;
  const MARGIN_MAX_MM  = 60;
  const SCALE_MIN      = 50;
  const SCALE_MAX      = 150;
  const CUSTOM_W_MIN   = 50;   // mm
  const CUSTOM_W_MAX   = 600;
  const CUSTOM_H_MIN   = 50;
  const CUSTOM_H_MAX   = 900;

  let _rootEl = null;
  let _initialized = false;

  /* ═══════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════ */
  function init() {
    _rootEl = document.getElementById('settings-root');
    if (!_rootEl) {
      console.warn('[Settings] Root element tidak ditemukan.');
      return;
    }

    _render();
    _initialized = true;

    // Subscribe state changes dari luar (restore, reset)
    State.on('state:restore', () => { if (_initialized) _syncAllFromState(); });
    State.on('state:reset',   () => { if (_initialized) _syncAllFromState(); });
    State.on('settings:reset',() => { if (_initialized) _syncAllFromState(); });
    State.on('settings:change', ({ settings }) => {
      if (!_initialized || !settings?.preview) return;
      const mode = typeof settings.preview.zoom === 'string' ? settings.preview.zoom : 'actual';
      document.getElementById('zoom-mode-seg')
        ?.querySelectorAll('.seg-btn')
        .forEach(btn => btn.classList.toggle('active', btn.dataset.zoom === mode));
    });
    State.on('settings:presetApplied', () => { if (_initialized) _syncAllFromState(); });
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  function _render() {
    _rootEl.innerHTML = `

      <!-- ── PRESET ─────────────────────────────────── -->
      <div class="settings-card" id="settings-card-preset">
        <div class="settings-card__header">
          <span class="settings-card__icon">📋</span>
          <span class="settings-card__title">Preset Dokumen</span>
        </div>
        <div class="settings-card__body">
          <p class="settings-hint">Pilih preset untuk mengisi semua pengaturan dokumen sekaligus.</p>
          <div class="preset-grid" id="preset-grid"></div>
        </div>
      </div>

      <!-- ── DOKUMEN ─────────────────────────────────── -->
      <div class="settings-card" id="settings-card-document">
        <div class="settings-card__header">
          <span class="settings-card__icon">📄</span>
          <span class="settings-card__title">Dokumen</span>
        </div>
        <div class="settings-card__body">

          <!-- Ukuran kertas -->
          <div class="settings-row">
            <label class="settings-label" for="paper-size-select">Ukuran Kertas</label>
            <select class="form-select settings-select" id="paper-size-select">
              ${Object.entries(State.PAPER_SIZES).map(([key, val]) =>
                `<option value="${key}">${Utils.escapeHtml(val.label)}</option>`
              ).join('')}
            </select>
          </div>

          <!-- Custom size (tampil hanya jika Custom dipilih) -->
          <div class="settings-custom-size hidden" id="custom-size-block">
            <div class="settings-row">
              <label class="settings-label">Satuan</label>
              <div class="seg-control" id="unit-seg" role="group" aria-label="Satuan ukuran">
                ${['mm','cm','in'].map(u =>
                  `<button type="button" class="seg-btn${u==='mm'?' active':''}" data-unit="${u}">${u}</button>`
                ).join('')}
              </div>
            </div>
            <div class="settings-row-2col">
              <div class="settings-col">
                <label class="settings-label" for="custom-width-input">Lebar</label>
                <div class="input-with-unit">
                  <input type="number" class="form-input" id="custom-width-input"
                    step="1" min="50" max="600" value="210" />
                  <span class="input-unit-badge" id="custom-width-unit">mm</span>
                </div>
              </div>
              <div class="settings-col">
                <label class="settings-label" for="custom-height-input">Tinggi</label>
                <div class="input-with-unit">
                  <input type="number" class="form-input" id="custom-height-input"
                    step="1" min="50" max="900" value="297" />
                  <span class="input-unit-badge" id="custom-height-unit">mm</span>
                </div>
              </div>
            </div>
            <p class="settings-hint" id="custom-size-info">210 × 297 mm</p>
          </div>

          <!-- Orientasi -->
          <div class="settings-row">
            <label class="settings-label">Orientasi</label>
            <div class="orientation-btns" id="orientation-btns" role="group" aria-label="Orientasi halaman">
              <button type="button" class="orient-btn active" data-orient="portrait" title="Portrait">
                <svg class="orient-icon" viewBox="0 0 24 32" fill="none">
                  <rect x="1" y="1" width="22" height="30" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                  <line x1="5" y1="10" x2="19" y2="10" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="5" y1="15" x2="16" y2="15" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="5" y1="20" x2="18" y2="20" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                <span>Portrait</span>
              </button>
              <button type="button" class="orient-btn" data-orient="landscape" title="Landscape">
                <svg class="orient-icon landscape" viewBox="0 0 32 24" fill="none">
                  <rect x="1" y="1" width="30" height="22" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                  <line x1="7" y1="7" x2="25" y2="7" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="7" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="7" y1="17" x2="24" y2="17" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                <span>Landscape</span>
              </button>
            </div>
          </div>

          <!-- Info ukuran aktual -->
          <div class="settings-paper-info" id="paper-info-box">
            <span class="settings-paper-info__icon">📐</span>
            <span id="paper-info-text">A4 Portrait — 210 × 297 mm</span>
          </div>

        </div>
      </div>

      <!-- ── TIPOGRAFI ─────────────────────────────── -->
      <div class="settings-card" id="settings-card-typography">
        <div class="settings-card__header">
          <span class="settings-card__icon">🔤</span>
          <span class="settings-card__title">Tipografi Isi Surat</span>
        </div>
        <div class="settings-card__body">

          <!-- Font Family -->
          <div class="settings-row">
            <label class="settings-label" for="doc-font-family">Font</label>
            <select class="form-select settings-select" id="doc-font-family"
              style="font-family: inherit;">
              ${(State.DOCUMENT_FONTS || []).map(f =>
                `<option value="${Utils.escapeHtml(f.value)}"
                  style="font-family:'${Utils.escapeHtml(f.value)}';">
                  ${Utils.escapeHtml(f.label)}
                </option>`
              ).join('')}
            </select>
          </div>

          <!-- Font preview -->
          <div class="typo-preview" id="typo-preview">
            <span id="typo-preview-text">KEMENTERIAN AGAMA REPUBLIK INDONESIA</span>
          </div>

          <!-- Font Size -->
          <div class="settings-row">
            <label class="settings-label" for="doc-font-size">Ukuran Font</label>
            <div class="input-stepper" style="width:120px;">
              <button type="button" class="input-stepper__btn" id="doc-font-size-dec"
                aria-label="Kurangi ukuran font">−</button>
              <input type="number" class="input-stepper__input" id="doc-font-size"
                value="12" min="7" max="22" step="0.5"
                aria-label="Ukuran font isi surat (pt)" />
              <button type="button" class="input-stepper__btn" id="doc-font-size-inc"
                aria-label="Tambah ukuran font">+</button>
            </div>
            <span class="input-unit-badge" style="border-radius:var(--radius-md);
              border:1px solid var(--color-border);padding:4px 8px;">pt</span>
          </div>

          <!-- Line Height -->
          <div class="settings-row">
            <label class="settings-label" for="doc-line-height">Jarak Baris</label>
            <select class="form-select settings-select" id="doc-line-height"
              style="max-width:120px;">
              ${[1.0, 1.15, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0].map(v =>
                `<option value="${v}">${v}×</option>`
              ).join('')}
            </select>
          </div>

          <!-- Table font size -->
          <div class="settings-row">
            <label class="settings-label" for="doc-table-size">Font Tabel</label>
            <div class="input-stepper" style="width:120px;">
              <button type="button" class="input-stepper__btn" id="doc-table-size-dec"
                aria-label="Kurangi ukuran font tabel">−</button>
              <input type="number" class="input-stepper__input" id="doc-table-size"
                value="7.5" min="6" max="14" step="0.5"
                aria-label="Ukuran font tabel (pt)" />
              <button type="button" class="input-stepper__btn" id="doc-table-size-inc"
                aria-label="Tambah ukuran font tabel">+</button>
            </div>
            <span class="input-unit-badge" style="border-radius:var(--radius-md);
              border:1px solid var(--color-border);padding:4px 8px;">pt</span>
          </div>

          <p class="settings-hint">
            Pengaturan tipografi berlaku untuk seluruh isi surat.
            Font KOP Surat diatur terpisah di tab <strong>KOP Surat</strong>.
          </p>

        </div>
      </div>

      <!-- ── MARGIN ─────────────────────────────────── -->
      <div class="settings-card" id="settings-card-margin">
        <div class="settings-card__header">
          <span class="settings-card__icon">↔️</span>
          <span class="settings-card__title">Margin</span>
          <span class="settings-card__hint">(mm)</span>
        </div>
        <div class="settings-card__body">

          <!-- Preset margin -->
          <div class="settings-row">
            <label class="settings-label" for="margin-preset-select">Preset Margin</label>
            <select class="form-select settings-select" id="margin-preset-select">
              ${Object.entries(State.MARGIN_PRESETS).map(([key, val]) =>
                `<option value="${key}">${Utils.escapeHtml(val.label)}</option>`
              ).join('')}
              <option value="custom">Custom</option>
            </select>
          </div>

          <!-- Margin diagram -->
          <div class="margin-diagram-wrap">
            <div class="margin-diagram" id="margin-diagram">
              <!-- Top -->
              <div class="margin-field margin-field--top">
                <label class="margin-label" for="margin-top">Atas</label>
                <div class="input-with-unit">
                  <input type="number" class="form-input margin-input" id="margin-top"
                    min="0" max="60" step="1" value="20" />
                  <span class="input-unit-badge">mm</span>
                </div>
              </div>
              <!-- Middle row: Left | Page | Right -->
              <div class="margin-middle">
                <div class="margin-field margin-field--left">
                  <label class="margin-label" for="margin-left">Kiri</label>
                  <div class="input-with-unit">
                    <input type="number" class="form-input margin-input" id="margin-left"
                      min="0" max="60" step="1" value="25" />
                    <span class="input-unit-badge">mm</span>
                  </div>
                </div>
                <div class="margin-page-preview" id="margin-page-prev" aria-hidden="true">
                  <span>Halaman</span>
                </div>
                <div class="margin-field margin-field--right">
                  <label class="margin-label" for="margin-right">Kanan</label>
                  <div class="input-with-unit">
                    <input type="number" class="form-input margin-input" id="margin-right"
                      min="0" max="60" step="1" value="20" />
                    <span class="input-unit-badge">mm</span>
                  </div>
                </div>
              </div>
              <!-- Bottom -->
              <div class="margin-field margin-field--bottom">
                <label class="margin-label" for="margin-bottom">Bawah</label>
                <div class="input-with-unit">
                  <input type="number" class="form-input margin-input" id="margin-bottom"
                    min="0" max="60" step="1" value="25" />
                  <span class="input-unit-badge">mm</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── CETAK ─────────────────────────────────── -->
      <div class="settings-card" id="settings-card-print">
        <div class="settings-card__header">
          <span class="settings-card__icon">🖨️</span>
          <span class="settings-card__title">Cetak</span>
        </div>
        <div class="settings-card__body">

          <div class="settings-row">
            <label class="settings-label" for="print-scale-select">Skala Cetak</label>
            <select class="form-select settings-select" id="print-scale-select">
              <option value="80">80%</option>
              <option value="85">85%</option>
              <option value="90">90%</option>
              <option value="95">95%</option>
              <option value="100" selected>100% (Normal)</option>
              <option value="105">105%</option>
              <option value="110">110%</option>
              <option value="115">115%</option>
              <option value="120">120%</option>
              <option value="custom">Custom…</option>
            </select>
          </div>

          <div class="settings-row hidden" id="print-scale-custom-row">
            <label class="settings-label" for="print-scale-custom">Skala Custom (%)</label>
            <div class="input-with-unit">
              <input type="number" class="form-input" id="print-scale-custom"
                min="50" max="150" step="1" value="100" style="width:80px;" />
              <span class="input-unit-badge">%</span>
            </div>
          </div>

          <div class="info-box info-box--info" style="margin-top:8px;">
            <span class="info-box__icon">ℹ️</span>
            <span>Skala cetak diupayakan melalui CSS <code>@page</code>. Beberapa
            browser tetap menampilkan dialog cetak milik mereka dan
            memungkinkan pengguna mengubah skala di sana. Skala yang
            dikonfigurasi di sini adalah nilai <em>rekomendasi</em> aplikasi.</span>
          </div>

        </div>
      </div>

      <!-- ── PREVIEW ─────────────────────────────────── -->
      <div class="settings-card" id="settings-card-preview">
        <div class="settings-card__header">
          <span class="settings-card__icon">👁️</span>
          <span class="settings-card__title">Tampilan Preview</span>
        </div>
        <div class="settings-card__body">

          <div class="settings-hint" style="margin-bottom:10px;">
            Pengaturan berikut hanya memengaruhi <strong>tampilan preview</strong> di
            layar — tidak mengubah ukuran atau margin dokumen sebenarnya.
          </div>

          <!-- Zoom mode -->
          <div class="settings-row">
            <label class="settings-label">Zoom Preview</label>
            <div class="seg-control" id="zoom-mode-seg" role="group" aria-label="Mode zoom preview">
              <button type="button" class="seg-btn active" data-zoom="auto">Auto</button>
              <button type="button" class="seg-btn" data-zoom="fit-page">Fit Page</button>
              <button type="button" class="seg-btn" data-zoom="fit-width">Fit Width</button>
              <button type="button" class="seg-btn" data-zoom="actual">100%</button>
            </div>
          </div>

          <!-- Toggle margin guide -->
          <div class="settings-row settings-row--between">
            <label class="settings-label" for="toggle-margin-guide">Tampilkan Panduan Margin</label>
            <label class="toggle-switch" title="Tampilkan panduan margin">
              <input type="checkbox" class="toggle-switch__input" id="toggle-margin-guide" />
              <span class="toggle-switch__track"></span>
            </label>
          </div>

          <!-- Toggle printable area -->
          <div class="settings-row settings-row--between">
            <label class="settings-label" for="toggle-print-area">Tampilkan Area Cetak</label>
            <label class="toggle-switch" title="Tampilkan area cetak">
              <input type="checkbox" class="toggle-switch__input" id="toggle-print-area" />
              <span class="toggle-switch__track"></span>
            </label>
          </div>

        </div>
      </div>

      <!-- ── DATA LOKAL ─────────────────────────────── -->
      <div class="settings-card" id="settings-card-data">
        <div class="settings-card__header">
          <span class="settings-card__icon">💾</span>
          <span class="settings-card__title">Data Lokal</span>
        </div>
        <div class="settings-card__body">
          <div class="storage-status-block" id="storage-status-block">
            <div class="storage-status-row">
              <span class="storage-status-label">Status</span>
              <span class="storage-status-value" id="ss-available">Memeriksa…</span>
            </div>
            <div class="storage-status-row">
              <span class="storage-status-label">Terakhir disimpan</span>
              <span class="storage-status-value" id="ss-saved-at">—</span>
            </div>
            <div class="storage-status-row">
              <span class="storage-status-label">Kedaluwarsa pada</span>
              <span class="storage-status-value" id="ss-expires-at">—</span>
            </div>
            <div class="storage-status-row">
              <span class="storage-status-label">Sisa waktu</span>
              <span class="storage-status-value" id="ss-remaining">—</span>
            </div>
          </div>
          <p class="settings-hint" style="margin-top:8px;">
            Data tersimpan di perangkat ini dan akan dihapus otomatis setelah
            <strong>2 jam</strong> sejak penyimpanan terakhir.
          </p>
        </div>
      </div>

      <!-- ── DATA MANAGEMENT ───────────────────────── -->
      <div class="settings-card" id="settings-card-data-manager">
        <div class="settings-card__header">
          <span class="settings-card__icon">🗂️</span>
          <span class="settings-card__title">Manajemen Data Lanjutan</span>
        </div>
        <div class="settings-card__body">
          <p class="settings-hint">
            Kelola draft bernama dan pindahkan data antar perangkat melalui backup JSON.
          </p>
          <div id="data-manager-root"></div>
        </div>
      </div>

      <!-- ── TINDAKAN ─────────────────────────────── -->
      <div class="settings-card" id="settings-card-actions">
        <div class="settings-card__header">
          <span class="settings-card__icon">⚙️</span>
          <span class="settings-card__title">Tindakan</span>
        </div>
        <div class="settings-card__body settings-actions-body">

          <div class="settings-action-item">
            <div class="settings-action-desc">
              <strong>Reset Pengaturan</strong>
              <p>Kembalikan ukuran kertas, margin, dan semua konfigurasi ke nilai default.</p>
            </div>
            <button type="button" class="btn btn--secondary btn--sm" id="btn-reset-settings">
              Reset Pengaturan
            </button>
          </div>

          <hr class="divider" />

          <div class="settings-action-item">
            <div class="settings-action-desc">
              <strong>Hapus Semua Data Lokal</strong>
              <p>Hapus seluruh data surat, KOP, pengaturan, dan state yang tersimpan di perangkat ini.</p>
            </div>
            <button type="button" class="btn btn--danger btn--sm" id="btn-clear-all-data">
              Hapus Semua Data
            </button>
          </div>

        </div>
      </div>`;

    _bindSettingsAccordions();
    _bindAll();
    _syncAllFromState();
  }


  /* ── Settings accordion ── */
  function _bindSettingsAccordions() {
    if (!_rootEl) return;

    _rootEl.querySelectorAll('.settings-card').forEach((card, index) => {
      const header = card.querySelector('.settings-card__header');
      const body   = card.querySelector('.settings-card__body');
      if (!header || !body) return;

      const bodyId = body.id || 'settings-section-' + (index + 1) + '-body';
      body.id = bodyId;

      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      header.setAttribute('aria-controls', bodyId);

      if (!header.hasAttribute('aria-expanded')) {
        header.setAttribute('aria-expanded', 'true');
      }

      const toggle = () => {
        const willOpen = header.getAttribute('aria-expanded') !== 'true';
        header.setAttribute('aria-expanded', String(willOpen));
        card.classList.toggle('is-collapsed', !willOpen);
      };

      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        toggle();
      });

      card.classList.toggle(
        'is-collapsed',
        header.getAttribute('aria-expanded') !== 'true'
      );
    });
  }

  /* ═══════════════════════════════════════════════════════════
     BINDING — sambungkan setiap kontrol ke State
  ═══════════════════════════════════════════════════════════ */
  function _bindAll() {
    _bindPresets();
    _bindPaperSize();
    _bindCustomSize();
    _bindOrientation();
    _bindTypography();    // ← baru
    _bindMarginPreset();
    _bindMarginInputs();
    _bindPrintScale();
    _bindPreviewControls();
    _bindStorageActions();
    if (typeof DataManager !== 'undefined') {
      DataManager.mount(document.getElementById('data-manager-root'));
    }
  }

  /* ── Preset grid ── */
  function _bindPresets() {
    const grid = document.getElementById('preset-grid');
    if (!grid) return;
    const presets = State.DOCUMENT_PRESETS;

    Object.entries(presets).forEach(([key, p]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-btn';
      btn.dataset.preset = key;
      btn.innerHTML = `<span class="preset-btn__name">${Utils.escapeHtml(p.label)}</span>`;
      btn.addEventListener('click', () => {
        State.applyDocumentPreset(key);
        UI.toast(`Preset "${p.label}" diterapkan.`, 'success', 2500);
      });
      grid.appendChild(btn);
    });

    // Tombol Custom
    const customBtn = document.createElement('button');
    customBtn.type = 'button';
    customBtn.className = 'preset-btn';
    customBtn.dataset.preset = 'custom';
    customBtn.innerHTML = `<span class="preset-btn__name">Custom</span>`;
    customBtn.addEventListener('click', () => {
      // Custom hanya mark active tanpa mengubah nilai
      State.setSettings({ activePreset: 'custom' });
    });
    grid.appendChild(customBtn);
  }

  /* ── Paper size select ── */
  function _bindPaperSize() {
    const sel = document.getElementById('paper-size-select');
    if (!sel) return;
    sel.addEventListener('change', () => {
      const size = sel.value;
      State.setSettings({ paper: { size }, activePreset: 'custom' });
      _toggleCustomBlock(size === 'Custom');
      _updatePaperInfo();
      _markPresetCustom();
    });
  }

  /* ── Custom size ── */
  function _bindCustomSize() {
    // Unit segmented control
    const unitSeg = document.getElementById('unit-seg');
    unitSeg?.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const unit = btn.dataset.unit;
        // Konversi nilai yang sudah ada ke unit baru sebelum menyimpan
        const s = State.getSettings();
        const curUnit = s.paper.unit;
        const wEl = document.getElementById('custom-width-input');
        const hEl = document.getElementById('custom-height-input');
        const wRaw = Number.parseFloat(wEl?.value);
        const hRaw = Number.parseFloat(hEl?.value);
        // customWidth/customHeight di State selalu dalam mm. Saat input
        // display sedang kosong/tidak valid, gunakan nilai mm langsung dan
        // jangan konversi dua kali memakai unit tampilan aktif.
        const wMm = Number.isFinite(wRaw)
          ? _toMmFromUnit(wRaw, curUnit)
          : Number(s.paper.customWidth);
        const hMm = Number.isFinite(hRaw)
          ? _toMmFromUnit(hRaw, curUnit)
          : Number(s.paper.customHeight);
        const wNew = _fromMm(wMm, unit);
        const hNew = _fromMm(hMm, unit);

        document.getElementById('custom-width-input').value  = _round(wNew);
        document.getElementById('custom-height-input').value = _round(hNew);
        document.getElementById('custom-width-unit').textContent  = unit;
        document.getElementById('custom-height-unit').textContent = unit;

        unitSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        State.setSettings({ paper: { unit, customWidth: wMm, customHeight: hMm }, activePreset: 'custom' });
        _syncCustomSizeConstraints(unit);
        _updatePaperInfo();
        _markPresetCustom();
      });
    });

    const debSave = Utils.debounce(() => {
      const s = State.getSettings();
      const unit = s.paper.unit;
      const wRaw = Number.parseFloat(document.getElementById('custom-width-input')?.value);
      const hRaw = Number.parseFloat(document.getElementById('custom-height-input')?.value);
      if (!Number.isFinite(wRaw) || !Number.isFinite(hRaw)) return;
      const wMm = Utils.clamp(_toMmFromUnit(wRaw, unit), CUSTOM_W_MIN, CUSTOM_W_MAX);
      const hMm = Utils.clamp(_toMmFromUnit(hRaw, unit), CUSTOM_H_MIN, CUSTOM_H_MAX);
      State.setSettings({ paper: { customWidth: wMm, customHeight: hMm }, activePreset: 'custom' });
      _updatePaperInfo();
      _markPresetCustom();
    }, 400);

    document.getElementById('custom-width-input')?.addEventListener('input',  debSave);
    document.getElementById('custom-height-input')?.addEventListener('input', debSave);
  }

  /* ── Orientation buttons ── */
  function _bindOrientation() {
    document.getElementById('orientation-btns')
      ?.querySelectorAll('.orient-btn')
      .forEach(btn => {
        btn.addEventListener('click', () => {
          const orientation = btn.dataset.orient;
          State.setSettings({ orientation, activePreset: 'custom' });

          // Sinkronkan active state segera, tanpa menunggu rerender.
          document.getElementById('orientation-btns')
            ?.querySelectorAll('.orient-btn')
            .forEach(b => b.classList.toggle('active', b.dataset.orient === orientation));

          _updatePaperInfo();
          _markPresetCustom();
        });
      });
  }

  /* ── Typography ── */
  function _bindTypography() {
    const fontSel    = document.getElementById('doc-font-family');
    const sizeInput  = document.getElementById('doc-font-size');
    const sizeDecBtn = document.getElementById('doc-font-size-dec');
    const sizeIncBtn = document.getElementById('doc-font-size-inc');
    const lineHSel   = document.getElementById('doc-line-height');
    const tblInput   = document.getElementById('doc-table-size');
    const tblDecBtn  = document.getElementById('doc-table-size-dec');
    const tblIncBtn  = document.getElementById('doc-table-size-inc');

    // Debounced save
    const debSave = Utils.debounce(() => {
      const ff  = fontSel?.value || 'Times New Roman';
      const fs  = Utils.clamp(Utils.safeFloat(sizeInput?.value, 12), 7, 22);
      const lh  = parseFloat(lineHSel?.value || 1.5);
      const ts  = Utils.clamp(Utils.safeFloat(tblInput?.value, 7.5), 6, 14);
      State.setSettings({ typography: { fontFamily: ff, fontSize: fs, lineHeight: lh, tableSize: ts } });
      _updateTypoPreview(ff, fs);
    }, 300);

    // Font family
    fontSel?.addEventListener('change', () => {
      _updateTypoPreview(fontSel.value, Utils.safeFloat(sizeInput?.value, 12));
      debSave();
    });

    // Font size stepper
    sizeDecBtn?.addEventListener('click', () => {
      const cur = Utils.safeFloat(sizeInput?.value, 12);
      const nv  = Utils.clamp(cur - 0.5, 7, 22);
      if (sizeInput) sizeInput.value = nv;
      debSave();
    });
    sizeIncBtn?.addEventListener('click', () => {
      const cur = Utils.safeFloat(sizeInput?.value, 12);
      const nv  = Utils.clamp(cur + 0.5, 7, 22);
      if (sizeInput) sizeInput.value = nv;
      debSave();
    });
    sizeInput?.addEventListener('input', debSave);
    sizeInput?.addEventListener('change', () => {
      const clamped = Utils.clamp(Utils.safeFloat(sizeInput.value, 12), 7, 22);
      sizeInput.value = clamped;
      debSave();
    });

    // Line height
    lineHSel?.addEventListener('change', debSave);

    // Table size stepper
    tblDecBtn?.addEventListener('click', () => {
      const cur = Utils.safeFloat(tblInput?.value, 7.5);
      const nv  = Utils.clamp(cur - 0.5, 6, 14);
      if (tblInput) tblInput.value = nv;
      debSave();
    });
    tblIncBtn?.addEventListener('click', () => {
      const cur = Utils.safeFloat(tblInput?.value, 7.5);
      const nv  = Utils.clamp(cur + 0.5, 6, 14);
      if (tblInput) tblInput.value = nv;
      debSave();
    });
    tblInput?.addEventListener('input', debSave);
    tblInput?.addEventListener('change', () => {
      const clamped = Utils.clamp(Utils.safeFloat(tblInput.value, 7.5), 6, 14);
      tblInput.value = clamped;
      debSave();
    });
  }

  /* ── Update preview font di card tipografi ── */
  function _updateTypoPreview(fontFamily, fontSize) {
    const el = document.getElementById('typo-preview-text');
    if (!el) return;
    el.style.fontFamily = `'${fontFamily}', serif`;
    el.style.fontSize   = `${Math.round(fontSize)}pt`;
  }

  /* ── Margin preset select ── */
  function _bindMarginPreset() {
    const sel = document.getElementById('margin-preset-select');
    if (!sel) return;
    sel.addEventListener('change', () => {
      const key = sel.value;
      if (key === 'custom') return;
      const preset = State.MARGIN_PRESETS[key];
      if (!preset) return;
      State.setSettings({
        margin: { top: preset.top, right: preset.right, bottom: preset.bottom, left: preset.left },
        activePreset: 'custom',
      });
      _syncMarginInputs(preset);
      _markPresetCustom();
    });
  }

  /* ── Margin 4 input ── */
  function _bindMarginInputs() {
    const sides = ['top', 'right', 'bottom', 'left'];
    const debSave = Utils.debounce(() => {
      const margin = {};
      let valid = true;
      sides.forEach(side => {
        const el = document.getElementById(`margin-${side}`);
        const raw = String(el?.value ?? '').trim();
        const val = raw === '' ? NaN : Number(raw);
        if (!Number.isFinite(val) || val < MARGIN_MIN_MM || val > MARGIN_MAX_MM) {
          el?.classList.add('is-error');
          valid = false;
        } else {
          el?.classList.remove('is-error');
          margin[side] = val;
        }
      });
      if (!valid) return;
      State.setSettings({ margin, activePreset: 'custom' });
      _syncMarginPresetSelect(null); // cek apakah cocok dengan preset baku
      _markPresetCustom();
    }, 300);

    sides.forEach(side => {
      document.getElementById(`margin-${side}`)?.addEventListener('input', debSave);
    });
  }

  /* ── Print scale ── */
  function _bindPrintScale() {
    const sel    = document.getElementById('print-scale-select');
    const custom = document.getElementById('print-scale-custom');
    const row    = document.getElementById('print-scale-custom-row');

    sel?.addEventListener('change', () => {
      if (sel.value === 'custom') {
        row?.classList.remove('hidden');
      } else {
        row?.classList.add('hidden');
        State.setSettings({ print: { scale: parseInt(sel.value, 10) }, activePreset: 'custom' });
        _markPresetCustom();
      }
    });

    const debScale = Utils.debounce(() => {
      const val = Utils.clamp(parseInt(custom?.value ?? 100, 10), SCALE_MIN, SCALE_MAX);
      State.setSettings({ print: { scale: val }, activePreset: 'custom' });
      _markPresetCustom();
    }, 400);

    custom?.addEventListener('input', debScale);
  }

  /* ── Preview controls ── */
  function _bindPreviewControls() {
    // Zoom mode
    document.getElementById('zoom-mode-seg')
      ?.querySelectorAll('.seg-btn')
      .forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.zoom;
          State.setSettings({ preview: { zoom: mode } });
          _applyZoomMode(mode);
        });
      });

    // Margin guide toggle
    document.getElementById('toggle-margin-guide')?.addEventListener('change', (e) => {
      State.setSettings({ preview: { showMarginGuide: e.target.checked } });
      _applyMarginGuide(e.target.checked);
    });

    // Print area toggle
    document.getElementById('toggle-print-area')?.addEventListener('change', (e) => {
      State.setSettings({ preview: { showPrintableArea: e.target.checked } });
      _applyPrintableArea(e.target.checked);
    });
  }

  /* ── Storage / action buttons ── */
  function _bindStorageActions() {
    // Reset Pengaturan saja
    document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
      UI.confirm(
        'Reset Pengaturan',
        'Ukuran kertas, margin, dan semua konfigurasi akan dikembalikan ke nilai default. Lanjutkan?',
        () => {
          State.resetSettings();
          UI.toast('Pengaturan berhasil direset ke default.', 'success');
        }
      );
    });

    // Hapus Semua Data Lokal
    document.getElementById('btn-clear-all-data')?.addEventListener('click', () => {
      UI.confirm(
        'Hapus Semua Data Lokal',
        'Semua data surat, KOP, pengaturan, dan konfigurasi yang tersimpan di perangkat ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan. Lanjutkan?',
        () => {
          if (typeof App !== 'undefined') {
            App.reset();
          }
          UI.toast('Semua data lokal berhasil dihapus.', 'info');
        }
      );
    });
  }

  /* ═══════════════════════════════════════════════════════════
     SYNC — sinkronkan semua kontrol UI dari state saat ini
  ═══════════════════════════════════════════════════════════ */
  function _syncAllFromState() {
    if (!_rootEl) return;
    const s = State.getSettings();

    // Preset active
    _syncPresetButtons(s.activePreset);

    // Paper size
    const sizeEl = document.getElementById('paper-size-select');
    if (sizeEl) sizeEl.value = s.paper.size;
    _toggleCustomBlock(s.paper.size === 'Custom');
    if (s.paper.size === 'Custom') _syncCustomSizeInputs(s);

    // Orientation
    document.getElementById('orientation-btns')
      ?.querySelectorAll('.orient-btn')
      .forEach(btn => btn.classList.toggle('active', btn.dataset.orient === s.orientation));

    _updatePaperInfo();

    // Typography
    _syncTypography(s.typography);

    // Margin
    _syncMarginInputs(s.margin);
    _syncMarginPresetSelect(s.margin);

    // Print scale
    _syncPrintScale(s.print.scale);

    // Preview
    const zoomSeg = document.getElementById('zoom-mode-seg');
    const zoomMode = typeof s.preview.zoom === 'string' ? s.preview.zoom : 'actual';
    zoomSeg?.querySelectorAll('.seg-btn')
      .forEach(btn => btn.classList.toggle('active', btn.dataset.zoom === zoomMode));

    const mgGuide = document.getElementById('toggle-margin-guide');
    if (mgGuide) mgGuide.checked = !!s.preview.showMarginGuide;
    _applyMarginGuide(!!s.preview.showMarginGuide);

    const paArea = document.getElementById('toggle-print-area');
    if (paArea) paArea.checked = !!s.preview.showPrintableArea;
    _applyPrintableArea(!!s.preview.showPrintableArea);

    // Apply zoom mode
    _applyZoomMode(s.preview.zoom);

    // Storage status
    updateStorageStatus();
  }

  /* ── Sync helper: preset buttons ── */
  function _syncPresetButtons(activeKey) {
    document.getElementById('preset-grid')
      ?.querySelectorAll('.preset-btn')
      .forEach(btn => btn.classList.toggle('active', btn.dataset.preset === activeKey));
  }

  /* ── Sync helper: custom size inputs ── */
  function _getCustomDisplayConstraints(unit) {
    const factor = unit === 'cm' ? 0.1 : unit === 'in' ? (1 / 25.4) : 1;
    const roundValue = value => Number(value.toFixed(2));
    return {
      width: {
        min: roundValue(CUSTOM_W_MIN * factor),
        max: roundValue(CUSTOM_W_MAX * factor),
      },
      height: {
        min: roundValue(CUSTOM_H_MIN * factor),
        max: roundValue(CUSTOM_H_MAX * factor),
      },
      step: unit === 'mm' ? '1' : '0.1',
    };
  }

  function _syncCustomSizeConstraints(unit) {
    const constraints = _getCustomDisplayConstraints(unit);
    const wEl = document.getElementById('custom-width-input');
    const hEl = document.getElementById('custom-height-input');
    if (wEl) {
      wEl.min = constraints.width.min;
      wEl.max = constraints.width.max;
      wEl.step = constraints.step;
    }
    if (hEl) {
      hEl.min = constraints.height.min;
      hEl.max = constraints.height.max;
      hEl.step = constraints.step;
    }
  }

  function _syncCustomSizeInputs(s) {
    const unit = s.paper.unit || 'mm';
    const wMm = Number.isFinite(Number(s.paper.customWidth)) ? Number(s.paper.customWidth) : 210;
    const hMm = Number.isFinite(Number(s.paper.customHeight)) ? Number(s.paper.customHeight) : 297;
    const wDisp = _round(_fromMm(wMm, unit));
    const hDisp = _round(_fromMm(hMm, unit));

    const wEl = document.getElementById('custom-width-input');
    const hEl = document.getElementById('custom-height-input');
    if (wEl) wEl.value = wDisp;
    if (hEl) hEl.value = hDisp;

    document.getElementById('custom-width-unit') && (document.getElementById('custom-width-unit').textContent = unit);
    document.getElementById('custom-height-unit') && (document.getElementById('custom-height-unit').textContent = unit);

    document.getElementById('unit-seg')?.querySelectorAll('.seg-btn')
      .forEach(btn => btn.classList.toggle('active', btn.dataset.unit === unit));

    _syncCustomSizeConstraints(unit);
  }
  /* ── Sync helper: typography ── */
  function _syncTypography(typo) {
    if (!typo) return;
    const fontSel   = document.getElementById('doc-font-family');
    const sizeInput = document.getElementById('doc-font-size');
    const lineHSel  = document.getElementById('doc-line-height');
    const tblInput  = document.getElementById('doc-table-size');

    if (fontSel)  fontSel.value   = typo.fontFamily  || 'Times New Roman';
    if (sizeInput) sizeInput.value = typo.fontSize    || 12;
    if (lineHSel) lineHSel.value  = typo.lineHeight   || 1.5;
    if (tblInput) tblInput.value  = typo.tableSize    || 7.5;

    _updateTypoPreview(typo.fontFamily || 'Times New Roman', typo.fontSize || 12);
  }

  /* ── Sync helper: margin inputs ── */
  function _syncMarginInputs(margin) {
    ['top', 'right', 'bottom', 'left'].forEach(side => {
      const el = document.getElementById(`margin-${side}`);
      if (el) el.value = margin[side] ?? 20;
    });
  }

  /* ── Sync helper: margin preset select ── */
  function _syncMarginPresetSelect(margin) {
    const sel = document.getElementById('margin-preset-select');
    if (!sel || !margin) return;
    // Cek apakah cocok dengan salah satu preset
    const match = Object.entries(State.MARGIN_PRESETS).find(([, p]) =>
      p.top === margin.top && p.right === margin.right &&
      p.bottom === margin.bottom && p.left === margin.left
    );
    sel.value = match ? match[0] : 'custom';
  }

  /* ── Sync helper: print scale ── */
  function _syncPrintScale(scale) {
    const sel  = document.getElementById('print-scale-select');
    const cust = document.getElementById('print-scale-custom');
    const row  = document.getElementById('print-scale-custom-row');
    if (!sel) return;

    const stdValues = ['80','85','90','95','100','105','110','115','120'];
    const scaleStr = String(scale);
    if (stdValues.includes(scaleStr)) {
      sel.value = scaleStr;
      row?.classList.add('hidden');
    } else {
      sel.value = 'custom';
      if (cust) cust.value = scale;
      row?.classList.remove('hidden');
    }
  }

  /* ── Mark preset sebagai custom (ketika ada perubahan manual) ── */
  function _markPresetCustom() {
    _syncPresetButtons(State.getSettings().activePreset);
  }

  /* ═══════════════════════════════════════════════════════════
     PREVIEW EFFECTS — terapkan langsung ke DOM preview
  ═══════════════════════════════════════════════════════════ */

  /* ── Zoom mode → kirim ke PreviewRenderer ── */
  function _applyZoomMode(mode) {
    if (typeof PreviewRenderer === 'undefined') return;
    const viewport = document.getElementById('preview-viewport');
    const wrapper  = document.getElementById('preview-canvas-wrapper');
    const preview  = document.getElementById('surat-preview');
    if (!viewport || !wrapper || !preview) return;

    const vpW = viewport.clientWidth || 800;
    const vpH = viewport.clientHeight || 600;
    const dimensions = State.getPaperDimensions();
    const paperW = (dimensions.widthMm || 210) * (96 / 25.4);
    const paperH = (dimensions.heightMm || 297) * (96 / 25.4);

    let zoom = 1;
    if (mode === 'auto' || mode === 'fit-page') {
      const scaleW = (vpW - 48) / paperW;
      const scaleH = (vpH - 48) / paperH;
      zoom = Math.min(scaleW, scaleH, 1.0); // tidak melebihi 100%
    } else if (mode === 'fit-width') {
      zoom = (vpW - 48) / paperW;
      zoom = Math.min(zoom, 1.5);
    } else if (mode === 'actual') {
      zoom = 1;
    } else if (typeof mode === 'number') {
      zoom = mode;
    }

    zoom = Utils.clamp(zoom, 0.3, 2.5);
    State.setZoom(zoom); // ini akan trigger ui:zoomChange → PreviewRenderer
  }

  /* ── Margin guide overlay ── */
  function _applyMarginGuide(show) {
    const preview = document.getElementById('surat-preview');
    if (!preview) return;

    let guide = preview.querySelector('.margin-guide-overlay');

    if (!show) {
      guide?.remove();
      return;
    }

    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'margin-guide-overlay';
      guide.setAttribute('aria-hidden', 'true');
      preview.appendChild(guide);
    }

    // Posisikan sesuai margin saat ini
    const m = State.getMarginMm();
    const PX_PER_MM = 96 / 25.4;
    guide.style.top    = `${m.top    * PX_PER_MM}px`;
    guide.style.right  = `${m.right  * PX_PER_MM}px`;
    guide.style.bottom = `${m.bottom * PX_PER_MM}px`;
    guide.style.left   = `${m.left   * PX_PER_MM}px`;
  }

  /* ── Printable area highlight ── */
  function _applyPrintableArea(show) {
    const preview = document.getElementById('surat-preview');
    if (!preview) return;

    let area = preview.querySelector('.printable-area-overlay');
    if (!show) { area?.remove(); return; }

    if (!area) {
      area = document.createElement('div');
      area.className = 'printable-area-overlay';
      area.setAttribute('aria-hidden', 'true');
      preview.appendChild(area);
    }

    const m = State.getMarginMm();
    const PX = 96 / 25.4;
    area.style.top    = `${m.top    * PX}px`;
    area.style.right  = `${m.right  * PX}px`;
    area.style.bottom = `${m.bottom * PX}px`;
    area.style.left   = `${m.left   * PX}px`;
  }

  /* ═══════════════════════════════════════════════════════════
     HELPERS UI
  ═══════════════════════════════════════════════════════════ */

  function _toggleCustomBlock(show) {
    document.getElementById('custom-size-block')?.classList.toggle('hidden', !show);
  }

  function _updatePaperInfo() {
    const infoEl = document.getElementById('paper-info-text');
    if (!infoEl) return;
    const dim  = State.getPaperDimensions();
    const s    = State.getSettings();
    const ori  = s.orientation === 'landscape' ? 'Landscape' : 'Portrait';
    const size = s.paper.size === 'Custom' ? 'Custom' : s.paper.size;
    const wRnd = Math.round(dim.widthMm);
    const hRnd = Math.round(dim.heightMm);
    infoEl.textContent = `${size} ${ori} — ${wRnd} × ${hRnd} mm`;

    const infoBox = document.getElementById('custom-size-info');
    if (infoBox) infoBox.textContent = `${wRnd} × ${hRnd} mm`;
  }

  /* ═══════════════════════════════════════════════════════════
     STORAGE STATUS
  ═══════════════════════════════════════════════════════════ */
  function updateStorageStatus() {
    const avEl   = document.getElementById('ss-available');
    const saveEl = document.getElementById('ss-saved-at');
    const expEl  = document.getElementById('ss-expires-at');
    const remEl  = document.getElementById('ss-remaining');

    if (!avEl) return;

    const meta = Storage.getMeta();

    avEl.textContent = Storage.isAvailable() ? '✅ Tersedia' : '❌ Tidak tersedia';

    if (!meta) {
      saveEl.textContent = '—';
      expEl.textContent  = '—';
      remEl.textContent  = '—';
      return;
    }

    saveEl.textContent = meta.lastSavedAt ? Utils.formatDateTime(meta.lastSavedAt) : '—';
    expEl.textContent  = meta.expiresAt   ? Utils.formatDateTime(meta.expiresAt)   : '—';

    const rem = Utils.getRemainingTime(meta.expiresAt);
    if (rem <= 0) {
      remEl.textContent = '⚠️ Sudah kedaluwarsa';
      remEl.style.color = 'var(--color-danger)';
    } else {
      remEl.textContent = Utils.formatDuration(rem);
      remEl.style.color = rem < 30 * 60 * 1000
        ? 'var(--color-warning)'
        : 'var(--color-success)';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     KONVERSI SATUAN
  ═══════════════════════════════════════════════════════════ */
  function _toMmFromUnit(value, unit) {
    const n = parseFloat(value) || 0;
    if (unit === 'cm') return n * 10;
    if (unit === 'in') return n * 25.4;
    return n;
  }

  function _fromMm(mm, unit) {
    if (unit === 'cm') return mm / 10;
    if (unit === 'in') return mm / 25.4;
    return mm;
  }

  function _round(v) {
    return Math.round(v * 100) / 100;
  }

  /* ═══════════════════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════════════════ */
  return {
    init,
    updateStorageStatus,
  };

})();
