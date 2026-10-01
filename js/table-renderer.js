/* =============================================================
   table-renderer.js — Reusable table renderer untuk template surat
   =============================================================
   Mengimplementasikan layout "Fit to Content, bounded by Window":
   - Tabel tidak dipaksa width: 100% (kecuali template mensyaratkannya)
   - Lebar tabel mengikuti konten, dibatasi oleh content area
   - Kolom dengan width eksplisit dihormati sebagai min-width
   - Kolom flex mendapat ruang sisa secara proporsional
   - Konten panjang wrapping wajar tanpa horizontal overflow halaman

   Mendukung konfigurasi per-kolom (Pengaturan Tabel):
   - tableConfig: { header: { columns: {0:{...}, 1:{...}} }, body: { columns: {...} } }
   - Setiap kolom config: { horizontalAlign, verticalAlign, bold, italic, fontSize }
   - Header dan Body dikonfigurasi secara TERPISAH
   - Jika tableConfig tidak diberikan, renderer jatuh kembali ke perilaku lama

   API: TableRenderer.render(columns, rows, options, tableSize, tableConfig)
        TableRenderer.renderDpuTable(peserta, typo, minRows, tableConfig)
   =============================================================
*/

const TableRenderer = (() => {

  /* ── Opsi default ── */
  const DEFAULTS = {
    /* 'auto'    : Fit to Content (default) — tabel selebar konten, max 100% */
    /* 'full'    : tabel selalu 100% lebar content area (DPU landscape, dll) */
    /* 'compact' : tabel sesempit mungkin, gunakan untuk tabel kecil */
    fitMode:        'auto',

    /* Class tambahan pada elemen <table> */
    tableClass:     '',

    /* Ukuran font default sel data (pt) — bisa di-override per kolom */
    fontSize:       7.5,

    /* Ukuran font header (pt) */
    headerFontSize: 7.5,

    /* Tambahkan baris kosong hingga minimal N baris terisi */
    minRows:        0,

    /* Apakah header multi-baris (untuk colspan/rowspan kompleks) */
    customHeader:   null,   // string HTML thead lengkap, jika diisi akan menggantikan auto-header
  };

  /* ── Render tabel lengkap ── */
  /**
   * @param {Array}  columns    — definisi kolom dari template.tableColumns
   *   Setiap kolom: { key, header, width, align, minWidth, noWrap, flex }
   * @param {Array}  rows       — array data baris, setiap baris = object {key: value}
   * @param {Object} options    — override DEFAULTS
   * @param {number} tableSize  — ukuran font tabel dari typography settings
   * @param {Object} tableConfig — konfigurasi per-kolom dari TableConfigManager:
   *   { header: { columns: {0:{...},1:{...}} }, body: { columns: {...} } }
   *   Jika null/undefined, jatuh kembali ke perilaku legacy (align dari kolom definisi).
   * @returns {string} HTML string <div class="doc-table-wrap">...</div>
   */
  function render(columns, rows, options = {}, tableSize = 7.5, tableConfig = null) {
    const opts = { ...DEFAULTS, ...options };

    const theadHtml = opts.customHeader
      || _buildAutoHeader(columns, opts.headerFontSize || tableSize, tableConfig);
    const tbodyHtml = _buildBody(columns, rows, tableSize, opts.minRows, tableConfig);
    const tableClass = _buildTableClass(opts);

    return `
      <div class="doc-table-wrap">
        <table class="${tableClass}">
          ${theadHtml}
          <tbody>${tbodyHtml}</tbody>
        </table>
      </div>`;
  }

  /* ── Build thead otomatis dari kolom ── */
  function _buildAutoHeader(columns, headerFontSize, tableConfig) {
    const cells = columns.map((col, idx) => {
      const style = _buildThStyle(col, headerFontSize, tableConfig, idx);
      return `<th style="${style}">${Utils.escapeHtml(col.header || '')}</th>`;
    }).join('');
    return `<thead><tr>${cells}</tr></thead>`;
  }

  /* ── Build tbody ── */
  function _buildBody(columns, rows, tableSize, minRows, tableConfig) {
    const dataRows = rows.map(row => _buildRow(columns, row, tableSize, tableConfig));

    // Baris kosong pengisi jika minRows > 0
    const emptyCount = Math.max(0, minRows - rows.length);
    const emptyRows = Array.from({ length: emptyCount }, () => {
      const cells = columns.map(() => '<td>&nbsp;</td>').join('');
      return `<tr class="doc-empty-row">${cells}</tr>`;
    });

    return [...dataRows, ...emptyRows].join('');
  }

  /* ── Build satu baris data ── */
  function _buildRow(columns, rowData, tableSize, tableConfig) {
    const cells = columns.map((col, idx) => {
      const val   = rowData[col.key] != null ? String(rowData[col.key]) : '';
      const style = _buildTdStyle(col, tableSize, tableConfig, idx);
      return `<td style="${style}">${Utils.escapeHtml(val)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }

  /* ── Build style string untuk <th> ── */
  function _buildThStyle(col, headerFontSize, tableConfig, colIdx) {
    const parts = [];

    // Width eksplisit → min-width (bukan width tetap)
    if (col.width && col.width !== 'auto') {
      parts.push(`min-width:${col.width}`);
      const widthNum = parseFloat(col.width);
      if (!isNaN(widthNum) && widthNum <= 15) {
        const unit = col.width.replace(/[\d.]/g, '');
        parts.push(`max-width:${widthNum * 2}${unit}`);
      }
    }

    // noWrap legacy
    if (col.noWrap || _isShortColumn(col)) parts.push('white-space:nowrap');

    // Terapkan tableConfig jika tersedia
    if (tableConfig && tableConfig.header && tableConfig.header.columns) {
      const colCfg = tableConfig.header.columns[colIdx];
      if (colCfg) {
        const cfgStyle = _buildConfigStyle(colCfg, headerFontSize);
        if (cfgStyle) {
          parts.push(cfgStyle);
          return parts.join(';');
        }
      }
    }

    // Fallback: gunakan align dari definisi kolom + headerFontSize
    if (col.align) parts.push(`text-align:${col.align}`);
    if (headerFontSize) parts.push(`font-size:${headerFontSize}pt`);
    // Header default: bold
    parts.push('font-weight:bold');

    return parts.join(';');
  }

  /* ── Build style string untuk <td> ── */
  function _buildTdStyle(col, tableSize, tableConfig, colIdx) {
    const parts = [];

    // Terapkan tableConfig jika tersedia
    if (tableConfig && tableConfig.body && tableConfig.body.columns) {
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

  /* ── Build style dari satu kolom config ── */
  /**
   * Menggunakan TableConfigManager.buildCellStyle jika tersedia,
   * jika tidak, bangun style secara langsung (fallback aman).
   */
  function _buildConfigStyle(colCfg, fallbackFontSize) {
    if (!colCfg) return '';

    // Gunakan TableConfigManager.buildCellStyle jika tersedia
    if (typeof TableConfigManager !== 'undefined') {
      return TableConfigManager.buildCellStyle(colCfg, fallbackFontSize);
    }

    // Fallback inline (seharusnya tidak terjadi di runtime normal)
    const parts = [];
    if (colCfg.horizontalAlign) parts.push(`text-align:${colCfg.horizontalAlign}`);
    if (colCfg.verticalAlign)   parts.push(`vertical-align:${colCfg.verticalAlign}`);
    if (colCfg.bold   === true)  parts.push('font-weight:bold');
    if (colCfg.bold   === false) parts.push('font-weight:normal');
    if (colCfg.italic === true)  parts.push('font-style:italic');
    if (colCfg.italic === false) parts.push('font-style:normal');
    const fs = colCfg.fontSize != null ? colCfg.fontSize : fallbackFontSize;
    if (fs) parts.push(`font-size:${fs}pt`);
    return parts.join(';');
  }

  /* ── Tentukan apakah kolom "pendek" (nomor, kode, L/P, checkbox) ── */
  function _isShortColumn(col) {
    const shortKeys = ['no', 'urt', 'lp', 'jenisKelamin', '_emisSudah', '_emisBelum'];
    return shortKeys.includes(col.key);
  }

  /* ── Build class tabel berdasarkan fitMode ── */
  function _buildTableClass(opts) {
    const classes = ['doc-table'];
    if (opts.tableClass) classes.push(opts.tableClass);
    if (opts.fitMode === 'full') classes.push('doc-table--full');
    if (opts.fitMode === 'compact') classes.push('doc-table--compact');
    return classes.join(' ');
  }

  /* ══════════════════════════════════════════════════════════
     HELPER: Render tabel DPU
     DPU memiliki header dua baris (colspan/rowspan kompleks)
     sehingga menggunakan customHeader alih-alih auto-header.

     tableConfig untuk DPU: karena header DPU multi-row dengan
     colspan/rowspan, konfigurasi per-kolom diterapkan hanya
     pada <td> body. Header DPU menggunakan style template asli.
  ══════════════════════════════════════════════════════════ */
  function renderDpuTable(peserta, typo, minRows = 5, tableConfig = null) {
    const tableSize = typo?.tableSize ?? 7.5;

    /* ── Custom header DPU (2 baris, colspan + rowspan) ── */
    /* Header DPU sangat spesifik → tidak di-override oleh tableConfig.
       User hanya dapat mengatur body columns untuk DPU. */
    const customHeader = `
      <thead>
        <tr>
          <th rowspan="2" style="min-width:5mm;max-width:9mm;white-space:nowrap;font-size:${tableSize}pt;">URT</th>
          <th rowspan="2" style="min-width:7mm;max-width:14mm;white-space:nowrap;font-size:${tableSize}pt;">INDK</th>
          <th colspan="2" style="font-size:${tableSize}pt;">NOMOR</th>
          <th rowspan="2" style="min-width:18mm;font-size:${tableSize}pt;">NIK</th>
          <th rowspan="2" style="min-width:20mm;font-size:${tableSize}pt;">NAMA SISWA</th>
          <th rowspan="2" style="min-width:5mm;max-width:9mm;white-space:nowrap;font-size:${tableSize}pt;">L/P</th>
          <th rowspan="2" style="min-width:14mm;font-size:${tableSize}pt;">TEMPAT LAHIR</th>
          <th rowspan="2" style="min-width:12mm;font-size:${tableSize}pt;">TANGGAL LAHIR</th>
          <th rowspan="2" style="min-width:14mm;font-size:${tableSize}pt;">NAMA ORANG TUA</th>
          <th rowspan="2" style="min-width:16mm;font-size:${tableSize}pt;">ASAL SEKOLAH</th>
          <th rowspan="2" style="min-width:18mm;font-size:${tableSize}pt;">No. IJAZAH JENJANG SEBELUMNYA</th>
          <th colspan="3" style="font-size:${tableSize}pt;">TERDAFTAR DI EMIS</th>
        </tr>
        <tr>
          <th style="min-width:16mm;font-size:${tableSize}pt;">NISN</th>
          <th style="min-width:22mm;font-size:${tableSize}pt;">REGISTRASI</th>
          <th style="min-width:6mm;max-width:12mm;white-space:nowrap;font-size:${tableSize}pt;">SUDAH</th>
          <th style="min-width:6mm;max-width:12mm;white-space:nowrap;font-size:${tableSize}pt;">BELUM</th>
          <th style="min-width:14mm;font-size:${tableSize}pt;">ALASAN JIKA BELUM</th>
        </tr>
      </thead>`;

    /* ── DPU: 15 kolom (urutan sama dengan customHeader) ── */
    /* Kolom index map untuk DPU (dipakai resolusi tableConfig.body.columns):
       0:urt, 1:indk, 2:nisn, 3:registrasi, 4:nik, 5:namaSiswa,
       6:jenisKelamin, 7:tempatLahir, 8:tanggalLahir, 9:namaOrangTua,
       10:asalSekolah, 11:noIjazah, 12:emisSudah, 13:emisBelum, 14:alasanBelum */
    const bodyCfg = tableConfig?.body?.columns || {};

    const tbodyRows = peserta.map((p, i) => {
      const cells = [
        { idx: 0,  val: String(p.urt || i + 1),                          defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 1,  val: p.indk || '',                                     defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 2,  val: p.nisn || '',                                     defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 3,  val: p.registrasi || '',                               defaultStyle: `font-size:${Math.max(6, tableSize - 1)}pt;` },
        { idx: 4,  val: p.nik || '',                                      defaultStyle: `text-align:center;font-size:${Math.max(6, tableSize - 0.5)}pt;` },
        { idx: 5,  val: p.namaSiswa || '',                                defaultStyle: `font-size:${tableSize}pt;` },
        { idx: 6,  val: p.jenisKelamin || '',                             defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 7,  val: p.tempatLahir || '',                              defaultStyle: `font-size:${tableSize}pt;` },
        { idx: 8,  val: p.tanggalLahir ? Utils.formatDateShort(p.tanggalLahir) : '', defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 9,  val: p.namaOrangTua || '',                             defaultStyle: `font-size:${tableSize}pt;` },
        { idx: 10, val: p.asalSekolah || '',                              defaultStyle: `font-size:${tableSize}pt;` },
        { idx: 11, val: p.noIjazah || '',                                 defaultStyle: `font-size:${Math.max(6, tableSize - 1)}pt;` },
        { idx: 12, val: p.terdaftarEmis !== false ? '☑' : '',            defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 13, val: p.terdaftarEmis === false ? '☐' : '',            defaultStyle: `text-align:center;font-size:${tableSize}pt;` },
        { idx: 14, val: p.alasanBelum || '',                              defaultStyle: `font-size:${Math.max(6, tableSize - 1)}pt;` },
      ].map(c => {
        const colCfg = bodyCfg[c.idx];
        const style  = colCfg ? _buildConfigStyle(colCfg, tableSize) : c.defaultStyle;
        return `<td style="${style}">${Utils.escapeHtml(c.val)}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    // Baris kosong
    const emptyCount = Math.max(0, minRows - peserta.length);
    const emptyRowsHtml = Array.from({ length: emptyCount }, () =>
      `<tr class="doc-empty-row">${Array(15).fill('<td>&nbsp;</td>').join('')}</tr>`
    ).join('');

    return `
      <div class="doc-table-wrap doc-table-wrap--full">
        <table class="doc-table doc-table--dpu">
          ${customHeader}
          <tbody>${tbodyRows}${emptyRowsHtml}</tbody>
        </table>
      </div>`;
  }

  /* ── Public API ── */
  return {
    render,
    renderDpuTable,
  };

})();
