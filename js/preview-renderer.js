/* =============================================================
   preview-renderer.js — Render live preview surat
   =============================================================
   Dimensi kertas dan margin diambil dari State.getSettings()
   agar sinkron dengan tab Pengaturan.
   Zoom preview TIDAK mempengaruhi ukuran dokumen sebenarnya —
   hanya mengubah tampilan di layar.
*/

const PreviewRenderer = (() => {

  let _previewEl   = null;   // #surat-preview
  let _viewportEl  = null;   // #preview-viewport
  let _wrapperEl   = null;   // #preview-canvas-wrapper
  let _zoomLevelEl = null;   // #zoom-level-text
  let _pageInfoEl  = null;    // #preview-page-info
  let _currentZoom = 1;
  let _renderToken = 0;       // membatalkan pagination async dari render lama
  let _paginationPromise = Promise.resolve(); // status pagination render terbaru

  const ZOOM_STEP = 0.1;
  const ZOOM_MIN  = 0.3;
  const ZOOM_MAX  = 2.5;
  const PX_PER_MM = 96 / 25.4;  // 1 mm = ~3.78 px pada 96 dpi

  /* ── Init ── */
  function init() {
    _previewEl   = document.getElementById('surat-preview');
    _viewportEl  = document.getElementById('preview-viewport');
    _wrapperEl   = document.getElementById('preview-canvas-wrapper');
    _zoomLevelEl = document.getElementById('zoom-level-text');
    _pageInfoEl  = document.getElementById('preview-page-info');

    if (!_previewEl) { console.warn('[PreviewRenderer] Preview element tidak ditemukan.'); return; }

    // Restore zoom dari state
    _currentZoom = State.getUi().previewZoom || 1;
    _applyZoom(_currentZoom);

    // Bind zoom buttons (toolbar preview)
    document.getElementById('btn-zoom-in')?.addEventListener('click',  () => _changeZoom(ZOOM_STEP));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => _changeZoom(-ZOOM_STEP));
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      _setZoomMode('actual');
    });
    document.getElementById('btn-fit-page')?.addEventListener('click', () => {
      _setZoomMode('fit-page');
    });
    document.getElementById('btn-fit-width')?.addEventListener('click', () => {
      _setZoomMode('fit-width');
    });

    // Subscribe state events
    const debouncedRender = Utils.debounce(_renderCurrent, 200);

    State.on('kop:change',        debouncedRender);
    State.on('form:change',       debouncedRender);
    State.on('template:change',   debouncedRender);
    State.on('settings:change',   (payload) => {
      // Gaya footer nomor halaman tidak perlu menunggu pagination/render ulang.
      // Sinkronkan langsung ke halaman yang sedang tampil agar perubahan UI
      // terlihat seketika, lalu tetap jalankan render debounced untuk settings
      // lain yang memang memerlukan layout ulang.
      if (payload?.settings?.pageNumber) {
        _syncPageNumberSettings(payload.settings.pageNumber);
      }
      debouncedRender();
    });
    State.on('table:change',      debouncedRender); // ← pengaturan tabel berubah
    State.on('table:reset',       debouncedRender); // ← reset pengaturan tabel
    State.on('state:restore', () => {
      _currentZoom = State.getUi().previewZoom || 1;
      _applyZoom(_currentZoom);
      _renderCurrent();
    });
    State.on('state:reset',    () => _showPlaceholder());
    State.on('ui:zoomChange',  ({ zoom }) => {
      _currentZoom = zoom;
      _applyZoom(zoom);
    });

    // State restore terjadi sebelum PreviewRenderer diinisialisasi pada boot.
    // Render awal di sini memastikan data yang sudah direstore langsung tampil.
    _renderCurrent();
  }

  /* ── Render preview sesuai template aktif ── */
  function _renderCurrent() {
    const templateId = State.getActiveTemplate();
    if (!templateId) { _showPlaceholder(); return; }

    const tpl      = TemplateRegistry.get(templateId);
    const formData = State.getFormData(templateId);
    const kop      = State.getKop();

    if (!tpl || !formData) { _showPlaceholder(); return; }

    render(tpl, formData, kop);
  }

  /* ── Render utama ── */
  function render(tpl, formData, kop) {
    if (!_previewEl) return;

    // ── Dimensi kertas dari Settings (bukan dari meta template) ──
    const s            = State.getSettings();
    const dim          = State.getPaperDimensions();
    const margin       = State.getMarginMm();
    const typo         = State.getTypography();
    const isLandscape  = s.orientation === 'landscape';
    const isMultiPage  = ['dpu', 'mutasi-masuk', 'siswa-baru'].includes(tpl?.TEMPLATE_ID);
    const renderToken  = ++_renderToken;

    // Pagination harus diukur pada ukuran halaman fisik sebenarnya.
    // .surat-preview--document memakai width:auto !important untuk mode final,
    // sehingga kelas tersebut baru diterapkan setelah halaman selesai dibentuk.
    _previewEl.classList.remove('surat-preview--document');
    _previewEl.classList.toggle('orientation-landscape', isLandscape && !isMultiPage);

    const paperWidthPx  = dim.widthMm  * PX_PER_MM;
    const paperHeightPx = dim.heightMm * PX_PER_MM;

    _previewEl.style.width = `${paperWidthPx}px`;
    _previewEl.style.minHeight = isMultiPage ? '0' : `${paperHeightPx}px`;

    if (_wrapperEl) {
      _wrapperEl.style.width = `${paperWidthPx}px`;
    }

    // Render HTML isi dokumen sebagai satu flow terlebih dahulu.
    const html = _buildDocumentHtml(tpl, formData, kop, margin, typo);
    _previewEl.innerHTML = html;

    if (isMultiPage) {
      // Pagination dilakukan setelah font/image/layout stabil.
      _schedulePagination(renderToken, paperWidthPx, paperHeightPx);
      return;
    }

    _updatePageInfo(1);

    requestAnimationFrame(() => {
      if (renderToken !== _renderToken) return;
      _updateWrapperHeight(_currentZoom);
      if (typeof DocumentViewer !== 'undefined') DocumentViewer.refresh();
      if (typeof Settings !== 'undefined') {
        const sv = State.getSettings().preview;
        if (sv.showMarginGuide)   _reApplyMarginGuide(sv.showMarginGuide);
        if (sv.showPrintableArea) _reApplyPrintableArea(sv.showPrintableArea);
      }
    });
  }
  /* ── Build seluruh HTML dokumen ── */
  function _buildDocumentHtml(tpl, formData, kop, margin, typo) {
    const id = tpl.TEMPLATE_ID;
    if (id === 'dpu')                         return _renderDpu(formData, kop, margin, typo);
    if (id === 'mutasi-masuk')                return _renderSiswa(formData, kop, tpl, true,  margin, typo);
    if (id === 'siswa-baru')                  return _renderSiswa(formData, kop, tpl, false, margin, typo);
    if (id === 'ijop-permohonan')             return _renderIjopPermohonan(formData, kop, margin, typo);
    if (id === 'ijop-sptjm-satpen')           return _renderIjopSptjmSatpen(formData, kop, margin, typo);
    if (id === 'ijop-rekomendasi-pengawas')   return _renderIjopRekomendasiPengawas(formData, kop, margin, typo);
    if (id === 'ijop-rekomendasi-kankemenag') return _renderIjopRekomendasiKankemenag(formData, kop, margin, typo);
    if (id === 'ijop-sptjm-kankemenag')       return _renderIjopSptjmKankemenag(formData, kop, margin, typo);
    return '<div style="padding:20px;color:#666;">Template tidak dikenali.</div>';
  }

  /* ── KOP HTML helper ── */
  function _buildKopHtml(kop) {
    return KopEditor.renderKopHtml(kop);
  }

  /* ────────────────────────────────────────────────
     RENDERER: DPU
  ──────────────────────────────────────────────── */
  function _renderDpu(data, kop, margin, typo) {
    const meta = data?.meta && typeof data.meta === 'object' ? data.meta : {};
    const peserta = Array.isArray(data?.peserta) ? data.peserta : [];
    const ttd = data?.tandaTangan && typeof data.tandaTangan === 'object' ? data.tandaTangan : {};
    const m  = margin || State.getMarginMm();
    const t  = typo   || State.getTypography();
    // font-family dan font-size isi surat diambil dari settings typography
    const marginStyle = `padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;`
      + `font-family:'${t.fontFamily}',serif;`
      + `font-size:${t.fontSize}pt;`
      + `line-height:${t.lineHeight};`;

    /* ── KOP ── */
    const kopHtml = _buildKopHtml(kop);

    /* ── Info Madrasah (2 kolom) ── */
    const infoHtml = `
      <div class="doc-meta">
        <table>
          <tr><td>Nama Madrasah</td><td>:</td><td><strong>${_esc(meta.namaMadrasah)}</strong></td></tr>
          <tr><td>Status</td><td>:</td><td>${_esc(meta.status)}</td></tr>
          <tr><td>NSM/NPSN</td><td>:</td><td>${_esc(meta.nsmNpsn)}</td></tr>
        </table>
        <table style="text-align:right;">
          <tr><td>Status Akreditasi</td><td>:</td><td>${_esc(meta.statusAkreditasi)}</td></tr>
          <tr><td>Kode Sekolah</td><td>:</td><td>${_esc(meta.kodeSekolah)}</td></tr>
          <tr><td>Tahun Pelajaran</td><td>:</td><td>${_esc(meta.tahunPelajaran)}</td></tr>
        </table>
      </div>`;

    /* ── Judul ── */
    const judulHtml = `
      <div class="doc-title-block">
        <h1 class="doc-title">DAFTAR PESERTA UJIAN (DPU)</h1>
        <h2 class="doc-subtitle">TAHUN PELAJARAN ${_esc(meta.tahunPelajaran)}</h2>
      </div>`;

    /* ── Tabel Peserta — ambil tableConfig dari State ── */
    // DPU memakai tableId = 'dpu' (sama dengan TEMPLATE_ID, format legacy)
    const tableConfig = _getTableConfig('dpu', 'dpu');

    const tableHtml = (typeof TableRenderer !== 'undefined')
      ? TableRenderer.renderDpuTable(peserta, t, 5, tableConfig)
      : _fallbackDpuTable(peserta, t);

    /* ── Tanda Tangan ── */
    const ttdHtml = _buildTtdDpu(ttd);

    return `
      <div class="doc-content doc-content--dpu" style="${marginStyle}">
        ${kopHtml}
        <hr class="doc-kop-divider" />
        <hr class="doc-kop-divider-thin" />
        ${infoHtml}
        ${judulHtml}
        ${tableHtml}
        ${ttdHtml}
      </div>`;
  }

  function _buildTtdDpu(ttd) {
    const kota  = ttd.kota || 'Musi Rawas';
    const tahun = ttd.tahun || '';
    const p1 = ttd.pihak1 || {};
    const p2 = ttd.pihak2 || {};
    const p3 = ttd.pihak3 || {};

    return `
      <div class="doc-ttd-section doc-ttd-section--dpu">
        <div class="doc-ttd-grid doc-ttd-grid--dpu">
          <div class="doc-ttd-col">
            <p class="doc-ttd-col__place">Mengetahui,</p>
            <p class="doc-ttd-col__role">a.n. Kepala Kantor Wilayah Kemenag Prov. Sumsel</p>
            <p class="doc-ttd-col__role">${_esc(p1.jabatan || 'Katim Kurikulum')}</p>
            <div class="doc-ttd-col__space"></div>
            <p class="doc-ttd-col__name">${_esc(p1.nama) || '.............................'}</p>
            <p class="doc-ttd-col__nip">NIP. ${_esc(p1.nip) || '-'}</p>
          </div>
          <div class="doc-ttd-col">
            <p class="doc-ttd-col__place">Mengetahui,</p>
            <p class="doc-ttd-col__role">a.n. Kepala Kantor Kemenag Kab. Musi Rawas</p>
            <p class="doc-ttd-col__role">${_esc(p2.jabatan || 'Kasi Pendidikan Madrasah,')}</p>
            <div class="doc-ttd-col__space"></div>
            <p class="doc-ttd-col__name">${_esc(p2.nama) || '.............................'}</p>
            <p class="doc-ttd-col__nip">NIP. ${_esc(p2.nip) || '-'}</p>
          </div>
          <div class="doc-ttd-col">
            <p class="doc-ttd-col__place">${_esc(kota)}, ${_esc(tahun)}</p>
            <p class="doc-ttd-col__role">${_esc(p3.jabatan || 'Kepala MTs Nurul Falah,')}</p>
            <div class="doc-ttd-col__space"></div>
            <p class="doc-ttd-col__name">${_esc(p3.nama) || '.............................'}</p>
            <p class="doc-ttd-col__nip">NIP. ${_esc(p3.nip) || '-'}</p>
          </div>
        </div>
      </div>`;
  }

  /* ────────────────────────────────────────────────
     RENDERER: Mutasi Masuk & Siswa Baru (struktur mirip)
  ──────────────────────────────────────────────── */
  function _renderSiswa(data, kop, tpl, isMutasi, margin, typo) {
    const meta = data?.meta && typeof data.meta === 'object' ? data.meta : {};
    const siswa = Array.isArray(data?.siswa) ? data.siswa : [];
    const ttd = data?.tandaTangan && typeof data.tandaTangan === 'object' ? data.tandaTangan : {};
    const catatan = data?.catatan && typeof data.catatan === 'object' ? data.catatan : {};
    const m  = margin || State.getMarginMm();
    const t  = typo   || State.getTypography();
    const marginStyle = `padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;`
      + `font-family:'${t.fontFamily}',serif;`
      + `font-size:${t.fontSize}pt;`
      + `line-height:${t.lineHeight};`;

    /* ── KOP ── */
    const kopHtml = _buildKopHtml(kop);

    /* ── Header institusi & judul ── */
    const judulText = isMutasi
      ? `DAFTAR PENGESAHAN SISWA BARU (MUTASI MASUK) TAHUN ${_esc(meta.tahunAjaran || meta.tahun)}`
      : `DAFTAR PENGESAHAN SISWA BARU TAHUN ${_esc(meta.tahunAjaran || meta.tahun)}`;

    /* ── Info Madrasah ── */
    const kelasRow = !isMutasi
      ? `<tr><td>Kelas</td><td>:</td><td>${_esc(meta.kelas)}</td></tr>` : '';
    const infoHtml = `
      <div class="doc-meta">
        <table>
          <tr><td>MADRASAH</td><td>:</td><td><strong>${_esc(meta.namaMadrasah)}</strong></td></tr>
          <tr><td>NSM</td><td>:</td><td>${_esc(meta.nsm)}</td></tr>
          <tr><td>NPSN</td><td>:</td><td>${_esc(meta.npsn)}</td></tr>
        </table>
        <table>
          <tr><td>Status</td><td>:</td><td>${_esc(meta.status)}</td></tr>
          ${kelasRow}
          <tr><td>Terakreditasi</td><td>:</td><td>${_esc(meta.terakreditasi)}</td></tr>
          <tr><td>Tahun</td><td>:</td><td>${_esc(meta.tahun)}</td></tr>
        </table>
      </div>`;

    const judulHtml = `
      <div class="doc-title-block">
        <h1 class="doc-title">${judulText}</h1>
      </div>`;

    /* ── Tabel siswa — pakai TableRenderer (Fit to Content) ── */
    // Preprocess data siswa: resolusi kolom khusus (no, tanggalLahir, kelas)
    const cols = tpl.tableColumns;
    const resolvedRows = siswa.map((s, i) => {
      const row = {};
      cols.forEach(c => {
        if (c.key === 'no') {
          row[c.key] = String(i + 1);
        } else if (c.key === 'tanggalLahir') {
          // Tanggal Lahir hanya boleh berasal dari field tanggalLahir.
          // Tempat Lahir memiliki kolom tersendiri dan tidak boleh ikut dirender
          // ke dalam kolom Tanggal Lahir.
          row[c.key] = s.tanggalLahir ? Utils.formatDateShort(s.tanggalLahir) : '';
        } else if (c.key === 'tempatLahir') {
          row[c.key] = s.tempatLahir || '';
        } else if (c.key === 'kelas') {
          const map = { '7': 'VII', '8': 'VIII', '9': 'IX' };
          row[c.key] = map[s.kelas] || s.kelas || '';
        } else {
          row[c.key] = s[c.key] != null ? String(s[c.key]) : '';
        }
      });
      return row;
    });

    // Ambil tableConfig dari State untuk template ini
    // tableId = tpl.TEMPLATE_ID (format legacy: satu tabel per template)
    const tableConfig = _getTableConfig(tpl.TEMPLATE_ID, tpl.TEMPLATE_ID);

    const tableHtml = (typeof TableRenderer !== 'undefined')
      ? TableRenderer.render(
          cols,
          resolvedRows,
          { fitMode: 'auto', minRows: 5 },
          t.tableSize,
          tableConfig
        )
      : _fallbackSiswaTable(cols, resolvedRows, t.tableSize);

    /* ── Rekap ── */
    const laki   = siswa.filter(s => s.jenisKelamin === 'L').length;
    const perempuan = siswa.filter(s => s.jenisKelamin === 'P').length;
    const rekapHtml = `
      <div class="doc-rekap">
        <p style="margin-bottom:4pt;">Keadaan Siswa :</p>
        <table>
          <tr><td>Laki-laki</td><td>:</td><td><strong>${laki}</strong></td></tr>
          <tr><td>Perempuan</td><td>:</td><td><strong>${perempuan}</strong></td></tr>
          <tr><td><strong>Jumlah</strong></td><td>:</td><td><strong>${laki + perempuan}</strong></td></tr>
        </table>
      </div>`;

    /* ── Tanda Tangan ── */
    const ttdHtml = _buildTtdSiswa(ttd, meta, catatan);

    return `
      <div class="doc-content" style="${marginStyle}">
        ${kopHtml}
        <hr class="doc-kop-divider" />
        <hr class="doc-kop-divider-thin" />
        ${infoHtml}
        ${judulHtml}
        ${tableHtml}
        ${rekapHtml}
        ${ttdHtml}
      </div>`;
  }

  function _buildTtdSiswa(ttd, meta, catatan) {
    const kota  = ttd.kotaMadrasah || 'Musi Rawas';
    const tahun = ttd.tahun || meta.tahun || '';
    const kp    = ttd.kasiPenmad     || {};
    const pw    = ttd.pengawas       || {};
    const kkm   = ttd.indukKkm       || {};
    const km    = ttd.kepalaMadrasah || {};
    const kbm   = ttd.kepBidMapenda  || {};
    const kotaPalembang = ttd.kotaPalembang || 'Palembang';

    return `
      <div class="doc-ttd-section">
        <!-- Baris 1: 4 pihak -->
        <div class="doc-ttd-grid doc-ttd-grid--primary">
          <div class="doc-ttd-col">
            <p class="doc-ttd-col__place">${_esc(kp.label || 'Mengetahui,')}</p>
            <p class="doc-ttd-col__role">${_esc(kp.jabatan || 'Kasi Penmad / Pendis')}</p>
            <div class="doc-ttd-col__space"></div>
            <p class="doc-ttd-col__name">${_esc(kp.nama) || '.............................'}</p>
            <p class="doc-ttd-col__nip">NIP. ${_esc(kp.nip) || '-'}</p>
          </div>
          <div class="doc-ttd-col">
            <p class="doc-ttd-col__place">${_esc(pw.label || 'Mengetahui,')}</p>
            <p class="doc-ttd-col__role">${_esc(pw.jabatan || 'Pengawas')}</p>
            <div class="doc-ttd-col__space"></div>
            <p class="doc-ttd-col__name">${_esc(pw.nama) || '.............................'}</p>
            <p class="doc-ttd-col__nip">NIP. ${_esc(pw.nip) || '-'}</p>
          </div>
          <div class="doc-ttd-col">
            <p class="doc-ttd-col__place">${_esc(kkm.label || 'Mengetahui,')}</p>
            <p class="doc-ttd-col__role">${_esc(kkm.jabatan || 'Induk KKM')}</p>
            <div class="doc-ttd-col__space"></div>
            <p class="doc-ttd-col__name">${_esc(kkm.nama) || '.............................'}</p>
            <p class="doc-ttd-col__nip">NIP. ${_esc(kkm.nip) || '-'}</p>
          </div>
          <div class="doc-ttd-col">
            <p class="doc-ttd-col__place">${_esc(kota)}, ${_esc(tahun)}</p>
            <p class="doc-ttd-col__role">${_esc(km.jabatan || 'Kepala Madrasah,')}</p>
            <div class="doc-ttd-col__space"></div>
            <p class="doc-ttd-col__name">${_esc(km.nama) || '.............................'}</p>
            <p class="doc-ttd-col__nip">NIP. ${_esc(km.nip) || '-'}</p>
          </div>
        </div>

        <!-- Baris 2: Catatan, Katim Kesiswaan, dan Kepala Bidang Mapenda -->
        <div class="doc-ttd-grid doc-ttd-grid--secondary">
            <div class="doc-ttd-col doc-ttd-col--catatan">
              ${_buildCatatanHtml(catatan)}
            </div>
            <div class="doc-ttd-col" style="text-align:center;">
              <p>Mengesahkan,</p>
              <p>Katim Kesiswaan,</p>
              <br/><br/><br/>
              <p style="text-decoration:underline;font-weight:bold;">
                ${_esc(ttd.katimKesiswaan?.nama) || '.............................'}
              </p>
              <p>NIP. ${_esc(ttd.katimKesiswaan?.nip) || '-'}</p>
            </div>
            <div class="doc-ttd-col" style="text-align:center;">
              <p>${_esc(kotaPalembang)}, ____________________</p>
              <p>Mengesahkan,</p>
              <p>Kepala Bidang Mapenda</p>
              <p>Kasi MTs/MA</p>
              <br/><br/><br/>
              <p style="text-decoration:underline;font-weight:bold;">
                ${_esc(kbm.nama) || '.............................'}
              </p>
              <p>NIP. ${_esc(kbm.nip) || '-'}</p>
            </div>
        </div>
      </div>`;
  }

  /* ────────────────────────────────────────────────
     CATATAN + PAGINATION PREVIEW
  ──────────────────────────────────────────────── */

  function _buildCatatanHtml(catatan) {
    if (!catatan?.tampilkan || !Array.isArray(catatan.items) || !catatan.items.length) {
      return '';
    }
    const items = catatan.items.map(it => `<li>${_esc(it)}</li>`).join('');
    return `
      <div class="doc-catatan">
        <p class="doc-catatan__title">Catatan:</p>
        <ol class="doc-catatan__list">${items}</ol>
      </div>`;
  }

  function _schedulePagination(renderToken, paperWidthPx, paperHeightPx) {
    const afterLayout = new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    _paginationPromise = afterLayout
      .then(() => _paginatePreview(renderToken, paperWidthPx, paperHeightPx))
      .catch(err => {
        console.warn('[PreviewRenderer] Pagination gagal:', err);
        if (renderToken === _renderToken) {
          _updateWrapperHeight(_currentZoom);
          if (typeof DocumentViewer !== 'undefined') DocumentViewer.refresh();
        }
      });

    return _paginationPromise;
  }

  async function _paginatePreview(renderToken, paperWidthPx, paperHeightPx) {
    if (renderToken !== _renderToken || !_previewEl) return;

    const source = _previewEl.querySelector(':scope > .doc-content');
    if (!source) return;

    // Reset hitungan halaman sebelum proses layout dimulai agar viewer tidak
    // membaca hasil render sebelumnya selama pagination berlangsung.
    _previewEl.dataset.pageCount = '0';

    await _waitForLayoutAssets(source);
    if (renderToken !== _renderToken) return;

    // DPU memiliki struktur tabel khusus (15 kolom + header 2 tingkat),
    // sehingga gunakan paginator khusus agar pembagian baris dan header tetap
    // deterministik tanpa mengubah engine template lain.
    if (State.getActiveTemplate() === 'dpu') {
      await _paginateDpuPreview(source, renderToken, paperWidthPx, paperHeightPx);
      return;
    }

    const baseStyle = source.getAttribute('style') || '';
    const children = Array.from(source.children);
    const pages = [];

    _previewEl.innerHTML = '';

    let current = _createPreviewPage(
      pages.length + 1, paperWidthPx, paperHeightPx, baseStyle, children.length === 0
    );
    _previewEl.appendChild(current.page);
    pages.push(current);

    for (const child of children) {
      if (renderToken !== _renderToken) return;

      if (child.matches('.doc-table-wrap')) {
        await _appendTableWithPagination(
          child, current, pages, paperWidthPx, paperHeightPx, baseStyle, renderToken
        );
        current = pages[pages.length - 1];
        continue;
      }

      current.content.appendChild(child);
      if (_isPageOverflowing(current.content) && current.content.children.length > 1) {
        current.content.removeChild(child);
        current = _appendNewPreviewPage(pages, paperWidthPx, paperHeightPx, baseStyle);
        current.content.appendChild(child);
      }
    }

    _applyPageNumbering(pages);

    _previewEl.dataset.pageCount = String(pages.length);

    // Aktifkan mode dokumen setelah seluruh halaman selesai dipaginasi.
    // Dengan demikian pengukuran source berlangsung pada lebar/tinggi halaman
    // fisik yang sama dengan .surat-page.
    _previewEl.classList.add('surat-preview--document');
    _updatePageInfo(pages.length);
    _updateWrapperHeight(_currentZoom);

    // Sinkronkan viewer setelah seluruh .surat-page benar-benar terbentuk.
    if (typeof DocumentViewer !== 'undefined') DocumentViewer.refresh();

    requestAnimationFrame(() => {
      if (renderToken !== _renderToken) return;
      if (typeof Settings !== 'undefined') {
        const sv = State.getSettings().preview;
        if (sv.showMarginGuide)   _reApplyMarginGuide(sv.showMarginGuide);
        if (sv.showPrintableArea) _reApplyPrintableArea(sv.showPrintableArea);
      }
    });
  }


  async function _paginateDpuPreview(source, renderToken, paperWidthPx, paperHeightPx) {
    if (renderToken !== _renderToken || !_previewEl) return;

    const baseStyle = source.getAttribute('style') || '';
    const children = Array.from(source.children);
    const tableIndex = children.findIndex(el => el.matches('.doc-table-wrap'));
    const tableWrap = tableIndex >= 0 ? children[tableIndex] : null;

    /*
     * DPU mempunyai satu struktur linear:
     *   KOP + metadata + judul → tabel peserta → tanda tangan.
     *
     * Header sebelum tabel hanya boleh berada pada halaman pertama.
     * Tabel dipaginasi per-row dan setiap fragment tabel mengulang <thead>.
     * Blok setelah tabel diperlakukan sebagai satu unit logis.
     */
    if (!tableWrap) {
      return _paginatePreviewGeneric(
        source,
        children,
        renderToken,
        paperWidthPx,
        paperHeightPx,
        baseStyle
      );
    }

    const before = children.slice(0, tableIndex);
    const after = children.slice(tableIndex + 1);

    _previewEl.innerHTML = '';
    _previewEl.dataset.pageCount = '0';

    const pages = [];

    const createPage = () => {
      const pageState = _createPreviewPage(
        pages.length + 1,
        paperWidthPx,
        paperHeightPx,
        baseStyle
      );
      pageState.content.classList.add('doc-content--dpu');
      _previewEl.appendChild(pageState.page);
      pages.push(pageState);
      return pageState;
    };

    /*
     * Tambahkan blok atomik. Bila tidak muat dan halaman sudah berisi konten,
     * pindahkan seluruh blok ke halaman berikutnya. Bila blok sendiri lebih
     * tinggi dari satu halaman, biarkan utuh agar tidak dipotong/clipped.
     */
    const appendAtomic = (pageState, node) => {
      pageState.content.appendChild(node);
      _forceLayout(node);

      if (_fitsOnPage(pageState.content, node)) return pageState;

      pageState.content.removeChild(node);

      if (pageState.content.children.length === 0) {
        pageState.content.appendChild(node);
        _forceLayout(node);
        return pageState;
      }

      pageState = createPage();
      pageState.content.appendChild(node);
      _forceLayout(node);
      return pageState;
    };

    let current = createPage();

    /*
     * KOP + metadata + judul adalah header DPU halaman pertama.
     * Jangan memindahkan bagian-bagiannya ke halaman berikutnya karena hal itu
     * dapat membuat halaman 2 dimulai dengan KOP/metadata tanpa konteks.
     */
    for (const child of before) {
      if (renderToken !== _renderToken) return;
      current.content.appendChild(child);
      _forceLayout(child);
    }

    const table = tableWrap.querySelector(':scope > table');
    const tbody = table?.querySelector(':scope > tbody');

    if (!table || !tbody) {
      current = appendAtomic(current, tableWrap);
    } else {
      const rows = Array.from(tbody.rows);
      const tableTemplate = table.cloneNode(true);
      const templateBody = tableTemplate.querySelector(':scope > tbody');

      if (!templateBody) {
        current = appendAtomic(current, tableWrap);
      } else {
        templateBody.innerHTML = '';

        let fragmentWrap = null;
        let fragmentTable = null;
        let fragmentBody = null;

        const createTableFragment = (pageState) => {
          const wrap = tableWrap.cloneNode(false);
          const tableClone = tableTemplate.cloneNode(true);
          const body = tableClone.querySelector(':scope > tbody');

          if (!body) return null;

          body.innerHTML = '';
          wrap.appendChild(tableClone);
          pageState.content.appendChild(wrap);

          _forceLayout(tableClone);

          return {
            wrap,
            table: tableClone,
            body,
          };
        };

        /*
         * Tabel tanpa baris tetap menampilkan header satu kali, tetapi tidak
         * boleh membuat halaman kosong tambahan.
         */
        if (rows.length === 0) {
          const emptyFragment = createTableFragment(current);
          if (emptyFragment) {
            fragmentWrap = emptyFragment.wrap;
            fragmentTable = emptyFragment.table;
            fragmentBody = emptyFragment.body;

            if (!_fitsOnPage(current.content, fragmentWrap)) {
              current.content.removeChild(fragmentWrap);
              current = createPage();

              const movedFragment = createTableFragment(current);
              if (movedFragment) {
                fragmentWrap = movedFragment.wrap;
                fragmentTable = movedFragment.table;
                fragmentBody = movedFragment.body;
              }
            }
          }
        } else {
          for (const row of rows) {
            if (renderToken !== _renderToken) return;

            if (!fragmentWrap) {
              const fragment = createTableFragment(current);
              if (!fragment) {
                current = appendAtomic(current, tableWrap);
                break;
              }
              fragmentWrap = fragment.wrap;
              fragmentTable = fragment.table;
              fragmentBody = fragment.body;
            }

            const candidate = row.cloneNode(true);
            fragmentBody.appendChild(candidate);

            /*
             * Memaksa browser menghitung ulang tinggi row setelah text wrapping,
             * font, dan lebar kolom diterapkan.
             */
            _forceLayout(candidate);
            _forceLayout(fragmentTable);

            if (_fitsOnPage(current.content, fragmentWrap)) {
              continue;
            }

            /*
             * Candidate tidak muat. Row yang sudah lolos tetap berada di page
             * sebelumnya; hanya candidate yang dipindahkan.
             */
            fragmentBody.removeChild(candidate);

            if (fragmentBody.rows.length === 0) {
              current.content.removeChild(fragmentWrap);
            }

            current = createPage();

            const nextFragment = createTableFragment(current);
            if (!nextFragment) {
              current.content.appendChild(candidate);
              _forceLayout(candidate);
              continue;
            }

            fragmentWrap = nextFragment.wrap;
            fragmentTable = nextFragment.table;
            fragmentBody = nextFragment.body;

            fragmentBody.appendChild(candidate);
            _forceLayout(candidate);
            _forceLayout(fragmentTable);
          }
        }
      }
    }

    /*
     * Tanda tangan adalah satu blok logis. Bila tidak tersedia ruang tersisa,
     * seluruh blok dipindahkan ke halaman berikutnya, bukan dipotong.
     */
    for (const child of after) {
      if (renderToken !== _renderToken) return;
      current = appendAtomic(current, child);
    }

    _finalizePagination(pages, renderToken);
  }


  function _appendTtdSectionWithPagination(section, current, pages, paperWidthPx, paperHeightPx, baseStyle, renderToken) {
    if (!section || !current || renderToken !== _renderToken) return current;

    const rows = Array.from(section.children)
      .filter(child => child.matches('.doc-ttd-grid'));

    // Fallback untuk struktur lama atau section kosong.
    if (!rows.length) {
      current.content.appendChild(section);
      _forceLayout(section);

      if (_fitsOnPage(current.content, section) || current.content.children.length === 1) {
        return current;
      }

      current.content.removeChild(section);
      current = _appendNewPreviewPage(pages, paperWidthPx, paperHeightPx, baseStyle);
      current.content.appendChild(section);
      _forceLayout(section);
      return current;
    }

    rows.forEach((row, index) => {
      if (renderToken !== _renderToken) return;

      /*
       * Setiap baris ditempatkan di wrapper .doc-ttd-section sendiri agar
       * margin/layout tanda tangan tetap konsisten meskipun baris terpisah
       * ke halaman berbeda.
       *
       * Baris pertama mempertahankan margin-top section. Untuk baris lanjutan,
       * margin-top section dihilangkan karena .doc-ttd-grid--secondary sendiri
       * sudah mempunyai jarak vertikal.
       */
      const rowSection = section.cloneNode(false);
      if (index > 0) rowSection.style.marginTop = '0';
      rowSection.appendChild(row);
      current.content.appendChild(rowSection);

      _forceLayout(row);
      _forceLayout(rowSection);

      if (_fitsOnPage(current.content, rowSection)) return;

      current.content.removeChild(rowSection);

      /*
       * Bila baris lebih tinggi dari ruang satu halaman penuh, jangan putus
       * grid menjadi bagian-bagian kecil. Pertahankan sebagai satu blok pada
       * halaman baru agar tetap terbaca.
       */
      if (current.content.children.length === 0) {
        current.content.appendChild(rowSection);
        _forceLayout(rowSection);
        return;
      }

      current = _appendNewPreviewPage(
        pages,
        paperWidthPx,
        paperHeightPx,
        baseStyle
      );

      current.content.appendChild(rowSection);
      _forceLayout(rowSection);
    });

    return current;
  }

  function _paginatePreviewGeneric(source, children, renderToken, paperWidthPx, paperHeightPx, baseStyle) {
    const pages = [];
    _previewEl.innerHTML = '';

    let current = _createPreviewPage(
      pages.length + 1,
      paperWidthPx,
      paperHeightPx,
      baseStyle,
      children.length === 0
    );
    _previewEl.appendChild(current.page);
    pages.push(current);

    return (async () => {
      for (const child of children) {
        if (renderToken !== _renderToken) return;

        if (child.matches('.doc-table-wrap')) {
          await _appendTableWithPagination(
            child,
            current,
            pages,
            paperWidthPx,
            paperHeightPx,
            baseStyle,
            renderToken
          );
          current = pages[pages.length - 1];
          continue;
        }

        /*
         * Tanda tangan Mutasi Siswa/Siswa Baru terdiri dari dua grid yang
         * masing-masing harus dipaginasi sebagai blok atomik terpisah.
         *
         * Dengan cara ini, baris pertama (4 tanda tangan) tetap ditempatkan
         * pada halaman saat ini selama masih muat. Hanya baris yang benar-benar
         * tidak muat yang dipindahkan ke halaman berikutnya.
         */
        if (child.matches('.doc-ttd-section')) {
          current = _appendTtdSectionWithPagination(
            child,
            current,
            pages,
            paperWidthPx,
            paperHeightPx,
            baseStyle,
            renderToken
          );
          continue;
        }

        current.content.appendChild(child);
        _forceLayout(child);

        if (_isPageOverflowing(current.content) && current.content.children.length > 1) {
          current.content.removeChild(child);
          current = _appendNewPreviewPage(
            pages,
            paperWidthPx,
            paperHeightPx,
            baseStyle
          );
          current.content.appendChild(child);
          _forceLayout(child);
        }
      }

      _finalizePagination(pages, renderToken);
    })();
  }

  function _finalizePagination(pages, renderToken) {
    if (renderToken !== _renderToken || !_previewEl) return;

    /*
     * Pastikan tidak pernah ada halaman kosong di belakang dokumen akibat
     * pagination. Halaman kosong hanya dipertahankan bila dokumen memang tidak
     * memiliki elemen konten sama sekali.
     */
    while (pages.length > 1) {
      const last = pages[pages.length - 1];
      const hasFlowContent = last.content.children.length > 0;

      // Nomor halaman dirender sebagai pseudo-element di .surat-page,
      // sehingga tidak menjadi bagian dari flow isi dokumen.
      if (hasFlowContent) break;

      last.page.remove();
      pages.pop();
    }

    const totalPages = pages.length;

    _applyPageNumbering(pages);

    _previewEl.dataset.pageCount = String(totalPages);
    _previewEl.classList.add('surat-preview--document');
    _updatePageInfo(pages.length);
    _updateWrapperHeight(_currentZoom);

    if (typeof DocumentViewer !== 'undefined') {
      DocumentViewer.refresh();
    }

    requestAnimationFrame(() => {
      if (renderToken !== _renderToken) return;
      if (typeof Settings === 'undefined') return;

      const sv = State.getSettings().preview;
      if (sv.showMarginGuide) _reApplyMarginGuide(sv.showMarginGuide);
      else _reApplyMarginGuide(false);

      if (sv.showPrintableArea) _reApplyPrintableArea(sv.showPrintableArea);
      else _reApplyPrintableArea(false);
    });
  }

  function _applyPageNumberStyles(page, pageNumberSettings, margin) {
    if (!page) return;

    const settings = pageNumberSettings || {};
    const m = margin || State.getMarginMm();
    const fontFamily = String(settings.fontFamily || 'Times New Roman')
      .replace(/'/g, "\\'");

    // Alignment kiri/kanan mengikuti tepat margin isi surat.
    page.style.setProperty('--page-number-display', settings.enabled !== false ? 'block' : 'none');
    page.style.setProperty('--page-number-left', `${Number(m.left ?? 25)}mm`);
    page.style.setProperty('--page-number-right', `${Number(m.right ?? 25)}mm`);
    page.style.setProperty('--page-number-bottom', `${Number(settings.bottomOffset ?? 5)}mm`);
    page.style.setProperty('--page-number-font-family', `'${fontFamily}', serif`);
    page.style.setProperty('--page-number-font-size', `${Number(settings.fontSize ?? 8)}pt`);
    page.style.setProperty('--page-number-color', String(settings.color || '#000000'));
    page.style.setProperty('--page-number-font-weight', settings.bold ? '700' : '400');
    page.style.setProperty('--page-number-font-style', settings.italic ? 'italic' : 'normal');
    page.style.setProperty('--page-number-text-decoration', settings.underline ? 'underline' : 'none');
    page.style.setProperty('--page-number-text-align', ['left', 'right'].includes(settings.alignment)
      ? settings.alignment
      : 'center');
  }

  function _syncPageNumberSettings(pageNumberSettings = State.getSettings().pageNumber) {
    if (!_previewEl || !pageNumberSettings) return;

    const pages = Array.from(_previewEl.querySelectorAll(':scope > .surat-page[data-page-count]'));
    if (!pages.length) return;

    const margin = State.getMarginMm();
    pages.forEach(page => _applyPageNumberStyles(page, pageNumberSettings, margin));
  }

  function _applyPageNumberNumbering(pages) {
    const totalPages = Array.isArray(pages) ? pages.length : 0;
    if (!totalPages) return;

    const pageNumberSettings = State.getSettings().pageNumber || {};
    const margin = State.getMarginMm();

    pages.forEach((pageState, index) => {
      if (!pageState?.page) return;

      const pageNumber = index + 1;
      const page = pageState.page;

      page.dataset.pageNumber = String(pageNumber);
      page.dataset.pageCount = String(totalPages);
      page.setAttribute('aria-label', `Halaman ${pageNumber} dari ${totalPages}`);
      _applyPageNumberStyles(page, pageNumberSettings, margin);
    });
  }

  // Backward-compatible internal name used by the pagination pipeline.
  function _applyPageNumbering(pages) {
    _applyPageNumberNumbering(pages);
  }

  function _forceLayout(node) {
    if (!node) return 0;

    /*
     * offsetHeight/scrollHeight dipakai hanya untuk memaksa reflow. Nilai
     * visual final tetap diukur oleh getBoundingClientRect() pada helper fit.
     */
    const height = node.offsetHeight;
    void node.scrollHeight;
    return height;
  }

  function _getPageContentBottom(content) {
    if (!content) return 0;

    const rect = content.getBoundingClientRect();
    const cssHeight = content.offsetHeight || content.clientHeight || rect.height || 1;

    /*
     * getBoundingClientRect() sudah memperhitungkan transform zoom, sedangkan
     * padding dari getComputedStyle() berada dalam CSS pixel. Skala ini membuat
     * keduanya berada pada satu satuan sehingga batas bawah tetap akurat pada
     * zoom 30%–250%.
     */
    const scale = cssHeight > 0 ? rect.height / cssHeight : 1;
    const styles = getComputedStyle(content);
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;

    return rect.top + (cssHeight - paddingBottom) * scale;
  }

  function _fitsOnPage(content, node) {
    if (!content || !node) return true;

    _forceLayout(content);
    _forceLayout(node);

    const pageBottom = _getPageContentBottom(content);
    const nodeBottom = node.getBoundingClientRect().bottom;

    /*
     * +0.5px memberi toleransi rounding browser tanpa menciptakan ruang kosong
     * yang berarti pada akhir halaman.
     */
    return nodeBottom <= pageBottom + 0.5;
  }

  async function _waitForLayoutAssets(root) {
    if (document.fonts?.ready) await document.fonts.ready;

    const images = Array.from(root.querySelectorAll('img'));
    if (images.length) {
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      }));
    }

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function _createPreviewPage(pageNumber, paperWidthPx, paperHeightPx, baseStyle, empty = false) {
    const page = document.createElement('section');
    page.className = 'surat-page';
    page.dataset.pageNumber = String(pageNumber);
    page.setAttribute('aria-label', `Halaman ${pageNumber}`);
    page.style.width = `${paperWidthPx}px`;
    page.style.height = `${paperHeightPx}px`;

    const content = document.createElement('div');
    content.className = 'doc-content';
    if (baseStyle) content.setAttribute('style', baseStyle);
    page.appendChild(content);

    // Nomor halaman dirender oleh CSS pseudo-element pada .surat-page.
    // Tidak ada elemen footer fisik yang ikut dalam flow/pagination.
    if (empty) content.innerHTML = '&nbsp;';
    return { page, content };
  }

  function _appendNewPreviewPage(pages, paperWidthPx, paperHeightPx, baseStyle) {
    const current = _createPreviewPage(pages.length + 1, paperWidthPx, paperHeightPx, baseStyle);
    _previewEl.appendChild(current.page);
    pages.push(current);
    return current;
  }

  function _isPageOverflowing(content) {
    if (!content || !content.children.length) return false;

    _forceLayout(content);

    /*
     * scrollHeight/clientHeight adalah indikator layout CSS pixel yang tidak
     * terpengaruh transform zoom. Physical bounds menjadi fallback ketika
     * descendant overflow tidak tercermin sempurna pada scrollHeight.
     */
    const scrollOverflow = content.scrollHeight > content.clientHeight + 0.5;
    const lastChild = content.lastElementChild;
    if (!lastChild) return scrollOverflow;

    const measuredNode = lastChild.matches('.doc-table-wrap')
      ? (lastChild.querySelector(':scope > table') || lastChild)
      : lastChild;

    return scrollOverflow || !_fitsOnPage(content, measuredNode);
  }

  async function _appendTableWithPagination(tableWrap, current, pages, paperWidthPx, paperHeightPx, baseStyle, renderToken) {
    const table = tableWrap.querySelector(':scope > table');
    const tbody = table?.querySelector(':scope > tbody');

    if (!table || !tbody) {
      current.content.appendChild(tableWrap);
      if (_isPageOverflowing(current.content) && current.content.children.length > 1) {
        current.content.removeChild(tableWrap);
        current = _appendNewPreviewPage(pages, paperWidthPx, paperHeightPx, baseStyle);
        current.content.appendChild(tableWrap);
      }
      return;
    }

    const rows = Array.from(tbody.rows);
    const templateTable = table.cloneNode(true);
    const templateBody = templateTable.querySelector(':scope > tbody');
    if (!templateBody) {
      current.content.appendChild(tableWrap);
      return;
    }
    templateBody.innerHTML = '';

    let fragmentWrap = null;
    let fragmentBody = null;

    const beginFragment = () => {
      fragmentWrap = tableWrap.cloneNode(false);
      const fragmentTable = templateTable.cloneNode(true);
      fragmentBody = fragmentTable.querySelector(':scope > tbody');
      fragmentWrap.appendChild(fragmentTable);
      current.content.appendChild(fragmentWrap);
    };

    if (rows.length === 0) {
      beginFragment();
    }

    for (const row of rows) {
      if (renderToken !== _renderToken) return;
      if (!fragmentWrap) beginFragment();

      const rowClone = row.cloneNode(true);
      fragmentBody.appendChild(rowClone);

      if (_isPageOverflowing(current.content) && fragmentBody.rows.length > 1) {
        fragmentBody.removeChild(rowClone);
        current = _appendNewPreviewPage(pages, paperWidthPx, paperHeightPx, baseStyle);
        beginFragment();
        fragmentBody.appendChild(rowClone);
      } else if (_isPageOverflowing(current.content) && fragmentBody.rows.length === 1 && current.content.children.length > 1) {
        current.content.removeChild(fragmentWrap);
        current = _appendNewPreviewPage(pages, paperWidthPx, paperHeightPx, baseStyle);
        beginFragment();
        fragmentBody.appendChild(rowClone);
      }
    }
  }

  /* ────────────────────────────────────────────────
     FALLBACK TABLE RENDERERS
     Digunakan jika TableRenderer belum tersedia
     (cache lama, file gagal load, dll).
  ──────────────────────────────────────────────── */

  function _fallbackDpuTable(peserta, typo) {
    const ts = typo?.tableSize ?? 7.5;
    const emptyCount = Math.max(0, 5 - peserta.length);
    const rows = peserta.map((p, i) => `
      <tr>
        <td style="text-align:center;">${_esc(p.urt || i + 1)}</td>
        <td style="text-align:center;">${_esc(p.indk)}</td>
        <td style="text-align:center;">${_esc(p.nisn)}</td>
        <td>${_esc(p.registrasi)}</td>
        <td style="text-align:center;">${_esc(p.nik)}</td>
        <td>${_esc(p.namaSiswa)}</td>
        <td style="text-align:center;">${_esc(p.jenisKelamin)}</td>
        <td>${_esc(p.tempatLahir)}</td>
        <td style="text-align:center;">${p.tanggalLahir ? Utils.formatDateShort(p.tanggalLahir) : ''}</td>
        <td>${_esc(p.namaOrangTua)}</td>
        <td>${_esc(p.asalSekolah)}</td>
        <td>${_esc(p.noIjazah)}</td>
        <td style="text-align:center;">${p.terdaftarEmis !== false ? '☑' : ''}</td>
        <td style="text-align:center;">${p.terdaftarEmis === false ? '☐' : ''}</td>
        <td>${_esc(p.alasanBelum)}</td>
      </tr>`).join('');
    const empties = Array.from({ length: emptyCount }, () =>
      `<tr class="doc-empty-row">${Array(15).fill('<td>&nbsp;</td>').join('')}</tr>`
    ).join('');
    return `
      <div class="doc-table-wrap doc-table-wrap--full">
        <table class="doc-table doc-table--dpu" style="font-size:${ts}pt;">
          <thead>
            <tr>
              <th rowspan="2">URT</th><th rowspan="2">INDK</th>
              <th colspan="2">NOMOR</th>
              <th rowspan="2">NIK</th><th rowspan="2">NAMA SISWA</th>
              <th rowspan="2">L/P</th><th rowspan="2">TEMPAT LAHIR</th>
              <th rowspan="2">TANGGAL LAHIR</th><th rowspan="2">NAMA ORANG TUA</th>
              <th rowspan="2">ASAL SEKOLAH</th><th rowspan="2">No. IJAZAH</th>
              <th colspan="3">TERDAFTAR DI EMIS</th>
            </tr>
            <tr>
              <th>NISN</th><th>REGISTRASI</th>
              <th>SUDAH</th><th>BELUM</th><th>ALASAN</th>
            </tr>
          </thead>
          <tbody>${rows}${empties}</tbody>
        </table>
      </div>`;
  }

  function _fallbackSiswaTable(cols, rows, tableSize) {
    const ts = tableSize ?? 7.5;
    const theadCells = cols.map(c =>
      `<th style="text-align:${c.align};font-size:${ts}pt;">${_esc(c.header)}</th>`
    ).join('');
    const tbodyRows = rows.map(row => {
      const cells = cols.map(c =>
        `<td style="text-align:${c.align};font-size:${ts}pt;">${_esc(row[c.key] ?? '')}</td>`
      ).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    const emptyCount = Math.max(0, 5 - rows.length);
    const empties = Array.from({ length: emptyCount }, () =>
      `<tr class="doc-empty-row">${cols.map(() => '<td>&nbsp;</td>').join('')}</tr>`
    ).join('');
    return `
      <div class="doc-table-wrap">
        <table class="doc-table" style="font-size:${ts}pt;">
          <thead><tr>${theadCells}</tr></thead>
          <tbody>${tbodyRows}${empties}</tbody>
        </table>
      </div>`;
  }

  /* ── Re-apply overlay helpers (dipanggil post-render, tidak trigger state) ── */
  function _reApplyMarginGuide(show) {
    const preview = _previewEl;
    if (!preview) return;
    let guide = preview.querySelector('.margin-guide-overlay');
    if (!show) { guide?.remove(); return; }
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'margin-guide-overlay';
      guide.setAttribute('aria-hidden', 'true');
      preview.appendChild(guide);
    }
    const m = State.getMarginMm();
    const PX = 96 / 25.4;
    guide.style.top    = `${m.top    * PX}px`;
    guide.style.right  = `${m.right  * PX}px`;
    guide.style.bottom = `${m.bottom * PX}px`;
    guide.style.left   = `${m.left   * PX}px`;
  }

  function _reApplyPrintableArea(show) {
    const preview = _previewEl;
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

  /* ── Zoom ── */
  function _changeZoom(delta) {
    const newZoom = Utils.clamp(_currentZoom + delta, ZOOM_MIN, ZOOM_MAX);
    _currentZoom = newZoom;
    State.setZoom(newZoom);
    _applyZoom(newZoom);
  }

  function _setZoomMode(mode) {
    const viewport = _viewportEl || document.getElementById('preview-viewport');
    const preview = _previewEl;
    if (!viewport || !preview) return;

    const vpW = viewport.clientWidth || 800;
    const vpH = viewport.clientHeight || 600;
    const dimensions = State.getPaperDimensions();
    const paperW = (dimensions.widthMm || 210) * PX_PER_MM;
    const paperH = (dimensions.heightMm || 297) * PX_PER_MM;

    let zoom = 1;
    if (mode === 'fit-page') {
      const scaleW = (vpW - 48) / paperW;
      const scaleH = (vpH - 48) / paperH;
      zoom = Math.min(scaleW, scaleH, 1);
    } else if (mode === 'fit-width') {
      zoom = Math.min((vpW - 48) / paperW, 1.5);
    }

    zoom = Utils.clamp(zoom, ZOOM_MIN, ZOOM_MAX);
    State.setSettings({ preview: { zoom: mode } });
    State.setZoom(zoom);
  }

  function _updatePageInfo(count) {
    if (!_pageInfoEl) return;
    const safeCount = Math.max(0, Number(count) || 0);
    _pageInfoEl.textContent = safeCount > 0
      ? (safeCount + ' halaman')
      : 'Belum ada halaman';
  }

  function _applyZoom(zoom) {
    if (_wrapperEl) {
      _wrapperEl.style.transform = `scale(${zoom})`;
      _wrapperEl.style.transformOrigin = 'top center';
    }
    if (_zoomLevelEl) {
      _zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
    }
    // Height update dilakukan via requestAnimationFrame di render(),
    // atau langsung jika dipanggil dari zoom button
    requestAnimationFrame(() => _updateWrapperHeight(zoom));
  }

  function _updateWrapperHeight(zoom) {
    if (!_wrapperEl || !_previewEl) return;
    const naturalH = _previewEl.scrollHeight || _previewEl.offsetHeight || 0;
    if (naturalH > 0) {
      // Beri ruang ekstra agar konten tidak terpotong
      _wrapperEl.style.height = `${Math.ceil(naturalH * zoom) + 48}px`;
    }
  }

  /* ── Placeholder ── */
  function _showPlaceholder() {
    if (!_previewEl) return;

    // Batalkan pagination/render async yang masih berjalan sebelum placeholder
    // dipasang, agar hasil render lama tidak muncul kembali.
    _renderToken += 1;
    _previewEl.classList.remove('surat-preview--document', 'orientation-landscape');
    _previewEl.dataset.pageCount = '0';
    _previewEl.style.width = '';
    _previewEl.style.minHeight = '';
    if (_wrapperEl) {
      _wrapperEl.style.width = '';
      _wrapperEl.style.height = '';
      _wrapperEl.style.transform = `scale(${_currentZoom})`;
    }

    _updatePageInfo(0);
    _previewEl.innerHTML = `
      <div class="preview-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <p>Preview surat akan muncul di sini setelah template dipilih dan data diisi.</p>
      </div>`;
  }

  /* ── Ambil tableConfig yang sudah resolved dari State + TableConfigManager ── */
  function _getTableConfig(templateId, tableId) {
    if (!templateId || !tableId) return null;
    if (typeof TableConfigManager === 'undefined') return null;
    try {
      const cfg = TableConfigManager.getResolvedConfig(templateId, tableId);
      return cfg || null;
    } catch (e) {
      console.warn('[PreviewRenderer] Gagal mengambil tableConfig:', e);
      return null;
    }
  }

  /* ────────────────────────────────────────────────
     RENDERER: IJOP — Helper bersama
  ──────────────────────────────────────────────── */

  /** Format ISO date → "14 Oktober 2026" (panjang, Indonesia) */
  function _formatTanggalPanjang(isoDate) {
    if (!isoDate) return '…………….';
    const bulan = [
      'Januari','Februari','Maret','April','Mei','Juni',
      'Juli','Agustus','September','Oktober','November','Desember',
    ];
    const parts = isoDate.split('-');
    if (parts.length < 3) return isoDate;
    const [yyyy, mm, dd] = parts;
    const idx = parseInt(mm, 10) - 1;
    if (idx < 0 || idx > 11) return isoDate;
    return `${parseInt(dd, 10)} ${bulan[idx]} ${yyyy}`;
  }

  /**
   * Ambil nama bulan Indonesia dan tahun dari ISO date.
   * Contoh: "2026-10-14" → "Oktober 2026"
   */
  function _formatBulanTahun(isoDate) {
    if (!isoDate) return '…………….';
    const bulan = [
      'Januari','Februari','Maret','April','Mei','Juni',
      'Juli','Agustus','September','Oktober','November','Desember',
    ];
    const parts = isoDate.split('-');
    if (parts.length < 2) return isoDate;
    const idx = parseInt(parts[1], 10) - 1;
    if (idx < 0 || idx > 11) return isoDate;
    return `${bulan[idx]} ${parts[0]}`;
  }

  /** Baris info standar surat dinas (Nama, NIP, Pangkat, Jabatan) */
  function _buildInfoPejabatHtml(fields) {
    // fields: [{label, value}]
    // Hanya tampilkan placeholder jika value null/undefined, bukan string kosong.
    const rows = fields.map(f => {
      const displayVal = (f.value != null && f.value !== '')
        ? _esc(f.value)
        : _esc('…………………………………………');
      return `<tr>
        <td style="white-space:nowrap;padding-right:4mm;">${_esc(f.label)}</td>
        <td style="padding-right:2mm;">:</td>
        <td>${displayVal}</td>
      </tr>`;
    }).join('');
    return `<table style="border-collapse:collapse;margin-bottom:8pt;">${rows}</table>`;
  }

  /* ────────────────────────────────────────────────
     RENDERER: IJOP 1 — Surat Permohonan dari Lembaga
  ──────────────────────────────────────────────── */
  function _renderIjopPermohonan(data, kop, margin, typo) {
    const s   = data?.surat   || {};
    const l   = data?.lembaga || {};
    const k   = data?.kepala  || {};
    const m   = margin || State.getMarginMm();
    const t   = typo   || State.getTypography();

    const marginStyle = `padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;`
      + `font-family:'${t.fontFamily}',serif;font-size:${t.fontSize}pt;line-height:${t.lineHeight};`;

    const kopHtml = _buildKopHtml(kop);

    return `
      <div class="doc-content" style="${marginStyle}">
        ${kopHtml}
        <hr class="doc-kop-divider" />
        <hr class="doc-kop-divider-thin" />

        <!-- Nomor, Lampiran, Perihal + Tanggal -->
        <table style="width:100%;border-collapse:collapse;margin-top:12pt;">
          <tr>
            <td style="width:55%;">
              <table style="border-collapse:collapse;">
                <tr><td style="width:90px;">Nomor</td><td style="padding:0 6px;">:</td><td style="white-space:pre-wrap;">${s.nomor ? _esc(s.nomor) : '………………………..'}</td></tr>
                <tr><td>Lampiran</td><td style="padding:0 6px;">:</td><td>7 (tujuh) lembar</td></tr>
                <tr><td>Perihal</td><td style="padding:0 6px;">:</td><td><strong>Permohonan Perpanjangan izin Operasional Lembaga Pendidikan</strong></td></tr>
              </table>
            </td>
            <td style="text-align:left;vertical-align:top;">
              ${s.namaKabupatenKota ? _esc(s.namaKabupatenKota) : '………………….'}, ${_formatBulanTahun(s.tanggal)}
            </td>
          </tr>
        </table>

        <!-- Tujuan Surat -->
        <div style="margin-top:16pt;">
          <p style="margin:0;">Kepada</p>
          <p style="margin:0;">Yth. Kepala Kantor Kementerian Agama Kabupaten Musi Rawas</p>
          <p style="margin:0;">Cq. Kepala Seksi Pendidikan Madrasah</p>
          <p style="margin:0;">di</p>
          <p style="margin:0;"><strong>Muara Beliti</strong></p>
        </div>

        <!-- Pembuka -->
        <div style="margin-top:16pt;">
          <p style="margin:0 0 8pt 0;"><em>Assalamu'alaikum Wr.Wb</em></p>
          <p style="margin:0 0 8pt 0;text-align:justify;">
            Sehubungan dengan habisnya masa berlaku izin pendirian madrasah kami, dengan hormat bersama ini
            kami sampaikan permohonan perpanjangan izin operasional/pendirian RA/Madrasah :
          </p>
        </div>

        <!-- Data Lembaga -->
        <table style="border-collapse:collapse;margin-left:20pt;margin-bottom:12pt;">
          <tr><td style="width:160px;">Nama RA/Madrasah</td><td style="padding:0 6px;">:</td><td>${l.namaRaMadrasah ? _esc(l.namaRaMadrasah) : '……………'}</td></tr>
          <tr><td>NSM</td><td style="padding:0 6px;">:</td><td>${l.nsm ? _esc(l.nsm) : '……………'}</td></tr>
          <tr><td>NPSN</td><td style="padding:0 6px;">:</td><td>${l.npsn ? _esc(l.npsn) : '……………'}</td></tr>
          <tr><td>Alamat</td><td style="padding:0 6px;">:</td><td>${l.alamat ? _esc(l.alamat) : '……………'}</td></tr>
          <tr><td>Akte Notaris</td><td style="padding:0 6px;">:</td><td>${l.akteNotaris ? _esc(l.akteNotaris) : '……………'}</td></tr>
          <tr><td>Pengesahan Akte Notaris</td><td style="padding:0 6px;">:</td><td>${l.pengesahanAkteNotaris ? _esc(l.pengesahanAkteNotaris) : '……………'}</td></tr>
          <tr><td>Peringkat Akreditasi</td><td style="padding:0 6px;">:</td><td>${l.peringkatAkreditasi ? _esc(l.peringkatAkreditasi) : '……………'}</td></tr>
        </table>

        <!-- Persyaratan -->
        <p style="margin:0 0 6pt 0;text-align:justify;">
          Sebagai bahan pertimbangan, bersama ini kami lampirkan kelengkapan persyaratan yang ditetapkan sebagai berikut :
        </p>
        <ol style="margin:0 0 12pt 20pt;padding:0;">
          <li>Surat Permohonan Perpanjangan Izin Operasional dari Lembaga Pendidikan</li>
          <li>Surat Pertanggungjawaban Mutlak (SPTJM) dari Lembaga Pendidikan (bermeterai Rp 10.000)</li>
          <li>Surat Rekomendasi Kelayakan dari Pengawas Madrasah</li>
          <li>SK Izin Operasional sebelumnya</li>
          <li>Fotocopy Sertifikat Akreditasi dari BAN PDM</li>
        </ol>

        <!-- Penutup -->
        <p style="margin:0 0 8pt 0;text-align:justify;">
          Demikian permohonan ini disampaikan, atas perhatiannya dan dikabulkannya permohonan kami
          diucapkan terima kasih.
        </p>
        <p style="margin:0;"><em>Wassalamu'alaikum Wr.Wb.</em></p>

        <!-- Tanda Tangan -->
        <div style="margin-top:24pt;display:flex;justify-content:flex-end;">
          <div style="text-align:center;min-width:150px;">
            <p style="margin:0;">${k.jabatan ? _esc(k.jabatan) : 'Kepala RA/Madrasah…………..'}</p>
            <div style="height:50pt;"></div>
            <p style="margin:0;text-decoration:underline;font-weight:bold;">${k.namaKepala ? _esc(k.namaKepala) : '…………………………….'}</p>
          </div>
        </div>
      </div>`;
  }

  /* ────────────────────────────────────────────────
     RENDERER: IJOP 2 — SPTJM dari Kepala Satpen
  ──────────────────────────────────────────────── */
  function _renderIjopSptjmSatpen(data, kop, margin, typo) {
    const s  = data?.surat  || {};
    const kp = data?.kepala || {};
    const m  = margin || State.getMarginMm();
    const t  = typo   || State.getTypography();

    const marginStyle = `padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;`
      + `font-family:'${t.fontFamily}',serif;font-size:${t.fontSize}pt;line-height:${t.lineHeight};`;

    const kopHtml = _buildKopHtml(kop);

    return `
      <div class="doc-content" style="${marginStyle}">
        ${kopHtml}
        <hr class="doc-kop-divider" />
        <hr class="doc-kop-divider-thin" />

        <!-- Judul -->
        <div style="text-align:center;margin:14pt 0 4pt 0;">
          <p style="margin:0;font-weight:bold;font-size:inherit;">SURAT PERNYATAAN TANGGUNG JAWAB MUTLAK</p>
          <p style="margin:4pt 0 0 0;white-space:pre-wrap;">Nomor : ${s.nomor ? _esc(s.nomor) : '…………………………'}</p>
        </div>

        <!-- Pembuka -->
        <p style="margin:14pt 0 8pt 0;">Yang bertandatangan dibawah ini :</p>

        <!-- Data Kepala -->
        ${_buildInfoPejabatHtml([
          { label: 'Nama',                    value: kp.nama },
          { label: 'Jabatan',                 value: kp.jabatan },
          { label: 'Tempat dan tanggal lahir',value: kp.tempatTanggalLahir },
          { label: 'Pekerjaan',               value: kp.pekerjaan },
          { label: 'NIK',                     value: kp.nik },
          { label: 'Alamat Domisili',         value: kp.alamatDomisili },
          { label: 'Telepon',                 value: kp.telepon },
        ])}

        <!-- Isi Pernyataan -->
        <p style="margin:0 0 8pt 0;text-align:justify;">
          Sehubungan dengan pengajuan permohonan perpanjangan izin pendirian RA/Madrasah,
          dengan ini menyatakan dengan sesungguhnya bahwa :
        </p>
        <ol style="margin:0 0 12pt 20pt;padding:0;">
          <li style="margin-bottom:6pt;text-align:justify;">
            Semua informasi dan dokumen yang saya sampaikan sebagaimana tersebut di atas adalah valid dan benar.
          </li>
          <li style="text-align:justify;">
            Apabila dikemudian hari ditemukan penipuan/pemalsuan/penyalahgunaan atas informasi dan/atau
            dokumen yang saya sampaikan tersebut, saya bertanggungjawab mutlak secara hukum dan bersedia
            dikenakan sanksi hukum sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.
          </li>
        </ol>

        <!-- Penutup -->
        <p style="margin:0 0 20pt 0;text-align:justify;">
          Demikian surat pernyataan ini saya buat dengan sebenarnya untuk dapat dipergunakan
          sebagaimana mestinya.
        </p>

        <!-- Meterai + TTD -->
        <div style="display:flex;justify-content:flex-end;">
          <div style="text-align:center;min-width:160px;">
            <p style="margin:0;">${s.namaDesa ? _esc(s.namaDesa) : '…………………'}, ${_formatBulanTahun(s.tanggal)}</p>
            <p style="margin:4pt 0 0 0;">Yang menyatakan,</p>
            <div style="border:1px solid #aaa;border-radius:50%;width:52px;height:52px;margin:8pt auto;display:flex;align-items:center;justify-content:center;font-size:7pt;color:#666;text-align:center;line-height:1.2;">
              Meterai<br/>Rp 10.000,-
            </div>
            <div style="height:14pt;"></div>
            <p style="margin:0;text-decoration:underline;font-weight:bold;">${kp.nama ? _esc(kp.nama) : '………………………………'}</p>
          </div>
        </div>
      </div>`;
  }

  /* ────────────────────────────────────────────────
     RENDERER: IJOP 3 — Rekomendasi dari Pengawas
  ──────────────────────────────────────────────── */
  function _renderIjopRekomendasiPengawas(data, kop, margin, typo) {
    const s   = data?.surat             || {};
    const pw  = data?.pengawas          || {};
    const l   = data?.lembaga           || {};
    const pn  = data?.penandatangan     || {};
    const m   = margin || State.getMarginMm();
    const t   = typo   || State.getTypography();

    const marginStyle = `padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;`
      + `font-family:'${t.fontFamily}',serif;font-size:${t.fontSize}pt;line-height:${t.lineHeight};`;

    // KOP dari state (sama seperti template lain, dapat diedit via tab KOP Surat)
    const kopHtml = _buildKopHtml(kop);

    return `
      <div class="doc-content" style="${marginStyle}">
        ${kopHtml}
        <hr class="doc-kop-divider" />
        <hr class="doc-kop-divider-thin" />

        <!-- Judul -->
        <div style="text-align:center;margin:14pt 0 4pt 0;">
          <p style="margin:0;font-weight:bold;text-transform:uppercase;">Rekomendasi Perpanjangan Izin Operasional RA/Madrasah</p>
          <p style="margin:4pt 0 0 0;white-space:pre-wrap;">Nomor : ${s.nomor ? _esc(s.nomor) : 'B-      /KK.06.03.02/KP.00.4/10/2026'}</p>
        </div>

        <!-- Pembuka -->
        <p style="margin:14pt 0 8pt 0;">Yang bertandatangan dibawah ini :</p>

        ${_buildInfoPejabatHtml([
          { label: 'Nama',             value: pw.nama },
          { label: 'NIP',              value: pw.nip },
          { label: 'Pangkat/Golongan', value: pw.pangkatGolongan },
          { label: 'Jabatan',          value: pw.jabatan },
        ])}

        <p style="margin:0 0 8pt 0;">Dengan ini memberikan rekomendasi perpanjangan izin operasional kepada :</p>

        ${_buildInfoPejabatHtml([
          { label: 'Nama Lembaga',                value: l.namaLembaga },
          { label: 'NSM',                         value: l.nsm },
          { label: 'NPSN',                        value: l.npsn },
          { label: 'Alamat Lembaga',              value: l.alamatLembaga },
          { label: 'Nama Kepala RA / Madrasah',   value: l.namaKepala },
          { label: 'Nama Yayasan Penyelenggara',  value: l.namaYayasan },
        ])}

        <!-- Isi Rekomendasi -->
        <p style="margin:0 0 16pt 0;text-align:justify;">
          Berdasarkan hasil pemantauan, evaluasi dan pembinaan secara langsung terhadap aspek administrasi,
          kelayakan sarana prasarana, serta proses kegiatan belajar mengajar di RA/Madrasah tersebut,
          kami menyatakan bahwa <strong>${l.namaLembaga ? _esc(l.namaLembaga) : '………(nama RA/Madrasah)………'}</strong>
          masih <strong>AKTIF</strong>, <strong>LAYAK</strong> dan <strong>MEMENUHI SYARAT</strong>
          untuk diberikan perpanjangan izin operasional.
        </p>

        <p style="margin:0 0 20pt 0;text-align:justify;">
          Demikian Surat Rekomendasi ini dibuat dengan sebenarnya dan penuh tanggung jawab agar dapat
          dipergunakan sebagaimana mestinya.
        </p>

        <!-- Tanda Tangan (2 kolom) -->
        <div style="display:flex;justify-content:space-between;margin-top:8pt;">
          <div style="text-align:center;min-width:160px;">
            <p style="margin:0;">Mengetahui,</p>
            <p style="margin:0;">Kepala Seksi Pendidikan Madrasah</p>
            <div style="height:50pt;"></div>
            <p style="margin:0;text-decoration:underline;font-weight:bold;">${(pn.kasiPenmad?.nama) ? _esc(pn.kasiPenmad.nama) : '…………………………………'}</p>
            <p style="margin:0;">NIP. ${(pn.kasiPenmad?.nip) ? _esc(pn.kasiPenmad.nip) : '…………………………………..'}</p>
          </div>
          <div style="text-align:center;min-width:160px;">
            <p style="margin:0;">Muara Beliti, ${_formatBulanTahun(s.tanggal)}</p>
            <p style="margin:0;">Pengawas Madrasah</p>
            <div style="height:50pt;"></div>
            <p style="margin:0;text-decoration:underline;font-weight:bold;">${pw.nama ? _esc(pw.nama) : '…………………………………'}</p>
            <p style="margin:0;">NIP. ${pw.nip ? _esc(pw.nip) : '…………………………………..'}</p>
          </div>
        </div>
      </div>`;
  }

  /* ────────────────────────────────────────────────
     RENDERER: IJOP 4 — Rekomendasi dari Kakankemenag
  ──────────────────────────────────────────────── */
  function _renderIjopRekomendasiKankemenag(data, kop, margin, typo) {
    const s  = data?.surat         || {};
    const kk = data?.kakankemenag  || {};
    const l  = data?.lembaga       || {};
    const m  = margin || State.getMarginMm();
    const t  = typo   || State.getTypography();

    const marginStyle = `padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;`
      + `font-family:'${t.fontFamily}',serif;font-size:${t.fontSize}pt;line-height:${t.lineHeight};`;

    const kopHtml = _buildKopHtml(kop);

    return `
      <div class="doc-content" style="${marginStyle}">
        ${kopHtml}
        <hr class="doc-kop-divider" />
        <hr class="doc-kop-divider-thin" />

        <!-- Judul -->
        <div style="text-align:center;margin:14pt 0 4pt 0;">
          <p style="margin:0;font-weight:bold;text-transform:uppercase;">Rekomendasi Perpanjangan Izin Pendirian RA/Madrasah</p>
          <p style="margin:4pt 0 0 0;white-space:pre-wrap;">Nomor : ${s.nomor ? _esc(s.nomor) : 'B-      /KK.06.03.02/KP.00.4/10/2026'}</p>
        </div>

        <!-- Pembuka -->
        <p style="margin:14pt 0 8pt 0;">Yang bertandatangan dibawah ini :</p>

        ${_buildInfoPejabatHtml([
          { label: 'Nama',             value: kk.nama },
          { label: 'NIP',              value: kk.nip },
          { label: 'Pangkat/Golongan', value: kk.pangkatGolongan },
          { label: 'Jabatan',          value: kk.jabatan },
        ])}

        <p style="margin:0 0 8pt 0;text-align:justify;">
          Sehubungan dengan pengajuan permohonan perpanjangan izin pendirian madrasah, dengan terlebih dahulu
          mempertimbangkan kondisi faktual dan perkembangan RA/Madrasah sampai dengan saat ini, dengan ini
          disampaikan bahwa pada prinsipnya kami mendukung dan tidak keberatan dengan usulan penerbitan
          perpanjangan izin pendirian RA/Madrasah :
        </p>

        ${_buildInfoPejabatHtml([
          { label: 'Nama RA/Madrasah',        value: l.namaRaMadrasah },
          { label: 'NSM',                     value: l.nsm },
          { label: 'NPSN',                    value: l.npsn },
          { label: 'Alamat RA/Madrasah',      value: l.alamatRaMadrasah },
          { label: 'Nama Penyelenggara',      value: l.namaPenyelenggara },
          { label: 'Akte Notaris',            value: l.akteNotaris },
          { label: 'Pengesahan Akte Notaris', value: l.pengesahanAkteNotaris },
          { label: 'Peringkat Akreditasi',    value: l.peringkatAkreditasi },
        ])}

        <p style="margin:0 0 20pt 0;text-align:justify;">
          Demikian Surat Rekomendasi ini dibuat untuk dapat dipergunakan sebagaimana mestinya.
        </p>

        <!-- Tanda Tangan -->
        <div style="display:flex;justify-content:flex-end;">
          <div style="text-align:center;min-width:160px;">
            <p style="margin:0;">Muara Beliti, ${_formatBulanTahun(s.tanggal)}</p>
            <p style="margin:0;">Kepala,</p>
            <div style="height:50pt;"></div>
            <p style="margin:0;text-decoration:underline;font-weight:bold;">${kk.nama ? _esc(kk.nama) : '…………………………………'}</p>
            <p style="margin:0;">NIP. ${kk.nip ? _esc(kk.nip) : '…………………………………..'}</p>
          </div>
        </div>
      </div>`;
  }

  /* ────────────────────────────────────────────────
     RENDERER: IJOP 5 — SPTJM dari Kakankemenag
  ──────────────────────────────────────────────── */
  function _renderIjopSptjmKankemenag(data, kop, margin, typo) {
    const s  = data?.surat        || {};
    const kk = data?.kakankemenag || {};
    const m  = margin || State.getMarginMm();
    const t  = typo   || State.getTypography();

    const marginStyle = `padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;`
      + `font-family:'${t.fontFamily}',serif;font-size:${t.fontSize}pt;line-height:${t.lineHeight};`;

    const kopHtml = _buildKopHtml(kop);

    return `
      <div class="doc-content" style="${marginStyle}">
        ${kopHtml}
        <hr class="doc-kop-divider" />
        <hr class="doc-kop-divider-thin" />

        <!-- Judul -->
        <div style="text-align:center;margin:14pt 0 4pt 0;">
          <p style="margin:0;font-weight:bold;text-transform:uppercase;">Surat Pernyataan Tanggung Jawab Mutlak</p>
          <p style="margin:2pt 0 0 0;font-weight:bold;">Kantor Kementerian Agama Kabupaten Musi Rawas</p>
          <p style="margin:4pt 0 0 0;white-space:pre-wrap;">Nomor : ${s.nomor ? _esc(s.nomor) : 'B-      /KK.06.03.02/KP.00.4/10/2026'}</p>
        </div>

        <!-- Pembuka -->
        <p style="margin:14pt 0 8pt 0;">Yang bertandatangan dibawah ini :</p>

        ${_buildInfoPejabatHtml([
          { label: 'Nama',             value: kk.nama },
          { label: 'NIP',              value: kk.nip },
          { label: 'Pangkat/Golongan', value: kk.pangkatGolongan },
          { label: 'Jabatan',          value: kk.jabatan },
        ])}

        <p style="margin:0 0 8pt 0;text-align:justify;">
          Sehubungan dengan pengajuan permohonan perpanjangan izin pendirian RA/Madrasah,
          dengan ini menyatakan dengan sesungguhnya bahwa :
        </p>
        <ol style="margin:0 0 12pt 20pt;padding:0;">
          <li style="margin-bottom:6pt;text-align:justify;">
            Semua informasi dan dokumen yang saya sampaikan sebagaimana tersebut di atas adalah valid dan benar.
          </li>
          <li style="text-align:justify;">
            Apabila dikemudian hari ditemukan penipuan/pemalsuan/penyalahgunaan atas informasi dan/atau
            dokumen yang saya sampaikan tersebut, saya bertanggungjawab mutlak secara hukum dan bersedia
            dikenakan sanksi hukum sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.
          </li>
        </ol>

        <p style="margin:0 0 20pt 0;text-align:justify;">
          Demikian surat pernyataan ini saya buat dengan sebenarnya untuk dapat dipergunakan
          sebagaimana mestinya.
        </p>

        <!-- Meterai + TTD -->
        <div style="display:flex;justify-content:flex-end;">
          <div style="text-align:center;min-width:160px;">
            <p style="margin:0;">Muara Beliti, ${_formatBulanTahun(s.tanggal)}</p>
            <p style="margin:4pt 0 0 0;">Yang menyatakan,</p>
            <div style="border:1px solid #aaa;border-radius:50%;width:52px;height:52px;margin:8pt auto;display:flex;align-items:center;justify-content:center;font-size:7pt;color:#666;text-align:center;line-height:1.2;">
              Meterai<br/>Rp 10.000,-
            </div>
            <div style="height:14pt;"></div>
            <p style="margin:0;text-decoration:underline;font-weight:bold;">${kk.nama ? _esc(kk.nama) : '…………………………………'}</p>
            <p style="margin:0;">NIP. ${kk.nip ? _esc(kk.nip) : '…………………………………..'}</p>
          </div>
        </div>
      </div>`;
  }

  /* ── Escape helper ── */
  function _esc(v) {
    return Utils.escapeHtml(String(v ?? ''));
  }

  async function waitForReady(maxFrames = 90) {
    if (!_previewEl) return;

    const templateId = State.getActiveTemplate();
    if (!templateId) return;

    const isMultiPage = ['dpu', 'mutasi-masuk', 'siswa-baru'].includes(templateId);
    if (isMultiPage && _paginationPromise) {
      // Tunggu pagination render terbaru secara deterministik. Polling di bawah
      // tetap menjadi fallback untuk render lama yang tidak memiliki promise.
      await _paginationPromise;
    }

    let frames = 0;
    while (frames < maxFrames) {
      frames += 1;

      if (!isMultiPage) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        return;
      }

      if (
        _previewEl.classList.contains('surat-preview--document') &&
        _previewEl.querySelector(':scope > .surat-page') &&
        Number(_previewEl.dataset.pageCount || 0) > 0
      ) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        return;
      }

      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }

  /* ── Public API ── */
  return {
    init,
    render,
    setZoomMode: _setZoomMode,
    waitForReady,
  };

})();
