/* =============================================================
   table-config-ui.js — Accordion "Pengaturan Tabel" di Tab Isi Surat
   =============================================================
   Struktur accordion per tabel:
     ► Lebar Kolom         ← BARU: pengaturan struktural (berlaku di header+body)
     ► Header Tabel        ← styling teks header per kolom
     ► Isi Tabel           ← styling teks body per kolom

   Setiap perubahan langsung → TableConfigManager → State → emit →
   PreviewRenderer.debounce → live update.
   =============================================================
*/

const TableConfigUI = (() => {

  /* ── State UI lokal ── */
  let _mountEl      = null;
  let _templateId   = null;
  let _openSections = {};
  let _boundClickHandler  = null;
  let _boundChangeHandler = null;
  let _boundInputHandler  = null;   // { 'tableId-width': bool, 'tableId-header': bool, ... }

  /* ── Label dan ikon ── */
  const H_ALIGN_OPTIONS = [
    { value: 'left',    label: 'Kiri',    icon: '⬅' },
    { value: 'center',  label: 'Tengah',  icon: '↔' },
    { value: 'right',   label: 'Kanan',   icon: '➡' },
    { value: 'justify', label: 'Justify', icon: '☰' },
  ];

  const V_ALIGN_OPTIONS = [
    { value: 'top',    label: 'Atas'   },
    { value: 'middle', label: 'Tengah' },
    { value: 'bottom', label: 'Bawah'  },
  ];

  /* ────────────────────────────────────────────────
     PUBLIC: Init
  ──────────────────────────────────────────────── */
  function init(mountEl) {
    if (!mountEl) return;
    _mountEl = mountEl;

    /*
     * CATATAN ARSITEKTUR — siapa yang memanggil render():
     *
     * TableConfigUI.init() TIDAK subscribe ke 'template:change'.
     * FormRenderer.render() yang secara eksplisit memanggil
     * TableConfigUI.render(templateId) setelah form di-render.
     *
     * Alasan: jika init() juga subscribe ke 'template:change',
     * maka saat FormRenderer menangani 'template:change' dan memanggil
     * render(templateId), TableConfigUI.render() akan terpanggil DUA KALI:
     *   1. Dari subscriber init() — via state event
     *   2. Dari FormRenderer.render() — via explicit call
     *
     * Dua panggilan render() → dua panggilan _bindEvents(_mountEl) →
     * DUA listener 'click' di _mountEl → setiap klik toggle accordion
     * dipanggil dua kali → accordion toggle dan langsung balik (terkunci).
     *
     * Solusi: render() hanya dipanggil dari FormRenderer.render() secara
     * eksplisit. state:restore juga ditangani di FormRenderer.
     *
     * State events yang di-subscribe di sini hanya untuk sync in-place
     * (tanpa re-render DOM accordion) dan lifecycle:
     *   - 'table:change' → _syncControls (in-place update tombol/input)
     *   - 'table:reset'  → _syncControls (in-place update)
     *   - 'state:reset'  → _hide
     */

    const debouncedSync = Utils.debounce(() => {
      if (_templateId) _syncControls(_templateId);
    }, 60);
    State.on('table:change', debouncedSync);
    State.on('table:reset',  debouncedSync);

    State.on('state:reset', () => {
      _templateId = null;
      _hide();
    });
  }

  /* ────────────────────────────────────────────────
     PUBLIC: Render
  ──────────────────────────────────────────────── */
  function render(templateId) {
    if (!_mountEl) return;

    if (!templateId || !TemplateRegistry.templateHasTables(templateId)) {
      _hide();
      return;
    }

    _templateId = templateId;
    _mountEl.innerHTML = _buildAccordionHtml(templateId);
    _mountEl.removeAttribute('hidden');
    _mountEl.style.display = '';

    _bindEvents(_mountEl);
  }

  /* ────────────────────────────────────────────────
     Build HTML accordion utama
  ──────────────────────────────────────────────── */
  function _buildAccordionHtml(templateId) {
    const tableDefs = TemplateRegistry.getTableDefinitions(templateId);
    if (!tableDefs.length) return '';

    const tablesHtml = tableDefs.map(td => _buildTableSection(templateId, td)).join('');

    const hasMultiple = tableDefs.length > 1;
    const resetAllBtn = hasMultiple ? `
      <button type="button"
        class="btn btn--sm btn--danger-outline tbl-cfg__reset-all"
        data-action="reset-all"
        title="Reset semua pengaturan tabel ke default template">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true"><path d="M3.51 15a9 9 0 1 0 .49-4.95"/><polyline points="1,4 1,10 7,10"/></svg>
        Reset Semua Tabel
      </button>` : '';

    return `
      <section class="tbl-cfg-accordion" aria-label="Pengaturan Tabel">
        <div class="tbl-cfg-accordion__header">
          <button type="button"
            class="tbl-cfg-accordion__toggle"
            aria-expanded="true"
            aria-controls="tbl-cfg-body"
            id="tbl-cfg-toggle">
            <span class="tbl-cfg-accordion__toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="9"/></svg>
            </span>
            <span class="tbl-cfg-accordion__toggle-title">Pengaturan Tabel</span>
            <span class="tbl-cfg-accordion__chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </button>
          ${resetAllBtn}
        </div>
        <div class="tbl-cfg-accordion__body" id="tbl-cfg-body"
          role="region" aria-labelledby="tbl-cfg-toggle">
          ${tablesHtml}
        </div>
      </section>`;
  }

  /* ────────────────────────────────────────────────
     Build section satu tabel
  ──────────────────────────────────────────────── */
  function _buildTableSection(templateId, tableDef) {
    const resolvedCfg = TableConfigManager.getResolvedConfig(templateId, tableDef.id);
    const columns     = tableDef.columns;
    const tableId     = tableDef.id;

    // ── Tiga panel: Lebar Kolom | Header | Isi ──
    const colorHtml  = _buildColorPanel(templateId, tableId, resolvedCfg.colors);
    const widthHtml  = _buildWidthPanel(templateId, tableId, columns, resolvedCfg.columnWidths);
    const headerHtml = _buildSectionPanel(templateId, tableId, 'header', columns, resolvedCfg.header?.columns || {});
    const bodyHtml   = _buildSectionPanel(templateId, tableId, 'body',   columns, resolvedCfg.body?.columns   || {});

    const resetBtn = `
      <button type="button"
        class="btn btn--sm btn--ghost tbl-cfg__reset-table"
        data-action="reset-table"
        data-table-id="${_esc(tableId)}"
        title="Reset pengaturan tabel ini ke default template">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" aria-hidden="true"><path d="M3.51 15a9 9 0 1 0 .49-4.95"/><polyline points="1,4 1,10 7,10"/></svg>
        Reset
      </button>`;

    const tableDefs  = TemplateRegistry.getTableDefinitions(templateId);
    const tableLabel = tableDefs.length > 1
      ? `<div class="tbl-cfg__table-label">
           <span class="tbl-cfg__table-label-text">Tabel: ${_esc(tableDef.label)}</span>
           ${resetBtn}
         </div>`
      : `<div class="tbl-cfg__table-label tbl-cfg__table-label--single">${resetBtn}</div>`;

    return `
      <div class="tbl-cfg__table" data-table-id="${_esc(tableId)}">
        ${tableLabel}
        ${colorHtml}
        ${widthHtml}
        ${headerHtml}
        ${bodyHtml}
      </div>`;
  }

  function _buildColorPanel(templateId, tableId, colors) {
    const sectionKey = tableId + '-colors';
    const isOpen = _openSections[sectionKey] !== false;
    const sectionId = 'tbl-sec-' + _esc(tableId) + '-colors';
    const headerColor = colors?.header || '#FFFFFF';
    const bodyColor = colors?.body || '#FFFFFF';
    const resolvedCfg = TableConfigManager.getResolvedConfig(templateId, tableId);
    const rules = Array.isArray(resolvedCfg?.bodyColorRules) ? resolvedCfg.bodyColorRules : [];

    const presetColors = [
      ['#FFFFFF', 'Putih'], ['#F1F5F9', 'Abu muda'], ['#DBEAFE', 'Biru muda'],
      ['#E0F2FE', 'Biru lembut'], ['#DCFCE7', 'Hijau muda'], ['#FEF3C7', 'Kuning muda']
    ];
    const presets = presetColors.map(function(preset) {
      return '<button type="button" class="tbl-cfg__color-preset" data-action="color-preset" data-color="' + preset[0] +
        '" data-table-id="' + _esc(tableId) + '" title="' + _esc(preset[1]) + '" aria-label="Pilih warna ' + _esc(preset[1]) + '">' +
        '<span class="tbl-cfg__color-dot" style="background:' + preset[0] + ';"></span></button>';
    }).join('');

    return '<div class="tbl-cfg__section tbl-cfg__color-section">' +
      '<button type="button" class="tbl-cfg__section-toggle' + (isOpen ? ' is-open' : '') +
        '" aria-expanded="' + isOpen + '" aria-controls="' + sectionId + '" data-section-key="' + _esc(sectionKey) + '">' +
        '<span class="tbl-cfg__section-icon" aria-hidden="true">🎨</span>' +
        '<span class="tbl-cfg__section-title">Warna Tabel</span>' +
        '<span class="tbl-cfg__section-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="6 9 12 15 18 9"/></svg></span>' +
      '</button>' +
      '<div class="tbl-cfg__section-body' + (isOpen ? ' is-open' : '') + '" id="' + sectionId + '" role="region">' +
        '<div class="tbl-cfg__color-hint">Atur warna dasar <strong>Header</strong> dan <strong>Isi</strong> tabel. Untuk Isi, buat aturan berdasarkan baris dan/atau kolom.</div>' +
        '<div class="tbl-cfg__color-row" data-table-id="' + _esc(tableId) + '" data-color-section="header">' +
          '<div class="tbl-cfg__color-label-wrap"><span class="tbl-cfg__color-preview" style="background:' + headerColor + ';"></span><div><span class="tbl-cfg__color-label">Header Tabel</span><span class="tbl-cfg__color-description">Warna latar seluruh header</span></div></div>' +
          '<div class="tbl-cfg__color-input-wrap"><input type="color" class="tbl-cfg__color-picker" data-action="table-color" data-template-id="' + _esc(templateId) + '" data-table-id="' + _esc(tableId) + '" data-color-section="header" value="' + headerColor + '" aria-label="Header Tabel"/>' +
            '<input type="text" class="form-input tbl-cfg__color-hex" data-action="table-color-hex" data-template-id="' + _esc(templateId) + '" data-table-id="' + _esc(tableId) + '" data-color-section="header" value="' + headerColor + '" maxlength="7" spellcheck="false" aria-label="Kode warna Header Tabel" placeholder="#FFFFFF"/></div>' +
        '</div>' +
        '<div class="tbl-cfg__color-row" data-table-id="' + _esc(tableId) + '" data-color-section="body">' +
          '<div class="tbl-cfg__color-label-wrap"><span class="tbl-cfg__color-preview" style="background:' + bodyColor + ';"></span><div><span class="tbl-cfg__color-label">Isi Tabel</span><span class="tbl-cfg__color-description">Warna dasar sebelum aturan khusus</span></div></div>' +
          '<div class="tbl-cfg__color-input-wrap"><input type="color" class="tbl-cfg__color-picker" data-action="table-color" data-template-id="' + _esc(templateId) + '" data-table-id="' + _esc(tableId) + '" data-color-section="body" value="' + bodyColor + '" aria-label="Isi Tabel"/>' +
            '<input type="text" class="form-input tbl-cfg__color-hex" data-action="table-color-hex" data-template-id="' + _esc(templateId) + '" data-table-id="' + _esc(tableId) + '" data-color-section="body" value="' + bodyColor + '" maxlength="7" spellcheck="false" aria-label="Kode warna Isi Tabel" placeholder="#FFFFFF"/></div>' +
        '</div>' +
        '<div class="tbl-cfg__body-rule-editor">' +
          '<div class="tbl-cfg__body-rule-editor-head"><div><span class="tbl-cfg__body-rule-title">Pewarnaan Isi Tabel</span><span class="tbl-cfg__body-rule-description">Tambahkan satu atau beberapa aturan. Aturan terakhir yang ditambahkan menjadi prioritas.</span></div></div>' +
          '<div class="tbl-cfg__body-rule-form">' +
            '<div class="tbl-cfg__body-rule-field"><label class="tbl-cfg__control-label" for="body-rule-preset-' + _esc(tableId) + '">Preset Pewarnaan</label>' +
              '<select id="body-rule-preset-' + _esc(tableId) + '" class="form-select" data-action="body-rule-preset" data-table-id="' + _esc(tableId) + '">' +
                '<option value="manual">Pilih manual</option><option value="all-body">Semua Isi Tabel</option>' +
                '<option value="odd-row">Warna Setiap Baris Ganjil</option><option value="even-row">Warna Setiap Baris Genap</option>' +
                '<option value="odd-column">Warna Setiap Kolom Ganjil</option><option value="even-column">Warna Setiap Kolom Genap</option>' +
                '<option value="selected-row">Warnai Baris Tertentu</option><option value="selected-column">Warnai Kolom Tertentu</option>' +
                '<option value="selected-cell">Warnai Baris &amp; Kolom Tertentu</option>' +
              '</select></div>' +
            '<div class="tbl-cfg__body-rule-grid">' +
              '<div class="tbl-cfg__body-rule-field"><label class="tbl-cfg__control-label" for="body-rule-rows-' + _esc(tableId) + '">Baris</label>' +
                '<input type="text" class="form-input" id="body-rule-rows-' + _esc(tableId) + '" data-action="body-rule-rows" data-table-id="' + _esc(tableId) + '" placeholder="1, 3, 5-7" autocomplete="off"/>' +
                '<small>Contoh rentang: 1, 3, 5-7.</small></div>' +
              '<div class="tbl-cfg__body-rule-field"><label class="tbl-cfg__control-label" for="body-rule-cols-' + _esc(tableId) + '">Kolom</label>' +
                '<input type="text" class="form-input" id="body-rule-cols-' + _esc(tableId) + '" data-action="body-rule-cols" data-table-id="' + _esc(tableId) + '" placeholder="1, 3, 5-7" autocomplete="off"/>' +
                '<small>Nomor kolom dari kiri ke kanan.</small></div>' +
            '</div>' +
            '<div class="tbl-cfg__body-rule-field"><label class="tbl-cfg__control-label">Warna Aturan</label>' +
              '<div class="tbl-cfg__rule-color-wrap"><input type="color" class="tbl-cfg__color-picker" data-action="body-rule-color" data-table-id="' + _esc(tableId) + '" value="' + bodyColor + '" aria-label="Warna aturan"/>' +
                '<input type="text" class="form-input tbl-cfg__color-hex" data-action="body-rule-color-hex" data-table-id="' + _esc(tableId) + '" value="' + bodyColor + '" maxlength="7" spellcheck="false" placeholder="#FFFFFF" aria-label="Kode warna aturan"/>' +
                '<div class="tbl-cfg__color-preset-list">' + presets + '</div></div></div>' +
            '<div class="tbl-cfg__body-rule-actions"><button type="button" class="btn btn--sm btn--primary" data-action="add-body-color-rule" data-table-id="' + _esc(tableId) + '">＋ Tambahkan Aturan</button>' +
              '<button type="button" class="btn btn--sm btn--ghost" data-action="clear-body-color-rules" data-table-id="' + _esc(tableId) + '">Hapus Semua Aturan</button></div>' +
          '</div>' +
          '<div class="tbl-cfg__body-rules" data-table-id="' + _esc(tableId) + '">' + _buildBodyColorRulesHtml(rules, tableId) + '</div>' +
        '</div>' +
        '<div class="tbl-cfg__color-reset-row"><span>Reset semua warna tabel dan aturan Isi</span>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-action="reset-table-colors" data-table-id="' + _esc(tableId) + '">Reset Warna</button></div>' +
      '</div>' +
    '</div>';
  }

  function _buildBodyColorRulesHtml(rules, tableId) {
    if (!Array.isArray(rules) || !rules.length) {
      return '<div class="tbl-cfg__body-rules-empty">Belum ada aturan khusus. Isi tabel menggunakan warna dasar.</div>';
    }
    return rules.map(function(rule, index) {
      return '<div class="tbl-cfg__body-rule-card">' +
        '<span class="tbl-cfg__body-rule-swatch" style="background:' + _esc(rule.color || '#FFFFFF') + '"></span>' +
        '<div class="tbl-cfg__body-rule-card-copy"><strong>' + _esc(_describeBodyColorRule(rule)) + '</strong><small>Aturan #' + (index + 1) + '</small></div>' +
        '<button type="button" class="btn-icon" data-action="remove-body-color-rule" data-table-id="' + _esc(tableId) + '" data-rule-index="' + index + '" title="Hapus aturan" aria-label="Hapus aturan #' + (index + 1) + '">×</button>' +
      '</div>';
    }).join('');
  }

  function _describeBodyColorRule(rule) {
    const rowLabel = rule.rowMode === 'odd' ? 'Baris ganjil' : rule.rowMode === 'even' ? 'Baris genap' : rule.rowMode === 'selected' ? 'Baris ' + (rule.rows || []).join(', ') : 'Semua baris';
    const colLabel = rule.colMode === 'odd' ? 'kolom ganjil' : rule.colMode === 'even' ? 'kolom genap' : rule.colMode === 'selected' ? 'kolom ' + (rule.cols || []).map(function(i){ return i + 1; }).join(', ') : 'semua kolom';
    return rowLabel + ' · ' + colLabel;
  }


  /* ════════════════════════════════════════════════
     PANEL LEBAR KOLOM (structural — berlaku untuk seluruh kolom)
  ════════════════════════════════════════════════ */
  function _buildWidthPanel(templateId, tableId, columns, columnWidths) {
    const sectionKey = `${tableId}-width`;
    const isOpen     = _openSections[sectionKey] !== false; // default open
    const sectionId  = `tbl-sec-${_esc(tableId)}-width`;
    const byKey      = columnWidths?.byKey || {};

    // Total % indicator
    const totalPct = TableConfigManager.getTotalWidthPercent(columnWidths);
    const totalStr = totalPct !== null
      ? `<span class="tbl-cfg__width-total${totalPct > 100 ? ' tbl-cfg__width-total--over' : ''}"
           title="Total lebar kolom (mode %)">${totalPct}%</span>`
      : '';

    // Reset lebar kolom button
    const resetWidthBtn = `
      <button type="button"
        class="btn btn--sm btn--ghost tbl-cfg__width-reset-btn"
        data-action="reset-col-widths"
        data-table-id="${_esc(tableId)}"
        title="Reset semua lebar kolom ke Auto">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11" aria-hidden="true"><path d="M3.51 15a9 9 0 1 0 .49-4.95"/><polyline points="1,4 1,10 7,10"/></svg>
        Reset Lebar
      </button>`;

    // Per-kolom width rows
    const colRows = columns.map((col, idx) => {
      const key  = col.key || `col-${idx}`;
      const w    = byKey[key] || { mode: TableConfigManager.WIDTH_MODE_AUTO };
      return _buildWidthRow(templateId, tableId, col, idx, key, w);
    }).join('');

    return `
      <div class="tbl-cfg__section">
        <button type="button"
          class="tbl-cfg__section-toggle${isOpen ? ' is-open' : ''}"
          aria-expanded="${isOpen}"
          aria-controls="${sectionId}"
          data-section-key="${_esc(sectionKey)}">
          <span class="tbl-cfg__section-icon" aria-hidden="true">↔</span>
          <span class="tbl-cfg__section-title">Lebar Kolom</span>
          ${totalStr}
          <span class="tbl-cfg__section-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </button>
        <div class="tbl-cfg__section-body${isOpen ? ' is-open' : ''}"
          id="${sectionId}" role="region">
          <div class="tbl-cfg__width-toolbar">
            <span class="tbl-cfg__width-hint">Lebar berlaku pada Header &amp; Isi tabel.</span>
            ${resetWidthBtn}
          </div>
          <div class="tbl-cfg__width-rows">
            ${colRows}
          </div>
        </div>
      </div>`;
  }

  /* ── Build satu baris lebar kolom ── */
  function _buildWidthRow(templateId, tableId, colDef, colIdx, colKey, widthCfg) {
    const colLabel  = colDef.header || colDef.label || `Kolom ${colIdx + 1}`;
    const isCustom  = widthCfg.mode === TableConfigManager.WIDTH_MODE_CUSTOM;
    const curValue  = isCustom && widthCfg.value != null ? widthCfg.value : '';
    const curUnit   = widthCfg.unit || TableConfigManager.WIDTH_UNIT_PCT;

    const dataBase  = `data-template-id="${_esc(templateId)}" data-table-id="${_esc(tableId)}" data-col-key="${_esc(colKey)}"`;

    // Unit selector (% / mm)
    const unitOpts = [TableConfigManager.WIDTH_UNIT_PCT, TableConfigManager.WIDTH_UNIT_MM].map(u =>
      `<option value="${u}"${curUnit === u ? ' selected' : ''}>${u}</option>`
    ).join('');

    return `
      <div class="tbl-cfg__width-row" data-col-key="${_esc(colKey)}" data-table-id="${_esc(tableId)}">
        <span class="tbl-cfg__width-col-label" title="${_esc(colLabel)}">${_esc(colLabel)}</span>
        <div class="tbl-cfg__width-controls">
          <!-- Mode toggle: Auto | Custom -->
          <div class="tbl-cfg__width-mode-wrap" role="group" aria-label="Mode lebar ${_esc(colLabel)}">
            <button type="button"
              class="tbl-cfg__mode-btn${!isCustom ? ' is-active' : ''}"
              data-action="width-mode"
              data-value="${TableConfigManager.WIDTH_MODE_AUTO}"
              ${dataBase}
              aria-pressed="${!isCustom}"
              title="Lebar otomatis mengikuti konten">Auto</button>
            <button type="button"
              class="tbl-cfg__mode-btn${isCustom ? ' is-active' : ''}"
              data-action="width-mode"
              data-value="${TableConfigManager.WIDTH_MODE_CUSTOM}"
              ${dataBase}
              aria-pressed="${isCustom}"
              title="Atur lebar manual">Manual</button>
          </div>
          <!-- Value + unit (hanya aktif saat Custom) -->
          <div class="tbl-cfg__width-input-wrap${!isCustom ? ' is-disabled' : ''}">
            <input
              type="number"
              class="form-input tbl-cfg__width-input"
              data-action="col-width-value"
              ${dataBase}
              data-unit="${_esc(curUnit)}"
              value="${curValue}"
              placeholder="–"
              min="${curUnit === TableConfigManager.WIDTH_UNIT_MM ? TableConfigManager.WIDTH_MM_MIN : TableConfigManager.WIDTH_PCT_MIN}"
              max="${curUnit === TableConfigManager.WIDTH_UNIT_MM ? TableConfigManager.WIDTH_MM_MAX : TableConfigManager.WIDTH_PCT_MAX}"
              step="${curUnit === TableConfigManager.WIDTH_UNIT_MM ? '1' : '0.5'}"
              ${!isCustom ? 'disabled' : ''}
              aria-label="Lebar ${_esc(colLabel)}"
            />
            <select
              class="tbl-cfg__width-unit-select"
              data-action="col-width-unit"
              ${dataBase}
              ${!isCustom ? 'disabled' : ''}
              aria-label="Satuan lebar ${_esc(colLabel)}"
            >${unitOpts}</select>
          </div>
        </div>
      </div>`;
  }

  /* ════════════════════════════════════════════════
     PANEL STYLING TEKS (header / body)
  ════════════════════════════════════════════════ */
  function _buildSectionPanel(templateId, tableId, section, columns, colsConfig) {
    const sectionKey   = `${tableId}-${section}`;
    const isOpen       = _openSections[sectionKey] !== false;
    const sectionLabel = section === 'header' ? 'Header Tabel' : 'Isi Tabel';
    const sectionIcon  = section === 'header' ? '📌' : '📝';
    const sectionId    = `tbl-sec-${_esc(tableId)}-${section}`;

    const columnsHtml = columns.map((col, idx) => {
      const colCfg = colsConfig[idx] || {};
      return _buildColumnCard(templateId, tableId, section, idx, col, colCfg);
    }).join('');

    const applyAllBar = _buildApplyAllBar(templateId, tableId, section);

    const copyBar = section === 'body' ? `
      <div class="tbl-cfg__copy-bar">
        <button type="button"
          class="btn btn--sm btn--ghost tbl-cfg__copy-btn"
          data-action="copy-header-to-body"
          data-table-id="${_esc(tableId)}"
          title="Salin pengaturan Header ke Isi Tabel (bold akan di-off)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" aria-hidden="true"><polyline points="8,17 3,12 8,7"/><line x1="3" y1="12" x2="15" y2="12"/><path d="M21 12a6 6 0 0 1-6 6"/></svg>
          Salin dari Header
        </button>
      </div>` : '';

    return `
      <div class="tbl-cfg__section">
        <button type="button"
          class="tbl-cfg__section-toggle${isOpen ? ' is-open' : ''}"
          aria-expanded="${isOpen}"
          aria-controls="${sectionId}"
          data-section-key="${_esc(sectionKey)}">
          <span class="tbl-cfg__section-icon" aria-hidden="true">${sectionIcon}</span>
          <span class="tbl-cfg__section-title">${_esc(sectionLabel)}</span>
          <span class="tbl-cfg__section-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </button>
        <div class="tbl-cfg__section-body${isOpen ? ' is-open' : ''}"
          id="${sectionId}" role="region">
          ${applyAllBar}
          ${copyBar}
          <div class="tbl-cfg__columns">${columnsHtml}</div>
        </div>
      </div>`;
  }

  /* ── Build card satu kolom (styling teks) ── */
  function _buildColumnCard(templateId, tableId, section, colIdx, colDef, colCfg) {
    const colLabel  = colDef.header || colDef.label || `Kolom ${colIdx + 1}`;
    const hAlign    = colCfg.horizontalAlign || 'center';
    const vAlign    = colCfg.verticalAlign   || 'middle';
    const isBold    = colCfg.bold   === true;
    const isItalic  = colCfg.italic === true;
    const fontSize  = colCfg.fontSize != null ? colCfg.fontSize : '';
    // isWrap: gunakan nilai eksplisit dari config.
    // Jika undefined/null (state lama sebelum fitur wrapText), fallback ke
    // default yang sesuai section: header=false (nowrap), body=true (wrap).
    const wrapDefault = (section === 'header') ? false : true;
    const isWrap    = colCfg.wrapText != null ? colCfg.wrapText !== false : wrapDefault;

    const dataAttrs = [
      `data-template-id="${_esc(templateId)}"`,
      `data-table-id="${_esc(tableId)}"`,
      `data-section="${section}"`,
      `data-col-idx="${colIdx}"`,
    ].join(' ');

    const hAlignBtns = H_ALIGN_OPTIONS.map(opt => `
      <button type="button"
        class="tbl-cfg__align-btn${hAlign === opt.value ? ' is-active' : ''}"
        data-action="h-align"
        data-value="${opt.value}"
        ${dataAttrs}
        title="Horizontal: ${opt.label}"
        aria-label="Horizontal alignment: ${opt.label}"
        aria-pressed="${hAlign === opt.value}"
      >${opt.icon}</button>`).join('');

    const vAlignOptions = V_ALIGN_OPTIONS.map(opt =>
      `<option value="${opt.value}"${vAlign === opt.value ? ' selected' : ''}>${opt.label}</option>`
    ).join('');

    return `
      <div class="tbl-cfg__col-card"
        data-col-idx="${colIdx}"
        data-table-id="${_esc(tableId)}"
        data-section="${section}">
        <div class="tbl-cfg__col-header">
          <span class="tbl-cfg__col-num">${colIdx + 1}</span>
          <span class="tbl-cfg__col-label" title="${_esc(colLabel)}">${_esc(colLabel)}</span>
        </div>
        <div class="tbl-cfg__col-controls">
          <div class="tbl-cfg__control-group">
            <label class="tbl-cfg__control-label">Horizontal</label>
            <div class="tbl-cfg__align-btns" role="group"
              aria-label="Horizontal alignment untuk ${_esc(colLabel)}">
              ${hAlignBtns}
            </div>
          </div>
          <div class="tbl-cfg__control-row">
            <div class="tbl-cfg__control-group tbl-cfg__control-group--flex">
              <label class="tbl-cfg__control-label"
                for="v-align-${_esc(tableId)}-${section}-${colIdx}">Vertikal</label>
              <select
                id="v-align-${_esc(tableId)}-${section}-${colIdx}"
                class="form-select tbl-cfg__v-align-select"
                data-action="v-align"
                ${dataAttrs}
                aria-label="Vertical alignment untuk ${_esc(colLabel)}"
              >${vAlignOptions}</select>
            </div>
            <div class="tbl-cfg__control-group tbl-cfg__control-group--center">
              <label class="tbl-cfg__control-label">Style</label>
              <div class="tbl-cfg__style-btns">
                <button type="button"
                  class="style-btn style-btn--bold${isBold ? ' active' : ''}"
                  data-action="bold"
                  data-value="${isBold ? 'false' : 'true'}"
                  ${dataAttrs}
                  title="Bold"
                  aria-label="Bold untuk ${_esc(colLabel)}"
                  aria-pressed="${isBold}">B</button>
                <button type="button"
                  class="style-btn style-btn--italic${isItalic ? ' active' : ''}"
                  data-action="italic"
                  data-value="${isItalic ? 'false' : 'true'}"
                  ${dataAttrs}
                  title="Italic"
                  aria-label="Italic untuk ${_esc(colLabel)}"
                  aria-pressed="${isItalic}">I</button>
              </div>
            </div>
            <div class="tbl-cfg__control-group tbl-cfg__control-group--fs">
              <label class="tbl-cfg__control-label"
                for="fs-${_esc(tableId)}-${section}-${colIdx}">Ukuran</label>
              <div class="tbl-cfg__fs-wrap">
                <input type="number"
                  id="fs-${_esc(tableId)}-${section}-${colIdx}"
                  class="form-input tbl-cfg__fs-input"
                  data-action="font-size"
                  ${dataAttrs}
                  value="${fontSize}"
                  placeholder="global"
                  min="${TableConfigManager.FONT_SIZE_MIN}"
                  max="${TableConfigManager.FONT_SIZE_MAX}"
                  step="0.5"
                  aria-label="Font size untuk ${_esc(colLabel)}" />
                <span class="tbl-cfg__fs-unit">pt</span>
              </div>
            </div>
          </div>

          <!-- Wrap Text toggle -->
          <div class="tbl-cfg__control-group tbl-cfg__wrap-row">
            <label class="tbl-cfg__control-label"
              id="wrap-lbl-${_esc(tableId)}-${section}-${colIdx}">Wrap Teks</label>
            <div class="tbl-cfg__wrap-toggle-wrap">
              <button type="button"
                class="tbl-cfg__wrap-btn${!isWrap ? ' is-active' : ''}"
                data-action="wrap-text"
                data-value="false"
                ${dataAttrs}
                title="Teks dalam satu baris (nowrap)"
                aria-label="Wrap Teks OFF untuk ${_esc(colLabel)}"
                aria-pressed="${!isWrap}">
                <svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="13" aria-hidden="true"><line x1="1" y1="3" x2="19" y2="3"/><line x1="1" y1="7" x2="19" y2="7"/><line x1="1" y1="11" x2="13" y2="11"/></svg>
                <span>Off</span>
              </button>
              <button type="button"
                class="tbl-cfg__wrap-btn${isWrap ? ' is-active' : ''}"
                data-action="wrap-text"
                data-value="true"
                ${dataAttrs}
                title="Teks dapat membungkus ke baris berikutnya"
                aria-label="Wrap Teks ON untuk ${_esc(colLabel)}"
                aria-pressed="${isWrap}">
                <svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="13" aria-hidden="true"><line x1="1" y1="3" x2="19" y2="3"/><line x1="1" y1="7" x2="14" y2="7"/><path d="M14 5 L14 9 L17 7" stroke-linejoin="round" stroke-linecap="round"/><line x1="1" y1="11" x2="10" y2="11"/></svg>
                <span>On</span>
              </button>
            </div>
          </div>

        </div>
      </div>`;
  }

  /* ── Build Apply-to-all bar ── */
  function _buildApplyAllBar(templateId, tableId, section) {
    const sectionLabel = section === 'header' ? 'Header Tabel' : 'Isi Tabel';
    const da = `data-template-id="${_esc(templateId)}" data-table-id="${_esc(tableId)}" data-section="${section}"`;

    return `
      <div class="tbl-cfg__apply-all-bar">
        <span class="tbl-cfg__apply-all-label">Terapkan ke semua kolom ${_esc(sectionLabel)}:</span>
        <div class="tbl-cfg__apply-all-btns">
          ${H_ALIGN_OPTIONS.map(opt => `
            <button type="button"
              class="tbl-cfg__apply-btn"
              data-action="apply-all-h-align"
              data-value="${opt.value}"
              ${da}
              title="Semua kolom ${sectionLabel}: ${opt.label}"
              aria-label="Semua kolom ${sectionLabel}: Horizontal ${opt.label}"
            >${opt.icon}</button>`).join('')}
          <button type="button"
            class="tbl-cfg__apply-btn tbl-cfg__apply-btn--bold"
            data-action="apply-all-bold-on"
            ${da}
            title="Semua kolom ${sectionLabel}: Bold ON"
            aria-label="Semua kolom ${sectionLabel}: Bold ON"
          ><strong>B+</strong></button>
          <button type="button"
            class="tbl-cfg__apply-btn"
            data-action="apply-all-bold-off"
            ${da}
            title="Semua kolom ${sectionLabel}: Bold OFF"
            aria-label="Semua kolom ${sectionLabel}: Bold OFF"
          ><span style="font-weight:normal;opacity:.6">B</span></button>
          <button type="button"
            class="tbl-cfg__apply-btn tbl-cfg__apply-btn--wrap-on"
            data-action="apply-all-wrap-on"
            ${da}
            title="Semua kolom ${sectionLabel}: Wrap Teks ON"
            aria-label="Semua kolom ${sectionLabel}: Wrap Teks ON"
          ><svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2" width="16" height="11" aria-hidden="true"><line x1="1" y1="3" x2="19" y2="3"/><line x1="1" y1="7" x2="14" y2="7"/><path d="M14 5 L14 9 L17 7" stroke-linejoin="round" stroke-linecap="round"/><line x1="1" y1="11" x2="10" y2="11"/></svg></button>
          <button type="button"
            class="tbl-cfg__apply-btn"
            data-action="apply-all-wrap-off"
            ${da}
            title="Semua kolom ${sectionLabel}: Wrap Teks OFF"
            aria-label="Semua kolom ${sectionLabel}: Wrap Teks OFF"
          ><svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2" width="16" height="11" aria-hidden="true" style="opacity:.6"><line x1="1" y1="3" x2="19" y2="3"/><line x1="1" y1="7" x2="19" y2="7"/><line x1="1" y1="11" x2="13" y2="11"/></svg></button>
        </div>
      </div>`;
  }

  /* ════════════════════════════════════════════════
     EVENT BINDING
  ════════════════════════════════════════════════ */
  function _bindEvents(root) {
    if (!root || _boundClickHandler) return;

    // Event delegation cukup dipasang satu kali. Handler selalu membaca
    // _templateId terbaru sehingga perpindahan template tidak membuat
    // listener lama menulis ke template sebelumnya.
    _boundClickHandler  = e => _handleClick(e, _templateId);
    _boundChangeHandler = e => _handleChange(e, _templateId);
    _boundInputHandler  = e => _handleInput(e, _templateId);

    root.addEventListener('click',  _boundClickHandler);
    root.addEventListener('change', _boundChangeHandler);
    root.addEventListener('input',  _boundInputHandler);
  }

  function _getBodyRulePresetConfig(preset, rowsText, colsText) {
    const rows = _parseIndexList(rowsText, 1);
    const cols = _parseIndexList(colsText, 1).map(function(n) { return n - 1; });
    const config = { preset: preset || 'manual', color: '#FFFFFF', rowMode: 'all', colMode: 'all', rows: rows, cols: cols };
    if (preset === 'odd-row') config.rowMode = 'odd';
    else if (preset === 'even-row') config.rowMode = 'even';
    else if (preset === 'odd-column') config.colMode = 'odd';
    else if (preset === 'even-column') config.colMode = 'even';
    else if (preset === 'selected-row') config.rowMode = 'selected';
    else if (preset === 'selected-column') config.colMode = 'selected';
    else if (preset === 'selected-cell') { config.rowMode = 'selected'; config.colMode = 'selected'; }
    else if (preset === 'manual') {
      config.rowMode = rows.length ? 'selected' : 'all';
      config.colMode = cols.length ? 'selected' : 'all';
    }
    return config;
  }

  function _parseIndexList(text, min) {
    const value = String(text || '').trim();
    if (!value) return [];
    const out = new Set();
    value.split(',').forEach(function(part) {
      const token = part.trim();
      if (!token) return;
      const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        let a = parseInt(range[1], 10), b = parseInt(range[2], 10);
        if (a > b) { const tmp = a; a = b; b = tmp; }
        for (let i = a; i <= Math.min(b, 9999); i++) if (i >= min) out.add(i);
        return;
      }
      const n = parseInt(token, 10);
      if (Number.isInteger(n) && n >= min) out.add(n);
    });
    return Array.from(out).sort(function(a,b) { return a-b; });
  }

  function _handleClick(e, templateId) {
    // ── 1. Accordion utama ──────────────────────────────────────────────
    const mainToggle = e.target.closest('.tbl-cfg-accordion__toggle');
    if (mainToggle) {
      const body     = _mountEl?.querySelector('#tbl-cfg-body');
      const expanded = mainToggle.getAttribute('aria-expanded') === 'true';
      mainToggle.setAttribute('aria-expanded', String(!expanded));
      mainToggle.querySelector('.tbl-cfg-accordion__chevron')
        ?.classList.toggle('is-collapsed', expanded);
      body?.classList.toggle('is-collapsed', expanded);
      return;
    }

    // ── 2. Section toggle (Lebar Kolom / Header / Isi) ──────────────────
    const sectionToggle = e.target.closest('.tbl-cfg__section-toggle');
    if (sectionToggle) {
      const sectionKey = sectionToggle.dataset.sectionKey;
      if (sectionKey) {
        _openSections[sectionKey] = !(_openSections[sectionKey] !== false);
        _toggleSection(sectionKey, sectionToggle);
      }
      return;
    }

    // ── 3. Aksi per-kolom dan bulk (ada data-action) ────────────────────
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action   = btn.dataset.action;
    const tableId  = btn.dataset.tableId;
    const section  = btn.dataset.section;
    const colIdx   = parseInt(btn.dataset.colIdx, 10);
    const colKey   = btn.dataset.colKey;
    const value    = btn.dataset.value;
    const colorSection = btn.dataset.colorSection;
    const color = btn.dataset.color;

    switch (action) {

      /* ── Preset warna tabel ── */
      case 'color-preset': {
        if (tableId && color) TableConfigManager.updateTableColors(templateId, tableId, { header: color });
        break;
      }

      /* ── Reset warna tabel ── */
      case 'reset-table-colors': {
        if (tableId) {
          TableConfigManager.resetTableColors(templateId, tableId);
          UI.toast('Warna Header dan Isi tabel direset ke putih.', 'info', 1800);
        }
        break;
      }

      /* ── Lebar kolom: toggle mode Auto / Manual ── */
      case 'width-mode': {
        if (colKey && tableId) {
          if (value === TableConfigManager.WIDTH_MODE_AUTO) {
            TableConfigManager.updateColumnWidth(templateId, tableId, colKey, {
              mode: TableConfigManager.WIDTH_MODE_AUTO,
            });
          } else {
            // Custom: beri nilai default jika belum ada
            const currentAll = State.getTableConfig(templateId);
            const existing   = currentAll[tableId]?.columnWidths?.byKey?.[colKey];
            const defVal     = (existing?.mode === TableConfigManager.WIDTH_MODE_CUSTOM && existing.value)
              ? existing.value : 10;
            const defUnit    = existing?.unit || TableConfigManager.WIDTH_UNIT_PCT;
            TableConfigManager.updateColumnWidth(templateId, tableId, colKey, {
              mode:  TableConfigManager.WIDTH_MODE_CUSTOM,
              value: defVal,
              unit:  defUnit,
            });
          }
          // Immediate visual feedback: jangan tunggu debounce 60ms.
          // Update tombol dan input langsung dari DOM row yang diklik.
          const row = btn.closest('.tbl-cfg__width-row');
          if (row) {
            const isNowCustom = value === TableConfigManager.WIDTH_MODE_CUSTOM;
            // Toggle is-active pada semua mode buttons di row ini
            row.querySelectorAll('[data-action="width-mode"]').forEach(b => {
              const bIsCustom = b.dataset.value === TableConfigManager.WIDTH_MODE_CUSTOM;
              b.classList.toggle('is-active', bIsCustom === isNowCustom);
              b.setAttribute('aria-pressed', String(bIsCustom === isNowCustom));
            });
            // Enable/disable input wrap
            const inputWrap = row.querySelector('.tbl-cfg__width-input-wrap');
            if (inputWrap) inputWrap.classList.toggle('is-disabled', !isNowCustom);
            // Enable/disable input dan select
            const valInput = row.querySelector('[data-action="col-width-value"]');
            if (valInput) {
              valInput.disabled = !isNowCustom;
              if (!isNowCustom) valInput.value = '';
            }
            const unitSel = row.querySelector('[data-action="col-width-unit"]');
            if (unitSel) unitSel.disabled = !isNowCustom;
          }
        }
        break;
      }

      /* ── Reset semua lebar kolom satu tabel ke Auto ── */
      case 'reset-col-widths': {
        if (tableId) {
          TableConfigManager.resetColumnWidths(templateId, tableId);
          UI.toast('Semua lebar kolom direset ke Auto.', 'info', 2000);
        }
        break;
      }

      /* ── Horizontal alignment (per kolom) ── */
      case 'h-align': {
        if (!isNaN(colIdx)) {
          TableConfigManager.updateColumn(templateId, tableId, section, colIdx, {
            horizontalAlign: value,
          });
        }
        break;
      }

      /* ── Bold toggle ── */
      case 'bold': {
        if (!isNaN(colIdx)) {
          TableConfigManager.updateColumn(templateId, tableId, section, colIdx, {
            bold: value === 'true',
          });
        }
        break;
      }

      /* ── Italic toggle ── */
      case 'italic': {
        if (!isNaN(colIdx)) {
          TableConfigManager.updateColumn(templateId, tableId, section, colIdx, {
            italic: value === 'true',
          });
        }
        break;
      }

      /* ── Wrap Text toggle (per kolom) ── */
      case 'wrap-text': {
        if (!isNaN(colIdx)) {
          TableConfigManager.updateColumn(templateId, tableId, section, colIdx, {
            wrapText: value === 'true',
          });
        }
        break;
      }

      /* ── Apply all: horizontal alignment ── */
      case 'apply-all-h-align': {
        TableConfigManager.applyToAllColumns(templateId, tableId, section, {
          horizontalAlign: value,
        });
        break;
      }

      /* ── Apply all: bold ── */
      case 'apply-all-bold-on': {
        TableConfigManager.applyToAllColumns(templateId, tableId, section, { bold: true });
        break;
      }
      case 'apply-all-bold-off': {
        TableConfigManager.applyToAllColumns(templateId, tableId, section, { bold: false });
        break;
      }

      /* ── Apply all: wrap text ── */
      case 'apply-all-wrap-on': {
        TableConfigManager.applyWrapTextToAll(templateId, tableId, section, true);
        break;
      }
      case 'apply-all-wrap-off': {
        TableConfigManager.applyWrapTextToAll(templateId, tableId, section, false);
        break;
      }

      /* ── Copy header → body ── */
      case 'copy-header-to-body': {
        TableConfigManager.copyHeaderToBody(templateId, tableId);
        UI.toast('Pengaturan header disalin ke isi tabel.', 'info', 2000);
        break;
      }

      /* ── Reset satu tabel ── */
      case 'reset-table': {
        UI.confirm('Reset Pengaturan Tabel',
          'Reset pengaturan tabel ini ke default template?',
          () => {
            TableConfigManager.resetToDefault(templateId, tableId);
            UI.toast('Pengaturan tabel direset ke default.', 'info', 2000);
          }
        );
        break;
      }

      /* ── Reset semua tabel ── */
      case 'reset-all': {
        UI.confirm('Reset Semua Pengaturan Tabel',
          'Reset SEMUA pengaturan tabel ke default template?',
          () => {
            TableConfigManager.resetToDefault(templateId, null);
            UI.toast('Semua pengaturan tabel direset ke default.', 'info', 2000);
          }
        );
        break;
      }

      default:
        break;
    }
  }

  function _handleChange(e, templateId) {
    const el     = e.target;
    const action = el.dataset.action;
    if (!action) return;

    const tableId = el.dataset.tableId;
    const section = el.dataset.section;
    const colIdx  = parseInt(el.dataset.colIdx, 10);
    const colKey  = el.dataset.colKey;
    const colorSection = el.dataset.colorSection;

    /* ── Warna picker ── */
    if (action === 'table-color' && colorSection) {
      TableConfigManager.updateTableColors(templateId, tableId, { [colorSection]: el.value.toUpperCase() });
      return;
    }

    /* ── Vertical alignment ── */
    if (action === 'v-align' && !isNaN(colIdx)) {
      TableConfigManager.updateColumn(templateId, tableId, section, colIdx, {
        verticalAlign: el.value,
      });
      return;
    }

    /* ── Unit lebar kolom (% / mm) ── */
    if (action === 'col-width-unit' && colKey) {
      const currentAll = State.getTableConfig(templateId);
      const existing   = currentAll[tableId]?.columnWidths?.byKey?.[colKey];
      if (existing?.mode === TableConfigManager.WIDTH_MODE_CUSTOM) {
        // Reset value ke sensible default saat unit berubah
        const newUnit  = el.value;
        const newValue = newUnit === TableConfigManager.WIDTH_UNIT_MM ? 20 : 10;
        TableConfigManager.updateColumnWidth(templateId, tableId, colKey, {
          mode:  TableConfigManager.WIDTH_MODE_CUSTOM,
          unit:  newUnit,
          value: newValue,
        });
        // Update data-unit pada sibling input
        const row       = el.closest('.tbl-cfg__width-row');
        const valInput  = row?.querySelector('[data-action="col-width-value"]');
        if (valInput) {
          valInput.dataset.unit = newUnit;
          valInput.value        = newValue;
          valInput.min          = newUnit === TableConfigManager.WIDTH_UNIT_MM
            ? TableConfigManager.WIDTH_MM_MIN : TableConfigManager.WIDTH_PCT_MIN;
          valInput.max          = newUnit === TableConfigManager.WIDTH_UNIT_MM
            ? TableConfigManager.WIDTH_MM_MAX : TableConfigManager.WIDTH_PCT_MAX;
          valInput.step         = newUnit === TableConfigManager.WIDTH_UNIT_MM ? '1' : '0.5';
        }
      }
    }
  }

  function _handleInput(e, templateId) {
    const el     = e.target;
    const action = el.dataset.action;
    const tableId = el.dataset.tableId;
    const colorSection = el.dataset.colorSection;

    /* ── Kode HEX warna ── */
    if (action === 'table-color-hex' && colorSection) {
      const value = el.value.trim().toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(value)) return;
      TableConfigManager.updateTableColors(templateId, tableId, { [colorSection]: value });
      return;
    }

    /* ── Font size ── */
    if (action === 'font-size') {
      const tableId = el.dataset.tableId;
      const section = el.dataset.section;
      const colIdx  = parseInt(el.dataset.colIdx, 10);
      if (isNaN(colIdx)) return;

      const rawVal = el.value.trim();
      if (rawVal === '') {
        TableConfigManager.updateColumn(templateId, tableId, section, colIdx, { fontSize: null });
        return;
      }
      const num = parseFloat(rawVal);
      if (isNaN(num)) return;
      const clamped = Utils.clamp(num, TableConfigManager.FONT_SIZE_MIN, TableConfigManager.FONT_SIZE_MAX);
      if (num !== clamped) el.value = clamped;
      TableConfigManager.updateColumn(templateId, tableId, section, colIdx, { fontSize: clamped });
      return;
    }

    /* ── Column width value ── */
    if (action === 'col-width-value') {
      const tableId = el.dataset.tableId;
      const colKey  = el.dataset.colKey;
      if (!tableId || !colKey) return;

      const rawVal = el.value.trim();
      if (rawVal === '') return; // jangan update saat masih mengetik

      const num  = parseFloat(rawVal);
      if (isNaN(num) || num <= 0) return;

      const unit    = el.dataset.unit || TableConfigManager.WIDTH_UNIT_PCT;
      const minV    = unit === TableConfigManager.WIDTH_UNIT_MM ? TableConfigManager.WIDTH_MM_MIN : TableConfigManager.WIDTH_PCT_MIN;
      const maxV    = unit === TableConfigManager.WIDTH_UNIT_MM ? TableConfigManager.WIDTH_MM_MAX : TableConfigManager.WIDTH_PCT_MAX;
      const clamped = Utils.clamp(num, minV, maxV);
      if (num !== clamped) el.value = clamped;

      TableConfigManager.updateColumnWidth(templateId, tableId, colKey, {
        mode:  TableConfigManager.WIDTH_MODE_CUSTOM,
        value: clamped,
        unit,
      });
    }
  }

  /* ════════════════════════════════════════════════
     SYNC CONTROLS — in-place DOM update setelah Apply-to-All
     Memperbarui visual kontrol (tombol aktif, nilai input) tanpa
     mengganti innerHTML accordion → tidak ada duplicate listener →
     accordion tetap bisa expand/collapse.
  ════════════════════════════════════════════════ */
  function _syncControls(templateId) {
    if (!_mountEl || !templateId) return;

    const tableDefs = TemplateRegistry.getTableDefinitions(templateId);
    tableDefs.forEach(tableDef => {
      const tableId     = tableDef.id;
      const resolvedCfg = TableConfigManager.getResolvedConfig(templateId, tableId);

      // ── Sync warna tabel ──
      _syncTableColors(tableId, resolvedCfg.colors);

      // ── Sync Header + Body section (styling teks per kolom) ──
      ['header', 'body'].forEach(section => {
        const colsCfg = resolvedCfg[section]?.columns || {};
        tableDef.columns.forEach((col, idx) => {
          const colCfg = colsCfg[idx] || {};
          _syncColCard(tableId, section, idx, col, colCfg);
        });
      });

      // ── Sync Lebar Kolom rows (tombol Auto/Manual + input + unit) ──
      _syncWidthRows(tableId, resolvedCfg.columnWidths, tableDef.columns);

      // ── Sync total % indicator di header section Lebar Kolom ──
      _syncWidthTotal(tableId, resolvedCfg.columnWidths);
    });
  }

  function _syncTableColors(tableId, colors) {
    if (!_mountEl) return;
    ['header', 'body'].forEach(function(section) {
      const color = colors?.[section] || '#FFFFFF';
      const rows = _mountEl.querySelectorAll('.tbl-cfg__color-row[data-table-id][data-color-section]');
      const row = Array.from(rows).find(function(el) { return el.dataset.tableId === tableId && el.dataset.colorSection === section; });
      if (!row) return;
      const picker = row.querySelector('[data-action="table-color"]');
      const hex = row.querySelector('[data-action="table-color-hex"]');
      const preview = row.querySelector('.tbl-cfg__color-preview');
      if (picker && picker.value !== color) picker.value = color;
      if (hex && hex.value !== color) hex.value = color;
      if (preview) preview.style.background = color;
    });
  }

  /**
   * Sync satu kolom card secara in-place.
   * Hanya mengubah properti individual, tidak menyentuh innerHTML parent.
   */
  function _syncColCard(tableId, section, colIdx, colDef, colCfg) {
    if (!_mountEl) return;

    // Query card berdasarkan data attributes.
    // Gunakan filter manual agar tidak bergantung pada CSS.escape untuk tableId.
    const allCards = _mountEl.querySelectorAll(
      `.tbl-cfg__col-card[data-section="${section}"][data-col-idx="${colIdx}"]`
    );
    // Filter ke tableId yang tepat secara string exact
    const card = Array.from(allCards).find(el => el.dataset.tableId === tableId);
    if (!card) return;

    // ── Horizontal alignment buttons ──
    const hAlign = colCfg.horizontalAlign || 'center';
    card.querySelectorAll('[data-action="h-align"]').forEach(btn => {
      const isActive = btn.dataset.value === hAlign;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // ── Bold button ──
    const boldBtn = card.querySelector('[data-action="bold"]');
    if (boldBtn) {
      const isBold = colCfg.bold === true;
      boldBtn.classList.toggle('active', isBold);
      boldBtn.setAttribute('aria-pressed', String(isBold));
      boldBtn.dataset.value = isBold ? 'false' : 'true';
    }

    // ── Italic button ──
    const italicBtn = card.querySelector('[data-action="italic"]');
    if (italicBtn) {
      const isItalic = colCfg.italic === true;
      italicBtn.classList.toggle('active', isItalic);
      italicBtn.setAttribute('aria-pressed', String(isItalic));
      italicBtn.dataset.value = isItalic ? 'false' : 'true';
    }

    // ── Wrap Text buttons ──
    const wrapDefault = (section === 'header') ? false : true;
    const isWrap      = colCfg.wrapText != null ? colCfg.wrapText !== false : wrapDefault;
    card.querySelectorAll('[data-action="wrap-text"]').forEach(btn => {
      const btnIsWrap = btn.dataset.value === 'true';
      const isActive  = (btnIsWrap === isWrap);
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // ── Font size input ──
    const fsInput = card.querySelector('[data-action="font-size"]');
    if (fsInput) {
      const fs = colCfg.fontSize != null ? colCfg.fontSize : '';
      if (fsInput.value !== String(fs)) fsInput.value = fs;
    }

    // ── Vertical alignment select ──
    const vAlignSel = card.querySelector('[data-action="v-align"]');
    if (vAlignSel) {
      const vAlign = colCfg.verticalAlign || 'middle';
      if (vAlignSel.value !== vAlign) vAlignSel.value = vAlign;
    }
  }

  /**
   * Sync total % indicator di section Lebar Kolom.
   */
  function _syncWidthTotal(tableId, columnWidths) {
    if (!_mountEl) return;
    // sectionKey mengikuti format yang sama dengan _buildWidthPanel: `${tableId}-width`
    const sectionKey = `${tableId}-width`;
    const toggleBtn  = _mountEl.querySelector(
      `.tbl-cfg__section-toggle[data-section-key="${sectionKey}"]`
    );
    if (!toggleBtn) return;

    const totalPct = TableConfigManager.getTotalWidthPercent(columnWidths);
    let totalSpan  = toggleBtn.querySelector('.tbl-cfg__width-total');

    if (totalPct !== null) {
      if (!totalSpan) {
        totalSpan = document.createElement('span');
        totalSpan.title = 'Total lebar kolom (mode %)';
        const chevron = toggleBtn.querySelector('.tbl-cfg__section-chevron');
        if (chevron) toggleBtn.insertBefore(totalSpan, chevron);
        else toggleBtn.appendChild(totalSpan);
      }
      totalSpan.className   = `tbl-cfg__width-total${totalPct > 100 ? ' tbl-cfg__width-total--over' : ''}`;
      totalSpan.textContent = `${totalPct}%`;
    } else {
      totalSpan?.remove();
    }
  }

  /**
   * Sync baris lebar kolom (tombol Auto/Manual, enable/disable input, nilai input).
   * Dipanggil dari _syncControls saat table:change emit.
   *
   * Ini adalah bagian yang sebelumnya hilang: tanpa fungsi ini,
   * setelah user klik Auto/Manual, tombol tidak berubah visual
   * meski state sudah berubah — menyebabkan user mengira klik gagal.
   */
  function _syncWidthRows(tableId, columnWidths, columns) {
    if (!_mountEl || !columns) return;
    const byKey = columnWidths?.byKey || {};

    columns.forEach((col, idx) => {
      const colKey = col.key || `col-${idx}`;
      const w      = byKey[colKey] || { mode: TableConfigManager.WIDTH_MODE_AUTO };
      const isCustom = w.mode === TableConfigManager.WIDTH_MODE_CUSTOM;

      // Cari row berdasarkan data-col-key dan data-table-id
      const allRows = _mountEl.querySelectorAll(
        `.tbl-cfg__width-row[data-col-key]`
      );
      const row = Array.from(allRows).find(
        el => el.dataset.colKey === colKey && el.dataset.tableId === tableId
      );
      if (!row) return;

      // ── Sync tombol Auto/Manual ──
      row.querySelectorAll('[data-action="width-mode"]').forEach(btn => {
        const btnIsCustom = btn.dataset.value === TableConfigManager.WIDTH_MODE_CUSTOM;
        const isActive    = (btnIsCustom === isCustom);
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });

      // ── Sync input wrapper (is-disabled class) ──
      const inputWrap = row.querySelector('.tbl-cfg__width-input-wrap');
      if (inputWrap) {
        inputWrap.classList.toggle('is-disabled', !isCustom);
      }

      // ── Sync input value dan disabled attr ──
      const valInput = row.querySelector('[data-action="col-width-value"]');
      if (valInput) {
        valInput.disabled = !isCustom;
        if (isCustom && w.value != null) {
          // Hanya update jika berbeda untuk menghindari interrupt user saat mengetik
          const newVal = String(w.value);
          if (valInput.value !== newVal) valInput.value = newVal;
        } else if (!isCustom) {
          valInput.value = '';
        }
      }

      // ── Sync unit select dan disabled attr ──
      const unitSel = row.querySelector('[data-action="col-width-unit"]');
      if (unitSel) {
        unitSel.disabled = !isCustom;
        const curUnit = w.unit || TableConfigManager.WIDTH_UNIT_PCT;
        if (unitSel.value !== curUnit) unitSel.value = curUnit;
      }
    });
  }

  /* ════════════════════════════════════════════════
     TOGGLE SECTION (in-place, no full re-render)
  ════════════════════════════════════════════════ */
  function _toggleSection(sectionKey, toggleBtn) {
    const isNowOpen     = _openSections[sectionKey] !== false;
    const sectionBodyId = toggleBtn.getAttribute('aria-controls');

    toggleBtn.setAttribute('aria-expanded', isNowOpen ? 'true' : 'false');
    toggleBtn.classList.toggle('is-open', isNowOpen);

    if (sectionBodyId) {
      const sectionBody = _mountEl
        ? _mountEl.querySelector(`#${CSS.escape(sectionBodyId)}`)
        : document.getElementById(sectionBodyId);
      sectionBody?.classList.toggle('is-open', isNowOpen);
    }
  }

  /* ── Hide ── */
  function _hide() {
    if (!_mountEl) return;
    _mountEl.setAttribute('hidden', '');
    _mountEl.style.display = 'none';
    _mountEl.innerHTML     = '';
  }

  /* ── Escape helper ── */
  function _esc(v) {
    return Utils.escapeHtml(String(v ?? ''));
  }

  /* ── Public API ── */
  return { init, render };

})();
