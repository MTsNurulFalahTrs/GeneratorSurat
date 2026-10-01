/* =============================================================
   table-config-ui.js — Accordion "Pengaturan Tabel" di Tab Isi Surat
   =============================================================
   Tanggung jawab:
   - Render accordion "Pengaturan Tabel" di mount point yang disediakan
     FormRenderer (#table-config-mount).
   - Show/hide accordion berdasarkan apakah template aktif punya tabel.
   - Render per-tabel: header section + body section, per kolom.
   - Bind semua event: alignment, bold, italic, fontSize, apply-all,
     copy-header-to-body, reset.
   - Setiap perubahan langsung → TableConfigManager.updateColumn()
     → State.setTableConfig() → emit 'table:change' → PreviewRenderer
     otomatis re-render.
   =============================================================
*/

const TableConfigUI = (() => {

  /* ── State UI lokal ── */
  let _mountEl       = null;    // elemen #table-config-mount
  let _templateId    = null;    // template aktif saat ini
  let _openSections  = {};      // { 'tableId-header': true, ... } — accordion state

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
     PUBLIC: Init (dipanggil sekali saat app boot)
  ──────────────────────────────────────────────── */
  function init(mountEl) {
    if (!mountEl) return;
    _mountEl = mountEl;

    // Subscribe template change → re-render accordion
    State.on('template:change', ({ templateId }) => {
      _templateId = templateId;
      TableConfigManager.initForTemplate(templateId);
      render(templateId);
    });

    // Subscribe table config change → re-render accordion agar sinkron
    // (Debounced 50ms agar tidak berlebihan saat apply-all)
    const debouncedRender = Utils.debounce(() => {
      if (_templateId) render(_templateId);
    }, 50);
    State.on('table:change', debouncedRender);
    State.on('table:reset',  debouncedRender);

    // Subscribe state restore → re-render
    State.on('state:restore', () => {
      _templateId = State.getActiveTemplate();
      if (_templateId) {
        TableConfigManager.initForTemplate(_templateId);
        render(_templateId);
      } else {
        _hide();
      }
    });

    State.on('state:reset', () => {
      _templateId = null;
      _hide();
    });
  }

  /* ────────────────────────────────────────────────
     PUBLIC: Render (dipanggil saat template berubah
     atau dari FormRenderer setelah render form)
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

    _bindEvents(_mountEl, templateId);
  }

  /* ────────────────────────────────────────────────
     Build HTML utama accordion
  ──────────────────────────────────────────────── */
  function _buildAccordionHtml(templateId) {
    const tableDefs = TemplateRegistry.getTableDefinitions(templateId);
    if (!tableDefs.length) return '';

    const tablesHtml = tableDefs.map(tableDef => _buildTableSection(templateId, tableDef)).join('');

    const hasMultiple = tableDefs.length > 1;
    const resetAllBtn = hasMultiple ? `
      <button
        type="button"
        class="btn btn--sm btn--danger-outline tbl-cfg__reset-all"
        data-action="reset-all"
        title="Reset semua pengaturan tabel ke default template"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true"><path d="M3.51 15a9 9 0 1 0 .49-4.95"/><polyline points="1,4 1,10 7,10"/></svg>
        Reset Semua Tabel
      </button>` : '';

    return `
      <section class="tbl-cfg-accordion" aria-label="Pengaturan Tabel">
        <div class="tbl-cfg-accordion__header">
          <button
            type="button"
            class="tbl-cfg-accordion__toggle"
            aria-expanded="true"
            aria-controls="tbl-cfg-body"
            id="tbl-cfg-toggle"
          >
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
        <div class="tbl-cfg-accordion__body" id="tbl-cfg-body" role="region" aria-labelledby="tbl-cfg-toggle">
          ${tablesHtml}
        </div>
      </section>`;
  }

  /* ────────────────────────────────────────────────
     Build section untuk satu tabel
  ──────────────────────────────────────────────── */
  function _buildTableSection(templateId, tableDef) {
    const resolvedCfg = TableConfigManager.getResolvedConfig(templateId, tableDef.id);
    const columns     = tableDef.columns;
    const tableId     = tableDef.id;

    const headerHtml = _buildSectionPanel(
      templateId, tableId, 'header', columns, resolvedCfg.header?.columns || {}
    );
    const bodyHtml = _buildSectionPanel(
      templateId, tableId, 'body', columns, resolvedCfg.body?.columns || {}
    );

    // Reset tombol per-tabel
    const resetBtn = `
      <button
        type="button"
        class="btn btn--sm btn--ghost tbl-cfg__reset-table"
        data-action="reset-table"
        data-table-id="${_esc(tableId)}"
        title="Reset pengaturan tabel ini ke default template"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" aria-hidden="true"><path d="M3.51 15a9 9 0 1 0 .49-4.95"/><polyline points="1,4 1,10 7,10"/></svg>
        Reset
      </button>`;

    // Jika ada lebih dari satu tabel, tambahkan label tabel
    const tableDefs = TemplateRegistry.getTableDefinitions(templateId);
    const tableLabel = tableDefs.length > 1
      ? `<div class="tbl-cfg__table-label">
           <span class="tbl-cfg__table-label-text">Tabel: ${_esc(tableDef.label)}</span>
           ${resetBtn}
         </div>`
      : `<div class="tbl-cfg__table-label tbl-cfg__table-label--single">
           ${resetBtn}
         </div>`;

    return `
      <div class="tbl-cfg__table" data-table-id="${_esc(tableId)}">
        ${tableLabel}
        ${headerHtml}
        ${bodyHtml}
      </div>`;
  }

  /* ────────────────────────────────────────────────
     Build panel untuk satu section (header / body)
  ──────────────────────────────────────────────── */
  function _buildSectionPanel(templateId, tableId, section, columns, colsConfig) {
    const sectionKey   = `${tableId}-${section}`;
    const isOpen       = _openSections[sectionKey] !== false; // default open
    const sectionLabel = section === 'header' ? 'Header Tabel' : 'Isi Tabel';
    const sectionIcon  = section === 'header' ? '📌' : '📝';
    const sectionId    = `tbl-sec-${_esc(tableId)}-${section}`;

    const columnsHtml = columns.map((col, idx) => {
      const colCfg = colsConfig[idx] || {};
      return _buildColumnCard(templateId, tableId, section, idx, col, colCfg);
    }).join('');

    // Apply-to-all bar
    const applyAllBar = _buildApplyAllBar(templateId, tableId, section);

    // Copy header → body (hanya di section body)
    const copyBar = section === 'body' ? `
      <div class="tbl-cfg__copy-bar">
        <button
          type="button"
          class="btn btn--sm btn--ghost tbl-cfg__copy-btn"
          data-action="copy-header-to-body"
          data-table-id="${_esc(tableId)}"
          title="Salin pengaturan Header ke Isi Tabel (bold akan di-off)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" aria-hidden="true"><polyline points="8,17 3,12 8,7"/><line x1="3" y1="12" x2="15" y2="12"/><path d="M21 12a6 6 0 0 1-6 6"/></svg>
          Salin dari Header
        </button>
      </div>` : '';

    return `
      <div class="tbl-cfg__section">
        <button
          type="button"
          class="tbl-cfg__section-toggle${isOpen ? ' is-open' : ''}"
          aria-expanded="${isOpen ? 'true' : 'false'}"
          aria-controls="${sectionId}"
          data-section-key="${_esc(sectionKey)}"
        >
          <span class="tbl-cfg__section-icon" aria-hidden="true">${sectionIcon}</span>
          <span class="tbl-cfg__section-title">${_esc(sectionLabel)}</span>
          <span class="tbl-cfg__section-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </button>
        <div
          class="tbl-cfg__section-body${isOpen ? ' is-open' : ''}"
          id="${sectionId}"
          role="region"
        >
          ${applyAllBar}
          ${copyBar}
          <div class="tbl-cfg__columns">
            ${columnsHtml}
          </div>
        </div>
      </div>`;
  }

  /* ────────────────────────────────────────────────
     Build card untuk satu kolom
  ──────────────────────────────────────────────── */
  function _buildColumnCard(templateId, tableId, section, colIdx, colDef, colCfg) {
    const colLabel    = colDef.header || colDef.label || `Kolom ${colIdx + 1}`;
    const hAlign      = colCfg.horizontalAlign || 'center';
    const vAlign      = colCfg.verticalAlign   || 'middle';
    const isBold      = colCfg.bold   === true;
    const isItalic    = colCfg.italic === true;
    const fontSize    = colCfg.fontSize != null ? colCfg.fontSize : '';
    const fsPlaceholder = 'global';

    const dataAttrs = [
      `data-template-id="${_esc(templateId)}"`,
      `data-table-id="${_esc(tableId)}"`,
      `data-section="${section}"`,
      `data-col-idx="${colIdx}"`,
    ].join(' ');

    // Horizontal alignment buttons
    const hAlignBtns = H_ALIGN_OPTIONS.map(opt => `
      <button
        type="button"
        class="tbl-cfg__align-btn${hAlign === opt.value ? ' is-active' : ''}"
        data-action="h-align"
        data-value="${opt.value}"
        ${dataAttrs}
        title="Horizontal: ${opt.label}"
        aria-label="Horizontal alignment: ${opt.label}"
        aria-pressed="${hAlign === opt.value ? 'true' : 'false'}"
      >${opt.icon}</button>`).join('');

    // Vertical alignment select
    const vAlignOptions = V_ALIGN_OPTIONS.map(opt =>
      `<option value="${opt.value}"${vAlign === opt.value ? ' selected' : ''}>${opt.label}</option>`
    ).join('');

    return `
      <div class="tbl-cfg__col-card" data-col-idx="${colIdx}" data-table-id="${_esc(tableId)}" data-section="${section}">
        <div class="tbl-cfg__col-header">
          <span class="tbl-cfg__col-num">${colIdx + 1}</span>
          <span class="tbl-cfg__col-label" title="${_esc(colLabel)}">${_esc(colLabel)}</span>
        </div>
        <div class="tbl-cfg__col-controls">

          <!-- Horizontal Alignment -->
          <div class="tbl-cfg__control-group">
            <label class="tbl-cfg__control-label">Horizontal</label>
            <div class="tbl-cfg__align-btns" role="group" aria-label="Horizontal alignment untuk ${_esc(colLabel)}">
              ${hAlignBtns}
            </div>
          </div>

          <!-- Vertical Alignment + Bold + Italic row -->
          <div class="tbl-cfg__control-row">

            <div class="tbl-cfg__control-group tbl-cfg__control-group--flex">
              <label class="tbl-cfg__control-label" for="v-align-${_esc(tableId)}-${section}-${colIdx}">Vertikal</label>
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
                <button
                  type="button"
                  class="style-btn style-btn--bold${isBold ? ' active' : ''}"
                  data-action="bold"
                  data-value="${isBold ? 'false' : 'true'}"
                  ${dataAttrs}
                  title="Bold"
                  aria-label="Bold untuk ${_esc(colLabel)}"
                  aria-pressed="${isBold ? 'true' : 'false'}"
                >B</button>
                <button
                  type="button"
                  class="style-btn style-btn--italic${isItalic ? ' active' : ''}"
                  data-action="italic"
                  data-value="${isItalic ? 'false' : 'true'}"
                  ${dataAttrs}
                  title="Italic"
                  aria-label="Italic untuk ${_esc(colLabel)}"
                  aria-pressed="${isItalic ? 'true' : 'false'}"
                >I</button>
              </div>
            </div>

            <div class="tbl-cfg__control-group tbl-cfg__control-group--fs">
              <label class="tbl-cfg__control-label" for="fs-${_esc(tableId)}-${section}-${colIdx}">Ukuran</label>
              <div class="tbl-cfg__fs-wrap">
                <input
                  type="number"
                  id="fs-${_esc(tableId)}-${section}-${colIdx}"
                  class="form-input tbl-cfg__fs-input"
                  data-action="font-size"
                  ${dataAttrs}
                  value="${fontSize}"
                  placeholder="${fsPlaceholder}"
                  min="${TableConfigManager.FONT_SIZE_MIN}"
                  max="${TableConfigManager.FONT_SIZE_MAX}"
                  step="0.5"
                  aria-label="Font size untuk ${_esc(colLabel)}"
                />
                <span class="tbl-cfg__fs-unit">pt</span>
              </div>
            </div>

          </div><!-- /.tbl-cfg__control-row -->

        </div><!-- /.tbl-cfg__col-controls -->
      </div>`;
  }

  /* ────────────────────────────────────────────────
     Build "Apply to All" bar
  ──────────────────────────────────────────────── */
  function _buildApplyAllBar(templateId, tableId, section) {
    const sectionLabel = section === 'header' ? 'Header' : 'Isi';
    const dataAttrs = `data-template-id="${_esc(templateId)}" data-table-id="${_esc(tableId)}" data-section="${section}"`;

    return `
      <div class="tbl-cfg__apply-all-bar">
        <span class="tbl-cfg__apply-all-label">Terapkan ke semua kolom ${_esc(sectionLabel)}:</span>
        <div class="tbl-cfg__apply-all-btns">
          ${H_ALIGN_OPTIONS.map(opt => `
            <button
              type="button"
              class="tbl-cfg__apply-btn"
              data-action="apply-all-h-align"
              data-value="${opt.value}"
              ${dataAttrs}
              title="Semua kolom ${sectionLabel}: Horizontal ${opt.label}"
              aria-label="Semua kolom ${sectionLabel}: Horizontal ${opt.label}"
            >${opt.icon}</button>`).join('')}
          <button
            type="button"
            class="tbl-cfg__apply-btn tbl-cfg__apply-btn--bold"
            data-action="apply-all-bold-on"
            ${dataAttrs}
            title="Semua kolom ${sectionLabel}: Bold ON"
            aria-label="Semua kolom ${sectionLabel}: Bold ON"
          ><strong>B+</strong></button>
          <button
            type="button"
            class="tbl-cfg__apply-btn"
            data-action="apply-all-bold-off"
            ${dataAttrs}
            title="Semua kolom ${sectionLabel}: Bold OFF"
            aria-label="Semua kolom ${sectionLabel}: Bold OFF"
          ><span style="font-weight:normal;opacity:.6">B</span></button>
        </div>
      </div>`;
  }

  /* ────────────────────────────────────────────────
     Event binding via event delegation
  ──────────────────────────────────────────────── */
  function _bindEvents(root, templateId) {
    root.addEventListener('click', (e) => _handleClick(e, templateId));
    root.addEventListener('change', (e) => _handleChange(e, templateId));
    root.addEventListener('input', (e) => _handleInput(e, templateId));
  }

  function _handleClick(e, templateId) {
    // ── 1. Accordion utama (Pengaturan Tabel) ──────────────────────────
    // Harus dicek PERTAMA, sebelum pemeriksaan data-action,
    // karena tombol ini tidak memiliki data-action.
    const mainToggle = e.target.closest('.tbl-cfg-accordion__toggle');
    if (mainToggle) {
      const body     = _mountEl ? _mountEl.querySelector('#tbl-cfg-body') : document.getElementById('tbl-cfg-body');
      const expanded = mainToggle.getAttribute('aria-expanded') === 'true';
      mainToggle.setAttribute('aria-expanded', String(!expanded));
      const chevron  = mainToggle.querySelector('.tbl-cfg-accordion__chevron');
      if (chevron) chevron.classList.toggle('is-collapsed', expanded);
      if (body)    body.classList.toggle('is-collapsed', expanded);
      return; // sudah ditangani, stop
    }

    // ── 2. Section toggle (Header Tabel / Isi Tabel) ───────────────────
    // Harus dicek SEBELUM data-action, karena tombol ini juga
    // tidak memiliki data-action.
    const sectionToggle = e.target.closest('.tbl-cfg__section-toggle');
    if (sectionToggle) {
      const sectionKey = sectionToggle.dataset.sectionKey;
      if (sectionKey) {
        _openSections[sectionKey] = !(_openSections[sectionKey] !== false);
        _toggleSection(sectionKey, sectionToggle);
      }
      return; // sudah ditangani, stop
    }

    // ── 3. Semua aksi per-kolom dan bulk (ada data-action) ─────────────
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action  = btn.dataset.action;
    const tableId = btn.dataset.tableId;
    const section = btn.dataset.section;
    const colIdx  = parseInt(btn.dataset.colIdx, 10);
    const value   = btn.dataset.value;

    switch (action) {

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

      /* ── Apply all: horizontal alignment ── */
      case 'apply-all-h-align': {
        TableConfigManager.applyToAllColumns(templateId, tableId, section, {
          horizontalAlign: value,
        });
        break;
      }

      /* ── Apply all: bold ON/OFF ── */
      case 'apply-all-bold-on': {
        TableConfigManager.applyToAllColumns(templateId, tableId, section, { bold: true });
        break;
      }
      case 'apply-all-bold-off': {
        TableConfigManager.applyToAllColumns(templateId, tableId, section, { bold: false });
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
        UI.confirm(
          'Reset Pengaturan Tabel',
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
        UI.confirm(
          'Reset Semua Pengaturan Tabel',
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
    const el      = e.target;
    const action  = el.dataset.action;
    if (!action) return;

    const tableId = el.dataset.tableId;
    const section = el.dataset.section;
    const colIdx  = parseInt(el.dataset.colIdx, 10);

    if (action === 'v-align' && !isNaN(colIdx)) {
      TableConfigManager.updateColumn(templateId, tableId, section, colIdx, {
        verticalAlign: el.value,
      });
    }
  }

  function _handleInput(e, templateId) {
    const el      = e.target;
    const action  = el.dataset.action;
    if (action !== 'font-size') return;

    const tableId = el.dataset.tableId;
    const section = el.dataset.section;
    const colIdx  = parseInt(el.dataset.colIdx, 10);
    if (isNaN(colIdx)) return;

    const rawVal = el.value.trim();
    if (rawVal === '') {
      // Kosong = reset ke global
      TableConfigManager.updateColumn(templateId, tableId, section, colIdx, {
        fontSize: null,
      });
      return;
    }

    const num = parseFloat(rawVal);
    if (isNaN(num)) return;

    const clamped = Utils.clamp(num, TableConfigManager.FONT_SIZE_MIN, TableConfigManager.FONT_SIZE_MAX);
    // Jika nilai sudah di luar range, koreksi input
    if (num !== clamped) {
      el.value = clamped;
    }

    TableConfigManager.updateColumn(templateId, tableId, section, colIdx, {
      fontSize: clamped,
    });
  }

  /* ────────────────────────────────────────────────
     Toggle section (header / body) tanpa full re-render
  ──────────────────────────────────────────────── */
  function _toggleSection(sectionKey, toggleBtn) {
    const isNowOpen = _openSections[sectionKey] !== false;

    // Update aria-expanded dan class pada tombol
    toggleBtn.setAttribute('aria-expanded', isNowOpen ? 'true' : 'false');
    toggleBtn.classList.toggle('is-open', isNowOpen);

    // Cari section body via aria-controls dari tombol itu sendiri
    const sectionBodyId = toggleBtn.getAttribute('aria-controls');
    if (sectionBodyId) {
      // Cari di dalam _mountEl agar tidak salah ambil elemen lain di halaman
      const sectionBody = _mountEl
        ? _mountEl.querySelector(`#${CSS.escape(sectionBodyId)}`)
        : document.getElementById(sectionBodyId);
      if (sectionBody) {
        sectionBody.classList.toggle('is-open', isNowOpen);
      }
    }
  }

  /* ────────────────────────────────────────────────
     Hide accordion
  ──────────────────────────────────────────────── */
  function _hide() {
    if (!_mountEl) return;
    _mountEl.setAttribute('hidden', '');
    _mountEl.style.display = 'none';
    _mountEl.innerHTML = '';
  }

  /* ── Escape helper ── */
  function _esc(v) {
    return Utils.escapeHtml(String(v ?? ''));
  }

  /* ── Public API ── */
  return {
    init,
    render,
  };

})();
