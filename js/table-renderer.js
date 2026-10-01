/* =============================================================
   table-renderer.js — Reusable table renderer untuk template surat
   =============================================================
   Mengimplementasikan layout "Fit to Content, bounded by Window":
   - Tabel tidak dipaksa width: 100% (kecuali template mensyaratkannya)
   - Lebar tabel mengikuti konten, dibatasi oleh content area
   - Kolom dengan width eksplisit dihormati sebagai min-width
   - Kolom flex mendapat ruang sisa secara proporsional
   - Konten panjang wrapping wajar tanpa horizontal overflow halaman
   - API: TableRenderer.render(columns, rows, options)
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
   * @param {Array}  columns  — definisi kolom dari template.tableColumns
   *   Setiap kolom: { key, header, width, align, minWidth, noWrap, flex }
   *   - width     : lebar eksplisit (mis. '10mm') → diterapkan sebagai min-width
   *   - align     : 'left' | 'center' | 'right'
   *   - noWrap    : true → white-space: nowrap pada kolom ini
   *   - flex      : true → kolom ini mendapat ruang sisa (class col-flex)
   * @param {Array}  rows     — array data baris, setiap baris = object {key: value}
   * @param {Object} options  — override DEFAULTS
   * @param {number} tableSize — ukuran font tabel dari typography settings
   * @returns {string} HTML string <div class="doc-table-wrap">...</div>
   */
  function render(columns, rows, options = {}, tableSize = 7.5) {
    const opts = { ...DEFAULTS, ...options };

    const theadHtml = opts.customHeader || _buildAutoHeader(columns, opts.headerFontSize || tableSize);
    const tbodyHtml = _buildBody(columns, rows, tableSize, opts.minRows);
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
  function _buildAutoHeader(columns, headerFontSize) {
    const cells = columns.map(col => {
      const style = _buildThStyle(col, headerFontSize);
      return `<th style="${style}">${Utils.escapeHtml(col.header || '')}</th>`;
    }).join('');
    return `<thead><tr>${cells}</tr></thead>`;
  }

  /* ── Build tbody ── */
  function _buildBody(columns, rows, tableSize, minRows) {
    const dataRows = rows.map(row => _buildRow(columns, row, tableSize));

    // Baris kosong pengisi jika minRows > 0
    const emptyCount = Math.max(0, minRows - rows.length);
    const emptyRows = Array.from({ length: emptyCount }, () => {
      const cells = columns.map(() => '<td>&nbsp;</td>').join('');
      return `<tr class="doc-empty-row">${cells}</tr>`;
    });

    return [...dataRows, ...emptyRows].join('');
  }

  /* ── Build satu baris data ── */
  function _buildRow(columns, rowData, tableSize) {
    const cells = columns.map(col => {
      const val   = rowData[col.key] != null ? String(rowData[col.key]) : '';
      const style = _buildTdStyle(col, tableSize);
      return `<td style="${style}">${Utils.escapeHtml(val)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }

  /* ── Build style string untuk <th> ── */
  function _buildThStyle(col, headerFontSize) {
    const parts = [];

    // Width eksplisit → min-width (bukan width tetap)
    // Tabel auto akan menggunakan ini sebagai batas bawah lebar kolom
    if (col.width && col.width !== 'auto') {
      parts.push(`min-width:${col.width}`);
      // Untuk kolom pendek yang ditentukan eksplisit, tambahkan max-width juga
      // agar kolom tersebut tidak terlalu lebar ketika tabel auto-sized
      const widthNum = parseFloat(col.width);
      if (!isNaN(widthNum) && widthNum <= 15) {
        // Kolom sempit: beri max-width 2× untuk sedikit ruang tapi tidak berlebihan
        const unit = col.width.replace(/[\d.]/g, '');
        parts.push(`max-width:${widthNum * 2}${unit}`);
      }
    }

    if (col.align) parts.push(`text-align:${col.align}`);
    if (col.noWrap || _isShortColumn(col)) parts.push('white-space:nowrap');
    if (headerFontSize) parts.push(`font-size:${headerFontSize}pt`);

    return parts.join(';');
  }

  /* ── Build style string untuk <td> ── */
  function _buildTdStyle(col, tableSize) {
    const parts = [];
    if (col.align) parts.push(`text-align:${col.align}`);
    if (tableSize) parts.push(`font-size:${tableSize}pt`);
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
  ══════════════════════════════════════════════════════════ */
  function renderDpuTable(peserta, typo, minRows = 5) {
    const tableSize = typo?.tableSize ?? 7.5;

    /* ── Custom header DPU (2 baris, colspan + rowspan) ── */
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

    const tbodyRows = peserta.map((p, i) => `
      <tr>
        <td style="text-align:center;font-size:${tableSize}pt;">${Utils.escapeHtml(String(p.urt || i + 1))}</td>
        <td style="text-align:center;font-size:${tableSize}pt;">${Utils.escapeHtml(p.indk || '')}</td>
        <td style="text-align:center;font-size:${tableSize}pt;">${Utils.escapeHtml(p.nisn || '')}</td>
        <td style="font-size:${Math.max(6, tableSize - 1)}pt;">${Utils.escapeHtml(p.registrasi || '')}</td>
        <td style="text-align:center;font-size:${Math.max(6, tableSize - 0.5)}pt;">${Utils.escapeHtml(p.nik || '')}</td>
        <td style="font-size:${tableSize}pt;">${Utils.escapeHtml(p.namaSiswa || '')}</td>
        <td style="text-align:center;font-size:${tableSize}pt;">${Utils.escapeHtml(p.jenisKelamin || '')}</td>
        <td style="font-size:${tableSize}pt;">${Utils.escapeHtml(p.tempatLahir || '')}</td>
        <td style="text-align:center;font-size:${tableSize}pt;">${p.tanggalLahir ? Utils.formatDateShort(p.tanggalLahir) : ''}</td>
        <td style="font-size:${tableSize}pt;">${Utils.escapeHtml(p.namaOrangTua || '')}</td>
        <td style="font-size:${tableSize}pt;">${Utils.escapeHtml(p.asalSekolah || '')}</td>
        <td style="font-size:${Math.max(6, tableSize - 1)}pt;">${Utils.escapeHtml(p.noIjazah || '')}</td>
        <td style="text-align:center;font-size:${tableSize}pt;">${p.terdaftarEmis !== false ? '☑' : ''}</td>
        <td style="text-align:center;font-size:${tableSize}pt;">${p.terdaftarEmis === false ? '☐' : ''}</td>
        <td style="font-size:${Math.max(6, tableSize - 1)}pt;">${Utils.escapeHtml(p.alasanBelum || '')}</td>
      </tr>`).join('');

    // Baris kosong
    const emptyCount = Math.max(0, minRows - peserta.length);
    const emptyRowsHtml = Array.from({ length: emptyCount }, () =>
      `<tr class="doc-empty-row">${Array(15).fill('<td>&nbsp;</td>').join('')}</tr>`
    ).join('');

    /*
     * DPU: tabel selalu landscape A4 dengan 15 kolom → gunakan doc-table--dpu
     * agar tabel memenuhi lebar halaman secara wajar (Fit to Window untuk DPU).
     * Ini pengecualian dari prinsip umum Fit to Content karena konten DPU
     * memang membutuhkan seluruh lebar landscape A4.
     */
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
