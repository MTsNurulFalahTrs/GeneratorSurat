/* =============================================================
   table-config.js — Business logic untuk konfigurasi tabel
   =============================================================
   Bertanggung jawab atas:
   - Default config per kolom (header & body terpisah)
   - Konfigurasi lebar kolom per-kolom (columnWidths)
   - Normalisasi & migrasi config lama
   - Merge template default ← user override
   - Menyediakan config yang sudah resolved ke TableRenderer
   - Validasi nilai (fontSize range, enum alignment, width range)

   Tidak mengandung logika UI. Untuk rendering accordion,
   lihat table-config-ui.js.

   ── Column Width ──────────────────────────────────────────────
   Lebar kolom adalah properti STRUKTURAL tabel (bukan styling teks).
   Disimpan di { columnWidths: { byKey: { [colKey]: { mode, value, unit } } } }

   Mode:
     "auto"   → Fit to Content (table-layout: auto, tidak ada colgroup width)
     "custom" → lebar manual, diterapkan via <colgroup> + table-layout: fixed

   Satuan: "%" (default) atau "mm"

   Perilaku total %:
     Saat ada kolom custom, table-layout:fixed dipakai.
     Jika total % ≠ 100%, browser mendistribusikan sisa ke kolom auto.
     Sistem tidak memaksa total = 100%, tapi UI menampilkan total
     sebagai informasi. Nilai per-kolom di-clamp 0.1–99%.
   =============================================================
*/

const TableConfigManager = (() => {

  /* ── Konstanta ── */
  const FONT_SIZE_MIN = 7;
  const FONT_SIZE_MAX = 22;

  const VALID_H_ALIGN   = ['left', 'center', 'right', 'justify'];
  const VALID_V_ALIGN   = ['top', 'middle', 'bottom'];

  /* ── Column Width Konstanta ── */
  const WIDTH_MODE_AUTO   = 'auto';
  const WIDTH_MODE_CUSTOM = 'custom';
  const WIDTH_UNIT_PCT    = '%';
  const WIDTH_UNIT_MM     = 'mm';
  const VALID_WIDTH_UNITS = [WIDTH_UNIT_PCT, WIDTH_UNIT_MM];
  const WIDTH_PCT_MIN     = 0.1;
  const WIDTH_PCT_MAX     = 99;
  const WIDTH_MM_MIN      = 1;
  const WIDTH_MM_MAX      = 500;

  /* ── Default per section (header / body) ── */
  const DEFAULT_HEADER_COL = () => ({
    horizontalAlign: 'center',
    verticalAlign:   'middle',
    bold:            true,
    italic:          false,
    fontSize:        null,   // null = ikuti global tableSize
    wrapText:        false,  // header default: nowrap (label kolom satu baris)
  });

  const DEFAULT_BODY_COL = () => ({
    horizontalAlign: 'left',
    verticalAlign:   'middle',
    bold:            false,
    italic:          false,
    fontSize:        null,   // null = ikuti global tableSize
    wrapText:        true,   // body default: wrap (konten bisa panjang)
  });

  /* ────────────────────────────────────────────────
     1. Buat default config untuk satu tabel
        berdasarkan definisi kolom template.
  ──────────────────────────────────────────────── */
  /**
   * @param  {Array}  columns    — array dari template: [{key, header, align, width, ...}]
   * @param  {Object} tplDefault — opsional: tableDefaultConfig dari template
   * @returns {Object} {
   *   columnWidths: { byKey: { [colKey]: { mode, value, unit } } },
   *   header: { columns: {0:{...}} },
   *   body:   { columns: {0:{...}} }
   * }
   */
  function buildDefaultConfig(columns, tplDefault = null) {
    const headerCols = {};
    const bodyCols   = {};

    columns.forEach((col, idx) => {
      const tplAlign = col.align || null;

      headerCols[idx] = Object.assign(DEFAULT_HEADER_COL(), {
        horizontalAlign: tplAlign || 'center',
      });

      bodyCols[idx] = Object.assign(DEFAULT_BODY_COL(), {
        horizontalAlign: tplAlign || 'left',
      });
    });

    // Build default columnWidths dari definisi kolom template
    const columnWidths = buildDefaultWidthConfig(columns);

    const base = {
      columnWidths,
      colors: {
        header: '#FFFFFF',
        body: '#FFFFFF',
      },
      bodyColorRules: [],
      header: { columns: headerCols },
      body:   { columns: bodyCols },
    };

    if (tplDefault && typeof tplDefault === 'object') {
      return _deepMergeConfig(base, tplDefault);
    }

    return base;
  }

  /* ────────────────────────────────────────────────
     1b. Build default columnWidths dari definisi kolom
  ──────────────────────────────────────────────── */
  /**
   * @param  {Array}  columns — definisi kolom template
   * @returns {Object} { byKey: { [colKey]: { mode, value, unit } } }
   *
   * Kolom yang sudah punya width di template → mode custom dengan nilai tsb.
   * Kolom tanpa width → mode auto.
   */
  function buildDefaultWidthConfig(columns) {
    const byKey = {};
    columns.forEach(col => {
      const key = col.key;
      if (!key) return;

      if (col.widthMode === WIDTH_MODE_CUSTOM && col.width != null) {
        // Template menyediakan custom width eksplisit
        byKey[key] = {
          mode:  WIDTH_MODE_CUSTOM,
          value: parseFloat(col.width) || 10,
          unit:  col.unit || WIDTH_UNIT_PCT,
        };
      } else {
        // Default: auto
        byKey[key] = { mode: WIDTH_MODE_AUTO };
      }
    });
    return { byKey };
  }

  /* ────────────────────────────────────────────────
     2. Normalisasi / migrasi config tersimpan
        agar aman digunakan meski ada perubahan kolom
  ──────────────────────────────────────────────── */
  /**
   * Gabungkan default config (berdasarkan definisi kolom terkini)
   * dengan config tersimpan (user override).
   * - Kolom baru mendapat default
   * - Kolom yang hilang diabaikan
   * - columnWidths diidentifikasi via colKey (stabil), bukan index
   *
   * @param  {Object} defaultCfg  — dari buildDefaultConfig()
   * @param  {Object} savedCfg    — dari State.getTableConfig()
   * @returns {Object}
   */
  function normalizeConfig(defaultCfg, savedCfg) {
    if (!savedCfg || typeof savedCfg !== 'object') return defaultCfg;

    const result = {
      columnWidths: { byKey: {} },
      colors: {
        header: _sanitizeColor(savedCfg?.colors?.header) || '#FFFFFF',
        body:   _sanitizeColor(savedCfg?.colors?.body)   || '#FFFFFF',
      },
      bodyColorRules: _sanitizeBodyColorRules(savedCfg?.bodyColorRules),
      header: { columns: {} },
      body:   { columns: {} },
    };

    // ── columnWidths: gunakan colKey sebagai identifier stabil ──
    const defaultWidthsByKey = defaultCfg.columnWidths?.byKey || {};
    const savedWidthsByKey   = savedCfg.columnWidths?.byKey   || {};

    // Iterasi berdasarkan kolom yang ada di default (berdasarkan template terkini)
    Object.keys(defaultWidthsByKey).forEach(colKey => {
      const savedW = savedWidthsByKey[colKey];
      if (savedW) {
        result.columnWidths.byKey[colKey] = _sanitizeWidthConfig(savedW);
      } else {
        result.columnWidths.byKey[colKey] = { ...defaultWidthsByKey[colKey] };
      }
    });

    // ── Header columns ──
    const defaultHeaderCols = defaultCfg.header?.columns || {};
    const savedHeaderCols   = savedCfg.header?.columns   || {};
    Object.keys(defaultHeaderCols).forEach(idx => {
      result.header.columns[idx] = Object.assign(
        {},
        DEFAULT_HEADER_COL(),
        defaultHeaderCols[idx],
        _sanitizeColConfig(savedHeaderCols[idx] || {})
      );
    });

    // ── Body columns ──
    const defaultBodyCols = defaultCfg.body?.columns || {};
    const savedBodyCols   = savedCfg.body?.columns   || {};
    Object.keys(defaultBodyCols).forEach(idx => {
      result.body.columns[idx] = Object.assign(
        {},
        DEFAULT_BODY_COL(),
        defaultBodyCols[idx],
        _sanitizeColConfig(savedBodyCols[idx] || {})
      );
    });

    return result;
  }

  /* ────────────────────────────────────────────────
     3. Inisialisasi config untuk satu template
        (dipanggil saat template dipilih)
  ──────────────────────────────────────────────── */
  /**
   * Pastikan State.tables[templateId] berisi config yang valid
   * untuk semua tabel di template tsb.
   * Jika belum ada, buat default. Jika sudah ada, normalisasi.
   *
   * @param {string} templateId
   */
  function initForTemplate(templateId) {
    if (!templateId) return;
    if (!TemplateRegistry.templateHasTables(templateId)) return;

    const tableDefs = TemplateRegistry.getTableDefinitions(templateId);
    const savedAll  = State.getTableConfig(templateId);
    const hasExistingTemplateConfig = Object.keys(savedAll || {}).length > 0;

    // Saat pertama kali template dipakai, inisialisasi default tanpa menandai
    // state sebagai perubahan pengguna.
    if (!hasExistingTemplateConfig) {
      const defaults = {};
      tableDefs.forEach(tableDef => {
        defaults[tableDef.id] = buildDefaultConfig(
          tableDef.columns,
          tableDef.tableDefaultConfig
        );
      });
      State.initTableConfig(templateId, defaults);
      return;
    }

    // Untuk config yang sudah ada, normalisasi hanya bila hasilnya benar-benar
    // berbeda. Ini mencegah render/template switch berulang kali menandai dirty.
    tableDefs.forEach(tableDef => {
      const existing = savedAll[tableDef.id];
      if (!existing) {
        State.setTableConfig(
          templateId,
          tableDef.id,
          buildDefaultConfig(tableDef.columns, tableDef.tableDefaultConfig)
        );
        return;
      }

      const defaultCfg = buildDefaultConfig(
        tableDef.columns,
        tableDef.tableDefaultConfig
      );
      const normalized = normalizeConfig(defaultCfg, existing);

      if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
        State.setTableConfig(templateId, tableDef.id, normalized);
      }
    });
  }

  /* ────────────────────────────────────────────────
     4. Ambil config kolom yang sudah resolved
        (merge default + user override)
  ──────────────────────────────────────────────── */
  /**
   * @param  {string} templateId
   * @param  {string} tableId
   * @returns {Object} { header: { columns: {...} }, body: { columns: {...} } }
   *   Config yang sudah siap dipakai renderer.
   */
  function getBodyCellColor(tableConfig, rowNumber, colIndex) {
    const rules = Array.isArray(tableConfig?.bodyColorRules) ? tableConfig.bodyColorRules : [];
    let color = _sanitizeColor(tableConfig?.colors?.body) || '#FFFFFF';
    const row = Number(rowNumber);
    const col = Number(colIndex);
    rules.forEach(rule => {
      if (!rule || !_bodyColorRuleMatches(rule, row, col)) return;
      const next = _sanitizeColor(rule.color);
      if (next) color = next;
    });
    return color;
  }

  function _bodyColorRuleMatches(rule, row, col) {
    let rowMatch = true;
    let colMatch = true;
    if (rule.rowMode === 'odd') rowMatch = row % 2 === 1;
    else if (rule.rowMode === 'even') rowMatch = row % 2 === 0;
    else if (rule.rowMode === 'selected') rowMatch = rule.rows?.includes(row) === true;
    if (rule.colMode === 'odd') colMatch = (col + 1) % 2 === 1;
    else if (rule.colMode === 'even') colMatch = (col + 1) % 2 === 0;
    else if (rule.colMode === 'selected') colMatch = rule.cols?.includes(col) === true;
    return rowMatch && colMatch;
  }

  function updateTableColors(templateId, tableId, partial) {
    if (!templateId || !tableId || !partial || typeof partial !== 'object') return;

    const colors = {};
    if ('header' in partial) {
      const header = _sanitizeColor(partial.header);
      if (header) colors.header = header;
    }
    if ('body' in partial) {
      const body = _sanitizeColor(partial.body);
      if (body) colors.body = body;
    }
    if (Object.keys(colors).length === 0) return;

    const currentAll = State.getTableConfig(templateId);
    const tableDef = TemplateRegistry.getTableDefinitions(templateId).find(t => t.id === tableId);
    const current = currentAll[tableId] || buildDefaultConfig(tableDef?.columns || []);

    State.setTableConfig(templateId, tableId, {
      ...current,
      colors: {
        header: current.colors?.header || '#FFFFFF',
        body: current.colors?.body || '#FFFFFF',
        ...colors,
      },
    });
  }

  function updateBodyColorRules(templateId, tableId, rules) {
    if (!templateId || !tableId || !Array.isArray(rules)) return;
    const sanitized = _sanitizeBodyColorRules(rules);
    const currentAll = State.getTableConfig(templateId);
    const tableDef = TemplateRegistry.getTableDefinitions(templateId).find(t => t.id === tableId);
    const current = currentAll[tableId] || buildDefaultConfig(tableDef?.columns || []);
    State.setTableConfig(templateId, tableId, {
      ...current,
      bodyColorRules: sanitized,
    });
  }

  function addBodyColorRule(templateId, tableId, rule) {
    if (!templateId || !tableId || !rule) return;
    const currentAll = State.getTableConfig(templateId);
    const current = currentAll[tableId] || {};
    const rules = Array.isArray(current.bodyColorRules) ? current.bodyColorRules : [];
    updateBodyColorRules(templateId, tableId, [...rules, rule]);
  }

  function removeBodyColorRule(templateId, tableId, index) {
    if (!templateId || !tableId || !Number.isInteger(index)) return;
    const currentAll = State.getTableConfig(templateId);
    const current = currentAll[tableId] || {};
    const rules = Array.isArray(current.bodyColorRules) ? current.bodyColorRules : [];
    if (index < 0 || index >= rules.length) return;
    updateBodyColorRules(templateId, tableId, rules.filter((_, i) => i !== index));
  }

  function clearBodyColorRules(templateId, tableId) {
    updateBodyColorRules(templateId, tableId, []);
  }

  function resetTableColors(templateId, tableId) {
    updateTableColors(templateId, tableId, { header: '#FFFFFF', body: '#FFFFFF' });
    clearBodyColorRules(templateId, tableId);
  }


  function getResolvedConfig(templateId, tableId) {
    if (!templateId || !tableId) return { columnWidths: { byKey: {} }, header: { columns: {} }, body: { columns: {} } };

    const tableDefs = TemplateRegistry.getTableDefinitions(templateId);
    const tableDef  = tableDefs.find(t => t.id === tableId);
    if (!tableDef) return { columnWidths: { byKey: {} }, header: { columns: {} }, body: { columns: {} } };

    const defaultCfg = buildDefaultConfig(tableDef.columns, tableDef.tableDefaultConfig);
    const savedAll   = State.getTableConfig(templateId);
    const savedCfg   = savedAll[tableId] || null;

    return normalizeConfig(defaultCfg, savedCfg);
  }

  /* ────────────────────────────────────────────────
     5. Update satu kolom (dipanggil dari UI)
  ──────────────────────────────────────────────── */
  /**
   * @param {string} templateId
   * @param {string} tableId
   * @param {string} section    — 'header' | 'body'
   * @param {number} colIndex   — 0-based index kolom
   * @param {Object} partial    — { horizontalAlign?, verticalAlign?, bold?, italic?, fontSize? }
   */
  function updateColumn(templateId, tableId, section, colIndex, partial) {
    if (!templateId || !tableId) return;
    if (section !== 'header' && section !== 'body') return;

    const sanitized = _sanitizeColConfig(partial);
    if (Object.keys(sanitized).length === 0) return;

    // Baca config terkini untuk tabel ini
    const currentAll = State.getTableConfig(templateId);
    const current    = currentAll[tableId] || { header: { columns: {} }, body: { columns: {} } };

    // Deep clone untuk menghindari mutasi
    const updated = {
      header: { columns: { ...(current.header?.columns || {}) } },
      body:   { columns: { ...(current.body?.columns   || {}) } },
    };

    updated[section].columns[colIndex] = Object.assign(
      {},
      updated[section].columns[colIndex] || {},
      sanitized
    );

    State.setTableConfig(templateId, tableId, updated);
  }

  /* ────────────────────────────────────────────────
     6. Apply to All — terapkan satu atau beberapa
        properti ke semua kolom di section tertentu
  ──────────────────────────────────────────────── */
  /**
   * @param {string} templateId
   * @param {string} tableId
   * @param {string} section   — 'header' | 'body'
   * @param {Object} partial   — properti yang akan diterapkan ke semua kolom
   */
  function applyToAllColumns(templateId, tableId, section, partial) {
    if (!templateId || !tableId) return;
    if (section !== 'header' && section !== 'body') return;

    const sanitized = _sanitizeColConfig(partial);
    if (Object.keys(sanitized).length === 0) return;

    const tableDefs = TemplateRegistry.getTableDefinitions(templateId);
    const tableDef  = tableDefs.find(t => t.id === tableId);
    if (!tableDef) return;

    const currentAll = State.getTableConfig(templateId);
    const current    = currentAll[tableId] || { header: { columns: {} }, body: { columns: {} } };

    const updated = {
      header: { columns: { ...(current.header?.columns || {}) } },
      body:   { columns: { ...(current.body?.columns   || {}) } },
    };

    tableDef.columns.forEach((_, idx) => {
      updated[section].columns[idx] = Object.assign(
        {},
        updated[section].columns[idx] || {},
        sanitized
      );
    });

    State.setTableConfig(templateId, tableId, updated);
  }

  /* ────────────────────────────────────────────────
     7. Copy Header → Body
  ──────────────────────────────────────────────── */
  function copyHeaderToBody(templateId, tableId) {
    if (!templateId || !tableId) return;

    const currentAll = State.getTableConfig(templateId);
    const current    = currentAll[tableId];
    if (!current) return;

    const headerCols = current.header?.columns || {};
    // Salin header ke body, tapi reset bold ke false (body default)
    const newBodyCols = {};
    Object.keys(headerCols).forEach(idx => {
      newBodyCols[idx] = Object.assign({}, headerCols[idx], { bold: false });
    });

    State.setTableConfig(templateId, tableId, {
      header: current.header,
      body:   { columns: newBodyCols },
    });
  }

  /* ────────────────────────────────────────────────
     7b. Apply Wrap Text ke semua kolom di satu section
  ──────────────────────────────────────────────── */
  /**
   * @param {string}  templateId
   * @param {string}  tableId
   * @param {string}  section   — 'header' | 'body'
   * @param {boolean} wrapText  — true = wrap, false = nowrap
   */
  function applyWrapTextToAll(templateId, tableId, section, wrapText) {
    if (!templateId || !tableId) return;
    if (section !== 'header' && section !== 'body') return;

    const tableDefs = TemplateRegistry.getTableDefinitions(templateId);
    const tableDef  = tableDefs.find(t => t.id === tableId);
    if (!tableDef) return;

    const currentAll = State.getTableConfig(templateId);
    const current    = currentAll[tableId] || { header: { columns: {} }, body: { columns: {} } };

    const updated = {
      header: { columns: { ...(current.header?.columns || {}) } },
      body:   { columns: { ...(current.body?.columns   || {}) } },
    };

    tableDef.columns.forEach((_, idx) => {
      updated[section].columns[idx] = Object.assign(
        {},
        updated[section].columns[idx] || {},
        { wrapText: Boolean(wrapText) }
      );
    });

    State.setTableConfig(templateId, tableId, updated);
  }

  /* ────────────────────────────────────────────────
     8. Reset satu tabel atau semua tabel ke default template
  ──────────────────────────────────────────────── */
  function resetToDefault(templateId, tableId = null) {
    State.resetTableConfig(templateId, tableId);
    // Setelah reset, re-init agar state kembali ke default bersih
    initForTemplate(templateId);
  }

  /* ────────────────────────────────────────────────
     8b. Update lebar satu kolom (dipanggil dari UI)
  ──────────────────────────────────────────────── */
  /**
   * @param {string} templateId
   * @param {string} tableId
   * @param {string} colKey     — col.key dari definisi kolom template
   * @param {Object} partial    — { mode?, value?, unit? }
   */
  function updateColumnWidth(templateId, tableId, colKey, partial) {
    if (!templateId || !tableId || !colKey) return;

    const sanitized = _sanitizeWidthConfig(partial);
    if (Object.keys(sanitized).length === 0) return;

    const currentAll = State.getTableConfig(templateId);
    const current    = currentAll[tableId] || { columnWidths: { byKey: {} }, header: { columns: {} }, body: { columns: {} } };

    const byKey = { ...(current.columnWidths?.byKey || {}) };
    byKey[colKey] = Object.assign({}, byKey[colKey] || { mode: WIDTH_MODE_AUTO }, sanitized);

    State.setTableConfig(templateId, tableId, {
      ...current,
      columnWidths: { byKey },
    });
  }

  /* ────────────────────────────────────────────────
     8c. Ubah mode lebar seluruh kolom secara bulk
  ──────────────────────────────────────────────── */
  /**
   * Ubah mode width semua kolom dalam satu tabel.
   * Nilai manual yang sudah ada dipertahankan; kolom Auto yang belum
   * memiliki nilai mendapat pembagian awal yang merata dalam persen.
   */
  function setAllColumnWidthMode(templateId, tableId, mode) {
    if (!templateId || !tableId) return;
    if (![WIDTH_MODE_AUTO, WIDTH_MODE_CUSTOM].includes(mode)) return;

    const tableDef = TemplateRegistry.getTableDefinitions(templateId)
      .find(t => t.id === tableId);
    const columns = tableDef?.columns || [];
    if (!columns.length) return;

    const currentAll = State.getTableConfig(templateId);
    const currentTable = currentAll[tableId] || {};
    const currentByKey = currentTable.columnWidths?.byKey || {};
    const equalPct = Math.round((100 / columns.length) * 100) / 100;
    const byKey = {};

    columns.forEach(col => {
      const key = col?.key;
      if (!key) return;

      const current = currentByKey[key] || {};

      if (mode === WIDTH_MODE_AUTO) {
        // Pertahankan value/unit tersembunyi agar Auto → Manual dapat
        // memulihkan nilai manual terakhir kolom tersebut.
        byKey[key] = { ...current, mode: WIDTH_MODE_AUTO };
        return;
      }

      const hasValue = Number.isFinite(Number(current.value))
        && Number(current.value) > 0;
      const unit = VALID_WIDTH_UNITS.includes(current.unit)
        ? current.unit
        : WIDTH_UNIT_PCT;

      byKey[key] = {
        ...current,
        mode: WIDTH_MODE_CUSTOM,
        value: hasValue ? Number(current.value) : equalPct,
        unit: hasValue ? unit : WIDTH_UNIT_PCT,
      };
    });

    State.setTableConfig(templateId, tableId, {
      ...currentTable,
      columnWidths: { byKey },
    });
  }

  /* ────────────────────────────────────────────────
     8c. Reset lebar semua kolom di satu tabel ke auto
  ──────────────────────────────────────────────── */
  function resetColumnWidths(templateId, tableId) {
    if (!templateId || !tableId) return;

    const tableDefs = TemplateRegistry.getTableDefinitions(templateId);
    const tableDef  = tableDefs.find(t => t.id === tableId);
    if (!tableDef) return;

    const currentAll = State.getTableConfig(templateId);
    const current    = currentAll[tableId] || {};

    // Set semua kolom ke auto
    const byKey = {};
    tableDef.columns.forEach(col => {
      if (col.key) byKey[col.key] = { mode: WIDTH_MODE_AUTO };
    });

    State.setTableConfig(templateId, tableId, {
      ...current,
      columnWidths: { byKey },
    });
  }

  /* ────────────────────────────────────────────────
     8d. Hitung total lebar kolom dalam % (untuk UI indicator)
  ──────────────────────────────────────────────── */
  /**
   * @param  {Object} columnWidths — { byKey: {...} }
   * @returns {number|null} — total % dari kolom yang custom+%, atau null jika tidak ada
   */
  function getTotalWidthPercent(columnWidths) {
    if (!columnWidths?.byKey) return null;
    let total = 0;
    let hasCustomPct = false;
    Object.values(columnWidths.byKey).forEach(w => {
      if (w.mode === WIDTH_MODE_CUSTOM && w.unit === WIDTH_UNIT_PCT && w.value != null) {
        total += w.value;
        hasCustomPct = true;
      }
    });
    return hasCustomPct ? Math.round(total * 10) / 10 : null;
  }

  /* ────────────────────────────────────────────────
     8e. Cek apakah tabel punya setidaknya satu custom width
  ──────────────────────────────────────────────── */
  function hasAnyCustomWidth(columnWidths) {
    if (!columnWidths?.byKey) return false;
    return Object.values(columnWidths.byKey).some(w => w.mode === WIDTH_MODE_CUSTOM);
  }

  /* ────────────────────────────────────────────────
     8f. Build <colgroup> HTML dari columnWidths + columns
         (dipakai oleh TableRenderer)
  ──────────────────────────────────────────────── */
  /**
   * @param  {Array}  columns      — definisi kolom template (untuk urutan & key)
   * @param  {Object} columnWidths — { byKey: { [colKey]: { mode, value, unit } } }
   * @returns {string|null}        — HTML <colgroup>...</colgroup> atau null jika semua auto
   */
  function buildColGroupHtml(columns, columnWidths) {
    if (!hasAnyCustomWidth(columnWidths)) return null;

    const byKey = columnWidths?.byKey || {};
    const cols = columns.map(col => {
      const w = byKey[col.key];
      if (w && w.mode === WIDTH_MODE_CUSTOM && w.value != null) {
        const val  = w.unit === WIDTH_UNIT_MM ? `${w.value}mm` : `${w.value}%`;
        return `<col style="width:${val}">`;
      }
      return `<col>`; // auto
    }).join('');

    return `<colgroup>${cols}</colgroup>`;
  }

  /* ────────────────────────────────────────────────
     9. Build inline style string untuk <th> / <td>
        berdasarkan config kolom + fallback tableSize

     ── Wrap Text strategy ────────────────────────
     white-space dan overflow-wrap diterapkan via
     inline style agar menang atas class CSS global.

     wrapText = true  → white-space:normal; overflow-wrap:break-word
     wrapText = false → white-space:nowrap

     Inline style menang atas .doc-table th { white-space:nowrap }
     dan .doc-table td { overflow-wrap:break-word } tanpa perlu
     mengubah class CSS global.

     PENTING: print.css punya overflow-wrap:break-word!important
     dan word-break:break-word!important pada .doc-table th,td.
     Untuk nowrap saat cetak, kita butuh counter-declaration yang
     lebih spesifik — ditangani di print.css (task 6).
  ──────────────────────────────────────────────── */
  /**
   * @param  {Object} colCfg    — satu entri dari header.columns[i] atau body.columns[i]
   * @param  {number} tableSize — font size fallback (pt) dari typography settings
   * @param  {Object} templateColDef — definisi kolom dari template
   * @returns {string} CSS inline style string
   */
  function buildCellStyle(colCfg, tableSize, templateColDef = {}) {
    if (!colCfg) return '';
    const parts = [];

    // text-align
    const hAlign = colCfg.horizontalAlign;
    if (hAlign && VALID_H_ALIGN.includes(hAlign)) {
      parts.push(`text-align:${hAlign}`);
    }

    // vertical-align
    const vAlign = colCfg.verticalAlign;
    if (vAlign && VALID_V_ALIGN.includes(vAlign)) {
      parts.push(`vertical-align:${vAlign}`);
    }

    // font-weight
    if (colCfg.bold === true) {
      parts.push('font-weight:bold');
    } else if (colCfg.bold === false) {
      parts.push('font-weight:normal');
    }

    // font-style
    if (colCfg.italic === true) {
      parts.push('font-style:italic');
    } else if (colCfg.italic === false) {
      parts.push('font-style:normal');
    }

    // font-size
    const fs = colCfg.fontSize != null
      ? Utils.clamp(Number(colCfg.fontSize), FONT_SIZE_MIN, FONT_SIZE_MAX)
      : tableSize;
    if (fs) parts.push(`font-size:${fs}pt`);

    // ── Wrap Text ──
    // wrapText: true  → normal wrapping (default body behavior)
    // wrapText: false → no-wrap (one-line, default header behavior)
    // null/undefined  → tidak diset (mengikuti CSS class default)
    if (colCfg.wrapText === true) {
      parts.push('white-space:normal');
      parts.push('overflow-wrap:break-word');
      parts.push('word-break:break-word');
    } else if (colCfg.wrapText === false) {
      parts.push('white-space:nowrap');
      // overflow-wrap dan word-break tidak diperlukan saat nowrap
      // karena teks tidak dibungkus sama sekali
    }
    // wrapText === null/undefined: tidak inject style, ikuti CSS class

    return parts.join(';');
  }

  /* ────────────────────────────────────────────────
     Internal helpers
  ──────────────────────────────────────────────── */

  const VALID_BODY_COLOR_ROW_MODES = ['all', 'odd', 'even', 'selected'];
  const VALID_BODY_COLOR_COL_MODES = ['all', 'odd', 'even', 'selected'];

  function _sanitizeBodyColorRules(rules) {
    if (!Array.isArray(rules)) return [];
    return rules.slice(0, 50).map(rule => {
      if (!rule || typeof rule !== 'object') return null;
      const rowMode = VALID_BODY_COLOR_ROW_MODES.includes(rule.rowMode) ? rule.rowMode : 'all';
      const colMode = VALID_BODY_COLOR_COL_MODES.includes(rule.colMode) ? rule.colMode : 'all';
      const color = _sanitizeColor(rule.color) || '#FFFFFF';
      const rows = Array.from(new Set((Array.isArray(rule.rows) ? rule.rows : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 9999)));
      const cols = Array.from(new Set((Array.isArray(rule.cols) ? rule.cols : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 999)));
      return { preset: String(rule.preset || 'manual'), color, rowMode, colMode, rows, cols };
    }).filter(Boolean);
  }

  function _sanitizeColor(value) {
    const text = String(value ?? '').trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(text) ? text : '';
  }

  function _normalizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'ya', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'tidak', 'off'].includes(normalized)) return false;
    }
    return fallback;
  }

  /** Sanitasi & validasi satu kolom config object (untuk header/body) */
  function _sanitizeColConfig(obj) {
    if (!obj || typeof obj !== 'object') return {};
    const out = {};

    if ('horizontalAlign' in obj) {
      const v = obj.horizontalAlign;
      if (VALID_H_ALIGN.includes(v)) out.horizontalAlign = v;
    }
    if ('verticalAlign' in obj) {
      const v = obj.verticalAlign;
      if (VALID_V_ALIGN.includes(v)) out.verticalAlign = v;
    }
    if ('bold' in obj)   out.bold   = _normalizeBoolean(obj.bold);
    if ('italic' in obj) out.italic = _normalizeBoolean(obj.italic);
    if ('fontSize' in obj) {
      if (obj.fontSize === null) {
        out.fontSize = null; // reset ke global
      } else {
        const raw = String(obj.fontSize).trim();
        const n = raw === '' ? NaN : Number(raw);
        if (Number.isFinite(n)) {
          out.fontSize = Utils.clamp(n, FONT_SIZE_MIN, FONT_SIZE_MAX);
        }
      }
    }
    // wrapText: true = wrap, false = nowrap.
    // null/undefined di input = tidak ada preferensi user → JANGAN simpan ke output
    // agar DEFAULT_HEADER_COL/DEFAULT_BODY_COL yang berlaku via Object.assign.
    // Hanya simpan Boolean eksplisit (true atau false).
    if ('wrapText' in obj && obj.wrapText !== null && obj.wrapText !== undefined) {
      out.wrapText = _normalizeBoolean(obj.wrapText);
    }
    return out;
  }

  /** Sanitasi & validasi satu kolom width config */
  function _sanitizeWidthConfig(obj) {
    if (!obj || typeof obj !== 'object') return {};
    const out = {};

    if ('mode' in obj) {
      if (obj.mode === WIDTH_MODE_AUTO || obj.mode === WIDTH_MODE_CUSTOM) {
        out.mode = obj.mode;
      }
    }
    if ('unit' in obj && VALID_WIDTH_UNITS.includes(obj.unit)) {
      out.unit = obj.unit;
    }
    if ('value' in obj) {
      if (obj.value === null || obj.value === undefined) {
        // null = reset
      } else {
        const raw = String(obj.value).trim();
        const n = raw === '' ? NaN : Number(raw);
        const unit = out.unit || WIDTH_UNIT_PCT;
        if (Number.isFinite(n)) {
          if (unit === WIDTH_UNIT_MM) {
            out.value = Utils.clamp(n, WIDTH_MM_MIN, WIDTH_MM_MAX);
          } else {
            out.value = Utils.clamp(n, WIDTH_PCT_MIN, WIDTH_PCT_MAX);
          }
        }
      }
    }

    // Jika mode diset ke auto, hapus value/unit (tidak diperlukan)
    if (out.mode === WIDTH_MODE_AUTO) {
      delete out.value;
      delete out.unit;
    }

    return out;
  }

  /** Deep merge khusus config struktur */
  function _deepMergeConfig(base, override) {
    if (!override || typeof override !== 'object') return base;

    const result = {
      columnWidths: { byKey: { ...(base.columnWidths?.byKey || {}) } },
      colors: {
        header: base.colors?.header || '#FFFFFF',
        body:   base.colors?.body   || '#FFFFFF',
      },
      bodyColorRules: _sanitizeBodyColorRules(base.bodyColorRules),
      header: { columns: { ...(base.header?.columns || {}) } },
      body:   { columns: { ...(base.body?.columns   || {}) } },
    };

    // Merge columnWidths
    if (override.columnWidths?.byKey) {
      Object.entries(override.columnWidths.byKey).forEach(([colKey, wCfg]) => {
        const sanitized = _sanitizeWidthConfig(wCfg);
        if (Object.keys(sanitized).length > 0) {
          result.columnWidths.byKey[colKey] = Object.assign(
            {},
            result.columnWidths.byKey[colKey] || { mode: WIDTH_MODE_AUTO },
            sanitized
          );
        }
      });
    }

    if (Array.isArray(override.bodyColorRules)) {
      result.bodyColorRules = _sanitizeBodyColorRules(override.bodyColorRules);
    }

    if (override.colors && typeof override.colors === 'object') {
      const headerColor = _sanitizeColor(override.colors.header);
      const bodyColor   = _sanitizeColor(override.colors.body);
      if (headerColor) result.colors.header = headerColor;
      if (bodyColor)   result.colors.body = bodyColor;
    }

    if (override.header?.columns) {
      Object.entries(override.header.columns).forEach(([idx, colCfg]) => {
        result.header.columns[idx] = Object.assign(
          {},
          result.header.columns[idx] || DEFAULT_HEADER_COL(),
          _sanitizeColConfig(colCfg)
        );
      });
    }
    if (override.body?.columns) {
      Object.entries(override.body.columns).forEach(([idx, colCfg]) => {
        result.body.columns[idx] = Object.assign(
          {},
          result.body.columns[idx] || DEFAULT_BODY_COL(),
          _sanitizeColConfig(colCfg)
        );
      });
    }

    return result;
  }

  /* ── Public API ── */
  return {
    buildDefaultConfig,
    buildDefaultWidthConfig,
    normalizeConfig,
    initForTemplate,
    getResolvedConfig,
    updateColumn,
    applyToAllColumns,
    applyWrapTextToAll,
    copyHeaderToBody,
    resetToDefault,
    buildCellStyle,
    updateTableColors,
    resetTableColors,
    updateBodyColorRules,
    addBodyColorRule,
    removeBodyColorRule,
    clearBodyColorRules,
    getBodyCellColor,
    // Column width API
    updateColumnWidth,
    setAllColumnWidthMode,
    resetColumnWidths,
    getTotalWidthPercent,
    hasAnyCustomWidth,
    buildColGroupHtml,

    // Konstanta yang berguna untuk UI
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
    VALID_H_ALIGN,
    VALID_V_ALIGN,
    DEFAULT_HEADER_COL,
    DEFAULT_BODY_COL,
    WIDTH_MODE_AUTO,
    WIDTH_MODE_CUSTOM,
    WIDTH_UNIT_PCT,
    WIDTH_UNIT_MM,
    WIDTH_PCT_MIN,
    WIDTH_PCT_MAX,
    WIDTH_MM_MIN,
    WIDTH_MM_MAX,
  };

})();
