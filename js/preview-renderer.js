/* =============================================================
   preview-renderer.js — Render live preview surat
   ============================================================= */

const PreviewRenderer = (() => {

  let _previewEl   = null;   // #surat-preview
  let _viewportEl  = null;   // #preview-viewport
  let _wrapperEl   = null;   // #preview-canvas-wrapper
  let _zoomLevelEl = null;   // #zoom-level-text
  let _currentZoom = 1;

  const ZOOM_STEP = 0.1;
  const ZOOM_MIN  = 0.3;
  const ZOOM_MAX  = 2.5;

  /* ── Init ── */
  function init() {
    _previewEl   = document.getElementById('surat-preview');
    _viewportEl  = document.getElementById('preview-viewport');
    _wrapperEl   = document.getElementById('preview-canvas-wrapper');
    _zoomLevelEl = document.getElementById('zoom-level-text');

    if (!_previewEl) { console.warn('[PreviewRenderer] Preview element tidak ditemukan.'); return; }

    // Restore zoom dari state
    _currentZoom = State.getUi().previewZoom || 1;
    _applyZoom(_currentZoom);

    // Bind zoom buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => _changeZoom(ZOOM_STEP));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => _changeZoom(-ZOOM_STEP));
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      _currentZoom = 1;
      State.setZoom(1);
      _applyZoom(1);
    });

    // Subscribe state
    const debouncedRender = Utils.debounce(_renderCurrent, 200);

    State.on('kop:change',       debouncedRender);
    State.on('form:change',      debouncedRender);
    State.on('template:change',  debouncedRender);
    State.on('state:restore',    () => {
      _currentZoom = State.getUi().previewZoom || 1;
      _applyZoom(_currentZoom);
      _renderCurrent();
    });
    State.on('state:reset', () => _showPlaceholder());
    State.on('ui:zoomChange', ({ zoom }) => {
      _currentZoom = zoom;
      _applyZoom(zoom);
    });
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

    const isLandscape = tpl.meta.orientation === 'landscape';
    _previewEl.classList.toggle('orientation-landscape', isLandscape);

    // Hitung lebar wrapper agar zoom bekerja dengan benar
    const paperWidthMm = isLandscape ? 297 : 210;
    const paperWidthPx = paperWidthMm * (96 / 25.4); // mm to px at 96dpi
    if (_wrapperEl) {
      _wrapperEl.style.width = `${paperWidthPx}px`;
    }

    const html = _buildDocumentHtml(tpl, formData, kop);
    _previewEl.innerHTML = html;

    // Update wrapper height SETELAH konten dirender (bukan sebelum)
    requestAnimationFrame(() => _updateWrapperHeight(_currentZoom));
  }

  /* ── Build seluruh HTML dokumen ── */
  function _buildDocumentHtml(tpl, formData, kop) {
    const id = tpl.TEMPLATE_ID;
    if (id === 'dpu')          return _renderDpu(formData, kop);
    if (id === 'mutasi-masuk') return _renderSiswa(formData, kop, tpl, true);
    if (id === 'siswa-baru')   return _renderSiswa(formData, kop, tpl, false);
    return '<div style="padding:20px;color:#666;">Template tidak dikenali.</div>';
  }

  /* ── KOP HTML helper ── */
  function _buildKopHtml(kop) {
    return KopEditor.renderKopHtml(kop);
  }

  /* ────────────────────────────────────────────────
     RENDERER: DPU
  ──────────────────────────────────────────────── */
  function _renderDpu(data, kop) {
    const { meta, peserta = [], tandaTangan: ttd = {} } = data;

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

    /* ── Tabel Peserta ── */
    // Header dua baris:
    // Baris 1: URT | INDK | [NOMOR colspan=2] | NIK | NAMA SISWA | L/P | TEMPAT LAHIR | TGL LAHIR | NAMA OT | ASAL SEKOLAH | NO IJAZAH | [TERDAFTAR DI EMIS colspan=3]
    // Baris 2: (under NOMOR) NISN | REGISTRASI | (under TERDAFTAR) SUDAH | BELUM | ALASAN
    // Total kolom data = 15: URT,INDK,NISN,REGISTRASI,NIK,NAMASISWA,LP,TEMPATLAHIR,TGLLAHIR,NAMAOT,ASALSEKOLAH,NOIJAZAH,SUDAH,BELUM,ALASAN
    const theadHtml = `
      <thead>
        <tr>
          <th rowspan="2" style="width:5mm;">URT</th>
          <th rowspan="2" style="width:9mm;">INDK</th>
          <th colspan="2">NOMOR</th>
          <th rowspan="2" style="width:26mm;">NIK</th>
          <th rowspan="2" style="width:30mm;">NAMA SISWA</th>
          <th rowspan="2" style="width:6mm;">L/P</th>
          <th rowspan="2" style="width:16mm;">TEMPAT LAHIR</th>
          <th rowspan="2" style="width:14mm;">TANGGAL LAHIR</th>
          <th rowspan="2" style="width:16mm;">NAMA ORANG TUA</th>
          <th rowspan="2" style="width:20mm;">ASAL SEKOLAH</th>
          <th rowspan="2" style="width:22mm;">No. IJAZAH JENJANG SEBELUMNYA</th>
          <th colspan="3">TERDAFTAR DI EMIS</th>
        </tr>
        <tr>
          <th style="width:20mm;">NISN</th>
          <th style="width:28mm;">REGISTRASI</th>
          <th style="width:8mm;">SUDAH</th>
          <th style="width:8mm;">BELUM</th>
          <th style="width:18mm;">ALASAN JIKA BELUM</th>
        </tr>
      </thead>`;

    const tbodyRows = peserta.map((p, i) => `
      <tr>
        <td class="col-center">${_esc(p.urt || i + 1)}</td>
        <td class="col-center">${_esc(p.indk)}</td>
        <td class="col-center">${_esc(p.nisn)}</td>
        <td style="font-size:6.5pt;">${_esc(p.registrasi)}</td>
        <td class="col-center" style="font-size:7pt;">${_esc(p.nik)}</td>
        <td>${_esc(p.namaSiswa)}</td>
        <td class="col-center">${_esc(p.jenisKelamin)}</td>
        <td>${_esc(p.tempatLahir)}</td>
        <td class="col-center">${p.tanggalLahir ? Utils.formatDateShort(p.tanggalLahir) : ''}</td>
        <td>${_esc(p.namaOrangTua)}</td>
        <td>${_esc(p.asalSekolah)}</td>
        <td style="font-size:6.5pt;">${_esc(p.noIjazah)}</td>
        <td class="col-center">${p.terdaftarEmis !== false ? '☑' : ''}</td>
        <td class="col-center">${p.terdaftarEmis === false ? '☐' : ''}</td>
        <td style="font-size:6.5pt;">${_esc(p.alasanBelum)}</td>
      </tr>`).join('');

    // Tambah baris kosong minimal 3 atau sampai total 5 baris
    const emptyRows = Math.max(0, 5 - peserta.length);
    const emptyRowsHtml = Array.from({ length: emptyRows }, () => `
      <tr class="doc-empty-row">
        ${Array(15).fill('<td>&nbsp;</td>').join('')}
      </tr>`).join('');

    const tableHtml = `
      <div class="doc-table-wrap">
        <table class="doc-table">
          ${theadHtml}
          <tbody>${tbodyRows}${emptyRowsHtml}</tbody>
        </table>
      </div>`;

    /* ── Tanda Tangan ── */
    const ttdHtml = _buildTtdDpu(ttd);

    return `
      <div class="doc-content">
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
      <div class="doc-ttd-section">
        <div class="doc-ttd-row">
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
  function _renderSiswa(data, kop, tpl, isMutasi) {
    const { meta, siswa = [], tandaTangan: ttd = {}, catatan } = data;

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

    /* ── Kolom tabel ── */
    const cols = tpl.tableColumns;
    const theadCells = cols.map(c =>
      `<th style="width:${c.width};text-align:${c.align};">${_esc(c.header)}</th>`
    ).join('');

    /* ── Baris siswa ── */
    const tbodyRows = siswa.map((s, i) => {
      const cells = cols.map(c => {
        let val = '';
        if (c.key === 'no') {
          val = String(i + 1);
        } else if (c.key === 'tanggalLahir') {
          // Dokumen asli: "Tempat TanggalLahir" digabung dalam satu sel
          const tgl = s.tanggalLahir ? Utils.formatDateShort(s.tanggalLahir) : '';
          const tempat = s.tempatLahir || '';
          val = tempat && tgl ? `${tempat} ${tgl}` : (tempat || tgl);
        } else if (c.key === 'tempatLahir') {
          // Di dokumen asli kolom tempat & tgl kadang digabung;
          // tampilkan saja tempat lahir di kolomnya sendiri
          val = s.tempatLahir || '';
        } else if (c.key === 'kelas') {
          const map = { '7': 'VII', '8': 'VIII', '9': 'IX' };
          val = map[s.kelas] || s.kelas || '';
        } else {
          val = s[c.key] != null ? String(s[c.key]) : '';
        }
        return `<td style="text-align:${c.align};font-size:7.5pt;">${_esc(val)}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    // Baris kosong
    const emptyCount = Math.max(0, 5 - siswa.length);
    const emptyRowsHtml = Array.from({ length: emptyCount }, () =>
      `<tr class="doc-empty-row">${cols.map(() => '<td>&nbsp;</td>').join('')}</tr>`
    ).join('');

    const tableHtml = `
      <div class="doc-table-wrap">
        <table class="doc-table">
          <thead><tr>${theadCells}</tr></thead>
          <tbody>${tbodyRows}${emptyRowsHtml}</tbody>
        </table>
      </div>`;

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
    const ttdHtml = _buildTtdSiswa(ttd, meta);

    /* ── Catatan ── */
    let catatanHtml = '';
    if (catatan && catatan.tampilkan && catatan.items && catatan.items.length) {
      const items = catatan.items.map(it => `<li>${_esc(it)}</li>`).join('');
      catatanHtml = `
        <div class="doc-catatan">
          <p class="doc-catatan__title">Catatan:</p>
          <ol class="doc-catatan__list">${items}</ol>
        </div>`;
    }

    return `
      <div class="doc-content">
        ${kopHtml}
        <hr class="doc-kop-divider" />
        <hr class="doc-kop-divider-thin" />
        ${infoHtml}
        ${judulHtml}
        ${tableHtml}
        ${rekapHtml}
        ${ttdHtml}
        ${catatanHtml}
      </div>`;
  }

  function _buildTtdSiswa(ttd, meta) {
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
        <div class="doc-ttd-row">
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

        <!-- Pengesahan Palembang -->
        <div class="doc-pengesahan-extra">
          <div class="doc-pengesahan-row">
            <div class="doc-pengesahan-col" style="text-align:left;">
              <!-- Catatan akan muncul di sini via catatanHtml -->
            </div>
            <div class="doc-pengesahan-col" style="text-align:center;">
              <p>Mengesahkan,</p>
              <p>Katim Kesiswaan,</p>
              <br/><br/><br/>
              <p style="text-decoration:underline;font-weight:bold;">
                ${_esc(ttd.katimKesiswaan?.nama) || '.............................'}
              </p>
              <p>NIP. ${_esc(ttd.katimKesiswaan?.nip) || '-'}</p>
            </div>
            <div class="doc-pengesahan-col" style="text-align:center;">
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
        </div>
      </div>`;
  }

  /* ── Zoom ── */
  function _changeZoom(delta) {
    const newZoom = Utils.clamp(_currentZoom + delta, ZOOM_MIN, ZOOM_MAX);
    _currentZoom = newZoom;
    State.setZoom(newZoom);
    _applyZoom(newZoom);
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
    _previewEl.classList.remove('orientation-landscape');
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
