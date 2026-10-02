/* =============================================================
   table-renderer.js — Reusable table renderer untuk template surat
   =============================================================
   Layout strategy:

   A) Fit to Content (default — semua kolom mode "auto"):
      - table-layout: auto, width: auto
      - Browser menghitung lebar kolom dari konten
      - Tabel tidak melebihi content area (.doc-table-wrap max-width:100%)
      - Tidak ada <colgroup> dengan width

   B) Custom Column Width (ada ≥1 kolom mode "custom"):
      - table-layout: fixed, width: 100%
      - <colgroup> dengan <col style="width:..."> per kolom
      - Kolom "auto" → <col> tanpa width (browser bagi sisa proporsional)
      - Tabel tetap dibatasi oleh content area (100% dari wrapper)

   DPU (special case):
      - Selalu table-layout: fixed + width: 100% (15 kolom landscape)
      - columnWidths body bisa di-override user, diaplikasikan via <colgroup>
      - Header DPU (colspan/rowspan kompleks) tetap memakai table config

   API:
     TableRenderer.render(columns, rows, options, tableSize, tableConfig)
     TableRenderer.renderDpuTable(peserta, typo, minRows, tableConfig)
   =============================================================
*/

const TableRenderer = (() => {

  /* ── Opsi default ── */
  const DEFAULTS = {
    /* 'auto'    : Fit to Content (default) */
    /* 'full'    : selalu 100% lebar content area (DPU, dll) */
    /* 'compact' : tabel sesempit mungkin */
    fitMode:        'auto',
    tableClass:     '',
    fontSize:       7.5,
    headerFontSize: 7.5,
    minRows:        0,
    customHeader:   null,
  };

  /* ════════════════════════════════════════════════
     RENDER UTAMA
  ════════════════════════════════════════════════ */
  /**
   * @param {Array}  columns     — definisi kolom template [{key, header, width, align, ...}]
   * @param {Array}  rows        — array baris data {key: value}
   * @param {Object} options     — override DEFAULTS
   * @param {number} tableSize   — font size fallback (pt)
   * @param {Object} tableConfig — dari TableConfigManager.getResolvedConfig():
   *   {
   *     columnWidths: { byKey: { [colKey]: { mode, value, unit } } },
   *     header: { columns: {0:{...}, ...} },
   *     body:   { columns: {0:{...}, ...} }
   *   }
   * @returns {string} HTML
   */
  function render(columns, rows, options = {}, tableSize = 7.5, tableConfig = null) {
    const opts = { ...DEFAULTS, ...options };

    // Tentukan apakah ada custom column width
    const columnWidths = tableConfig?.columnWidths;
    const hasCustom    = TableConfigManager?.hasAnyCustomWidth(columnWidths) ?? false;

    // Wrap Text hanya thay đổi perilaku teks di sel. Layout tabel tetap otomatis
    // kecuali user memilih lebar manual atau mode full-width.
    const hasWrap = _hasAnyWrapText(tableConfig);

    // <colgroup> hanya diperlukan saat user mengatur lebar kolom manual.
    let colgroupHtml = '';
    if (hasCustom) {
      colgroupHtml = TableConfigManager?.buildColGroupHtml(columns, columnWidths) ?? '';
    }

    // Layout:
    //  - custom width / full → fixed
    //  - wrap-only / auto → automatic intrinsic layout
    const tableClass = _buildTableClass(opts, hasCustom, hasWrap);

    // thead
    const theadHtml = opts.customHeader
      || _buildAutoHeader(columns, opts.headerFontSize || tableSize, tableConfig);

    // tbody
    const tbodyHtml = _buildBody(columns, rows, tableSize, opts.minRows, tableConfig);

    // Wrapper class
    let wrapClass;
    if (opts.fitMode === 'full') {
      wrapClass = 'doc-table-wrap doc-table-wrap--full';
    } else if (hasWrap && !hasCustom) {
      // Beri constraint lebar pada area konten, tetapi biarkan tabel memakai
      // automatic layout. Dengan ini Wrap Text tidak mengubah layout menjadi
      // fixed; browser tetap menghitung lebar berdasarkan konten.
      wrapClass = 'doc-table-wrap doc-table-wrap--wrap';
    } else {
      wrapClass = 'doc-table-wrap';
    }

    return `
      <div class="${wrapClass}">
        <table class="${tableClass}">
          ${colgroupHtml}
          ${theadHtml}
          <tbody>${tbodyHtml}</tbody>
        </table>
      </div>`;
  }

  /* ── Build thead otomatis ── */
  function _buildAutoHeader(columns, headerFontSize, tableConfig) {
    const cells = columns.map((col, idx) => {
      const style = _buildThStyle(col, headerFontSize, tableConfig, idx);
      const finalStyle = _mergeStyleProperty(style, 'background-color', _getSectionBackground(tableConfig, 'header'));
      return `<th style="${finalStyle}">${Utils.escapeHtml(col.header || '')}</th>`;
    }).join('');
    return `<thead><tr>${cells}</tr></thead>`;
  }

  /* ── Build tbody ── */
  function _buildBody(columns, rows, tableSize, minRows, tableConfig) {
    const dataRows = rows.map(row => _buildRow(columns, row, tableSize, tableConfig));

    const emptyCount = Math.max(0, minRows - rows.length);
    const emptyRows  = Array.from({ length: emptyCount }, () => {
      const emptyBodyStyle = `background-color:${_getSectionBackground(tableConfig, 'body')}`;
      const cells = columns.map(() => `<td style="${emptyBodyStyle}">&nbsp;</td>`).join('');
      return `<tr class="doc-empty-row">${cells}</tr>`;
    });

    return [...dataRows, ...emptyRows].join('');
  }

  /* ── Build satu baris data ── */
  function _buildRow(columns, rowData, tableSize, tableConfig) {
    const cells = columns.map((col, idx) => {
      const val   = rowData[col.key] != null ? String(rowData[col.key]) : '';
      const style = _buildTdStyle(col, tableSize, tableConfig, idx);
      const finalStyle = _mergeStyleProperty(style, 'background-color', _getSectionBackground(tableConfig, 'body'));
      return `<td style="${finalStyle}">${Utils.escapeHtml(val)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }

  function _getSectionBackground(tableConfig, section) {
    const color = tableConfig?.colors?.[section];
    return /^#[0-9A-Fa-f]{6}$/.test(String(color || '')) ? color : '#FFFFFF';
  }

  function _mergeStyleProperty(style, property, value) {
    const parts = String(style || '').split(';').filter(Boolean);
    const filtered = parts.filter(part => part.split(':')[0].trim().toLowerCase() !== property.toLowerCase());
    filtered.push(property + ':' + value);
    return filtered.join(';');
  }

  /* ── Build style string untuk <th> ──
   *
   * Catatan width: lebar kolom diatur via <colgroup>, BUKAN via style pada <th>/<td>.
   * Menggunakan width di <th> bersamaan dengan table-layout:fixed dan <colgroup>
   * menyebabkan konflik — <colgroup> yang menang untuk table-layout:fixed.
   * Tetap pertahankan min-width legacy untuk Fit to Content (saat tidak ada custom).
   *
   * Wrap Text priority:
   *   tableConfig.header.columns[idx].wrapText = explicit user config → wins
   *   col.noWrap || _isShortColumn(col) = template hint → used only when no tableConfig
   *   .doc-table th { white-space:nowrap } = CSS class default → lowest priority
   */
  function _buildThStyle(col, headerFontSize, tableConfig, colIdx) {
    const parts = [];
    const hasCustom = TableConfigManager?.hasAnyCustomWidth(tableConfig?.columnWidths) ?? false;

    if (!hasCustom) {
      // Fit to Content: pakai min-width legacy dari definisi kolom
      if (col.width && col.width !== 'auto') {
        parts.push(`min-width:${col.width}`);
        const widthNum = parseFloat(col.width);
        if (!isNaN(widthNum) && widthNum <= 15) {
          const unit = col.width.replace(/[\d.]/g, '');
          parts.push(`max-width:${widthNum * 2}${unit}`);
        }
      }
      // Template hint nowrap — hanya diterapkan jika tableConfig tidak punya wrapText eksplisit
      const hasCfgWrap = tableConfig?.header?.columns?.[colIdx]?.wrapText !== undefined
        && tableConfig?.header?.columns?.[colIdx]?.wrapText !== null;
      if (!hasCfgWrap && (col.noWrap || _isShortColumn(col))) {
        parts.push('white-space:nowrap');
      }
    }

    // Terapkan tableConfig (styling teks header — termasuk wrapText)
    if (tableConfig?.header?.columns) {
      const colCfg = tableConfig.header.columns[colIdx];
      if (colCfg) {
        const cfgStyle = _buildConfigStyle(colCfg, headerFontSize);
        if (cfgStyle) {
          // Hapus properti dari parts yang akan di-override oleh cfgStyle
          // agar tidak ada deklarasi CSS duplikat dalam satu inline style attribute.
          // Duplikat bisa menyebabkan perilaku tidak konsisten di beberapa browser/context.
          const cfgProps = new Set(cfgStyle.split(';').map(d => d.split(':')[0].trim()).filter(Boolean));
          const filteredParts = parts.filter(p => {
            const prop = p.split(':')[0].trim();
            return !cfgProps.has(prop);
          });
          filteredParts.push(cfgStyle);
          return filteredParts.join(';');
        }
      }
    }

    // Fallback legacy
    if (col.align) parts.push(`text-align:${col.align}`);
    if (headerFontSize) parts.push(`font-size:${headerFontSize}pt`);
    parts.push('font-weight:bold');

    return parts.join(';');
  }

  /* ── Build style string untuk <td> ── */
  function _buildTdStyle(col, tableSize, tableConfig, colIdx) {
    const parts = [];

    // Terapkan tableConfig (styling teks body)
    if (tableConfig?.body?.columns) {
      const colCfg = tableConfig.body.columns[colIdx];
      if (colCfg) {
        const cfgStyle = _buildConfigStyle(colCfg, tableSize);
        if (cfgStyle) {
          parts.push(cfgStyle);
          return parts.join(';');
        }
      }
    }

    // Fallback legacy
    if (col.align) parts.push(`text-align:${col.align}`);
    if (tableSize) parts.push(`font-size:${tableSize}pt`);

    return parts.join(';');
  }

  /* ── Build style dari satu kolom text config ── */
  function _buildConfigStyle(colCfg, fallbackFontSize) {
    if (!colCfg) return '';
    if (typeof TableConfigManager !== 'undefined') {
      return TableConfigManager.buildCellStyle(colCfg, fallbackFontSize);
    }
    // Fallback inline (dipakai saat TableConfigManager belum tersedia — seharusnya tidak terjadi)
    const parts = [];
    if (colCfg.horizontalAlign) parts.push(`text-align:${colCfg.horizontalAlign}`);
    if (colCfg.verticalAlign)   parts.push(`vertical-align:${colCfg.verticalAlign}`);
    if (colCfg.bold   === true)  parts.push('font-weight:bold');
    if (colCfg.bold   === false) parts.push('font-weight:normal');
    if (colCfg.italic === true)  parts.push('font-style:italic');
    if (colCfg.italic === false) parts.push('font-style:normal');
    const fs = colCfg.fontSize != null ? colCfg.fontSize : fallbackFontSize;
    if (fs) parts.push(`font-size:${fs}pt`);
    // wrapText fallback
    if (colCfg.wrapText === true) {
      parts.push('white-space:normal');
      parts.push('overflow-wrap:break-word');
      parts.push('word-break:break-word');
    } else if (colCfg.wrapText === false) {
      parts.push('white-space:nowrap');
    }
    return parts.join(';');
  }

  /* ── Kolom "pendek" (nomor, kode, L/P) — pakai white-space:nowrap di Fit to Content ── */
  function _isShortColumn(col) {
    const shortKeys = ['no', 'urt', 'lp', 'jenisKelamin', '_emisSudah', '_emisBelum'];
    return shortKeys.includes(col.key);
  }

  /* ── Build class tabel berdasarkan fitMode dan custom width ── */
  function _buildTableClass(opts, hasCustomWidth = false, hasWrap = false) {
    const classes = ['doc-table'];
    if (opts.tableClass) classes.push(opts.tableClass);
    if (opts.fitMode === 'full' || hasCustomWidth) {
      classes.push('doc-table--fixed');
    }
    if (hasWrap) {
      classes.push('doc-table--wrap');
    }
    if (opts.fitMode === 'compact') classes.push('doc-table--compact');
    return classes.join(' ');
  }

  /* ── Cek apakah ada kolom (header atau body) dengan wrapText = true ── */
  function _hasAnyWrapText(tableConfig) {
    if (!tableConfig) return false;
    // Cek header columns
    const headerCols = tableConfig.header?.columns;
    if (headerCols) {
      for (const col of Object.values(headerCols)) {
        if (col.wrapText === true) return true;
      }
    }
    // Cek body columns
    const bodyCols = tableConfig.body?.columns;
    if (bodyCols) {
      for (const col of Object.values(bodyCols)) {
        if (col.wrapText === true) return true;
      }
    }
    return false;
  }

  /* ════════════════════════════════════════════════
     HELPER: Render tabel DPU
     DPU: 15 kolom, header 2 baris (colspan/rowspan kompleks)
     - Selalu menggunakan table-layout:fixed (doc-table--dpu)
     - columnWidths body dapat di-override user via tableConfig
     - Header DPU tetap memakai header.columns untuk styling per kolom

     Kolom index map DPU:
       0:urt, 1:indk, 2:nisn, 3:registrasi, 4:nik, 5:namaSiswa,
       6:jenisKelamin, 7:tempatLahir, 8:tanggalLahir, 9:namaOrangTua,
       10:asalSekolah, 11:noIjazah, 12:emisSudah, 13:emisBelum, 14:alasanBelum
  ════════════════════════════════════════════════ */

  /* Definisi kolom DPU (untuk keperluan colgroup) */
  const DPU_COLUMNS = [
    { key: 'urt',          defaultWidth: '5mm'  },
    { key: 'indk',         defaultWidth: '9mm'  },
    { key: 'nisn',         defaultWidth: '18mm' },
    { key: 'registrasi',   defaultWidth: '30mm' },
    { key: 'nik',          defaultWidth: '28mm' },
    { key: 'namaSiswa',    defaultWidth: '32mm' },
    { key: 'jenisKelamin', defaultWidth: '6mm'  },
    { key: 'tempatLahir',  defaultWidth: '14mm' },
    { key: 'tanggalLahir', defaultWidth: '12mm' },
    { key: 'namaOrangTua', defaultWidth: '14mm' },
    { key: 'asalSekolah',  defaultWidth: '16mm' },
    { key: 'noIjazah',     defaultWidth: '18mm' },
    { key: '_emisSudah',   defaultWidth: '6mm'  },
    { key: '_emisBelum',   defaultWidth: '6mm'  },
    { key: 'alasanBelum',  defaultWidth: '14mm' },
  ];

  function renderDpuTable(peserta, typo, minRows = 5, tableConfig = null) {
    const tableSize = typo?.tableSize ?? 7.5;

    // Build colgroup untuk DPU
    // DPU selalu menggunakan table-layout:fixed, jadi colgroup sangat penting
    const colgroupHtml = _buildDpuColgroup(tableConfig);

    const customHeader = `
      <thead>
        <tr>
          ${_buildDpuHeaderCell('URT', 0, tableSize, tableConfig, 'min-width:5mm;max-width:9mm;white-space:nowrap', 'rowspan="2"')}
          ${_buildDpuHeaderCell('INDK', 1, tableSize, tableConfig, 'min-width:7mm;max-width:14mm;white-space:nowrap', 'rowspan="2"')}
          ${_buildDpuHeaderCell('NOMOR', 2, tableSize, tableConfig, '', 'colspan="2"')}
          ${_buildDpuHeaderCell('NIK', 4, tableSize, tableConfig, 'min-width:18mm', 'rowspan="2"')}
          ${_buildDpuHeaderCell('NAMA SISWA', 5, tableSize, tableConfig, 'min-width:20mm', 'rowspan="2"')}
          ${_buildDpuHeaderCell('L/P', 6, tableSize, tableConfig, 'min-width:5mm;max-width:9mm;white-space:nowrap', 'rowspan="2"')}
          ${_buildDpuHeaderCell('TEMPAT LAHIR', 7, tableSize, tableConfig, 'min-width:14mm', 'rowspan="2"')}
          ${_buildDpuHeaderCell('TANGGAL LAHIR', 8, tableSize, tableConfig, 'min-width:12mm', 'rowspan="2"')}
          ${_buildDpuHeaderCell('NAMA ORANG TUA', 9, tableSize, tableConfig, 'min-width:14mm', 'rowspan="2"')}
          ${_buildDpuHeaderCell('ASAL SEKOLAH', 10, tableSize, tableConfig, 'min-width:16mm', 'rowspan="2"')}
          ${_buildDpuHeaderCell('No. IJAZAH JENJANG SEBELUMNYA', 11, tableSize, tableConfig, 'min-width:18mm', 'rowspan="2"')}
          ${_buildDpuHeaderCell('TERDAFTAR DI EMIS', 12, tableSize, tableConfig, '', 'colspan="3"')}
        </tr>
        <tr>
          ${_buildDpuHeaderCell('NISN', 2, tableSize, tableConfig, 'min-width:16mm')}
          ${_buildDpuHeaderCell('REGISTRASI', 3, tableSize, tableConfig, 'min-width:22mm')}
          ${_buildDpuHeaderCell('SUDAH', 12, tableSize, tableConfig, 'min-width:6mm;max-width:12mm;white-space:nowrap')}
          ${_buildDpuHeaderCell('BELUM', 13, tableSize, tableConfig, 'min-width:6mm;max-width:12mm;white-space:nowrap')}
          ${_buildDpuHeaderCell('ALASAN JIKA BELUM', 14, tableSize, tableConfig, 'min-width:14mm')}
        </tr>
      </thead>`;

    const bodyCfg = tableConfig?.body?.columns || {};

    const tbodyRows = peserta.map((p, i) => {
      const cells = [
        { idx: 0,  val: String(p.urt || i + 1),    defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 1,  val: p.indk || '',               defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 2,  val: p.nisn || '',               defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 3,  val: p.registrasi || '',         defaultStyle: `font-size:${Math.max(6, tableSize - 1)}pt;` },
        { idx: 4,  val: p.nik || '',                defaultStyle: `text-align:center;font-size:${Math.max(6, tableSize - 0.5)}pt;` },
        { idx: 5,  val: p.namaSiswa || '',          defaultStyle: `font-size:${tableSize}pt;` },
        { idx: 6,  val: p.jenisKelamin || '',       defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 7,  val: p.tempatLahir || '',        defaultStyle: `font-size:${tableSize}pt;` },
        { idx: 8,  val: p.tanggalLahir ? Utils.formatDateShort(p.tanggalLahir) : '', defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 9,  val: p.namaOrangTua || '',       defaultStyle: `font-size:${tableSize}pt;` },
        { idx: 10, val: p.asalSekolah || '',        defaultStyle: `font-size:${tableSize}pt;` },
        { idx: 11, val: p.noIjazah || '',           defaultStyle: `font-size:${Math.max(6, tableSize - 1)}pt;` },
        { idx: 12, val: p.terdaftarEmis !== false ? '☑' : '', defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 13, val: p.terdaftarEmis === false ? '☐' : '', defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 14, val: p.alasanBelum || '',        defaultStyle: `font-size:${Math.max(6, tableSize - 1)}pt;` },
      ].map(c => {
        const colCfg = bodyCfg[c.idx];
        const style  = colCfg ? _buildConfigStyle(colCfg, tableSize) : c.defaultStyle;
        const finalStyle = _mergeInlineStyles(style, `background-color:${_getSectionBackground(tableConfig, 'body')}`);
        return `<td style="${finalStyle}">${Utils.escapeHtml(c.val)}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const emptyCount    = Math.max(0, minRows - peserta.length);
    const emptyRowsHtml = Array.from({ length: emptyCount }, () =>
      `<tr class="doc-empty-row">${Array(15).fill(`<td style="background-color:${_getSectionBackground(tableConfig, 'body')}">&nbsp;</td>`).join('')}</tr>`
    ).join('');

    return `
      <div class="doc-table-wrap doc-table-wrap--full">
        <table class="doc-table doc-table--dpu">
          ${colgroupHtml}
          ${customHeader}
          <tbody>${tbodyRows}${emptyRowsHtml}</tbody>
        </table>
      </div>`;
  }

  /* ── Build colgroup untuk DPU ──
   * DPU selalu punya colgroup agar table-layout:fixed bisa mendistribusikan kolom.
   * Jika user set custom width untuk kolom tertentu → gunakan itu.
   * Jika tidak → gunakan default width DPU.
   */
  /* ── Build satu header DPU dengan style dari header.columns[colIdx] ── */
  function _buildDpuHeaderCell(label, colIdx, tableSize, tableConfig, baseStyle = '', attrs = '') {
    const colCfg = tableConfig?.header?.columns?.[colIdx];
    const cfgStyle = colCfg ? _buildConfigStyle(colCfg, tableSize) : '';
    const fallback = `font-size:${tableSize}pt;font-weight:bold`;
    const style = _mergeInlineStyles(
      _mergeInlineStyles(baseStyle, cfgStyle || fallback),
      `background-color:${_getSectionBackground(tableConfig, 'header')}`
    );
    const attrText = attrs ? ` ${attrs}` : '';
    return `<th${attrText} style="${style}">${Utils.escapeHtml(label)}</th>`;
  }

  /* Gabungkan style dasar dengan style config; property dari config menang */
  function _mergeInlineStyles(baseStyle, overrideStyle) {
    const baseParts = String(baseStyle || '').split(';').map(s => s.trim()).filter(Boolean);
    const overrideParts = String(overrideStyle || '').split(';').map(s => s.trim()).filter(Boolean);
    if (!overrideParts.length) return baseParts.join(';');

    const overrideProps = new Set(
      overrideParts.map(part => part.split(':')[0].trim()).filter(Boolean)
    );
    const filteredBase = baseParts.filter(
      part => !overrideProps.has(part.split(':')[0].trim())
    );
    return [...filteredBase, ...overrideParts].join(';');
  }

  function _buildDpuColgroup(tableConfig) {
    const columnWidths = tableConfig?.columnWidths;
    const byKey        = columnWidths?.byKey || {};

    const cols = DPU_COLUMNS.map(colDef => {
      const w = byKey[colDef.key];
      if (w && w.mode === 'custom' && w.value != null) {
        const val = w.unit === 'mm' ? `${w.value}mm` : `${w.value}%`;
        return `<col style="width:${val}">`;
      }
      // Default: gunakan lebar bawaan DPU
      return `<col style="width:${colDef.defaultWidth}">`;
    }).join('');

    return `<colgroup>${cols}</colgroup>`;
  }

  /* ── Public API ── */
  return {
    render,
    renderDpuTable,
  };

})();
